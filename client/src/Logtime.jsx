import React, { useState } from "react";
import "./css/Logtime.css";
import Navbar from "./components/Navbar.jsx";

export default function Logtime() {
  const [logData, setLogData] = useState([
    { task: "Task 1", start: "08:00", finish: "08:45", timeSpent: "0:45", remarks: "" },
    { task: "Task 2", start: "09:00", finish: "10:00", timeSpent: "1:00", remarks: "" },
    { task: "Task 3", start: "10:00", finish: "12:30", timeSpent: "2:30", remarks: "" },
    { task: "Meeting A", start: "13:00", finish: "15:10", timeSpent: "2:10", remarks: "" },
    { task: "Task 4", start: "15:15", finish: "16:45", timeSpent: "1:30", remarks: "" },
    { task: "Meeting B", start: "17:00", finish: "18:45", timeSpent: "1:45", remarks: "" },
  ]);

  // Handle cell edits
  const handleEdit = (index, field, value) => {
    const newLogData = [...logData];
    newLogData[index][field] = value;

    // Auto-update total time spent
    if (field === "start" || field === "finish") {
      const startTime = newLogData[index].start;
      const finishTime = newLogData[index].finish;
      newLogData[index].timeSpent = calculateTimeDifference(startTime, finishTime);
    }

    setLogData(newLogData);
  };

  // Calculate Time Difference
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
          <div className="log-info">
            <span><strong>Name:</strong> User Name</span>
          </div>
          <div className="log-info">
            <span><strong>Date:</strong> Friday, May 4th, 2025</span>
          </div>
          <div className="log-info total-hours">
            <span><strong>Total Hours Worked:</strong> 9 hours, 40 minutes</span>
          </div>
        </div>

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
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {logData.map((entry, index) => (
              <tr key={index}>
                <td contentEditable>{entry.task}</td>
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
                <td>{entry.timeSpent}</td>
                <td>
                  <input 
                    type="text" 
                    value={entry.remarks} 
                    placeholder="Enter remarks..." 
                    onChange={(e) => handleEdit(index, "remarks", e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Buttons at the bottom */}
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
          <button
            className="history-btn"
            onClick={() => {
              alert("History button clicked!");
              // Add navigation or modal logic here
            }}
          >
            📜 History
          </button>
        </div>
      </div>
    </div>
  );
}
