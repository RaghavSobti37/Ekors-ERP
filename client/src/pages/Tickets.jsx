import React, { useState, useEffect, useMemo } from "react";
import Pagination from '../components/Pagination';
import axios from "axios";
import {
  Modal,
  Button,
  Form,
  Table,
  ProgressBar,
  Alert,
  Dropdown,
} from "react-bootstrap";
import Navbar from "../components/Navbar.jsx";
import {
  PDFViewer,
  PDFDownloadLink,
} from "@react-pdf/renderer";
import "../css/Ticket.css";
import QuotationPDF from "../components/QuotationPDF.jsx";
import PIPDF from "../components/PIPDF.jsx";

const SortIndicator = ({ columnKey, sortConfig }) => {
  if (sortConfig.key !== columnKey) return <span>↕️</span>;
  return sortConfig.direction === "ascending" ? (
    <span>⬆️</span>
  ) : (
    <span>⬇️</span>
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
      const userData = JSON.parse(localStorage.getItem('erp-user'));
      return userData?.token || null;
    } catch (e) {
      console.error('Failed to parse user data:', e);
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
          Authorization: `Bearer ${token}`
        }
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
      const userData = JSON.parse(localStorage.getItem('erp-user'));
      return userData?.token || null;
    } catch (e) {
      console.error('Failed to parse user data:', e);
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
          Authorization: `Bearer ${token}`
        }
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
              <strong>{user.firstname} {user.lastname}</strong>
              <span className="text-muted"> - {user.email}</span>
              <br />
              <small>
                Role: {user.role}
              </small>
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
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editTicket, setEditTicket] = useState(null);
  const [transferTicket, setTransferTicket] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [documentType, setDocumentType] = useState(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentReference, setPaymentReference] = useState('');
  const [ticketData, setTicketData] = useState({
    companyName: "",
    quotationNumber: "",
    billingAddress: {
      address1: "",
      address2: "",
      city: "",
      state: "",
      pincode: ""
    },
    shippingAddress: {
      address1: "",
      address2: "",
      city: "",
      state: "",
      pincode: ""
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
      feedback: "",
    },
  });
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "ascending",
  });

  const statusStages = [
    "Quotation Sent",
    "PO Received",
    "Payment Pending",
    "Inspection",
    "Packing List",
    "Invoice Sent",
    "Completed",
  ];

  const getAuthToken = () => {
    try {
      const userData = JSON.parse(localStorage.getItem('erp-user'));
      return userData?.token || null;
    } catch (e) {
      console.error('Failed to parse user data:', e);
      return null;
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await axios.get("http://localhost:3000/api/tickets", {
        headers: {
          Authorization: `Bearer ${token}`
        }
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

  const handleProgressClick = (ticket) => {
    setSelectedTicket(ticket);
    setPaymentAmount(ticket.grandTotal - (ticket.payments?.reduce((sum, p) => sum + p.amount, 0) || 0));
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
          reference: paymentReference
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (response.status === 200) {
        await fetchTickets();
        setShowPaymentModal(false);
        alert('Payment recorded successfully!');
      }
    } catch (error) {
      console.error("Error recording payment:", error);
      setError(`Failed to record payment: ${error.response?.data?.message || error.message}`);
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

      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === "ascending" ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === "ascending" ? 1 : -1;
      }
      return 0;
    });
  }, [tickets, sortConfig]);

  const filteredTickets = useMemo(() => {
    if (!searchTerm) return sortedTickets;

    const term = searchTerm.toLowerCase();
    return sortedTickets.filter(
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
  }, [sortedTickets, searchTerm]);

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
    setTicketData({
      ...ticketData,
      goods: [
        ...ticketData.goods,
        {
          srNo: ticketData.goods.length + 1,
          description: "",
          hsnSacCode: "",
          quantity: 1,
          price: 0,
          amount: 0,
        },
      ],
    });
  };

  const handleItemSelect = (item, index) => {
    const updatedGoods = [...ticketData.goods];
    updatedGoods[index] = {
      ...updatedGoods[index],
      description: item.name,
      hsnSacCode: item.hsnCode,
      price: item.price,
      amount: updatedGoods[index].quantity * item.price
    };

    updateTotals(updatedGoods);
  };

  const handleGoodsChange = (index, field, value) => {
    const updatedGoods = [...ticketData.goods];
    updatedGoods[index][field] = value;

    if (field === 'quantity' || field === 'price') {
      updatedGoods[index].amount = updatedGoods[index].quantity * updatedGoods[index].price;
    }

    updateTotals(updatedGoods);
  };

  const updateTotals = (goods) => {
    const totalQuantity = goods.reduce(
      (sum, item) => sum + Number(item.quantity),
      0
    );
    const totalAmount = goods.reduce(
      (sum, item) => sum + Number(item.amount),
      0
    );
    const gstAmount = totalAmount * 0.18;
    const grandTotal = totalAmount + gstAmount;

    setTicketData({
      ...ticketData,
      goods,
      totalQuantity,
      totalAmount,
      gstAmount,
      grandTotal,
    });
  };

  const handleEdit = (ticket) => {
    setEditTicket(ticket);
    setTicketData({
      companyName: ticket.companyName,
      quotationNumber: ticket.quotationNumber,
      billingAddress: ticket.billingAddress || {
        address1: "",
        address2: "",
        city: "",
        state: "",
        pincode: ""
      },
      shippingAddress: ticket.shippingAddress || {
        address1: "",
        address2: "",
        city: "",
        state: "",
        pincode: ""
      },
      goods: ticket.goods,
      totalQuantity: ticket.totalQuantity,
      totalAmount: ticket.totalAmount,
      gstAmount: ticket.gstAmount,
      grandTotal: ticket.grandTotal,
      status: ticket.status,
      documents: ticket.documents || {
        quotation: "",
        po: "",
        pi: "",
        challan: "",
        packingList: "",
        feedback: "",
      },
    });
    setShowEditModal(true);
  };

  const handleTransfer = (ticket) => {
    setTransferTicket(ticket);
    setSelectedUser(null);
    setShowTransferModal(true);
  };

  const handleUserSelect = (user) => {
    setSelectedUser(user);
  };

  const handleStatusChange = (status) => {
    setTicketData({ ...ticketData, status });
    setShowStatusDropdown(false);
  };

  const handleUpdateTicket = async () => {
    try {
      const updateData = {
        ...ticketData,
        _id: undefined,
        __v: undefined,
        createdAt: undefined,
        updatedAt: undefined
      };

      const response = await axios.put(
        `http://localhost:3000/api/tickets/${editTicket._id}`,
        updateData,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAuthToken()}`
          }
        }
      );

      if (response.status === 200) {
        fetchTickets();
        setShowEditModal(false);
        setError(null);
      }
    } catch (error) {
      console.error("Error updating ticket:", error);
      setError(`Failed to update ticket: ${error.response?.data?.message || error.message}`);
    }
  };

  const handleTransferTicket = async () => {
    if (!selectedUser) {
      setError("Please select a user to transfer the ticket to");
      return;
    }

    try {
      const response = await axios.post(
        `http://localhost:3000/api/tickets/${transferTicket._id}/transfer`,
        { userId: selectedUser._id },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${getAuthToken()}`
          }
        }
      );

      if (response.status === 200) {
        setError(null);
        await fetchTickets();
        setShowTransferModal(false);
        alert(`Ticket successfully transferred to ${selectedUser.firstname} ${selectedUser.lastname}`);
      }
    } catch (error) {
      console.error("Error transferring ticket:", error);
      setError(`Failed to transfer ticket: ${error.response?.data?.message || error.message}`);
    }
  };

  const renderDocumentSection = () => {
    if (!documentType || !editTicket) return null;

    return (
      <div className="mt-4 p-3 border rounded">
        <h5 className="mt-4">{documentType.toUpperCase()} Document</h5>
        {documentType === "quotation" && (
          <>
            <PDFViewer width="100%" height="500px" className="mb-3">
              <QuotationPDF quotation={editTicket} />
            </PDFViewer>
            <div className="d-flex justify-content-center gap-2">
              <PDFDownloadLink
                document={<QuotationPDF quotation={editTicket} />}
                fileName={`quotation_${editTicket.quotationNumber}.pdf`}
              >
                {({ loading }) => (
                  <Button variant="primary" disabled={loading}>
                    {loading ? "Generating PDF..." : "Download Quotation"}
                  </Button>
                )}
              </PDFDownloadLink>
              <Button
                variant="secondary"
                onClick={() => setDocumentType(null)}
              >
                Close
              </Button>
            </div>
          </>
        )}
        {documentType === "pi" && (
          <>
            <PDFViewer width="100%" height="500px" className="mb-3">
              <PIPDF ticket={editTicket} />
            </PDFViewer>
            <div className="d-flex justify-content-center gap-2">
              <PDFDownloadLink
                document={<PIPDF ticket={editTicket} />}
                fileName={`pi_${editTicket.quotationNumber}.pdf`}
              >
                {({ loading }) => (
                  <Button variant="primary" disabled={loading}>
                    {loading ? "Generating PDF..." : "Download PI"}
                  </Button>
                )}
              </PDFDownloadLink>
              <Button
                variant="secondary"
                onClick={() => setDocumentType(null)}
              >
                Close
              </Button>
            </div>
          </>
        )}
        {!["quotation", "pi"].includes(documentType) && ticketData.documents?.[documentType] && (
          <div className="text-center">
            <a
              href={`http://localhost:3000/${ticketData.documents[documentType]}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
            >
              View {documentType.toUpperCase()} Document
            </a>
          </div>
        )}
      </div>
    );
  };

  const handleDocumentUpload = async (file, documentType) => {
    try {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("documentType", documentType);

      const response = await axios.post(
        `http://localhost:3000/api/tickets/${editTicket._id}/documents`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${getAuthToken()}`
          }
        }
      );

      setTicketData((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          [documentType]: response.data.documents[documentType],
        },
      }));

      setEditTicket((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          [documentType]: response.data.documents[documentType],
        },
      }));

      return true;
    } catch (error) {
      console.error("Error uploading document:", error);
      setError("Failed to upload document");
      return false;
    }
  };

  return (
    <div>
      <Navbar />
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 style={{ color: "black" }}>Open Tickets</h2>

          <div className="d-flex align-items-center gap-3" style={{ width: "50%" }}>
            <Form.Control
              type="search"
              placeholder="Search here"
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
              <th
                onClick={() => requestSort("quotationNumber")}
                style={{ cursor: "pointer" }}
              >
                Quotation No{" "}
                <SortIndicator
                  columnKey="quotationNumber"
                  sortConfig={sortConfig}
                />
              </th>
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
                <td colSpan="7" className="text-center">
                  Loading tickets...
                </td>
              </tr>
            ) : currentItems.length > 0 ? (
              currentItems.map((ticket) => {
                const progressPercentage = Math.round(
                  ((statusStages.indexOf(ticket.status) + 1) /
                    statusStages.length * 100
                  ));
                return (
                  <tr key={ticket.ticketNumber}>
                    <td>{ticket.ticketNumber}</td>
                    <td>{ticket.quotationNumber}</td>
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
                      <div 
                        className="d-flex flex-column clickable-progress" 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProgressClick(ticket);
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        <ProgressBar
                          now={progressPercentage}
                          label={`${progressPercentage}%`}
                          variant={getProgressBarVariant(progressPercentage)}
                          className="mb-1"
                          style={{ height: "20px" }}
                        />
                        <small className="text-center fw-bold">
                          {ticket.status}
                        </small>
                      </div>
                    </td>
                    <td>
                      <div className="d-flex gap-2">
                        <Button
                          variant="info"
                          size="sm"
                          onClick={() => handleEdit(ticket)}
                        >
                          ✏️
                        </Button>
                        <Button
                          variant="warning"
                          size="sm"
                          onClick={() => handleTransfer(ticket)}
                        >
                          Transfer
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="text-center">
                  No tickets found.
                </td>
              </tr>
            )}
          </tbody>
        </Table>

        {filteredTickets.length > itemsPerPage && (
          <div className="d-flex justify-content-center mt-3">
            <nav>
              <ul className="pagination">
                <li className={`page-item ${currentPage === 1 ? "disabled" : ""}`}>
                  <button
                    className="page-link"
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    Previous
                  </button>
                </li>

                {Array.from({ length: totalPages }, (_, i) => (
                  <li
                    key={i + 1}
                    className={`page-item ${currentPage === i + 1 ? "active" : ""
                      }`}
                  >
                    <button
                      className="page-link"
                      onClick={() => setCurrentPage(i + 1)}
                    >
                      {i + 1}
                    </button>
                  </li>
                ))}

                <li
                  className={`page-item ${currentPage === totalPages ? "disabled" : ""
                    }`}
                >
                  <button
                    className="page-link"
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        )}

        {/* Edit Ticket Modal */}
        <Modal
          show={showEditModal}
          onHide={() => setShowEditModal(false)}
          size="xl"
          centered
          dialogClassName="modal-95w"
          style={{ maxWidth: '95vw', width: '95%', height: '95vh' }}
          contentClassName="h-100"
        >
          <Modal.Header closeButton>
            <Modal.Title>Edit Ticket - {editTicket?.ticketNumber}</Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ overflowY: 'auto' }}>
            {/* Status Progress Bar */}
            <div className="mb-4">
              <ProgressBar style={{ height: "30px" }}>
                {statusStages.map((stage, index) => {
                  const isCompleted =
                    statusStages.indexOf(ticketData.status) >= index;
                  const isCurrent = ticketData.status === stage;
                  return (
                    <ProgressBar
                      key={stage}
                      now={100 / statusStages.length}
                      variant={isCompleted ? "success" : "secondary"}
                      label={isCurrent ? stage : ""}
                      animated={isCurrent}
                    />
                  );
                })}
              </ProgressBar>
            </div>

            {/* Status Update Dropdown */}
            <div className="row mb-4">
              <Form.Group className="col-md-6">
                <Form.Label>Update Status</Form.Label>
                <Dropdown
                  show={showStatusDropdown}
                  onToggle={(isOpen) => setShowStatusDropdown(isOpen)}
                >
                  <Dropdown.Toggle variant="primary" id="status-dropdown">
                    {ticketData.status}
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    {statusStages.map((stage) => (
                      <Dropdown.Item
                        key={stage}
                        onClick={() => handleStatusChange(stage)}
                      >
                        {stage}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
              </Form.Group>
              <Form.Group className="col-md-6">
                <Form.Label>Date</Form.Label>
                <Form.Control
                  type="text"
                  value={new Date(editTicket?.createdAt).toLocaleDateString()}
                  readOnly
                  disabled
                />
              </Form.Group>
            </div>

            {/* Company and Quotation Info */}
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
                  onChange={(e) =>
                    setTicketData({
                      ...ticketData,
                      quotationNumber: e.target.value,
                    })
                  }
                  readOnly
                  disabled
                />
              </Form.Group>
            </div>

            {/* Address Information */}
            <div className="row">
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>Billing Address*</Form.Label>
                <Form.Control
                  required
                  as="textarea"
                  rows={3}
                  value={ticketData.billingAddress}
                  onChange={(e) =>
                    setTicketData({
                      ...ticketData,
                      billingAddress: e.target.value,
                    })
                  }
                />
              </Form.Group>
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>Shipping Address*</Form.Label>
                <Form.Control
                  required
                  as="textarea"
                  rows={3}
                  value={ticketData.shippingAddress}
                  onChange={(e) =>
                    setTicketData({
                      ...ticketData,
                      shippingAddress: e.target.value,
                    })
                  }
                />
              </Form.Group>
            </div>

            {/* Goods Details */}
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
                        {index === ticketData.goods.length - 1 && !item.description ? (
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
                        ₹{item.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <Button variant="outline-primary" onClick={addRow} className="mb-3">
              + Add Item
            </Button>

            {/* Totals Section */}
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

            {/* Documents Section */}
            <div className="mt-4">
              <h4>Documents</h4>
              <div className="d-flex flex-wrap gap-2 mb-3">
                {Object.entries({
                  quotation: "Quotation",
                  po: "PO",
                  pi: "PI",
                  challan: "Challan",
                  packingList: "Packing List",
                  feedback: "Feedback",
                }).map(([docKey, docName]) => (
                  <div key={docKey} className="d-flex align-items-center gap-2">
                    <Button
                      variant={
                        documentType === docKey ? "primary" : "outline-primary"
                      }
                      onClick={() => setDocumentType(docKey)}
                    >
                      {docName}
                    </Button>
                    {["quotation", "pi"].includes(docKey) ? (
                      <Button
                        variant="success"
                        onClick={() => setDocumentType(docKey)}
                      >
                        Download
                      </Button>
                    ) : (
                      ticketData.documents?.[docKey] && (
                        <a
                        href={ticketData.documents[docKey].startsWith('/') 
                          ? `http://localhost:3000${ticketData.documents[docKey]}` 
                          : `http://localhost:3000/${ticketData.documents[docKey]}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-success btn-sm"
                        >
                          View
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
                          accept=".pdf,.doc,.docx,.xls,.xlsx"
                        />
                        <label
                          htmlFor={`upload-${docKey}`}
                          className="btn btn-info btn-sm mb-0"
                        >
                          Upload
                        </label>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {renderDocumentSection()}
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

        {/* Transfer Ticket Modal */}
        <Modal
          show={showTransferModal}
          onHide={() => setShowTransferModal(false)}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>Transfer Ticket - {transferTicket?.ticketNumber}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="mb-3">
              <h5>Search User to Transfer To</h5>
              <UserSearchComponent onUserSelect={handleUserSelect} />
            </div>

            {selectedUser && (
              <div className="selected-user-info p-3 border rounded mt-3">
                <h6>Selected User:</h6>
                <p><strong>Name:</strong> {selectedUser.firstname} {selectedUser.lastname}</p>
                <p><strong>Email:</strong> {selectedUser.email}</p>
                <p><strong>Role:</strong> {selectedUser.role}</p>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowTransferModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleTransferTicket}
              disabled={!selectedUser}
            >
              Transfer Ticket
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Payment Modal */}
        <Modal
          show={showPaymentModal}
          onHide={() => setShowPaymentModal(false)}
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>Payment Details - {selectedTicket?.ticketNumber}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <div className="d-flex justify-content-between mb-4">
              <div className="text-center p-2 border rounded flex-grow-1 mx-1 payment-document-box">
                <h6>Quotation</h6>
                <Button 
                  variant="outline-primary" 
                  size="sm"
                  onClick={() => {
                    setShowPaymentModal(false);
                    handleEdit(selectedTicket);
                    setDocumentType('quotation');
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
                    setDocumentType('pi');
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

            <h5 className="mt-3">Payment Information</h5>
            <div className="bg-light p-3 rounded mb-3">
              <div className="row">
                <div className="col-md-6">
                  <p>Grand Total: <strong>₹{selectedTicket?.grandTotal?.toFixed(2)}</strong></p>
                </div>
                <div className="col-md-6">
                  <p>Paid Amount: <strong>₹{(selectedTicket?.payments?.reduce((sum, p) => sum + p.amount, 0) || 0).toFixed(2)}</strong></p>
                </div>
                <div className="col-md-12">
                  <p>Balance Due: <strong>₹{(selectedTicket?.grandTotal - (selectedTicket?.payments?.reduce((sum, p) => sum + p.amount, 0) || 0)).toFixed(2)}</strong></p>
                </div>
              </div>
            </div>

            <Form>
              <Form.Group className="mb-3">
                <Form.Label>Payment Amount (₹)*</Form.Label>
                <Form.Control
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value))}
                  min="0"
                  max={selectedTicket?.grandTotal - (selectedTicket?.payments?.reduce((sum, p) => sum + p.amount, 0) || 0)}
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
                  rows={2}
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Payment reference number or notes"
                />
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowPaymentModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handlePaymentSubmit}>
              Record Payment
            </Button>
          </Modal.Footer>
        </Modal>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => {
            if (page >= 1 && page <= totalPages) setCurrentPage(page);
          }}
        />
      </div>
    </div>
  );
}

function getProgressBarVariant(percentage) {
  if (percentage < 30) return "danger";
  if (percentage < 70) return "warning";
  return "success";
}