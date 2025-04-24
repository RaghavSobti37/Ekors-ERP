import React, { useState, useRef } from "react";
import "../css/Navbar.css";
import {
  FaUser,
  FaFileInvoice,
  FaTicketAlt,
  FaClipboardList,
  FaClock,
  FaBoxOpen,
  FaChartBar, // For analyst icon
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar({ showPurchaseModal }) {
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showItemsDropdown, setShowItemsDropdown] = useState(false);
  const [showSubItemsDropdown, setShowSubItemsDropdown] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const timeoutRef = useRef(null);
  const dropdownTimeoutRef = useRef(null);
  const subDropdownTimeoutRef = useRef(null);

  const handlePurchaseHistoryClick = () => {
    navigate("/purchasehistory");
  };

  const handleSignOut = () => {
    logout();
    navigate("/login");
  };

  const handleMouseEnterProfile = () => {
    clearTimeout(timeoutRef.current);
    setShowProfilePopup(true);
  };

  const handleMouseLeaveProfile = () => {
    timeoutRef.current = setTimeout(() => {
      setShowProfilePopup(false);
    }, 300);
  };

  const handleMouseEnterDropdown = () => {
    clearTimeout(dropdownTimeoutRef.current);
    setShowItemsDropdown(true);
  };

  const handleMouseLeaveDropdown = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setShowItemsDropdown(false);
      setShowSubItemsDropdown(false);
    }, 300);
  };

  const handleMouseEnterSubDropdown = () => {
    clearTimeout(subDropdownTimeoutRef.current);
    setShowSubItemsDropdown(true);
  };

  const handleMouseLeaveSubDropdown = () => {
    subDropdownTimeoutRef.current = setTimeout(() => {
      setShowSubItemsDropdown(false);
    }, 300);
  };

  const handleAnalystClick = () => {
    navigate("/analytics");
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <div className="logo">
          <img src="/src/assets/logo.jpeg" alt="E-KORS" className="logo-img" />
          <span>E-KORS</span>
        </div>

        <div className="nav-links">
          <a href="/quotations">
            <FaFileInvoice /> Quotations
          </a>
          <a href="/tickets">
            <FaTicketAlt /> Tickets
          </a>
          <a href="/challan">
            <FaClipboardList /> Challan
          </a>
          <a href="/logtime">
            <FaClock /> Log Time
          </a>

          <div
            className="dropdown-wrapper"
            onMouseEnter={handleMouseEnterDropdown}
            onMouseLeave={handleMouseLeaveDropdown}
          >
            <div
              className="dropdown-trigger"
              onClick={() => navigate("/itemslist")}
            >
              <FaBoxOpen /> Items List
            </div>
            {showItemsDropdown && (
              <div className="dropdown-menu">
                <div
                  onClick={showPurchaseModal}
                  style={{ cursor: "pointer", padding: "10px 15px" }}
                >
                  Add Purchase
                </div>
                <div
                  onClick={handlePurchaseHistoryClick}
                  style={{ cursor: "pointer", padding: "10px 15px" }}
                >
                  Purchase History
                </div>
              </div>
            )}
          </div>

          {/* ✅ Analyst Button */}
          <div
            className="dropdown-trigger"
            onClick={handleAnalystClick}
            style={{ cursor: "pointer" }}
          >
            <FaChartBar /> Analysis
          </div>
        </div>
      </div>

      <div
        className="profile-wrapper"
        onMouseEnter={handleMouseEnterProfile}
        onMouseLeave={handleMouseLeaveProfile}
      >
        <div className="profile-section">
          <div className="profile-icon">
            <FaUser />
          </div>
          <span>{user?.firstname || "User"}</span>
        </div>

        {showProfilePopup && (
          <div className="profile-popup">
            <img
              src="/src/assets/profile.jpg"
              alt="Profile"
              className="profile-pic"
            />
            <div className="profile-details">
              <p>
                <strong>{user?.firstname} {user?.lastname}</strong>
              </p>
              <p><strong>Email:</strong> {user?.email || "N/A"}</p>
              <p><strong>Phone:</strong> {user?.phone || "N/A"}</p>
              <p><strong>Role:</strong> {user?.role || "N/A"}</p>
            </div>
            <button className="logout-btn" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
