import React, { useState, useEffect, useMemo, useCallback } from "react";
import Pagination from "../components/Pagination";
import Footer from "../components/Footer";
import {
  Modal,
  Form,
  Table,
  ProgressBar,
  Alert,
  Dropdown,
  Badge,
  Card,
  Col,
} from "react-bootstrap";
import { FaChartBar } from "react-icons/fa";
import Navbar from "../components/Navbar.jsx";
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer";
import QuotationPDF from "../components/QuotationPDF.jsx";
import PIPDF from "../components/PIPDF.jsx";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { handleApiError, showToast } from "../utils/helpers";
import frontendLogger from "../utils/frontendLogger.js";
import { getAuthToken as getAuthTokenUtil } from "../utils/authUtils";
import ReusableTable from "../components/ReusableTable.jsx";
import SearchBar from "../components/Searchbar.jsx";
import apiClient from "../utils/apiClient";
import "../css/Style.css";
import ReusablePageStructure from "../components/ReusableModal.jsx";
import TicketReportModal from "../components/TicketReportModal.jsx";
import ActionButtons from "../components/ActionButtons.jsx";
import * as docx from "docx";
import { saveAs } from "file-saver";
import { generatePIDocx } from "../utils/generatePIDocx";
import axios from "axios";
import { Button } from "react-bootstrap";

const COMPANY_REFERENCE_STATE = "UTTAR PRADESH";

export const UserSearchComponent = ({ onUserSelect, authContext }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient("/tickets/transfer-candidates");
      setUsers(data);
    } catch (err) {
      let specificMessage =
        "An unexpected error occurred while trying to load users for search.";
      if (err.status) {
        if (err.status === 403) {
          specificMessage =
            err.data?.message ||
            "You do not have permission to view the list of users. This action may be restricted to certain roles (e.g., super-administrators).";
        } else if (err.data && err.data.message) {
          specificMessage = err.data.message;
        } else if (err.message) {
          specificMessage = `Failed to load users: ${err.message}`;
        }
      } else if (err.message) {
        specificMessage = `Failed to load users: ${err.message}`;
      }
      setError(specificMessage);

      if (authContext?.user) {
        frontendLogger.error(
          "userSearch",
          "Failed to fetch users",
          authContext.user,
          {
            errorMessage: err.message,
            specificMessageDisplayed: specificMessage,
            stack: err.stack,
          }
        );
      } else {
        frontendLogger.error(
          "userSearch",
          "Failed to fetch users (user context unavailable)",
          null,
          {
            errorMessage: err.message,
            specificMessageDisplayed: specificMessage,
            stack: err.stack,
          }
        );
      }
    } finally {
      setLoading(false);
    }
  }, [authContext]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (searchTerm.trim() !== "") {
      const filtered = users.filter(
        (user) =>
          user.firstname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.lastname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
      setShowDropdown(true);
    } else {
      setFilteredUsers([]);
      setShowDropdown(false);
    }
  }, [searchTerm, users]);

  const handleUserClick = (user) => {
    onUserSelect(user);
    setSearchTerm("");
    setShowDropdown(false);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleBlur = () => {
    setTimeout(() => setShowDropdown(false), 200);
  };

  return (
    <div className="user-search-component">
      {error && <div className="search-error text-danger small">{error}</div>}

      <div className="search-input-container">
        <input
          type="text"
          className="form-control"
          placeholder="Search user by name or email..."
          value={searchTerm}
          onChange={handleSearchChange}
          onFocus={() => setShowDropdown(true)}
          onBlur={handleBlur}
          disabled={loading}
        />
        {loading && <div className="search-loading">Loading...</div>}
      </div>

      {showDropdown && filteredUsers.length > 0 && (
        <div className="search-suggestions-dropdown">
          {filteredUsers.map((user) => (
            <div
              key={user._id}
              className="search-suggestion-item"
              onClick={() => handleUserClick(user)}
            >
              <strong>
                {user.firstname} {user.lastname}
              </strong>
              <span className="text-muted"> - {user.email}</span>
              <br />
              <small>Role: {user.role}</small>
            </div>
          ))}
        </div>
      )}

      {showDropdown && searchTerm && filteredUsers.length === 0 && (
        <div className="search-no-results">No users found</div>
      )}
    </div>
  );
};

