import React from "react";
import Navbar from "./components/Navbar";
import "./css/Logtime.css";

const historyData = [
  { date: "2025-04-04", totalTime: "8:30", remarks: "Worked on project A" },
  { date: "2025-04-03", totalTime: "7:15", remarks: "Bug fixes and documentation" },
  { date: "2025-04-02", totalTime: "9:00", remarks: "Team meeting and dev tasks" },
];

// Function to format the date to "D-MonthName-YYYY"
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString("default", { month: "long" });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export default function History() {
  return (
    <div>
      <Navbar />
      <div className="log-time-container">
        <h2 style={{ marginBottom: "10px", color: "black" }}>History Records</h2>
        <table className="log-time-table">
          <thead>
            <tr>
              <th className="centered">Date</th>
              <th>Total Time</th>
              <th className="centered">Remarks</th>
              <th>View</th>
            </tr>
          </thead>
          <tbody>
            {historyData.map((entry, index) => (
              <tr key={index}>
                <td className="centered">{formatDate(entry.date)}</td>
                <td className="centered">{entry.totalTime}</td>
                <td className="centered">{entry.remarks}</td>
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
