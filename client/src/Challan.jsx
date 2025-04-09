import React, { useState } from "react";
import Navbar from "./components/Navbar";
import "./css/Challan.css";

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
  const [challanData, setChallanData] = useState([]);
  const [viewMode, setViewMode] = useState(false);
  const [viewData, setViewData] = useState(null);

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newData = { ...formData };
    setChallanData((prev) => [...prev, newData]);
    alert("Challan submitted!");
    setShowPopup(false);
    setFormData({
      companyName: "",
      phone: "",
      email: "",
      totalBilling: "",
      billNumber: "",
      media: null,
    });
  };

  const openViewPopup = (data) => {
    setViewData(data);
    setViewMode(true);
    setShowPopup(true);
  };

  const renderForm = () => {
    const data = viewMode ? viewData : formData;

    return (
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          name="companyName"
          placeholder="COMPANY NAME"
          value={data.companyName}
          onChange={handleInputChange}
          readOnly={viewMode}
          required
        />
        <input
          type="text"
          name="phone"
          placeholder="PHONE"
          value={data.phone}
          onChange={handleInputChange}
          readOnly={viewMode}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="EMAIL ID"
          value={data.email}
          onChange={handleInputChange}
          readOnly={viewMode}
          required
        />
        <input
          type="text"
          name="totalBilling"
          placeholder="TOTAL BILLING"
          value={data.totalBilling}
          onChange={handleInputChange}
          readOnly={viewMode}
          required
        />
        <input
          type="text"
          name="billNumber"
          placeholder="BILL NUMBER (NOT REQUIRED UNTIL CLOSING)"
          value={data.billNumber}
          onChange={handleInputChange}
          readOnly={viewMode}
        />

        {viewMode ? (
          <button
            type="button"
            className="document-btn"
            onClick={() => {
              const fileURL = URL.createObjectURL(data.media);
              window.open(fileURL, "_blank");
            }}
          >
            📄 Document
          </button>
        ) : (
          <input
            type="file"
            name="media"
            accept="image/*,application/pdf"
            onChange={handleInputChange}
            required
          />
        )}

        {!viewMode && (
          <button type="submit" className="submit-btn">
            SUBMIT
          </button>
        )}
      </form>
    );
  };

  return (
    <div>
      <Navbar />
      <div className="challan-container">
        <div className="challan-header">
          <h2>Challan Records</h2>
          <button
            className="create-challan-btn"
            onClick={() => {
              setShowPopup(true);
              setViewMode(false);
            }}
          >
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
                <td>{entry.totalBilling}</td>
                <td>
                  <button className="view-btn" onClick={() => openViewPopup(entry)}>
                    👁️ View
                  </button>
                </td>
                <td>
                  <button
                    className="edit-btn"
                    onClick={() => alert(`Editing ${entry.companyName}`)}
                  >
                    ✏️ Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {showPopup && (
          <div className="popup-overlay">
            <div className="popup-form">
              {renderForm()}
              <button
                className="close-btn"
                onClick={() => {
                  setShowPopup(false);
                  setViewMode(false);
                }}
              >
                ✖
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
