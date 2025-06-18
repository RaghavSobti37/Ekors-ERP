import React, { useState, useRef, useEffect } from "react";
import "../css/Navbar.css";
import {
  FaUser,
  FaFileInvoice,
  FaTicketAlt,
  FaClipboardList,
  FaClock,
  FaBoxOpen,
  FaUsers,
  FaExclamationTriangle,
  FaExclamationCircle,
  FaBars,
  FaTimes,
} from "react-icons/fa";
import { useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import apiClient from "../utils/apiClient";
import { getAuthToken } from "../utils/authUtils";

const DEFAULT_LOW_QUANTITY_THRESHOLD = 3;
const LOCAL_STORAGE_LOW_QUANTITY_KEY = "globalLowStockThresholdSetting";

export default function Navbar({ showPurchaseModal }) {
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showItemsDropdown, setShowItemsDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [restockAlertCount, setRestockAlertCount] = useState(0);
  const [lowStockWarningCount, setLowStockWarningCount] = useState(0);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const timeoutRef = useRef(null);
  const dropdownTimeoutRef = useRef(null);
  const navbarRef = useRef(null);

  useEffect(() => {
    if (!user) return;

    const fetchRestockData = async () => {
      const currentThreshold =
        parseInt(localStorage.getItem(LOCAL_STORAGE_LOW_QUANTITY_KEY), 10) ||
        DEFAULT_LOW_QUANTITY_THRESHOLD;
      try {
        const token = getAuthToken();
        if (!token) return;
        const response = await apiClient(
          `/items/restock-summary?lowGlobalThreshold=${currentThreshold}`
        );
        setRestockAlertCount(response.restockNeededCount || 0);
        setLowStockWarningCount(response.lowStockWarningCount || 0);
      } catch (error) {
        console.error("Navbar: Failed to fetch restock summary:", error);
      }
    };

    fetchRestockData();
    const intervalId = setInterval(fetchRestockData, 300000);
    return () => clearInterval(intervalId);
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (navbarRef.current && !navbarRef.current.contains(event.target)) {
        setShowMobileMenu(false);
        setShowProfilePopup(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handlePurchaseHistoryClick = () => {
    navigate("/purchasehistory");
    setShowMobileMenu(false);
  };

  const handleViewAllItems = () => {
    navigate("/itemslist");
    setShowMobileMenu(false);
  };

  const handleSignOut = () => {
    logout();
    navigate("/");
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
    }, 300);
  };

  const handleStockAlertClick = () => {
    const currentThreshold =
      parseInt(localStorage.getItem(LOCAL_STORAGE_LOW_QUANTITY_KEY), 10) ||
      DEFAULT_LOW_QUANTITY_THRESHOLD;
    navigate(`/itemslist?filter=stock_alerts&lowThreshold=${currentThreshold}`);
    setShowMobileMenu(false);
  };

  const toggleMobileMenu = () => {
    setShowMobileMenu(!showMobileMenu);
  };

  return (
    <>
      <nav className="navbar" ref={navbarRef}>
        <div className="navbar-left">
          <div className="logo">
            <img src="/logo.png" alt="E-KORS" className="logo-img" />
          </div>

          <div className="mobile-menu-toggle" onClick={toggleMobileMenu}>
            {showMobileMenu ? <FaTimes /> : <FaBars />}
          </div>

          <div className={`nav-links ${showMobileMenu ? "mobile-show" : ""}`}>
            <NavLink
              to="/quotations"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              onClick={() => setShowMobileMenu(false)}
            >
              <FaFileInvoice /> <span className="nav-text">Quotations</span>
            </NavLink>
            <NavLink
              to="/tickets"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              onClick={() => setShowMobileMenu(false)}
            >
              <FaTicketAlt /> <span className="nav-text">Tickets</span>
            </NavLink>
            <NavLink
              to="/logtime"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              onClick={() => setShowMobileMenu(false)}
            >
              <FaClock /> <span className="nav-text">Log Time</span>
            </NavLink>

            <NavLink
              to="/challan"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              onClick={() => setShowMobileMenu(false)}
            >
              <FaClipboardList /> <span className="nav-text">Challan</span>
            </NavLink>

            {user && user.role !== "user" && (
              <div
                className="dropdown-wrapper"
                onMouseEnter={handleMouseEnterDropdown}
                onMouseLeave={handleMouseLeaveDropdown}
              >
                <NavLink
                  to="/itemslist"
                  className={({ isActive }) =>
                    isActive ? "nav-link active" : "nav-link"
                  }
                  onClick={() => setShowMobileMenu(false)}
                >
                  <FaBoxOpen /> <span className="nav-text">Items List</span>
                </NavLink>
                {showItemsDropdown && (
                  <div className="dropdown-menu">
                    <div
                      onClick={handleViewAllItems}
                      style={{ cursor: "pointer", padding: "10px 15px" }}
                    >
                      View All Items
                    </div>
                    <div
                      onClick={() => {
                        showPurchaseModal();
                        setShowMobileMenu(false);
                      }}
                      style={{ cursor: "pointer", padding: "10px 15px" }}
                    >
                      Update Stock
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
            )}

            {user && user.role !== "user" && (
              <NavLink
                to="/users"
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
                onClick={() => setShowMobileMenu(false)}
              >
                <FaUsers /> <span className="nav-text">Users</span>
              </NavLink>
            )}

            {(restockAlertCount > 0 || lowStockWarningCount > 0) && user && user.role !== "user" && (
              <div
                className="stock-alert-notification nav-link"
                onClick={handleStockAlertClick}
                title={`Restock Needed: ${restockAlertCount} items. Low Stock (<${
                  localStorage.getItem(LOCAL_STORAGE_LOW_QUANTITY_KEY) ||
                  DEFAULT_LOW_QUANTITY_THRESHOLD
                }): ${lowStockWarningCount} items. Click to view.`}
              >
                <FaExclamationTriangle className="icon-low-stock" />
                <span className="alert-count">{restockAlertCount}</span>
                <FaExclamationCircle className="icon-restock" />
                <span className="alert-count">{lowStockWarningCount}</span>
              </div>
            )}
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
            <span className="navbar-username">{user?.firstname || "User"}</span>
          </div>

          {showProfilePopup && (
            <div className="profile-popup">
              <div className="profile-details">
                <div className="profile-avatar-large-container">
                  <div className="profile-avatar-large-placeholder">
                    <FaUser size={40} />
                  </div>
                </div>
                <p>
                  <strong>
                    {user?.firstname} {user?.lastname}
                  </strong>
                </p>
                <p>
                  <strong>Email:</strong> {user?.email || "N/A"}
                </p>
                <p>
                  <strong>Phone:</strong> {user?.phone || "N/A"}
                </p>
              </div>
              <button
                className="edit-btn"
                onClick={() => {
                  navigate("/profile/edit");
                  setShowProfilePopup(false);
                  setShowMobileMenu(false);
                }}
              >
                Edit
              </button>
              <button className="logout-btn" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </nav>
    </>
  );
}