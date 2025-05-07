import React, { useState, useEffect } from "react";
import "../css/Logtime.css";
// import { getAuthToken } from "./History";

const getAuthToken = () => {
    try {
      const userData = JSON.parse(localStorage.getItem('erp-user'));
      if (!userData || typeof userData !== 'object') {
        return null;
      }
      return userData.token;
    } catch (e) {
      console.error('Failed to parse user data:', e);
      return null;
    }
  };

const LogtimeModal = ({ date, onClose, onSave, initialLogs = [] }) => {
  const [logData, setLogData] = useState(initialLogs);
  const [totalTime, setTotalTime] = useState("0 hours, 0 minutes");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

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
          date: date
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
        <h3>Time Log for {date}</h3>
        
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
                  />
                </td>
                <td>
                  <input
                    type="time"
                    value={entry.start}
                    onChange={(e) => handleEdit(index, "start", e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    value={entry.finish}
                    onChange={(e) => handleEdit(index, "finish", e.target.value)}
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
              Cancel
            </button>
            <button
              className="save-btn"
              onClick={handleSave}
              disabled={isSaving}
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