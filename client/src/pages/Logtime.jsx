import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar.jsx"; // Navigation bar component
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // Authentication context
import LogtimeModal from "../components/LogtimeModal"; // Modal for logging time
import apiClient from "../utils/apiClient"; // Utility for making API requests
import { formatDisplayDate as formatDisplayDateHelper, formatDateForInput as formatDateForInputHelper } from '../utils/helpers'; // Utility functions
import "../css/Style.css"; // General styles
import "../css/Logtime.css"; // Specific styles for Logtime page
import { toast } from "react-toastify"; // Library for toast notifications, ToastContainer removed
import "react-toastify/dist/ReactToastify.css";
import { handleApiError, showToast } from "../utils/helpers"; // Utility functions

export default function Logtime() {
  const [todayLogDate, setTodayLogDate] = useState(""); // Stores today's date string for display
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState(""); // Date to be passed to modal (DD-Month-YYYY)
  const [modalInitialLogs, setModalInitialLogs] = useState([]); // Logs for the modalDate
  const [isFetchingModalData, setIsFetchingModalData] = useState(false);

  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const getFormattedDisplayDate = useCallback((dateObj = new Date()) => {
    return formatDisplayDateHelper(dateObj);
  }, []);

  const getAPIDateFormat = useCallback((dateStringOrObj) => {
    // This function is more complex than the helper due to specific parsing needs
    // for DD-Month-YYYY strings. Keeping it local for now.
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
    const todayFormatted = getFormattedDisplayDate();
    setTodayLogDate(todayFormatted);
    setIsLoading(false);
  }, [user, authLoading, getFormattedDisplayDate]);

  const fetchLogsForDate = async (dateToFetchDisplayFormat) => { // dateToFetch in DD-Month-YYYY
    setIsFetchingModalData(true);
    try {
      const apiDate = getAPIDateFormat(dateToFetchDisplayFormat);
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
    setModalDate(todayLogDate);
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
            initialDate={modalDate}
            initialLogs={modalInitialLogs}
            onClose={handleCloseModal}
            onSave={handleSaveModal}
          />
        )}
      </div>
    </div>
  );
}