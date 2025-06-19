import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar"; // Navigation bar component
import ActionButtons from "../components/ActionButtons"; // Component for table action buttons
import Pagination from "../components/Pagination"; // Component for table pagination
import Footer from "../components/Footer";
import ReusableTable from "../components/ReusableTable"; // Component for displaying data in a table
import { Button, Alert, Modal } from "react-bootstrap"; // Added Modal
import apiClient from "../utils/apiClient"; // Changed from axios to apiClient
import { showToast, handleApiError } from "../utils/helpers"; // Import helpers
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Challan() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [itemsPerPage, setItemsPerPage] = useState(5); // Default items per page
  const [challans, setChallans] = useState([]); // Holds current page's challans
  const [totalChallansCount, setTotalChallansCount] = useState(0); // Total number of challans for pagination

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [documentPreview, setDocumentPreview] = useState({
    url: null,
    type: null,
  });

  const fetchChallans = useCallback(
    async (page = 1, limit = itemsPerPage) => {
      try {
        setLoading(true);
        // Assuming API returns { data: challansArray, totalItems: count }
        const response = await apiClient("/challans", {
          params: { page, limit },
        });
        setChallans(response.data || []);
        setTotalChallansCount(response.totalItems || 0);
        setError(null);
      } catch (err) {
        const errorMessage = handleApiError(
          err,
          "Failed to load challans.",
          user
        );
        setError(errorMessage);
        setChallans([]); // Clear data on error
        setTotalChallansCount(0);
        console.error("Error fetching challans:", err);
      } finally {
        setLoading(false);
      }
    },
    [itemsPerPage, user]
  ); // user is a dependency for handleApiError

  useEffect(() => {
    fetchChallans(currentPage, itemsPerPage);
  }, [currentPage, itemsPerPage, fetchChallans]);

  const handleDelete = useCallback(
    async (id) => {
      if (window.confirm("Are you sure you want to delete this challan?")) {
        try {
          setLoading(true);
          await apiClient(`challans/${id}`, { method: "DELETE" });
          showToast("Challan deleted successfully!", true);
          // Refresh logic: if last item on a page (not first page), go to prev page.
          if (challans.length === 1 && currentPage > 1) {
            setCurrentPage((prevPage) => prevPage - 1);
          } else {
            fetchChallans(currentPage, itemsPerPage);
          }
        } catch (err) {
          const errorMessage = handleApiError(
            err,
            "Failed to delete challan.",
            user
          );
          setError(errorMessage);
          console.error("Error deleting challan:", err);
        } finally {
          setLoading(false);
        }
      }
    },
    [challans.length, currentPage, itemsPerPage, fetchChallans, user]
  );

  const handleViewChallan = (challan) => {
    navigate(`/challans/view/${challan._id}`);
  };

  const handleEditChallan = (challan) => {
    navigate(`/challans/edit/${challan._id}`);
  };

  const previewDocument = useCallback(
    async (challanId) => {
      try {
        setLoading(true);
        // Clear previous errors before attempting fetch
        setError(null);
        const blob = await apiClient(`challans/${challanId}/document`, {
          // Use apiClient
          responseType: "blob", // Tell apiClient to expect a blob
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
    },
    [user]
  ); // user is a dependency for handleApiError

  const closePreview = useCallback(() => {
    if (documentPreview && documentPreview.url) {
      window.URL.revokeObjectURL(documentPreview.url);
    }
    setDocumentPreview({ url: null, type: null });
  }, [documentPreview]);

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to the first page
  };

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

        {loading && <div className="text-center my-3">Loading...</div>}
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
                  <div>
                    {`${item.createdBy?.firstname || ""} ${
                      item.createdBy?.lastname || ""
                    }`.trim() || "System"}
                  </div>
                  <small>{new Date(item.createdAt).toLocaleString()}</small>
                </div>
              ),
            },
          ]}
          data={challans}
          keyField="_id"
          isLoading={loading && challans.length === 0} // Show table loading only if no items yet
          error={error && challans.length === 0 ? error : null} // Show table error only if no items yet
          renderActions={(challan) => (
            <ActionButtons
              item={challan}
              onView={handleViewChallan} // Changed to navigation handler
              onEdit={handleEditChallan} // Changed to navigation handler
              onDelete={
                user?.role === "super-admin"
                  ? () => handleDelete(challan._id)
                  : undefined
              }
              isLoading={loading} // Pass loading state for individual button disabling if needed
              onPreviewDocument={() => previewDocument(challan._id)} // Example if ActionButtons has a preview button
            />
          )}
          noDataMessage="No challans found"
          tableClassName="mt-3"
          theadClassName="table-dark"
        />

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
                  style={{
                    maxWidth: "100%",
                    maxHeight: "75vh",
                    display: "block",
                    margin: "auto",
                  }}
                />
              )}
            </Modal.Body>
          </Modal>
        )}

        {totalChallansCount > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={totalChallansCount}
            itemsPerPage={itemsPerPage}
            onPageChange={(page) => {
              // Basic validation, Pagination component might handle this more robustly
              const totalPages = Math.ceil(totalChallansCount / itemsPerPage);
              if (page >= 1 && page <= totalPages) {
                setCurrentPage(page);
              }
            }}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        )}
      </div>
      <Footer />
    </div>
  );
}
