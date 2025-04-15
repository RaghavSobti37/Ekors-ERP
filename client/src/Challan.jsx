import React, { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import "./css/Challan.css";
import axios from "axios";

const API_URL = "http://localhost:3000/api/challans";

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
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch all challans on component mount
  useEffect(() => {
    fetchChallans();
  }, []);

  const fetchChallans = async () => {
    try {
      setLoading(true);
      const response = await axios.get(API_URL);
      setChallanData(response.data);
      setError(null);
    } catch (err) {
      console.error("Error fetching challans:", err);
      setError("Failed to load challans. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, files } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Create FormData object to handle file uploads
      const submitData = new FormData();
      submitData.append("companyName", formData.companyName);
      submitData.append("phone", formData.phone);
      submitData.append("email", formData.email);
      submitData.append("totalBilling", formData.totalBilling);
      submitData.append("billNumber", formData.billNumber || "");
      
      // Only append media if it exists
      if (formData.media) {
        submitData.append("media", formData.media);
      }

      let response;
      if (editMode && editId) {
        // Update existing challan
        response = await axios.put(`${API_URL}/${editId}`, submitData);
        alert("Challan updated successfully!");
      } else {
        // Create new challan
        response = await axios.post(API_URL, submitData);
        alert("Challan submitted successfully!");
      }

      // Refresh the challan list
      fetchChallans();

      // Reset form and states
      resetForm();
    } catch (err) {
      console.error("Error submitting challan:", err);
      setError(err.response?.data?.error || "Failed to submit challan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowPopup(false);
    setViewMode(false);
    setEditMode(false);
    setEditId(null);
    setFormData({
      companyName: "",
      phone: "",
      email: "",
      totalBilling: "",
      billNumber: "",
      media: null,
    });
  };

  const openViewPopup = async (challan) => {
    try {
      setLoading(true);
      // Fetch the full challan details
      const response = await axios.get(`${API_URL}/${challan._id}`);
      setViewData(response.data);
      setViewMode(true);
      setShowPopup(true);
    } catch (err) {
      console.error("Error fetching challan details:", err);
      alert("Failed to fetch challan details");
    } finally {
      setLoading(false);
    }
  };

  const openEditPopup = async (challan) => {
    try {
      setLoading(true);
      // Fetch the full challan details
      const response = await axios.get(`${API_URL}/${challan._id}`);
      const challanData = response.data;
      
      setFormData({
        companyName: challanData.companyName,
        phone: challanData.phone,
        email: challanData.email,
        totalBilling: challanData.totalBilling,
        billNumber: challanData.billNumber || "",
        // Don't set media here as we don't want to show the current file in the file input
        media: null,
      });
      
      setEditId(challan._id);
      setEditMode(true);
      setShowPopup(true);
    } catch (err) {
      console.error("Error fetching challan details for edit:", err);
      alert("Failed to fetch challan details for editing");
    } finally {
      setLoading(false);
    }
  };

  // const deleteChallan = async (id) => {
  //   if (!window.confirm("Are you sure you want to delete this challan?")) {
  //     return;
  //   }
    
  //   try {
  //     setLoading(true);
  //     await axios.delete(`${API_URL}/${id}`);
  //     alert("Challan deleted successfully!");
  //     fetchChallans();
  //   } catch (err) {
  //     console.error("Error deleting challan:", err);
  //     alert("Failed to delete challan");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const viewDocument = (id) => {
    window.open(`${API_URL}/${id}/document`, "_blank");
  };

  const renderForm = () => {
    return (
      <form onSubmit={handleSubmit} className="fullscreen-form">
        <div className="form-content">
          <div className="form-group">
            <label htmlFor="companyName">Company Name</label>
            <input
              id="companyName"
              type="text"
              name="companyName"
              placeholder="COMPANY NAME"
              value={viewMode ? viewData.companyName : formData.companyName}
              onChange={handleInputChange}
              readOnly={viewMode}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              type="text"
              name="phone"
              placeholder="PHONE"
              value={viewMode ? viewData.phone : formData.phone}
              onChange={handleInputChange}
              readOnly={viewMode}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="EMAIL ID"
              value={viewMode ? viewData.email : formData.email}
              onChange={handleInputChange}
              readOnly={viewMode}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="totalBilling">Total Billing</label>
            <input
              id="totalBilling"
              type="text"
              name="totalBilling"
              placeholder="TOTAL BILLING"
              value={viewMode ? viewData.totalBilling : formData.totalBilling}
              onChange={handleInputChange}
              readOnly={viewMode}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="billNumber">Bill Number</label>
            <input
              id="billNumber"
              type="text"
              name="billNumber"
              placeholder="BILL NUMBER (NOT REQUIRED UNTIL CLOSING)"
              value={viewMode ? (viewData.billNumber || "") : formData.billNumber}
              onChange={handleInputChange}
              readOnly={viewMode}
            />
          </div>

          {viewMode ? (
            <div className="form-group">
              <button
                type="button"
                className="document-btn"
                onClick={() => viewDocument(viewData._id)}
              >
                📄 View Document
              </button>
            </div>
          ) : (
            <div className="form-group file-input-container">
              <label htmlFor="mediaUpload">
                {editMode 
                  ? "Upload New Document (leave empty to keep current document)" 
                  : "Upload Document *"}
              </label>
              <input
                id="mediaUpload"
                type="file"
                name="media"
                accept="image/*,application/pdf"
                onChange={handleInputChange}
                required={!editMode}
              />
            </div>
          )}

          <div className="form-actions">
            {!viewMode && (
              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? "Processing..." : (editMode ? "UPDATE" : "SUBMIT")}
              </button>
            )}
            
            <button
              type="button"
              className="cancel-btn"
              onClick={resetForm}
            >
              CANCEL
            </button>
          </div>
          
          {error && <div className="error-message">{error}</div>}
        </div>
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
              resetForm();
              setShowPopup(true);
            }}
          >
            + Create Challan
          </button>
        </div>

        {loading && !showPopup && <div className="loading">Loading...</div>}
        {error && !showPopup && <div className="error-message">{error}</div>}

        <table className="challan-table">
          <thead>
            <tr>
              <th>Company Name</th>
              <th>Total Bill (₹)</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {challanData.length === 0 && !loading ? (
              <tr>
                <td colSpan="3" className="no-data">No challans found</td>
              </tr>
            ) : (
              challanData.map((challan) => (
                <tr key={challan._id}>
                  <td>{challan.companyName}</td>
                  <td>{challan.totalBilling}</td>
                  <td className="action-buttons">
                    <button 
                      className="view-btn" 
                      onClick={() => openViewPopup(challan)}
                    >
                      👁️ View
                    </button>
                    <button
                      className="edit-btn"
                      onClick={() => openEditPopup(challan)}
                    >
                      ✏️ Edit
                    </button>
                    {/* <button
                      className="delete-btn"
                      onClick={() => deleteChallan(challan._id)}
                    >
                      🗑️ Delete
                    </button> */}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {showPopup && (
          <div className="popup-overlay fullscreen">
            <div className="popup-form fullscreen-popup">
              <div className="popup-header">
                <h3>{viewMode ? "View Challan" : (editMode ? "Edit Challan" : "Create New Challan")}</h3>
                <button
                  className="close-btn"
                  onClick={resetForm}
                >
                  ✖
                </button>
              </div>
              {renderForm()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}