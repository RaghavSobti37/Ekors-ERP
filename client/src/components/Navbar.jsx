import React, { useState, useRef, useEffect, useCallback } from "react";
import "../css/Navbar.css"; // Main Navbar styles
import {
  FaUser,
  FaFileInvoice,
  FaTicketAlt,
  FaClipboardList,
  FaClock,
  FaBoxOpen,
  FaUsers,
  FaExclamationTriangle, // For restock alerts
  FaExclamationCircle, // For low quantity warnings
  FaCogs, // For Management
} from "react-icons/fa";
import { useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import apiClient from "../utils/apiClient"; // Assuming you have this

const DEFAULT_LOW_QUANTITY_THRESHOLD = 3;
const LOCAL_STORAGE_LOW_QUANTITY_KEY = "globalLowStockThresholdSetting";

function NavbarComponent({ showPurchaseModal }) {
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showItemsDropdown, setShowItemsDropdown] = useState(false);
  const [showManagementDropdown, setShowManagementDropdown] = useState(false);
  const navigate = useNavigate();
  const [restockAlertCount, setRestockAlertCount] = useState(0);
  const [lowStockWarningCount, setLowStockWarningCount] = useState(0);
  const { user, logout } = useAuth();

  const timeoutRef = useRef(null);
  const dropdownTimeoutRef = useRef(null);
  const managementDropdownTimeoutRef = useRef(null);

  const fetchRestockData = useCallback(async () => {
    if (!user) return; // Don't fetch if not logged in or user context not yet available

    const currentThreshold =
      parseInt(localStorage.getItem(LOCAL_STORAGE_LOW_QUANTITY_KEY), 10) ||
      DEFAULT_LOW_QUANTITY_THRESHOLD;
    try {
      // apiClient is expected to handle auth token injection.
      const response = await apiClient(
        `/items/restock-summary?lowGlobalThreshold=${currentThreshold}`
      );
      setRestockAlertCount(response.restockNeededCount || 0);
      setLowStockWarningCount(response.lowStockWarningCount || 0);
    } catch (error) {
      console.error(
        "Navbar: Failed to fetch restock summary:",
        error.data?.message || error.message
      );
      // Not showing a UI error for this background check.
    }
  }, [user]); // Depends on user object to ensure it runs after user is available

  useEffect(() => {
    fetchRestockData();
    // Optional: Set an interval to refresh periodically
    const intervalId = setInterval(fetchRestockData, 300000); // every 5 minutes
    return () => clearInterval(intervalId);
  }, [fetchRestockData]);

  const handlePurchaseHistoryClick = () => {
    navigate("/purchasehistory");
  };

  const handleViewAllItems = () => {
    navigate("/itemslist");
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

  const handleMouseEnterManagementDropdown = () => {
    clearTimeout(managementDropdownTimeoutRef.current);
    setShowManagementDropdown(true);
  };

  const handleMouseLeaveManagementDropdown = () => {
    managementDropdownTimeoutRef.current = setTimeout(() => {
      setShowManagementDropdown(false);
    }, 300);
  };
  const handleStockAlertClick = () => {
    const currentThreshold =
      parseInt(localStorage.getItem(LOCAL_STORAGE_LOW_QUANTITY_KEY), 10) || DEFAULT_LOW_QUANTITY_THRESHOLD;
    navigate(`/itemslist?filter=stock_alerts`); 
  };

  return (
    <React.Fragment>
      <nav className="navbar">
        <div className="navbar-left">
          <div className="logo">
            <img src="/logo.png" alt="E-KORS" className="logo-img" />
          </div>

          <div className="nav-links">
            <NavLink
              to="/quotations"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <FaFileInvoice /> Quotations
            </NavLink>
            <NavLink
              to="/tickets"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <FaTicketAlt /> Tickets
            </NavLink>
            <NavLink
              to="/logtime"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <FaClock /> Log Time
            </NavLink>

            <NavLink
              to="/challan"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <FaClipboardList /> Challan
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
                >
                  <FaBoxOpen /> Items List
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
                      onClick={showPurchaseModal}
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
              <div
                className="dropdown-wrapper"
                onMouseEnter={handleMouseEnterManagementDropdown}
                onMouseLeave={handleMouseLeaveManagementDropdown}
              >
                <span className="nav-link" style={{ cursor: "default" }}> {/* Make it look like a NavLink but not clickable itself */}
                  <FaCogs /> Management
                </span>
                {showManagementDropdown && (
                  <div className="dropdown-menu">
                    <NavLink to="/users" className="dropdown-item-navlink"> {/* Custom class for NavLink styling */}
                       Users 
                    </NavLink>
                    <NavLink to="/clients" className="dropdown-item-navlink">
                      Clients 
                    </NavLink>
                    {/* <NavLink to="/suppliers" className="dropdown-item-navlink">Suppliers</NavLink> */} {/* Add when ready */}
                    <NavLink to="/backups" className="dropdown-item-navlink">Backups</NavLink>
                  </div>
                )}
              </div>
            )}
            
            {/* Stock Alert Notification Area */}
            {(restockAlertCount > 0 || lowStockWarningCount > 0) &&
              user &&
              user.role !== "user" && (
                <div
                  className="stock-alert-notification nav-link" // Added nav-link for consistent styling if desired
                  onClick={handleStockAlertClick}
  title={`Restock Needed (Qty <= 0): ${restockAlertCount} items. Low Stock (Qty < global threshold ${                    localStorage.getItem(LOCAL_STORAGE_LOW_QUANTITY_KEY) ||
                    DEFAULT_LOW_QUANTITY_THRESHOLD
                  }): ${lowStockWarningCount} items. Click to view all items below their specific low stock thresholds.`}
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
            {/* Always show placeholder */}
            <div className="profile-icon">
              <FaUser />
            </div>
            <span className="navbar-username">{user?.firstname || "User"}</span>
          </div>

          {showProfilePopup && (
            <div className="profile-popup">
              <div className="profile-details">
                <div className="profile-avatar-large-container">
                  {/* Always show placeholder */}
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
                onClick={() => navigate("/profile/edit")} // Navigate to edit page
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
    </React.Fragment>
  );
}

export default React.memo(NavbarComponent);