import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReusablePageStructure from "../components/ReusablePageStructure";
import apiClient from "../utils/apiClient";
import { showToast, handleApiError, formatDisplayDate as formatDisplayDateHelper } from "../utils/helpers";
import { Button, Table, Alert, Form, Stack, Offcanvas } from "react-bootstrap";
import "../css/Style.css";
import { FaPlus, FaFilter, FaSearch, FaSave, FaTimes } from "react-icons/fa";

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
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

export default function LogTimePage() {
  const { date: dateParam } = useParams();
  const navigate = useNavigate();
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [logData, setLogData] = useState([]);
  const [totalTime, setTotalTime] = useState("0 hours, 0 minutes");
  const [selectedDate, setSelectedDate] = useState("");
  const [displayDate, setDisplayDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const formatDateForDisplay = useCallback((yyyyMmDdDate) => {
    if (!yyyyMmDdDate) return "N/A";
    return formatDisplayDateHelper(yyyyMmDdDate);
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
        if (logFinishDateTime > now && inputDate.getTime() === today.getTime()) {
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

    try {
      await apiClient("/logtime", {
        method: "POST",
        body: {
          logs: logData,
          date: selectedDate,
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

  if (isLoading && !selectedDate) {
    return <ReusablePageStructure title="Loading..."><p>Loading date information...</p></ReusablePageStructure>;
  }

  return (
    <ReusablePageStructure
      title={pageTitle}
      footerContent={
        <div className="logtime-footer-actions">
          <Button variant="secondary" onClick={() => navigate("/history")} disabled={isSaving}>
            <FaTimes className="me-1" /> Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving || isLoading || !selectedDate}>
            <FaSave className="me-1" /> {isSaving ? "Saving..." : "Save Logs"}
          </Button>
        </div>
      }
    >
      {error && <Alert variant="danger">{error}</Alert>}

      {/* Mobile Header */}
      {isMobileView && (
        <div className="mobile-logtime-header">
          <Button 
            variant="outline-secondary" 
            onClick={() => setShowMobileFilters(true)}
            className="mobile-filter-btn"
          >
            <FaFilter /> Filters
          </Button>
        </div>
      )}

      {/* Date Selection */}
      <Form.Group className="mb-3">
        <Form.Label>Select Date:</Form.Label>
        <Form.Control
          type="date"
          value={selectedDate}
          onChange={handleDateChange}
          disabled={isSaving || isLoading}
          max={ensureYYYYMMDDFormat(new Date())}
        />
      </Form.Group>

      <div className="log-info total-hours mb-3">
        <strong>Total Hours Worked:</strong> {totalTime}
      </div>

      {/* Mobile Filters Offcanvas */}
      <Offcanvas 
        show={showMobileFilters} 
        onHide={() => setShowMobileFilters(false)}
        placement="end"
        className="mobile-filters-offcanvas"
      >
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Log Time Filters</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <div className="mobile-filter-options">
            <Form.Group>
              <Form.Label>Select Date:</Form.Label>
              <Form.Control
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                disabled={isSaving || isLoading}
                max={ensureYYYYMMDDFormat(new Date())}
              />
            </Form.Group>
          </div>
        </Offcanvas.Body>
      </Offcanvas>

      {isLoading && logData.length === 0 ? (
        <p>Loading log entries...</p>
      ) : isMobileView ? (
        // Mobile View - Card Layout
        <div className="mobile-logtime-entries">
          {logData.map((entry, index) => (
            <div key={index} className="mobile-logtime-card">
              <div className="mobile-logtime-card-header">
                <Form.Control
                  type="text"
                  value={entry.task}
                  onChange={(e) => handleLogChange(index, "task", e.target.value)}
                  placeholder="Task description"
                  disabled={isSaving}
                  className="mobile-logtime-task-input"
                />
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => removeLogRow(index)}
                  disabled={isSaving}
                  className="mobile-logtime-remove-btn"
                >
                  ×
                </Button>
              </div>
              
              <div className="mobile-logtime-time-inputs">
                <Form.Group>
                  <Form.Label>Start:</Form.Label>
                  <Form.Control
                    type="time"
                    value={entry.start}
                    onChange={(e) => handleLogChange(index, "start", e.target.value)}
                    disabled={isSaving}
                  />
                </Form.Group>
                
                <Form.Group>
                  <Form.Label>Finish:</Form.Label>
                  <Form.Control
                    type="time"
                    value={entry.finish}
                    onChange={(e) => handleLogChange(index, "finish", e.target.value)}
                    disabled={isSaving}
                  />
                </Form.Group>
              </div>
              
              <div className="mobile-logtime-total">
                <strong>Time Spent:</strong> {entry.timeSpent}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Desktop View - Table Layout
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
                    ×
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Button 
        variant="success" 
        onClick={addEmptyRow} 
        disabled={isSaving || isLoading} 
        className="mt-2 add-row-btn"
      >
        <FaPlus className="me-1" /> Add Row
      </Button>
    </ReusablePageStructure>
  );
}