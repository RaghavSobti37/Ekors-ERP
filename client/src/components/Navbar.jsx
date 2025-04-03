import React, { useState } from "react";
import "./Navbar.css"; // Importing CSS
import { FaSearch, FaUser, FaFileInvoice, FaTicketAlt, FaClipboardList, FaClock } from "react-icons/fa";

export default function Navbar() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCompanies, setFilteredCompanies] = useState([]);
  const [showProfilePopup, setShowProfilePopup] = useState(false);

  const companies = ["Tesla", "Apple", "Microsoft", "Amazon", "Google"]; // Dummy data, replace with real API

  // Handle search input change
  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchTerm(query);
    setFilteredCompanies(query ? companies.filter(c => c.toLowerCase().includes(query.toLowerCase())) : []);
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        <div className="logo">  
          <img src="/logo.png" alt="E-KORS" className="logo-img" />  
          <span>E-KORS</span>
        </div>
        {/* Nav Links in Single Row */}
        <div className="nav-links">
          <a href="/quotations"><FaFileInvoice /> Quotations</a>
          <a href="/tickets"><FaTicketAlt /> Tickets</a>
          <a href="/challan"><FaClipboardList /> Challan</a>
          <a href="/log-time"><FaClock /> Log Time</a>
        </div>
      </div>

      {/* Search Bar */}
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

      {/* Profile Section */}
      <div 
        className="profile-section"
        onMouseEnter={() => setShowProfilePopup(true)}
        onMouseLeave={() => setShowProfilePopup(false)}
      >
        <div className="profile-icon">
          <FaUser />
        </div>
        <span>User</span>

        {/* Profile Popup */}
        {showProfilePopup && (
          <div className="profile-popup">
            <img src="/profile.jpg" alt="Profile" className="profile-pic" />
            <p className="profile-name">John Doe</p>
            <p className="profile-email">john.doe@example.com</p>
            <p className="profile-phone">+1 234 567 890</p>
            <button className="logout-btn">Sign Out</button>
          </div>
        )}
      </div>
    </nav>
  );
}
