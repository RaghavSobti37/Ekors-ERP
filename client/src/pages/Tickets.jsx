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

  const getAuthToken = () => {
    try {
      const userData = JSON.parse(localStorage.getItem("erp-user"));
      return userData?.token || null;
    } catch (e) {
      console.error("Failed to parse user data:", e);
      return null;
    }
  };

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

  const getAuthToken = () => {
    try {
      const userData = JSON.parse(localStorage.getItem("erp-user"));
      return userData?.token || null;
    } catch (e) {
      console.error("Failed to parse user data:", e);
      return null;
    }
  };

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
      challan: "",
      packingList: "",
      invoice: "",
      feedback: "",
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
    challan: "Inspection",
    packingList: "Packing List",
    invoice: "Invoice Sent",
    feedback: "Closed",
  };

  const documentIconMap = {
    quotation: "bi-file-earmark-text",
    po: "bi-file-earmark-check",
    pi: "bi-file-earmark-medical",
    challan: "bi-truck",
    packingList: "bi-box-seam",
    invoice: "bi-file-earmark-ruled",
    feedback: "bi-chat-square-text",
  };

  const documentColorMap = {
    quotation: "primary",
    po: "success",
    pi: "warning",
    challan: "info",
    packingList: "dark",
    invoice: "danger",
    feedback: "secondary",
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

  const getAuthToken = () => {
    try {
      const userData = JSON.parse(localStorage.getItem("erp-user"));
      return userData?.token || null;
    } catch (e) {
      console.error("Failed to parse user data:", e);
      return null;
    }
  };

  const getLoggedInUserData = () => {
    try {
      const userDataString = localStorage.getItem("erp-user");
      if (userDataString) {
        return JSON.parse(userDataString);
      }
      return null;
    } catch (e) {
      console.error("Failed to parse user data from localStorage:", e);
      return null;
    }
  };

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
      const errorMsg =
        error.response?.data?.error || "Failed to load tickets";
      setError(errorMsg);
      console.error("Error fetching tickets:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setLoggedInUser(getLoggedInUserData());
    fetchTickets();
  }, []);

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

    if (statusFilter !== 'all') {
      filtered = filtered.filter(ticket => {
        if (statusFilter === 'open') {
          return ticket.status !== 'Completed' && ticket.status !== 'Hold';
        } else if (statusFilter === 'closed') {
          return ticket.status === 'Completed';
        } else if (statusFilter === 'hold') {
          return ticket.status === 'Hold';
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

  const handleEdit = (ticket) => {
    setEditTicket(ticket);
    const billingAddress = Array.isArray(ticket.billingAddress)
      ? {
          address1: ticket.billingAddress[0] || "",
          address2: ticket.billingAddress[1] || "",
          city: ticket.billingAddress[3] || "",
          state: ticket.billingAddress[2] || "",
          pincode: ticket.billingAddress[4] || "",
        }
      : ticket.billingAddress || {
          address1: "",
          address2: "",
          city: "",
          state: "",
          pincode: "",
        };

    const shippingAddress = Array.isArray(ticket.shippingAddress)
      ? {
          address1: ticket.shippingAddress[0] || "",
          address2: ticket.shippingAddress[1] || "",
          city: ticket.shippingAddress[3] || "",
          state: ticket.shippingAddress[2] || "",
          pincode: ticket.shippingAddress[4] || "",
        }
      : ticket.shippingAddress || {
          address1: "",
          address2: "",
          city: "",
          state: "",
          pincode: "",
        };

    setTicketData({
      companyName: ticket.companyName || "",
      quotationNumber: ticket.quotationNumber || "",
      billingAddress,
      shippingAddress,
      goods: ticket.goods || [],
      totalQuantity: ticket.totalQuantity || 0,
      totalAmount: ticket.totalAmount || 0,
      gstAmount: ticket.gstAmount || 0,
      grandTotal: ticket.grandTotal || 0,
      status: ticket.status || statusStages[0],
      documents: ticket.documents || {
        quotation: "",
        po: "",
        pi: "",
        challan: "",
        packingList: "",
        invoice: "",
        feedback: "",
      },
      dispatchDays: ticket.dispatchDays || "7-10 working",
      validityDate:
        ticket.validityDate ||
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
        documents: { ...(prev?.documents || {}), [docType]: newDocumentPath },
      }));

      return true;
    } catch (error) {
      console.error("Error uploading document:", error);
      setError("Failed to upload document");
      return false;
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
      case "Completed":
        return "success";
      default:
        return "light";
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
          po: "PO",
          pi: "PI",
          challan: "Challan",
          packingList: "Packing List",
          invoice: "Invoice",
          feedback: "Feedback",
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
            {["quotation", "pi"].includes(docKey) ? (
              <Button
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
              </Button>
            ) : (
              ticketData.documents?.[docKey] && (
                <a
                  href={
                    ticketData.documents[docKey].startsWith("/")
                      ? `http://localhost:3000${ticketData.documents[docKey]}`
                      : `http://localhost:3000/${ticketData.documents[docKey]}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`btn btn-${documentColorMap[docKey]} ms-1`}
                  title={`View ${docName}`}
                >
                  <i className="bi bi-eye"></i>
                </a>
              )
            )}
            {!["quotation", "pi"].includes(docKey) && (
              <>
                <input
                  type="file"
                  id={`upload-${docKey}`}
                  style={{ display: "none" }}
                  onChange={(e) =>
                    handleDocumentUpload(e.target.files[0], docKey)
                  }
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpeg,.jpg,.png"
                />
                <label
                  htmlFor={`upload-${docKey}`}
                  className={`btn btn-${documentColorMap[docKey]} ms-1`}
                  title={`Upload ${docName}`}
                >
                  <i className="bi bi-upload"></i>
                </label>
              </>
            )}
          </div>
        ))}
      </div>
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
          <div className="d-flex align-items-center gap-3" style={{ width: "80%" }}>
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
                checked={statusFilter === 'all'}
                onChange={() => {
                  setStatusFilter('all');
                  setCurrentPage(1);
                }}
              />
              <Form.Check
                type="radio"
                inline
                id="filter-open"
                label="Open"
                name="statusFilter"
                checked={statusFilter === 'open'}
                onChange={() => {
                  setStatusFilter('open');
                  setCurrentPage(1);
                }}
              />
              <Form.Check
                type="radio"
                inline
                id="filter-closed"
                label="Closed"
                name="statusFilter"
                checked={statusFilter === 'closed'}
                onChange={() => {
                  setStatusFilter('closed');
                  setCurrentPage(1);
                }}
              />
              <Form.Check
                type="radio"
                inline
                id="filter-hold"
                label="Hold"
                name="statusFilter"
                checked={statusFilter === 'hold'}
                onChange={() => {
                  setStatusFilter('hold');
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
                const isUserCurrentAssignee = ticket.currentAssignee?._id === loggedInUser?.id;
                const canModifyTicket = isUserAdmin || isUserCurrentAssignee;

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
                          title={!canModifyTicket ? "Only admin or current assignee can edit this ticket" : "Edit"}
                        >
                          <i className="bi bi-pencil me-1"></i>✏️
                        </Button>

                        <Button
                          variant="warning"
                          size="sm"
                          onClick={() => handleTransfer(ticket)}
                          disabled={!canModifyTicket}
                          title={!canModifyTicket ? "Only admin or current assignee can transfer this ticket" : "Transfer"}
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
          size="xl"
          centered
          dialogClassName="modal-95w"
          style={{ maxWidth: "95vw", width: "95%", height: "95vh" }}
          contentClassName="h-100"
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
                  <h5>Grand Total: ₹{ticketData.grandTotal.toFixed(2)}</h5>
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
            <div className="row">
              <div className="col-md-8">
                <h5 className="mt-3">Payment Information</h5>
                <div className="bg-light p-3 rounded mb-3">
                  <div className="row">
                    <div className="col-md-6">
                      <p>
                        Grand Total:{" "}
                        <strong>
                          ₹{selectedTicket?.grandTotal?.toFixed(2)}
                        </strong>
                      </p>
                    </div>
                    <div className="col-md-6">
                      <p>
                        Paid Amount:{" "}
                        <strong>
                          ₹
                          {(
                            selectedTicket?.payments?.reduce(
                              (sum, p) => sum + p.amount,
                              0
                            ) || 0
                          ).toFixed(2)}
                        </strong>
                      </p>
                    </div>
                    <div className="col-md-12">
                      <p>
                        Balance Due:{" "}
                        <strong>
                          ₹
                          {(
                            selectedTicket?.grandTotal -
                            (selectedTicket?.payments?.reduce(
                              (sum, p) => sum + p.amount,
                              0
                            ) || 0)
                          ).toFixed(2)}
                        </strong>
                      </p>
                    </div>
                  </div>
                </div>
                <Form>
                  <Form.Group className="mb-3">
                    <Form.Label>Payment Amount (₹)*</Form.Label>
                    <Form.Control
                      type="number"
                      value={paymentAmount}
                      onChange={(e) =>
                        setPaymentAmount(parseFloat(e.target.value))
                      }
                      min="0"
                      max={
                        selectedTicket?.grandTotal -
                        (selectedTicket?.payments?.reduce(
                          (sum, p) => sum + p.amount,
                          0
                        ) || 0)
                      }
                      step="0.01"
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Payment Date*</Form.Label>
                    <Form.Control
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Reference/Notes</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="Payment reference number or notes"
                    />
                  </Form.Group>
                </Form>
              </div>
              <div className="col-md-4">
                <h5 className="mt-3">Payment History</h5>
                {selectedTicket?.payments?.length > 0 ? (
                  <div className="payment-history-container">
                    {selectedTicket.payments.map((payment, index) => (
                      <div
                        key={index}
                        className="payment-history-item p-3 mb-2 border rounded"
                      >
                        <div className="d-flex justify-content-between">
                          <span className="fw-bold">
                            ₹{payment.amount.toFixed(2)}
                          </span>
                          <span className="text-muted small">
                            {new Date(payment.date).toLocaleDateString()}
                          </span>
                        </div>
                        {payment.reference && (
                          <div className="mt-1 small text-muted">
                            Ref: {payment.reference}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center p-4 border rounded bg-light">
                    No payment history found
                  </div>
                )}
              </div>
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