import React, { useState } from "react";
import Navbar from "./components/Navbar";
import "./css/Challan.css";

const challanData = [
  { companyName: "bluepolaroid", totalBill: "1.18" },
  { companyName: "pixelcraze", totalBill: "2.50" },
  { companyName: "designhub", totalBill: "3.75" },
];

export default function Challan() {
  const [showPopup, setShowPopup] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    phone: "",
    email: "",
    totalBilling: "",
    billNumber: "",
    media: null,
  });

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log("Submitted:", formData);
    alert("Challan submitted!");
    setShowPopup(false);
  };

  return (
    <div>
      <Navbar />
      <div className="challan-container">
        <div className="challan-header">
          <h2>Challan Records</h2>
          <button className="create-challan-btn" onClick={() => setShowPopup(true)}>
            + Create Challan
          </button>
        </div>

        <table className="challan-table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Total Bill (₹)</th>
              <th>View</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {challanData.map((entry, index) => (
              <tr key={index}>
                <td>{entry.companyName}</td>
                <td>{entry.totalBill}</td>
                <td>
                  <button className="view-btn" onClick={() => alert(`Viewing ${entry.companyName}`)}>
                    👁️ View
                  </button>
                </td>
                <td>
                  <button className="edit-btn" onClick={() => alert(`Editing ${entry.companyName}`)}>
                    ✏️ Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Popup Modal */}
        {showPopup && (
          <div className="popup-overlay">
            <div className="popup-form">
              <form onSubmit={handleSubmit}>
                <input
                  type="text"
                  name="companyName"
                  placeholder="COMPANY NAME"
                  value={formData.companyName}
                  onChange={handleInputChange}
                  required
                />
                <input
                  type="text"
                  name="phone"
                  placeholder="PHONE"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                />
                <input
                  type="email"
                  name="email"
                  placeholder="EMAIL ID"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                />
                <input
                  type="text"
                  name="totalBilling"
                  placeholder="TOTAL BILLING"
                  value={formData.totalBilling}
                  onChange={handleInputChange}
                  required
                />
                <input
                  type="text"
                  name="billNumber"
                  placeholder="BILL NUMBER (NOT REQUIRED UNTIL CLOSING)"
                  value={formData.billNumber}
                  onChange={handleInputChange}
                />
                <input
                  type="file"
                  name="media"
                  accept="image/*"
                  onChange={handleInputChange}
                  required
                />

                <button type="submit" className="submit-btn">
                  SUBMIT
                </button>
              </form>
              <button className="close-btn" onClick={() => setShowPopup(false)}>
                ✖
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
