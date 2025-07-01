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
  FaCogs, // For Management
  FaInfoCircle // For Static Info
} from "react-icons/fa";
import { useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import apiClient from "../utils/apiClient"; // Assuming you have this

function NavbarComponent() {
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showItemsDropdown, setShowItemsDropdown] = useState(false);
  const [showManagementDropdown, setShowManagementDropdown] = useState(false);
  const [restockNeededCount, setRestockNeededCount] = useState(0); // New state for restock count
  const [lowStockWarningCount, setLowStockWarningCount] = useState(0); // New state for low stock warning
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const timeoutRef = useRef(null);
  const dropdownTimeoutRef = useRef(null);
  const managementDropdownTimeoutRef = useRef(null);

  const handlePurchaseHistoryClick = () => {
    navigate("/purchasehistory");
  };

  const handleViewAllItems = () => {
    navigate("/items");
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

  // Fetch restock and low stock counts
  useEffect(() => {
    const fetchStockCounts = async () => {
      try {
        const response = await apiClient.get("/items/stock-summary"); // Adjust the endpoint as needed
        setRestockNeededCount(response.data.restockNeededCount || 0);
        setLowStockWarningCount(response.data.lowStockWarningCount || 0);
      } catch (error) {
        console.error("Error fetching stock summary:", error);
      }
    };

    if (user) {
      fetchStockCounts();
    }
  }, [user]);

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
                <span
                  className="nav-link"
                   style={{ cursor: "pointer" }}
                >
                  <FaBoxOpen /> Items List
                </span>
              {showItemsDropdown && (
                  <div className="dropdown-menu">
                    <div
                      onClick={handleViewAllItems}
                      style={{ cursor: "pointer", padding: "10px 15px" }}
                    >
                      View All Items
                    </div>
                    <div
                      onClick={() => navigate("/purchases/new")}
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
               <span
                  className="nav-link"
                   style={{ cursor: "pointer" }}
                >
                  <FaCogs /> Management
                </span>
                {showManagementDropdown && (
                  <div className="dropdown-menu">
                    <NavLink to="/users" className="dropdown-item"> {/* Custom class for NavLink styling */}
                       Users 
                    </NavLink>
                    <NavLink to="/clients" className="dropdown-item">
                      Clients 
                    </NavLink>
                    {/* <NavLink to="/suppliers" className="dropdown-item">Suppliers</NavLink> */} {/* Add when ready */}
                    <NavLink to="/backups" className="dropdown-item">Backups</NavLink>
                    {/* Static Info Link - Only for super-admin */}
                    {user && user.role === "super-admin" && (
                      <NavLink to="/staticinfo" className="dropdown-item">
                        Static Info
                      </NavLink>
                    )}
                  </div>
                )}
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