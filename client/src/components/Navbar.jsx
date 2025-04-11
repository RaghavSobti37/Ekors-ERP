import React, { useState, useRef } from "react";
import "./Navbar.css";
import {
    FaUser,
    FaFileInvoice,
    FaTicketAlt,
    FaClipboardList,
    FaClock,
    FaBoxOpen,
    FaChevronRight,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

export default function Navbar() {
    const [showProfilePopup, setShowProfilePopup] = useState(false);
    const [showItemsDropdown, setShowItemsDropdown] = useState(false);
    const [showSubItemsDropdown, setShowSubItemsDropdown] = useState(false);
    const navigate = useNavigate();
    const timeoutRef = useRef(null);
    const dropdownTimeoutRef = useRef(null);
    const subDropdownTimeoutRef = useRef(null);

    const handleSignOut = () => {
        localStorage.removeItem("token");
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
                        <a className="dropdown-trigger">
                            <FaBoxOpen /> Items List
                        </a>
                        {showItemsDropdown && (
                            <div className="dropdown-menu">
                                <a href="/itemslist">Add Purchase</a>
                                <div
                                    className="sub-dropdown-wrapper"
                                    onMouseEnter={handleMouseEnterSubDropdown}
                                    onMouseLeave={handleMouseLeaveSubDropdown}
                                >
                                    <a className="sub-dropdown-trigger">
                                        View Items <FaChevronRight className="right-arrow" />
                                    </a>
                                    {showSubItemsDropdown && (
                                        <div className="sub-dropdown-menu">
                                            <a href="/itemslist/la">LA</a>
                                            <a href="/itemslist/earthing">Earthing</a>
                                            <a href="/itemslist/solar">Light Arrester</a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
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
                    <span>User</span>
                </div>

                {showProfilePopup && (
                    <div className="profile-popup">
                        <img
                            src="/src/assets/profile.jpg"
                            alt="Profile"
                            className="profile-pic"
                        />
                        <p className="profile-name">John Doe</p>
                        <p className="profile-email">john.doe@example.com</p>
                        <p className="profile-phone">+1 234 567 890</p>
                        <button className="logout-btn" onClick={handleSignOut}>
                            Sign Out
                        </button>
                    </div>
                )}
            </div>
        </nav>
    );
}