export const PIActions = ({ ticket }) => {
  const handleDownloadWord = async () => {
    try {
      const doc = generatePIDocx(ticket);
      const blob = await docx.Packer.toBlob(doc);
      saveAs(blob, `PI_${ticket.ticketNumber || ticket.quotationNumber}.docx`);
    } catch (error) {
      console.error("Error generating PI Word document:", error);
      toast.error("Failed to generate PI Word document. Please try again.");
      frontendLogger.error("piGeneration", "Failed to generate PI DOCX", { ticketId: ticket?._id, error: error.message });
    }
  };

  const pdfButtonProps = {
    document: <PIPDF ticket={ticket} />,
    fileName: `PI_${ticket.ticketNumber || ticket.quotationNumber}.pdf`,
  };

  return (
    <ActionButtons
      item={ticket}
      pdfProps={pdfButtonProps}
      onDownloadWord={handleDownloadWord}
      size="md"
    />
  );
};

export default function Dashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [paymentReference, setPaymentReference] = useState("");
  const [ticketData, setTicketData] = useState({
    companyName: "", quotationNumber: "",
    billingAddress: { address1: "", address2: "", city: "", state: "", pincode: "" },
    shippingAddress: { address1: "", address2: "", city: "", state: "", pincode: "" },
    shippingSameAsBilling: false,
    goods: [], totalQuantity: 0, totalAmount: 0,
    gstBreakdown: [], totalCgstAmount: 0, totalSgstAmount: 0, totalIgstAmount: 0,
    deadline: null,
    finalGstAmount: 0, grandTotal: 0, isBillingStateSameAsCompany: false,
    status: "Quotation Sent",
    documents: { quotation: null, po: null, pi: null, challan: null, packingList: null, feedback: null, other: [] },
    dispatchDays: "7-10 working", validityDate: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString(),
    clientPhone: "", clientGstNumber: "",
    termsAndConditions: "1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged if payment is not made within the stipulated time.\n3. Subject to Noida jurisdiction.",
  });
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "descending" });
  const [showTicketReportModal, setShowTicketReportModal] = useState(false);
  const { user: authUser, loading: authLoading } = useAuth();
  // Removed showEditModal and isFetchingAddressInEdit as edit is now a separate page
  const auth = useAuth();
  const navigate = useNavigate();

  const statusStages = ["Quotation Sent", "PO Received", "Payment Pending", "Inspection", "Packing List", "Invoice Sent", "Hold", "Closed"];

  const isTicketOverdue = (ticket) => {
    if (!ticket.deadline || ticket.status === "Closed" || ticket.status === "Hold") {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(ticket.deadline) < today;
      };

  const ticketStatusFilterOptions = [
    { value: "all", label: "Sort By Status" },
    { value: "open", label: "Open (Active)" }, // "open" means not Closed and not Hold
    { value: "Running", label: "Running" },
    { value: "closed", label: "Closed" },
    { value: "hold", label: "Hold" },
  ];

  const handleSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const fetchTickets = useCallback(async () => {
    if (!authUser) return;
    setIsLoading(true); setError(null);
    try {
      const data = await apiClient("/tickets", {
        params: { populate: "client,currentAssignee,createdBy,transferHistory.from,transferHistory.to,transferHistory.transferredBy,statusHistory.changedBy,documents.quotation.uploadedBy,documents.po.uploadedBy,documents.pi.uploadedBy,documents.challan.uploadedBy,documents.packingList.uploadedBy,documents.feedback.uploadedBy,documents.other.uploadedBy" },
      });
      setTickets(data);
    } catch (error) {
      const errorMsg = handleApiError(error, "Failed to load tickets", auth.user, "ticketActivity");
      setError(errorMsg); toast.error(errorMsg);
      frontendLogger.error("ticketActivity", "Failed to fetch tickets", auth.user, { errorMessage: errorMsg, stack: error.stack, status: error.status, action: "FETCH_TICKETS_FAILURE" });
      if (error.status === 401) { toast.error("Authentication failed."); navigate("/login", { state: { from: "/tickets" } }); }
    } finally { setIsLoading(false); }
  }, [authUser, navigate, auth.user]);

  useEffect(() => {
    if (!authLoading && !authUser) {
      if (window.location.pathname !== "/login") { toast.info("Redirecting to login."); navigate("/login", { state: { from: "/tickets" } }); }
    } else if (authUser) { fetchTickets(); }
  }, [authUser, authLoading, navigate, fetchTickets]);

  const handleDelete = async (ticketToDelete) => {
    if (!authUser || authUser.role !== "super-admin") {
      const msg = "Permission denied to delete ticket."; setError(msg); toast.warn(msg);
      frontendLogger.warn("ticketActivity", "Delete permission denied", auth.user, { ticketId: ticketToDelete?._id, action: "DELETE_TICKET_PERMISSION_DENIED" });
      return;
    }
    if (window.confirm(`Delete ticket ${ticketToDelete.ticketNumber}?`)) {
      setIsLoading(true);
      try {
        await apiClient(`/tickets/admin/${ticketToDelete._id}`, { method: "DELETE" });
        fetchTickets(); setError(null); const successMsg = `Ticket ${ticketToDelete.ticketNumber} deleted.`; toast.success(successMsg);
        frontendLogger.info("ticketActivity", successMsg, auth.user, { ticketId: ticketToDelete._id, action: "DELETE_TICKET_SUCCESS" });
      } catch (error) {
        const errorMsg = handleApiError(error, "Delete failed", auth.user, "ticketActivity");
        setError(errorMsg); toast.error(errorMsg);
        frontendLogger.error("ticketActivity", `Failed to delete ticket ${ticketToDelete.ticketNumber}`, auth.user, { ticketId: ticketToDelete._id, action: "DELETE_TICKET_FAILURE" });
      } finally { setIsLoading(false); }
    }
  };

  const handleProgressClick = (ticket) => {
    navigate(`/tickets/details/${ticket._id}`, { state: { ticketData: ticket } });
  };

  const sortedTickets = useMemo(() => {
    if (!sortConfig.key) return tickets;
    return [...tickets].sort((a, b) => {
      const aOverdue = isTicketOverdue(a);
      const bOverdue = isTicketOverdue(b);

      if (aOverdue && !bOverdue) return -1;
      if (!aOverdue && bOverdue) return 1;

      if (sortConfig.key === "createdAt" || sortConfig.key === "deadline") {
        const valA = a[sortConfig.key] ? new Date(a[sortConfig.key]) : null;
        const valB = b[sortConfig.key] ? new Date(b[sortConfig.key]) : null;
        if (!valA && valB) return sortConfig.direction === "ascending" ? 1 : -1;
        if (valA && !valB) return sortConfig.direction === "ascending" ? -1 : 1;
        if (!valA && !valB) return 0;
        return sortConfig.direction === "ascending" ? valA - valB : valB - valA;
      }
      if (sortConfig.key === "grandTotal") return sortConfig.direction === "ascending" ? a.grandTotal - b.grandTotal : b.grandTotal - a.grandTotal;
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === "ascending" ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === "ascending" ? 1 : -1;
      return 0;
    });
  }, [tickets, sortConfig]);

  const filteredTickets = useMemo(() => {
    let filtered = sortedTickets;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.ticketNumber?.toLowerCase().includes(term) || t.quotationNumber?.toLowerCase().includes(term) ||
        t.companyName?.toLowerCase().includes(term) || t.client?.companyName?.toLowerCase().includes(term) ||
        t.goods.some(item => item.description?.toLowerCase().includes(term) || item.hsnSacCode?.toLowerCase().includes(term))
      );
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter(ticket => {
        if (statusFilter === "open") return ticket.status !== "Closed" && ticket.status !== "Hold";
        if (statusFilter === "closed") return ticket.status === "Closed";
        if (statusFilter === "hold") return ticket.status === "Hold";
        if (statusFilter === "Running") return ticket.status === "Running";
        return true;
      });
    }
    return filtered;
  }, [sortedTickets, searchTerm, statusFilter]);

  const handleItemsPerPageChange = (newItemsPerPage) => { setItemsPerPage(newItemsPerPage); setCurrentPage(1); };
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTickets.slice(indexOfFirstItem, indexOfLastItem);
  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") direction = "descending";
    setSortConfig({ key, direction });
  };

  const handleEdit = (selectedTicketToEdit) => {
    // Navigate to the EditTicketPage, passing the ticket data in state
    navigate(`/tickets/edit/${selectedTicketToEdit._id}`, { state: { ticketDataForForm: selectedTicketToEdit } });
  };

  const handleTransfer = (ticketToTransfer) => { 
    navigate(`/tickets/transfer/${ticketToTransfer._id}`, { state: { ticketDataForTransfer: ticketToTransfer } });
  };

    // Prepare the Report button element to pass to Pagination
  const reportButtonElement = (authUser?.role === "admin" || authUser?.role === "super-admin") && (
    <Button
      variant="info"
      onClick={() => navigate("/tickets/report")} // Navigate to the report page
      disabled={isLoading}
      title="View Ticket Reports"
      size="sm" // To match items per page selector style
    >
      <FaChartBar className="me-1" /> Report
    </Button>
  );

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "Quotation Sent": return "info";
      case "PO Received": return "primary";
      case "Payment Pending": return "warning";
      case "Inspection": return "secondary";
      case "Packing List": return "dark";
      case "Invoice Sent": return "success";
      case "Hold": return "danger";
      case "Closed": return "success";
      default: return "dark";
    }
  };

  return (
    <div>
      <Navbar />
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap" style={{ gap: "1rem" }}>
          <h2 style={{ color: "black", margin: 0, whiteSpace: "nowrap" }}>Tickets Overview</h2>
          {/* Status Filter Dropdown */}
          <div className="filter-dropdown-group">
            <Form.Select
              aria-label="Status filter"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="form-select-sm"
              style={{ width: 'auto', minWidth: '200px' }}
            >
              {ticketStatusFilterOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Form.Select>
          </div>

          {/* Search Bar - takes available space */}
          <div className="d-flex align-items-center" style={{ minWidth: "200px", flexGrow: 1, maxWidth: "400px" }}>
            <SearchBar 
              value={searchTerm} 
              setSearchTerm={(value) => { setSearchTerm(value); setCurrentPage(1); }} 
              placeholder="Search tickets..." 
              className="w-100" />
          </div>
        </div>
        {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
        <ReusableTable
          columns={[
            { key: "ticketNumber", header: "Ticket Number", sortable: true },
            { key: "assignedTo", header: "Assigned To", renderCell: (ticket) => ticket.currentAssignee ? `${ticket.currentAssignee.firstname} ${ticket.currentAssignee.lastname}` : ticket.createdBy?.firstname ? `${ticket.createdBy.firstname} ${ticket.createdBy.lastname}` : "N/A" },
            { key: "companyName", header: "Company Name", sortable: true },
            { key: "createdAt", header: "Date", sortable: true, renderCell: (ticket) => new Date(ticket.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) },
            {
              key: "deadline",
              header: "Deadline",
              sortable: true,
              renderCell: (ticket) => {
                const overdue = isTicketOverdue(ticket);
                return ticket.deadline ? (<span className={overdue ? "text-danger fw-bold" : ""}>{new Date(ticket.deadline).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}{overdue && <Badge bg="danger" className="ms-2">Overdue</Badge>}</span>) : ("N/A");
              },
            },
            {
              key: "progress", header: "Progress",
              renderCell: (ticket) => {
                const currentStatusIndex = statusStages.indexOf(ticket.status);
                const progressPercentage = currentStatusIndex !== -1 ? Math.round(((currentStatusIndex + 1) / statusStages.length) * 100) : 0;
                return (
                  <>
                    <Badge bg={getStatusBadgeColor(ticket.status)} className="mb-1 d-block text-center">{ticket.status}</Badge>
                    <div className="d-flex flex-column clickable-progress" onClick={(e) => { e.stopPropagation(); handleProgressClick(ticket); }} style={{ cursor: "pointer" }} title="View Payment Details & History">
                      <ProgressBar now={progressPercentage} label={`${progressPercentage}%`} variant={getProgressBarVariant(progressPercentage)} style={{ height: "15px" }} />
                    </div>
                  </>
                );
              },
            },
          ]}
          data={currentItems} keyField="_id" isLoading={isLoading && currentItems.length === 0}
          error={error && currentItems.length === 0 ? error : null} onSort={requestSort} sortConfig={sortConfig}
          renderActions={(ticket) => {
            const canModifyTicket = authUser?.role === "admin" || authUser?.role === "super-admin" || (ticket.currentAssignee && ticket.currentAssignee._id === authUser?.id);
            const canTransferThisTicket = authUser?.role === "super-admin" || (ticket.currentAssignee && ticket.currentAssignee._id === authUser?.id);
            return (
              <ActionButtons
                item={ticket}
                onEdit={canModifyTicket ? handleEdit : undefined}
                onDelete={authUser?.role === "super-admin" ? handleDelete : undefined}
                onTransfer={canTransferThisTicket ? handleTransfer : undefined}
                isLoading={isLoading}
                disabled={{
                  edit: !canModifyTicket,
                  transfer: !canTransferThisTicket,
                }}
                size="sm"
              />
            );
          }}
          noDataMessage="No tickets found." tableClassName="mt-3" theadClassName="table-dark"
        />


        {filteredTickets.length > 0 && (
          <Pagination 
            currentPage={currentPage} 
            totalItems={filteredTickets.length} 
            itemsPerPage={itemsPerPage} 
            onPageChange={(page) => { 
              const currentTotalPages = Math.ceil(filteredTickets.length / itemsPerPage); 
              if (page >= 1 && page <= currentTotalPages) setCurrentPage(page); 
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

function getProgressBarVariant(percentage) {
  if (percentage < 30) return "danger";
  if (percentage < 70) return "warning";
  return "success";
}