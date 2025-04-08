import React, { useState, useRef } from "react";
import "./Navbar.css";
import {
    FaUser,
    FaFileInvoice,
    FaTicketAlt,
    FaClipboardList,
    FaClock,
    FaBoxOpen, // Items List
    FaShoppingCart, // Purchase
} from "react-icons/fa";
import { useNavigate } from "react-router-dom";

export default function Navbar() {
    const [showProfilePopup, setShowProfilePopup] = useState(false);
    const navigate = useNavigate();
    const timeoutRef = useRef(null);

    const handleSignOut = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    const handleMouseEnter = () => {
        clearTimeout(timeoutRef.current);
        setShowProfilePopup(true);
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setShowProfilePopup(false);
        }, 300);
    };

    return (
        <nav className="navbar">
            <div className="navbar-left">
                <div className="logo">
                    <img
                        src="/src/assets/logo.jpeg"
                        alt="E-KORS"
                        className="logo-img"
                    />
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
                    <a href="/itemslist">
                        <FaBoxOpen /> Items List
                    </a>
                </div>
            </div>

            <div
                className="profile-wrapper"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
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
