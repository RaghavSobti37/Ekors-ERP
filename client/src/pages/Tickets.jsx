import React, { useState, useEffect, useMemo } from "react";
import Pagination from "../components/Pagination";
import axios from "axios";
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
import Navbar from "../components/Navbar.jsx";
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer";
import "../css/Style.css";
import QuotationPDF from "../components/QuotationPDF.jsx";
import PIPDF from "../components/PIPDF.jsx";
import { useAuth } from "../context/AuthContext"; // Adjust path if necessary

const SortIndicator = ({ columnKey, sortConfig }) => {
  if (sortConfig.key !== columnKey) {
    return null;
  }
  return sortConfig.direction === "ascending" ? (
    <span> ↑</span>
  ) : (
    <span> ↓</span>
  );
};

const ItemSearchComponent = ({ onItemSelect, index }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() !== "") {
      const filtered = items.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.hsnCode &&
            item.hsnCode.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredItems(filtered);
      setShowDropdown(true);
    } else {
      setFilteredItems([]);
      setShowDropdown(false);
    }
  }, [searchTerm, items]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);

      // Replace the existing getAuthToken function in Dashboard component
      const getAuthToken = () => {
        const token = localStorage.getItem("erp-user");
        console.log(
          "[DEBUG] getAuthToken retrieved:",
          token ? "Token present" : "No token"
        );
        return token || null;
      };

      const token = getAuthToken();
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const response = await axios.get("http://localhost:3000/api/items", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setItems(response.data);
    } catch (err) {
      console.error("Error fetching items:", err);
      setError("Failed to load items. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item) => {
    onItemSelect(item, index);
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
    <div className="item-search-component">
      {error && <div className="search-error">{error}</div>}

      <div className="search-input-container">
        <input
          type="text"
          className="form-control"
          placeholder="Search item by name or HSN..."
          value={searchTerm}
          onChange={handleSearchChange}
          onFocus={() => setShowDropdown(true)}
          onBlur={handleBlur}
          disabled={loading}
        />
        {loading && <div className="search-loading">Loading...</div>}
      </div>

      {showDropdown && filteredItems.length > 0 && (
        <div className="search-suggestions-dropdown">
          {filteredItems.map((item) => (
            <div
              key={item._id}
              className="search-suggestion-item"
              onClick={() => handleItemClick(item)}
            >
              <strong>{item.name}</strong>
              <span className="text-muted"> - ₹{item.price.toFixed(2)}</span>
              <br />
              <small>
                HSN: {item.hsnCode || "N/A"}, GST: {item.gstRate || 0}%
              </small>
            </div>
          ))}
        </div>
      )}

      {showDropdown && searchTerm && filteredItems.length === 0 && (
        <div className="search-no-results">No items found</div>
      )}
    </div>
  );
};

