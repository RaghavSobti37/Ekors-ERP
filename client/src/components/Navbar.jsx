import React, { useState, useRef } from "react";
import "../css/Navbar.css";
import {
  FaUser,
  FaFileInvoice,
  FaTicketAlt,
  FaClipboardList,
  FaClock,
  FaBoxOpen,
  FaUsers,
} from "react-icons/fa";
import { useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar({ showPurchaseModal, showNewItemModal }) {
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showItemsDropdown, setShowItemsDropdown] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const timeoutRef = useRef(null);
  const dropdownTimeoutRef = useRef(null);

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
    }, 300);
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-left">
          <div className="logo">
            <img src="/src/assets/logo.jpeg" alt="E-KORS" className="logo-img" />
            <span>E-KORS</span>
          </div>

          <div className="nav-links">
            <NavLink 
              to="/quotations" 
              className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
            >
              <FaFileInvoice /> Quotations
            </NavLink>
            <NavLink 
              to="/tickets" 
              className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
            >
              <FaTicketAlt /> Tickets
            </NavLink>
            <NavLink 
              to="/challan" 
              className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
            >
              <FaClipboardList /> Challan
            </NavLink>
            <NavLink 
              to="/logtime" 
              className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
            >
              <FaClock /> Log Time
            </NavLink>

            <div
              className="dropdown-wrapper"
              onMouseEnter={handleMouseEnterDropdown}
              onMouseLeave={handleMouseLeaveDropdown}
            >
              <NavLink 
                to="/itemslist" 
                className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
              >
                <FaBoxOpen /> Items List
              </NavLink>
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
                  <div
                    onClick={showNewItemModal}
                    style={{ cursor: "pointer", padding: "10px 15px" }}
                  >
                    Add New Item
                  </div>
                </div>
              )}
            </div>

            <NavLink 
              to="/users" 
              className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
            >
              <FaUsers /> Users
            </NavLink>
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
              <button className="edit-btn" onClick={() => setShowEditModal(true)}>
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
              <button className="save-btn" onClick={() => setShowEditModal(false)}>
                Save
              </button>
              <button className="cancel-btn" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}