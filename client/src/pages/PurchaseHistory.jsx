import React, { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar.jsx"; 
import Pagination from '../components/Pagination'; // Component for table pagination
import Footer from "../components/Footer";
import apiClient from "../utils/apiClient"; // Utility for making API requests
import { getAuthToken as getAuthTokenUtil } from "../utils/authUtils"; // Utility for retrieving auth token
import { handleApiError } from '../utils/helpers'; // Utility for consistent API error handling
import { Table, Button, Alert, Form } from "react-bootstrap"; // Bootstrap components
import "../css/Style.css";
import { toast } from "react-toastify"; // Library for toast notifications, ToastContainer removed
import "react-toastify/dist/ReactToastify.css";

export default function PurchaseHistory() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState(""); 
  // Date and Vendor filters are removed from UI, so their state can be removed or ignored
  // const [dateFilter, setDateFilter] = useState({
  //   startDate: "",
  //   endDate: "",
  // });
  const [currentPage, setCurrentPage] = useState(1);
  // const [vendorFilter, setVendorFilter] = useState("");
  const [expandedPurchase, setExpandedPurchase] = useState(null); 
  const [itemsPerPage, setItemsPerPage] = useState(5);

  const fetchPurchases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAuthTokenUtil(); // Use utility

      if (!token) {
        setError("Authentication token not found. Please log in again.");
        setLoading(false);
        return;
      }
      // Use apiClient
      const data = await apiClient("/items/purchases/all", { timeout: 10000 });
      setPurchases(data);
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to load purchase history.");
      setError(errorMessage);
      // Specific error messages based on error type can be part of handleApiError or added here
      if (err.code === 'ECONNREFUSED' || err.message.includes('Network Error')) {
        setError("Cannot connect to the server. Please check if the backend is running.");
      } else if (err.response) {
        setError(`Server error: ${err.response.status} ${err.response.data?.message || err.response.statusText}`);
      } else if (err.request) {
        setError("No response received from server. Please check your connection.");
      } else {
        setError("Failed to load purchase history. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases();

    return () => {
      setPurchases([]);
    };
  }, [fetchPurchases]);

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value.toLowerCase());
    setCurrentPage(1);
  };

  // const handleDateFilterChange = (e) => {
  //   setDateFilter({ ...dateFilter, [e.target.name]: e.target.value });
  //   setCurrentPage(1);
  // };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when items per page changes
  };