const UserSearchComponent = ({ onUserSelect }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const getAuthToken = () => {
        const token = localStorage.getItem("erp-user");
        console.log(
          "[DEBUG] getAuthToken retrieved:",
          token ? "Token present" : "No token"
        );
        return token || null;
      };

      const token = getAuthToken();
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const response = await axios.get("http://localhost:3000/api/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      setUsers(response.data);
    } catch (err) {
      console.error("Error fetching users:", err);
      setError("Failed to load users. Please try again.");
    } finally {
      setLoading(false);
    }
  };

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
      {error && <div className="search-error">{error}</div>}

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
  const [statusFilter, setStatusFilter] = useState("all"); // 'all', 'open', 'closed', 'hold'
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editTicket, setEditTicket] = useState(null);
  const [transferTicket, setTransferTicket] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [documentType, setDocumentType] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(4);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const { user: authUser } = useAuth();

  useEffect(() => {
    if (authUser) {
      setLoggedInUser(authUser);
    }
    fetchTickets();
  }, [authUser]); // Add authUser as a dependency

  // Replace the existing getAuthToken function in Dashboard component
  const getAuthToken = () => {
    const token = localStorage.getItem("erp-user");
    console.log(
      "[DEBUG] getAuthToken retrieved:",
      token ? "Token present" : "No token"
    );
    return token || null;
  };

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
      quotation: "",
      po: "",
      pi: "",
    },
    dispatchDays: "7-10 working",
    validityDate: new Date(
      new Date().setDate(new Date().getDate() + 15)
    ).toISOString(),
  });
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "ascending",
  });
  const [loggedInUser, setLoggedInUser] = useState(null);
  const [transferTableData, setTransferTableData] = useState({
    names: [],
    dates: [],
    // statuses: [], // Removed
    notes: [],
  });

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

  const documentStatusMap = {
    quotation: "Quotation Sent",
    po: "PO Received",
    pi: "Payment Pending",
  };

  const documentIconMap = {
    quotation: "bi-file-earmark-text",
    po: "bi-file-earmark-check",
    pi: "bi-file-earmark-text",
  };

  const documentColorMap = {
    quotation: "primary",
    po: "success",
    pi: "primary",
  };

  useEffect(() => {
    if (editTicket && editTicket.documents) {
      let highestStatusAchieved = statusStages[0];
      let highestStatusIndex = 0;

      Object.entries(documentStatusMap).forEach(([docType, expectedStatus]) => {
        if (editTicket.documents[docType]) {
          const expectedStatusIndex = statusStages.indexOf(expectedStatus);
          if (expectedStatusIndex > highestStatusIndex) {
            highestStatusAchieved = expectedStatus;
            highestStatusIndex = expectedStatusIndex;
          }
        }
      });

      if (
        ticketData.status !== highestStatusAchieved &&
        statusStages.indexOf(highestStatusAchieved) >
          statusStages.indexOf(ticketData.status)
      ) {
        setTicketData((prev) => ({ ...prev, status: highestStatusAchieved }));
      }
    }
  }, [editTicket]);

  const createdBy = loggedInUser?._id;

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await axios.get("http://localhost:3000/api/tickets", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          populate:
            "currentAssignee,createdBy,transferHistory.from,transferHistory.to,transferHistory.transferredBy",
        },
      });

      setTickets(response.data);
    } catch (error) {
      const errorMsg = error.response?.data?.error || "Failed to load tickets";
      setError(errorMsg);
      console.error("Error fetching tickets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (editTicket) {
      // This block now specifically handles the case for the editTicket modal
      // The new useEffect below will handle populating transferTableData more generally
    }
  }, [editTicket]); // Keep this for any editTicket specific logic if needed, or remove if fully covered by the one below

  useEffect(() => {
    const activeDetailedTicket = showEditModal
      ? editTicket
      : showPaymentModal
      ? selectedTicket
      : null;

    if (activeDetailedTicket) {
      const newNames = [];
      const newDates = [];
      // const newStatuses = []; // Removed
      const newNotes = [];

      // Determine initial assignee for the first column
      let firstAssignee = activeDetailedTicket.createdBy; // Default to creator
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

      newNames.push(firstAssignee);
      newDates.push(activeDetailedTicket.createdAt); // Date for the initial state
      // newStatuses.push(earliestKnownStatus); // Status for the "Ticket Created" column - Removed
      newNotes.push("Ticket Created"); // Note for initial state

      // States from transfer history
      activeDetailedTicket.transferHistory?.forEach((transfer) => {
        newNames.push(transfer.to); // The user the ticket was transferred TO
        const transferTime = transfer.transferredAt || new Date(); // Ensure we have a valid date
        newDates.push(transferTime);
        // Status logic removed
        newNotes.push(transfer.note || "N/A"); // Note for this transfer
      });
      setTransferTableData({
        names: newNames,
        dates: newDates,
        notes: newNotes,
      });
    } else {
      setTransferTableData({ names: [], dates: [], notes: [] });
    }
  }, [editTicket, selectedTicket, showEditModal, showPaymentModal]);

  const handleDelete = async (ticketToDelete) => {
    if (!loggedInUser || loggedInUser.role !== "super-admin") {
      setError("You do not have permission to delete this ticket."); // Corrected error message
      return;
    }
    if (
      window.confirm(
        `Are you sure you want to permanently delete ticket ${ticketToDelete.ticketNumber}?`
      )
    ) {
      try {
        const token = getAuthToken();
        if (!token) {
          setError("Authentication token not found for delete operation.");
          return;
        }

        // The redundant call to useAuth() and subsequent check were removed.
        // The permission check now relies solely on the component's `loggedInUser` state,
        // which is populated from AuthContext.

        await axios.delete(
          `http://localhost:3000/api/tickets/admin/${ticketToDelete._id}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        fetchTickets(); // Refresh the list from the server
        setError(null);
      } catch (error) {
        setError(
          "Delete failed: " + (error.response?.data?.error || error.message)
        );
        console.error("Error deleting ticket:", error);
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
    try {
      const token = getAuthToken();
      if (!token) throw new Error("No authentication token found");
      const response = await axios.post(
        `http://localhost:3000/api/tickets/${selectedTicket._id}/payments`,
        {
          amount: paymentAmount,
          date: paymentDate,
          reference: paymentReference,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.status === 200) {
        await fetchTickets();
        setShowPaymentModal(false);
        alert("Payment recorded successfully!");
      }
    } catch (error) {
      console.error("Error recording payment:", error);
      setError(
        `Failed to record payment: ${
          error.response?.data?.message || error.message
        }`
      );
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
        return true;
      });
    }

    return filtered;
  }, [sortedTickets, searchTerm, statusFilter]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredTickets.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);

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
      amount: updatedGoods[index].quantity * item.price,
    };
    updateTotals(updatedGoods);
  };

  const handleGoodsChange = (index, field, value) => {
    const updatedGoods = [...ticketData.goods];
    updatedGoods[index][field] = value;
    if (field === "quantity" || field === "price") {
      updatedGoods[index].amount =
        (Number(updatedGoods[index].quantity) || 0) *
        (Number(updatedGoods[index].price) || 0);
    }
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
    const gstAmount = totalAmount * 0.18;
    const grandTotal = totalAmount + gstAmount;
    setTicketData((prev) => ({
      ...prev,
      goods,
      totalQuantity,
      totalAmount,
      gstAmount,
      grandTotal,
    }));
  };

  const handleEdit = (selectedTicket) => {
    setEditTicket(selectedTicket);
    const billingAddress = Array.isArray(selectedTicket.billingAddress)
      ? {
          address1: selectedTicket.billingAddress[0] || "",
          address2: selectedTicket.billingAddress[1] || "",
          city: selectedTicket.billingAddress[3] || "",
          state: selectedTicket.billingAddress[2] || "",
          pincode: selectedTicket.billingAddress[4] || "",
        }
      : selectedTicket.billingAddress || {
          address1: "",
          address2: "",
          city: "",
          state: "",
          pincode: "",
        };

    const shippingAddress = Array.isArray(selectedTicket.shippingAddress)
      ? {
          address1: selectedTicket.shippingAddress[0] || "",
          address2: selectedTicket.shippingAddress[1] || "",
          city: selectedTicket.shippingAddress[3] || "",
          state: selectedTicket.shippingAddress[2] || "",
          pincode: selectedTicket.shippingAddress[4] || "",
        }
      : selectedTicket.shippingAddress || {
          address1: "",
          address2: "",
          city: "",
          state: "",
          pincode: "",
        };

    setTicketData({
      companyName: selectedTicket.companyName || "",
      quotationNumber: selectedTicket.quotationNumber || "",
      billingAddress,
      shippingAddress,
      goods: selectedTicket.goods || [],
      totalQuantity: selectedTicket.totalQuantity || 0,
      totalAmount: selectedTicket.totalAmount || 0,
      gstAmount: selectedTicket.gstAmount || 0,
      grandTotal: selectedTicket.grandTotal || 0,
      status: selectedTicket.status || statusStages[0],
      documents: selectedTicket.documents || {
        quotation: "",
        po: "",
        pi: "",
      },
      dispatchDays: selectedTicket.dispatchDays || "7-10 working",
      validityDate:
        selectedTicket.validityDate ||
        new Date(new Date().setDate(new Date().getDate() + 15)).toISOString(),
    });
    setShowEditModal(true);
  };

  const handleTransfer = (ticket) => {
    setTransferTicket(ticket);
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
  };

  const handleUpdateTicket = async () => {
    try {
      const updateData = {
        ...ticketData,
        _id: undefined,
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
        shippingAddress: [
          ticketData.shippingAddress.address1,
          ticketData.shippingAddress.address2,
          ticketData.shippingAddress.state,
          ticketData.shippingAddress.city,
          ticketData.shippingAddress.pincode,
        ],
      };

      const response = await axios.put(
        `http://localhost:3000/api/tickets/${editTicket._id}`,
        updateData,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAuthToken()}`,
          },
        }
      );
      if (response.status === 200) {
        fetchTickets();
        setShowEditModal(false);
        setError(null);
      }
    } catch (error) {
      console.error("Error updating ticket:", error);
      setError(
        `Failed to update ticket: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  };

  const handleTransferTicket = async (user, note) => {
    if (!user) {
      setError("Please select a user to transfer the ticket to");
      return;
    }
    try {
      const response = await axios.post(
        `http://localhost:3000/api/tickets/${transferTicket._id}/transfer`,
        { userId: user._id, note },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getAuthToken()}`,
          },
        }
      );

      if (response.status === 200) {
        const updatedTicketFromServer = response.data.ticket;

        setTickets((prevTickets) =>
          prevTickets.map((t) =>
            t._id === updatedTicketFromServer._id ? updatedTicketFromServer : t
          )
        );

        setTransferTicket((prev) => ({
          ...updatedTicketFromServer,
        }));

        setError(null);
        setShowTransferModal(false);
        alert(
          `Ticket successfully transferred to ${updatedTicketFromServer.currentAssignee.firstname} ${updatedTicketFromServer.currentAssignee.lastname}`
        );
      }
    } catch (error) {
      console.error("Error transferring ticket:", error);
      setError(
        `Failed to transfer ticket: ${
          error.response?.data?.message || error.message
        }`
      );
    }
  };

  const renderDocumentSection = () => {
    if (!documentType || !editTicket) return null;

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

    const quotationDataForPDF = editTicket
      ? {
          referenceNumber: editTicket.quotationNumber,
          date: editTicket.createdAt,
          client: {
            companyName: editTicket.companyName,
            siteLocation: getAddressString(
              editTicket.shippingAddress || editTicket.billingAddress
            ),
          },
          goods: editTicket.goods.map((item) => ({
            ...item,
            unit: item.unit || "Nos",
          })),
          totalAmount: editTicket.totalAmount,
          dispatchDays:
            ticketData.dispatchDays ||
            editTicket.dispatchDays ||
            "7-10 working",
          validityDate:
            ticketData.validityDate ||
            editTicket.validityDate ||
            new Date(
              new Date().setDate(new Date().getDate() + 15)
            ).toISOString(),
        }
      : null;

    return (
      <div className="mt-4 p-3 border rounded bg-light">
        <h5 className="mb-3">
          <i className={`bi ${documentIconMap[documentType]}`}></i>{" "}
          {documentType.toUpperCase()} Document
        </h5>
        {documentType === "quotation" && quotationDataForPDF && (
          <div className="document-preview-container">
            <PDFViewer width="100%" height="500px" className="mb-3">
              <QuotationPDF quotation={quotationDataForPDF} />
            </PDFViewer>
            <div className="d-flex justify-content-center gap-2 mt-3">
              <PDFDownloadLink
                document={<QuotationPDF quotation={quotationDataForPDF} />}
                fileName={`quotation_${quotationDataForPDF.referenceNumber}.pdf`}
              >
                {({ loading }) => (
                  <Button variant="primary" disabled={loading}>
                    <i className="bi bi-download me-2"></i>
                    {loading ? "Generating..." : "Download Quotation"}
                  </Button>
                )}
              </PDFDownloadLink>
              <Button variant="secondary" onClick={() => setDocumentType(null)}>
                <i className="bi bi-x-circle me-2"></i>Close Preview
              </Button>
            </div>
          </div>
        )}
        {documentType === "pi" && editTicket && (
          <div className="document-preview-container">
            <PDFViewer width="100%" height="500px" className="mb-3">
              <PIPDF ticket={editTicket} />
            </PDFViewer>
            <div className="d-flex justify-content-center gap-2 mt-3">
              <PDFDownloadLink
                document={<PIPDF ticket={editTicket} />}
                fileName={`pi_${editTicket.quotationNumber}.pdf`}
              >
                {({ loading }) => (
                  <Button variant="primary" disabled={loading}>
                    <i className="bi bi-download me-2"></i>
                    {loading ? "Generating..." : "Download PI"}
                  </Button>
                )}
              </PDFDownloadLink>
              <Button variant="secondary" onClick={() => setDocumentType(null)}>
                <i className="bi bi-x-circle me-2"></i>Close Preview
              </Button>
            </div>
          </div>
        )}
        {!["quotation", "pi"].includes(documentType) &&
          ticketData.documents?.[documentType] && (
            <div className="text-center p-4">
              <a
                href={`http://localhost:3000/${ticketData.documents[documentType]}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-lg"
              >
                <i className="bi bi-eye me-2"></i>View{" "}
                {documentType.toUpperCase()} Document
              </a>
            </div>
          )}
      </div>
    );
  };

  const handleDocumentUpload = async (file, docType) => {
    if (!file) {
      setError("Please select a file to upload");
      return false;
    }

    // Check file size (e.g., 5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setError("File size should be less than 5MB");
      return false;
    }

    try {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("documentType", docType);

      const response = await axios.post(
        `http://localhost:3000/api/tickets/${editTicket._id}/documents`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${getAuthToken()}`,
          },
        }
      );

      if (!response.data || !response.data.documents) {
        throw new Error("Invalid response from server");
      }

      // Handle multiple documents for 'other' type
      if (docType === "other") {
        const currentDocuments = ticketData.documents?.other || [];
        const newDocuments = Array.isArray(currentDocuments)
          ? [...currentDocuments, response.data.documents.other]
          : [currentDocuments, response.data.documents.other];

        setTicketData((prev) => ({
          ...prev,
          documents: {
            ...prev.documents,
            other: newDocuments,
          },
        }));

        setEditTicket((prev) => ({
          ...prev,
          documents: {
            ...prev.documents,
            other: newDocuments,
          },
        }));
      } else {
        const newStatus = documentStatusMap[docType] || ticketData.status;
        const newDocumentPath = response.data.documents[docType];

        setTicketData((prev) => ({
          ...prev,
          status:
            statusStages.indexOf(newStatus) > statusStages.indexOf(prev.status)
              ? newStatus
              : prev.status,
          documents: { ...prev.documents, [docType]: newDocumentPath },
        }));

        setEditTicket((prev) => ({
          ...prev,
          documents: {
            ...prev.documents,
            [docType]: newDocumentPath,
          },
        }));
      }

      return true;
    } catch (error) {
      console.error("Error uploading document:", error);
      let errorMsg = "Failed to upload document";
      if (error.response) {
        errorMsg = error.response.data.message || errorMsg;
      }
      setError(errorMsg);
      return false;
    }
  };

  const handleDocumentDelete = async (docType, index = null) => {
    try {
      const token = getAuthToken();
      if (!token) throw new Error("No authentication token found");

      let pathToDelete;
      let updatedDocuments;

      if (docType === "other" && index !== null) {
        if (Array.isArray(ticketData.documents.other)) {
          pathToDelete = ticketData.documents.other[index];
          updatedDocuments = ticketData.documents.other.filter(
            (_, i) => i !== index
          );
        } else {
          pathToDelete = ticketData.documents.other;
          updatedDocuments = [];
        }
      } else {
        pathToDelete = ticketData.documents[docType];
        updatedDocuments = "";
      }

      await axios.delete(
        `http://localhost:3000/api/tickets/${editTicket._id}/documents`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          data: {
            documentType: docType,
            documentPath: pathToDelete,
          },
        }
      );

      setTicketData((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          [docType]: updatedDocuments,
        },
      }));

      setEditTicket((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          [docType]: updatedDocuments,
        },
      }));
    } catch (error) {
      console.error("Error deleting document:", error);
      setError("Failed to delete document");
    }
  };

  const renderAddressFields = (type) => {
    const addressKey = `${type}Address`;
    const address = ticketData[addressKey] || {};
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
            />
          </Form.Group>
          <Form.Group className="col-md-6">
            <Form.Control
              placeholder="Address Line 2"
              value={address.address2 || ""}
              onChange={(e) => handleChange("address2", e.target.value)}
            />
          </Form.Group>
          <Form.Group className="col-md-4">
            <Form.Control
              placeholder="City"
              value={address.city || ""}
              onChange={(e) => handleChange("city", e.target.value)}
            />
          </Form.Group>
          <Form.Group className="col-md-4">
            <Form.Control
              placeholder="State"
              value={address.state || ""}
              onChange={(e) => handleChange("state", e.target.value)}
            />
          </Form.Group>
          <Form.Group className="col-md-4">
            <Form.Control
              placeholder="Pincode"
              value={address.pincode || ""}
              onChange={(e) => handleChange("pincode", e.target.value)}
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
        return "warning";
      case "Closed": // Aligning with statusStages for consistency
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
              variant={isCompleted ? "success" : "secondary"}
              label={isCurrent ? stage : ""}
              animated={isCurrent}
              onClick={() => handleStatusChange(stage)}
              style={{ cursor: "pointer" }}
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
                ? "fw-bold text-primary"
                : "text-muted"
            }`}
            style={{
              width: `${100 / statusStages.length}%`,
              cursor: "pointer",
            }}
            onClick={() => handleStatusChange(stage)}
          >
            {stage.split(" ")[0]}
          </small>
        ))}
      </div>
    </div>
  );

  const DocumentUploadSection = () => (
    <div className="mt-4">
      <h4>
        <i className="bi bi-files me-2"></i>Documents
      </h4>
      <div className="d-flex flex-wrap gap-3 mb-3">
        {Object.entries({
          quotation: "Quotation",
          pi: "PI",
        }).map(([docKey, docName]) => (
          <div
            key={docKey}
            className="document-button-group d-flex align-items-center"
          >
            <Button
              variant={
                documentType === docKey
                  ? documentColorMap[docKey]
                  : `outline-${documentColorMap[docKey]}`
              }
              onClick={() => setDocumentType(docKey)}
              className="text-nowrap me-1"
            >
              <i className={`bi ${documentIconMap[docKey]} me-2`}></i>
              {docName}
            </Button>
            {/* <Button
              variant={documentColorMap[docKey]}
              onClick={() => setDocumentType(docKey)}
              className="ms-1"
              title={
                docName === "Quotation"
                  ? "Preview/Download Quotation"
                  : "Preview/Download PI"
              }
            >
              <i className="bi bi-eye"></i>
            </Button> */}
          </div>
        ))}

        {/* Add Upload Document button */}
        <div className="document-button-group d-flex align-items-center">
          <Button
            variant="outline-primary"
            onClick={() => document.getElementById("upload-document").click()}
            className="text-nowrap me-1"
          >
            <i className="bi bi-upload me-2"></i>
            Upload Documents
          </Button>
          <input
            type="file"
            id="upload-document"
            style={{ display: "none" }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleDocumentUpload(e.target.files[0], "other");
                // Reset the input to allow uploading same file again
                e.target.value = "";
              }
            }}
            multiple
          />
        </div>
      </div>

      {/* Display uploaded documents */}
      {ticketData.documents?.other && (
        <div className="mt-3">
          <h6>Uploaded Documents:</h6>
          <div className="d-flex flex-wrap gap-2">
            {Array.isArray(ticketData.documents.other) ? (
              ticketData.documents.other.map((doc, index) => (
                <div key={index} className="border p-2 rounded">
                  <a
                    href={`http://localhost:3000/${doc}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="me-2"
                  >
                    Document {index + 1}
                  </a>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-danger"
                    onClick={() => handleDocumentDelete("other", index)}
                  >
                    <i className="bi bi-trash"></i>
                  </Button>
                </div>
              ))
            ) : (
              <div className="border p-2 rounded">
                <a
                  href={`http://localhost:3000/${ticketData.documents.other}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="me-2"
                >
                  Uploaded Document
                </a>
                <Button
                  variant="link"
                  size="sm"
                  className="text-danger"
                  onClick={() => handleDocumentDelete("other")}
                >
                  <i className="bi bi-trash"></i>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {renderDocumentSection()}
    </div>
  );

  const TransferModal = () => {
    const [transferNote, setTransferNote] = useState("");

    return (
      <Modal
        show={showTransferModal}
        onHide={() => {
          setShowTransferModal(false);
          setError(null);
          setSelectedUser(null);
        }}
        size="lg"
        centered
        dialogClassName="transfer-modal"
      >
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title>
            <i className="bi bi-arrow-left-right me-2"></i>Transfer Ticket -{" "}
            {transferTicket?.ticketNumber}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <div className="mb-4">
            <h5 className="mb-3">
              <i className="bi bi-search me-2"></i>Search User to Transfer To
            </h5>
            <UserSearchComponent onUserSelect={handleUserSelect} />
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

          {error && !selectedUser && (
            <Alert variant="danger" className="mt-3">
              {error}
            </Alert>
          )}

          {transferTicket && (
            <div className="ticket-summary mt-4 p-3 border rounded">
              <h6 className="mb-3">Ticket Summary</h6>
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
        </Modal.Body>
        <Modal.Footer className="justify-content-between">
          <Button
            variant="outline-secondary"
            onClick={() => {
              setShowTransferModal(false);
              setError(null);
              setSelectedUser(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => handleTransferTicket(selectedUser, transferNote)}
            disabled={!selectedUser}
            className="px-4"
          >
            Confirm Transfer
          </Button>
        </Modal.Footer>
      </Modal>
    );
  };

  return (
    <div>
      <Navbar />
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 style={{ color: "black" }}>Open Tickets</h2>
          <div
            className="d-flex align-items-center gap-3"
            style={{ width: "80%" }}
          >
            <Form.Control
              type="search"
              placeholder="🔍 Search here"
              className="me-2"
              aria-label="Search"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                borderRadius: "20px",
                padding: "8px 20px",
                border: "1px solid #ced4da",
                boxShadow: "none",
              }}
            />
            <div className="filter-radio-group">
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
              />
            </div>
          </div>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <Table striped bordered hover responsive className="mt-3">
          <thead className="table-dark">
            <tr>
              <th
                onClick={() => requestSort("ticketNumber")}
                style={{ cursor: "pointer" }}
              >
                Ticket Number{" "}
                <SortIndicator
                  columnKey="ticketNumber"
                  sortConfig={sortConfig}
                />
              </th>
              <th>Assigned To</th>
              <th
                onClick={() => requestSort("companyName")}
                style={{ cursor: "pointer" }}
              >
                Company Name{" "}
                <SortIndicator
                  columnKey="companyName"
                  sortConfig={sortConfig}
                />
              </th>
              <th
                onClick={() => requestSort("date")}
                style={{ cursor: "pointer" }}
              >
                Date <SortIndicator columnKey="date" sortConfig={sortConfig} />
              </th>
              <th
                onClick={() => requestSort("grandTotal")}
                style={{ cursor: "pointer" }}
              >
                Grand Total (₹){" "}
                <SortIndicator columnKey="grandTotal" sortConfig={sortConfig} />
              </th>
              <th>Progress</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="8" className="text-center">
                  <div
                    className="d-flex justify-content-center align-items-center"
                    style={{ height: "100px" }}
                  >
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                  </div>
                </td>
              </tr>
            ) : currentItems.length > 0 ? (
              currentItems.map((ticket) => {
                const currentStatusIndex = statusStages.indexOf(ticket.status);
                const progressPercentage =
                  currentStatusIndex !== -1
                    ? Math.round(
                        ((currentStatusIndex + 1) / statusStages.length) * 100
                      )
                    : 0;

                const isUserAdmin = loggedInUser?.role === "admin";
                const isUserCurrentAssignee =
                  ticket.currentAssignee?._id === loggedInUser?.id;
                // Replace localStorage-based checks with:
                const canModifyTicket =
                  loggedInUser?.role === "admin" ||
                  loggedInUser?.role === "super-admin" ||
                  ticket.currentAssignee?._id === loggedInUser?.id;

                return (
                  <tr key={ticket.ticketNumber}>
                    <td>{ticket.ticketNumber}</td>
                    <td>
                      {ticket.currentAssignee ? (
                        <>
                          {ticket.currentAssignee.firstname}{" "}
                          {ticket.currentAssignee.lastname}
                        </>
                      ) : (
                        "Created by me"
                      )}
                    </td>
                    <td>{ticket.companyName}</td>
                    <td>
                      {new Date(ticket.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="text-end">{ticket.grandTotal.toFixed(2)}</td>

                    <td>
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
                      >
                        <ProgressBar
                          now={progressPercentage}
                          label={`${progressPercentage}%`}
                          variant={getProgressBarVariant(progressPercentage)}
                          style={{ height: "20px" }}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="d-flex gap-2">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleEdit(ticket)}
                          disabled={!canModifyTicket}
                          title={
                            !canModifyTicket
                              ? "Only admin or current assignee can edit this ticket"
                              : "Edit"
                          }
                        >
                          <i className="bi bi-pencil me-1"></i>✏️
                        </Button>

                        {loggedInUser?.role === "super-admin" && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(ticket)}
                            className="ms-1"
                          >
                            🗑️
                          </Button>
                        )}

                        <Button
                          variant="warning"
                          size="sm"
                          onClick={() => handleTransfer(ticket)}
                          disabled={!canModifyTicket}
                          title={
                            !canModifyTicket
                              ? "Only admin or current assignee can transfer this ticket"
                              : "Transfer"
                          }
                        >
                          <i className="bi bi-arrow-left-right me-1"></i>
                          Transfer
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="8" className="text-center py-4">
                  <div className="d-flex flex-column align-items-center">
                    <i
                      className="bi bi-folder-x text-muted"
                      style={{ fontSize: "2rem" }}
                    ></i>
                    <p className="mt-2">No tickets found</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </Table>

        <Modal
          show={showEditModal}
          onHide={() => setShowEditModal(false)}
          fullscreen // This makes it full screen
          centered
        >
          <Modal.Header closeButton className="bg-primary text-white">
            <div className="d-flex justify-content-between align-items-center w-100">
              <Modal.Title>
                Edit Ticket - {editTicket?.ticketNumber}
              </Modal.Title>
              <div className="assignee-info">
                <Badge bg="info">
                  <i className="bi bi-person-fill me-1"></i>
                  {editTicket?.currentAssignee?.firstname}{" "}
                  {editTicket?.currentAssignee?.lastname || "Unassigned"}
                </Badge>
                <small className="d-block text-white-50">
                  Currently Assigned
                </small>
              </div>
            </div>
          </Modal.Header>
          <Modal.Body style={{ overflowY: "auto" }}>
            <ProgressBarWithStages />
            {/* <div className="mt-4">
              <h5>Transfer History</h5>
              {editTicket && transferTableData.names && transferTableData.names.length > 0 ? (
                <Table bordered responsive className="mt-2 transfer-history-table">
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 'bold', width: '150px' }}>Name</td>
                      {transferTableData.names.map((assignee, index) => (
                        <td key={`name-${index}`} className="text-center">
                          {assignee ? `${assignee.firstname} ${assignee.lastname}` : 'N/A'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', width: '150px' }}>Date</td>
                      {transferTableData.dates.map((date, index) => (
                        <td key={`date-${index}`} className="text-center">
                          {date ? new Date(date).toLocaleDateString() : 'N/A'}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 'bold', width: '150px' }}>Note</td>
                      {transferTableData.notes.map((note, index) => (
                        <td key={`note-${index}`} className="text-center">
                          {note || 'N/A'}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </Table>
              ) : (
                <div className="text-muted mt-2">No transfer history available.</div>
              )}
            </div> */}
            <DocumentUploadSection />
            <div className="row mb-4">
              <Form.Group className="col-md-6">
                <Form.Label>Date</Form.Label>
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
            </div>
            <div className="row">
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>Company Name*</Form.Label>
                <Form.Control
                  required
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
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>Quotation Number*</Form.Label>
                <Form.Control
                  required
                  type="text"
                  value={ticketData.quotationNumber}
                  readOnly
                  disabled
                />
              </Form.Group>
            </div>
            <div className="row">
              <div className="col-md-6">
                <h5>Billing Address</h5>
                {renderAddressFields("billing")}
              </div>
              <div className="col-md-6">
                <h5>Shipping Address</h5>
                {renderAddressFields("shipping")}
              </div>
            </div>
            <h5 className="mt-4">Goods Details*</h5>
            <div className="table-responsive">
              <Table bordered className="mb-3">
                <thead>
                  <tr>
                    <th>Sr No.</th>
                    <th>Description*</th>
                    <th>HSN/SAC*</th>
                    <th>Qty*</th>
                    <th>Price*</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {ticketData.goods.map((item, index) => (
                    <tr key={index}>
                      <td className="align-middle">{item.srNo}</td>
                      <td>
                        {index === ticketData.goods.length - 1 &&
                        !item.description ? (
                          <ItemSearchComponent
                            onItemSelect={handleItemSelect}
                            index={index}
                          />
                        ) : (
                          <Form.Control
                            type="text"
                            value={item.description}
                            readOnly
                            disabled
                          />
                        )}
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
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleGoodsChange(index, "quantity", e.target.value)
                          }
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          readOnly
                          disabled
                        />
                      </td>
                      <td className="align-middle">
                        ₹{(item.amount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <Button variant="outline-primary" onClick={addRow} className="mb-3">
              + Add Item
            </Button>
            <div className="bg-light p-3 rounded">
              <div className="row">
                <div className="col-md-4">
                  <p>
                    Total Quantity: <strong>{ticketData.totalQuantity}</strong>
                  </p>
                </div>
                <div className="col-md-4">
                  <p>
                    Total Amount:{" "}
                    <strong>₹{ticketData.totalAmount.toFixed(2)}</strong>
                  </p>
                </div>
                <div className="col-md-4">
                  <p>
                    GST (18%):{" "}
                    <strong>₹{ticketData.gstAmount.toFixed(2)}</strong>
                  </p>
                </div>
              </div>
              <div className="row">
                <div className="col-md-12">
                  <h5>Total: ₹{ticketData.grandTotal.toFixed(2)}</h5>
                </div>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleUpdateTicket}>
              Update Ticket
            </Button>
          </Modal.Footer>
        </Modal>

        <TransferModal />

        <Modal
          show={showPaymentModal}
          onHide={() => setShowPaymentModal(false)}
          size="xl"
          centered
          dialogClassName="custom-modal"
          style={{ maxWidth: "95vw", width: "95%", height: "95vh" }}
          contentClassName="h-100"
        >
          <Modal.Header closeButton className="modal-header-custom">
            <Modal.Title>
              Payment Details - {selectedTicket?.ticketNumber}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body
            className="modal-body-custom"
            style={{ overflowY: "auto" }}
          >
            <div className="d-flex justify-content-between mb-4">
              <div className="text-center p-2 border rounded flex-grow-1 mx-1 payment-document-box">
                <h6>Quotation</h6>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => {
                    setShowPaymentModal(false);
                    handleEdit(selectedTicket);
                    setDocumentType("quotation");
                  }}
                >
                  View
                </Button>
              </div>
              <div className="text-center p-2 border rounded flex-grow-1 mx-1 payment-document-box">
                <h6>PI</h6>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => {
                    setShowPaymentModal(false);
                    handleEdit(selectedTicket);
                    setDocumentType("pi");
                  }}
                >
                  View
                </Button>
              </div>
              <div className="text-center p-2 border rounded flex-grow-1 mx-1 payment-document-box">
                <h6>PO</h6>
                {selectedTicket?.documents?.po ? (
                  <a
                    href={`http://localhost:3000/${selectedTicket.documents.po}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline-primary btn-sm"
                  >
                    View
                  </a>
                ) : (
                  <span className="text-muted">N/A</span>
                )}
              </div>
              <div className="text-center p-2 border rounded flex-grow-1 mx-1 payment-document-box">
                <h6>Dispatch</h6>
                {selectedTicket?.documents?.challan ? (
                  <a
                    href={`http://localhost:3000/${selectedTicket.documents.challan}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-outline-primary btn-sm"
                  >
                    View
                  </a>
                ) : (
                  <span className="text-muted">N/A</span>
                )}
              </div>
            </div>
            {/* Transfer History Table for Payment Modal */}
            <div className="mt-4">
              <h5>Transfer History</h5>
              {selectedTicket &&
              transferTableData.names &&
              transferTableData.names.length > 0 ? (
                <Table
                  bordered
                  responsive
                  className="mt-2 transfer-history-table"
                >
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: "bold", width: "150px" }}>
                        Name
                      </td>
                      {transferTableData.names.map((assignee, index) => (
                        <td
                          key={`payment-name-${index}`}
                          className="text-center"
                        >
                          {assignee
                            ? `${assignee.firstname} ${assignee.lastname}`
                            : "N/A"}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold", width: "150px" }}>
                        Date
                      </td>
                      {transferTableData.dates.map((date, index) => (
                        <td
                          key={`payment-date-${index}`}
                          className="text-center"
                        >
                          {date ? new Date(date).toLocaleDateString() : "N/A"}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td style={{ fontWeight: "bold", width: "150px" }}>
                        Note
                      </td>
                      {transferTableData.notes.map((note, index) => (
                        <td
                          key={`payment-note-${index}`}
                          className="text-center"
                        >
                          {note || "N/A"}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </Table>
              ) : (
                <div className="text-muted mt-2">
                  No transfer history available.
                </div>
              )}
            </div>
          </Modal.Body>
          <Modal.Footer className="modal-footer-custom">
            <Button
              variant="secondary"
              onClick={() => setShowPaymentModal(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={handlePaymentSubmit}>
              Record Payment
            </Button>
          </Modal.Footer>
        </Modal>

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => {
              if (page >= 1 && page <= totalPages) setCurrentPage(page);
            }}
          />
        )}
      </div>
    </div>
  );
}

function getProgressBarVariant(percentage) {
  if (percentage < 30) return "danger";
  if (percentage < 70) return "warning";
  return "success";
}
