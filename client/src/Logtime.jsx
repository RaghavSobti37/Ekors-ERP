import React, { useState, useEffect } from "react";
import "./css/Logtime.css";
import Navbar from "./components/Navbar.jsx";
import { useNavigate } from "react-router-dom";

export default function Logtime() {
  const [logData, setLogData] = useState([
    { task: "Task 1", start: "08:00", finish: "08:45", timeSpent: "0:45", remarks: "" },
    { task: "Task 2", start: "09:00", finish: "10:00", timeSpent: "1:00", remarks: "" },
    { task: "Task 3", start: "10:00", finish: "12:30", timeSpent: "2:30", remarks: "" },
    { task: "Meeting A", start: "13:00", finish: "15:10", timeSpent: "2:10", remarks: "" },
    { task: "Task 4", start: "15:15", finish: "16:45", timeSpent: "1:30", remarks: "" },
    { task: "Meeting B", start: "17:00", finish: "18:45", timeSpent: "1:45", remarks: "" },
  ]);

  const [totalTime, setTotalTime] = useState("0 hours, 0 minutes");
  const [logDate, setLogDate] = useState("");
  const navigate = useNavigate();

  // Set current date in format "day-Month-Year"
  useEffect(() => {
    const getFormattedDate = () => {
      const today = new Date();
      const day = String(today.getDate()).padStart(2, "0");
      const month = today.toLocaleString("default", { month: "long" });
      const year = today.getFullYear();
      return `${day}-${month}-${year}`;
    };

    setLogDate(getFormattedDate());

    const interval = setInterval(() => {
      setLogDate(getFormattedDate());
    }, 60 * 60 * 1000); // Optional: refresh every hour

    return () => clearInterval(interval);
  }, []);

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

  const handleEdit = (index, field, value) => {
    const newLogData = [...logData];
    newLogData[index][field] = value;

    if (field === "start" || field === "finish") {
      const startTime = newLogData[index].start;
      const finishTime = newLogData[index].finish;
      newLogData[index].timeSpent = calculateTimeDifference(startTime, finishTime);
    }

    setLogData(newLogData);
  };

  const calculateTimeDifference = (start, finish) => {
    if (!start || !finish) return "";
    const [startHour, startMin] = start.split(":").map(Number);
    const [finishHour, finishMin] = finish.split(":").map(Number);
    let diffHour = finishHour - startHour;
    let diffMin = finishMin - startMin;
    if (diffMin < 0) {
      diffHour -= 1;
      diffMin += 60;
    }
    return `${diffHour}:${diffMin.toString().padStart(2, "0")}`;
  };

  return (
    <div>
      <Navbar />
      <div className="log-time-container">
        <div className="log-time-header">
          <button className="history-btn" onClick={() => navigate("/history")}>
            📜 History
          </button>

          <div className="log-date-display">
            <strong>Date:</strong> {logDate}
          </div>

          <div className="log-info total-hours">
            <span>
              <strong>Total Hours Worked:</strong> {totalTime}
            </span>
          </div>
        </div>

        <table className="log-time-table">
          <thead>
            <tr>
              <th colSpan="6">Log Time Details</th>
            </tr>
            <tr>
              <th>Tasks</th>
              <th>Start Time</th>
              <th>Finish Time</th>
              <th>Total Time Spent</th>
              <th>Remarks</th>
              <th>Edit</th>
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
                <td>
                  <input
                    type="text"
                    value={entry.remarks}
                    onChange={(e) => handleEdit(index, "remarks", e.target.value)}
                  />
                </td>
                <td>
                  <button
                    className="edit-btn"
                    onClick={() => alert(`Edit clicked for row ${index + 1}`)}
                  >
                    ✏️ Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="log-time-buttons">
          <button
            className="add-btn"
            onClick={() => {
              setLogData([
                ...logData,
                { task: "", start: "", finish: "", timeSpent: "", remarks: "" },
              ]);
            }}
          >
            + Add
          </button>
        </div>
      </div>
    </div>
  );
}
