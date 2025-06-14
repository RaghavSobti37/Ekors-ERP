import React, { useState, useEffect, useMemo, useCallback } from "react";
import Pagination from "../components/Pagination";
import Footer from "../components/Footer";
import {
  Modal,
  Button,
  Form,
  Table,
  ProgressBar,
  Alert,
  Dropdown,
  Badge,
  Card,
  Row,
  Col,
} from "react-bootstrap";
import { FaChartBar } from "react-icons/fa"; // Import icon for report button
import Navbar from "../components/Navbar.jsx"; // Navigation bar component
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer";
// import SortIndicator from "../components/SortIndicator.jsx"; // Not directly used, ReusableTable might
import QuotationPDF from "../components/QuotationPDF.jsx"; // Component for rendering Quotation PDF
import PIPDF from "../components/PIPDF.jsx"; // Component for rendering PI PDF
import { useAuth } from "../context/AuthContext"; // Authentication context
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify"; // Library for toast notifications, ToastContainer removed
import "react-toastify/dist/ReactToastify.css";
import { handleApiError, showToast } from "../utils/helpers"; // Utility functions
import frontendLogger from "../utils/frontendLogger.js"; // Utility for frontend logging
import { getAuthToken as getAuthTokenUtil } from "../utils/authUtils"; // Utility for retrieving auth token
import ReusableTable from "../components/ReusableTable.jsx"; // Component for displaying data in a table
import SearchBar from "../components/Searchbar.jsx"; // Import the new SearchBar
import ItemSearchComponent from "../components/ItemSearch.jsx";
import apiClient from "../utils/apiClient"; // Utility for making API requests
import "../css/Style.css"; // General styles
import ReusableModal from "../components/ReusableModal.jsx";
import TicketReportModal from "../components/TicketReportModal.jsx"; 
import ActionButtons from "../components/ActionButtons.jsx";
import * as docx from "docx";
import { saveAs } from "file-saver";
import { generatePIDocx } from "../utils/generatePIDocx";
import axios from "axios"; // For pincode API in edit modal

// Define COMPANY_REFERENCE_STATE at a scope accessible by tax calculation logic
const COMPANY_REFERENCE_STATE = "UTTAR PRADESH";


const UserSearchComponent = ({ onUserSelect, authContext }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null); // Local error

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // const token = getAuthTokenUtil(); // No need to pass authContext.user if getAuthTokenUtil doesn't use it
      // if (!token) {
      //   throw new Error("Authentication token not found for fetching users.");
      // }

      const data = await apiClient("/tickets/transfer-candidates"); // Use apiClient
      setUsers(data);
    } catch (err) {
      let specificMessage =
        "An unexpected error occurred while trying to load users for search."; // Default generic message
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
      const doc = generatePIDocx(ticket); // We'll create this utility
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
      item={ticket} // Pass the ticket item
      pdfProps={pdfButtonProps}
      onDownloadWord={handleDownloadWord}
      size="md" // Standard modal button size
    />

  );
};


