import React, { useState, useEffect } from "react";
import "../css/Logtime.css";

   const getAuthToken = () => {
    try {
      const token = localStorage.getItem("erp-user");
    console.log("[DEBUG Client Quotations.jsx] getAuthToken retrieved:", token ? "Token present" : "No token");
    return token || null;
    } catch (e) {
      console.error("Failed to parse user data:", e);
      return null;
    }
  };
  

const LogtimeModal = ({ initialDate = "", onClose, onSave, initialLogs = [] }) => {
  const [logData, setLogData] = useState(initialLogs);
  const [totalTime, setTotalTime] = useState("0 hours, 0 minutes");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [displayDate, setDisplayDate] = useState("");
  const [isEditingDate, setIsEditingDate] = useState(false);

  // Format date for display (DD-Month-YYYY)
  const formatDisplayDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const day = date.getDate();
    const month = date.toLocaleString("default", { month: "long" });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Format date for input (YYYY-MM-DD)
  const formatInputDate = (dateString) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Parse date from display format (DD-Month-YYYY)
  const parseDisplayDate = (displayDate) => {
    const [day, month, year] = displayDate.split("-");
    return new Date(`${month} ${day}, ${year}`);
  };

  // Initialize dates
  useEffect(() => {
    if (initialDate) {
      setSelectedDate(initialDate);
      setDisplayDate(formatDisplayDate(initialDate));
    } else {
      const today = new Date();
      const todayFormatted = formatInputDate(today);
      setSelectedDate(todayFormatted);
      setDisplayDate(formatDisplayDate(todayFormatted));
    }
  }, [initialDate]);

  // Calculate total time
  useEffect(() => {
    let totalMinutes = 0;
    logData.forEach((entry) => {
      const [hours, minutes] = entry.timeSpent.split(":").map(Number);
      if (!isNaN(hours) && !isNaN(minutes)) {
        totalMinutes += hours * 60 + minutes;
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    setTotalTime(`${hours} hours, ${minutes} minutes`);
  }, [logData]);

  // Calculate time difference between start and finish
  const calculateTimeDifference = (start, finish) => {
    if (!start || !finish) return "";

    const [startHours, startMinutes] = start.split(":").map(Number);
    const [finishHours, finishMinutes] = finish.split(":").map(Number);

    if (isNaN(startHours) || isNaN(startMinutes) ||
      isNaN(finishHours) || isNaN(finishMinutes)) {
      return "";
    }

    const startTotal = startHours * 60 + startMinutes;
    const finishTotal = finishHours * 60 + finishMinutes;

    if (finishTotal < startTotal) {
      return "Invalid time";
    }

    const diff = finishTotal - startTotal;
    const hours = Math.floor(diff / 60);
    const minutes = diff % 60;

    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  // Handle editing any field in a log entry
  const handleEdit = (index, field, value) => {
    const updatedLogs = [...logData];
    updatedLogs[index] = {
      ...updatedLogs[index],
      [field]: value
    };

    // If editing start or finish time, recalculate time spent
    if (field === "start" || field === "finish") {
      const timeSpent = calculateTimeDifference(
        field === "start" ? value : updatedLogs[index].start,
        field === "finish" ? value : updatedLogs[index].finish
      );
      updatedLogs[index].timeSpent = timeSpent;
    }

    setLogData(updatedLogs);
  };

  // Handle date change from date picker
  const handleDateChange = (e) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    setDisplayDate(formatDisplayDate(newDate));
    setIsEditingDate(false);
  };

  // Handle manual date edit
  const handleManualDateChange = (e) => {
    setDisplayDate(e.target.value);
  };

  // Save manually edited date
  const saveManualDate = () => {
    try {
      const date = parseDisplayDate(displayDate);
      if (isNaN(date.getTime())) {
        throw new Error("Invalid date");
      }
      const formattedDate = formatInputDate(date);
      setSelectedDate(formattedDate);
      setDisplayDate(formatDisplayDate(formattedDate));
      setIsEditingDate(false);
    } catch (error) {
      console.error("Invalid date format", error);
      // Reset to current date if invalid
      const today = new Date();
      const todayFormatted = formatInputDate(today);
      setSelectedDate(todayFormatted);
      setDisplayDate(formatDisplayDate(todayFormatted));
      setIsEditingDate(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch("http://localhost:3000/api/logtime", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          logs: logData,
          date: selectedDate
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
          `Failed to save logs: ${response.status} ${response.statusText}`
        );
      }

      onSave();
      onClose();
    } catch (error) {
      console.error("Error saving logs:", error);
      setSaveError(error.message || "Failed to save logs. Please try again.");
    } finally {
      setIsSaving(false);
    }
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
                value={displayDate}
                onChange={handleManualDateChange}
                className="date-edit-input"
                placeholder="DD-Month-YYYY"
              />
              <button 
                className="save-date-btn"
                onClick={saveManualDate}
                disabled={isSaving}
              >
                Save Date
              </button>
              <button 
                className="cancel-date-btn"
                onClick={() => {
                  setDisplayDate(formatDisplayDate(selectedDate));
                  setIsEditingDate(false);
                }}
                disabled={isSaving}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="date-display-container">
              <h3>Time Log for {displayDate}</h3>
              <button 
                className="edit-date-btn"
                onClick={() => setIsEditingDate(true)}
                title="Edit date"
                disabled={isSaving}
              >
                ✏️
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                className="date-picker-input"
                max="9999-12-31"
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
          <div className="error-message" style={{ color: "red", margin: "10px 0" }}>
            {saveError}
          </div>
        )}

        <table className="log-time-table">
          <thead>
            <tr>
              <th colSpan="4">Log Time Details</th>
            </tr>
            <tr>
              <th>Tasks</th>
              <th>Start Time</th>
              <th>Finish Time</th>
              <th>Total Time Spent</th>
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
                    disabled={isSaving}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    value={entry.start}
                    onChange={(e) => handleEdit(index, "start", e.target.value)}
                    disabled={isSaving}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    value={entry.finish}
                    onChange={(e) => handleEdit(index, "finish", e.target.value)}
                    disabled={isSaving}
                  />
                </td>
                <td className="centered">{entry.timeSpent}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="log-time-buttons" style={{ display: "flex", justifyContent: "space-between" }}>
          <button
            className="add-btn"
            onClick={() =>
              setLogData([
                ...logData,
                { task: "", start: "", finish: "", timeSpent: "" },
              ])
            }
            disabled={isSaving}
          >
            + Add
          </button>

          <div>
            <button
              className="close-btn"
              onClick={onClose}
              disabled={isSaving}
              style={{ marginRight: '10px' }}
            >
              
            </button>
            <button
              className="save-btn"
              onClick={handleSave}
              disabled={isSaving || !selectedDate}
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