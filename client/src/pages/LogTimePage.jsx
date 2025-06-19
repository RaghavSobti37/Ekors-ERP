import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReusablePageStructure from "../components/ReusablePageStructure";
import apiClient from "../utils/apiClient";
import { showToast, handleApiError, formatDisplayDate as formatDisplayDateHelper } from "../utils/helpers"; // prettier-ignore
import { Button, Table, Alert, Form, Row, Col } from "react-bootstrap";
import "../css/Logtime.css"; // You might want to create/use a specific CSS file or reuse styles

// Helper to format a Date object or YYYY-MM-DD string to YYYY-MM-DD string
const ensureYYYYMMDDFormat = (dateInput) => {
  if (dateInput instanceof Date) {
    const year = dateInput.getFullYear();
    const month = String(dateInput.getMonth() + 1).padStart(2, "0");
    const day = String(dateInput.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
    return dateInput;
  }
  // Fallback or error for unexpected formats - for now, assume valid input or handle elsewhere
  console.warn("ensureYYYYMMDDFormat: Unexpected date format", dateInput);
  // Default to today if format is problematic
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

export default function LogTimePage() {
  const { date: dateParam } = useParams(); // YYYY-MM-DD from URL
  const navigate = useNavigate();

  const [logData, setLogData] = useState([]);
  const [totalTime, setTotalTime] = useState("0 hours, 0 minutes");
  const [selectedDate, setSelectedDate] = useState(""); // YYYY-MM-DD
  const [displayDate, setDisplayDate] = useState("");   // DD-Month-YYYY

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const formatDateForDisplay = useCallback((yyyyMmDdDate) => {
    if (!yyyyMmDdDate) return "N/A";
    return formatDisplayDateHelper(yyyyMmDdDate); // Use the helper from utils
  }, []);

  useEffect(() => {
    const initialDate = dateParam === "new" ? ensureYYYYMMDDFormat(new Date()) : ensureYYYYMMDDFormat(dateParam);
    setSelectedDate(initialDate);
    setDisplayDate(formatDateForDisplay(initialDate));
  }, [dateParam, formatDateForDisplay]);

  useEffect(() => {
    if (!selectedDate) return;

    const fetchLogEntries = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient(`/logtime/by-date?date=${selectedDate}`);
        setLogData(response.logs || []);
      } catch (err) {
        const errorMessage = handleApiError(err, "Failed to fetch log entries");
        setError(errorMessage);
        showToast(errorMessage, false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogEntries();
  }, [selectedDate]);

  useEffect(() => {
    let totalMinutes = 0;
    logData.forEach((entry) => {
      if (entry.timeSpent && entry.timeSpent.includes(":")) {
        const [hours, minutes] = entry.timeSpent.split(":").map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          totalMinutes += hours * 60 + minutes;
        }
      }
    });
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    setTotalTime(`${hours} hours, ${minutes} minutes`);
  }, [logData]);

  const calculateTimeDifference = (start, finish) => {
    if (!start || !finish) return "0:00";
    const [startHours, startMinutes] = start.split(":").map(Number);
    const [finishHours, finishMinutes] = finish.split(":").map(Number);

    if (isNaN(startHours) || isNaN(startMinutes) || isNaN(finishHours) || isNaN(finishMinutes)) {
      return "0:00";
    }
    const startTotal = startHours * 60 + startMinutes;
    const finishTotal = finishHours * 60 + finishMinutes;

    if (finishTotal < startTotal) return "Invalid time";

    const diff = finishTotal - startTotal;
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;
    return `${hours}:${String(minutes).padStart(2, "0")}`;
  };

  const handleLogChange = (index, field, value) => {
    const updatedLogs = logData.map((log, i) => {
      if (i === index) {
        const newLog = { ...log, [field]: value };
        if (field === "start" || field === "finish") {
          newLog.timeSpent = calculateTimeDifference(
            field === "start" ? value : newLog.start,
            field === "finish" ? value : newLog.finish
          );
        }
        return newLog;
      }
      return log;
    });
    setLogData(updatedLogs);
  };

  const addEmptyRow = () => {
    setLogData([...logData, { task: "", start: "", finish: "", timeSpent: "0:00" }]);
  };

  const removeLogRow = (index) => {
    setLogData(logData.filter((_, i) => i !== index));
  };

  const handleDateChange = (e) => {
    const newDateYYYYMMDD = e.target.value;
    setSelectedDate(newDateYYYYMMDD);
    setDisplayDate(formatDateForDisplay(newDateYYYYMMDD));
    // Fetch logs for the new date - this will be triggered by selectedDate useEffect
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);

    const now = new Date();
    const inputDate = new Date(selectedDate + "T00:00:00");
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (inputDate > today) {
      const futureDateError = "Cannot log time for a future date.";
      setError(futureDateError);
      showToast(futureDateError, false);
      setIsSaving(false);
      return;
    }

    for (const log of logData) {
      if (log.finish) {
        const logFinishDateTime = new Date(`${selectedDate}T${log.finish}`);
        if (logFinishDateTime > now && inputDate.getTime() === today.getTime()) { // Only check future time for today's logs
          const futureTimeError = `Finish time for task "${log.task}" cannot be in the future.`;
          setError(futureTimeError);
          showToast(futureTimeError, false);
          setIsSaving(false);
          return;
        }
        if (log.start && new Date(`${selectedDate}T${log.start}`) > logFinishDateTime) {
            setError(`Start time cannot be after finish time for task "${log.task}".`);
            setIsSaving(false);
            return;
        }
      }
    }

    // Allow saving even if rows are incomplete, but not if logData is empty and we intend to save.
    // The backend handles if `logs` array is empty.
    // If logData is empty, we might not even enable the save button or just return.
    if (logData.length === 0) {
        showToast("No log entries to save.", false);
        // Or, if you want to allow "saving" an empty state (which might delete logs for the day if backend supports it)
        // you'd proceed. Current backend POST requires non-empty logs array if logs key is present.
        // For now, let's assume we only save if there's something, or user explicitly clears and wants to save "nothing".
        // The backend will return 400 if `logs` is an empty array.
        // To delete all logs for a day, the user should use the delete feature on the History page.
        // So, if logData is empty, we can just navigate back or show a message.
        // For now, the save button will likely be disabled or the backend will reject empty `logs`.
    }

    try {
      await apiClient("/logtime", {
        method: "POST",
        body: {
          logs: logData, // Send all logs, complete or incomplete
          date: selectedDate, // YYYY-MM-DD
        },
      });
      showToast("Logs saved successfully!", true);
      navigate("/history");
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to save logs");
      setError(errorMessage);
      showToast(errorMessage, false);
    } finally {
      setIsSaving(false);
    }
  };

  const pageTitle = `Log Time for ${displayDate}`;

  if (isLoading && !selectedDate) { // Initial load before selectedDate is set
    return <ReusablePageStructure title="Loading..."><p>Loading date information...</p></ReusablePageStructure>;
  }

  return (
    <ReusablePageStructure
      title={pageTitle}
      footerContent={
        <>
          <Button variant="secondary" onClick={() => navigate("/history")} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving || isLoading || !selectedDate}>
            {isSaving ? "Saving..." : "Save Logs"}
          </Button>
        </>
      }
    >
      {error && <Alert variant="danger">{error}</Alert>}
      <Row className="mb-3 align-items-end">
        <Col md={6} className="mb-3 mb-md-0">
          <Form.Group>
            <Form.Label>Select Date:</Form.Label>
            <Form.Control
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              disabled={isSaving || isLoading}
              max={ensureYYYYMMDDFormat(new Date())} // Prevent future dates
            />
          </Form.Group>
        </Col>
        <Col md={6}>
          <div className="log-info total-hours text-md-end">
            <strong>Total Hours Worked:</strong> {totalTime}
          </div>
        </Col>
      </Row>

      {isLoading && logData.length === 0 ? (
        <p>Loading log entries...</p>
      ) : (
        <Table striped bordered hover responsive className="log-time-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Start Time</th>
              <th>Finish Time</th>
              <th>Time Spent</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {logData.map((entry, index) => (
              <tr key={index}>
                <td>
                  <Form.Control
                    type="text"
                    value={entry.task}
                    onChange={(e) => handleLogChange(index, "task", e.target.value)}
                    placeholder="Enter task"
                    disabled={isSaving}
                  />
                </td>
                <td>
                  <Form.Control
                    type="time"
                    value={entry.start}
                    onChange={(e) => handleLogChange(index, "start", e.target.value)}
                    disabled={isSaving}
                  />
                </td>
                <td>
                  <Form.Control
                    type="time"
                    value={entry.finish}
                    onChange={(e) => handleLogChange(index, "finish", e.target.value)}
                    disabled={isSaving}
                  />
                </td>
                <td className="text-center align-middle">{entry.timeSpent}</td>
                <td className="text-center align-middle">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => removeLogRow(index)}
                    disabled={isSaving}
                    title="Remove log"
                  >
                    🗑️
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Button variant="success" onClick={addEmptyRow} disabled={isSaving || isLoading} className="mt-2">
        + Add Row
      </Button>
    </ReusablePageStructure>
  );
}