import React, { useState, useEffect, useCallback } from "react";
import "../css/Logtime.css";
import { showToast } from "../utils/helpers"; // For showing validation messages
import apiClient from "../utils/apiClient"; // For consistency

const LogtimeModal = ({
  initialDate = "",
  onClose,
  onSave,
  initialLogs = [],
}) => {
  const [logData, setLogData] = useState([]);
  const [totalTime, setTotalTime] = useState("0 hours, 0 minutes");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // selectedDate should be in YYYY-MM-DD for the input[type=date]
  const [selectedDate, setSelectedDate] = useState("");
  // displayDate should be in DD-Month-YYYY for user display
  const [displayDate, setDisplayDate] = useState("");
  const [isEditingDate, setIsEditingDate] = useState(false);

  // Format date for display (DD-Month-YYYY)
  const formatDisplayDate = useCallback((dateInput) => {
    // dateInput can be YYYY-MM-DD string or Date object
    // A more robust way to handle YYYY-MM-DD specifically for date objects from input type=date
    if (
      typeof dateInput === "string" &&
      dateInput.match(/^\d{4}-\d{2}-\d{2}$/)
    ) {
      const parts = dateInput.split("-");
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
      const day = parseInt(parts[2], 10);
      const tempDate = new Date(Date.UTC(year, month, day)); // Use UTC to avoid timezone shifts from string
      if (!isNaN(tempDate.getTime())) {
        const d = String(tempDate.getUTCDate()).padStart(2, "0");
        const m = tempDate.toLocaleString("default", {
          month: "long",
          timeZone: "UTC",
        });
        const y = tempDate.getUTCFullYear();
        return `${d}-${m}-${y}`;
      }
    } else if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
      const day = String(dateInput.getDate()).padStart(2, "0");
      const monthName = dateInput.toLocaleString("default", { month: "long" });
      const year = dateInput.getFullYear();
      return `${day}-${monthName}-${year}`;
    }
    // Fallback for DD-Month-YYYY string (initialDate from parent)
    if (typeof dateInput === "string" && dateInput.includes("-")) {
      // Check if it's already DD-Month-YYYY by trying to parse it as such
      const parts = dateInput.split("-");
      if (
        parts.length === 3 &&
        isNaN(parseInt(parts[1], 10)) &&
        !isNaN(parseInt(parts[0], 10)) &&
        !isNaN(parseInt(parts[2], 10))
      ) {
        return dateInput; // Assume it's already DD-Month-YYYY
      }
    }
    // Fallback if parsing fails or format is unexpected
    console.warn(
      "formatDisplayDate: Could not format date, falling back to today.",
      dateInput
    );
    const today = new Date();
    return `${String(today.getDate()).padStart(2, "0")}-${today.toLocaleString(
      "default",
      { month: "long" }
    )}-${today.getFullYear()}`;
  }, []);

  // Format date for input[type=date] (YYYY-MM-DD)
  const formatInputDate = useCallback((dateInput) => {
    // dateInput can be DD-Month-YYYY string or Date object
    let date;
    if (typeof dateInput === "string") {
      // Try parsing DD-Month-YYYY
      const parts = dateInput.split("-");
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const monthStr = parts[1];
        const year = parseInt(parts[2], 10);
        const monthIndex = new Date(
          Date.parse(monthStr + " 1, 2000")
        ).getMonth(); // Get month index from name
        if (!isNaN(day) && monthIndex !== -1 && !isNaN(year)) {
          date = new Date(year, monthIndex, day);
        }
      }
      if (!date || isNaN(date.getTime())) {
        date = new Date(dateInput); // Fallback to direct parsing (e.g. if it's YYYY-MM-DD)
      }
    } else if (dateInput instanceof Date) {
      // if it's a Date object
      date = dateInput;
    } else {
      // fallback for other types or undefined
      date = new Date(); // default to today
    }

    if (isNaN(date.getTime())) {
      console.warn(
        "formatInputDate: Invalid date provided, falling back to today.",
        dateInput
      );
      const today = new Date();
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(
        2,
        "0"
      )}-${String(today.getDate()).padStart(2, "0")}`;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const dayString = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${dayString}`;
  }, []);

  // Initialize dates and logs
  useEffect(() => {
    // initialDate is expected to be DD-Month-YYYY from parent
    // selectedDate (for input type="date") needs to be YYYY-MM-DD
    // displayDate (for h3) needs to be DD-Month-YYYY
    let dateToUseForDisplay;
    if (initialDate) {
      dateToUseForDisplay = initialDate; // DD-Month-YYYY
    } else {
      // Default to today if no initialDate
      const today = new Date();
      const day = String(today.getDate()).padStart(2, "0");
      const monthName = today.toLocaleString("default", { month: "long" });
      const year = today.getFullYear();
      dateToUseForDisplay = `${day}-${monthName}-${year}`; // DD-Month-YYYY
    }
    setSelectedDate(formatInputDate(dateToUseForDisplay)); // Convert to YYYY-MM-DD
    setDisplayDate(dateToUseForDisplay); // Already in DD-Month-YYYY

    // Ensure initialLogs is an array and deep copy to avoid mutating parent state
    setLogData(
      Array.isArray(initialLogs) ? initialLogs.map((log) => ({ ...log })) : []
    );
  }, [initialDate, initialLogs, formatInputDate, formatDisplayDate]);

  // Calculate total time
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

    if (
      isNaN(startHours) ||
      isNaN(startMinutes) ||
      isNaN(finishHours) ||
      isNaN(finishMinutes)
    ) {
      return "0:00";
    }

    const startTotal = startHours * 60 + startMinutes;
    const finishTotal = finishHours * 60 + finishMinutes;

    if (finishTotal < startTotal) {
      return "Invalid time";
    }

    const diff = finishTotal - startTotal;
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;

    return `${hours}:${minutes.toString().padStart(2, "0")}`;
  };

  const handleEdit = (index, field, value) => {
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

  // Handle date change from date picker (input type="date")
  const handleDateChange = (e) => {
    const newDateYYYYMMDD = e.target.value; // This is YYYY-MM-DD
    setSelectedDate(newDateYYYYMMDD);
    setDisplayDate(formatDisplayDate(newDateYYYYMMDD)); // Convert YYYY-MM-DD to DD-Month-YYYY for display
    setIsEditingDate(false); // If date picker is used, assume manual edit mode is off
  };

  // Handle manual date edit in text input
  const handleManualDateChange = (e) => {
    setDisplayDate(e.target.value); // User types DD-Month-YYYY
  };

  // Helper to parse DD-Month-YYYY string to Date object
  const parseDisplayDateString = (dateString) => {
    const parts = dateString.split("-");
    if (parts.length !== 3)
      throw new Error("Invalid date parts: Expected DD-Month-YYYY");
    const day = parseInt(parts[0], 10);
    const monthName = parts[1];
    const year = parseInt(parts[2], 10);

    const monthIndex = new Date(Date.parse(monthName + " 1, 2000")).getMonth(); // Get month index from name
    if (
      isNaN(day) ||
      day < 1 ||
      day > 31 ||
      isNaN(monthIndex) ||
      monthIndex < 0 ||
      isNaN(year) ||
      year < 1000 ||
      year > 9999
    ) {
      throw new Error("Invalid date components in DD-Month-YYYY");
    }
    return new Date(year, monthIndex, day);
  };

  // Save manually edited date (from text input)
  const saveManualDate = () => {
    try {
      // displayDate is expected to be DD-Month-YYYY
      const parsedFromDisplay = parseDisplayDateString(displayDate);
      if (isNaN(parsedFromDisplay.getTime())) {
        throw new Error("Invalid date format entered.");
      }
      const newSelectedDate = formatInputDate(parsedFromDisplay); // Convert to YYYY-MM-DD
      const newDisplayDate = formatDisplayDate(newSelectedDate); // Re-format to canonical DD-Month-YYYY

      setSelectedDate(newSelectedDate);
      setDisplayDate(newDisplayDate);
      setIsEditingDate(false);
      setSaveError(null); // Clear previous date errors
    } catch (error) {
      console.error("Invalid date format", error);
      setSaveError(
        error.message ||
          "Invalid date format: Please use DD-Month-YYYY (e.g., 01-January-2024)."
      );
      // Optionally reset to last valid selectedDate's display format
      // setDisplayDate(formatDisplayDate(selectedDate));
      // Keep editing open for correction
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    // Date validation: Cannot be in the future
    const now = new Date();
    const inputDate = new Date(selectedDate + "T00:00:00"); // Ensure comparison is at start of day

    // Normalize 'now' to the start of today for date-only comparison
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (inputDate > today) {
      const futureDateError = "Cannot log time for a future date.";
      setSaveError(futureDateError);
      showToast(futureDateError, false);
      setIsSaving(false);
      return;
    }


    const validLogs = logData.filter(
      (log) =>
        log.task &&
        log.start &&
        log.finish &&
        log.timeSpent &&
        log.timeSpent !== "Invalid time"
    );

    // Time validation: Finish time cannot be in the future for the selected date
    for (const log of validLogs) {
      if (log.finish) {
        const logFinishDateTime = new Date(`${selectedDate}T${log.finish}`);
        if (logFinishDateTime > now) {
          const futureTimeError = `Finish time for task "${log.task}" cannot be in the future.`;
          setSaveError(futureTimeError);
          showToast(futureTimeError, false);
          setIsSaving(false);
          return;
        }
        if (log.start && new Date(`${selectedDate}T${log.start}`) > logFinishDateTime) {
            setSaveError(`Start time cannot be after finish time for task "${log.task}".`);
            setIsSaving(false);
            return;
        }
      }
    }

    if (validLogs.length === 0 && logData.length > 0) {
      setSaveError(
        "No valid log entries to save. Please complete task, start, and finish times for all rows, or remove incomplete rows."
      );
      setIsSaving(false);
      return;
    }
    if (validLogs.length === 0 && logData.length === 0) {
      onClose();
      setIsSaving(false);
      return;
    }

    try {
      // selectedDate is already in YYYY-MM-DD format
      const response = await apiClient("/logtime", {
        method: "POST",
        body: {
          logs: validLogs,
          date: selectedDate, // Send YYYY-MM-DD
        },
      });

      onSave(); // Call parent's onSave
      onClose(); // Call parent's onClose
    } catch (error) {
      console.error("Error saving logs:", error);
      setSaveError(
        error.data?.error ||
          error.message ||
          "Failed to save logs. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const addEmptyRow = () => {
    setLogData([
      ...logData,
      { task: "", start: "", finish: "", timeSpent: "0:00" },
    ]);
  };

  const removeLogRow = (index) => {
    const updatedLogs = logData.filter((_, i) => i !== index);
    setLogData(updatedLogs);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        {/* Close button at top right */}
        <button
          className="modal-close-btn"
          onClick={onClose}
          disabled={isSaving}
          title="Close"
        >
          &times;
        </button>

        {/* Date Selection Section */}
        <div className="date-selection-container">
          {isEditingDate ? (
            <div className="date-edit-container">
              <input
                type="text"
                value={displayDate} // DD-Month-YYYY
                onChange={handleManualDateChange}
                className="date-edit-input"
                placeholder="DD-Month-YYYY"
                disabled={isSaving}
              />
              <button
                className="save-date-btn modal-button"
                onClick={saveManualDate}
                disabled={isSaving}
              >
                Save Date
              </button>
              <button
                className="cancel-date-btn modal-button"
                onClick={() => {
                  setDisplayDate(formatDisplayDate(selectedDate)); // Reset to last valid YYYY-MM-DD, formatted
                  setIsEditingDate(false);
                }}
                disabled={isSaving}
              >
              </button>
            </div>
          ) : (
            <div className="date-display-container">
              <h3>Time Log for {displayDate}</h3> {/* DD-Month-YYYY */}
              <button
                className="edit-date-btn modal-button-icon"
                onClick={() => setIsEditingDate(true)}
                title="Edit date"
                disabled={isSaving}
              >
                ✏️
              </button>
              <input
                type="date"
                value={selectedDate} // YYYY-MM-DD
                onChange={handleDateChange}
                className="date-picker-input"
                max="9999-12-31" // Standard max for date inputs
                disabled={isSaving}
              />
            </div>
          )}
        </div>

        <div className="log-info total-hours">
          <strong>Total Hours Worked:</strong> {totalTime}
        </div>

        {/* Display save error if any */}
        {saveError && (
          <div className="error-message modal-error">{saveError}</div>
        )}

        <table className="log-time-table">
          <thead>
            <tr>
              <th colSpan="5">Log Time Details</th>
            </tr>
            <tr>
              <th>Tasks</th>
              <th>Start Time</th>
              <th>Finish Time</th>
              <th>Total Time Spent</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {logData.map((entry, index) => (
              <tr key={index}>
                <td>
                  <input
                    type="text"
                    value={entry.task}
                    onChange={(e) => handleEdit(index, "task", e.target.value)}
                    placeholder="Enter task"
                    className="log-input"
                    disabled={isSaving}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    value={entry.start}
                    onChange={(e) => handleEdit(index, "start", e.target.value)}
                    className="log-input"
                    disabled={isSaving}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    value={entry.finish}
                    onChange={(e) =>
                      handleEdit(index, "finish", e.target.value)
                    }
                    className="log-input"
                    disabled={isSaving}
                  />
                </td>
                <td className="centered time-spent-cell">{entry.timeSpent}</td>
                <td className="centered action-cell">
                  <button
                    onClick={() => removeLogRow(index)}
                    className="delete-row-btn modal-button-icon"
                    disabled={isSaving}
                    title="Remove this log entry"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="log-time-buttons modal-actions">
          <button
            className="add-btn modal-button"
            onClick={addEmptyRow}
            disabled={isSaving}
          >
            + Add Row
          </button>

          <div>
            <button
              className="close-btn modal-button"
              onClick={onClose}
              disabled={isSaving}
              style={{ marginRight: "10px" }}
            >
            
            </button>
            <button
              className="save-btn modal-button primary"
              onClick={handleSave}
              disabled={
                isSaving ||
                !selectedDate ||
                (logData.length > 0 &&
                  logData.every(
                    (log) => !log.task && !log.start && !log.finish
                  ))
              }
            >
              {isSaving ? "Saving..." : "💾 Save Logs"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogtimeModal;
