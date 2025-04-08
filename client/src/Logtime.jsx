import React, { useState, useEffect } from "react";
import "./css/Logtime.css";
import Navbar from "./components/Navbar.jsx";
import { useNavigate, useLocation } from "react-router-dom";

export default function Logtime() {
  const [logData, setLogData] = useState([]);
  const [totalTime, setTotalTime] = useState("0 hours, 0 minutes");
  const [logDate, setLogDate] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const getFormattedDate = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = today.toLocaleString("default", { month: "long" });
    const year = today.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Extract query params
  const getDateFromParams = () => {
    const params = new URLSearchParams(location.search);
    return params.get("date");
  };

  useEffect(() => {
    const rawDate = getDateFromParams();
    let formattedDisplayDate = getFormattedDate();
    let apiDate = "today";

    if (rawDate) {
      apiDate = rawDate;
      const date = new Date(rawDate);
      const day = String(date.getDate()).padStart(2, "0");
      const month = date.toLocaleString("default", { month: "long" });
      const year = date.getFullYear();
      formattedDisplayDate = `${day}-${month}-${year}`;
    }

    setLogDate(formattedDisplayDate);

    fetch(`http://localhost:3000/api/logtime/${apiDate}`)
      .then((res) => res.json())
      .then((data) => {
        setLogData(data.logs || []);
      })
      .catch((err) => {
        console.error("Error fetching logs:", err);
      });
  }, [location.search]);

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

  const handleSave = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/logtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logs: logData, date: logDate }),
      });

      if (!response.ok) throw new Error("Failed to save logs");
      alert("Logs saved successfully!");
    } catch (error) {
      console.error("Error saving logs:", error);
      alert("Failed to save logs");
    }
  };

  const handleEdit = (index, field, value) => {
    const newLogData = [...logData];
    newLogData[index][field] = value;

    if (field === "start" || field === "finish") {
      const start = newLogData[index].start;
      const finish = newLogData[index].finish;
      newLogData[index].timeSpent = calculateTimeDifference(start, finish);
    }

    setLogData(newLogData);
  };

  const calculateTimeDifference = (start, finish) => {
    if (!start || !finish) return "";
    const [sh, sm] = start.split(":").map(Number);
    const [fh, fm] = finish.split(":").map(Number);
    let hours = fh - sh;
    let minutes = fm - sm;
    if (minutes < 0) {
      hours -= 1;
      minutes += 60;
    }
    return `${hours}:${minutes.toString().padStart(2, "0")}`;
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
            <strong>Total Hours Worked:</strong> {totalTime}
          </div>
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
          >
            + Add
          </button>

          <button className="save-btn" onClick={handleSave}>
            💾 Save Logs
          </button>
        </div>
      </div>
    </div>
  );
}
