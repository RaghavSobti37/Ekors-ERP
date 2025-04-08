import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import "./css/Logtime.css";
import { useNavigate } from "react-router-dom";

const formatDisplayDate = (dateString) => {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString("default", { month: "long" });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

export default function History() {
  const [historyData, setHistoryData] = useState([]);
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const entriesPerPage = 5;

  useEffect(() => {
    fetch("http://localhost:3000/api/logtime/all")
      .then((res) => res.json())
      .then((data) => {
        const withTotal = data.map((entry) => {
          let totalMinutes = 0;
          entry.logs?.forEach((log) => {
            const [h, m] = log.timeSpent.split(":").map(Number);
            if (!isNaN(h) && !isNaN(m)) totalMinutes += h * 60 + m;
          });
          return {
            ...entry,
            totalTime: `${Math.floor(totalMinutes / 60)} hours, ${totalMinutes % 60} minutes`,
            taskCount: entry.logs?.length || 0,
          };
        });
        setHistoryData(withTotal);
      })
      .catch((err) => console.error("Error fetching history:", err));
  }, []);

  const handleSort = () => {
    const newOrder = sortOrder === "asc" ? "desc" : "asc";
    const sorted = [...historyData].sort((a, b) =>
      newOrder === "asc"
        ? new Date(a.date) - new Date(b.date)
        : new Date(b.date) - new Date(a.date)
    );
    setSortOrder(newOrder);
    setHistoryData(sorted);
  };

  const handleView = (entry) => {
    setSelectedEntry(entry);
  };

  const closeModal = () => {
    setSelectedEntry(null);
  };

  const totalPages = Math.ceil(historyData.length / entriesPerPage);
  const currentEntries = historyData.slice(
    (currentPage - 1) * entriesPerPage,
    currentPage * entriesPerPage
  );

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <div>
      <Navbar />
      <div className="log-time-container">
        <h2 style={{ marginBottom: "10px", color: "black" }}>History Records</h2>
        <table className="log-time-table">
          <thead>
            <tr>
              <th className="centered" onClick={handleSort} style={{ cursor: "pointer" }}>
                Date {sortOrder === "asc" ? "⬆️" : "⬇️"}
              </th>
              <th>Total Time</th>
              <th className="centered">Tasks</th>
              <th>View</th>
            </tr>
          </thead>
          <tbody>
            {currentEntries.map((entry, index) => (
              <tr key={index}>
                <td className="centered">{formatDisplayDate(entry.date)}</td>
                <td className="centered">{entry.totalTime}</td>
                <td className="centered">{entry.taskCount}</td>
                <td className="centered">
                  <button className="edit-btn" onClick={() => handleView(entry)}>
                    👁️ View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="pagination-footer" style={{ marginTop: "15px", textAlign: "center" }}>
          <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
            ◀️ Prev
          </button>
          <span style={{ margin: "0 10px" }}>
            Page {currentPage} of {totalPages}
          </span>
          <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
            Next ▶️
          </button>
        </div>
      </div>

      {/* Modal for log details */}
      {selectedEntry && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Details for {formatDisplayDate(selectedEntry.date)}</h3>
            <table className="log-time-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Start</th>
                  <th>Finish</th>
                  <th>Time Spent</th>
                </tr>
              </thead>
              <tbody>
                {selectedEntry.logs.map((log, i) => (
                  <tr key={i}>
                    <td>{log.task}</td>
                    <td>{log.start}</td>
                    <td>{log.finish}</td>
                    <td>{log.timeSpent}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button className="close-btn" onClick={closeModal}>
              ❌ Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
