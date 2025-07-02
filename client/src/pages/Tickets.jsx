import React, { useState, useEffect, useCallback } from "react";
import Pagination from "../components/Pagination";
import Footer from "../components/Footer";
import {
  Modal,
  Form,
  ProgressBar,
  Alert,
  Badge,
} from "react-bootstrap";
import { FaChartBar, FaFilePdf } from "react-icons/fa";
import Navbar from "../components/Navbar.jsx";
import { PDFViewer } from "@react-pdf/renderer";
import PIPDF from "../components/PIPDF.jsx";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { handleApiError } from "../utils/helpers";
import ReusableTable from "../components/ReusableTable.jsx";
import SearchBar from "../components/Searchbar.jsx";
import apiClient from "../utils/apiClient";
import "../css/Style.css";
import ActionButtons from "../components/ActionButtons.jsx";
import * as docx from "docx";
import { saveAs } from "file-saver";
import LoadingSpinner from "../components/LoadingSpinner.jsx"; // Import LoadingSpinner
import { generatePIDocx } from "../utils/generatePIDocx";
import { Button } from "react-bootstrap";
import { useCompanyInfo } from "../context/CompanyInfoContext.jsx"; // Import useCompanyInfo
import { getInitialTicketPayload, recalculateTicketTotals, mapQuotationToTicketPayload } from "../utils/payloads";

