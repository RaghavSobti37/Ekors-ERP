import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { Modal, Button, Form, Table, Alert } from "react-bootstrap";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import ItemSearchComponent from "../components/ItemSearch";
import QuotationPDF from "../components/QuotationPDF";
import CreateTicketModal from "../components/CreateTicketModal";
import "../css/Quotation.css";
import "../css/Items.css";

import {
  PDFViewer,
  PDFDownloadLink,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const fullScreenModalStyle = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '95vw',
  height: '95vh',
  maxWidth: 'none',
  margin: 0,
  padding: 0,
  overflow: 'auto'
};



// PDF Document Styles
const pdfStyles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 11,
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: "center",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  section: {
    marginBottom: 15,
  },
  table: {
    display: "table",
    width: "auto",
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#000",
  },
  tableRow: {
    flexDirection: "row",
  },
  tableColHeader: {
    width: "25%",
    fontWeight: "bold",
    border: "1px solid #000",
    padding: 5,
  },
  tableCol: {
    width: "25%",
    border: "1px solid #000",
    padding: 5,
    textAlign: "center",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 5,
    fontWeight: "bold",
  },
  footer: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 10,
    color: "red",
  },


});

// Quotation PDF Template
const QuotationTemplate = ({ quotation }) => (
  <Document>
    <Page size="A4" style={pdfStyles.page}>
      <Text style={pdfStyles.header}>Quotation</Text>

      <View style={pdfStyles.section}>
        <Text>Quotation Number: {quotation.referenceNumber}</Text>
        <Text>Date: {new Date(quotation.date).toLocaleDateString()}</Text>
        <Text>
          Validity Date: {new Date(quotation.validityDate).toLocaleDateString()}
        </Text>
      </View>

      <View style={pdfStyles.section}>
        <Text>To:</Text>
        <Text>{quotation.client.companyName}</Text>
        <Text>GST: {quotation.client.gstNumber}</Text>
      </View>

      <View style={pdfStyles.table}>
        <View style={[pdfStyles.tableRow, { backgroundColor: "#f0f0f0" }]}>
          <Text style={[pdfStyles.tableCol, { width: "10%" }]}>S.No</Text>
          <Text style={[pdfStyles.tableCol, { width: "40%" }]}>
            Description
          </Text>
          <Text style={[pdfStyles.tableCol, { width: "15%" }]}>HSN/SAC</Text>
          <Text style={[pdfStyles.tableCol, { width: "10%" }]}>Qty</Text>
          <Text style={[pdfStyles.tableCol, { width: "15%" }]}>Rate</Text>
          <Text style={[pdfStyles.tableCol, { width: "10%" }]}>Amount</Text>
        </View>

        {quotation.goods.map((item, index) => (
          <View style={pdfStyles.tableRow} key={index}>
            <Text style={[pdfStyles.tableCol, { width: "10%" }]}>
              {index + 1}
            </Text>
            <Text style={[pdfStyles.tableCol, { width: "40%" }]}>
              {item.description}
            </Text>
            <Text style={[pdfStyles.tableCol, { width: "15%" }]}>
              {item.hsnSacCode}
            </Text>
            <Text style={[pdfStyles.tableCol, { width: "10%" }]}>
              {item.quantity}
            </Text>
            <Text style={[pdfStyles.tableCol, { width: "15%" }]}>
              ₹{item.price.toFixed(2)}
            </Text>
            <Text style={[pdfStyles.tableCol, { width: "10%" }]}>
              ₹{item.amount.toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      <View style={pdfStyles.totalRow}>
        <Text>Sub Total: ₹{quotation.totalAmount.toFixed(2)}</Text>
      </View>
      <View style={pdfStyles.totalRow}>
        <Text>GST (18%): ₹{quotation.gstAmount.toFixed(2)}</Text>
      </View>
      <View style={pdfStyles.totalRow}>
        <Text>Grand Total: ₹{quotation.grandTotal.toFixed(2)}</Text>
      </View>

      <View style={pdfStyles.section}>
        <Text>Terms & Conditions:</Text>
        <Text>- Payment: 100% advance</Text>
        <Text>- Delivery: Within {quotation.dispatchDays} days</Text>
        <Text>
          - Validity: {new Date(quotation.validityDate).toLocaleDateString()}
        </Text>
      </View>

      <View style={pdfStyles.footer}>
        <Text>For {quotation.client.companyName}</Text>
        <Text>Authorized Signatory</Text>
      </View>
    </Page>
  </Document>
);

const formatDateForInput = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const GoodsTable = ({
  goods,
  handleGoodsChange,
  currentQuotation,
  isEditing,
  onAddItem,
}) => {
  return (
    <div className="table-responsive">
      <Table bordered className="mb-3">
        <thead>
          <tr>
            <th>Sr No.</th>
            <th>Description <span className="text-danger">*</span></th>
            <th>HSN/SAC <span className="text-danger">*</span></th>
            <th>Qty <span className="text-danger">*</span></th>
            <th>Price <span className="text-danger">*</span></th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {goods.map((item, index) => (
            <tr key={index}>
              <td>{item.srNo}</td>
              <td>
                {!isEditing ? (
                  item.description
                ) : (
                  <Form.Control
                    required
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      handleGoodsChange(index, "description", e.target.value)
                    }
                  />
                )}
              </td>
              <td>
                {!isEditing ? (
                  item.hsnSacCode
                ) : (
                  <Form.Control
                    required
                    type="text"
                    value={item.hsnSacCode}
                    onChange={(e) =>
                      handleGoodsChange(index, "hsnSacCode", e.target.value)
                    }
                  />
                )}
              </td>
              <td>
                {!isEditing ? (
                  item.quantity
                ) : (
                  <Form.Control
                    required
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) =>
                      handleGoodsChange(index, "quantity", e.target.value)
                    }
                  />
                )}
              </td>
              <td>
                {!isEditing ? (
                  item.unit
                ) : (
                  <Form.Control
                    as="select"
                    value={item.unit || "Nos"}
                    onChange={(e) =>
                      handleGoodsChange(index, "unit", e.target.value)
                    }
                  >
                    <option value="Nos">Nos</option>
                    <option value="Mtr">Mtr</option>
                    <option value="PKT">PKT</option>
                    <option value="Pair">Pair</option>
                    <option value="Set">Set</option>
                    <option value="Bottle">Bottle</option>
                    <option value="KG">KG</option>
                  </Form.Control>
                )}
              </td>
              <td>
                {!isEditing ? (
                  item.price.toFixed(2)
                ) : (
                  <Form.Control
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price}
                    onChange={(e) =>
                      handleGoodsChange(index, "price", e.target.value)
                    }
                  />
                )}
              </td>
              <td className="align-middle">₹{item.amount.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </Table>

      {isEditing && (
        <div className="mb-3">
          <h6>Search and Add Items</h6>
          <ItemSearchComponent
            onItemSelect={onAddItem}
            placeholder="Search items to add to quotation..."
          />
        </div>
      )}
    </div>
  );
};

const SortIndicator = ({ columnKey, sortConfig }) => {
  if (sortConfig.key !== columnKey) return <span>↕️</span>;
  return sortConfig.direction === "ascending" ? (
    <span>⬆️</span>
  ) : (
    <span>⬇️</span>
  );
};

export default function Quotations() {
  const [showModal, setShowModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [quotations, setQuotations] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuotation, setCurrentQuotation] = useState(null);
  const [formValidated, setFormValidated] = useState(false);
  const [quotationsCount, setQuotationsCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5); // Number of items per page
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "ascending",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showPdfModal, setShowPdfModal] = useState(false);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const getAuthToken = () => {
    try {
      const userData = JSON.parse(localStorage.getItem("erp-user"));
      if (!userData || typeof userData !== "object") {
        return null;
      }
      return userData.token;
    } catch (e) {
      console.error("Failed to parse user data:", e);
      return null;
    }
  };

  const generateQuotationNumber = () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, "0");
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    const milliseconds = String(now.getMilliseconds()).padStart(3, "0");

    return `Q-${day}${month}-${hours}${minutes}${seconds}${milliseconds}`;
  };

  const initialQuotationData = {
    date: formatDateForInput(new Date()),
    referenceNumber: generateQuotationNumber(),
    validityDate: formatDateForInput(
      new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    ),
    dispatchDays: 7,
    orderIssuedBy: "",
    goods: [],
    totalQuantity: 0,
    totalAmount: 0,
    gstAmount: 0,
    grandTotal: 0,
    client: {
      companyName: "",
      gstNumber: "",
      email: "",
      phone: "",
    },
  };

  const [quotationData, setQuotationData] = useState(initialQuotationData);
  const [ticketData, setTicketData] = useState({
    companyName: "",
    quotationNumber: "",
    billingAddress: ["", "", "", "", ""], // [address1, address2, state, city, pincode]
    shippingAddress: ["", "", "", "", ""], // [address1, address2, state, city, pincode]
    goods: [],
    totalQuantity: 0,
    totalAmount: 0,
    gstAmount: 0,
    grandTotal: 0,
    status: "Quotation Sent",
  });

  const fetchQuotations = useCallback(async () => {
    if (loading || !user) return;

    setIsLoading(true);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await axios.get("http://localhost:3000/api/quotations", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setQuotations(response.data);
      setQuotationsCount(response.data.length);
      setError(null);
    } catch (error) {
      console.error("Error fetching quotations:", error);
      setError(
        error.response?.data?.message ||
        error.message ||
        "Failed to load quotations. Please try again."
      );

      if (error.response?.status === 401) {
        navigate("/login", { state: { from: "/quotations" } });
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { state: { from: "/quotations" } });
    } else {
      fetchQuotations();
    }
  }, [user, loading, navigate, fetchQuotations]);

  useEffect(() => {
    setCurrentPage(1); // Reset to first page when search term changes
  }, [searchTerm]);

  const sortedQuotations = useMemo(() => {
    if (!sortConfig.key) return quotations;

    return [...quotations].sort((a, b) => {
      if (sortConfig.key === "date") {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
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
  }, [quotations, sortConfig]);

  const filteredQuotations = useMemo(() => {
    if (!searchTerm) return sortedQuotations;

    const term = searchTerm.toLowerCase();
    return sortedQuotations.filter(
      (quotation) =>
        quotation.referenceNumber?.toLowerCase().includes(term) ||
        quotation.client?.companyName?.toLowerCase().includes(term) ||
        quotation.client?.gstNumber?.toLowerCase().includes(term) ||
        quotation.goods.some(
          (item) =>
            item.description?.toLowerCase().includes(term) ||
            item.hsnSacCode?.toLowerCase().includes(term)
        )
    );
  }, [sortedQuotations, searchTerm]);

  // Get current items for pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredQuotations.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredQuotations.length / itemsPerPage);

  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  const addGoodsRow = () => {
    const newGoods = [
      ...quotationData.goods,
      {
        srNo: quotationData.goods.length + 1,
        description: "",
        hsnSacCode: "",
        quantity: 1,
        price: 0,
        amount: 0,
      },
    ];

    setQuotationData({
      ...quotationData,
      goods: newGoods,
    });
  };


  const handleAddItem = (item) => {
    const newGoods = [
      ...quotationData.goods,
      {
        srNo: quotationData.goods.length + 1,
        description: item.name,
        hsnSacCode: item.hsnCode || "",
        quantity: 1,
        unit: item.unit || "Nos",
        price: item.price,
        amount: item.price, // quantity * price (quantity is 1 initially)
      },
    ];
  
    // Calculate totals
    const totalQuantity = newGoods.reduce(
      (sum, item) => sum + Number(item.quantity),
      0
    );
    const totalAmount = newGoods.reduce(
      (sum, item) => sum + Number(item.amount),
      0
    );
    const gstAmount = totalAmount * 0.18;
    const grandTotal = totalAmount + gstAmount;
  
    setQuotationData({
      ...quotationData,
      goods: newGoods,
      totalQuantity,
      totalAmount,
      gstAmount,
      grandTotal,
    });
  };
  

  const handleGoodsChange = (index, field, value) => {
    const updatedGoods = [...quotationData.goods];

    if (["quantity", "price", "amount"].includes(field)) {
      value = Number(value);
    }

    updatedGoods[index][field] = value;

    if (field === "quantity" || field === "price") {
      updatedGoods[index].amount =
        updatedGoods[index].quantity * updatedGoods[index].price;
    }

    updatedGoods.forEach(item => {
      if (!item.unit) item.unit = 'Nos';
    });

    const totalQuantity = updatedGoods.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    const totalAmount = updatedGoods.reduce(
      (sum, item) => sum + item.amount,
      0
    );
    const gstAmount = totalAmount * 0.18;
    const grandTotal = totalAmount + gstAmount;

    setQuotationData({
      ...quotationData,
      goods: updatedGoods,
      totalQuantity,
      totalAmount,
      gstAmount,
      grandTotal,
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name.startsWith("client.")) {
      const field = name.split(".")[1];
      setQuotationData((prev) => ({
        ...prev,
        client: {
          ...prev.client,
          [field]: value,
        },
      }));
    } else {
      setQuotationData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormValidated(true);

    const form = event.currentTarget;
    if (form.checkValidity() === false || quotationData.goods.length === 0) {
      event.stopPropagation();
      return;
    }

    setIsLoading(true);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const submissionData = {
        referenceNumber: currentQuotation
          ? quotationData.referenceNumber
          : generateQuotationNumber(),
        date: new Date(quotationData.date).toISOString(),
        validityDate: new Date(quotationData.validityDate).toISOString(),
        dispatchDays: Number(quotationData.dispatchDays),
        orderIssuedBy: quotationData.orderIssuedBy,
        goods: quotationData.goods.map((item) => ({
          srNo: item.srNo,
          description: item.description,
          hsnSacCode: item.hsnSacCode,
          quantity: Number(item.quantity),
          price: Number(item.price),
          amount: Number(item.amount),
        })),
        totalQuantity: Number(quotationData.totalQuantity),
        totalAmount: Number(quotationData.totalAmount),
        gstAmount: Number(quotationData.gstAmount),
        grandTotal: Number(quotationData.grandTotal),
        client: {
          companyName: quotationData.client.companyName,
          gstNumber: quotationData.client.gstNumber,
          email: quotationData.client.email,
          phone: String(quotationData.client.phone),
        },
      };

      const url = currentQuotation
        ? `http://localhost:3000/api/quotations/${currentQuotation._id}`
        : "http://localhost:3000/api/quotations";

      const method = currentQuotation ? "put" : "post";

      const response = await axios[method](url, submissionData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 200 || response.status === 201) {
        fetchQuotations();
        setShowModal(false);
        resetForm();
        setError(null);
        setCurrentQuotation(null);
      }
    } catch (error) {
      console.error("Error saving quotation:", error);
      let errorMessage = "Failed to save quotation. Please try again.";

      if (error.response) {
        errorMessage =
          error.response.data.message ||
          error.response.data.error ||
          errorMessage;

        if (error.response.status === 401) {
          navigate("/login", { state: { from: "/quotations" } });
          return;
        }
      } else if (error.request) {
        errorMessage =
          "No response from server. Check your network connection.";
      }

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setQuotationData(initialQuotationData);
    setFormValidated(false);
  };

  const generateTicketNumber = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await axios.get(
        "http://localhost:3000/api/tickets/next-number",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data.nextTicketNumber;
    } catch (error) {
      console.error("Error generating ticket number:", error);
      const now = new Date();
      return `T-${now.getFullYear()}${String(now.getMonth() + 1).padStart(
        2,
        "0"
      )}${String(now.getDate()).padStart(2, "0")}-${String(now.getTime()).slice(
        -6
      )}`;
    }
  };

  const handleCreateTicket = async (quotation) => {
    const ticketNumber = await generateTicketNumber();

    setTicketData({
      ticketNumber,
      companyName: quotation.client?.companyName || "",
      quotationNumber: quotation.referenceNumber,
      billingAddress: ["", "", "", "", ""],
      shippingAddress: ["", "", "", "", ""],
      goods: quotation.goods.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        price: Number(item.price),
        amount: Number(item.amount),
      })),
      totalQuantity: Number(quotation.totalQuantity),
      totalAmount: Number(quotation.totalAmount),
      gstAmount: Number(quotation.gstAmount),
      grandTotal: Number(quotation.grandTotal),
      status: "Quotation Sent",
    });

    setShowTicketModal(true);
  };

  const checkExistingTicket = async (quotationNumber) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      const response = await axios.get(
        `http://localhost:3000/api/tickets/check/${quotationNumber}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data.exists;
    } catch (error) {
      console.error("Error checking existing ticket:", error);
      return false;
    }
  };

  const handleTicketSubmit = async (event) => {
    event.preventDefault();
    setFormValidated(true);
  
    try {
      setIsLoading(true);
  
      const ticketExists = await checkExistingTicket(
        ticketData.quotationNumber
      );
      if (ticketExists) {
        setError("A ticket already exists for this quotation.");
        setIsLoading(false);
        return;
      }
  
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }
  
      // Get current user info
      const userData = JSON.parse(localStorage.getItem('erp-user'));
      if (!userData) {
        throw new Error("User data not found");
      }
  
      // Prepare complete ticket data
      const completeTicketData = {
        ...ticketData,
        createdBy: userData.id,
        statusHistory: [{
          status: ticketData.status,
          changedAt: new Date(),
          changedBy: userData.id
        }],
        documents: {
          quotation: "",
          po: "",
          pi: "",
          challan: "",
          packingList: "",
          feedback: ""
        }
      };
  
      const response = await axios.post(
        "http://localhost:3000/api/tickets",
        completeTicketData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
  
      if (response.status === 201) {
        setShowTicketModal(false);
        setError(null);
        
        // Show success message
        alert(`Ticket ${response.data.ticketNumber} created successfully!`);
        
        // Optionally navigate to tickets page
        navigate('/tickets');
      }
    } catch (error) {
      console.error("Error creating ticket:", error);
      setError(
        error.response?.data?.message ||
        error.message ||
        "Failed to create ticket. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (quotation) => {
    setCurrentQuotation(quotation);
    setQuotationData({
      date: formatDateForInput(quotation.date),
      referenceNumber: quotation.referenceNumber,
      validityDate: formatDateForInput(quotation.validityDate),
      dispatchDays: quotation.dispatchDays,
      orderIssuedBy: quotation.orderIssuedBy,
      goods: quotation.goods.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        price: Number(item.price),
        amount: Number(item.amount),
      })),
      totalQuantity: Number(quotation.totalQuantity),
      totalAmount: Number(quotation.totalAmount),
      gstAmount: Number(quotation.gstAmount),
      grandTotal: Number(quotation.grandTotal),
      client: {
        companyName: quotation.client?.companyName || "",
        gstNumber: quotation.client?.gstNumber || "",
        email: quotation.client?.email || "",
        phone: quotation.client?.phone || "",
      },
    });
    setShowModal(true);
  };

  const openCreateModal = async () => {
    setCurrentQuotation(null);
    setQuotationData({
      ...initialQuotationData,
      referenceNumber: generateQuotationNumber(),
    });
    setShowModal(true);
  };

  return (
    <div>
      <Navbar />
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 style={{ color: "black" }}>Quotations</h2>
          <div
            className="d-flex align-items-center gap-3"
            style={{ width: "50%" }}
          >
            <Form.Control
              type="search"
              placeholder="Search here"
              className="me-2"
              aria-label="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                borderRadius: "20px",
                padding: "8px 20px",
                border: "1px solid #ced4da",
                boxShadow: "none",
              }}
            />
            <Button variant="primary" onClick={openCreateModal}>
              Create New Quotation
            </Button>
          </div>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <Table striped bordered hover responsive className="mt-3">
          <thead className="table-dark">
            <tr>
              <th
                onClick={() => requestSort("referenceNumber")}
                style={{ cursor: "pointer" }}
              >
                Reference No{" "}
                <SortIndicator
                  columnKey="referenceNumber"
                  sortConfig={sortConfig}
                />
              </th>
              <th
                onClick={() => requestSort("client.companyName")}
                style={{ cursor: "pointer" }}
              >
                Company Name{" "}
                <SortIndicator
                  columnKey="client.companyName"
                  sortConfig={sortConfig}
                />
              </th>
              <th
                onClick={() => requestSort("client.gstNumber")}
                style={{ cursor: "pointer" }}
              >
                GST Number{" "}
                <SortIndicator
                  columnKey="client.gstNumber"
                  sortConfig={sortConfig}
                />
              </th>
              <th
                onClick={() => requestSort("grandTotal")}
                style={{ cursor: "pointer" }}
              >
                Grand Total (₹){" "}
                <SortIndicator columnKey="grandTotal" sortConfig={sortConfig} />
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="7" className="text-center">
                  Loading quotations...
                </td>
              </tr>
            ) : currentItems.length > 0 ? (
              currentItems.map((quotation) => (
                <tr key={quotation._id}>
                  <td>{quotation.referenceNumber}</td>
                  <td>{quotation.client?.companyName}</td>
                  <td>{quotation.client?.gstNumber}</td>
                  <td className="text-end">
                    {quotation.grandTotal.toFixed(2)}
                  </td>
                  <td>
                    <div className="d-flex gap-2">
                      <Button
                        variant="info"
                        size="sm"
                        onClick={() => handleEdit(quotation)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="success"
                        size="sm"
                        onClick={() => handleCreateTicket(quotation)}
                      >
                        Create Ticket
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setCurrentQuotation(quotation);
                          //debugging
                          console.log("Quotation goods with units:", quotation.goods);
                          setShowPdfModal(true);
                        }}
                      >
                        View PDF
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="text-center">
                  No quotations found.
                </td>
              </tr>
            )}
          </tbody>
        </Table>

        {filteredQuotations.length > itemsPerPage && (
          <div className="d-flex justify-content-center mt-3">
            <nav>
              <ul className="pagination">
                <li
                  className={`page-item ${currentPage === 1 ? "disabled" : ""}`}
                >
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

        {/* Quotation Modal */}
        <Modal
          show={showModal}
          onHide={() => {
            setShowModal(false);
            setCurrentQuotation(null);
            resetForm();
          }}
          dialogClassName="custom-modal"
          centered
        >
          <Modal.Header closeButton style={{ borderBottom: '1px solid #dee2e6' }}>
            <Modal.Title>
              {currentQuotation ? "Edit Quotation" : "Create New Quotation"}
            </Modal.Title>
          </Modal.Header>
          <div style={fullScreenModalStyle}>
            <Form noValidate validated={formValidated} onSubmit={handleSubmit}>
              <Modal.Body>
                <div className="row">
                  <Form.Group className="mb-3 col-md-4">
                    <Form.Label>Date <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      required
                      type="date"
                      name="date"
                      value={quotationData.date}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3 col-md-4">
                    <Form.Label>Reference Number</Form.Label>
                    <Form.Control
                      type="text"
                      name="referenceNumber"
                      value={quotationData.referenceNumber}
                      readOnly
                    />
                  </Form.Group>
                  <Form.Group className="mb-3 col-md-4">
                    <Form.Label>Validity Date <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      required
                      type="date"
                      name="validityDate"
                      value={quotationData.validityDate}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                </div>

                <div className="row">
                  <Form.Group className="mb-3 col-md-4">
                    <Form.Label>Dispatch Days <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      required
                      type="number"
                      min="1"
                      name="dispatchDays"
                      value={quotationData.dispatchDays}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3 col-md-4">
                    <Form.Label>Order Issued By <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      required
                      type="text"
                      name="orderIssuedBy"
                      value={quotationData.orderIssuedBy}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                </div>

                <h5>Client Details</h5>
                <div className="row">
                  <Form.Group className="mb-3 col-md-6">
                    <Form.Label>Company Name <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      required
                      type="text"
                      name="client.companyName"
                      value={quotationData.client.companyName}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3 col-md-6">
                    <Form.Label>GST Number <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      required
                      type="text"
                      name="client.gstNumber"
                      value={quotationData.client.gstNumber}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                </div>
                <div className="row">
                  <Form.Group className="mb-3 col-md-6">
                    <Form.Label>Email <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      type="email"
                      name="client.email"
                      value={quotationData.client.email}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3 col-md-6">
                    <Form.Label>Phone <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      type="tel"
                      name="client.phone"
                      value={quotationData.client.phone}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                </div>

                <h5>Goods Details</h5>
                <GoodsTable
                  goods={quotationData.goods}
                  handleGoodsChange={handleGoodsChange}
                  currentQuotation={currentQuotation}
                  isEditing={true}
                  onAddItem={handleAddItem} // Pass the handler here
                />

                <div className="bg-light p-3 rounded">
                  <div className="row">
                    <div className="col-md-4">
                      <p>
                        Total Quantity:{" "}
                        <strong>{quotationData.totalQuantity}</strong>
                      </p>
                    </div>
                    <div className="col-md-4">
                      <p>
                        Total Amount:{" "}
                        <strong>₹{quotationData.totalAmount.toFixed(2)}</strong>
                      </p>
                    </div>
                    <div className="col-md-4">
                      <p>
                        GST (18%):{" "}
                        <strong>₹{quotationData.gstAmount.toFixed(2)}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="row">
                    <div className="col-md-12">
                      <h5>Grand Total: ₹{quotationData.grandTotal.toFixed(2)}</h5>
                    </div>
                  </div>
                </div>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowModal(false);
                    setCurrentQuotation(null);
                    resetForm();
                  }}
                >
                  Close
                </Button>
                <Button variant="primary" type="submit">
                  {currentQuotation ? "Update Quotation" : "Save Quotation"}
                </Button>
              </Modal.Footer>
            </Form>
          </div>  
        </Modal>

        {/* Create Ticket Modal */}
        <CreateTicketModal
          show={showTicketModal}
          onHide={() => setShowTicketModal(false)}
          ticketData={ticketData}
          setTicketData={setTicketData}
          handleTicketSubmit={handleTicketSubmit}
          isLoading={isLoading}
          error={error}
        />

        {/* PDF View Modal */}
        <Modal
          show={showPdfModal}
          onHide={() => setShowPdfModal(false)}
          dialogClassName="modal-fullscreen"
        >
          <Modal.Header closeButton>
            <Modal.Title>
              Quotation PDF - {currentQuotation?.referenceNumber}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="pdf-viewer-container" style={{ height: "600px" }}>
            {currentQuotation && (
              <>
                <div style={{ height: "500px", width: "100%" }}>
                  <PDFViewer width="100%" height="100%" className="mb-3">
                    <QuotationPDF quotation={currentQuotation} />
                  </PDFViewer>
                </div>
                <div className="d-flex justify-content-center gap-2 mt-3">
                  <PDFDownloadLink
                    document={<QuotationPDF quotation={currentQuotation} />}
                    fileName={`quotation_${currentQuotation.referenceNumber}.pdf`}
                  >
                    {({ loading }) => (
                      <Button variant="primary" disabled={loading}>
                        {loading ? "Generating PDF..." : "Download PDF"}
                      </Button>
                    )}
                  </PDFDownloadLink>
                </div>
              </>
            )}
          </Modal.Body>
        </Modal>
      </div>
    </div>
  );
}
