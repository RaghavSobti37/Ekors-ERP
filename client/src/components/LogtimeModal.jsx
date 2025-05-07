import React, { useState, useEffect } from "react";
import "../css/Logtime.css";

const getAuthToken = () => {
  try {
    const userData = JSON.parse(localStorage.getItem("erp-user"));
    if (!userData || typeof userData !== "object") {
      return null;
    }
    return userData.token;
  } catch (e) {
    console.error("Failed to parse user data:", e);
    return null;
  }
};

const formatDisplayDate = (dateString) => {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString("default", { month: "long" });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export default function LogTimeModal({ date, onClose, onSuccess }) {
  const [logData, setLogData] = useState([]);
  const [totalTime, setTotalTime] = useState("0 hours, 0 minutes");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Calculate time difference between start and finish
  const calculateTimeDifference = (start, finish) => {
    if (!start || !finish) return "";

    const [startHours, startMinutes] = start.split(":").map(Number);
    const [finishHours, finishMinutes] = finish.split(":").map(Number);

    if (
      isNaN(startHours) ||
      isNaN(startMinutes) ||
      isNaN(finishHours) ||
      isNaN(finishMinutes)
    ) {
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

    return `${hours}:${minutes.toString().padStart(2, "0")}`;
  };

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

  // Fetch existing logs for the date
  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const token = getAuthToken();
        if (!token) {
          throw new Error("No authentication token found");
        }

        const response = await fetch(
          `http://localhost:3000/api/logtime?date=${date}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          if (response.status === 404) {
            // No logs exist for this date, start with empty array
            setLogData([]);
            return;
          }
          throw new Error("Failed to fetch logs");
        }

        const data = await response.json();
        setLogData(data.logs || []);
      } catch (error) {
        console.error("Error fetching logs:", error);
        setSaveError(error.message || "Failed to fetch logs");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLogs();
  }, [date]);

  // Handle editing any field in a log entry
  const handleEdit = (index, field, value) => {
    const updatedLogs = [...logData];
    updatedLogs[index] = {
      ...updatedLogs[index],
      [field]: value,
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

    // First validate locally for overlaps
    const timeRanges = logData.map((log) => {
      const [startH, startM] = log.start.split(":").map(Number);
      const [endH, endM] = log.finish.split(":").map(Number);
      return {
        start: startH * 60 + startM,
        end: endH * 60 + endM,
        task: log.task,
      };
    });

    for (let i = 0; i < timeRanges.length; i++) {
      for (let j = i + 1; j < timeRanges.length; j++) {
        const a = timeRanges[i];
        const b = timeRanges[j];
        if (a.start < b.end && b.start < a.end) {
          setSaveError(
            `Time overlap detected between "${a.task}" and "${b.task}"`
          );
          setIsSaving(false);
          return;
        }
      }
    }

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await fetch("http://localhost:3000/api/logtime", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          logs: logData,
          date: date,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error ||
            `Failed to save logs: ${response.status} ${response.statusText}`
        );
      }

      const result = await response.json();
      // Update the local state with the complete logs from the server
      setLogData(result.logs);
      onSuccess();
    } catch (error) {
      console.error("Error saving logs:", error);
      setSaveError(error.message || "Failed to save logs. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: "800px" }}>
        <h2>Log Time for {formatDisplayDate(date)}</h2>

        {/* Display save error if any */}
        {saveError && (
          <div
            className="error-message"
            style={{ color: "red", margin: "10px 0" }}
          >
            {saveError}
          </div>
        )}

        {isLoading ? (
          <div className="loading">Loading logs...</div>
        ) : (
          <>
            <div className="log-info total-hours">
              <strong>Total Hours Worked:</strong> {totalTime}
            </div>

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
                {[...logData]
                  .sort((a, b) => a.start.localeCompare(b.start))
                  .map((entry, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="text"
                          value={entry.task}
                          onChange={(e) =>
                            handleEdit(index, "task", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          value={entry.start}
                          onChange={(e) =>
                            handleEdit(index, "start", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          value={entry.finish}
                          onChange={(e) =>
                            handleEdit(index, "finish", e.target.value)
                          }
                        />
                      </td>
                      <td className="centered">{entry.timeSpent}</td>
                    </tr>
                  ))}
              </tbody>
            </table>

            <div
              className="log-time-buttons"
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "15px",
              }}
            >
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
                + Add Row
              </button>

              <div>
                <button
                  className="cancel-btn"
                  onClick={onClose}
                  disabled={isSaving}
                  style={{ marginRight: "10px" }}
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
          </>
        )}
      </div>
    </div>
  );
}
