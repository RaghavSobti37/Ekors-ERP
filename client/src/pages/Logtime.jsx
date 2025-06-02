import React, { useState, useEffect, useCallback } from "react";
import "../css/Style.css";
import "../css/Logtime.css"; // Styles for Logtime page and potentially modal
import Navbar from "../components/Navbar.jsx";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LogtimeModal from "../components/LogtimeModal";
import apiClient from "../utils/apiClient"; // For fetching logs

export default function Logtime() {
  const [todayLogDate, setTodayLogDate] = useState(""); // Stores today's date string for display
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState(""); // Date to be passed to modal (DD-Month-YYYY)
  const [modalInitialLogs, setModalInitialLogs] = useState([]); // Logs for the modalDate
  const [isFetchingModalData, setIsFetchingModalData] = useState(false);

  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Get formatted date for display (DD-Month-YYYY)
  const getFormattedDisplayDate = useCallback((dateObj = new Date()) => {
    const day = String(dateObj.getDate()).padStart(2, "0");
    const month = dateObj.toLocaleString("default", { month: "long" });
    const year = dateObj.getFullYear();
    return `${day}-${month}-${year}`;
  }, []);

  // To get YYYY-MM-DD for API calls from a DD-Month-YYYY string or Date object
  const getAPIDateFormat = useCallback((dateStringOrObj) => {
    let date;
    if (typeof dateStringOrObj === 'string') {
      const parts = dateStringOrObj.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const monthName = parts[1];
        const year = parseInt(parts[2], 10);
        // Get month index from name
        const monthIndex = new Date(Date.parse(monthName +" 1, 2000")).getMonth();
        if (!isNaN(day) && monthIndex !== -1 && !isNaN(year)) {
          date = new Date(year, monthIndex, day);
        }
      }
      if (!date || isNaN(date.getTime())) date = new Date(dateStringOrObj); // Fallback parse
    } else {
      date = dateStringOrObj;
    }

    if (isNaN(date.getTime())) {
      console.error("getAPIDateFormat: Invalid date provided", dateStringOrObj);
      const today = new Date(); // Fallback to today
      return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  useEffect(() => {
    if (authLoading || !user) {
      setIsLoading(true);
      return;
    }
    const todayFormatted = getFormattedDisplayDate(); // DD-Month-YYYY
    setTodayLogDate(todayFormatted);
    setIsLoading(false);
  }, [user, authLoading, getFormattedDisplayDate]);

  const fetchLogsForDate = async (dateToFetchDisplayFormat) => { // dateToFetch in DD-Month-YYYY
    setIsFetchingModalData(true);
    try {
      const apiDate = getAPIDateFormat(dateToFetchDisplayFormat); // Convert to YYYY-MM-DD for API
      const response = await apiClient(`/logtime/by-date?date=${apiDate}`);
      setModalInitialLogs(response.logs || []);
    } catch (error) {
      console.error(`Error fetching logs for date ${dateToFetchDisplayFormat}:`, error);
      setModalInitialLogs([]);
    } finally {
      setIsFetchingModalData(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div>
        <Navbar />
        <div className="log-time-container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  const handleOpenModalForToday = async () => {
    setModalDate(todayLogDate); // DD-Month-YYYY
    await fetchLogsForDate(todayLogDate);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setModalInitialLogs([]);
    setModalDate("");
  };

  const handleSaveModal = () => {
    handleCloseModal();
    // Navigate to history or refresh current view as needed
    navigate("/history");
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
            <strong>Today's Date:</strong> {todayLogDate}
          </div>
          <button className="add-log-btn" onClick={handleOpenModalForToday} disabled={isFetchingModalData}>
            {isFetchingModalData ? "Loading Logs..." : "📝 Add / Edit Today's Log"}
          </button>
        </div>

        {isModalOpen && (
          <LogtimeModal
            initialDate={modalDate} // Pass DD-Month-YYYY
            initialLogs={modalInitialLogs}
            onClose={handleCloseModal}
            onSave={handleSaveModal}
          />
        )}
      </div>
    </div>
  );
}