export default function Dashboard() {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editTicket, setEditTicket] = useState(null); // Stores the full ticket object being edited
  const [transferTicket, setTransferTicket] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null); // For payment modal
  const [selectedUser, setSelectedUser] = useState(null); // For transfer modal
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [showTicketReportModal, setShowTicketReportModal] = useState(false);
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [pdfPreviewConfig, setPdfPreviewConfig] = useState({ type: null, data: null });
  const [uploadingDocType, setUploadingDocType] = useState(null);
  const [statusChangeComment, setStatusChangeComment] = useState("");
  const { user: authUser, loading: authLoading } = useAuth();
  const auth = useAuth();
  const navigate = useNavigate();
  const [paymentReference, setPaymentReference] = useState("");
  // ticketData state for the edit modal
  const [ticketData, setTicketData] = useState({
    companyName: "", quotationNumber: "",
    billingAddress: { address1: "", address2: "", city: "", state: "", pincode: "" }, // Object form for edit modal
    shippingAddress: { address1: "", address2: "", city: "", state: "", pincode: "" }, // Object form for edit modal
    shippingSameAsBilling: false,
    goods: [], totalQuantity: 0, totalAmount: 0, // Pre-GST total
    // New GST fields
    gstBreakdown: [], totalCgstAmount: 0, totalSgstAmount: 0, totalIgstAmount: 0,
    deadline: null, // Added deadline field
    finalGstAmount: 0, grandTotal: 0, isBillingStateSameAsCompany: false,
    status: "Quotation Sent",
    documents: { quotation: null, po: null, pi: null, challan: null, packingList: null, feedback: null, other: [] },
    dispatchDays: "7-10 working", validityDate: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString(),
    clientPhone: "", clientGstNumber: "",
    termsAndConditions: "1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged if payment is not made within the stipulated time.\n3. Subject to Noida jurisdiction.",
  });
  const [sortConfig, setSortConfig] = useState({ key: "createdAt", direction: "descending" });
  const [isItemSearchDropdownOpenInEditModal, setIsItemSearchDropdownOpenInEditModal] = useState(false);
  const [transferHistoryDisplay, setTransferHistoryDisplay] = useState([]);
  const [isFetchingAddressInEdit, setIsFetchingAddressInEdit] = useState(false);

  // Helper function to check if a ticket is overdue
  const isTicketOverdue = (ticket) => {
    if (!ticket.deadline || ticket.status === "Closed" || ticket.status === "Hold") {
      return false;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Compare dates only
    return new Date(ticket.deadline) < today;
  };


  const statusStages = ["Quotation Sent", "PO Received", "Payment Pending", "Inspection", "Packing List", "Invoice Sent", "Hold", "Closed"];

  const calculateTaxesForEditModal = useCallback(() => {
    if (!ticketData.goods || !ticketData.billingAddress || !ticketData.billingAddress.state) {
        setTicketData(prev => ({
            ...prev, gstBreakdown: [], totalCgstAmount: 0, totalSgstAmount: 0, totalIgstAmount: 0,
            finalGstAmount: 0, grandTotal: prev.totalAmount || 0, isBillingStateSameAsCompany: false,
        }));
        return;
    }

    const billingState = (ticketData.billingAddress.state || "").toUpperCase().trim();
    const isBillingStateSameAsCompany = billingState === COMPANY_REFERENCE_STATE.toUpperCase().trim();
    const gstGroups = {};

    (ticketData.goods || []).forEach(item => {
        const itemGstRate = parseFloat(item.gstRate); // gstRate is expected on each item
        if (!isNaN(itemGstRate) && itemGstRate >= 0 && item.amount > 0) {
            if (!gstGroups[itemGstRate]) gstGroups[itemGstRate] = { taxableAmount: 0 };
            gstGroups[itemGstRate].taxableAmount += (item.amount || 0);
        }
    });

    const newGstBreakdown = [];
    let runningTotalCgst = 0, runningTotalSgst = 0, runningTotalIgst = 0;

    for (const rateKey in gstGroups) {
        const group = gstGroups[rateKey];
        const itemGstRate = parseFloat(rateKey);
        if (isNaN(itemGstRate) || itemGstRate < 0) continue;

        const taxableAmount = group.taxableAmount;
        let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
        let cgstRate = 0, sgstRate = 0, igstRate = 0;

        if (itemGstRate > 0) {
            if (isBillingStateSameAsCompany) {
                cgstRate = itemGstRate / 2; sgstRate = itemGstRate / 2;
                cgstAmount = (taxableAmount * cgstRate) / 100; sgstAmount = (taxableAmount * sgstRate) / 100;
                runningTotalCgst += cgstAmount; runningTotalSgst += sgstAmount;
            } else {
                igstRate = itemGstRate;
                igstAmount = (taxableAmount * igstRate) / 100;
                runningTotalIgst += igstAmount;
            }
        }
        newGstBreakdown.push({ itemGstRate, taxableAmount, cgstRate, cgstAmount, sgstRate, sgstAmount, igstRate, igstAmount });
    }

    const finalGstAmount = runningTotalCgst + runningTotalSgst + runningTotalIgst;
    const currentTotalAmount = ticketData.totalAmount || 0;
    const grandTotal = currentTotalAmount + finalGstAmount;

    setTicketData(prev => ({
        ...prev, gstBreakdown: newGstBreakdown, totalCgstAmount: runningTotalCgst,
        totalSgstAmount: runningTotalSgst, totalIgstAmount: runningTotalIgst,
        finalGstAmount, grandTotal, isBillingStateSameAsCompany,
    }));
  }, [ticketData.goods, ticketData.billingAddress.state, ticketData.totalAmount, setTicketData]); // Added .state dependency

  // Recalculate taxes in edit modal when relevant fields change
  useEffect(() => {
    if (showEditModal) { // Only calculate if the edit modal is open
        calculateTaxesForEditModal();
    }
  }, [showEditModal, ticketData.goods, ticketData.billingAddress.state, ticketData.totalAmount, calculateTaxesForEditModal]);


  const fetchTickets = useCallback(async () => {
    if (!authUser) return;
    setIsLoading(true); setError(null);
    try {
      // const token = getAuthTokenUtil(); // No need to pass auth.user if getAuthTokenUtil doesn't use it
      // if (!token) {
      //   toast.error("Authentication required to fetch tickets. Please log in.");
      //   throw new Error("No authentication token found");
      // }
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

  useEffect(() => {
    const activeDetailedTicket = showEditModal ? editTicket : showPaymentModal ? selectedTicket : null;
    if (activeDetailedTicket) {
      const history = [];
      let firstAssignee = activeDetailedTicket.createdBy;
      if (activeDetailedTicket.transferHistory && activeDetailedTicket.transferHistory.length > 0) {
        firstAssignee = activeDetailedTicket.transferHistory[0].from || activeDetailedTicket.createdBy;
      } else if (activeDetailedTicket.currentAssignee) {
        firstAssignee = activeDetailedTicket.currentAssignee;
      }
      history.push({ name: firstAssignee ? `${firstAssignee.firstname} ${firstAssignee.lastname}` : "System/N/A", date: activeDetailedTicket.createdAt, note: "Ticket Created" });
      activeDetailedTicket.transferHistory?.forEach((transfer) => {
        history.push({ name: transfer.to ? `${transfer.to.firstname} ${transfer.to.lastname}` : "N/A", date: transfer.transferredAt || new Date(), note: transfer.note || "N/A" });
      });
      setTransferHistoryDisplay(history);
    }
  }, [editTicket, selectedTicket, showEditModal, showPaymentModal]);

  const handleDelete = async (ticketToDelete) => {
    if (!authUser || authUser.role !== "super-admin") {
      const msg = "Permission denied to delete ticket."; setError(msg); toast.warn(msg);
      frontendLogger.warn("ticketActivity", "Delete permission denied", auth.user, { ticketId: ticketToDelete?._id, action: "DELETE_TICKET_PERMISSION_DENIED" });
      return;
    }
    if (window.confirm(`Delete ticket ${ticketToDelete.ticketNumber}?`)) {
      setIsLoading(true);
      try {
        // const token = getAuthTokenUtil();
        // if (!token) {
        //   toast.error("Authentication required for delete operation.");
        //   throw new Error("Authentication token not found for delete operation.");
        // }
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
    setSelectedTicket(ticket);
    setPaymentAmount(ticket.grandTotal - (ticket.payments?.reduce((sum, p) => sum + p.amount, 0) || 0));
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async () => {
    setIsLoading(true); setError(null);
    try {
      // const token = getAuthTokenUtil();
      // if (!token) {
      //   toast.error("Authentication required to record payment.");
      //   throw new Error("No authentication token found");
      // }
      const responseData = await apiClient(`/tickets/${selectedTicket?._id}/payments`, {
        method: "POST", body: { amount: paymentAmount, date: paymentDate, reference: paymentReference },
      });
      if (responseData) {
        await fetchTickets(); setShowPaymentModal(false); const successMsg = "Payment recorded!"; toast.success(successMsg);
        frontendLogger.info("paymentActivity", successMsg, auth.user, { ticketId: selectedTicket?._id, amount: paymentAmount, action: "RECORD_PAYMENT_SUCCESS" });
        setPaymentAmount(0); setPaymentReference("");
      }
    } catch (error) {
      const errorMsg = handleApiError(error, "Failed to record payment", auth.user, "paymentActivity");
      setError(errorMsg); toast.error(errorMsg);
      frontendLogger.error("paymentActivity", "Failed to record payment", auth.user, { ticketId: selectedTicket?._id, amount: paymentAmount, action: "RECORD_PAYMENT_FAILURE" });
    } finally { setIsLoading(false); }
  };

  const sortedTickets = useMemo(() => {
    if (!sortConfig.key) return tickets;
    return [...tickets].sort((a, b) => {
      const aOverdue = isTicketOverdue(a);
      const bOverdue = isTicketOverdue(b);

      if (aOverdue && !bOverdue) return -1; // a (overdue) comes first
      if (!aOverdue && bOverdue) return 1;  // b (overdue) comes first

      // If both are overdue or both not overdue, then apply user's sortConfig
      if (sortConfig.key === "createdAt" || sortConfig.key === "deadline") {
        const valA = a[sortConfig.key] ? new Date(a[sortConfig.key]) : null;
        const valB = b[sortConfig.key] ? new Date(b[sortConfig.key]) : null;
        if (!valA && valB) return sortConfig.direction === "ascending" ? 1 : -1; // Sort nulls to the end
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

  const updateTotalsAndRecalculateTaxesInEditModal = (goods) => {
    const totalQuantity = goods.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalAmount = goods.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    setTicketData(prev => ({ ...prev, goods, totalQuantity, totalAmount }));
    // calculateTaxesForEditModal will be called by its own useEffect dependency
  };

  const validateItemPrice = (item) => {
    const newPrice = parseFloat(item.price);
    const originalPrice = parseFloat(item.originalPrice || item.price); // Fallback to current price if originalPrice is not set
    const maxDiscountPerc = parseFloat(item.maxDiscountPercentage);
    let priceValidationError = null;

    if (!isNaN(newPrice) && !isNaN(originalPrice)) {
        if (!isNaN(maxDiscountPerc) && maxDiscountPerc > 0) {
            const minAllowedPrice = originalPrice * (1 - maxDiscountPerc / 100);
            if (newPrice < minAllowedPrice) {
                priceValidationError = `Warning: Discount for ${item.description} exceeds ${maxDiscountPerc}%. Min price is ₹${minAllowedPrice.toFixed(2)}. You can still save.`;
            }
        } else { // No discount applicable or maxDiscountPercentage is 0
            if (newPrice < originalPrice) {
                // priceValidationError = `Price for ${item.description} (₹${newPrice.toFixed(2)}) cannot be lower than the original price (₹${originalPrice.toFixed(2)}) as no discount is applicable.`;
                // Allow price to be lower than original if no discount % is set, but log it or handle as per business rule.
                // For now, let's not throw an error here, but you might want to.
            }
        }
    } else if (String(item.price).trim() !== "" && isNaN(newPrice)) {
        priceValidationError = `Error: Invalid price entered for ${item.description}.`; // This could still be a blocking error
    }

    if (priceValidationError) {
        setError(priceValidationError);
        toast.warn(priceValidationError);
        // return false; // Do not return false for warnings, allow saving
    } else {
        // Clear error only if it was related to this specific item's price validation
        if (error && (error.includes(`Discount for ${item.description}`) || error.includes(`Price for ${item.description}`))) {
            setError(null);
        }
        return true;
    }
    return true; // Always return true so save is not blocked by this validation
};


  const handleAddItemToTicket = (item) => {
    const newGoods = [
      ...ticketData.goods,
      {
        srNo: ticketData.goods.length + 1, description: item.name, hsnSacCode: item.hsnCode || "",
        quantity: 1, unit: item.unit || "Nos", price: Number(item.sellingPrice) || 0,
        amount: (Number(item.sellingPrice) || 0) * 1, originalPrice: Number(item.sellingPrice) || 0,
        maxDiscountPercentage: Number(item.maxDiscountPercentage) || 0,
        gstRate: parseFloat(item.gstRate || 0),
        subtexts: [],
      },
    ];
    updateTotalsAndRecalculateTaxesInEditModal(newGoods);
  };

  const handleEdit = (selectedTicketToEdit) => {
    setEditTicket(selectedTicketToEdit);
    const billingAddressObj = Array.isArray(selectedTicketToEdit.billingAddress) && selectedTicketToEdit.billingAddress.length === 5
      ? { address1: selectedTicketToEdit.billingAddress[0] || "", address2: selectedTicketToEdit.billingAddress[1] || "", state: selectedTicketToEdit.billingAddress[2] || "", city: selectedTicketToEdit.billingAddress[3] || "", pincode: selectedTicketToEdit.billingAddress[4] || "" }
      : (typeof selectedTicketToEdit.billingAddress === 'object' && selectedTicketToEdit.billingAddress !== null)
        ? selectedTicketToEdit.billingAddress
        : { address1: "", address2: "", city: "", state: "", pincode: "" };

    const shippingAddressObj = Array.isArray(selectedTicketToEdit.shippingAddress) && selectedTicketToEdit.shippingAddress.length === 5
      ? { address1: selectedTicketToEdit.shippingAddress[0] || "", address2: selectedTicketToEdit.shippingAddress[1] || "", state: selectedTicketToEdit.shippingAddress[2] || "", city: selectedTicketToEdit.shippingAddress[3] || "", pincode: selectedTicketToEdit.shippingAddress[4] || "" }
      : (typeof selectedTicketToEdit.shippingAddress === 'object' && selectedTicketToEdit.shippingAddress !== null)
        ? selectedTicketToEdit.shippingAddress
        : { address1: "", address2: "", city: "", state: "", pincode: "" };

    setTicketData({
      companyName: selectedTicketToEdit.companyName || "",
      quotationNumber: selectedTicketToEdit.quotationNumber || "",
      billingAddress: billingAddressObj,
      shippingAddress: shippingAddressObj,
      shippingSameAsBilling: selectedTicketToEdit.shippingSameAsBilling || false,
      goods: (selectedTicketToEdit.goods || []).map(g => ({
        ...g, originalPrice: g.originalPrice || g.price,
        maxDiscountPercentage: Number(g.maxDiscountPercentage || 0),
        gstRate: parseFloat(g.gstRate || 0),
        subtexts: g.subtexts || [],
      })),
      totalQuantity: selectedTicketToEdit.totalQuantity || 0,
      totalAmount: selectedTicketToEdit.totalAmount || 0,
      gstBreakdown: selectedTicketToEdit.gstBreakdown || [],
      totalCgstAmount: selectedTicketToEdit.totalCgstAmount || 0,
      totalSgstAmount: selectedTicketToEdit.totalSgstAmount || 0,
      totalIgstAmount: selectedTicketToEdit.totalIgstAmount || 0,
      finalGstAmount: selectedTicketToEdit.finalGstAmount || 0,
      deadline: selectedTicketToEdit.deadline ? new Date(selectedTicketToEdit.deadline).toISOString().split('T')[0] : null,
      grandTotal: selectedTicketToEdit.grandTotal || 0,
      isBillingStateSameAsCompany: selectedTicketToEdit.isBillingStateSameAsCompany || false,
      status: selectedTicketToEdit.status || statusStages[0],
      documents: selectedTicketToEdit.documents || ticketData.documents,
      dispatchDays: selectedTicketToEdit.dispatchDays || "7-10 working",
  validityDate: selectedTicketToEdit.validityDate ? new Date(selectedTicketToEdit.validityDate).toISOString().split('T')[0] : new Date(new Date().setDate(new Date().getDate() + 15)).toISOString().split('T')[0],      clientPhone: selectedTicketToEdit.clientPhone || "",
      clientGstNumber: selectedTicketToEdit.clientGstNumber || "",
      termsAndConditions: selectedTicketToEdit.termsAndConditions || ticketData.termsAndConditions,
    });
    setShowEditModal(true); setError(null);
  };

  const handleDeleteItemFromTicket = (indexToDelete) => {
    const updatedGoods = ticketData.goods.filter((_, index) => index !== indexToDelete)
      .map((item, index) => ({ ...item, srNo: index + 1 }));
    updateTotalsAndRecalculateTaxesInEditModal(updatedGoods);
  };

  const handleAddSubtextToTicketItem = (itemIndex) => {
    const updatedGoods = [...ticketData.goods];
    if (!updatedGoods[itemIndex].subtexts) updatedGoods[itemIndex].subtexts = [];
    updatedGoods[itemIndex].subtexts.push("");
    setTicketData((prevData) => ({ ...prevData, goods: updatedGoods }));
  };

  const handleDeleteSubtextFromTicketItem = (itemIndex, subtextIndexToDelete) => {
    const updatedGoods = [...ticketData.goods];
    updatedGoods[itemIndex].subtexts.splice(subtextIndexToDelete, 1);
    setTicketData((prevData) => ({ ...prevData, goods: updatedGoods }));
  };

  const handleTicketGoodsChange = (index, field, value, subtextIndex = null) => {
    const updatedGoods = [...ticketData.goods];
    if (field === "subtexts" && subtextIndex !== null) {
      if (!updatedGoods[index].subtexts) updatedGoods[index].subtexts = [];
      updatedGoods[index].subtexts[subtextIndex] = value;
    } else if (field === "gstRate") {
        updatedGoods[index][field] = value === "" ? null : parseFloat(value);
    } else {
      updatedGoods[index][field] = (["quantity", "price"].includes(field)) ? Number(value) : value;
    }
    if (field === "quantity" || field === "price") {
      updatedGoods[index].amount = (Number(updatedGoods[index].quantity) || 0) * (Number(updatedGoods[index].price) || 0);
    }
    updateTotalsAndRecalculateTaxesInEditModal(updatedGoods);
  };

  const handleTransfer = (ticketToTransfer) => { setTransferTicket(ticketToTransfer); setSelectedUser(null); setError(null); setShowTransferModal(true); };
  const handleUserSelect = (user) => { setSelectedUser(user); setError(null); };
  const handleStatusChange = (status) => {
    setTicketData({ ...ticketData, status });
    if (editTicket && status !== editTicket.status) setStatusChangeComment("");
  };

  const handleUpdateTicket = async () => {
    setIsLoading(true); setError(null);
    try {
      // Validate item prices and show warnings, but don't block
      let hasHardPriceError = false;
      for (const item of ticketData.goods) {
        validateItemPrice(item); // This will now show warnings but return true
        // You might add a check here if validateItemPrice could distinguish between warnings and hard errors
      }
      if (error && error.includes("exceeds the maximum allowed")) setError(null);
      if (editTicket && ticketData.status !== editTicket.status && !statusChangeComment.trim()) {
        toast.warn("Comment for status change is required."); setIsLoading(false); return;
      }

      // const token = getAuthTokenUtil();
      // if (!token) {
      //   toast.error("Authentication required to update ticket.");
      //   throw new Error("Authentication token not found");
      // }

      const updatePayload = {
        ...ticketData,
        deadline: ticketData.deadline ? new Date(ticketData.deadline).toISOString() : null,
        statusChangeComment: ticketData.status !== editTicket?.status ? statusChangeComment : undefined,
        billingAddress: [
          ticketData.billingAddress.address1 || "", ticketData.billingAddress.address2 || "",
          ticketData.billingAddress.state || "", ticketData.billingAddress.city || "",
          ticketData.billingAddress.pincode || ""
        ],
        shippingAddress: ticketData.shippingSameAsBilling
          ? [ ticketData.billingAddress.address1 || "", ticketData.billingAddress.address2 || "",
              ticketData.billingAddress.state || "", ticketData.billingAddress.city || "",
              ticketData.billingAddress.pincode || "" ]
          : [ ticketData.shippingAddress.address1 || "", ticketData.shippingAddress.address2 || "",
              ticketData.shippingAddress.state || "", ticketData.shippingAddress.city || "",
              ticketData.shippingAddress.pincode || "" ],
        goods: ticketData.goods.map(g => ({
          ...g, gstRate: parseFloat(g.gstRate || 0),
          originalPrice: g.originalPrice, maxDiscountPercentage: Number(g.maxDiscountPercentage || 0),
          subtexts: g.subtexts || [],
        })),
      };
      delete updatePayload._id; delete updatePayload.__v; delete updatePayload.createdAt; delete updatePayload.updatedAt;

      const responseData = await apiClient(`/tickets/${editTicket._id}`, { method: "PUT", body: updatePayload });
      if (responseData) {
        fetchTickets(); setShowEditModal(false); setError(null);
        const successMsg = `Ticket ${editTicket.ticketNumber} updated!`; toast.success(successMsg);
        frontendLogger.info("ticketActivity", successMsg, auth.user, { ticketId: editTicket._id, action: "UPDATE_TICKET_SUCCESS" });
      }
    } catch (error) {
      const errorMsg = handleApiError(error, "Failed to update ticket", auth.user, "ticketActivity");
      setError(errorMsg); toast.error(errorMsg);
      frontendLogger.error("ticketActivity", `Failed to update ticket ${editTicket?.ticketNumber}`, auth.user, { ticketId: editTicket?._id, action: "UPDATE_TICKET_FAILURE" });
    } finally { setIsLoading(false); }
  };

  const handleTransferTicket = async (userToTransferTo, note) => {
    if (!userToTransferTo) { setError("Select user to transfer to."); toast.warn("Select user."); return; }
    setIsLoading(true); setError(null);
    try {
      // const token = getAuthTokenUtil();
      // if (!token) {
      //   toast.error("Authentication required to transfer ticket.");
      //   throw new Error("Authentication token not found");
      // }
      const responseData = await apiClient(`/tickets/${transferTicket._id}/transfer`, {
        method: "POST", body: { userId: userToTransferTo._id, note },
      });
      if (responseData && responseData.ticket) {
        const updatedTicketFromServer = responseData.ticket;
        setTickets((prevTickets) => prevTickets.map((t) => t._id === updatedTicketFromServer._id ? updatedTicketFromServer : t));
        setTransferTicket(updatedTicketFromServer); setError(null); setShowTransferModal(false);
        const successMsg = `Ticket transferred to ${updatedTicketFromServer.currentAssignee.firstname}`; toast.success(successMsg);
        frontendLogger.info("ticketActivity", successMsg, auth.user, { ticketId: transferTicket._id, transferredTo: userToTransferTo._id, action: "TRANSFER_TICKET_SUCCESS" });
      }
    } catch (error) {
      let detailedErrorMessage = error.data?.details || error.data?.message || error.message || "Unexpected error during transfer.";
      const errorMsg = `Failed to transfer ticket: ${detailedErrorMessage}`; setError(errorMsg); toast.error(errorMsg);
      frontendLogger.error("ticketActivity", `Failed to transfer ticket ${transferTicket?._id}`, auth.user, { ticketId: transferTicket?._id, action: "TRANSFER_TICKET_FAILURE" });
    } finally { setIsLoading(false); }
  };

  const renderPdfPreview = (previewType, ticketForPdf) => {
    if (!previewType || !ticketForPdf) return null;

    let pdfDataToUse = null;

    if (previewType === "quotation") {
        // Map ticket data to what QuotationPDF expects
        pdfDataToUse = {
            referenceNumber: ticketForPdf.quotationNumber,
            date: ticketForPdf.createdAt, // Or a specific quotation date if available on ticket
            client: {
                companyName: ticketForPdf.companyName || "N/A",
                gstNumber: ticketForPdf.clientGstNumber || "N/A",
                phone: ticketForPdf.clientPhone || "N/A",
                // siteLocation: "N/A" // QuotationPDF expects this, but not on ticket
            },
            goods: (ticketForPdf.goods || []).map(item => ({
                ...item,
                unit: item.unit || "Nos", // Ensure unit is present
                // QuotationPDF doesn't use gstRate directly in item display but has a general GST term
            })),
            totalAmount: ticketForPdf.totalAmount, // Pre-GST total
            dispatchDays: ticketForPdf.dispatchDays || "7-10 working",
            validityDate: ticketForPdf.validityDate || new Date(new Date().setDate(new Date().getDate() + 15)).toISOString(),
            // Other fields QuotationPDF might expect, like terms, might need to be hardcoded or mapped
        };
    } else if (previewType === "pi") {
        // PIPDF expects a ticket object directly. Ensure addresses are arrays.
        // The selectedTicket/editTicket should already have addresses as arrays from backend.
        pdfDataToUse = { ...ticketForPdf };
    }


    if (!pdfDataToUse) return <Alert variant="warning">Could not load data for PDF preview.</Alert>;

    return (
        <div className="mt-4 p-3 border rounded bg-light">
            <h5 className="mb-3">
                <i className={`bi ${previewType === "quotation" ? "bi-file-earmark-text" : "bi-file-earmark-medical"}`}></i>{" "}
                {previewType.toUpperCase()} Preview
            </h5>
            <div className="document-preview-container" style={{ height: '70vh', overflowY: 'auto' }}>
                <PDFViewer width="100%" height="100%" className="mb-3">
                    {previewType === "quotation" ? (
                        <QuotationPDF quotation={pdfDataToUse} />
                    ) : (
                        <PIPDF ticket={pdfDataToUse} />
                    )}
                </PDFViewer>
            </div>
             {/* Actions are now part of ReusableModal footer for PI */}
        </div>
    );
  };

  const handleSpecificDocumentUpload = async (file, docType, ticketIdForUpload = null) => {
    if (!file) { toast.warn("Please select a file to upload"); return false; }
    if (file.size > 5 * 1024 * 1024) { toast.warn("File size should be less than 5MB"); return false; }

    const targetTicketId = ticketIdForUpload || editTicket?._id || selectedTicket?._id;
    if (!targetTicketId) { toast.error("Target ticket ID not found."); return false; }


    setIsLoading(true); setError(null);
    try {
      // const token = getAuthTokenUtil();
      // if (!token) {
      //   toast.error("Authentication required to upload document.");
      //   throw new Error("Authentication token not found");
      // }
      const formData = new FormData();
      formData.append("document", file);
      formData.append("documentType", docType);

      const responseData = await apiClient(`/tickets/${targetTicketId}/documents`, { method: "POST", body: formData }); // apiClient handles FormData
      if (!responseData || !responseData.documents) { throw new Error("Invalid response from server after document upload"); }

      await fetchTickets();
      if (showPaymentModal && selectedTicket && selectedTicket?._id === targetTicketId) {
        const updatedSingleTicket = await apiClient(`/tickets/${targetTicketId}`, { params: { populate: "currentAssignee,createdBy,transferHistory.from,transferHistory.to,transferHistory.transferredBy,statusHistory.changedBy,documents.quotation.uploadedBy,documents.po.uploadedBy,documents.pi.uploadedBy,documents.challan.uploadedBy,documents.packingList.uploadedBy,documents.feedback.uploadedBy,documents.other.uploadedBy" } });
        setSelectedTicket(updatedSingleTicket);
      }
      if (showEditModal && editTicket && editTicket?._id === targetTicketId) {
        const updatedSingleTicket = await apiClient(`/tickets/${targetTicketId}`, { params: { populate: "currentAssignee,createdBy,transferHistory.from,transferHistory.to,transferHistory.transferredBy,statusHistory.changedBy,documents.quotation.uploadedBy,documents.po.uploadedBy,documents.pi.uploadedBy,documents.challan.uploadedBy,documents.packingList.uploadedBy,documents.feedback.uploadedBy,documents.other.uploadedBy" } });
        setEditTicket(updatedSingleTicket); // Also update editTicket if it's the one being modified
         // And update ticketData to reflect changes in the form
        setTicketData(prev => ({ ...prev, documents: updatedSingleTicket.documents }));
      }


      const successMsg = `${docType.toUpperCase()} document uploaded successfully.`;
      toast.success(successMsg);
      frontendLogger.info("documentActivity", successMsg, auth.user, { action: "UPLOAD_DOCUMENT_SUCCESS" });
      return true;
    } catch (error) {
      const errorMsg = handleApiError(error, "Failed to upload document", auth.user, "documentActivity");
      setError(errorMsg); toast.error(errorMsg);
      frontendLogger.error("documentActivity", `Failed to upload document (${docType}) for ticket ${targetTicketId}`, auth.user, { ticketId: targetTicketId, action: "UPLOAD_DOCUMENT_FAILURE" });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentDelete = async (docTypeToDelete, documentPathToDelete, ticketIdForDelete = null) => {
    setIsLoading(true); setError(null);
    const targetTicketId = ticketIdForDelete || editTicket?._id || selectedTicket?._id;
    if (!targetTicketId) { toast.error("Target ticket ID not found for deletion."); setIsLoading(false); return; }


    try {
      // const token = getAuthTokenUtil();
      // if (!token) {
      //   toast.error("Authentication required to delete document.");
      //   throw new Error("No authentication token found");
      // }
      if (!documentPathToDelete) { toast.warn("Document path not found for deletion."); setIsLoading(false); return; }

      await apiClient(`/tickets/${targetTicketId}/documents`, { method: "DELETE", body: { documentType: docTypeToDelete, documentPath: documentPathToDelete } });

      await fetchTickets();
      if (showPaymentModal && selectedTicket && selectedTicket?._id === targetTicketId) {
        const updatedSingleTicket = await apiClient(`/tickets/${targetTicketId}`, { params: { populate: "currentAssignee,createdBy,transferHistory.from,transferHistory.to,transferHistory.transferredBy,statusHistory.changedBy,documents.quotation.uploadedBy,documents.po.uploadedBy,documents.pi.uploadedBy,documents.challan.uploadedBy,documents.packingList.uploadedBy,documents.feedback.uploadedBy,documents.other.uploadedBy" } });
        setSelectedTicket(updatedSingleTicket);
      }
       if (showEditModal && editTicket && editTicket?._id === targetTicketId) {
        const updatedSingleTicket = await apiClient(`/tickets/${targetTicketId}`, { params: { populate: "currentAssignee,createdBy,transferHistory.from,transferHistory.to,transferHistory.transferredBy,statusHistory.changedBy,documents.quotation.uploadedBy,documents.po.uploadedBy,documents.pi.uploadedBy,documents.challan.uploadedBy,documents.packingList.uploadedBy,documents.feedback.uploadedBy,documents.other.uploadedBy" } });
        setEditTicket(updatedSingleTicket);
        setTicketData(prev => ({ ...prev, documents: updatedSingleTicket.documents }));
      }


      const successMsg = `${docTypeToDelete.toUpperCase()} document deleted successfully.`;
      toast.success(successMsg);
      frontendLogger.info("documentActivity", successMsg, auth.user, { deletedPath: documentPathToDelete, action: "DELETE_DOCUMENT_SUCCESS" });
    } catch (error) {
      const errorMsg = handleApiError(error, "Failed to delete document", auth.user, "documentActivity");
      setError(errorMsg); toast.error(errorMsg);
      frontendLogger.error("documentActivity", `Failed to delete document (${docTypeToDelete}) for ticket ${targetTicketId}`, auth.user, { ticketId: targetTicketId, action: "DELETE_DOCUMENT_FAILURE" });
    } finally {
      setIsLoading(false);
    }
  };

  const renderAddressFields = (type, isDisabled = false) => {
    const addressKey = type; // 'billingAddress' or 'shippingAddress' (object keys in ticketData)
    const address = ticketData[addressKey] || {};

    const handleChange = (field, value) => {
      setTicketData((prev) => {
        const newAddressData = { ...prev, [addressKey]: { ...(prev[addressKey] || {}), [field]: value } };
        // If billing address state changes, trigger tax recalc
        if (type === 'billingAddress' && field === 'state') {
            // The calculateTaxesForEditModal useEffect will pick this up
        }
        return newAddressData;
      });
    };

    const handlePincodeChangeForAddress = async (pincode) => {
        handleChange('pincode', pincode); // Update pincode in state first
        if (pincode.length === 6) {
            setIsFetchingAddressInEdit(true);
            try {
                const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);
                const data = response.data[0];
                if (data.Status === "Success") {
                    const postOffice = data.PostOffice[0];
                    setTicketData(prev => {
                        const updatedAddress = {
                            ...prev[addressKey],
                            city: postOffice.District,
                            state: postOffice.State,
                            pincode: pincode // ensure pincode is also set from input
                        };
                        const newTicketData = { ...prev, [addressKey]: updatedAddress };
                        // If shipping is same as billing and billing address is being changed, update shipping too
                        if (type === 'billingAddress' && prev.shippingSameAsBilling) {
                            newTicketData.shippingAddress = { ...updatedAddress };
                        }
                        return newTicketData;
                    });
                    // Tax recalculation will be triggered by useEffect watching billingAddress.state
                } else {
                    toast.warn(`Pincode ${pincode} not found or invalid.`);
                }
            } catch (err) {
                console.error("Pincode fetch error:", err);
                toast.error("Error fetching address from pincode.");
            }
            finally { setIsFetchingAddressInEdit(false); }
        }
    };
    return (
      <div className="mb-3">
        <div className="row g-2">
          <Form.Group className="col-md-6"><Form.Label>Address Line 1</Form.Label><Form.Control placeholder="Address Line 1" value={address.address1 || ""} onChange={(e) => handleChange("address1", e.target.value)} disabled={isDisabled || isFetchingAddressInEdit} /></Form.Group>
          <Form.Group className="col-md-6"><Form.Label>Address Line 2</Form.Label><Form.Control placeholder="Address Line 2" value={address.address2 || ""} onChange={(e) => handleChange("address2", e.target.value)} disabled={isDisabled || isFetchingAddressInEdit} /></Form.Group>
          <Form.Group className="col-md-4"><Form.Label>Pincode</Form.Label><Form.Control placeholder="Pincode" value={address.pincode || ""} onChange={(e) => handlePincodeChangeForAddress(e.target.value)} disabled={isDisabled || isFetchingAddressInEdit} pattern="[0-9]{6}" /><Form.Text className="text-muted">6-digit pincode</Form.Text></Form.Group>
          <Form.Group className="col-md-4"><Form.Label>City</Form.Label><Form.Control placeholder="City" value={address.city || ""} onChange={(e) => handleChange("city", e.target.value)} disabled={isDisabled || isFetchingAddressInEdit} readOnly={!!address.city && !isDisabled && !isFetchingAddressInEdit && !!address.pincode && address.pincode.length === 6} /></Form.Group>
          <Form.Group className="col-md-4"><Form.Label>State</Form.Label><Form.Control placeholder="State" value={address.state || ""} onChange={(e) => handleChange("state", e.target.value)} disabled={isDisabled || isFetchingAddressInEdit} readOnly={!!address.state && !isDisabled && !isFetchingAddressInEdit && !!address.pincode && address.pincode.length === 6} /></Form.Group>
        </div>
      </div>
    );
  };

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
  const ProgressBarWithStages = () => (
    <div className="mb-4">
      <ProgressBar style={{ height: "30px" }}>
        {statusStages.map((stage, index) => {
          const currentStatusIndex = statusStages.indexOf(ticketData.status);
          const isCompleted = currentStatusIndex >= index;
          const isCurrent = ticketData.status === stage;
          return (
            <ProgressBar
              key={stage}
              now={100 / statusStages.length}
              variant={isCompleted ? getStatusBadgeColor(stage) : "secondary"}
              label={isCurrent ? stage : ""}
              animated={isCurrent}
              onClick={() => handleStatusChange(stage)}
              style={{ cursor: "pointer", transition: "background-color 0.3s ease" }}
              title={`Set status to: ${stage}`}
            />
          );
        })}
      </ProgressBar>
      <div className="d-flex justify-content-between mt-2">
        {statusStages.map((stage) => (
          <small
            key={stage}
            className={`text-center ${ticketData.status === stage ? `fw-bold text-${getStatusBadgeColor(stage)}` : "text-muted"}`}
            style={{ width: `${100 / statusStages.length}%`, cursor: "pointer", transition: "color 0.3s ease, font-weight 0.3s ease" }}
            onClick={() => handleStatusChange(stage)}
            title={`Set status to: ${stage}`}
          >
            {stage.split(" ")[0]}
          </small>
        ))}
      </div>
    </div>
  );
  const TransferModal = () => {
    const [transferNote, setTransferNote] = useState("");

    const transferModalFooter = (
      <>
        <Button variant="outline-secondary" onClick={() => { setShowTransferModal(false); setError(null); setSelectedUser(null); setTransferNote(""); }} disabled={isLoading}>Cancel</Button>
        <Button variant="primary" onClick={() => handleTransferTicket(selectedUser, transferNote)} disabled={!selectedUser || isLoading} className="px-4">
          {isLoading ? "Transferring..." : "Confirm Transfer"}
        </Button>
      </>
    );

    return (
      <ReusableModal
        show={showTransferModal}
        onHide={() => { setShowTransferModal(false); setError(null); setSelectedUser(null); setTransferNote(""); }}
        title={<><i className="bi bi-arrow-left-right me-2"></i>Transfer Ticket - {transferTicket?.ticketNumber}</>}
        footerContent={transferModalFooter}
        isLoading={isLoading}
      >
        <div className="mb-4">
          <h5 className="mb-3" style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem" }}>
            <i className="bi bi-search me-2"></i>Search User to Transfer To
          </h5>
          <UserSearchComponent onUserSelect={handleUserSelect} authContext={auth} />
          <div style={{ position: "relative", zIndex: 1050 }}></div>
        </div>
        {selectedUser && (
          <>
            <div className="selected-user-info p-4 border rounded bg-light">
              <h6 className="mb-3"><i className="bi bi-person-circle me-2"></i>Selected User Details:</h6>
              <div className="row">
                <div className="col-md-6"><p><i className="bi bi-person me-2"></i><strong>Name:</strong> {selectedUser.firstname} {selectedUser.lastname}</p><p><i className="bi bi-envelope me-2"></i><strong>Email:</strong> {selectedUser.email}</p></div>
                <div className="col-md-6"><p><i className="bi bi-person-badge me-2"></i><strong>Role:</strong> <Badge bg="info">{selectedUser.role}</Badge></p></div>
              </div>
            </div>
            <Form.Group className="mt-3">
              <Form.Label>Transfer Note (Optional)</Form.Label>
              <Form.Control as="textarea" rows={2} value={transferNote} onChange={(e) => setTransferNote(e.target.value)} placeholder="Add any notes about this transfer..." />
            </Form.Group>
          </>
        )}
        {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
        {transferTicket && (
          <div className="ticket-summary mt-4 p-3 border rounded">
            <h5 className="mb-3" style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem" }}>Ticket Summary</h5>
            <div className="row">
              <div className="col-md-6"><p><strong>Company:</strong> {transferTicket.companyName}</p><p><strong>Quotation:</strong> {transferTicket.quotationNumber}</p><p><strong>Current Assignee:</strong> {transferTicket.currentAssignee?.firstname} {transferTicket.currentAssignee?.lastname || "N/A"}</p></div>
              <div className="col-md-6"><p><strong>Status:</strong> <Badge bg={getStatusBadgeColor(transferTicket.status)}>{transferTicket.status}</Badge></p><p><strong>Amount:</strong> ₹{transferTicket.grandTotal?.toFixed(2)}</p><p><strong>Created By:</strong> {transferTicket.createdBy?.firstname} {transferTicket.createdBy?.lastname || "N/A"}</p></div>
            </div>
          </div>
        )}
      </ReusableModal>
    );
  };

  return (
    <div>
      <Navbar />
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap" style={{ gap: "1rem" }}>
          <h2 style={{ color: "black", margin: 0, whiteSpace: "nowrap" }}>Tickets Overview</h2>
          <div className="d-flex align-items-center" style={{ minWidth: "200px", flexGrow: 1, maxWidth: "350px" }}>
            <SearchBar value={searchTerm} setSearchTerm={(value) => { setSearchTerm(value); setCurrentPage(1); }} placeholder="Search tickets..." className="w-100" />
          </div>
          <div className="filter-radio-group d-flex align-items-center flex-wrap" style={{ gap: "0.5rem" }}>
            {["all", "open", "Running", "closed", "hold"].map(s => (
                <Form.Check type="radio" inline key={s} id={`filter-${s.toLowerCase()}`} label={s.charAt(0).toUpperCase() + s.slice(1)} name="statusFilter"
                    checked={statusFilter === s} onChange={() => { setStatusFilter(s); setCurrentPage(1); }} className="radio-option" />
            ))}
          </div>
          {(authUser?.role === "admin" || authUser?.role === "super-admin") && (
            <Button variant="info" onClick={() => setShowTicketReportModal(true)} title="View Ticket Reports" style={{ whiteSpace: "nowrap" }}>
              <FaChartBar className="me-1" /> Report
            </Button>
          )}
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
                // Titles for individual buttons can be managed by ActionButtons or passed if needed
                // For simplicity, relying on ActionButtons' default titles or general understanding.
                // If specific dynamic titles are needed, ActionButtons might need an enhancement or titles passed per action.
                // title={!canModifyTicket ? "Only admin, super-admin, or current assignee can edit" : "Edit Ticket"} // This was for the old button
              />

            );
          }}
          noDataMessage="No tickets found." tableClassName="mt-3" theadClassName="table-dark"
        />
        <ReusableModal show={showEditModal} onHide={() => { setShowEditModal(false); setError(null); }}
          title={ <div className="d-flex justify-content-between align-items-center w-100"><span><i className="bi bi-pencil-square me-2"></i>Edit Ticket - {editTicket?.ticketNumber}</span><div className="assignee-info"><Badge bg="light" text="dark" className="p-2"><i className="bi bi-person-fill me-1"></i>{editTicket?.currentAssignee?.firstname} {editTicket?.currentAssignee?.lastname || "Unassigned"}</Badge><small className="d-block text-muted ms-1">Currently Assigned</small></div></div> }
          footerContent={ <><Button variant="secondary" onClick={() => { setShowEditModal(false); setError(null); }} disabled={isLoading}>Cancel</Button><Button variant="primary" onClick={handleUpdateTicket} disabled={isLoading}>{isLoading ? "Updating..." : "Update Ticket"}</Button></> }
        >
          {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
          <ProgressBarWithStages />
          {editTicket && ticketData.status !== editTicket.status && (
            <Form.Group className="my-3">
              <Form.Label htmlFor="statusChangeCommentInput" className="fw-bold">Comment for Status Change (Required)</Form.Label>
              <Form.Control as="textarea" id="statusChangeCommentInput" rows={2} value={statusChangeComment} onChange={(e) => setStatusChangeComment(e.target.value)} placeholder={`Explain why status is changing to "${ticketData.status}"...`} maxLength={200} required />
              <Form.Text muted>Max 200 characters.</Form.Text>
            </Form.Group>
          )}
          {editTicket?.statusHistory && editTicket.statusHistory.length > 0 && (
            <div className="mt-4">
              <h5 style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem", marginBottom: "1rem" }}><i className="bi bi-card-list me-1"></i>Status Change History</h5>
              <Table striped bordered hover size="sm" responsive><thead className="table-light"><tr><th>Changed By</th><th>Date</th><th>Status Changed To</th><th>Note</th></tr></thead><tbody>
                {editTicket.statusHistory.slice().reverse().map((historyItem, index) => (
                  <tr key={index}><td>{historyItem.changedBy ? `${historyItem.changedBy.firstname || ""} ${historyItem.changedBy.lastname || ""}`.trim() || historyItem.changedBy.email || "Unknown" : "N/A"}</td><td>{new Date(historyItem.changedAt).toLocaleString()}</td><td><Badge bg={getStatusBadgeColor(historyItem.status)}>{historyItem.status}</Badge></td><td title={historyItem.note || "No note"}>{(historyItem.note || "N/A").substring(0, 50) + (historyItem.note && historyItem.note.length > 50 ? "..." : "")}</td></tr>
                ))}</tbody   ></Table>
            </div>
          )}
          <hr />
          <Row className="mb-3">
            <Col md={4}><Form.Group><Form.Label>Ticket Date</Form.Label><Form.Control type="text" value={editTicket?.createdAt ? new Date(editTicket.createdAt).toLocaleDateString() : ""} readOnly disabled /></Form.Group></Col>
            <Col md={4}><Form.Group><Form.Label>Company Name*</Form.Label><Form.Control required readOnly type="text" value={ticketData.companyName} /></Form.Group></Col>
            <Col md={4}><Form.Group><Form.Label>Quotation Number*</Form.Label><Form.Control required type="text" value={ticketData.quotationNumber} readOnly disabled /></Form.Group></Col>
          </Row>
          <Row className="mb-3">
            <Col md={4}>
              <Form.Group><Form.Label>Deadline</Form.Label><Form.Control type="date" value={ticketData.deadline || ""} onChange={(e) => setTicketData({ ...ticketData, deadline: e.target.value })} /></Form.Group>
            </Col>
          </Row>
          <Row>
            <Col md={6}><h5 style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem", marginBottom: "1rem" }}><i className="bi bi-building me-1"></i>Billing Address</h5>{renderAddressFields("billingAddress", true)}</Col>
            <Col md={6}><h5 style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem", marginBottom: "1rem" }}><i className="bi bi-truck me-1"></i>Shipping Address</h5>
              {renderAddressFields("shippingAddress", ticketData.shippingSameAsBilling || isFetchingAddressInEdit)}
              <Form.Check type="checkbox" label="Shipping same as billing" checked={ticketData.shippingSameAsBilling}
                onChange={(e) => { const isChecked = e.target.checked; setTicketData((prev) => ({ ...prev, shippingSameAsBilling: isChecked, shippingAddress: isChecked ? { ...prev.billingAddress } : { address1: "", address2: "", city: "", state: "", pincode: "" } })); }} disabled={isFetchingAddressInEdit} />
            </Col>
          </Row>
          <h5 className="mt-4" style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem", marginBottom: "1rem" }}><i className="bi bi-box-seam me-1"></i>Goods Details*</h5>
          <div className="table-responsive"><Table bordered className="mb-3"><thead ><tr className="text-center"><th>Sr No.</th><th>Description*</th><th>HSN/SAC*</th><th>Qty*</th><th>GST%*</th><th>Price*</th><th>Amount</th><th>Delete</th></tr></thead><tbody>
            {ticketData.goods.map((item, index) => (
              <tr key={index}>
                <td className="align-middle text-center">{item.srNo}</td>
                <td style={{ minWidth: "250px" }}>
                  <Form.Control type="text" value={item.description || ""} onChange={(e) => handleTicketGoodsChange(index, "description", e.target.value)} required placeholder="Item Description" />
                  {item.subtexts && item.subtexts.map((subtext, subtextIndex) => ( <div key={subtextIndex} className="d-flex mt-1"><Form.Control type="text" value={subtext} onChange={(e) => handleTicketGoodsChange(index, "subtexts", e.target.value, subtextIndex)} placeholder={`Subtext ${subtextIndex + 1}`} className="form-control-sm me-1" style={{ fontStyle: "italic" }} /><Button variant="outline-danger" size="sm" onClick={() => handleDeleteSubtextFromTicketItem(index, subtextIndex)}>&times;</Button></div> ))}
                  <Button variant="outline-primary" size="sm" className="mt-1" onClick={() => handleAddSubtextToTicketItem(index)}>+ Subtext</Button>
                </td>
                <td><Form.Control type="text" value={item.hsnSacCode || ""} onChange={(e) => handleTicketGoodsChange(index, "hsnSacCode", e.target.value)} required placeholder="HSN/SAC" /></td>
                <td><Form.Control required type="number" min="1" value={item.quantity} onChange={(e) => handleTicketGoodsChange(index, "quantity", e.target.value)} /></td>
                <td><Form.Control required type="number" min="0" step="0.01" value={item.gstRate === null ? "" : item.gstRate} onChange={(e) => handleTicketGoodsChange(index, "gstRate", e.target.value)} /></td>
                <td><Form.Control type="number" min="0" step="0.01" value={item.price || 0} onChange={(e) => handleTicketGoodsChange(index, "price", e.target.value)} /></td>
                <td className="align-middle">₹{(item.amount || 0).toFixed(2)}</td>
                <td className="text-center align-middle"><Button variant="danger" size="sm" onClick={() => handleDeleteItemFromTicket(index)}><i className="bi bi-trash"></i></Button></td>
              </tr>))}
          </tbody></Table></div>
          <div className="my-3"><h6 >Add New Item to Ticket</h6><ItemSearchComponent onItemSelect={handleAddItemToTicket} placeholder="Search and select item..." onDropdownToggle={setIsItemSearchDropdownOpenInEditModal} /></div>
          {isItemSearchDropdownOpenInEditModal && <div style={{ height: "300px" }}></div>}
          {/* Ticket Financial Summary Section */}
          <div className="bg-light p-3 rounded mt-4">
            <h5 style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#e9ecef", padding: "0.5rem", borderRadius: "0.25rem", marginBottom: "1rem" }}>
                <i className="bi bi-calculator me-1"></i>Ticket Financial Summary</h5>
            <Row>
                <Col md={4}><Table bordered size="sm"><tbody>
                    <tr><td>Total Quantity</td><td className="text-end"><strong>{ticketData.totalQuantity || 0}</strong></td></tr>
                    <tr><td>Total Amount (Pre-GST)</td><td className="text-end"><strong>₹{(ticketData.totalAmount || 0).toFixed(2)}</strong></td></tr>
                </tbody></Table></Col>
                <Col md={8}><Table bordered size="sm"><tbody>
                    {(ticketData.gstBreakdown || []).map((gstGroup, index) => (
                        <React.Fragment key={index}>
                        {gstGroup.itemGstRate > 0 && (
                            ticketData.isBillingStateSameAsCompany ? (
                            <>
                                <tr><td>CGST ({gstGroup.cgstRate?.toFixed(2) || 0}% on ₹{gstGroup.taxableAmount?.toFixed(2) || 0})</td><td className="text-end">₹{(gstGroup.cgstAmount || 0).toFixed(2)}</td></tr>
                                <tr><td>SGST ({gstGroup.sgstRate?.toFixed(2) || 0}% on ₹{gstGroup.taxableAmount?.toFixed(2) || 0})</td><td className="text-end">₹{(gstGroup.sgstAmount || 0).toFixed(2)}</td></tr>
                            </>
                            ) : (
                            <tr><td>IGST ({gstGroup.igstRate?.toFixed(2) || 0}% on ₹{gstGroup.taxableAmount?.toFixed(2) || 0})</td><td className="text-end">₹{(gstGroup.igstAmount || 0).toFixed(2)}</td></tr>
                            )
                        )}
                        </React.Fragment>
                    ))}
                    <tr className="table-active"><td><strong>Total Tax</strong></td><td className="text-end"><strong>₹{(ticketData.finalGstAmount || 0).toFixed(2)}</strong></td></tr>
                    <tr className="table-success"><td><strong>Grand Total</strong></td><td className="text-end"><strong>₹{(ticketData.grandTotal || 0).toFixed(2)}</strong></td></tr>
                </tbody></Table></Col>
            </Row>
          </div>
          <div className="mt-4"><h5 style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem", marginBottom: "1rem" }}><i className="bi bi-file-text me-1"></i>Terms & Conditions</h5><Form.Control as="textarea" rows={4} value={ticketData.termsAndConditions} onChange={(e) => setTicketData({ ...ticketData, termsAndConditions: e.target.value })} placeholder="Enter terms for PI..." /></div>
        </ReusableModal>
        <TransferModal />
        <ReusableModal
          show={showPdfPreviewModal}
          onHide={() => setShowPdfPreviewModal(false)}
          title={`${pdfPreviewConfig.type?.toUpperCase()} Preview - ${selectedTicket?.ticketNumber || editTicket?.ticketNumber || ""}`}
          footerContent={pdfPreviewConfig.type === "PI" && (selectedTicket || editTicket) ? <PIActions ticket={selectedTicket || editTicket} /> : null}
        >
          {pdfPreviewConfig.type && (selectedTicket || editTicket) && renderPdfPreview(pdfPreviewConfig.type, selectedTicket || editTicket)}
        </ReusableModal>
        <ReusableModal show={showPaymentModal} onHide={() => { setShowPaymentModal(false); setError(null); }} title={<><i className="bi bi-credit-card-2-front me-2"></i>Document Details - {selectedTicket?.ticketNumber}</>}
          footerContent={<Button variant="secondary" onClick={() => { setShowPaymentModal(false); setError(null); }} disabled={isLoading}>Close</Button>}>
            {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
            <h5 style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem", marginBottom: "1rem" }}><i className="bi bi-files me-2"></i>Ticket Documents</h5>
            <Row className="mb-4 text-center">
            {[ { name: "Quotation", docType: "quotation", icon: "bi-file-earmark-text", generate: true }, { name: "PI", docType: "pi", icon: "bi-file-earmark-medical", generate: true }, { name: "PO", docType: "po", icon: "bi-file-earmark-check" }, { name: "Dispatch", docType: "challan", icon: "bi-truck" }, { name: "Packing List", docType: "packingList", icon: "bi-list-ul" }, { name: "Feedback", docType: "feedback", icon: "bi-chat-square-text" } ].map((docDef) => {
              const docData = selectedTicket?.documents?.[docDef.docType];
              return (
                <Col key={docDef.docType} md={4} className="mb-3">
                  <Card className="h-100 shadow-sm"><Card.Body className="d-flex flex-column">
                    <Card.Title className="d-flex align-items-center"><i className={`bi ${docDef.icon} me-2 fs-4`}></i>{docDef.name}</Card.Title>
                    {docData && docData.path ? (
                      <>
                        <small className="text-muted">Uploaded by: {docData.uploadedBy && docData.uploadedBy.firstname ? `${docData.uploadedBy.firstname} ${docData.uploadedBy.lastname || ""}`.trim() : "N/A"}<br />On: {new Date(docData.uploadedAt).toLocaleDateString()}</small>
                        <Button variant="outline-info" size="sm" className="mt-2" onClick={() => window.open(`${import.meta.env.VITE_API_BASE_URL}/uploads/${selectedTicket?._id}/${docData.path}`, "_blank")}><i className="bi bi-eye me-1"></i>View Uploaded</Button>
                        <Button variant="outline-danger" size="sm" className="mt-1" onClick={() => handleDocumentDelete(docDef.docType, docData.path, selectedTicket?._id)} disabled={isLoading}><i className="bi bi-trash me-1"></i>Delete</Button>
                      </>
                    ) : (<p className="text-muted small mt-1">Not uploaded yet.</p>)}
                    {docDef.generate && (<Button variant="primary" size="sm" className="mt-auto" onClick={() => { setPdfPreviewConfig({ type: docDef.docType, data: selectedTicket }); setShowPdfPreviewModal(true); }}><i className="bi bi-gear me-1"></i>Generate & View</Button>)}
                    <Button variant={docData && docData.path ? "outline-warning" : "outline-success"} size="sm" className="mt-1" onClick={() => { setUploadingDocType(docDef.docType); document.getElementById(`file-upload-${docDef.docType}-${selectedTicket?._id}`)?.click(); }} disabled={isLoading}><i className={`bi ${docData && docData.path ? "bi-arrow-repeat" : "bi-upload"} me-1`}></i>{docData && docData.path ? "Replace" : "Upload"} {docDef.name}</Button>
                    <input type="file" id={`file-upload-${docDef.docType}-${selectedTicket?._id}`} style={{ display: "none" }} onChange={(e) => { if (e.target.files && e.target.files.length > 0) { handleSpecificDocumentUpload(e.target.files[0], uploadingDocType, selectedTicket?._id); e.target.value = ""; setUploadingDocType(null); } }} />
                  </Card.Body></Card>
                </Col>
              );})}
            </Row>
            <hr />
            <h5 style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem", marginBottom: "1rem" }}><i className="bi bi-paperclip me-2"></i>Other Uploaded Documents</h5>
            {selectedTicket?.documents?.other && selectedTicket.documents.other.length > 0 ? (
              <Table striped bordered hover size="sm" className="mt-2">
                <thead><tr><th>File Name</th><th>Uploaded By</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>{selectedTicket.documents.other.map((doc, index) => (
                  <tr key={doc.path || index}><td>{doc.originalName}</td><td>{doc.uploadedBy && doc.uploadedBy.firstname ? `${doc.uploadedBy.firstname} ${doc.uploadedBy.lastname || ""}`.trim() : "N/A"}</td><td>{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                  <td><Button variant="info" size="sm" className="me-1" onClick={() => window.open(`${import.meta.env.VITE_API_BASE_URL}/uploads/${selectedTicket?._id}/${doc.path}`, "_blank")}><i className="bi bi-eye"></i></Button>
                      <Button variant="danger" size="sm" onClick={() => handleDocumentDelete("other", doc.path, selectedTicket?._id)} disabled={isLoading}><i className="bi bi-trash"></i></Button></td></tr>))}
                </tbody></Table>
            ) : (<p className="text-muted">No other documents uploaded.</p>)}
            <Button variant="outline-primary" size="sm" className="mt-2" onClick={() => { setUploadingDocType("other"); document.getElementById(`file-upload-other-${selectedTicket?._id}`)?.click(); }} disabled={isLoading}><i className="bi bi-plus-circle"></i> Upload Other Document</Button>
            <input type="file" id={`file-upload-other-${selectedTicket?._id}`} style={{ display: "none" }} onChange={(e) => { if (e.target.files && e.target.files.length > 0) { handleSpecificDocumentUpload(e.target.files[0], "other", selectedTicket?._id); e.target.value = null; setUploadingDocType(null); } }} />
            <hr />
            <Row><Col md={12}>
              <h5 style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem", marginBottom: "1rem" }}><i className="bi bi-arrow-repeat me-1"></i>Transfer History</h5>
              {selectedTicket && transferHistoryDisplay && transferHistoryDisplay.length > 0 ? (
                <Table bordered responsive className="mt-2 transfer-history-table table-sm"><thead className="table-light"><tr><th>Name</th><th>Date</th><th>Note</th></tr></thead>
                <tbody>{transferHistoryDisplay.map((entry, index) => (<tr key={index}><td>{entry.name}</td><td>{new Date(entry.date).toLocaleString()}</td><td title={entry.note}>{entry.note ? entry.note.substring(0, 50) + (entry.note.length > 50 ? "..." : "") : "N/A"}</td></tr>))}</tbody></Table>
              ) : (<div className="text-muted mt-2">No transfer history available.</div>)}
            </Col></Row>
        </ReusableModal>
        {filteredTickets.length > 0 && <Pagination currentPage={currentPage} totalItems={filteredTickets.length} itemsPerPage={itemsPerPage} onPageChange={(page) => { const currentTotalPages = Math.ceil(filteredTickets.length / itemsPerPage); if (page >= 1 && page <= currentTotalPages) setCurrentPage(page); }} onItemsPerPageChange={handleItemsPerPageChange} />}
      </div>
      <TicketReportModal show={showTicketReportModal} onHide={() => setShowTicketReportModal(false)} />
      <Footer />
    </div>
  );
}

function getProgressBarVariant(percentage) {
  if (percentage < 30) return "danger";
  if (percentage < 70) return "warning";
  return "success";
}
