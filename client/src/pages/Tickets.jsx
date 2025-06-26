// client/src/pages/Tickets.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button, Form, Alert, Modal } from "react-bootstrap";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Pagination from "../components/Pagination";
import Footer from "../components/Footer";
import ReusableTable from "../components/ReusableTable.jsx";
import SearchBar from "../components/Searchbar.jsx";
import ActionButtons from "../components/ActionButtons";
import LoadingSpinner from "../components/LoadingSpinner.jsx";
import { toast } from "react-toastify";
import frontendLogger from "../utils/frontendLogger.js";
import "react-toastify/dist/ReactToastify.css";
import { showToast, handleApiError, formatDateForInput } from "../utils/helpers";
import apiClient from "../utils/apiClient";
import "../css/Style.css";
import "../css/Items.css";
import { FaChartBar } from "react-icons/fa";

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [totalTickets, setTotalTickets] = useState(0);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "descending",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const { user, loading: authLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState("all");
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);


  const fetchTickets = useCallback(async (page = currentPage, limit = itemsPerPage) => {
    if (authLoading || !user) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", limit.toString());
      params.append("sortKey", sortConfig.key);
      params.append("sortDirection", sortConfig.direction);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (searchTerm) params.append("search", searchTerm);

      const endpoint = `/tickets?${params.toString()}`;
      const data = await apiClient(endpoint);
      setTickets(data.data || []);
      setTotalTickets(data.totalItems || 0);
      setError(null);
    } catch (error) {
      const errorMessage = handleApiError(
        error,
        "Failed to load tickets. Please try again.",
        user,
        "ticketActivity"
      );
      setError(errorMessage);
      setTickets([]);
      setTotalTickets(0);
      showToast(errorMessage, false);
      if (user) {
        frontendLogger.error(
          "ticketActivity",
          "Failed to fetch tickets",
          user,
          {
            errorMessage: error.response?.data?.message || error.message,
            statusFilter,
            action: "FETCH_TICKETS_FAILURE",
          }
        );
      }
      if (error.status === 401) {
        toast.error("Authentication failed. Please log in again.");
        navigate("/login", { state: { from: "/tickets" } });
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, authLoading, navigate, statusFilter, searchTerm, currentPage, itemsPerPage, sortConfig.key, sortConfig.direction]);

  useEffect(() => {
    // ProtectedRoute handles the auth check, so we only need to fetch data if the user exists.
    if (user && !authLoading) {
      fetchTickets(currentPage, itemsPerPage);
    }
  }, [user, authLoading, fetchTickets, currentPage, itemsPerPage]);

  const requestSort = useCallback((key) => {
    let direction = "descending";
    if (sortConfig.key === key) {
      direction = sortConfig.direction === "ascending" ? "descending" : "ascending";
    } else if (key === "grandTotal" || key === "createdAt" || key === "deadline") {
      direction = "descending";
    } else {
      direction = "ascending";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  }, [sortConfig]);

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortConfig]);

  const reportButtonElement = (user?.role === "admin" || user?.role === "super-admin") && (
    <Button
      variant="info"
      onClick={() => navigate("/tickets/report")}
      title="View Ticket Activity Reports"
      size="sm"
    >
      <FaChartBar className="me-1" /> Report
    </Button>
  );

  const resetForm = useCallback(() => {
    setError(null);
  }, []);

  const handleEdit = useCallback((ticket) => {
    // Navigates to the definitive edit route.
    navigate(`/tickets/edit/${ticket._id}`);
  }, [navigate]);

    const handleTransfer = useCallback((ticket) => { // Transfer Ticket
    navigate(`/tickets/transfer/${ticket._id}`);
  }, [navigate]);

    const handleViewDetails = useCallback((ticket) => { // View Documents/Details
    navigate(`/tickets/details/${ticket._id}`);
  }, [navigate]);


  const handleDeleteTicket = useCallback(async (ticket) => {
    if (!ticket || !ticket._id) {
      toast.error("Invalid ticket.");
      return;
    }
    if (!window.confirm(`Delete ticket ${ticket.ticketNumber}?`)) return;

    setIsLoading(true);
    setError(null);
    try {
      await apiClient(`/tickets/${ticket._id}`, { method: "DELETE" });
      resetForm();
      if (tickets.length === 1 && currentPage > 1) {
        setCurrentPage(prevPage => prevPage - 1);
      } else {
        fetchTickets(currentPage, itemsPerPage);
      }
      toast.success(`Ticket ${ticket.ticketNumber} deleted.`);
      frontendLogger.info(
        "ticketActivity",
        `Ticket ${ticket.ticketNumber} deleted`,
        user,
        {
          ticketId: ticket._id,
          ticketNumber: ticket.ticketNumber,
          action: "DELETE_TICKET_SUCCESS",
        }
      );
    } catch (error) {
      const errorMessage = handleApiError(
        error, "Failed to delete ticket.", user, "ticketActivity"
      );
      if (error.status === 401) {
        navigate("/login", { state: { from: "/tickets" } });
        return;
      }
      setError(errorMessage);
      toast.error(errorMessage);
      if (user) {
        frontendLogger.error(
          "ticketActivity", "Failed to delete ticket", user,
          {
            ticketId: ticket._id, ticketNumber: ticket.ticketNumber,
            action: "DELETE_TICKET_FAILURE",
          }
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, resetForm, fetchTickets, navigate, tickets.length, currentPage, itemsPerPage]);


  return (
    <div>
      <Navbar />
      <LoadingSpinner show={isLoading || authLoading} />
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap" style={{ gap: "1rem" }}>
          <h2 style={{ color: "black", margin: 0, whiteSpace: "nowrap" }}>Tickets</h2>

          <div className="filter-dropdown-group">
            <Form.Select
              aria-label="Status filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select-sm"
              style={{ width: 'auto', minWidth: '200px' }}
            >
              <option value="all">Sort By Status</option>
              {["all", "Quotation Sent", "PO Received", "Payment Pending", "Inspection", "Packing List", "Invoice Sent", "Hold", "Closed"].map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Form.Select>
          </div>

          <div className="d-flex align-items-center" style={{ minWidth: "200px", flexGrow: 1, maxWidth: "400px" }}>
            <SearchBar
              value={searchTerm}
              setSearchTerm={(value) => setSearchTerm(value)}
              placeholder="Search tickets..."
              className="w-100"
            />
          </div>
        </div>

        {!isLoading && !authLoading && error && <Alert variant="danger">{error}</Alert>}

        {!isLoading && !authLoading && !error && (
          <ReusableTable
            columns={[
              { key: "ticketNumber", header: "Ticket No", sortable: true, tooltip: "Unique Ticket Number" },
              { key: "companyName", header: "Company Name", sortable: true },
              { key: "currentAssignee.firstname", header: "Assigned To", sortable: true, renderCell: (item) => `${item.currentAssignee?.firstname || ""} ${item.currentAssignee?.lastname || ""}`.trim() || "N/A" },
              { key: "status", header: "Status", sortable: true,
                renderCell: (item) => (
                  <span className={`badge bg-${item.status === "Quotation Sent" ? "primary" : item.status === "PO Received" ? "info" : item.status === "Payment Pending" ? "warning" : item.status === "Inspection" ? "secondary" : item.status === "Packing List" ? "dark" : item.status === "Invoice Sent" ? "success" : item.status === "Hold" ? "danger" : "success"}`}>
                    {item.status}
                  </span>
                ),
                tooltip: "Current status of the ticket.",
              },
              { key: "deadline", header: "Deadline", sortable: true, renderCell: (item) => formatDateForInput(item.deadline) },
            ]}
            data={tickets}
            keyField="_id"
            onSort={requestSort}
            sortConfig={sortConfig}
            renderActions={(ticket) => (
        <ActionButtons
                item={ticket}
                onEdit={handleEdit}
                onDelete={handleDeleteTicket}
                onTransfer={handleTransfer}
                onViewDetails={handleViewDetails}
                user={user}
                isLoading={isLoading}
              />            )}
            noDataMessage="No tickets found."
            tableClassName="mt-3"
            theadClassName="table-dark"
            user={user}
          />
        )}

        {totalTickets > 0 && !isLoading && (
          <Pagination
            currentPage={currentPage}
            totalItems={totalTickets}
            itemsPerPage={itemsPerPage}
            onPageChange={(page) => {
              const totalPages = Math.ceil(totalTickets / itemsPerPage);
              if (page >= 1 && page <= totalPages) { setCurrentPage(page); }
            }}
            onItemsPerPageChange={handleItemsPerPageChange}
            reportButton={reportButtonElement}
          />
        )}
      </div>
      <Footer />
    </div>
  );
}