// UserSearchComponent remains as it might be used by other pages (e.g., TransferTicketPage)
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
    // Use setTimeout to allow click events to process before hiding dropdown
    setTimeout(() => {
      setShowDropdown(false);
    }, 200);
  };

  const handleFocus = () => {
    if (searchTerm.trim() !== "" && filteredUsers.length > 0) {
      setShowDropdown(true);
    }
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
          onFocus={handleFocus}
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
              onMouseDown={(e) => e.preventDefault()} // Prevent input blur on mouse down
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

export const PIActions = ({ ticket, onPreviewPI }) => {
  const handleDownloadWord = useCallback(async () => {
    let finalAmountForDoc = ticket.finalRoundedAmount;
    let roundOffForDoc = ticket.roundOff;

    if (finalAmountForDoc === undefined || finalAmountForDoc === null || roundOffForDoc === undefined) {
      const decimalPartForDoc = (ticket.grandTotal || 0) - Math.floor(ticket.grandTotal || 0);
      roundOffForDoc = 0;
      finalAmountForDoc = ticket.grandTotal || 0;
      if (decimalPartForDoc !== 0) {
        if (decimalPartForDoc < 0.50) {
          finalAmountForDoc = Math.floor(ticket.grandTotal || 0);
          roundOffForDoc = -decimalPartForDoc;
        } else {
          finalAmountForDoc = Math.ceil(ticket.grandTotal || 0);
          roundOffForDoc = 1 - decimalPartForDoc;
        }
      }
    }
    const ticketForDoc = { ...ticket, finalRoundedAmount: finalAmountForDoc, roundOff: roundOffForDoc };
    try {
      const doc = generatePIDocx(ticketForDoc);
      const blob = await docx.Packer.toBlob(doc);
      saveAs(blob, `PI_${ticketForDoc.ticketNumber || ticketForDoc.quotationNumber}.docx`);
    } catch (error) {
      console.error("Error generating PI Word document:", error);
      toast.error("Failed to generate PI Word document. Please try again.");
    }
  }, [ticket]);

  let finalAmountForPdfPreview = ticket.finalRoundedAmount;
  let roundOffForPdfPreview = ticket.roundOff;
  if (finalAmountForPdfPreview === undefined || finalAmountForPdfPreview === null || roundOffForPdfPreview === undefined) {
    const decimalPartForPdf = (ticket.grandTotal || 0) - Math.floor(ticket.grandTotal || 0);
    roundOffForPdfPreview = 0;
    finalAmountForPdfPreview = ticket.grandTotal || 0;
    if (decimalPartForPdf !== 0) {
      if (decimalPartForPdf < 0.50) {
        finalAmountForPdfPreview = Math.floor(ticket.grandTotal || 0);
        roundOffForPdfPreview = -decimalPartForPdf;
      } else {
        finalAmountForPdfPreview = Math.ceil(ticket.grandTotal || 0);
        roundOffForPdfPreview = 1 - decimalPartForPdf;
      }
    }
  }
  const ticketForPdfPreview = { ...ticket, finalRoundedAmount: finalAmountForPdfPreview, roundOff: roundOffForPdfPreview };

  return (
    <ActionButtons
      item={ticket}
      customActions={[
        { label: "Preview PI", handler: () => onPreviewPI(ticketForPdfPreview), icon: FaFilePdf, variant: "outline-info" }
      ]}
      onDownloadWord={handleDownloadWord}
      size="md"
    />
  );
};

export default function Dashboard() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tickets, setTickets] = useState([]);
  const [totalTickets, setTotalTickets] = useState(0);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "descending" });
  const [showPIPreviewModal, setShowPIPreviewModal] = useState(false);
  const [ticketForPIPreview, setTicketForPIPreview] = useState(null);
    const { companyInfo, isLoading: isCompanyInfoLoading, error: companyInfoError } = useCompanyInfo();

  const { user: authUser, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const statusStages = ["Quotation Sent", "PO Received", "Payment Pending", "Inspection", "Packing List", "Invoice Sent", "Hold", "Closed"];

  const isTicketOverdue = useCallback((ticket) => {
    if (!ticket.deadline || ticket.status === "Closed" || ticket.status === "Hold") {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(ticket.deadline) < today;
  }, []);

  const ticketStatusFilterOptions = [
    { value: "all", label: "Sort By Status" },
    { value: "open", label: "Open (Active)" }, // "Running" is covered by "Open (Active)"
    { value: "Closed", label: "Closed" }, // Ensure casing matches backend enum if specific
    { value: "Hold", label: "Hold" },
  ];

  const handleSort = useCallback((key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1); // Reset to first page on sort change
  }, [sortConfig]);

  const fetchTickets = useCallback(async (page = currentPage, limit = itemsPerPage) => {
    if (!authUser) return;
    setIsLoading(true); setError(null);
    try {
      const params = {
        page,
        limit,
        sortKey: sortConfig.key,
        sortDirection: sortConfig.direction,
        searchTerm,
        status: statusFilter === "all" ? undefined : statusFilter,
        populate: "client,currentAssignee,createdBy,transferHistory.from,transferHistory.to,transferHistory.transferredBy,statusHistory.changedBy,documents.quotation.uploadedBy,documents.po.uploadedBy,documents.pi.uploadedBy,documents.challan.uploadedBy,documents.packingList.uploadedBy,documents.feedback.uploadedBy,documents.other.uploadedBy"
              };
      if (params.status === undefined) {
        delete params.status;
      };
      const response = await apiClient("/tickets", { params });
      setTickets(response.data || []);
      setTotalTickets(response.totalItems || 0);
    } catch (error) {
      const errorMsg = handleApiError(error, "Failed to load tickets", authUser, "ticketActivity");
      setError(errorMsg); toast.error(errorMsg);
      setTickets([]); setTotalTickets(0);
      if (error.status === 401) { toast.error("Authentication failed."); navigate("/login", { state: { from: "/tickets" } }); }
    } finally { setIsLoading(false); }
  }, [authUser, navigate, sortConfig, searchTerm, statusFilter, currentPage, itemsPerPage]);

  useEffect(() => {
    if (!authLoading && !authUser && !isCompanyInfoLoading) {      if (window.location.pathname !== "/login") { toast.info("Redirecting to login."); navigate("/login", { state: { from: "/tickets" } }); }
    } else if (authUser) {
      fetchTickets(currentPage, itemsPerPage);
    }
  }, [authUser, authLoading, navigate, fetchTickets, currentPage, itemsPerPage]);

  // Reset to page 1 when filters or sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortConfig]);


  const handleDelete = useCallback(async (ticketToDelete) => {
    if (!authUser || authUser.role !== "super-admin") {
      const msg = "Permission denied to delete ticket."; setError(msg); toast.warn(msg);
      return;
    }
    if (window.confirm(`Delete ticket ${ticketToDelete.ticketNumber}?`)) {
      setIsLoading(true);
      try {
        await apiClient(`/tickets/admin/${ticketToDelete._id}`, { method: "DELETE" });
        // Intelligent refresh: if last item on a page (not first page), go to prev page.
        if (tickets.length === 1 && currentPage > 1) {
          setCurrentPage(prevPage => prevPage - 1); // This will trigger fetchTickets via useEffect
        } else {
          fetchTickets(currentPage, itemsPerPage); // Or fetch current page again
        }
        setError(null); const successMsg = `Ticket ${ticketToDelete.ticketNumber} deleted.`; toast.success(successMsg);
      } catch (error) {
        const errorMsg = handleApiError(error, "Delete failed", authUser, "ticketActivity");
        setError(errorMsg); toast.error(errorMsg);
      } finally { setIsLoading(false); }
    }
  }, [authUser, fetchTickets, tickets.length, currentPage, itemsPerPage]);

  const handleProgressClick = useCallback((ticket) => {
    navigate(`/tickets/details/${ticket._id}`, { state: { ticketData: ticket } });
  }, [navigate]);

  const handleItemsPerPageChange = (newItemsPerPage) => { setItemsPerPage(newItemsPerPage); setCurrentPage(1); };

  const handleEdit = useCallback((selectedTicketToEdit) => {
    navigate(`/tickets/edit/${selectedTicketToEdit._id}`, { state: { ticketDataForForm: selectedTicketToEdit } });
  }, [navigate]);

  const handleTransfer = useCallback((ticketToTransfer) => {
    navigate(`/tickets/transfer/${ticketToTransfer._id}`, { state: { ticketDataForTransfer: ticketToTransfer } });
  }, [navigate]);

  const handlePreviewPIFromList = useCallback((ticketWithRounding) => {
    setTicketForPIPreview(ticketWithRounding);
    setShowPIPreviewModal(true);
  }, []);

  const reportButtonElement = (authUser?.role === "admin" || authUser?.role === "super-admin") && (
    <Button
      variant="info"
      onClick={() => navigate("/tickets/report")}
      disabled={isLoading}
      title="View Ticket Reports"
      size="sm"
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

  const getProgressBarVariant = (percentage) => {
    if (percentage < 30) return "danger";
    if (percentage < 70) return "warning";
    return "success";
  };

  return (
    <div>
      <Navbar />
      <LoadingSpinner show={isLoading || authLoading || isCompanyInfoLoading} />   <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap" style={{ gap: "1rem" }}>
          <h2 style={{ color: "black", margin: 0, whiteSpace: "nowrap" }}>Tickets Overview</h2>
          <div className="filter-dropdown-group">
            <Form.Select
              aria-label="Status filter"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); }} // setCurrentPage(1) handled by useEffect
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
          <div className="d-flex align-items-center" style={{ minWidth: "200px", flexGrow: 1, maxWidth: "400px" }}>
            <SearchBar
              value={searchTerm}
              setSearchTerm={(value) => { setSearchTerm(value); }} // setCurrentPage(1) handled by useEffect
              placeholder="Search tickets..."
              className="w-100" />
          </div>
        </div>
        {!isLoading && !authLoading && (error || companyInfoError) && (
          <Alert variant="danger" onClose={() => setError(null)} dismissible>
            {error || companyInfoError}
          </Alert>
        )}        
        {!isLoading && !authLoading && !error && (
          <ReusableTable
            columns={[
              { key: "ticketNumber", header: "Ticket Number", sortable: true },
              { key: "assignedTo", header: "Assigned To", sortable: true, renderCell: (ticket) => ticket.currentAssignee ? `${ticket.currentAssignee.firstname} ${ticket.currentAssignee.lastname}` : ticket.createdBy?.firstname ? `${ticket.createdBy.firstname} ${ticket.createdBy.lastname}` : "N/A" },
              { key: "companyName", header: "Company Name", sortable: true },
              // { key: "createdAt", header: "Date", sortable: true, renderCell: (ticket) => new Date(ticket.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) },
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
                tooltip: "Meaning of colour:\nSky Blue - Quotation Sent \nDark Blue - PO Received \nYellow - Payment \nSlate Grey - Inspection \nBlack - Packing \nLight Green - Invoice \nRed - Hold \nDark Blue - Closed",
              },
            ]}
            data={tickets} keyField="_id" 
            // isLoading prop for ReusableTable can be for its internal "empty but loading" state
            // The main LoadingSpinner will cover the page if isLoading or authLoading is true.
            isLoading={ (isLoading || authLoading) && tickets.length === 0} 
            error={error && tickets.length === 0 ? error : null} 
            onSort={handleSort} sortConfig={sortConfig}
            renderActions={(ticket) => {
              const canModifyTicket = authUser?.role === "admin" || authUser?.role === "super-admin" || (ticket.currentAssignee && ticket.currentAssignee._id === authUser?.id);
              const canTransferThisTicket = authUser?.role === "super-admin" || (ticket.currentAssignee && ticket.currentAssignee._id === authUser?.id);
              return (
                <ActionButtons
                  item={ticket}
                  onEdit={canModifyTicket ? handleEdit : undefined}
                  onDelete={authUser?.role === "super-admin" ? handleDelete : undefined}
                  customPIActions={<PIActions ticket={ticket} onPreviewPI={handlePreviewPIFromList} />}
                  onTransfer={canTransferThisTicket ? handleTransfer : undefined}
                  isLoading={isLoading || authLoading}
                  disabled={{
                    edit: !canModifyTicket || isLoading || authLoading,
                    transfer: !canTransferThisTicket || isLoading || authLoading,
                  }}
                  size="sm"
                />
              );
            }}
            noDataMessage="No tickets found." tableClassName="mt-3" theadClassName="table-dark"
          />
        )}

        {totalTickets > 0 && !isLoading && !authLoading && (
          <Pagination
            currentPage={currentPage}
            totalItems={totalTickets}
            itemsPerPage={itemsPerPage}
            onPageChange={(page) => {
              const currentTotalPages = Math.ceil(totalTickets / itemsPerPage);
              if (page >= 1 && page <= currentTotalPages) setCurrentPage(page);
            }}
            onItemsPerPageChange={handleItemsPerPageChange}
            reportButton={reportButtonElement}
          />
        )}
      </div>
      {showPIPreviewModal && ticketForPIPreview && companyInfo && (
        <Modal show={showPIPreviewModal} onHide={() => setShowPIPreviewModal(false)} size="xl" centered>
          <Modal.Header closeButton style={{ backgroundColor: "maroon", color: "white" }}>
            <Modal.Title>PI Preview - {ticketForPIPreview.ticketNumber || ticketForPIPreview.quotationNumber}</Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ height: '80vh', overflowY: 'auto' }}>
            {/* Ensure ticketForPIPreview is available before rendering PDFViewer */}
            {ticketForPIPreview ? (
              <PDFViewer width="100%" height="99%">
                {/* Pass the full ticket object as ticketData */}
                <PIPDF ticketData={ticketForPIPreview} />
              </PDFViewer>
            ) : (
              <div style={{textAlign: "center", marginTop: 50}}><p>Preparing PI data...</p></div> 
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowPIPreviewModal(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>
      )}
      <Footer />
    </div>
  );
}