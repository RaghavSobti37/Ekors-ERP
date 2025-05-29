import React, { useState, useEffect } from "react";
import "../css/Style.css";
import Navbar from "../components/Navbar.jsx";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LogtimeModal from "../components/LogtimeModal";
import ActionButtons from "../components/ActionButtons";
import {
  Eye, // View
  PencilSquare, // Edit
  Trash, // Delete
  BarChart, // Generate Report
} from 'react-bootstrap-icons';

export default function Logtime() {
  const [logDate, setLogDate] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  // Get formatted date
  const getFormattedDate = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = today.toLocaleString("default", { month: "long" });
    const year = today.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const getAuthToken = () => {
    try {
      const token = localStorage.getItem("erp-user");
    console.log("[DEBUG Client Quotations.jsx] getAuthToken retrieved:", token ? "Token present" : "No token");
    return token || null;
    } catch (e) {
      console.error("Failed to parse user data:", e);
      return null;
    }
  };
  
  useEffect(() => {
    if (loading || !user) return;
    const today = getFormattedDate();
    setLogDate(today);
    setIsLoading(false);
  }, [user, loading]);

  if (loading || isLoading) {
    return (
      <div>
        <Navbar />
        <div className="log-time-container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

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
        </div>

        <LogtimeModal 
          date={logDate}
          onClose={() => navigate("/history")}
          onSave={() => navigate("/history")}
        />
      </div>
    </div>
  );
}