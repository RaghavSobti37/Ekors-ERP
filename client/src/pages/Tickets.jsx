// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/pages/Tickets.jsx
import React, { useState, useEffect, useMemo, useCallback } from "react";
import Pagination from "../components/Pagination";
import Footer from "../components/Footer";
import { Modal, Button, Form, Table, ProgressBar, Alert, Dropdown, Badge, Card, Row, Col } from "react-bootstrap";
import { FaChartBar } from "react-icons/fa";
import Navbar from "../components/Navbar.jsx";
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer";
// import SortIndicator from "../components/SortIndicator.jsx"; // Not directly used, ReusableTable might
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
import ItemSearchComponent from "../components/ItemSearch.jsx";
import apiClient from "../utils/apiClient";
import "../css/Style.css";
import ReusableModal from "../components/ReusableModal.jsx";
import TicketReportModal from "../components/TicketReportModal.jsx";

// Define COMPANY_REFERENCE_STATE at a scope accessible by tax calculation logic if needed here
const COMPANY_REFERENCE_STATE = "UTTAR PRADESH";

const UserSearchComponent = ({ onUserSelect, authContext }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const data = await apiClient("/tickets/transfer-candidates");
      setUsers(data);
    } catch (err) {
      let specificMessage = "Error loading users for search.";
      if (err.status === 403) specificMessage = err.data?.message || "Permission denied to view users.";
      else if (err.data?.message) specificMessage = err.data.message;
      else if (err.message) specificMessage = `Failed to load users: ${err.message}`;
      setError(specificMessage);
      frontendLogger.error("userSearch", "Failed to fetch users", authContext?.user, { errorMessage: err.message, specificMessageDisplayed: specificMessage, stack: err.stack });
    } finally { setLoading(false); }
  }, [authContext]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    if (searchTerm.trim() !== "") {
      const filtered = users.filter(user =>
        user.firstname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lastname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered); setShowDropdown(true);
    } else { setFilteredUsers([]); setShowDropdown(false); }
  }, [searchTerm, users]);

  const handleUserClick = (user) => { onUserSelect(user); setSearchTerm(""); setShowDropdown(false); };
  const handleSearchChange = (e) => { setSearchTerm(e.target.value); };
  const handleBlur = () => { setTimeout(() => setShowDropdown(false), 200); };

  return (
    <div className="user-search-component">
      {error && <div className="search-error text-danger small">{error}</div>}
      <div className="search-input-container">
        <input type="text" className="form-control" placeholder="Search user by name or email..." value={searchTerm} onChange={handleSearchChange} onFocus={() => setShowDropdown(true)} onBlur={handleBlur} disabled={loading} />
        {loading && <div className="search-loading">Loading...</div>}
      </div>
      {showDropdown && filteredUsers.length > 0 && (
        <div className="search-suggestions-dropdown">
          {filteredUsers.map((user) => (
            <div key={user._id} className="search-suggestion-item" onClick={() => handleUserClick(user)}>
              <strong>{user.firstname} {user.lastname}</strong><span className="text-muted"> - {user.email}</span><br /><small>Role: {user.role}</small>
            </div>
          ))}
        </div>
      )}
      {showDropdown && searchTerm && filteredUsers.length === 0 && <div className="search-no-results">No users found</div>}
    </div>
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
  const [selectedUser, setSelectedUser] = useState(null);
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
    billingAddress: { address1: "", address2: "", city: "", state: "", pincode: "" }, // Object form
    shippingAddress: { address1: "", address2: "", city: "", state: "", pincode: "" }, // Object form
    shippingSameAsBilling: false,
    goods: [], totalQuantity: 0, totalAmount: 0, // Pre-GST total
    // New GST fields
    gstBreakdown: [], totalCgstAmount: 0, totalSgstAmount: 0, totalIgstAmount: 0,
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

  const statusStages = ["Quotation Sent", "PO Received", "Payment Pending", "Inspection", "Packing List", "Invoice Sent", "Hold", "Closed"];

  const calculateTaxesForEditModal = useCallback(() => {
    // This function is similar to the one in CreateTicketModal but operates on `ticketData` state of Tickets.jsx
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
        const itemGstRate = parseFloat(item.gstRate);
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
  }, [ticketData.goods, ticketData.billingAddress, ticketData.totalAmount, setTicketData]);

  // Recalculate taxes in edit modal when relevant fields change
  useEffect(() => {
    if (showEditModal) {
        calculateTaxesForEditModal();
    }
  }, [showEditModal, ticketData.goods, ticketData.billingAddress.state, ticketData.totalAmount, calculateTaxesForEditModal]);


  const fetchTickets = useCallback(async () => {
    if (!authUser) return;
    setIsLoading(true); setError(null);
    try {
      const data = await apiClient("/tickets", {
        params: { populate: "currentAssignee,createdBy,transferHistory.from,transferHistory.to,transferHistory.transferredBy,statusHistory.changedBy,documents.quotation.uploadedBy,documents.po.uploadedBy,documents.pi.uploadedBy,documents.challan.uploadedBy,documents.packingList.uploadedBy,documents.feedback.uploadedBy,documents.other.uploadedBy" },
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
      if (sortConfig.key === "createdAt") { // Assuming 'date' was meant to be 'createdAt'
        const dateA = new Date(a.createdAt); const dateB = new Date(b.createdAt);
        return sortConfig.direction === "ascending" ? dateA - dateB : dateB - dateA;
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
        if (statusFilter === "Running") return ticket.status === "Running"; // Added for "Running" filter
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

  const updateTotalsAndRecalculateTaxes = (goods) => {
    const totalQuantity = goods.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalAmount = goods.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    // Set totalAmount first, then trigger tax recalculation which depends on it
    setTicketData(prev => ({ ...prev, goods, totalQuantity, totalAmount }));
    // calculateTaxesForEditModal will be called by its own useEffect dependency on totalAmount or goods
  };

  const validateItemPrice = (item) => { /* ... same as before ... */ return true; };

  const handleAddItemToTicket = (item) => {
    const newGoods = [
      ...ticketData.goods,
      {
        srNo: ticketData.goods.length + 1, description: item.name, hsnSacCode: item.hsnCode || "",
        quantity: 1, unit: item.unit || "Nos", price: Number(item.sellingPrice) || 0,
        amount: (Number(item.sellingPrice) || 0) * 1, originalPrice: Number(item.sellingPrice) || 0,
        maxDiscountPercentage: Number(item.maxDiscountPercentage) || 0,
        gstRate: parseFloat(item.gstRate || 0), // Ensure gstRate is a number
        subtexts: [],
      },
    ];
    updateTotalsAndRecalculateTaxes(newGoods);
  };

  const handleEdit = (selectedTicketToEdit) => {
    setEditTicket(selectedTicketToEdit); // Store the original ticket for reference
    // Convert address arrays from DB to objects for form state
    const billingAddressObj = Array.isArray(selectedTicketToEdit.billingAddress) && selectedTicketToEdit.billingAddress.length === 5
      ? { address1: selectedTicketToEdit.billingAddress[0] || "", address2: selectedTicketToEdit.billingAddress[1] || "", state: selectedTicketToEdit.billingAddress[2] || "", city: selectedTicketToEdit.billingAddress[3] || "", pincode: selectedTicketToEdit.billingAddress[4] || "" }
      : selectedTicketToEdit.billingAddress || { address1: "", address2: "", city: "", state: "", pincode: "" };

    const shippingAddressObj = Array.isArray(selectedTicketToEdit.shippingAddress) && selectedTicketToEdit.shippingAddress.length === 5
      ? { address1: selectedTicketToEdit.shippingAddress[0] || "", address2: selectedTicketToEdit.shippingAddress[1] || "", state: selectedTicketToEdit.shippingAddress[2] || "", city: selectedTicketToEdit.shippingAddress[3] || "", pincode: selectedTicketToEdit.shippingAddress[4] || "" }
      : selectedTicketToEdit.shippingAddress || { address1: "", address2: "", city: "", state: "", pincode: "" };

    setTicketData({
      companyName: selectedTicketToEdit.companyName || "",
      quotationNumber: selectedTicketToEdit.quotationNumber || "",
      billingAddress: billingAddressObj,
      shippingAddress: shippingAddressObj,
      shippingSameAsBilling: selectedTicketToEdit.shippingSameAsBilling || false,
      goods: (selectedTicketToEdit.goods || []).map(g => ({
        ...g, originalPrice: g.originalPrice || g.price,
        maxDiscountPercentage: Number(g.maxDiscountPercentage || 0),
        gstRate: parseFloat(g.gstRate || 0), // Ensure gstRate is a number
        subtexts: g.subtexts || [],
      })),
      totalQuantity: selectedTicketToEdit.totalQuantity || 0,
      totalAmount: selectedTicketToEdit.totalAmount || 0, // Pre-GST total
      // GST fields from selectedTicketToEdit
      gstBreakdown: selectedTicketToEdit.gstBreakdown || [],
      totalCgstAmount: selectedTicketToEdit.totalCgstAmount || 0,
      totalSgstAmount: selectedTicketToEdit.totalSgstAmount || 0,
      totalIgstAmount: selectedTicketToEdit.totalIgstAmount || 0,
      finalGstAmount: selectedTicketToEdit.finalGstAmount || 0,
      grandTotal: selectedTicketToEdit.grandTotal || 0,
      isBillingStateSameAsCompany: selectedTicketToEdit.isBillingStateSameAsCompany || false,
      status: selectedTicketToEdit.status || statusStages[0],
      documents: selectedTicketToEdit.documents || ticketData.documents,
      dispatchDays: selectedTicketToEdit.dispatchDays || "7-10 working",
      validityDate: selectedTicketToEdit.validityDate || new Date(new Date().setDate(new Date().getDate() + 15)).toISOString(),
      clientPhone: selectedTicketToEdit.clientPhone || "",
      clientGstNumber: selectedTicketToEdit.clientGstNumber || "",
      termsAndConditions: selectedTicketToEdit.termsAndConditions || ticketData.termsAndConditions,
    });
    setShowEditModal(true); setError(null);
  };

  const handleDeleteItemFromTicket = (indexToDelete) => {
    const updatedGoods = ticketData.goods.filter((_, index) => index !== indexToDelete)
      .map((item, index) => ({ ...item, srNo: index + 1 }));
    updateTotalsAndRecalculateTaxes(updatedGoods);
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
        updatedGoods[index][field] = value === "" ? null : parseFloat(value); // Allow empty for null GST
    } else {
      updatedGoods[index][field] = (["quantity", "price"].includes(field)) ? Number(value) : value;
    }
    if (field === "quantity" || field === "price") {
      updatedGoods[index].amount = (Number(updatedGoods[index].quantity) || 0) * (Number(updatedGoods[index].price) || 0);
    }
    updateTotalsAndRecalculateTaxes(updatedGoods);
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
      for (const item of ticketData.goods) { if (!validateItemPrice(item)) { setIsLoading(false); return; } }
      if (error && error.includes("exceeds the maximum allowed")) setError(null);
      if (editTicket && ticketData.status !== editTicket.status && !statusChangeComment.trim()) {
        toast.warn("Comment for status change is required."); setIsLoading(false); return;
      }

      // Prepare data for backend, converting address objects back to arrays
      const updatePayload = {
        ...ticketData, // Includes all new GST fields
        statusChangeComment: ticketData.status !== editTicket?.status ? statusChangeComment : undefined,
        // Backend expects billingAddress and shippingAddress as arrays of 5 strings
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
          ...g, gstRate: parseFloat(g.gstRate || 0), // Ensure gstRate is a number
          originalPrice: g.originalPrice, maxDiscountPercentage: Number(g.maxDiscountPercentage || 0),
          subtexts: g.subtexts || [],
        })),
      };
      // Remove fields not expected by backend or that shouldn't be directly updated
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

  const renderPdfPreview = (previewType, ticketForPdf) => { /* ... same as before ... */ };
  const handleSpecificDocumentUpload = async (file, docType, ticketIdForUpload = null) => { /* ... same as before ... */ };
  const handleDocumentDelete = async (docTypeToDelete, documentPathToDelete, ticketIdForDelete = null) => { /* ... same as before ... */ };

  const renderAddressFields = (type, isDisabled = false) => {
    const addressKey = type; // 'billingAddress' or 'shippingAddress' (object keys in ticketData)
    const address = ticketData[addressKey] || {};
    const handleChange = (field, value) => {
      setTicketData((prev) => ({ ...prev, [addressKey]: { ...(prev[addressKey] || {}), [field]: value } }));
      if (type === 'billingAddress') { // If billing address state changes, trigger tax recalc
          calculateTaxesForEditModal();
      }
    };
    const handlePincodeChangeForAddress = async (pincode) => {
        handleChange('pincode', pincode);
        if (pincode.length === 6) {
            setIsLoading(true); // Or a specific loading state for pincode fetch
            try {
                const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);
                const data = response.data[0];
                if (data.Status === "Success") {
                    const postOffice = data.PostOffice[0];
                    setTicketData(prev => ({
                        ...prev,
                        [addressKey]: {
                            ...prev[addressKey],
                            city: postOffice.District,
                            state: postOffice.State,
                        }
                    }));
                    if (type === 'billingAddress') calculateTaxesForEditModal(); // Recalculate if billing state changed
                }
            } catch (err) { console.error("Pincode fetch error:", err); }
            finally { setIsLoading(false); }
        }
    };
    return (
      <div className="mb-3">
        <div className="row g-2">
          <Form.Group className="col-md-6"><Form.Control placeholder="Address Line 1" value={address.address1 || ""} onChange={(e) => handleChange("address1", e.target.value)} disabled={isDisabled} /></Form.Group>
          <Form.Group className="col-md-6"><Form.Control placeholder="Address Line 2" value={address.address2 || ""} onChange={(e) => handleChange("address2", e.target.value)} disabled={isDisabled} /></Form.Group>
          <Form.Group className="col-md-4"><Form.Control placeholder="Pincode" value={address.pincode || ""} onChange={(e) => handlePincodeChangeForAddress(e.target.value)} disabled={isDisabled} /></Form.Group>
          <Form.Group className="col-md-4"><Form.Control placeholder="City" value={address.city || ""} onChange={(e) => handleChange("city", e.target.value)} disabled={isDisabled} readOnly={!!address.city && !isDisabled} /></Form.Group>
          <Form.Group className="col-md-4"><Form.Control placeholder="State" value={address.state || ""} onChange={(e) => handleChange("state", e.target.value)} disabled={isDisabled} readOnly={!!address.state && !isDisabled} /></Form.Group>
        </div>
      </div>
    );
  };

  const getStatusBadgeColor = (status) => { /* ... same as before ... */ };
  const ProgressBarWithStages = () => { /* ... same as before ... */ };
  const TransferModal = () => { /* ... same as before ... */ };

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
            {["all", "open", "Running", "closed", "hold"].map(s => ( // Note: "Running" capitalized
                <Form.Check type="radio" inline key={s} id={`filter-${s.toLowerCase()}`} label={s} name="statusFilter"
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
            { key: "progress", header: "Progress", renderCell: (ticket) => { /* ... same as before ... */ } },
          ]}
          data={currentItems} keyField="_id" isLoading={isLoading && currentItems.length === 0}
          error={error && currentItems.length === 0 ? error : null} onSort={requestSort} sortConfig={sortConfig}
          renderActions={(ticket) => { /* ... same as before ... */ }}
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
                ))}</tbody></Table>
            </div>
          )}
          <hr />
          <Row className="mb-3">
            <Col md={4}><Form.Group><Form.Label>Ticket Date</Form.Label><Form.Control type="text" value={editTicket?.createdAt ? new Date(editTicket.createdAt).toLocaleDateString() : ""} readOnly disabled /></Form.Group></Col>
            <Col md={4}><Form.Group><Form.Label>Company Name*</Form.Label><Form.Control required readOnly type="text" value={ticketData.companyName} /></Form.Group></Col>
            <Col md={4}><Form.Group><Form.Label>Quotation Number*</Form.Label><Form.Control required type="text" value={ticketData.quotationNumber} readOnly disabled /></Form.Group></Col>
          </Row>
          <Row>
            <Col md={6}><h5 style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem", marginBottom: "1rem" }}><i className="bi bi-building me-1"></i>Billing Address</h5>{renderAddressFields("billingAddress", true)}</Col>
            <Col md={6}><h5 style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem", marginBottom: "1rem" }}><i className="bi bi-truck me-1"></i>Shipping Address</h5>
              {renderAddressFields("shippingAddress", ticketData.shippingSameAsBilling)}
              <Form.Check type="checkbox" label="Shipping same as billing" checked={ticketData.shippingSameAsBilling}
                onChange={(e) => { const isChecked = e.target.checked; setTicketData((prev) => ({ ...prev, shippingSameAsBilling: isChecked, shippingAddress: isChecked ? { ...prev.billingAddress } : { ...prev.shippingAddress } })); }} />
            </Col>
          </Row>
          <h5 className="mt-4" style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem", marginBottom: "1rem" }}><i className="bi bi-box-seam me-1"></i>Goods Details*</h5>
          <div className="table-responsive"><Table bordered className="mb-3"><thead><tr className="text-center"><th>Sr No.</th><th>Description*</th><th>HSN/SAC*</th><th>Qty*</th><th>GST%*</th><th>Price*</th><th>Amount</th><th>Delete</th></tr></thead><tbody>
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
                <td><Form.Control required type="number" min="0" step="0.1" value={item.gstRate === null ? "" : item.gstRate} onChange={(e) => handleTicketGoodsChange(index, "gstRate", e.target.value)} /></td>
                <td><Form.Control type="number" min="0" value={item.price || 0} onChange={(e) => handleTicketGoodsChange(index, "price", e.target.value)} /></td>
                <td className="align-middle">₹{(item.amount || 0).toFixed(2)}</td>
                <td className="text-center align-middle"><Button variant="danger" size="sm" onClick={() => handleDeleteItemFromTicket(index)}><i className="bi bi-trash"></i></Button></td>
              </tr>))}
          </tbody></Table></div>
          <div className="my-3"><h6>Add New Item to Ticket</h6><ItemSearchComponent onItemSelect={handleAddItemToTicket} placeholder="Search and select item..." onDropdownToggle={setIsItemSearchDropdownOpenInEditModal} /></div>
          {isItemSearchDropdownOpenInEditModal && <div style={{ height: "300px" }}></div>}
          <div className="bg-light p-3 rounded mt-3">
            <h5 className="text-center mb-3">Ticket Summary</h5>
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
                                <tr><td>CGST ({gstGroup.cgstRate.toFixed(2)}% on ₹{gstGroup.taxableAmount.toFixed(2)})</td><td className="text-end">₹{(gstGroup.cgstAmount || 0).toFixed(2)}</td></tr>
                                <tr><td>SGST ({gstGroup.sgstRate.toFixed(2)}% on ₹{gstGroup.taxableAmount.toFixed(2)})</td><td className="text-end">₹{(gstGroup.sgstAmount || 0).toFixed(2)}</td></tr>
                            </>
                            ) : (
                            <tr><td>IGST ({gstGroup.igstRate.toFixed(2)}% on ₹{gstGroup.taxableAmount.toFixed(2)})</td><td className="text-end">₹{(gstGroup.igstAmount || 0).toFixed(2)}</td></tr>
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
        <ReusableModal show={showPdfPreviewModal} onHide={() => setShowPdfPreviewModal(false)} title={`${pdfPreviewConfig.type?.toUpperCase()} Preview`}>
          {pdfPreviewConfig.type && pdfPreviewConfig.data && renderPdfPreview(pdfPreviewConfig.type, pdfPreviewConfig.data)}
        </ReusableModal>
        <ReusableModal show={showPaymentModal} onHide={() => { setShowPaymentModal(false); setError(null); }} title={<><i className="bi bi-credit-card-2-front me-2"></i>Payment Details - {selectedTicket?.ticketNumber}</>} footerContent={<Button variant="secondary" onClick={() => { setShowPaymentModal(false); setError(null); }} disabled={isLoading}>Close</Button>}>
          {/* Payment Modal Content: Error, Documents, Transfer History */}
        </ReusableModal>
        {filteredTickets.length > 0 && <Pagination currentPage={currentPage} totalItems={filteredTickets.length} itemsPerPage={itemsPerPage} onPageChange={(page) => { const currentTotalPages = Math.ceil(filteredTickets.length / itemsPerPage); if (page >= 1 && page <= currentTotalPages) setCurrentPage(page); }} onItemsPerPageChange={handleItemsPerPageChange} />}
      </div>
      <TicketReportModal show={showTicketReportModal} onHide={() => setShowTicketReportModal(false)} />
      <Footer />
    </div>
  );
}

function getProgressBarVariant(percentage) { /* ... same as before ... */ }
