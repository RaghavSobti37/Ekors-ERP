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
  FaExclamationTriangle, // For restock alerts
  FaExclamationCircle, // For low quantity warnings
} from "react-icons/fa";
import {
  Navbar as BootstrapNavbar,
  Nav,
  NavDropdown,
  Button,
} from "react-bootstrap";
import { Link } from "react-router-dom";
import { useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import apiClient from "../utils/apiClient"; // Assuming you have this
import { getAuthToken } from "../utils/authUtils"; // Assuming you have this

// import AddNewItem from '../pages/AddNewItem';

const DEFAULT_LOW_QUANTITY_THRESHOLD = 3;
const LOCAL_STORAGE_LOW_QUANTITY_KEY = "globalLowStockThresholdSetting";

export default function Navbar({ showPurchaseModal }) {
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showItemsDropdown, setShowItemsDropdown] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const navigate = useNavigate();
  const [restockAlertCount, setRestockAlertCount] = useState(0);
  const [lowStockWarningCount, setLowStockWarningCount] = useState(0);
  const { user, logout } = useAuth();

  const timeoutRef = useRef(null);
  const dropdownTimeoutRef = useRef(null);

  useEffect(() => {
    if (!user) return; // Don't fetch if not logged in

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
        // Don't show an error toast here, as it's a background check
      }
    };

    fetchRestockData();
    // Optional: Set an interval to refresh periodically
    const intervalId = setInterval(fetchRestockData, 300000); // every 5 minutes
    return () => clearInterval(intervalId);
  }, [user]); // Re-fetch if user logs in/out. Threshold changes will be picked up on next interval or page load.

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

  const handleStockAlertClick = () => {
    const currentThreshold =
      parseInt(localStorage.getItem(LOCAL_STORAGE_LOW_QUANTITY_KEY), 10) ||
      DEFAULT_LOW_QUANTITY_THRESHOLD;
    navigate(`/itemslist?filter=stock_alerts&lowThreshold=${currentThreshold}`);
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-left">
          <div className="logo">
            <img src="/src/assets/logo.png" alt="E-KORS" className="logo-img" />
            {/* <span>E-KORS</span> */}
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

            <NavLink
              to="/users"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <FaUsers /> Users
            </NavLink>

            {/* Stock Alert Notification Area */}
            {(restockAlertCount > 0 || lowStockWarningCount > 0) && user && (
              <div
                className="stock-alert-notification nav-link" // Added nav-link for consistent styling if desired
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
            <span>{user?.firstname || "User"}</span>
          </div>

          {showProfilePopup && (
            <div className="profile-popup">
              {/* <img
                src="/src/assets/profile.jpg"
                alt="Profile"
                className="profile-pic"
              /> */}
              <div className="profile-details">
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
                <p>
                  <strong>Role:</strong> {user?.role || "N/A"}
                </p>
              </div>
              <button
                className="edit-btn"
                onClick={() => setShowEditModal(true)}
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

      {showEditModal && (
        <div className="edit-modal-overlay">
          <div className="edit-modal">
            <h2>Edit Profile</h2>
            <div className="form-group">
              <label>First Name</label>
              <input type="text" defaultValue={user?.firstname || ""} />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input type="text" defaultValue={user?.lastname || ""} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" defaultValue={user?.email || ""} />
            </div>
            <div className="form-group">
              <label>Mobile Number</label>
              <input type="text" defaultValue={user?.phone || ""} />
            </div>
            <div className="form-group">
              <label>Role</label>
              <input type="text" defaultValue={user?.role || ""} />
            </div>
            <div className="form-group">
              <label>Change Password</label>
              <input type="password" placeholder="Enter new password" />
            </div>
            <div className="modal-buttons">
              <button
                className="save-btn"
                onClick={() => setShowEditModal(false)}
              >
                Save
              </button>
              <button
                className="cancel-btn"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* {showNewItemModal && (
        <AddNewItem onClose={() => setShowNewItemModal(false)} />
      )} */}
    </>
  );
}
