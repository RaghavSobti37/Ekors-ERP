import React, { useState } from "react";
import "./Navbar.css"; // Importing CSS
import {
    FaSearch,
    FaUser,
    FaFileInvoice,
    FaTicketAlt,
    FaClipboardList,
    FaClock,
} from "react-icons/fa";
import { useNavigate } from "react-router-dom"; // 👈 Import useNavigate

export default function Navbar() {
    const [searchTerm, setSearchTerm] = useState("");
    const [filteredCompanies, setFilteredCompanies] = useState([]);
    const [showProfilePopup, setShowProfilePopup] = useState(false);
    const navigate = useNavigate(); // 👈 Hook to navigate to login page

    const companies = ["Tesla", "Apple", "Microsoft", "Amazon", "Google"]; // Dummy data

    const handleSearch = (e) => {
        const query = e.target.value;
        setSearchTerm(query);
        setFilteredCompanies(
            query
                ? companies.filter((c) =>
                      c.toLowerCase().includes(query.toLowerCase())
                  )
                : []
        );
    };

    const handleSignOut = () => {
        // Clear storage or any session-related logic here
        localStorage.removeItem("token"); // if you store token

        // Redirect to login page
        navigate("/login");
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
                </div>
            </div>

            <div className="search-box">
                <input
                    type="text"
                    placeholder="Search by Company Name"
                    value={searchTerm}
                    onChange={handleSearch}
                    onFocus={handleSearch}
                />
                <FaSearch className="search-icon" />
                {filteredCompanies.length > 0 && (
                    <ul className="search-results">
                        {filteredCompanies.map((company, index) => (
                            <li key={index}>{company}</li>
                        ))}
                    </ul>
                )}
            </div>

            <div
                className="profile-section"
                onMouseEnter={() => setShowProfilePopup(true)}
                onMouseLeave={() => setShowProfilePopup(false)}
            >
                <div className="profile-icon">
                    <FaUser />
                </div>
                <span>User</span>

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
