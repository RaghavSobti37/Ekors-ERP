import React from "react";
import Navbar from "./components/Navbar";
import "./css/Challan.css";

export default function Challan() {
  return (
    <div>
      <Navbar />
      <div className="challan-container">
        <div className="challan-header">
          <button className="create-challan-btn">+ Create Challan</button>
        </div>

        <form className="challan-form">
          <input type="text" placeholder="COMPANY NAME" required />
          <input type="tel" placeholder="PHONE" required />
          <input type="email" placeholder="EMAIL ID" required />
          <input type="number" placeholder="TOTAL BILLING" required />
          <input type="text" placeholder="BILL NUMBER ( NOT REQUIRED UNTIL CLOSING )" />
          <input type="text" placeholder="MEDIA" required />
          <button type="submit" className="submit-btn">SUBMIT</button>
        </form>
      </div>
    </div>
  );
}
