import React from 'react';
import './Navbar.css';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="logo">
        <img src="/logo.png" alt="E-KORS Logo" />
        <span>E-KORS</span>
      </div>
      <ul className="nav-links">
        <li><i className="fas fa-user"></i> Quotations</li>
        <li><i className="fas fa-ticket-alt"></i> Tickets</li>
        <li><i className="fas fa-file-invoice"></i> Challan</li>
        <li><i className="fas fa-clock"></i> Log Time</li>
      </ul>
      <div className="search-bar">
        <input type="text" placeholder="Search By Company Name" />
        <button><i className="fas fa-search"></i></button>
      </div>
      <div className="user-profile">
        <div className="user-avatar"></div>
        <div className="user-info">
          <span>User</span>
          <small>User account</small>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;