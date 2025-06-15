import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar"; // Navigation bar component
import ActionButtons from "../components/ActionButtons"; // Component for table action buttons
import Pagination from "../components/Pagination"; // Component for table pagination
import Footer from "../components/Footer";
import ReusableTable from "../components/ReusableTable"; // Component for displaying data in a table
import { Button, Alert, Modal } from "react-bootstrap"; // Added Modal
import apiClient from "../utils/apiClient"; // Changed from axios to apiClient
import { showToast, handleApiError } from '../utils/helpers'; // Import helpers
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Challan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [itemsPerPage, setItemsPerPage] = useState(5); // Default items per page
  const [allChallans, setAllChallans] = useState([]);
  // State related to form modal (showPopup, formData, viewMode, editMode, editId, viewData) is removed
  // as form operations will be handled by separate pages.

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [documentPreview, setDocumentPreview] = useState({
    url: null,
    type: null,
  });
  // const challanFormId = "challan-form"; // No longer needed as form is on a separate page

  // Fetch all challans on component mount
  useEffect(() => {
    fetchChallans();
  }, []);

  const fetchChallans = async () => {
    try {
      setLoading(true);
      const responseData = await apiClient("challans"); // Use apiClient
        setAllChallans(responseData);
        setError(null);
      } catch (err) { // eslint-disable-line no-shadow
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
        await apiClient(`challans/${id}`, { method: "DELETE" }); // Use apiClient
        showToast("Challan deleted successfully!", true);
        fetchChallans(); // Refreshes the list
      } catch (err) { // eslint-disable-line no-shadow
        const errorMessage = handleApiError(err, "Failed to delete challan.");
        setError(errorMessage);
        console.error("Error deleting challan:", err);
      } finally {
        setLoading(false);
      }
    }
  };

  // handleInputChange, handleFileChange, handleSubmit, resetForm, handleClientSelect are removed
  // as they belong to the form, which will be on a separate page.

  const handleViewChallan = (challan) => {
    // Data fetching for view will occur on the dedicated view page
    navigate(`/challans/view/${challan._id}`);
  };

  const handleEditChallan = (challan) => {
    // Data fetching for edit will occur on the dedicated edit page
    navigate(`/challans/edit/${challan._id}`);
  };

  // openViewPopup and openEditPopup are replaced by handleViewChallan and handleEditChallan
  // which navigate to new pages.

  const previewDocument = async (challanId) => {
    try {
      setLoading(true);
      // Clear previous errors before attempting fetch
      setError(null);
      const blob = await apiClient(`challans/${challanId}/document`, { // Use apiClient
        responseType: 'blob', // Tell apiClient to expect a blob
      });
      const contentType = blob.type; // Blob object has a 'type' property
      const url = window.URL.createObjectURL(blob);
      setDocumentPreview({ url, type: contentType });
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

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to the first page
  };

  // renderForm() is removed as its content will be part of a new page component.

  return (
    <div>
      <Navbar />
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 style={{ color: "black" }}>Challan Records</h2>
          <Button
            variant="primary"
            onClick={() => navigate("/challans/create")} // Navigate to a create page
          >
            + Add New Challan
          </Button>
        </div>

        {loading && (
          <div className="text-center my-3">Loading...</div>
        )}
        {/* Display main error state here */}
        {error && <Alert variant="danger">{error}</Alert>}

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
          ]}
          data={currentItems}
          keyField="_id"
          isLoading={loading && currentItems.length === 0} // Show loading only if no items yet
          error={error && currentItems.length === 0 ? error : null}
          renderActions={(challan) => (
            <ActionButtons
              item={challan}
              onView={handleViewChallan} // Changed to navigation handler
              onEdit={handleEditChallan} // Changed to navigation handler
              onDelete={user?.role === 'super-admin' ? () => handleDelete(challan._id) : undefined}
              isLoading={loading} // Pass loading state for individual button disabling if needed
              // Add a specific prop for document preview if ActionButtons handles it
              onPreviewDocument={() => previewDocument(challan._id)} // Example if ActionButtons has a preview button
            />
          )}
          noDataMessage="No challans found"
          tableClassName="mt-3"
          theadClassName="table-dark"
        />

        {/* The main form modal (previously ReusableModal) is removed. */}
        {/* Form interactions will be handled on separate pages. */}

        {/* This modal shows when documentPreview.url is set */}
        {documentPreview && documentPreview.url && (
          <Modal
            show={!!documentPreview.url}
            onHide={closePreview}
            size="lg"
            centered
          >
            <Modal.Header closeButton>
              <Modal.Title>Document Preview</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {documentPreview.type &&
              documentPreview.type.includes("application/pdf") ? (
                <iframe
                  src={documentPreview.url}
                  title="Document Preview"
                  style={{ width: "100%", height: "75vh", border: "none" }}
                />
              ) : (
                <img
                  src={documentPreview.url}
                  alt="Document Preview"
                  style={{ maxWidth: "100%", maxHeight: "75vh", display: "block", margin: "auto" }}
                />
              )}
            </Modal.Body>
          </Modal>
        )}

        {allChallans.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={allChallans.length}
            itemsPerPage={itemsPerPage}
            onPageChange={(page) => {
              const totalPages = Math.ceil(allChallans.length / itemsPerPage);
              if (page >= 1 && page <= totalPages) setCurrentPage(page);
            }}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        )}
      </div>
      <Footer />
    </div>
  );
}
