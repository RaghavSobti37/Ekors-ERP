import React, { useState, useRef, useEffect } from "react";
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
import {
  Form,
  Button as BsButton,
  Alert,
  Row,
  Col,
  // Image, // Image component might no longer be needed if only icons are used. Let's check usage.
} from "react-bootstrap"; 
// ReusableModal is no longer used here for profile edit
import { showToast, handleApiError } from "../utils/helpers"; // For toasts and error handling

const DEFAULT_LOW_QUANTITY_THRESHOLD = 3;
const LOCAL_STORAGE_LOW_QUANTITY_KEY = "globalLowStockThresholdSetting";

export default function Navbar({ showPurchaseModal }) {
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showItemsDropdown, setShowItemsDropdown] = useState(false);
  // const [showEditModal, setShowEditModal] = useState(false); // Modal state removed
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const navigate = useNavigate();
  const [restockAlertCount, setRestockAlertCount] = useState(0);
  const [lowStockWarningCount, setLowStockWarningCount] = useState(0);
  const { user, logout, updateUserContext } = useAuth(); // Added updateUserContext
  // Profile form state and handlers are moved to EditProfilePage.jsx
  // const [profileFormData, setProfileFormData] = useState({
  //   firstname: "", 
  //   lastname: "",  
  //   phone: "",
  //   newPassword: "",
  //   confirmPassword: "",
  // });
  // const [profileError, setProfileError] = useState("");
  // const [profileLoading, setProfileLoading] = useState(false);

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
  }, [user]); 

  // useEffect for setting profileFormData is moved to EditProfilePage.jsx
  // useEffect(() => {
  //   if (user) {
  //     setProfileFormData((prev) => ({
  //       ...prev,
  //       firstname: user.firstname || "",
  //       lastname: user.lastname || "",
  //       phone: user.phone || "",
  //     }));
  //   } else {
  //     setProfileFormData({ firstname: "", lastname: "", phone: "", newPassword: "", confirmPassword: "" });
  //   }
  // }, [user]);

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
    navigate(`/itemslist?filter=stock_alerts&lowThreshold=${currentThreshold}`); // Corrected path
  };

  // handleProfileInputChange and handleProfileSave are moved to EditProfilePage.jsx


  return (
    <>
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
              <NavLink
                to="/users"
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
              >
                <FaUsers /> Users
              </NavLink>
            )}

            {/* Stock Alert Notification Area */}
            {(restockAlertCount > 0 || lowStockWarningCount > 0) && user && user.role !== "user" && (
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
            {/* Always show placeholder */}
            <div className="profile-icon">
              <FaUser />
            </div>
            <span className="navbar-username">{user?.firstname || "User"}</span>
          </div>

          {showProfilePopup && (
            <div className="profile-popup">
              {/* <img
                src="/src/assets/profile.jpg"
                alt="Profile"
                className="profile-pic"
              /> */}
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
                {/* <p>
                  <strong>Role:</strong> {user?.role || "N/A"}
                </p> */}
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


      {/* Edit Profile Modal has been removed and converted to EditProfilePage.jsx */}
    </>
  );
}
