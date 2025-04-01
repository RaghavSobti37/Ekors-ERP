import React from "react";
import { Link } from "react-router-dom";

const Navbar = () => {
  return (
    <nav className="navbar">
      <h1>Ekors ERP</h1>
      <div>
        <Link to="/login" className="nav-link">Login</Link>
        <Link to="/register" className="nav-link">Sign Up</Link>
      </div>
    </nav>
  );
};

export default Navbar;
