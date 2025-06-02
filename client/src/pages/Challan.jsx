import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import "../css/Style.css";
import ActionButtons from "../components/ActionButtons";
import {
  Eye, // View
  PencilSquare, // Edit
  Trash, // Delete
  BarChart, // Generate Report
} from "react-bootstrap-icons";
import "../css/Challan.css";
import Pagination from "../components/Pagination";
import ReusableTable from "../components/ReusableTable"; // No SortIndicator needed as no sorting is implemented
import { Table, Button, Form, Alert } from "react-bootstrap";
import { showToast, handleApiError } from "../utils/helpers"; // Import helpers
import { useAuth } from "../context/AuthContext";
import apiClient from "../utils/apiClient"; // Import apiClient
import ClientSearchComponent from "../components/ClientSearchComponent"; // Import ClientSearchComponent

const CHALLANS_API_PATH = "/challans"; // Use a relative path for apiClient

export default function Challan() {
  const { user } = useAuth();
  const [showPopup, setShowPopup] = useState(false);
  const [formData, setFormData] = useState({
    companyName: "",
    phone: "",
    email: "",
    totalBilling: "",
    billNumber: "",
    media: null,
  });
  const itemsPerPage = 4; // Hardcoded to 4
  const [allChallans, setAllChallans] = useState([]);
  const [viewMode, setViewMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [viewData, setViewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [notification, setNotification] = useState(null);
  const [documentPreview, setDocumentPreview] = useState({
    url: null,
    type: null,
  });

  // Show notification
  const showNotification = (message, isSuccess) => {
    showToast(message, isSuccess);
  };

  // Fetch all challans on component mount
  useEffect(() => {
    fetchChallans();
  }, []);

  const fetchChallans = async () => {
    try {
      setLoading(true);
      const data = await apiClient(CHALLANS_API_PATH); // Use apiClient
      setAllChallans(data); // Assuming apiClient returns parsed data (e.g., from response.json())
      setError(null);
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to load challans.");
      setError(errorMessage);
      console.error("Error fetching challans:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this challan?")) {
      try {
        setLoading(true);
        await apiClient(`${CHALLANS_API_PATH}/${id}`, { // Use apiClient
          method: 'DELETE',
        });
        showNotification("Challan deleted successfully!");
        fetchChallans(); // Refreshes the list
      } catch (err) {
        const errorMessage = handleApiError(err, "Failed to delete challan.");
        setError(errorMessage);
        console.error("Error deleting challan:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleFileChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      media: e.target.files[0], // Store single file
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const submitData = new FormData();
      submitData.append("companyName", formData.companyName);
      submitData.append("phone", formData.phone);
      submitData.append("email", formData.email);
      submitData.append("totalBilling", formData.totalBilling);
      submitData.append("billNumber", formData.billNumber || "");
      // REMOVED: createdBy and updatedBy should be handled by the backend
      // based on the authenticated user (req.user)
      if (formData.media) {
        submitData.append("media", formData.media);
      }

      if (editMode && editId) {
        // Use apiClient; Content-Type for FormData is typically handled automatically
        await apiClient(`${CHALLANS_API_PATH}/${editId}`, {
          method: 'PUT',
          body: submitData,
        });
        showNotification("Challan updated successfully!");
      } else {
        // Use apiClient; Content-Type for FormData is typically handled automatically
        await apiClient(CHALLANS_API_PATH, {
          method: 'POST',
          body: submitData,
        });
        showNotification("Challan submitted successfully!");
      }
      fetchChallans();
      resetForm();
    } catch (err) {
      console.error("Error submitting challan:", err);
      const errorMessage = handleApiError(err, "Failed to submit challan.");
      setError(
        err.data?.error || err.message || // Adjusted for typical apiClient error structure
          "Failed to submit challan. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setShowPopup(false);
    setViewMode(false);
    setEditMode(false);
    setEditId(null);
    setViewData(null);
    setDocumentPreview({ url: null, type: null });
    setFormData({
      companyName: "",
      phone: "",
      email: "",
      totalBilling: "",
      billNumber: "",
      media: null,
    });
  };

  const handleClientSelect = (client) => {
    setFormData(prev => ({
      ...prev,
      companyName: client.companyName || "",
      phone: client.phone || "",
      email: client.email || "",
      // Do not set client._id here as Challan model doesn't store it directly
    }));
  };

  const openViewPopup = async (challan) => {
    try {
      setLoading(true);
      const data = await apiClient(`${CHALLANS_API_PATH}/${challan._id}`); // Use apiClient
      setViewData(data); // Assuming apiClient returns parsed data
      setViewMode(true);
      setEditMode(false);
      setShowPopup(true);
    } catch (err) {
      const errorMessage = handleApiError(
        err,
        "Failed to fetch challan details."
      );
      setError(errorMessage);
      console.error("Error fetching challan details:", err);
    } finally {
      setLoading(false);
    }
  };

  const openEditPopup = async (challan) => {
    try {
      setLoading(true);
      // Use apiClient and assume it returns parsed data
      const challanDataFromServer = await apiClient(`${CHALLANS_API_PATH}/${challan._id}`);

      setFormData({
        companyName: challanDataFromServer.companyName,
        phone: challanDataFromServer.phone,
        email: challanDataFromServer.email,
        totalBilling: challanDataFromServer.totalBilling,
        billNumber: challanDataFromServer.billNumber || "",
        media: null, // User must re-upload if they want to change the file
      });
      setViewData(challanDataFromServer); // Store for displaying current doc name if needed

      setEditId(challan._id);
      setEditMode(true);
      setViewMode(false);
      setShowPopup(true);
    } catch (err) {
      const errorMessage = handleApiError(
        err,
        "Failed to fetch challan details for editing"
      );
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const previewDocument = async (challanId) => {
    try {
      setLoading(true);
      // Clear previous errors before attempting fetch
      setError(null);

      // Assuming apiClient is fetch-like and returns a Response object for document requests
      const response = await apiClient(`${CHALLANS_API_PATH}/${challanId}/document`);

      if (!response.ok) {
        let errorResponseMessage = `Failed to retrieve document. Status: ${response.status}`;
        try {
            // Attempt to parse a JSON error message from the response body
            const errorData = await response.json();
            errorResponseMessage = errorData.error || errorData.message || errorResponseMessage;
        } catch (e) {
            // If response body is not JSON or parsing fails, use status text or default message
            errorResponseMessage = response.statusText || errorResponseMessage;
        }
        // Throw an error that handleApiError might be able to process
        throw { response: { data: { error: errorResponseMessage } }, message: errorResponseMessage };
      }

      const contentTypeHeader = response.headers.get("content-type"); // Get header using Fetch API
      const blobData = await response.blob(); // Get blob data using Fetch API
      const objectURL = window.URL.createObjectURL(blobData);
      setDocumentPreview({ url: objectURL, type: contentTypeHeader });
    } catch (err) {
      const errorMessage = handleApiError(
        err,
        "Failed to load document. Please check the server."
      );
      setError(errorMessage);
      // Ensure preview state is cleared on error
      setDocumentPreview({ url: null, type: null }); 
    } finally {
      setLoading(false);
    }
  };

  const closePreview = () => {
    if (documentPreview && documentPreview.url) {
      window.URL.revokeObjectURL(documentPreview.url);
    }
    setDocumentPreview({ url: null, type: null });
  };

  // Pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = allChallans.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(allChallans.length / itemsPerPage);

  const renderForm = () => {
    return (
      <form onSubmit={handleSubmit} className="fullscreen-form">
        <div className="form-content">
          {!viewMode && ( // Only show client search in create/edit mode
            <div className="form-group">
              <label htmlFor="clientSearch">Search and Select Client</label>
              <ClientSearchComponent
                onClientSelect={handleClientSelect}
                placeholder="Search client by Name, Email, GST..."
              />
            </div>
          )}
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
              value={viewMode ? viewData.billNumber || "" : formData.billNumber}
              onChange={handleInputChange}
              readOnly={viewMode}
            />
          </div>

          {viewMode ? (
            <div className="form-group">
              <label>Document</label>
              <div className="document-list">
                {viewData.document ? (
                  <div className="document-item">
                    <span className="document-name">
                      {viewData.document.originalName}
                    </span>
                    <Button
                      variant="info" // Using Bootstrap button
                      size="sm"
                      type="button"
                      onClick={() => previewDocument(viewData._id)}
                    >
                      View Document
                    </Button>
                  </div>
                ) : (
                  <p>No document uploaded</p>
                )}
              </div>
            </div>
          ) : (
            <div className="form-group file-input-container">
              <label htmlFor="mediaUpload">
                Upload Documents {!editMode && "*"}
              </label>
              <input
                id="mediaUpload"
                type="file"
                name="media"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                required={!editMode && !formData.media}
              />

              {formData.media && (
                <div className="uploaded-files">
                  <p>Selected file: {formData.media.name}</p>
                </div>
              )}

              {editMode && viewData?.document && !formData.media && (
                <div className="uploaded-files">
                  <p>Current file: {viewData.document.originalName}</p>
                  <p className="note">
                    Upload a new file to replace the existing one
                  </p>
                </div>
              )}
            </div>
          )}

           {viewMode && (
          <>
            <div className="form-group">
              <label>Created By</label>
              <input
                type="text"
                readOnly
                value={`${viewData.createdBy?.firstname || ''} ${viewData.createdBy?.lastname || ''} (System if blank) on ${new Date(viewData.createdAt).toLocaleString()}`}
              />
            </div>
            
            {/* Removed UpdatedBy display as per request */}
            {/* {viewData.updatedBy && (
              <div className="form-group">
                <label>Last Updated By</label>
                <input
                  type="text"
                  readOnly
                  value={`${viewData.updatedBy.firstname} ${viewData.updatedBy.lastname} on ${new Date(viewData.updatedAt).toLocaleString()}`}
                />
              </div>
            )} */}
          </>
        )}

          <div className="form-actions">
            {!viewMode && (
              <Button type="submit" variant="success" disabled={loading}>
                {loading ? "Processing..." : editMode ? "UPDATE" : "SUBMIT"}
              </Button>
            )}

            <Button type="button" variant="secondary" onClick={resetForm}>
              CANCEL
            </Button>
          </div>

          {error && (
            <Alert variant="danger" className="mt-3">
              {error}
            </Alert>
          )}
        </div>
      </form>
    );
  };

  return (
    <div>
      <Navbar />
      <div className="container mt-4">
        {notification && (
          <Alert
            variant={notification.isSuccess ? "success" : "danger"}
            className="mb-3"
          >
            {notification.message}
          </Alert>
        )}

        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 style={{ color: "black" }}>Challan Records</h2>
          <Button
            variant="primary"
            onClick={() => {
              resetForm();
              setShowPopup(true);
            }}
          >
            + Add New Challan
          </Button>
        </div>

        {loading && !showPopup && (
          <div className="text-center my-3">Loading...</div>
        )}
        {/* Display main error state here */}
        {error && !showPopup && <Alert variant="danger">{error}</Alert>}

        <ReusableTable
          columns={[
            { key: "companyName", header: "Company Name" },
            { key: "phone", header: "Phone" },
            { key: "email", header: "Email" },
            { key: "totalBilling", header: "Total Bill (₹)" },
            {
              key: "billNumber",
              header: "Bill Number",
              renderCell: (item) => item.billNumber || "-",
            },
            {
              key: "createdBy",
              header: "Created By",
              renderCell: (item) => (
                <div>
                  <div>{`${item.createdBy?.firstname || ''} ${item.createdBy?.lastname || ''}`.trim() || "System"}</div>
                  <small>{new Date(item.createdAt).toLocaleString()}</small>
                </div>
              ),
            },
            // { // "Last Updated" column removed as per request
            //   key: "updatedInfo",
            //   header: "Last Updated",
            //   renderCell: (item) => ( ... )
            // },
          ]}
          data={currentItems}
          keyField="_id"
          isLoading={loading && currentItems.length === 0} // Show loading only if no items yet
          error={error && currentItems.length === 0 ? error : null}
          renderActions={(challan) => (
            <ActionButtons
              item={challan}
              onView={openViewPopup}
              onEdit={openEditPopup}
              onDelete={user?.role === 'super-admin' ? () => handleDelete(challan._id) : undefined}
              isLoading={loading}
            />
          )}
          noDataMessage="No challans found"
          tableClassName="mt-3"
          theadClassName="table-dark"
        />

        {showPopup && (
          <div className="popup-overlay" onClick={resetForm}>
            <div
              className="popup-form ninety-five-percent"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="popup-header">
                <h3>
                  {viewMode
                    ? "View Challan"
                    : editMode
                    ? "Edit Challan"
                    : "Create New Challan"}
                </h3>
                <button className="close-btn" onClick={resetForm}>
                  ✖
                </button>
              </div>
              {renderForm()}
            </div>
          </div>
        )}

        {/* This modal shows when documentPreview.url is set */}
        {documentPreview && documentPreview.url && (
          <div className="document-preview-overlay" onClick={closePreview}>
            <div
              className="document-preview-container"
              onClick={(e) => e.stopPropagation()}
            >
              <button className="close-preview-btn" onClick={closePreview}>
                ✖
              </button>
              {/* Check if type is PDF to use iframe, otherwise use img */}
              {documentPreview.type &&
              documentPreview.type.includes("application/pdf") ? (
                <iframe
                  src={documentPreview.url}
                  title="Document Preview"
                  className="document-preview"
                  // Add sandbox attribute for security if needed, depending on source
                  // sandbox="allow-scripts allow-same-origin"
                />
              ) : (
                // Assume other types are images
                <img
                  src={documentPreview.url}
                  alt="Document Preview"
                  className="document-preview"
                />
              )}
            </div>
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => {
            if (page >= 1 && page <= totalPages) setCurrentPage(page);
          }}
        />
      </div>
    </div>
  );
}
