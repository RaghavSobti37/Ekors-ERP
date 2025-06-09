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
import SortIndicator from "../components/SortIndicator.jsx"; // Component for sort direction indicator
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
import TicketReportModal from "../components/TicketReportModal.jsx"; // Import the new report modal

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
      const token = getAuthTokenUtil(); // Use utility
      if (!token) {
        throw new Error("Authentication token not found for fetching users.");
      }

      const data = await apiClient("/tickets/transfer-candidates"); // Use apiClient
      setUsers(data);
    } catch (err) {
      let specificMessage =
        "An unexpected error occurred while trying to load users for search."; // Default generic message
      // Adjust for apiClient error structure (err.status and err.data)
      if (err.status) {
        if (err.status === 403) {
          // Provide a more informative message for 403 on user list fetching
          specificMessage =
            err.data?.message ||
            "You do not have permission to view the list of users. This action may be restricted to certain roles (e.g., super-administrators).";
        } else if (err.data && err.data.message) {
          // Use message from backend response if available and not a 403, or if 403 had a specific message
          specificMessage = err.data.message;
        } else if (err.message) {
          // Fallback to generic error message from the error object if no backend message
          specificMessage = `Failed to load users: ${err.message}`;
        }
      } else if (err.message) {
        specificMessage = `Failed to load users: ${err.message}`; // Network error or other non-response error
      }
      setError(specificMessage); // Set the more specific message

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

export default function Dashboard() {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editTicket, setEditTicket] = useState(null);
  const [transferTicket, setTransferTicket] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null); // For transfer modal
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5); // Default items per page
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [showTicketReportModal, setShowTicketReportModal] = useState(false);

  // State for PDF Preview Modal (used in Payment Modal)
  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [pdfPreviewConfig, setPdfPreviewConfig] = useState({
    type: null,
    data: null,
  });
  const [uploadingDocType, setUploadingDocType] = useState(null); // To track which doc type is being uploaded
  const [statusChangeComment, setStatusChangeComment] = useState("");

  const { user: authUser, loading: authLoading } = useAuth();
  const auth = useAuth(); // Full auth context for logger
  const navigate = useNavigate();

  const [paymentReference, setPaymentReference] = useState("");
  const [ticketData, setTicketData] = useState({
    companyName: "",
    quotationNumber: "",
    billingAddress: {
      address1: "",
      address2: "",
      city: "",
      state: "",
      pincode: "",
    },
    shippingAddress: {
      address1: "",
      address2: "",
      city: "",
      state: "",
      pincode: "",
    },
    goods: [],
    totalQuantity: 0,
    totalAmount: 0,
    gstAmount: 0,
    grandTotal: 0,
    status: "Quotation Sent",
    documents: {
      quotation: null,
      po: null,
      pi: null,
      challan: null,
      packingList: null,
      feedback: null,
      other: [], // 'other' is an array of subdocuments
    },
    dispatchDays: "7-10 working",
    validityDate: new Date(
      new Date().setDate(new Date().getDate() + 15)
    ).toISOString(),
    clientPhone: "", // Added for PI
    clientGstNumber: "", // Added for PI
    termsAndConditions:
      "1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged if payment is not made within the stipulated time.\n3. Subject to Noida jurisdiction.",
  });
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "ascending",
  });
  const [
    isItemSearchDropdownOpenInEditModal,
    setIsItemSearchDropdownOpenInEditModal,
  ] = useState(false);
  const [transferHistoryDisplay, setTransferHistoryDisplay] = useState([]);

  const statusStages = [
    "Quotation Sent",
    "PO Received",
    "Payment Pending",
    "Inspection",
    "Packing List",
    "Invoice Sent",
    "Hold",
    "Closed",
  ];

  const fetchTickets = useCallback(async () => {
    if (!authUser) return; // Should be caught by useEffect redirect

    setIsLoading(true);
    setError(null);
    try {
      const token = getAuthTokenUtil(auth.user); // Use utility
      if (!token) {
        toast.error("Authentication required to fetch tickets. Please log in.");
        throw new Error("No authentication token found");
      }
      const data = await apiClient("/tickets", {
        params: {
          // Use apiClient
          populate:
            "currentAssignee,createdBy,transferHistory.from,transferHistory.to,transferHistory.transferredBy,statusHistory.changedBy,documents.quotation.uploadedBy,documents.po.uploadedBy,documents.pi.uploadedBy,documents.challan.uploadedBy,documents.packingList.uploadedBy,documents.feedback.uploadedBy,documents.other.uploadedBy",
        },
      });

      setTickets(data);
    } catch (error) {
      const errorMsg = handleApiError(
        error,
        "Failed to load tickets",
        auth.user,
        "ticketActivity"
      );
      setError(errorMsg);
      toast.error(errorMsg);
      frontendLogger.error(
        "ticketActivity",
        "Failed to fetch tickets",
        auth.user,
        {
          errorMessage: errorMsg,
          stack: error.stack,
          status: error.status, // apiClient error structure
          action: "FETCH_TICKETS_FAILURE",
        }
      );
      if (error.status === 401) {
        // apiClient error structure
        toast.error("Authentication failed. Please log in again.");
        navigate("/login", { state: { from: "/tickets" } });
      }
    } finally {
      setIsLoading(false);
    }
  }, [authUser, navigate, auth.user]); // Removed getAuthToken from dependencies as it's now a direct import

  useEffect(() => {
    // Effect for authentication check and initial data fetch
    if (!authLoading && !authUser) {
      if (window.location.pathname !== "/login") {
        toast.info("Redirecting to login page.");
        navigate("/login", { state: { from: "/tickets" } });
      }
    } else if (authUser) {
      fetchTickets();
    }
  }, [authUser, authLoading, navigate, fetchTickets]);

  useEffect(() => {}, [editTicket, ticketData.status, statusStages]);
  useEffect(() => {
    const activeDetailedTicket = showEditModal
      ? editTicket
      : showPaymentModal
      ? selectedTicket
      : null;

    if (activeDetailedTicket) {
      const history = [];

      let firstAssignee = activeDetailedTicket.createdBy;
      if (
        activeDetailedTicket.transferHistory &&
        activeDetailedTicket.transferHistory.length > 0
      ) {
        firstAssignee =
          activeDetailedTicket.transferHistory[0].from ||
          activeDetailedTicket.createdBy;
      } else if (activeDetailedTicket.currentAssignee) {
        firstAssignee = activeDetailedTicket.currentAssignee;
      }

      history.push({
        name: firstAssignee
          ? `${firstAssignee.firstname} ${firstAssignee.lastname}`
          : "System/N/A",
        date: activeDetailedTicket.createdAt,
        note: "Ticket Created",
      });

      activeDetailedTicket.transferHistory?.forEach((transfer) => {
        history.push({
          name: transfer.to
            ? `${transfer.to.firstname} ${transfer.to.lastname}`
            : "N/A",
          date: transfer.transferredAt || new Date(),
          note: transfer.note || "N/A",
        });
      });
      setTransferHistoryDisplay(history);
    }
  }, [editTicket, selectedTicket, showEditModal, showPaymentModal]);

  const handleDelete = async (ticketToDelete) => {
    if (!authUser || authUser.role !== "super-admin") {
      const msg = "You do not have permission to delete this ticket.";
      setError(msg);
      toast.warn(msg);
      frontendLogger.warn(
        "ticketActivity",
        "Delete permission denied",
        auth.user,
        {
          ticketId: ticketToDelete?._id,
          ticketNumber: ticketToDelete?.ticketNumber,
          action: "DELETE_TICKET_PERMISSION_DENIED",
        }
      );
      return;
    }
    if (
      window.confirm(
        `Are you sure you want to permanently delete ticket ${ticketToDelete.ticketNumber}?`
      )
    ) {
      setIsLoading(true);
      try {
        const token = getAuthTokenUtil(auth.user); // Use utility
        if (!token) {
          toast.error("Authentication required for delete operation.");
          throw new Error(
            "Authentication token not found for delete operation."
          );
        }
        await apiClient(`/tickets/admin/${ticketToDelete._id}`, {
          method: "DELETE",
        }); // Use apiClient

        fetchTickets();
        setError(null);
        const successMsg = `Ticket ${ticketToDelete.ticketNumber} deleted successfully.`;
        toast.success(successMsg);
        frontendLogger.info("ticketActivity", successMsg, auth.user, {
          ticketId: ticketToDelete._id,
          ticketNumber: ticketToDelete.ticketNumber,
          action: "DELETE_TICKET_SUCCESS",
        });
      } catch (error) {
        const errorMsg = handleApiError(
          error,
          "Delete failed",
          auth.user,
          "ticketActivity"
        );
        setError(errorMsg);
        toast.error(errorMsg);
        frontendLogger.error(
          "ticketActivity",
          `Failed to delete ticket ${ticketToDelete.ticketNumber}`,
          auth.user,
          {
            ticketId: ticketToDelete._id,
            ticketNumber: ticketToDelete.ticketNumber,
            errorMessage: error.data?.message || error.message, // apiClient error structure
            stack: error.stack,
            action: "DELETE_TICKET_FAILURE",
          }
        );
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleProgressClick = (ticket) => {
    setSelectedTicket(ticket);
    setPaymentAmount(
      ticket.grandTotal -
        (ticket.payments?.reduce((sum, p) => sum + p.amount, 0) || 0)
    );
    setShowPaymentModal(true);
  };

  const handlePaymentSubmit = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getAuthTokenUtil(auth.user); // Use utility
      if (!token) {
        toast.error("Authentication required to record payment.");
        throw new Error("No authentication token found");
      }
      const responseData = await apiClient(
        `/tickets/${selectedTicket?._id}/payments`,
        {
          // Use apiClient
          method: "POST",
          body: {
            amount: paymentAmount,
            date: paymentDate,
            reference: paymentReference,
          },
        }
      );
      if (responseData) {
        // apiClient returns data on success
        await fetchTickets();
        setShowPaymentModal(false);
        const successMsg = "Payment recorded successfully!";
        toast.success(successMsg);
        frontendLogger.info("paymentActivity", successMsg, auth.user, {
          ticketId: selectedTicket?._id,
          amount: paymentAmount,
          action: "RECORD_PAYMENT_SUCCESS",
        });
        setPaymentAmount(0);
        setPaymentReference("");
      }
    } catch (error) {
      const errorMsg = handleApiError(
        error,
        "Failed to record payment",
        auth.user,
        "paymentActivity"
      );
      setError(errorMsg);
      toast.error(errorMsg);
      frontendLogger.error(
        "paymentActivity",
        "Failed to record payment",
        auth.user,
        {
          ticketId: selectedTicket?._id,
          amount: paymentAmount,
          errorMessage: error.data?.message || error.message, // apiClient error structure
          stack: error.stack,
          action: "RECORD_PAYMENT_FAILURE",
        }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const sortedTickets = useMemo(() => {
    if (!sortConfig.key) return tickets;
    return [...tickets].sort((a, b) => {
      if (sortConfig.key === "date") {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return sortConfig.direction === "ascending"
          ? dateA - dateB
          : dateB - dateA;
      }
      if (sortConfig.key === "grandTotal") {
        return sortConfig.direction === "ascending"
          ? a.grandTotal - b.grandTotal
          : b.grandTotal - a.grandTotal;
      }
      if (a[sortConfig.key] < b[sortConfig.key])
        return sortConfig.direction === "ascending" ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key])
        return sortConfig.direction === "ascending" ? 1 : -1;
      return 0;
    });
  }, [tickets, sortConfig]);

  const filteredTickets = useMemo(() => {
    let filtered = sortedTickets;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (ticket) =>
          ticket.ticketNumber?.toLowerCase().includes(term) ||
          ticket.quotationNumber?.toLowerCase().includes(term) ||
          ticket.companyName?.toLowerCase().includes(term) ||
          ticket.client?.companyName?.toLowerCase().includes(term) ||
          ticket.goods.some(
            (item) =>
              item.description?.toLowerCase().includes(term) ||
              item.hsnSacCode?.toLowerCase().includes(term)
          )
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((ticket) => {
        if (statusFilter === "open") {
          return ticket.status !== "Closed" && ticket.status !== "Hold";
        } else if (statusFilter === "closed") {
          return ticket.status === "Closed";
        } else if (statusFilter === "hold") {
          return ticket.status === "Hold";
        }
        return true; // Should not happen if statusFilter is one of the valid options
      });
    }

    return filtered;
  }, [sortedTickets, searchTerm, statusFilter]);

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to the first page when items per page changes
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTickets.slice(indexOfFirstItem, indexOfLastItem);

  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const addRow = () => {
    setTicketData((prev) => ({
      ...prev,
      goods: [
        ...prev.goods,
        {
          srNo: prev.goods.length + 1,
          description: "",
          hsnSacCode: "",
          quantity: 1,
          price: 0,
          amount: 0,
        },
      ],
    }));
  };

  const handleItemSelect = (item, index) => {
    const updatedGoods = [...ticketData.goods];
    updatedGoods[index] = {
      ...updatedGoods[index],
      description: item.name,
      hsnSacCode: item.hsnCode,
      price: item.price,
      amount: (updatedGoods[index].quantity || 1) * item.price,
      originalPrice: item.price,
      maxDiscountPercentage: item.maxDiscountPercentage,
      gstRate: item.gstRate || 0, // Added GST Rate
    };
    updateTotals(updatedGoods);
  };

  const handleGoodsChange = (index, field, value) => {
    const updatedGoods = [...ticketData.goods];

    if (["quantity", "price", "gstRate"].includes(field)) {
      value = Number(value) || 0;
    }

    // Update the specific field
    updatedGoods[index][field] = value;

    // Recalculate amount if quantity or price changes
    if (field === "quantity" || field === "price") {
      updatedGoods[index].amount =
        (Number(updatedGoods[index].quantity) || 0) *
        (Number(updatedGoods[index].price) || 0);
    }

    // Update the state with the new goods array
    setTicketData((prev) => ({
      ...prev,
      goods: updatedGoods,
    }));

    // Then update totals based on the new goods array
    updateTotals(updatedGoods);
  };

  const updateTotals = (goods) => {
    const totalQuantity = goods.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );
    const totalAmount = goods.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const gstAmount = goods.reduce(
      (sum, item) =>
        sum + Number(item.amount || 0) * (Number(item.gstRate || 0) / 100),
      0
    );
    const grandTotal = totalAmount + gstAmount;

    setTicketData((prev) => ({
      ...prev,
      goods: goods,
      totalQuantity,
      totalAmount,
      gstAmount,
      grandTotal,
    }));
  };
  const validateItemPrice = (item) => {
    const newPrice = parseFloat(item.price);
    const originalPrice = parseFloat(item.originalPrice || item.price);
    const maxDiscountPerc = parseFloat(item.maxDiscountPercentage);
    let priceValidationError = null;

    if (!isNaN(newPrice) && !isNaN(originalPrice)) {
      if (!isNaN(maxDiscountPerc) && maxDiscountPerc > 0) {
        const minAllowedPrice = originalPrice * (1 - maxDiscountPerc / 100);
        if (newPrice < minAllowedPrice) {
          priceValidationError = `Discount for ${
            item.description
          } exceeds the maximum allowed ${maxDiscountPerc}%. Minimum price is ₹${minAllowedPrice.toFixed(
            2
          )}.`;
        }
      } else {
        if (newPrice < originalPrice) {
          priceValidationError = `Price for ${
            item.description
          } (₹${newPrice.toFixed(
            2
          )}) cannot be lower than the original price (₹${originalPrice.toFixed(
            2
          )}) as no discount is applicable.`;
        }
      }
    } else if (String(item.price).trim() !== "" && isNaN(newPrice)) {
      priceValidationError = `Invalid price entered for ${item.description}.`;
    }

    if (priceValidationError) {
      setError(priceValidationError); // Set form error
      toast.warn(priceValidationError); // Show toast
      return false;
    } else {
      if (
        error &&
        (error.includes(`Discount for ${item.description}`) ||
          error.includes(`Price for ${item.description}`))
      ) {
        setError(null); // Clear form error if it was related
      }
      return true;
    }
  };

  const handleAddItemToTicket = (item) => {
    // New handler for adding item in edit modal
    const itemExists = ticketData.goods.some(
      (existingItem) => existingItem.description === item.name
    );
    if (itemExists) {
      toast.warn("This item is already added to the ticket.");
      return;
    }
    const newGoods = [
      ...ticketData.goods,
      {
        srNo: ticketData.goods.length + 1,
        description: item.name,
        hsnSacCode: item.hsnCode || "",
        quantity: 1,
        unit: item.unit || "Nos",
        price: item.price,
        amount: item.price, // Initial amount
        originalPrice: item.price,
        maxDiscountPercentage: item.maxDiscountPercentage,
        gstRate: item.gstRate || 0, // Added GST Rate
      },
    ];
    updateTotals(newGoods); // This will set ticketData
  };

  const handleEdit = (selectedTicketToEdit) => {
    setEditTicket(selectedTicketToEdit);

    const billingAddress = Array.isArray(selectedTicketToEdit.billingAddress)
      ? {
          address1: selectedTicketToEdit.billingAddress[0] || "",
          address2: selectedTicketToEdit.billingAddress[1] || "",
          city: selectedTicketToEdit.billingAddress[3] || "",
          state: selectedTicketToEdit.billingAddress[2] || "",
          pincode: selectedTicketToEdit.billingAddress[4] || "",
        }
      : selectedTicketToEdit.billingAddress || {
          address1: "",
          address2: "",
          city: "",
          state: "",
          pincode: "",
        };

    const shippingAddress = Array.isArray(selectedTicketToEdit.shippingAddress)
      ? {
          address1: selectedTicketToEdit.shippingAddress[0] || "",
          address2: selectedTicketToEdit.shippingAddress[1] || "",
          city: selectedTicketToEdit.shippingAddress[3] || "",
          state: selectedTicketToEdit.shippingAddress[2] || "",
          pincode: selectedTicketToEdit.shippingAddress[4] || "",
        }
      : selectedTicketToEdit.shippingAddress || {
          address1: "",
          address2: "",
          city: "",
          state: "",
          pincode: "",
        };

    setTicketData({
      companyName: selectedTicketToEdit.companyName || "",
      quotationNumber: selectedTicketToEdit.quotationNumber || "",
      billingAddress,
      shippingAddress,
      goods:
        selectedTicketToEdit.goods.map((g) => ({
          ...g,
          originalPrice: g.originalPrice || g.price,
          // discountAvailable: g.discountAvailable, // Removed as per Quotations.jsx
          maxDiscountPercentage: g.maxDiscountPercentage || 0,
          gstRate: g.gstRate || 0,
        })) || [],
      totalQuantity: selectedTicketToEdit.totalQuantity || 0,
      totalAmount: selectedTicketToEdit.totalAmount || 0,
      gstAmount: selectedTicketToEdit.gstAmount || 0,
      grandTotal: selectedTicketToEdit.grandTotal || 0,
      status: selectedTicketToEdit.status || statusStages[0],
      documents: selectedTicketToEdit.documents || ticketData.documents,
      dispatchDays: selectedTicketToEdit.dispatchDays || "7-10 working",
      validityDate:
        selectedTicketToEdit.validityDate ||
        new Date(new Date().setDate(new Date().getDate() + 15)).toISOString(),
      clientPhone: selectedTicketToEdit.clientPhone || "",
      clientGstNumber: selectedTicketToEdit.clientGstNumber || "",
      shippingSameAsBilling:
        selectedTicketToEdit.shippingSameAsBilling || false, // Load this
      termsAndConditions:
        selectedTicketToEdit.termsAndConditions ||
        ticketData.termsAndConditions,
    });
    setShowEditModal(true);
    setError(null); // Clear any previous errors when opening modal
  };

  const handleDeleteItemFromTicket = (indexToDelete) => {
    const updatedGoods = ticketData.goods.filter(
      (_, index) => index !== indexToDelete
    );
    const renumberedGoods = updatedGoods.map((item, index) => ({
      ...item,
      srNo: index + 1,
    }));
    // Update totals based on renumberedGoods
    updateTotals(renumberedGoods);
  };

  const handleTransfer = (ticketToTransfer) => {
    setTransferTicket(ticketToTransfer);
    setSelectedUser(null);
    setError(null);
    setShowTransferModal(true);
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
    setError(null);
  };

  const handleStatusChange = (status) => {
    setTicketData({ ...ticketData, status });
    // Reset comment when status changes, forcing user to enter a new one
    // if the new status is different from the original status in editTicket
    if (editTicket && status !== editTicket.status) {
      setStatusChangeComment("");
    }
  };

  const handleUpdateTicket = async () => {
    setIsLoading(true);
    setError(null);
    try {
      for (const item of ticketData.goods) {
        if (!validateItemPrice(item)) {
          // Error is set and toasted by validateItemPrice
          setIsLoading(false);
          return;
        }
      }
      if (error && error.includes("exceeds the maximum allowed")) {
        setError(null); // Clear specific price validation error if all items are now valid
      }

      // Check for mandatory status change comment if status has changed
      if (
        editTicket &&
        ticketData.status !== editTicket.status &&
        !statusChangeComment.trim()
      ) {
        toast.warn("Please provide a comment for the status change.");
        setIsLoading(false);
        return;
      }

      const token = getAuthTokenUtil(auth.user); // Use utility
      if (!token) {
        toast.error("Authentication required to update ticket.");
        throw new Error("Authentication token not found");
      }

      const updateData = {
        ...ticketData,
        _id: undefined, // Ensure these are not sent
        statusChangeComment:
          ticketData.status !== editTicket?.status
            ? statusChangeComment
            : undefined, // Only send if status changed
        shippingSameAsBilling: ticketData.shippingSameAsBilling,
        __v: undefined,
        createdAt: undefined,
        updatedAt: undefined,
        billingAddress: [
          ticketData.billingAddress.address1,
          ticketData.billingAddress.address2,
          ticketData.billingAddress.state,
          ticketData.billingAddress.city,
          ticketData.billingAddress.pincode,
        ],
        // shippingAddress will be determined based on shippingSameAsBilling
        // This logic is now handled in the backend controller based on the flag
        // However, frontend should still send the current shippingAddress object if not sameAsBilling
        // Backend will prioritize the flag.
        // For consistency with how backend updateTicket is structured, send the current shippingAddress array
        // if shippingSameAsBilling is false. If true, backend will use billingAddress.
        shippingAddress: ticketData.shippingSameAsBilling
          ? [
              // If same, can send billing or let backend handle it. Sending billing for explicitness.
              ticketData.billingAddress.address1,
              ticketData.billingAddress.address2,
              ticketData.billingAddress.state,
              ticketData.billingAddress.city,
              ticketData.billingAddress.pincode,
            ]
          : [
              ticketData.shippingAddress.address1,
              ticketData.shippingAddress.address2,
              ticketData.shippingAddress.state,
              ticketData.shippingAddress.city,
              ticketData.shippingAddress.pincode,
            ],
        goods: ticketData.goods.map((g) => ({
          ...g,
          originalPrice: g.originalPrice,
          maxDiscountPercentage: g.maxDiscountPercentage || 0,
          gstRate: g.gstRate || 0,
        })),
      };

      const responseData = await apiClient(`/tickets/${editTicket._id}`, {
        // Use apiClient
        method: "PUT",
        body: updateData, // Ensure updateData is passed as the body
      });
      if (responseData) {
        // apiClient returns data on success
        fetchTickets();
        setShowEditModal(false);
        setError(null);
        const successMsg = `Ticket ${editTicket.ticketNumber} updated successfully!`;
        toast.success(successMsg);
        frontendLogger.info("ticketActivity", successMsg, auth.user, {
          ticketId: editTicket._id,
          ticketNumber: editTicket.ticketNumber,
          action: "UPDATE_TICKET_SUCCESS",
          statusChangeCommentProvided:
            ticketData.status !== editTicket?.status
              ? !!statusChangeComment
              : undefined,
        });
      }
    } catch (error) {
      const errorMsg = handleApiError(
        error,
        "Failed to update ticket",
        auth.user,
        "ticketActivity"
      );
      setError(errorMsg);
      toast.error(errorMsg);
      frontendLogger.error(
        "ticketActivity",
        `Failed to update ticket ${editTicket?.ticketNumber}`,
        auth.user,
        {
          ticketId: editTicket?._id,
          ticketNumber: editTicket?.ticketNumber,
          errorMessage: error.data?.message || error.message, // apiClient error structure
          stack: error.stack,
          submittedData: ticketData, // Be cautious with logging full data
          statusChangeCommentAttempted:
            ticketData.status !== editTicket?.status
              ? statusChangeComment
              : undefined,
          action: "UPDATE_TICKET_FAILURE",
        }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTransferTicket = async (userToTransferTo, note) => {
    if (!userToTransferTo) {
      const msg = "Please select a user to transfer the ticket to.";
      setError(msg);
      toast.warn(msg);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const token = getAuthTokenUtil(auth.user); // Use utility
      if (!token) {
        toast.error("Authentication required to transfer ticket.");
        throw new Error("Authentication token not found");
      }
      const responseData = await apiClient(
        `/tickets/${transferTicket._id}/transfer`,
        {
          // Use apiClient
          method: "POST",
          body: { userId: userToTransferTo._id, note },
        }
      );

      if (responseData && responseData.ticket) {
        const updatedTicketFromServer = responseData.ticket;
        setTickets((prevTickets) =>
          prevTickets.map((t) =>
            t._id === updatedTicketFromServer._id ? updatedTicketFromServer : t
          )
        );
        setTransferTicket(updatedTicketFromServer); // Update the ticket in transfer modal if needed
        setError(null);
        setShowTransferModal(false);
        const successMsg = `Ticket successfully transferred to ${updatedTicketFromServer.currentAssignee.firstname} ${updatedTicketFromServer.currentAssignee.lastname}`;
        toast.success(successMsg);
        frontendLogger.info("ticketActivity", successMsg, auth.user, {
          ticketId: transferTicket._id,
          transferredTo: userToTransferTo._id,
          action: "TRANSFER_TICKET_SUCCESS",
        });
      }
    } catch (error) {
      let detailedErrorMessage =
        error.data?.details || error.data?.message || error.message; // apiClient error structure
      if (!detailedErrorMessage) {
        // Fallback if error.data is not as expected
        detailedErrorMessage = "An unexpected error occurred during transfer.";
      }
      const errorMsg = `Failed to transfer ticket: ${detailedErrorMessage}`;
      setError(errorMsg);
      toast.error(errorMsg);
      frontendLogger.error(
        "ticketActivity",
        `Failed to transfer ticket ${transferTicket?._id}`,
        auth.user,
        {
          ticketId: transferTicket?._id,
          attemptedTransferTo: userToTransferTo?._id,
          errorMessage: detailedErrorMessage,
          stack: error.stack,
          action: "TRANSFER_TICKET_FAILURE",
        }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderPdfPreview = (previewType, ticketForPdf) => {
    if (!previewType || !ticketForPdf) return null;

    const currentTicketForPdf = {
      ...ticketForPdf,
      documents: ticketForPdf.documents || {},
    };

    const getAddressString = (addressObj) => {
      if (!addressObj) return "N/A";
      if (Array.isArray(addressObj)) {
        return addressObj.filter(Boolean).join(", ");
      }
      let parts = [];
      if (addressObj.address1) parts.push(addressObj.address1);
      if (addressObj.address2) parts.push(addressObj.address2);
      if (addressObj.city) parts.push(addressObj.city);
      if (addressObj.state) parts.push(addressObj.state);
      if (addressObj.pincode) parts.push(addressObj.pincode);
      return parts.join(", ").replace(/ ,/g, ",");
    };

    const pdfData = currentTicketForPdf
      ? {
          // Common fields
          ...currentTicketForPdf,
          // Fields specific to QuotationPDF
          referenceNumber: currentTicketForPdf.quotationNumber,
          date: currentTicketForPdf.createdAt,
          shippingSameAsBilling:
            currentTicketForPdf.shippingSameAsBilling || false,
          goods: currentTicketForPdf.goods.map((item) => ({
            ...item,
            gstRate: item.gstRate || 0,

            unit: item.unit || "Nos",
          })),
          dispatchDays: currentTicketForPdf.dispatchDays || "7-10 working",
          validityDate:
            currentTicketForPdf.validityDate ||
            new Date(
              new Date().setDate(new Date().getDate() + 15)
            ).toISOString(),
        }
      : null;

    if (!pdfData)
      return (
        <Alert variant="warning">Could not load data for PDF preview.</Alert>
      );

    return (
      <div className="mt-4 p-3 border rounded bg-light">
        <h5 className="mb-3">
          <i
            className={`bi ${
              previewType === "quotation"
                ? "bi-file-earmark-text"
                : "bi-file-earmark-medical"
            }`}
          ></i>{" "}
          {previewType.toUpperCase()} Preview
        </h5>
        {previewType === "quotation" && (
          <div className="document-preview-container">
            <PDFViewer width="100%" height="500px" className="mb-3">
              <QuotationPDF quotation={pdfData} />
            </PDFViewer>
            <div className="d-flex justify-content-center gap-2 mt-3">
              <PDFDownloadLink
                document={<QuotationPDF quotation={pdfData} />}
                fileName={`quotation_${pdfData.referenceNumber}.pdf`}
              >
                {({ loading }) => (
                  <Button variant="primary" disabled={loading}>
                    <i className="bi bi-download me-2"></i>
                    {loading
                      ? "Generating..."
                      : `Download ${previewType.toUpperCase()}`}
                  </Button>
                )}
              </PDFDownloadLink>
              <Button
                variant="secondary"
                onClick={() => setShowPdfPreviewModal(false)}
              >
                <i className="bi bi-x-circle me-2"></i>Close Preview
              </Button>
            </div>
          </div>
        )}
        {previewType === "pi" && (
          <div className="document-preview-container">
            <PDFViewer width="100%" height="500px" className="mb-3">
              <PIPDF ticket={pdfData} />
            </PDFViewer>
            <div className="d-flex justify-content-center gap-2 mt-3">
              <PDFDownloadLink
                document={<PIPDF ticket={pdfData} />}
                fileName={`pi_${pdfData.quotationNumber}.pdf`}
              >
                {({ loading }) => (
                  <Button variant="primary" disabled={loading}>
                    <i className="bi bi-download me-2"></i>
                    {loading
                      ? "Generating..."
                      : `Download ${previewType.toUpperCase()}`}
                  </Button>
                )}
              </PDFDownloadLink>
              <Button
                variant="secondary"
                onClick={() => setShowPdfPreviewModal(false)}
              >
                <i className="bi bi-x-circle me-2"></i>Close Preview
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleSpecificDocumentUpload = async (
    file,
    docType,
    ticketIdForUpload = null
  ) => {
    if (!file) {
      toast.warn("Please select a file to upload");
      return false;
    }
    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      toast.warn("File size should be less than 5MB");
      return false;
    }

    const targetTicketId =
      ticketIdForUpload || editTicket?._id || selectedTicket?._id;

    setIsLoading(true);
    setError(null);
    try {
      const token = getAuthTokenUtil(auth.user); // Use utility
      if (!token) {
        toast.error("Authentication required to upload document.");
        throw new Error("Authentication token not found");
      }
      const formData = new FormData();
      formData.append("document", file);
      formData.append("documentType", docType);

      const responseData = await apiClient(
        `/tickets/${targetTicketId}/documents`,
        {
          // Use apiClient
          method: "POST",
          formData,
        }
      );
      if (!responseData || !responseData.documents) {
        throw new Error("Invalid response from server after document upload");
      }

      // Instead of updating local state directly, fetch all tickets or the specific ticket
      // to ensure data consistency, especially if the payment modal is open.
      await fetchTickets(); // Re-fetch all tickets to update the list and selectedTicket

      // If the payment modal is open and showing selectedTicket, update it
      if (
        showPaymentModal &&
        selectedTicket &&
        selectedTicket?._id === targetTicketId
      ) {
        const updatedSingleTicket = await apiClient(
          `/tickets/${targetTicketId}`,
          {
            // Use apiClient
            params: {
              populate:
                "currentAssignee,createdBy,transferHistory.from,transferHistory.to,transferHistory.transferredBy,statusHistory.changedBy,documents.quotation.uploadedBy,documents.po.uploadedBy,documents.pi.uploadedBy,documents.challan.uploadedBy,documents.packingList.uploadedBy,documents.feedback.uploadedBy,documents.other.uploadedBy",
            },
          }
        );
        setSelectedTicket(updatedSingleTicket);
      }

      const successMsg = `${docType.toUpperCase()} document uploaded successfully.`;
      toast.success(successMsg);
      frontendLogger.info("documentActivity", successMsg, auth.user, {
        action: "UPLOAD_DOCUMENT_SUCCESS",
      });
      return true;
    } catch (error) {
      const errorMsg = `Failed to upload document: ${
        error.response?.data?.message || error.message
      }`;
      setError(errorMsg);
      toast.error(errorMsg);
      frontendLogger.error(
        "documentActivity",
        `Failed to upload document (${docType}) for ticket ${targetTicketId}`,
        auth.user,
        {
          ticketId: targetTicketId,
          errorMessage: error.data?.message || error.message, // apiClient error structure
          stack: error.stack,
          action: "UPLOAD_DOCUMENT_FAILURE",
        }
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleDocumentDelete = async (
    docTypeToDelete,
    documentPathToDelete,
    ticketIdForDelete = null
  ) => {
    setIsLoading(true);
    setError(null);

    const targetTicketId =
      ticketIdForDelete || editTicket?._id || selectedTicket?._id;

    try {
      const token = getAuthTokenUtil(auth.user); // Use utility
      if (!token) {
        toast.error("Authentication required to delete document.");
        throw new Error("No authentication token found");
      }

      if (!documentPathToDelete) {
        toast.warn("Document path not found for deletion.");
        setIsLoading(false);
        return;
      }

      await apiClient(`/tickets/${targetTicketId}/documents`, {
        // Use apiClient
        method: "DELETE",
        body: {
          documentType: docTypeToDelete,
          documentPath: documentPathToDelete,
        },
      });

      // Re-fetch tickets or specific ticket
      await fetchTickets();
      if (
        showPaymentModal &&
        selectedTicket &&
        selectedTicket?._id === targetTicketId
      ) {
        const updatedSingleTicket = await apiClient(
          `/tickets/${targetTicketId}`,
          {
            // Use apiClient
            params: {
              populate:
                "currentAssignee,createdBy,transferHistory.from,transferHistory.to,transferHistory.transferredBy,statusHistory.changedBy,documents.quotation.uploadedBy,documents.po.uploadedBy,documents.pi.uploadedBy,documents.challan.uploadedBy,documents.packingList.uploadedBy,documents.feedback.uploadedBy,documents.other.uploadedBy",
            },
          }
        );
        setSelectedTicket(updatedSingleTicket);
      }
      if (showEditModal && editTicket && editTicket?._id === targetTicketId) {
        const updatedSingleTicket = await apiClient(
          `/tickets/${targetTicketId}`,
          {
            // Use apiClient
            params: {
              populate:
                "currentAssignee,createdBy,transferHistory.from,transferHistory.to,transferHistory.transferredBy,statusHistory.changedBy,documents.quotation.uploadedBy,documents.po.uploadedBy,documents.pi.uploadedBy,documents.challan.uploadedBy,documents.packingList.uploadedBy,documents.feedback.uploadedBy,documents.other.uploadedBy",
            },
          }
        );
        setEditTicket(updatedSingleTicket);
      }

      const successMsg = `${docTypeToDelete.toUpperCase()} document deleted successfully.`;
      toast.success(successMsg);
      frontendLogger.info("documentActivity", successMsg, auth.user, {
        deletedPath: documentPathToDelete,
        action: "DELETE_DOCUMENT_SUCCESS",
      });
    } catch (error) {
      const errorMsg = `Failed to delete document: ${
        error.response?.data?.message || error.message
      }`;
      setError(errorMsg);
      toast.error(errorMsg);
      frontendLogger.error(
        "documentActivity",
        `Failed to delete document (${docTypeToDelete}) for ticket ${targetTicketId}`,
        auth.user,
        {
          ticketId: targetTicketId,
          attemptedDeletePath: documentPathToDelete,
          errorMessage: error.data?.message || error.message, // apiClient error structure
          stack: error.stack,
          action: "DELETE_DOCUMENT_FAILURE",
        }
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderAddressFields = (type, isDisabled = false) => {
    // Added isDisabled prop
    const addressKey = `${type}Address`; // type is 'billing' or 'shipping'    const address = ticketData[addressKey] || {};
    const address = ticketData[addressKey] || {}; // This line was missing
    const handleChange = (field, value) => {
      setTicketData((prev) => ({
        ...prev,
        [addressKey]: { ...(prev[addressKey] || {}), [field]: value },
      }));
    };
    return (
      <div className="mb-3">
        <div className="row g-2">
          <Form.Group className="col-md-6">
            <Form.Control
              placeholder="Address Line 1"
              value={address.address1 || ""}
              onChange={(e) => handleChange("address1", e.target.value)}
              disabled={isDisabled} // Apply disabled state
            />
          </Form.Group>
          <Form.Group className="col-md-6">
            <Form.Control
              placeholder="Address Line 2"
              value={address.address2 || ""}
              onChange={(e) => handleChange("address2", e.target.value)}
              disabled={isDisabled}
            />
          </Form.Group>
          <Form.Group className="col-md-4">
            <Form.Control
              placeholder="City"
              value={address.city || ""}
              onChange={(e) => handleChange("city", e.target.value)}
              disabled={isDisabled}
            />
          </Form.Group>
          <Form.Group className="col-md-4">
            <Form.Control
              placeholder="State"
              value={address.state || ""}
              onChange={(e) => handleChange("state", e.target.value)}
              disabled={isDisabled}
            />
          </Form.Group>
          <Form.Group className="col-md-4">
            <Form.Control
              placeholder="Pincode"
              value={address.pincode || ""}
              onChange={(e) => handleChange("pincode", e.target.value)}
              disabled={isDisabled}
            />
          </Form.Group>
        </div>
      </div>
    );
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "Quotation Sent":
        return "info";
      case "PO Received":
        return "primary";
      case "Payment Pending":
        return "warning";
      case "Inspection":
        return "secondary";
      case "Packing List":
        return "dark";
      case "Invoice Sent":
        return "success";
      case "Hold":
        return "danger"; // Changed Hold to danger for better visibility
      case "Closed":
        return "success";
      default:
        return "dark";
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
              variant={isCompleted ? getStatusBadgeColor(stage) : "secondary"} // Use status color
              label={isCurrent ? stage : ""}
              animated={isCurrent}
              onClick={() => handleStatusChange(stage)}
              style={{
                cursor: "pointer",
                transition: "background-color 0.3s ease",
              }}
              title={`Set status to: ${stage}`}
            />
          );
        })}
      </ProgressBar>
      <div className="d-flex justify-content-between mt-2">
        {statusStages.map((stage) => (
          <small
            key={stage}
            className={`text-center ${
              ticketData.status === stage
                ? `fw-bold text-${getStatusBadgeColor(stage)}`
                : "text-muted"
            }`}
            style={{
              width: `${100 / statusStages.length}%`,
              cursor: "pointer",
              transition: "color 0.3s ease, font-weight 0.3s ease",
            }}
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
        <Button
          variant="outline-secondary"
          onClick={() => {
            setShowTransferModal(false);
            setError(null);
            setSelectedUser(null);
            setTransferNote("");
          }}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => handleTransferTicket(selectedUser, transferNote)}
          disabled={!selectedUser || isLoading}
          className="px-4"
        >
          {isLoading ? "Transferring..." : "Confirm Transfer"}
        </Button>
      </>
    );

    return (
      <ReusableModal
        show={showTransferModal}
        onHide={() => {
          setShowTransferModal(false);
          setError(null);
          setSelectedUser(null);
          setTransferNote("");
        }}
        title={
          <>
            <i className="bi bi-arrow-left-right me-2"></i>Transfer Ticket -{" "}
            {transferTicket?.ticketNumber}
          </>
        }
        footerContent={transferModalFooter}
        isLoading={isLoading}
      >
        <div className="mb-4">
          <h5
            className="mb-3"
            style={{
              fontWeight: "bold",
              textAlign: "center",
              backgroundColor: "#f0f2f5",
              padding: "0.5rem",
              borderRadius: "0.25rem",
              // marginBottom: "1rem", // Already has mb-3
            }}
          >
            <i className="bi bi-search me-2"></i>Search User to Transfer To
          </h5>
          <UserSearchComponent
            onUserSelect={handleUserSelect}
            authContext={auth}
          />

          {/* This div will ensure suggestions are contained if UserSearchComponent's dropdown has position:absolute */}
          <div style={{ position: "relative", zIndex: 1050 }}>
            {/* UserSearchComponent's dropdown will render here if it's a child or uses a portal properly */}
          </div>
        </div>

        {selectedUser && (
          <>
            <div className="selected-user-info p-4 border rounded bg-light">
              <h6 className="mb-3">
                <i className="bi bi-person-circle me-2"></i>Selected User
                Details:
              </h6>
              <div className="row">
                <div className="col-md-6">
                  <p>
                    <i className="bi bi-person me-2"></i>
                    <strong>Name:</strong> {selectedUser.firstname}{" "}
                    {selectedUser.lastname}
                  </p>
                  <p>
                    <i className="bi bi-envelope me-2"></i>
                    <strong>Email:</strong> {selectedUser.email}
                  </p>
                </div>
                <div className="col-md-6">
                  <p>
                    <i className="bi bi-person-badge me-2"></i>
                    <strong>Role:</strong>{" "}
                    <Badge bg="info">{selectedUser.role}</Badge>
                  </p>
                  <p>
                    <strong>Department:</strong>{" "}
                    {selectedUser.department || "N/A"}
                  </p>
                </div>
              </div>
            </div>

            <Form.Group className="mt-3">
              <Form.Label>Transfer Note (Optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                placeholder="Add any notes about this transfer..."
              />
            </Form.Group>
          </>
        )}

        {error && ( // Display error if any, regardless of selectedUser
          <Alert variant="danger" className="mt-3">
            {error}
          </Alert>
        )}

        {transferTicket && (
          <div className="ticket-summary mt-4 p-3 border rounded">
            <h5
              className="mb-3" // Changed to h5 for consistency with other styled headings
              style={{
                fontWeight: "bold",
                textAlign: "center",
                backgroundColor: "#f0f2f5",
                padding: "0.5rem",
                borderRadius: "0.25rem",
                // marginBottom: "1rem", // Already has mb-3 from parent
              }}
            >
              Ticket Summary
            </h5>
            <div className="row">
              <div className="col-md-6">
                <p>
                  <strong>Company:</strong> {transferTicket.companyName}
                </p>
                <p>
                  <strong>Quotation:</strong> {transferTicket.quotationNumber}
                </p>
                <p>
                  <strong>Current Assignee:</strong>{" "}
                  {transferTicket.currentAssignee?.firstname}{" "}
                  {transferTicket.currentAssignee?.lastname || "N/A"}
                </p>
              </div>
              <div className="col-md-6">
                <p>
                  <strong>Status:</strong>{" "}
                  <Badge bg={getStatusBadgeColor(transferTicket.status)}>
                    {transferTicket.status}
                  </Badge>
                </p>
                <p>
                  <strong>Amount:</strong> ₹
                  {transferTicket.grandTotal?.toFixed(2)}
                </p>
                <p>
                  <strong>Created By:</strong>{" "}
                  {transferTicket.createdBy?.firstname}{" "}
                  {transferTicket.createdBy?.lastname || "N/A"}
                </p>
              </div>
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
        <div
          className="d-flex justify-content-between align-items-center mb-4 flex-wrap"
          style={{ gap: "1rem" }}
        >
          <h2 style={{ color: "black", margin: 0, whiteSpace: "nowrap" }}>
            Tickets Overview
          </h2>

          <div
            className="d-flex align-items-center"
            style={{ minWidth: "200px", flexGrow: 1, maxWidth: "350px" }}
          >
            <SearchBar
              value={searchTerm}
              setSearchTerm={(value) => {
                setSearchTerm(value);
                setCurrentPage(1); // Reset page on new search
              }}
              placeholder="Search tickets..."
              className="w-100"
            />
          </div>

          <div
            className="filter-radio-group d-flex align-items-center flex-wrap"
            style={{ gap: "0.5rem" }}
          >
            <Form.Check
              type="radio"
              inline
              id="filter-all"
              label="All"
              name="statusFilter"
              checked={statusFilter === "all"}
              onChange={() => {
                setStatusFilter("all");
                setCurrentPage(1);
              }}
              className="radio-option"
            />
            <Form.Check
              type="radio"
              inline
              id="filter-open"
              label="Open"
              name="statusFilter"
              checked={statusFilter === "open"}
              onChange={() => {
                setStatusFilter("open");
                setCurrentPage(1);
              }}
              className="radio-option"
            />
            <Form.Check
              type="radio"
              inline
              id="filter-running"
              label="Running"
              name="statusFilter"
              checked={statusFilter === "Running"}
              onChange={() => {
                setStatusFilter("Running");
                setCurrentPage(1);
              }}
              className="radio-option"
            />
            <Form.Check
              type="radio"
              inline
              id="filter-closed"
              label="Closed"
              name="statusFilter"
              checked={statusFilter === "closed"}
              onChange={() => {
                setStatusFilter("closed");
                setCurrentPage(1);
              }}
              className="radio-option"
            />
            <Form.Check
              type="radio"
              inline
              id="filter-hold"
              label="Hold"
              name="statusFilter"
              checked={statusFilter === "hold"}
              onChange={() => {
                setStatusFilter("hold");
                setCurrentPage(1);
              }}
              className="radio-option"
            />
          </div>

          {(authUser?.role === "admin" || authUser?.role === "super-admin") && (
            <Button
              variant="info"
              onClick={() => setShowTicketReportModal(true)}
              title="View Ticket Reports"
              style={{ whiteSpace: "nowrap" }}
            >
              <FaChartBar className="me-1" /> Report
            </Button>
          )}
        </div>

        {error && (
          <Alert variant="danger" onClose={() => setError(null)} dismissible>
            {error}
          </Alert>
        )}

        <ReusableTable
          columns={[
            { key: "ticketNumber", header: "Ticket Number", sortable: true },
            {
              key: "assignedTo",
              header: "Assigned To",
              renderCell: (ticket) =>
                ticket.currentAssignee
                  ? `${ticket.currentAssignee.firstname} ${ticket.currentAssignee.lastname}`
                  : ticket.createdBy?.firstname
                  ? `${ticket.createdBy.firstname} ${ticket.createdBy.lastname}`
                  : "N/A",
            },
            { key: "companyName", header: "Company Name", sortable: true },
            {
              key: "date",
              header: "Date",
              sortable: true,
              renderCell: (ticket) =>
                new Date(ticket.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                }),
            },
            // {
            //   key: "grandTotal",
            //   header: "Grand Total (₹)",
            //   sortable: true,
            //   renderCell: (ticket) => ticket.grandTotal.toFixed(2),
            //   cellClassName: "text-end",
            // },
            {
              key: "progress",
              header: "Progress",
              renderCell: (ticket) => {
                const currentStatusIndex = statusStages.indexOf(ticket.status);
                const progressPercentage =
                  currentStatusIndex !== -1
                    ? Math.round(
                        ((currentStatusIndex + 1) / statusStages.length) * 100
                      )
                    : 0;
                return (
                  <>
                    <Badge
                      bg={getStatusBadgeColor(ticket.status)}
                      className="mb-1 d-block text-center"
                    >
                      {ticket.status}
                    </Badge>
                    <div
                      className="d-flex flex-column clickable-progress"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleProgressClick(ticket);
                      }}
                      style={{ cursor: "pointer" }}
                      title="View Payment Details & History"
                    >
                      <ProgressBar
                        now={progressPercentage}
                        label={`${progressPercentage}%`}
                        variant={getProgressBarVariant(progressPercentage)}
                        style={{ height: "15px" }}
                      />
                    </div>
                  </>
                );
              },
            },
          ]}
          data={currentItems}
          keyField="_id"
          isLoading={isLoading && currentItems.length === 0}
          error={error && currentItems.length === 0 ? error : null}
          onSort={requestSort}
          sortConfig={sortConfig}
          renderActions={(ticket) => {
            const canModifyTicket =
              authUser?.role === "admin" ||
              authUser?.role === "super-admin" ||
              (ticket.currentAssignee &&
                ticket.currentAssignee._id === authUser?.id);

            const canTransferThisTicket =
              authUser?.role === "super-admin" ||
              (ticket.currentAssignee &&
                ticket.currentAssignee._id === authUser?.id);

            return (
              <div className="d-flex gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleEdit(ticket)}
                  disabled={!canModifyTicket || isLoading}
                  title={
                    !canModifyTicket
                      ? "Only admin, super-admin, or current assignee can edit"
                      : "Edit Ticket"
                  }
                >
                  <i className="bi bi-pencil-square"></i>
                </Button>
                {authUser?.role === "super-admin" && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(ticket)}
                    disabled={isLoading}
                    title="Delete Ticket"
                  >
                    <i className="bi bi-trash"></i>
                  </Button>
                )}
                <Button
                  variant="warning"
                  size="sm"
                  onClick={() => handleTransfer(ticket)}
                  disabled={!canTransferThisTicket || isLoading}
                  title={
                    !canTransferThisTicket
                      ? "Only super-admin or current assignee can transfer"
                      : "Transfer Ticket"
                  }
                >
                  <i className="bi bi-arrow-left-right"></i>
                </Button>
              </div>
            );
          }}
          noDataMessage="No tickets found matching your criteria."
          tableClassName="mt-3"
          theadClassName="table-dark"
        />

        <ReusableModal
          show={showEditModal}
          onHide={() => {
            setShowEditModal(false);
            setError(null);
          }}
          title={
            <div className="d-flex justify-content-between align-items-center w-100">
              <span>
                <i className="bi bi-pencil-square me-2"></i>Edit Ticket -{" "}
                {editTicket?.ticketNumber}
              </span>
              <div className="assignee-info">
                <Badge bg="light" text="dark" className="p-2">
                  <i className="bi bi-person-fill me-1"></i>
                  {editTicket?.currentAssignee?.firstname}{" "}
                  {editTicket?.currentAssignee?.lastname || "Unassigned"}
                </Badge>
                <small className="d-block text-muted ms-1">
                  {" "}
                  {/* Adjusted text color for ReusableModal default header */}
                  Currently Assigned
                </small>
              </div>
            </div>
          }
          footerContent={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowEditModal(false);
                  setError(null);
                }}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleUpdateTicket}
                disabled={isLoading}
              >
                {isLoading ? "Updating..." : "Update Ticket"}
              </Button>
            </>
          }
        >
          {error && (
            <Alert variant="danger" onClose={() => setError(null)} dismissible>
              {error}
            </Alert>
          )}
          <ProgressBarWithStages />
          {/* Status Change Comment Section */}
          {editTicket && ticketData.status !== editTicket.status && (
            <Form.Group className="my-3">
              <Form.Label
                htmlFor="statusChangeCommentInput"
                className="fw-bold"
              >
                Comment for Status Change (Required)
              </Form.Label>
              <Form.Control
                as="textarea"
                id="statusChangeCommentInput"
                rows={2}
                value={statusChangeComment}
                onChange={(e) => setStatusChangeComment(e.target.value)}
                placeholder={`Explain why the status is being changed to "${ticketData.status}"...`}
                maxLength={200}
                required
              />
              <Form.Text muted>Max 200 characters.</Form.Text>
            </Form.Group>
          )}

          {/* Status Change History Table */}
          {editTicket?.statusHistory && editTicket.statusHistory.length > 0 && (
            <div className="mt-4">
              <h5
                style={{
                  fontWeight: "bold",
                  textAlign: "center",
                  backgroundColor: "#f0f2f5",
                  padding: "0.5rem",
                  borderRadius: "0.25rem",
                  marginBottom: "1rem",
                }}
              >
                <i className="bi bi-card-list me-1"></i>Status Change History
              </h5>
              <Table striped bordered hover size="sm" responsive>
                <thead className="table-light">
                  <tr>
                    <th title="User who changed the status">Changed By</th>
                    <th title="Date of status change">Date</th>
                    <th title="The status it was changed to">
                      Status Changed To
                    </th>
                    <th title="Comment provided for the status change">
                      Note (Limit 50 chars)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {editTicket.statusHistory
                    .slice()
                    .reverse()
                    .map(
                      (
                        historyItem,
                        index // Show newest first
                      ) => (
                        <tr key={index}>
                          <td>
                            {historyItem.changedBy
                              ? `${historyItem.changedBy.firstname || ""} ${
                                  historyItem.changedBy.lastname || ""
                                }`.trim() ||
                                historyItem.changedBy.email ||
                                "Unknown User"
                              : "N/A"}
                          </td>
                          <td>
                            {new Date(historyItem.changedAt).toLocaleString()}
                          </td>
                          <td>
                            <Badge bg={getStatusBadgeColor(historyItem.status)}>
                              {historyItem.status}
                            </Badge>
                          </td>
                          <td title={historyItem.note || "No note provided"}>
                            {(historyItem.note || "N/A").substring(0, 50) +
                              (historyItem.note && historyItem.note.length > 50
                                ? "..."
                                : "")}
                          </td>
                        </tr>
                      )
                    )}
                </tbody>
              </Table>
            </div>
          )}
          <hr />
          <Row className="mb-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Ticket Date</Form.Label>
                <Form.Control
                  type="text"
                  value={
                    editTicket?.createdAt
                      ? new Date(editTicket.createdAt).toLocaleDateString()
                      : ""
                  }
                  readOnly
                  disabled
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Company Name*</Form.Label>
                <Form.Control
                  required
                  readOnly
                  type="text"
                  value={ticketData.companyName}
                  onChange={(e) =>
                    setTicketData({
                      ...ticketData,
                      companyName: e.target.value,
                    })
                  }
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Quotation Number*</Form.Label>
                <Form.Control
                  required
                  type="text"
                  value={ticketData.quotationNumber}
                  readOnly
                  disabled
                />
              </Form.Group>
            </Col>
          </Row>
          <Row>
            <Col md={6}>
              <h5
                style={{
                  fontWeight: "bold",
                  textAlign: "center",
                  backgroundColor: "#f0f2f5",
                  padding: "0.5rem",
                  borderRadius: "0.25rem",
                  marginBottom: "1rem",
                }}
              >
                <i className="bi bi-building me-1"></i>Billing Address
              </h5>
              {renderAddressFields("billing", true)}
            </Col>
            <Col md={6}>
              <h5
                style={{
                  fontWeight: "bold",
                  textAlign: "center",
                  backgroundColor: "#f0f2f5",
                  padding: "0.5rem",
                  borderRadius: "0.25rem",
                  marginBottom: "1rem",
                }}
              >
                <i className="bi bi-truck me-1"></i>Shipping Address
              </h5>
              <Form.Group className="mb-3"></Form.Group>
              {renderAddressFields(
                "shipping",
                ticketData.shippingSameAsBilling
              )}

              <Form.Check
                type="checkbox"
                label="Shipping address is the same as billing address"
                checked={ticketData.shippingSameAsBilling}
                onChange={(e) => {
                  const isChecked = e.target.checked;
                  setTicketData((prev) => {
                    // If checked, copy billingAddress object to shippingAddress object
                    // Otherwise, shippingAddress retains its current values (or could be cleared)
                    const newShippingAddress = isChecked
                      ? { ...prev.billingAddress }
                      : { ...prev.shippingAddress }; // Or clear: initialShippingAddressState
                    return {
                      ...prev,
                      shippingSameAsBilling: isChecked,
                      shippingAddress: newShippingAddress,
                    };
                  });
                }}
              />
            </Col>
          </Row>
          <h5
            className="mt-4"
            style={{
              fontWeight: "bold",
              textAlign: "center",
              backgroundColor: "#f0f2f5",
              padding: "0.5rem",
              borderRadius: "0.25rem",
              marginBottom: "1rem",
            }}
          >
            <i className="bi bi-box-seam me-1"></i>Goods Details*
          </h5>
          <div className="table-responsive">
            <Table bordered className="mb-3">
              <thead>
                <tr className="text-center">
                  <th title="Serial Number">Sr No.</th>
                  <th title="Item Description">Description*</th>
                  <th title="HSN/SAC Code">HSN/SAC*</th>
                  <th title="Quantity">Qty*</th>
                  <th title="GST Rate %">GST%*</th>
                  <th title="Price per unit">Price*</th>
                  <th title="Total amount for this item">Amount</th>
                  <th title="Delete Item">Delete</th>
                </tr>
              </thead>
              <tbody>
                {ticketData.goods.map((item, index) => (
                  <tr key={index}>
                    <td className="align-middle text-center">{item.srNo}</td>
                    <td>
                      <Form.Control
                        type="text"
                        value={item.description}
                        readOnly
                        disabled
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="text"
                        value={item.hsnSacCode}
                        readOnly
                        disabled
                      />
                    </td>
                    <td>
                      <Form.Control
                        required
                        type="number"
                        min="1" // Quantity typically should be at least 1
                        value={item.quantity}
                        onChange={(e) =>
                          handleGoodsChange(index, "quantity", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <Form.Control
                        required
                        type="number"
                        min="18" // GST Rate can be 0
                        value={item.gstRate || 0}
                        onChange={(e) =>
                          handleGoodsChange(index, "gstRate", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        min="0"
                        value={item.price || 0}
                        onChange={(e) =>
                          handleGoodsChange(index, "price", e.target.value)
                        }
                        // isInvalid={!!item.priceError} // Add item.priceError to item state if needed
                      />
                    </td>
                    <td className="align-middle">
                      ₹{(item.amount || 0).toFixed(2)}
                    </td>
                    <td className="text-center align-middle">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => handleDeleteItemFromTicket(index)}
                      >
                        <i className="bi bi-trash"></i>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
          {/* Item Search for adding new items to ticket */}
          <div className="my-3">
            <h6>Add New Item to Ticket</h6>
            <ItemSearchComponent
              onItemSelect={handleAddItemToTicket} // Use the new handler
              placeholder="Search and select item to add..."
              onDropdownToggle={setIsItemSearchDropdownOpenInEditModal}
            />
          </div>
          {isItemSearchDropdownOpenInEditModal && (
            <div style={{ height: "300px" }}></div>
          )}
          <div className="bg-light p-3 rounded mt-3">
            <h5 className="text-center mb-3">Ticket Summary</h5>
            <Table bordered size="sm">
              <tbody>
                <tr>
                  <td>Total Quantity</td>
                  <td className="text-end">
                    <strong>{ticketData.totalQuantity}</strong>
                  </td>
                </tr>
                <tr>
                  <td>Total Amount (Subtotal)</td>
                  <td className="text-end">
                    <strong>₹{ticketData.totalAmount.toFixed(2)}</strong>
                  </td>
                </tr>
                <tr>
                  <td>Total GST</td>
                  <td className="text-end">
                    <strong>₹{ticketData.gstAmount.toFixed(2)}</strong>
                  </td>
                </tr>
                <tr>
                  <td style={{ fontWeight: "bold", fontSize: "1.1rem" }}>
                    Grand Total
                  </td>
                  <td
                    className="text-end"
                    style={{ fontWeight: "bold", fontSize: "1.1rem" }}
                  >
                    <strong>₹{ticketData.grandTotal.toFixed(2)}</strong>
                  </td>
                </tr>
              </tbody>
            </Table>
          </div>

          {/* Terms and Conditions */}
          <div className="mt-4">
            <h5
              style={{
                fontWeight: "bold",
                textAlign: "center",
                backgroundColor: "#f0f2f5",
                padding: "0.5rem",
                borderRadius: "0.25rem",
                marginBottom: "1rem",
              }}
            >
              <i className="bi bi-file-text me-1"></i>Terms & Conditions
            </h5>
            <Form.Control
              as="textarea"
              rows={4}
              value={ticketData.termsAndConditions}
              onChange={(e) =>
                setTicketData({
                  ...ticketData,
                  termsAndConditions: e.target.value,
                })
              }
              placeholder="Enter terms and conditions for the Performa Invoice..."
            />
          </div>
        </ReusableModal>

        <TransferModal />

        {/* PDF Preview Modal */}
        <ReusableModal
          show={showPdfPreviewModal}
          onHide={() => setShowPdfPreviewModal(false)}
          title={`${pdfPreviewConfig.type?.toUpperCase()} Preview`}
          // Footer can be part of renderPdfPreview or passed if simple
        >
          {pdfPreviewConfig.type &&
            pdfPreviewConfig.data &&
            renderPdfPreview(pdfPreviewConfig.type, pdfPreviewConfig.data)}
        </ReusableModal>

        <ReusableModal
          show={showPaymentModal}
          onHide={() => {
            setShowPaymentModal(false);
            setError(null);
          }}
          title={
            <>
              <i className="bi bi-credit-card-2-front me-2"></i>Payment Details
              - {selectedTicket?.ticketNumber}
            </>
          }
          footerContent={
            <Button
              variant="secondary"
              onClick={() => {
                setShowPaymentModal(false);
                setError(null);
              }}
              disabled={isLoading}
            >
              Close
            </Button>
          }
        >
          {error && (
            <Alert variant="danger" onClose={() => setError(null)} dismissible>
              {error}
            </Alert>
          )}
          <h5
            style={{
              fontWeight: "bold",
              textAlign: "center",
              backgroundColor: "#f0f2f5",
              padding: "0.5rem",
              borderRadius: "0.25rem",
              marginBottom: "1rem",
            }}
          >
            <i className="bi bi-files me-2"></i>Ticket Documents
          </h5>
          <Row className="mb-4 text-center">
            {[
              {
                name: "Quotation",
                docType: "quotation",
                icon: "bi-file-earmark-text",
                generate: true,
              },
              {
                name: "PI",
                docType: "pi",
                icon: "bi-file-earmark-medical",
                generate: true,
              },
              {
                name: "PO",
                docType: "po",
                icon: "bi-file-earmark-check",
              },
              {
                name: "Dispatch",
                docType: "challan",
                icon: "bi-truck",
              },
              {
                name: "Packing List",
                docType: "packingList",
                icon: "bi-list-ul",
              },
              {
                name: "Feedback",
                docType: "feedback",
                icon: "bi-chat-square-text",
              },
            ].map((docDef) => {
              const docData = selectedTicket?.documents?.[docDef.docType];
              return (
                <Col key={docDef.docType} md={4} className="mb-3">
                  <Card className="h-100 shadow-sm">
                    <Card.Body className="d-flex flex-column">
                      <Card.Title className="d-flex align-items-center">
                        <i className={`bi ${docDef.icon} me-2 fs-4`}></i>
                        {docDef.name}
                      </Card.Title>
                      {docData && docData.path ? (
                        <>
                          <small className="text-muted">
                            Uploaded by:{" "}
                            {docData.uploadedBy && docData.uploadedBy.firstname
                              ? `${docData.uploadedBy.firstname} ${
                                  docData.uploadedBy.lastname || ""
                                }`.trim()
                              : "N/A"}
                            <br />
                            On:{" "}
                            {new Date(docData.uploadedAt).toLocaleDateString()}
                          </small>
                          <Button
                            variant="outline-info"
                            size="sm"
                            className="mt-2"
                            onClick={() =>
                              window.open(
                                `${import.meta.env.VITE_API_BASE_URL}/uploads/${
                                  selectedTicket?._id
                                }/${docData.path}`,
                                "_blank"
                              )
                            }
                          >
                            <i className="bi bi-eye me-1"></i>View Uploaded
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            className="mt-1"
                            onClick={() =>
                              handleDocumentDelete(
                                docDef.docType,
                                docData.path,
                                selectedTicket?._id
                              )
                            }
                            disabled={isLoading}
                          >
                            <i className="bi bi-trash me-1"></i>Delete
                          </Button>
                        </>
                      ) : (
                        <p className="text-muted small mt-1">
                          Not uploaded yet.
                        </p>
                      )}

                      {docDef.generate && (
                        <Button
                          variant="primary"
                          size="sm"
                          className="mt-auto" // Pushes button to bottom if card body is d-flex flex-column
                          onClick={() => {
                            setPdfPreviewConfig({
                              type: docDef.docType,
                              data: selectedTicket,
                            });
                            setShowPdfPreviewModal(true);
                          }}
                        >
                          <i className="bi bi-gear me-1"></i>Generate & View
                        </Button>
                      )}

                      {/* Upload/Replace Button */}
                      <Button
                        variant={
                          docData && docData.path
                            ? "outline-warning"
                            : "outline-success"
                        }
                        size="sm"
                        className="mt-1"
                        onClick={() => {
                          setUploadingDocType(docDef.docType); // Keep track for the file input
                          document
                            .getElementById(
                              `file-upload-${docDef.docType}-${selectedTicket?._id}`
                            )
                            ?.click();
                        }}
                        disabled={isLoading}
                      >
                        <i
                          className={`bi ${
                            docData && docData.path
                              ? "bi-arrow-repeat"
                              : "bi-upload"
                          } me-1`}
                        ></i>
                        {docData && docData.path ? "Replace" : "Upload"}{" "}
                        {docDef.name}
                      </Button>
                      <input
                        type="file"
                        id={`file-upload-${docDef.docType}-${selectedTicket?._id}`}
                        style={{ display: "none" }}
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            handleSpecificDocumentUpload(
                              e.target.files[0],
                              uploadingDocType,
                              selectedTicket?._id
                            );
                            e.target.value = ""; // Reset file input
                            setUploadingDocType(null);
                          }
                        }}
                      />
                    </Card.Body>
                  </Card>
                </Col>
              );
            })}
          </Row>
          <hr />
          <h5
            style={{
              fontWeight: "bold",
              textAlign: "center",
              backgroundColor: "#f0f2f5",
              padding: "0.5rem",
              borderRadius: "0.25rem",
              marginBottom: "1rem",
            }}
          >
            <i className="bi bi-paperclip me-2"></i>Other Uploaded Documents
          </h5>
          {selectedTicket?.documents?.other &&
          selectedTicket.documents.other.length > 0 ? (
            <Table striped bordered hover size="sm" className="mt-2">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Uploaded By</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedTicket.documents.other.map((doc, index) => (
                  <tr key={doc.path || index}>
                    <td>{doc.originalName}</td>
                    <td>
                      {doc.uploadedBy && doc.uploadedBy.firstname
                        ? `${doc.uploadedBy.firstname} ${
                            doc.uploadedBy.lastname || ""
                          }`.trim()
                        : "N/A"}
                    </td>
                    <td>{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                    <td>
                      <Button
                        variant="info"
                        size="sm"
                        className="me-1"
                        onClick={() =>
                          window.open(
                            `http://localhost:3000/uploads/${selectedTicket?._id}/${doc.path}`,
                            "_blank"
                          )
                        }
                      >
                        <i className="bi bi-eye"></i>
                      </Button>
                      <Button
                        variant="info"
                        size="sm"
                        className="me-1"
                        onClick={() =>
                          window.open(
                            `${import.meta.env.VITE_API_BASE_URL}/uploads/${
                              selectedTicket?._id
                            }/${doc.path}`,
                            "_blank"
                          )
                        }
                      >
                        <i className="bi bi-eye"></i>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p className="text-muted">No other documents uploaded.</p>
          )}
          <Button
            variant="outline-primary"
            size="sm"
            className="mt-2"
            onClick={() => {
              setUploadingDocType("other");
              document
                .getElementById(`file-upload-other-${selectedTicket?._id}`)
                ?.click();
            }}
            disabled={isLoading}
          >
            <i className="bi bi-plus-circle"></i> Upload Other Document
          </Button>
          <input
            type="file"
            id={`file-upload-other-${selectedTicket?._id}`}
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleSpecificDocumentUpload(
                  e.target.files[0],
                  "other",
                  selectedTicket?._id
                );
                e.target.value = null;
                setUploadingDocType(null);
              }
            }}
          />
          <hr />
          <Row>
            <Col md={12}>
              <h5
                style={{
                  fontWeight: "bold",
                  textAlign: "center",
                  backgroundColor: "#f0f2f5",
                  padding: "0.5rem",
                  borderRadius: "0.25rem",
                  marginBottom: "1rem",
                }}
              >
                <i className="bi bi-arrow-repeat me-1"></i>Transfer History
              </h5>
              {selectedTicket &&
              transferHistoryDisplay &&
              transferHistoryDisplay.length > 0 ? (
                <Table
                  bordered
                  responsive
                  className="mt-2 transfer-history-table table-sm"
                >
                  <thead className="table-light">
                    <tr>
                      <th title="User involved in the transfer step">Name</th>
                      <th title="Date of the transfer or creation">Date</th>
                      <th title="Note or action taken">
                        Note (Limit 50 chars)
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {transferHistoryDisplay.map((entry, index) => (
                      <tr key={index}>
                        <td>{entry.name}</td>
                        <td>{new Date(entry.date).toLocaleString()}</td>
                        <td title={entry.note}>
                          {entry.note
                            ? entry.note.substring(0, 50) +
                              (entry.note.length > 50 ? "..." : "")
                            : "N/A"}
                        </td>
                      </tr>
                    ))}{" "}
                  </tbody>
                </Table>
              ) : (
                <div className="text-muted mt-2">
                  No transfer history available.
                </div>
              )}
            </Col>
          </Row>
        </ReusableModal>

        {filteredTickets.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredTickets.length}
            itemsPerPage={itemsPerPage}
            onPageChange={(page) => {
              // Calculate totalPages locally for this boundary check
              const currentTotalPages = Math.ceil(
                filteredTickets.length / itemsPerPage
              );
              if (page >= 1 && page <= currentTotalPages) setCurrentPage(page);
            }}
            onItemsPerPageChange={handleItemsPerPageChange}
            // Optionally pass itemsPerPageOptions if you want to customize them from here
            // itemsPerPageOptions={[5, 10, 25, 50]}
          />
        )}
      </div>
      {/* Ticket Report Modal */}
      <TicketReportModal
        show={showTicketReportModal}
        onHide={() => setShowTicketReportModal(false)}
      />
      <Footer />
    </div>
  );
}

function getProgressBarVariant(percentage) {
  if (percentage < 30) return "danger";
  if (percentage < 70) return "warning";
  return "success";
}
