import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import "../css/Style.css";
import Navbar from "../components/Navbar.jsx";
import { getAuthToken } from "../utils/authUtils"; // Make sure this path is correct
import Pagination from '../components/Pagination';

export default function PurchaseHistory() {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState({
    startDate: "",
    endDate: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [vendorFilter, setVendorFilter] = useState("");
  const [expandedPurchase, setExpandedPurchase] = useState(null);
  const purchasesPerPage = 10;

  const fetchPurchases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAuthToken();

      if (!token) {
        setError("Authentication token not found. Please log in again.");
        setLoading(false);
        return;
      }

      // Add error handling and timeout
      const response = await axios.get("http://localhost:3000/api/items/purchases/all", {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Added Authorization header
        }
      });


      setPurchases(response.data);
      console.log("Purchases fetched:", response.data.length);
    } catch (err) {
      console.error("Error fetching purchases:", err);

      // More detailed error handling
      if (err.code === 'ECONNREFUSED' || err.message.includes('Network Error')) {
        setError("Cannot connect to the server. Please check if the backend is running.");
      } else if (err.response) {
        // Server responded with an error status
        setError(`Server error: ${err.response.status} ${err.response.data?.message || err.response.statusText}`);
      } else if (err.request) {
        // Request was made but no response received
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

  const handleDateFilterChange = (e) => {
    setDateFilter({ ...dateFilter, [e.target.name]: e.target.value });
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDateFilter({ startDate: "", endDate: "" });
    setVendorFilter("");
    setCurrentPage(1);
  };

  const toggleDetails = (purchaseId) => {
    setExpandedPurchase(expandedPurchase === purchaseId ? null : purchaseId);
  };

  // Handle retry
  const handleRetry = () => {
    fetchPurchases();
  };

  // Apply filters
  const filteredPurchases = purchases.filter((purchase) => {
    // Search term filter
    const matchesSearch =
      purchase.companyName.toLowerCase().includes(searchTerm) ||
      purchase.invoiceNumber.toString().toLowerCase().includes(searchTerm) ||
      (purchase.gstNumber && purchase.gstNumber.toLowerCase().includes(searchTerm));

    // Date filter
    const purchaseDate = new Date(purchase.date);
    const matchesStartDate = dateFilter.startDate
      ? purchaseDate >= new Date(dateFilter.startDate)
      : true;
    const matchesEndDate = dateFilter.endDate
      ? purchaseDate <= new Date(dateFilter.endDate)
      : true;

    // Vendor filter
    const matchesVendor = vendorFilter
      ? purchase.companyName.toLowerCase().includes(vendorFilter.toLowerCase())
      : true;

    return matchesSearch && matchesStartDate && matchesEndDate && matchesVendor;
  });

  // Pagination
  const indexOfLastPurchase = currentPage * purchasesPerPage;
  const indexOfFirstPurchase = indexOfLastPurchase - purchasesPerPage;
  const currentPurchases = filteredPurchases.slice(indexOfFirstPurchase, indexOfLastPurchase);
  const totalPages = Math.ceil(filteredPurchases.length / purchasesPerPage);

  // Get unique vendors for filter dropdown
  const uniqueVendors = [...new Set(purchases.map(p => p.companyName))];

  // Calculate total purchase amount
  const calculatePurchaseTotal = (purchase) => {
    return purchase.items.reduce((total, item) => {
      const itemTotal = item.quantity * item.price * (1 + (item.gstRate || 0) / 100);
      return total + itemTotal;
    }, 0);
  };

  // // Export purchases to CSV
  // const exportToCSV = () => {
  //   // Create CSV headers
  //   let csv = "Date,Invoice Number,Vendor,GST Number,Item Count,Total Amount\n";

  //   // Add data rows
  //   filteredPurchases.forEach(purchase => {
  //     const date = new Date(purchase.date).toLocaleDateString();
  //     const total = calculatePurchaseTotal(purchase).toFixed(2);
  //     csv += `"${date}","${purchase.invoiceNumber}","${purchase.companyName}","${purchase.gstNumber || ''}",${purchase.items.length},${total}\n`;
  //   });

  //   // Create download link
  //   // const blob = new Blob([csv], { type: 'text/csv' });
  //   const url = window.URL.createObjectURL(blob);
  //   const a = document.createElement('a');
  //   a.setAttribute('hidden', '');
  //   a.setAttribute('href', url);
  //   a.setAttribute('download', 'purchase_history.csv');
  //   document.body.appendChild(a);
  //   a.click();
  //   document.body.removeChild(a);
  // };

  return (
    <div className="purchase-history-container">
      <Navbar />
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2>Purchase History</h2>
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

        <div className="filters-container mb-4">
          <div className="row">
            <div className="col-md-3 mb-2">
              <input
                type="text"
                className="form-control"
                placeholder="🔍 Search by company, invoice..."
                value={searchTerm}
                onChange={handleSearchChange}
              />
            </div>
            <div className="col-md-3 mb-2">
              <select
                className="form-control"
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
              >
                <option value="">All Vendors</option>
                {uniqueVendors.map((vendor) => (
                  <option key={vendor} value={vendor}>
                    {vendor}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2 mb-2">
              <input
                type="date"
                className="form-control"
                placeholder="Start Date"
                name="startDate"
                value={dateFilter.startDate}
                onChange={handleDateFilterChange}
              />
            </div>
            <div className="col-md-2 mb-2">
              <input
                type="date"
                className="form-control"
                placeholder="End Date"
                name="endDate"
                value={dateFilter.endDate}
                onChange={handleDateFilterChange}
              />
            </div>
            <div className="col-md-2 mb-2">
              <button
                className="btn btn-secondary w-100"
                onClick={clearFilters}
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

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

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={(page) => {
                if (page >= 1 && page <= totalPages) setCurrentPage(page);
              }}
            />


          </>
        )}
      </div>
    </div>
  );
}