/*
  const clearFilters = () => {
    setSearchTerm("");
    setDateFilter({ startDate: "", endDate: "" });
    setVendorFilter("");
    setCurrentPage(1);
  };

*/  const toggleDetails = (purchaseId) => {
    setExpandedPurchase(expandedPurchase === purchaseId ? null : purchaseId);
  };


  const handleRetry = () => {
    fetchPurchases();
  };

  const handleDeletePurchase = async (purchaseId) => {
    if (!window.confirm("Are you sure you want to delete this purchase? This action cannot be undone.")) return;
    try {
      setLoading(true);
      setError(null);
      const token = getAuthTokenUtil();
      if (!token) {
        setError("Authentication token not found. Please log in again.");
        setLoading(false);
        return;
      }
      await apiClient(`/items/purchases/${purchaseId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success("Purchase deleted and backed up successfully.");
      // Remove from local state
      setPurchases((prev) => prev.filter((p) => p._id !== purchaseId));
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to delete purchase.");
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const filteredPurchases = purchases.filter((purchase) => {
    // Search term filter
    const matchesSearch =
      purchase.companyName.toLowerCase().includes(searchTerm) ||
      purchase.invoiceNumber.toString().toLowerCase().includes(searchTerm) ||
      (purchase.gstNumber && purchase.gstNumber.toLowerCase().includes(searchTerm));
    return matchesSearch; // && matchesStartDate && matchesEndDate && matchesVendor;
  });

  const indexOfLastPurchase = currentPage * itemsPerPage;
  const indexOfFirstPurchase = indexOfLastPurchase - itemsPerPage;
  const currentPurchases = filteredPurchases.slice(indexOfFirstPurchase, indexOfLastPurchase);

  const calculatePurchaseTotal = (purchase) => {
    return purchase.items.reduce((total, item) => {
      const itemTotal = item.quantity * item.price * (1 + (item.gstRate || 0) / 100);
      return total + itemTotal;
    }, 0);
  };

  return (
    <div className="purchase-history-container">
      <Navbar />
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 style={{color: "black", margin: 0}}>Purchase History</h2>
          <div style={{ width: "50%" }}> {/* Adjust width as needed */}
            <input
              type="text"
              className="form-control"
              placeholder="🔍 Search by company, invoice, GST..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
            <button
              className="btn btn-sm btn-outline-danger ms-3"
              onClick={handleRetry}
            >
              Retry
            </button>
          </div>
        )}

        {/* Filters container removed */}
        {loading ? (
          <div className="text-center">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table table-striped table-bordered">
                <thead className="table-dark">
                  <tr>
                    <th>Date</th>
                    <th>Invoice #</th>
                    <th>Vendor</th>
                    <th>GST Number</th>
                    <th>Items Count</th>
                    <th>Total Amount</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {currentPurchases.length > 0 ? (
                    currentPurchases.map((purchase) => (
                      <React.Fragment key={purchase._id}>
                        <tr>
                          <td>{new Date(purchase.date).toLocaleDateString()}</td>
                          <td>{purchase.invoiceNumber}</td>
                          <td>{purchase.companyName}</td>
                          <td>{purchase.gstNumber || "-"}</td>
                          <td>{purchase.items.length}</td>
                          <td>₹{calculatePurchaseTotal(purchase).toFixed(2)}</td>
                          <td>
                            <div className="d-flex gap-1">
                              <button
                                onClick={() => toggleDetails(purchase._id)}
                                className="btn btn-info btn-sm"
                              >
                                {expandedPurchase === purchase._id ? "Hide" : "Show"} Details
                              </button>
                              <button
                                onClick={() => handleDeletePurchase(purchase._id)}
                                className="btn btn-danger btn-sm"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>

                        {expandedPurchase === purchase._id && (
                          <tr>
                            <td colSpan="7" className="expanded-row">
                              <div className="expanded-purchase-details p-3">
                                <h6>Purchase Details</h6>
                                <div className="row mb-3">
                                  <div className="col-md-4">
                                    <strong>Vendor:</strong> {purchase.companyName}
                                  </div>
                                  <div className="col-md-4">
                                    <strong>GST Number:</strong> {purchase.gstNumber || "N/A"}
                                  </div>
                                  <div className="col-md-4">
                                    <strong>Invoice:</strong> {purchase.invoiceNumber}
                                  </div>
                                </div>
                                <div className="row mb-3">
                                  <div className="col-md-4">
                                    <strong>Address:</strong> {purchase.address || "N/A"}
                                  </div>
                                  <div className="col-md-4">
                                    <strong>State:</strong> {purchase.stateName || "N/A"}
                                  </div>
                                  <div className="col-md-4">
                                    <strong>Date:</strong> {new Date(purchase.date).toLocaleDateString()}
                                  </div>
                                </div>

                                <h6 className="mt-3">Items</h6>
                                <table className="table table-sm table-bordered">
                                  <thead className="table-light">
                                    <tr>
                                      <th>Description</th>
                                      <th>Quantity</th>
                                      <th>Price</th>
                                      <th>GST Rate</th>
                                      <th>GST Amount</th>
                                      <th>Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {purchase.items.map((item, idx) => {
                                      const itemSubtotal = item.quantity * item.price;
                                      const itemGst = itemSubtotal * (item.gstRate / 100);
                                      const itemTotal = itemSubtotal + itemGst;

                                      return (
                                        <tr key={idx}>
                                          <td>{item.description}</td>
                                          <td>{item.quantity}</td>
                                          <td>₹{parseFloat(item.price).toFixed(2)}</td>
                                          <td>{item.gstRate}%</td>
                                          <td>₹{itemGst.toFixed(2)}</td>
                                          <td>₹{itemTotal.toFixed(2)}</td>
                                        </tr>
                                      );
                                    })}
                                    <tr className="table-info">
                                      <td colSpan="5" className="text-end">
                                        <strong>Grand Total:</strong>
                                      </td>
                                      <td>
                                        <strong>₹{calculatePurchaseTotal(purchase).toFixed(2)}</strong>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center">
                        No purchase records found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {filteredPurchases.length > 0 && (
              <Pagination
                currentPage={currentPage}
                totalItems={filteredPurchases.length}
                itemsPerPage={itemsPerPage}
                onPageChange={(page) => {
                  const totalPages = Math.ceil(filteredPurchases.length / itemsPerPage);
                  if (page >= 1 && page <= totalPages) setCurrentPage(page);
                }}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            )}

          </>
        )}
      </div>
      <Footer />
    </div>
  );
}