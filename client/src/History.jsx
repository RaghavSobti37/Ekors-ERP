import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import "./css/Logtime.css";
import { useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";

const formatDisplayDate = (dateString) => {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString("default", { month: "long" });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

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

export default function History() {
  const [historyData, setHistoryData] = useState([]);
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const entriesPerPage = 5;
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch("http://localhost:3000/api/logtime/all", {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }

      const data = await response.json();
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
    } catch (error) {
      console.error("Error fetching history:", error);
      setError(error.message || "Failed to fetch history");
      if (error.message.includes('authentication')) {
        navigate('/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchHistory();
  }, [user, navigate]);

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

  if (isLoading) {
    return (
      <div>
        <Navbar />
        <div className="log-time-container">
          <div className="loading">Loading history...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Navbar />
        <div className="log-time-container">
          <div className="error-message" style={{ color: "red" }}>
            {error}
          </div>
          <button onClick={fetchHistory}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="log-time-container">
        <div className="history-header">
          <h2>Time Log History</h2>
          <button className="back-btn" onClick={() => navigate(-1)}>
            ↩ Back to Log Time
          </button>
        </div>
        
        <table className="log-time-table">
          <thead>
            <tr>
              <th className="centered" onClick={handleSort} style={{ cursor: "pointer" }}>
                Date {sortOrder === "asc" ? "⬆️" : "⬇️"}
              </th>
              <th className="centered">Total Time</th>
              <th className="centered">Tasks</th>
              <th className="centered">Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentEntries.map((entry, index) => (
              <tr key={index}>
                <td className="centered">{formatDisplayDate(entry.date)}</td>
                <td className="centered">{entry.totalTime}</td>
                <td className="centered">{entry.taskCount}</td>
                <td className="centered">
                  <button 
                    className="view-btn" 
                    onClick={() => handleView(entry)}
                  >
                    👁️ View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {historyData.length > 0 && (
          <div className="pagination-footer" style={{ marginTop: "15px", textAlign: "center" }}>
            <button 
              onClick={() => goToPage(currentPage - 1)} 
              disabled={currentPage === 1}
              className="pagination-btn"
            >
              ◀️ Prev
            </button>
            <span style={{ margin: "0 10px" }}>
              Page {currentPage} of {totalPages}
            </span>
            <button 
              onClick={() => goToPage(currentPage + 1)} 
              disabled={currentPage === totalPages}
              className="pagination-btn"
            >
              Next ▶️
            </button>
          </div>
        )}

        {historyData.length === 0 && !isLoading && (
          <div className="no-records">No history records found</div>
        )}
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
                  <th>Start Time</th>
                  <th>Finish Time</th>
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