import React from "react";
import Navbar from "./components/Navbar";
import "./css/Logtime.css";

const historyData = [
  { date: "2025-04-04", totalTime: "8:30", remarks: "Worked on project A" },
  { date: "2025-04-03", totalTime: "7:15", remarks: "Bug fixes and documentation" },
  { date: "2025-04-02", totalTime: "9:00", remarks: "Team meeting and dev tasks" },
];

export default function History() {
  return (
    <div>
      <Navbar />
      <div className="log-time-container">
        <h2 style={{ marginBottom: "10px" }}>History Records</h2>
        <table className="log-time-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Total Time</th>
              <th>Remarks</th>
              <th>View</th>
            </tr>
          </thead>
          <tbody>
            {historyData.map((entry, index) => (
              <tr key={index}>
                <td>{entry.date}</td>
                <td className="centered">{entry.totalTime}</td>
                <td>{entry.remarks}</td>
                <td className="centered">
                  <button
                    className="edit-btn"
                    onClick={() => alert(`Viewing details for ${entry.date}`)}
                  >
                    👁️ View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
