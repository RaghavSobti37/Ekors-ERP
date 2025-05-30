import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { Modal, Button, Form, Table, Alert } from "react-bootstrap";
import {
  Eye, // View
  PencilSquare, // Edit
  Trash, // Delete
  PlusSquare, // Create Ticket
} from 'react-bootstrap-icons';
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import ClientSearchComponent from "../components/ClientSearchComponent.jsx";
import ItemSearchComponent from "../components/ItemSearch";
import QuotationPDF from "../components/QuotationPDF";
import CreateTicketModal from "../components/CreateTicketModal";
import "../css/Quotation.css";
import "../css/Style.css";
import Pagination from "../components/Pagination";
import "../css/Items.css";
import ReusableTable from "../components/ReusableTable.jsx";
import SortIndicator from "../components/SortIndicator.jsx";

import ActionButtons from "../components/ActionButtons";
import { ToastContainer, toast } from 'react-toastify';
import frontendLogger from '../utils/frontendLogger.js';
import 'react-toastify/dist/ReactToastify.css';
import {
  PDFViewer,
  PDFDownloadLink,
} from "@react-pdf/renderer";

import { showToast, handleApiError } from '../utils/helpers';

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
  overflow: 'auto',
  backgroundColor: 'white',
  border: '1px solid #dee2e6',
  borderRadius: '0.3rem',
  boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
  zIndex: 1050
};

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
  onDeleteItem,
}) => {
  return (
    <div className="table-responsive">
      <Table bordered className="mb-3">
        <thead>
          <tr>
            <th>Sr No.</th>
            <th>
              Description <span className="text-danger">*</span>
            </th>
            <th>HSN/SAC</th>
            <th>
              Qty <span className="text-danger">*</span>
            </th>
            <th>
              Unit <span className="text-danger">*</span>
            </th>
            <th>
              Price <span className="text-danger">*</span>
            </th>
            <th>Amount</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {goods.map((item, index) => (
            <tr key={index}>
              <td>{item.srNo}</td>
              <td>
                <Form.Control
                  plaintext
                  readOnly
                  value={item.description || ""}
                />
              </td>
              <td>
                <Form.Control
                  plaintext
                  readOnly
                  value={item.hsnSacCode || ""}
                />
              </td>
              <td>
                {!isEditing ? (
                  item.quantity || 0
                ) : (
                  <Form.Control
                    required
                    type="number"
                    min="1"
                    value={item.quantity || 1}
                    onChange={(e) =>
                      handleGoodsChange(index, "quantity", e.target.value)
                    }
                  />
                )}
              </td>
              <td>
                {!isEditing ? (
                  item.unit || "Nos"
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
                  (item.price || 0).toFixed(2)
                ) : (
                  <Form.Control
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.price || 0}
                    onChange={(e) =>
                      handleGoodsChange(index, "price", e.target.value)
                    }
                    readOnly={isEditing && !(Number(item.maxDiscountPercentage || 0) > 0)}
                  />
                )}
              </td>
              <td className="align-middle">₹{(item.amount || 0).toFixed(2)}</td>
              <td className="align-middle">
                {isEditing && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => onDeleteItem(index)}
                  >
                    Delete
                  </Button>
                )}
              </td>
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
  const [itemsPerPage] = useState(4);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: "date", // Default sort key to 'date'
    direction: "descending", // Default sort direction to 'descending' (newest first)
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedClientIdForForm, setSelectedClientIdForForm] = useState(null);
  const { user, loading } = useAuth();
  const auth = useAuth(); // Get the full auth context to access the user object
  const [statusFilter, setStatusFilter] = useState("all");
  const navigate = useNavigate();

  const getAuthToken = () => {
    try {
      const token = localStorage.getItem("erp-user");
      // console.log("[DEBUG Client Quotations.jsx] getAuthToken retrieved:", token ? "Token present" : "No token"); // Debug log commented out
      return token || null;
    } catch (e) {
      toast.error("Error accessing local storage for authentication token.");
      const errorDetails = {
        errorMessage: e.message,
        stack: e.stack,
        context: "getAuthToken - localStorage access"
      };
      if (auth.user) {
        frontendLogger.error("localStorageAccess", "Failed to get auth token from localStorage", auth.user, errorDetails);
      } else {
        frontendLogger.error("localStorageAccess", "Failed to get auth token from localStorage (user not authenticated)", null, errorDetails);
      }
      return null;
    }
  };

  const generateQuotationNumber = () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    // New format: Q-YYYYMMDD-HHMMSS
    return `Q-${year}${month}${day}-${hours}${minutes}${seconds}`;
  };

  const handleSaveClientDetails = async () => {
    const {
      companyName: rawCompanyName,
      gstNumber: rawGstNumber,
      email: rawEmail,
      phone: rawPhone
    } = quotationData.client;

    // Trim values for validation and use
    const companyName = rawCompanyName?.trim();
    const gstNumber = rawGstNumber?.trim();
    const email = rawEmail?.trim();
    const phone = rawPhone?.trim();

    if (!companyName || !gstNumber || !email || !phone) {
      const msg = "All client fields (Company Name, GST, Email, Phone) are required and cannot be just whitespace.";
      setError(msg);
      toast.warn(msg);
      return;
    }

    // Additional Frontend Validations
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const msg = "Invalid email format.";
      setError(msg);
      toast.warn(msg);
      return;
    }

    // // Basic GST Number validation (must be 15 characters)
    // if (gstNumber.length !== 15) {
    //   const msg = "GST Number must be 15 characters long.";
    //   setError(msg);
    //   toast.warn(msg);
    //   return;
    // }

    // Basic Phone Number validation (must be 10 digits)
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      const msg = "Phone number must be 10 digits.";
      setError(msg);
      toast.warn(msg);
      return;
    }

    setIsSavingClient(true);
    setError(null); // Clear previous form error
    const clientPayload = {
      companyName: companyName, // Use trimmed value
      gstNumber: gstNumber.toUpperCase(), // Use trimmed and then uppercased value
      email: email.toLowerCase(), // Use trimmed and then lowercased value
      phone: phone, // Use trimmed value
    };
    try {
      const token = getAuthToken();
      if (!token) throw new Error("No authentication token found");


      const response = await axios.post(
        "http://localhost:3000/api/clients",
        clientPayload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      if (response.data && response.data._id) {
        setQuotationData((prev) => ({
          ...prev,
          client: { ...response.data }, // Populate with full client data from backend
        }));
        setSelectedClientIdForForm(response.data._id);
        setError(null);
        toast.success("Client saved successfully!");
        if (auth.user) {
          frontendLogger.info("clientActivity", "New client saved successfully", auth.user, {
            clientId: response.data._id,
            clientName: response.data.companyName,
            action: "SAVE_NEW_CLIENT_SUCCESS"
          });
        }
      } else {
        setError("Failed to save client: Unexpected response from server.");
        toast.error("Failed to save client: Unexpected response from server.");
      }
    } catch (error) {
      let errorMessage = "Failed to save client details.";
      if (error.response?.data?.field === 'gstNumber') {
        errorMessage = error.response.data.message || "This GST Number is already registered.";
      } else if (error.response?.data?.field === 'email') {
        errorMessage = error.response.data.message || "This Email is already registered.";
      } else {
        errorMessage = error.response?.data?.message || errorMessage;
      }
      setError(errorMessage); // Keep for form-specific feedback
      toast.error(errorMessage); // Show toast notification

      // Log the error
      if (auth.user) {
        // const userForLog = { firstname: auth.user.firstname, lastname: auth.user.lastname, email: auth.user.email, id: auth.user.id };
        frontendLogger.error("clientActivity", "Failed to save new client", auth.user, {
          clientPayload: clientPayload, // Log the payload attempted to save
          errorMessage: error.response?.data?.message || error.message,
          stack: error.stack,
          responseData: error.response?.data,
          action: "SAVE_NEW_CLIENT_FAILURE"
        });
      }
    } finally {
      setIsSavingClient(false);
    }
  };

  const initialQuotationData = {
    date: formatDateForInput(new Date()),
    referenceNumber: generateQuotationNumber(),
    validityDate: formatDateForInput(
      new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    ),
    orderIssuedBy: "",
    goods: [],
    totalQuantity: 0,
    totalAmount: 0,
    gstAmount: 0,
    grandTotal: 0,
    status: "open",
    client: {
      _id: null, // Add _id field for client
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
    billingAddress: ["", "", "", "", ""],
    shippingAddress: ["", "", "", "", ""],
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
    // setError(null); // Clear previous errors at the start of a fetch
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      // Construct URL with query parameters
      const url = `http://localhost:3000/api/quotations${params.toString() ? `?${params.toString()}` : ""
        }`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setQuotations(response.data);
      setQuotationsCount(response.data.length);
      setError(null); // Clear error on successful fetch
    } catch (error) {
      // console.error("Error fetching quotations:", error); // Debug log commented out
      const errorMessage = error.response?.data?.message || error.message || "Failed to load quotations. Please try again.";
      setError(errorMessage); // Keep for main error display
      showToast(errorMessage, false); // Show toast notification

      // Log the error
      if (auth.user) {
        frontendLogger.error("quotationActivity", "Failed to fetch quotations", auth.user, {
          errorMessage: error.response?.data?.message || error.message,
          stack: error.stack,
          responseData: error.response?.data,
          statusFilter,
          action: "FETCH_QUOTATIONS_FAILURE"
        });
      }

      if (error.response?.status === 401) {
        toast.error("Authentication failed. Please log in again.");
        navigate("/login", { state: { from: "/quotations" } });
      }
    } finally {
      // Ensure error state is cleared if fetch was successful but a previous error existed
      // This logic is now handled within the try/catch blocks more directly.
      // if (!error && !isLoading) { // Check isLoading to avoid clearing during ongoing fetch
      //    setError(null);
      // }
      setIsLoading(false);
    }
  }, [user, loading, navigate, statusFilter, auth]); // Added auth to dependency array for logger

  useEffect(() => {
    if (!loading && !user) {
      // Only navigate if not already on login page to prevent infinite loop
      if (window.location.pathname !== '/login') navigate("/login", { state: { from: "/quotations" } });
    } else {
      fetchQuotations();
    }
  }, [user, loading, navigate, fetchQuotations]);

  useEffect(() => {
    setCurrentPage(1);
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
    let filtered = sortedQuotations;

    // Apply status filter first
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (quotation) => quotation.status === statusFilter
      );
    }

    // Apply search term filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
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
    }

    return filtered;
  }, [sortedQuotations, searchTerm, statusFilter]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredQuotations.slice(
    indexOfFirstItem,
    indexOfLastItem
  );
  const totalPages = Math.ceil(filteredQuotations.length / itemsPerPage);

  const requestSort = (key) => {
    let direction = "descending";
    if (sortConfig.key === key && sortConfig.direction === "descending") {
      direction = "ascending";
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
    // Check if item already exists in the goods list
    const itemExists = quotationData.goods.some(
      (existingItem) => existingItem.description === item.name
    );

    if (itemExists) {
      setError("This item is already added to the quotation.");
      toast.warn("This item is already added to the quotation.");
      return;
    }

    const newGoods = [
      ...quotationData.goods,
      {
        srNo: quotationData.goods.length + 1,
        description: item.name,
        hsnSacCode: item.hsnCode || "",
        quantity: 1,
        unit: item.unit || "Nos", // Ensure unit is included
        price: item.price,
        amount: item.price,
        originalPrice: item.price, // Store original price for discount calculation        // discountAvailable: item.discountAvailable, // Removed
        maxDiscountPercentage: item.maxDiscountPercentage,
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
    setError(null); // Clear error on successful add
  };

  const handleGoodsChange = (index, field, value) => {
    const updatedGoods = [...quotationData.goods];

    let priceValidationError = null;

    if (["quantity", "price", "amount"].includes(field)) {
      value = Number(value);
    }

    updatedGoods[index][field] = value;

    if (field === "quantity" || field === "price") {
      updatedGoods[index].amount =
        updatedGoods[index].quantity * updatedGoods[index].price;
    }

    // Price validation against max discount
    // Real-time price validation
    if (field === "price") {
      const currentItem = updatedGoods[index];
      const newPrice = parseFloat(value); // Value is already Number if field is 'price'
      const originalPrice = parseFloat(currentItem.originalPrice);
      const maxDiscountPerc = parseFloat(currentItem.maxDiscountPercentage);

      if (!isNaN(newPrice) && !isNaN(originalPrice)) {
        if (!isNaN(maxDiscountPerc) && maxDiscountPerc > 0) {
          const minAllowedPrice = originalPrice * (1 - maxDiscountPerc / 100);
          if (newPrice < minAllowedPrice) {
            priceValidationError = `Discount for ${currentItem.description} exceeds the maximum allowed ${maxDiscountPerc}%. Minimum price is ₹${minAllowedPrice.toFixed(2)}.`;
          }
        } else { // No discount slab (maxDiscountPerc is 0, undefined, or NaN)
          if (newPrice < originalPrice) {
            priceValidationError = `Price for ${currentItem.description} (₹${newPrice.toFixed(2)}) cannot be lower than the original price (₹${originalPrice.toFixed(2)}) as no discount is applicable.`;
          }
        }
      } else {
        // Handle cases where price input might not be a valid number yet, or originalPrice is missing.
        // This can happen if `value` (which is `e.target.value` initially) is an empty string or non-numeric.
        // `parseFloat('')` is NaN. `Number('')` is 0.
        // If `value` (as string from input) is non-empty but not a number, `newPrice` will be NaN.
        if (String(value).trim() !== "" && isNaN(newPrice)) {
          priceValidationError = `Invalid price entered for ${currentItem.description}.`;
        }
      }
    }

    updatedGoods.forEach((item) => {
      if (!item.unit) item.unit = "Nos";
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

    if (priceValidationError) {
      setError(priceValidationError);
      toast.warn(priceValidationError);
    } else {
      // Clear error only if it was related to the price of the item being edited
      if (error && (error.includes(`Discount for ${updatedGoods[index].description}`) || error.includes(`Price for ${updatedGoods[index].description}`))) {
        setError(null);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name.startsWith("client.")) {
      const clientField = name.split(".")[1];
      let processedValue = value;

      if (clientField === "gstNumber") {
        processedValue = value.toUpperCase();
      } else if (clientField === "email") {
        processedValue = value.toLowerCase();
      }

      setQuotationData((prev) => ({
        ...prev,
        client: {
          ...prev.client,
          [clientField]: processedValue,
        },
      }));
    } else {
      setQuotationData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleDeleteItem = (indexToDelete) => {
    const updatedGoods = quotationData.goods.filter(
      (_, index) => index !== indexToDelete
    );

    // Re-number SrNo after deletion
    const renumberedGoods = updatedGoods.map((item, index) => ({
      ...item,
      srNo: index + 1,
    }));

    // Recalculate totals
    const totalQuantity = renumberedGoods.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );
    const totalAmount = renumberedGoods.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const gstAmount = totalAmount * 0.18; // Assuming 18% GST
    const grandTotal = totalAmount + gstAmount;

    setQuotationData((prevData) => ({
      ...prevData,
      goods: renumberedGoods,
      totalQuantity,
      totalAmount,
      gstAmount,
      grandTotal,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormValidated(true);
    let submissionData = {};

    const form = event.currentTarget;
    if (form.checkValidity() === false) {
      event.stopPropagation();
      setError("Please fill in all required fields in the quotation.");
      toast.error("Please fill in all required fields in the quotation.");
      return;
    }

    if (!quotationData.client._id) {
      if (quotationData.client.companyName || quotationData.client.gstNumber || quotationData.client.email || quotationData.client.phone) {
        setError("You have entered new client details. Please click 'Save New Client' before saving the quotation.");
        toast.warn("You have entered new client details. Please click 'Save New Client' before saving the quotation.");
      } else {
        setError("Please select an existing client or enter and save details for a new client.");
        toast.warn("Please select an existing client or enter and save details for a new client.");
      }
      return;
    }

    if (!quotationData.goods || quotationData.goods.length === 0) {
      setError("Please add at least one item to the quotation.");
      toast.error("Please add at least one item to the quotation.");
      return;
    }

    // Validate goods items
    for (let i = 0; i < quotationData.goods.length; i++) {
      const item = quotationData.goods[i];
      if (!item.description || !(parseFloat(item.quantity) > 0) || !(parseFloat(item.price) >= 0) || !item.unit) {
        const itemErrorMsg = `Item ${i + 1} is incomplete. Please fill all required fields.`;
        setError(itemErrorMsg);
        toast.error(itemErrorMsg);
        return;
      }
      // Validate price against discount slab
      if (item.maxDiscountPercentage > 0) { // Check only maxDiscountPercentage
        const minAllowedPrice = item.originalPrice * (1 - (item.maxDiscountPercentage || 0) / 100); // Use 0 if null/undefined
        if (parseFloat(item.price) < minAllowedPrice) {
          const priceErrorMsg = `Price for ${item.description} (₹${parseFloat(item.price).toFixed(2)}) is below the minimum allowed price (₹${minAllowedPrice.toFixed(2)}) due to ${item.maxDiscountPercentage}% max discount.`;
          setError(priceErrorMsg);
          toast.error(priceErrorMsg);
          return;
        }
      }
    }

    // Clear discount related error if all validations pass before submission attempt
    if (error && error.includes("exceeds the maximum allowed")) {
      setError(null);
    } // Keep other form validation errors

    setIsLoading(true);
    setError(null); // Clear previous submission errors

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      submissionData = {
        // Client object will be sent as is from quotationData.client
        referenceNumber: quotationData.referenceNumber,
        date: new Date(quotationData.date).toISOString(),
        validityDate: new Date(quotationData.validityDate).toISOString(),
        orderIssuedBy: quotationData.orderIssuedBy,
        goods: quotationData.goods.map((item) => ({
          srNo: item.srNo,
          description: item.description,
          hsnSacCode: item.hsnSacCode || "",
          quantity: Number(item.quantity),
          unit: item.unit || "Nos", // Ensure unit is included
          price: Number(item.price),
          amount: Number(item.amount),
          originalPrice: Number(item.originalPrice),          // discountAvailable: item.discountAvailable, // Removed
          maxDiscountPercentage: item.maxDiscountPercentage ? Number(item.maxDiscountPercentage) : 0,
        })),
        totalQuantity: Number(quotationData.totalQuantity),
        totalAmount: Number(quotationData.totalAmount),
        gstAmount: Number(quotationData.gstAmount),
        grandTotal: Number(quotationData.grandTotal),
        status: quotationData.status || "open",
        client: quotationData.client, // Send the whole client object
      };

      // console.log("Submitting quotation data:", submissionData); // Debug log commented out

      const url = currentQuotation
        ? `http://localhost:3000/api/quotations/${currentQuotation._id}`
        : "http://localhost:3000/api/quotations";

      const method = currentQuotation ? "put" : "post";

      const response = await axios[method](url, submissionData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json", // Added Content-Type header
        },
      });

      if (response.status === 200 || response.status === 201) {
        fetchQuotations();
        setShowModal(false);
        resetForm();
        // setError(null); // Let fetchQuotations handle clearing error if successful
        setCurrentQuotation(null);
        toast.success(`Quotation ${submissionData.referenceNumber} ${currentQuotation ? 'updated' : 'created'} successfully!`);

        // Log successful save/update
        if (auth.user) {
          const userForLog = { firstname: auth.user.firstname, lastname: auth.user.lastname, email: auth.user.email, id: auth.user.id };
          frontendLogger.info("quotationActivity", `Quotation ${submissionData.referenceNumber} ${currentQuotation ? 'updated' : 'created'}`, userForLog, {
            quotationId: response.data._id,
            referenceNumber: submissionData.referenceNumber,
            action: currentQuotation ? "UPDATE_QUOTATION_SUCCESS" : "CREATE_QUOTATION_SUCCESS"
          });
        }
      }
    } catch (error) {
      // console.error("Error saving quotation:", error); // Debug log commented out
      let errorMessage = "Failed to save quotation. Please try again.";

      if (error.response) {
        errorMessage =
          error.response.data.message ||
          error.response.data.error ||
          errorMessage;

        if (error.response.status === 401) {
          navigate("/login", { state: { from: "/quotations" } });
          toast.error("Authentication failed. Please log in again.");
          return;
        }
      } else if (error.request) {
        errorMessage =
          "No response from server. Check your network connection.";
      }

      setError(errorMessage); // Keep for form-specific feedback
      toast.error(errorMessage); // Show toast notification

      // Log the error
      if (auth.user) {
        frontendLogger.error("quotationActivity", currentQuotation ? "Failed to update quotation" : "Failed to create quotation", auth.user, {
          referenceNumber: quotationData.referenceNumber,
          quotationId: currentQuotation?._id,
          errorMessage: error.response?.data?.message || error.message,
          stack: error.stack,
          responseData: error.response?.data,
          submittedData: submissionData, // Be careful logging full data if it's sensitive
          action: currentQuotation ? "UPDATE_QUOTATION_FAILURE" : "CREATE_QUOTATION_FAILURE"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setQuotationData(initialQuotationData);
    setFormValidated(false);
    setSelectedClientIdForForm(null);
    setError(null);
  };

  const generateTicketNumber = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }
      const now = new Date();
      const year = now.getFullYear().toString().slice(-2);
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const seconds = String(now.getSeconds()).padStart(2, "0");
      return `T-${year}${month}${day}-${hours}${minutes}${seconds}`;

    } catch (error) {
      // console.error("Error generating ticket number:", error); // Debug log commented out
      toast.error("Failed to generate ticket number. Using a temporary number.");
      // Log the error
      if (auth.user) {
        frontendLogger.error("ticketActivity", "Failed to generate ticket number from API", auth.user, {
          errorMessage: error.response?.data?.message || error.message,
          stack: error.stack,
          responseData: error.response?.data,
          action: "GENERATE_TICKET_NUMBER_FAILURE"
        });
      }
      // const now = new Date();
      // const year = now.getFullYear().toString().slice(-2);
      // const month = String(now.getMonth() + 1).padStart(2, "0");
      // const day = String(now.getDate()).padStart(2, "0");
      // const hours = String(now.getHours()).padStart(2, "0");
      // const minutes = String(now.getMinutes()).padStart(2, "0");
      // const seconds = String(now.getSeconds()).padStart(2, "0");
      // return `T-${year}${month}${day}-${hours}${minutes}${seconds}`;
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
      // console.error("Error checking existing ticket:", error); // Debug log commented out
      toast.error("Failed to check for existing ticket.");
      if (auth.user) {
        frontendLogger.error("ticketActivity", "Failed to check for existing ticket", auth.user, {
          quotationNumber,
          errorMessage: error.response?.data?.message || error.message,
          stack: error.stack,
          responseData: error.response?.data,
          action: "CHECK_EXISTING_TICKET_FAILURE"
        });
      }
      return false;
    }
  };

  const handleTicketSubmit = async (event) => {
    event.preventDefault();
    setFormValidated(true); // For ticket modal form validation, if any
    let completeTicketData = {}; // Declare completeTicketData here

    try {
      setIsLoading(true);
      setError(null); // Clear previous ticket errors

      const ticketExists = await checkExistingTicket(
        ticketData.quotationNumber
      );
      if (ticketExists) {
        setError("A ticket already exists for this quotation.");
        toast.warn("A ticket already exists for this quotation.");
        setIsLoading(false);
        return;
      }

      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      // Get user ID from AuthContext
      if (!auth.user || !auth.user.id) {
        const noUserIdError = "User ID not found in authentication context. Please re-login.";
        setError(noUserIdError);
        toast.error(noUserIdError);
        throw new Error(noUserIdError);
      }

      completeTicketData = { // Assign to the already declared variable
        ...ticketData,
        createdBy: auth.user.id, // Use user ID from AuthContext
        currentAssignee: auth.user.id, // Set currentAssignee to the creator by default
        statusHistory: [
          {
            status: ticketData.status,
            changedAt: new Date(),
            changedBy: auth.user.id, // Use auth.user.id here as well
          },
        ],
        documents: { // Initialize document fields to null or empty array for 'other'
          quotation: null,
          po: null,
          pi: null,
          challan: null,
          packingList: null,
          feedback: null,
          other: [], // 'other' is an array of documentSubSchema
        },
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
        toast.success(`Ticket ${response.data.ticketNumber} created successfully!`);
        // Log ticket creation
        if (auth.user) {
          // const userForLog = { firstname: auth.user.firstname, lastname: auth.user.lastname, email: auth.user.email, id: auth.user.id };
          frontendLogger.info(
            "ticketActivity",
            `Ticket ${response.data.ticketNumber} created successfully from quotation ${ticketData.quotationNumber}`,
            auth.user, // Use auth.user directly
            {
              action: "TICKET_CREATED_FROM_QUOTATION_SUCCESS",
              ticketNumber: response.data.ticketNumber,
              quotationNumber: ticketData.quotationNumber,
            }
          );
        }
        navigate("/tickets");
      }
    } catch (error) {
      // console.error("Error creating ticket:", error); // Debug log commented out
      let errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to create ticket. Please try again.";
      setError(errorMessage); // Keep for modal feedback
      toast.error(errorMessage); // Show toast notification

      // Log the error
      if (auth.user) {
        frontendLogger.error("ticketActivity", "Failed to create ticket from quotation", auth.user, {
          quotationNumber: ticketData.quotationNumber,
          errorMessage: error.response?.data?.message || error.message,
          stack: error.stack,
          responseData: error.response?.data,
          ticketDataSubmitted: completeTicketData, // Be careful with sensitive data
          action: "CREATE_TICKET_FROM_QUOTATION_FAILURE"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (quotation) => {
    setCurrentQuotation(quotation);

    let orderIssuedByIdToSet = null;
    if (quotation.orderIssuedBy) {
      // Handles both populated object { _id: '...' } and plain ID string
      orderIssuedByIdToSet = quotation.orderIssuedBy._id || quotation.orderIssuedBy;
    } else if (quotation.user) {
      // Fallback to the user who created the quotation if orderIssuedBy is missing
      orderIssuedByIdToSet = quotation.user._id || quotation.user;
    } else if (user && user.id) {
      // Further fallback to the current logged-in user if other sources are unavailable
      orderIssuedByIdToSet = user.id;
    }

    // Ensure we only have the ID string if it was an object
    if (typeof orderIssuedByIdToSet === 'object' && orderIssuedByIdToSet !== null) {
      orderIssuedByIdToSet = orderIssuedByIdToSet._id;
    }

    setQuotationData({
      date: formatDateForInput(quotation.date),
      referenceNumber: quotation.referenceNumber,
      validityDate: formatDateForInput(quotation.validityDate),
      orderIssuedBy: orderIssuedByIdToSet,
      goods: quotation.goods.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        price: Number(item.price),
        amount: Number(item.amount),
        unit: item.unit || "Nos", // Ensure unit field exists
        originalPrice: Number(item.originalPrice || item.price), // Fallback for older data        // discountAvailable: item.discountAvailable, // Removed
        maxDiscountPercentage: item.maxDiscountPercentage ? Number(item.maxDiscountPercentage) : 0,
      })),
      totalQuantity: Number(quotation.totalQuantity),
      totalAmount: Number(quotation.totalAmount),
      gstAmount: Number(quotation.gstAmount),
      grandTotal: Number(quotation.grandTotal),
      status: quotation.status || "open",
      client: {
        companyName: quotation.client?.companyName || "",
        gstNumber: quotation.client?.gstNumber || "",
        email: quotation.client?.email || "",
        phone: quotation.client?.phone || "",
        _id: quotation.client?._id || null,
      },
    });
    setSelectedClientIdForForm(quotation.client?._id || null);
    setShowModal(true);
  };
  const openCreateModal = async () => {
    if (!user) {
      setError("User data is not available. Please log in again."); // Keep for potential inline display
      toast.error("User data is not available. Please log in again.");
      // Optionally, navigate to login
      // navigate("/login", { state: { from: "/quotations" } });
      return;
    }
    setCurrentQuotation(null);
    setQuotationData({
      ...initialQuotationData,
      date: formatDateForInput(new Date()), // Ensure date is current
      referenceNumber: generateQuotationNumber(),
      orderIssuedBy: user.id,
      client: { ...initialQuotationData.client, _id: null }, // Ensure client _id is null for new
    });
    setSelectedClientIdForForm(null);
    setFormValidated(false); // Reset validation state for new form
    setShowModal(true);
  };

  const handleDeleteQuotation = async (quotation) => {
    if (!quotation || !quotation._id) {
      setError("Invalid quotation selected for deletion.");
      toast.error("Invalid quotation selected for deletion.");
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete quotation ${quotation.referenceNumber}? This action cannot be undone.`
    );

    if (!confirmDelete) return;

    setIsLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      if (!token) throw new Error("No authentication token found");

      await axios.delete(
        `http://localhost:3000/api/quotations/${quotation._id}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // ✅ Success actions
      setError(null);
      setCurrentQuotation(null);
      setShowModal(false);
      resetForm(); // Reset form if used in UI
      fetchQuotations(); // Refresh data
      toast.success(`Quotation ${quotation.referenceNumber} deleted successfully.`);
      if (auth.user) {
        frontendLogger.info("quotationActivity", `Quotation ${quotation.referenceNumber} deleted`, auth.user, {
          quotationId: quotation._id,
          referenceNumber: quotation.referenceNumber,
          action: "DELETE_QUOTATION_SUCCESS"
        });
      }
    } catch (error) {
      // console.error("Error deleting quotation:", error); // Debug log commented out
      let errorMessage = error.response?.data?.message || "Failed to delete quotation. Please try again.";

      if (error.response) {
        if (error.response.status === 401) {
          navigate("/login", { state: { from: "/quotations" } });
          toast.error("Authentication failed. Please log in again.");
          setIsLoading(false);
          return;
        }
        // errorMessage = error.response.data.message || errorMessage; // This line is redundant due to the initial assignment
      } else if (error.request) {
        errorMessage =
          "No response from server. Check your network connection.";
      }

      setError(errorMessage); // Keep for main error display
      toast.error(errorMessage); // Show toast notification
      if (auth.user) {
        frontendLogger.error("quotationActivity", "Failed to delete quotation", error, auth.user, {
          quotationId: quotation._id,
          referenceNumber: quotation.referenceNumber,
          errorMessage: error.response?.data?.message || error.message,
          stack: error.stack,
          responseData: error.response?.data,
          action: "DELETE_QUOTATION_FAILURE"
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClientSelect = (client) => {
    setQuotationData((prev) => ({
      ...prev,
      client: {
        _id: client._id,
        companyName: client.companyName || "",
        gstNumber: client.gstNumber || "",
        email: client.email || "",
        phone: client.phone || "",
      },
    }));
    setSelectedClientIdForForm(client._id);
    setError(null); // Clear any previous client-related form errors
  };

  return (
    <div>
      <Navbar />
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 style={{ color: "black" }}>Quotations</h2>
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
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                borderRadius: "20px",
                padding: "8px 20px",
                border: "1px solid #ced4da",
                boxShadow: "none",
              }}
            />
            <div className="d-flex align-items-center gap-2">
              <Form.Check
                inline
                label="All"
                name="statusFilter"
                type="radio"
                id="status-all"
                checked={statusFilter === "all"}
                onChange={() => {
                  setStatusFilter("all");
                  setCurrentPage(1);
                }}
              />
              <Form.Check
                inline
                label="Open"
                name="statusFilter"
                type="radio"
                id="status-open"
                checked={statusFilter === "open"}
                onChange={() => {
                  setStatusFilter("open");
                  setCurrentPage(1);
                }}
              />
              <Form.Check
                inline
                label="Closed"
                name="statusFilter"
                type="radio"
                id="status-closed"
                checked={statusFilter === "closed"}
                onChange={() => {
                  setStatusFilter("closed");
                  setCurrentPage(1);
                }}
              />
              <Form.Check
                inline
                label="Hold"
                name="statusFilter"
                type="radio"
                id="status-hold"
                checked={statusFilter === "hold"}
                onChange={() => {
                  setStatusFilter("hold");
                  setCurrentPage(1);
                }}
              />
            </div>

            <Button variant="primary" onClick={openCreateModal}>
              Create New Quotation
            </Button>
          </div>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <ReusableTable
          columns={[
            { key: 'referenceNumber', header: 'Reference No', sortable: true },
            { key: 'client.companyName', header: 'Company Name', sortable: true, renderCell: (item) => item.client?.companyName },
            ...(user?.role === 'super-admin' ? [{ key: 'user.firstname', header: 'Created By', sortable: true, renderCell: (item) => `${item.user?.firstname || ''} ${item.user?.lastname || ''}` }] : []),
            { key: 'client.gstNumber', header: 'GST Number', sortable: true, renderCell: (item) => item.client?.gstNumber },
            { key: 'grandTotal', header: 'Total (₹)', sortable: true, renderCell: (item) => item.grandTotal.toFixed(2), cellClassName: 'text-end' },
            {
              key: 'status',
              header: 'Status',
              sortable: true,
              renderCell: (item) => (
                <span
                  className={`badge ${item.status === 'open'
                      ? 'bg-primary'
                      : item.status === 'closed'
                        ? 'bg-success'
                        : 'bg-warning'
                    }`}
                >
                  {item.status}
                </span>
              ),
            },
          ]}
          data={currentItems}
          keyField="_id"
          isLoading={isLoading}
          error={error && currentItems.length === 0 ? error : null} // Show table-level error only if no data due to error
          onSort={requestSort}
          sortConfig={sortConfig}
          renderActions={(quotation) => (
            <ActionButtons
              item={quotation}
              onEdit={handleEdit}
              onCreateTicket={handleCreateTicket}
              onView={() => {
                setCurrentQuotation(quotation);
                setShowPdfModal(true);
              }}
              onDelete={user?.role === 'super-admin' ? handleDeleteQuotation : undefined}
              isLoading={isLoading}
            />
          )}
          noDataMessage="No quotations found."
          tableClassName="mt-3"
          theadClassName="table-dark"
        />

        {/* {filteredQuotations.length > itemsPerPage && (
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
          </div> */}
        {/* )} */}

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
          <div style={fullScreenModalStyle}>
            {/* Updated Modal Header with same styling as CreateTicketModal */}
            <Modal.Header
              closeButton
              onHide={() => {
                setShowModal(false);
                setCurrentQuotation(null);
                resetForm();
              }}
              style={{
                borderBottom: "1px solid #dee2e6",
                padding: "1rem",
                flexShrink: 0, // Prevent header from shrinking
              }}
            >
              <Modal.Title>
                {currentQuotation
                  ? `Edit Quotation - ${quotationData.referenceNumber}`
                  : `Create New Quotation - ${quotationData.referenceNumber}`}
                <br />
              </Modal.Title>
            </Modal.Header>
            {/* The div with fullScreenModalStyle and the unused IIFE were removed.
                The Form is now a direct child of Modal's content area.
                Its style is adjusted to correctly fill space and manage layout. */}
            <Form
              noValidate
              validated={formValidated}
              onSubmit={handleSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                flexGrow: 1, // Make form take available vertical space
                overflow: "hidden", // Prevent form itself from scrolling; Modal.Body will scroll
              }}
            >
              <Modal.Body
                style={{
                  flexGrow: 1,
                  overflowY: "auto",
                  padding: "20px",
                }}
              >
                <div className="row">
                  <Form.Group className="mb-3 col-md-4">
                    <Form.Label>
                      Date <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      required
                      type="date"
                      name="date"
                      value={quotationData.date}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                  {/* <Form.Group className="mb-3 col-md-4">
                  <Form.Label>Reference Number</Form.Label>
                  <Form.Control
                    type="text"
                    name="referenceNumber"
                    value={quotationData.referenceNumber}
                    readOnly
                  />
                </Form.Group> */}
                  <Form.Group className="mb-3 col-md-4">
                    <Form.Label>
                      Validity Date <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      required
                      type="date"
                      name="validityDate"
                      value={quotationData.validityDate}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3 col-md-4">
                    <Form.Label>
                      Status <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Select
                      required
                      name="status"
                      value={quotationData.status}
                      onChange={handleInputChange}
                    >
                      <option value="open">Open</option>
                      <option value="closed">Closed</option>
                      <option value="hold">Hold</option>
                    </Form.Select>
                  </Form.Group>
                </div>

                <h5>Client Details</h5>
                <>
                  <ClientSearchComponent
                    onClientSelect={handleClientSelect}
                    placeholder="Search & select client"
                    currentClientId={selectedClientIdForForm}
                  />
                  {selectedClientIdForForm && (
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      className="mb-2 mt-1"
                      onClick={() => {
                        setSelectedClientIdForForm(null);
                        setQuotationData((prev) => ({
                          ...prev,
                          client: {
                            ...initialQuotationData.client,
                            _id: null, // Explicitly nullify ID
                          },
                        }));
                      }}
                    >
                      Clear/Edit Client Details
                    </Button>
                  )}
                </>

                <div className="row">
                  <Form.Group className="mb-3 col-md-6">
                    <Form.Label>
                      Company Name <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      required
                      type="text"
                      name="client.companyName"
                      value={quotationData.client.companyName}
                      onChange={!selectedClientIdForForm ? handleInputChange : undefined}
                      readOnly={!!selectedClientIdForForm}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3 col-md-6">
                    <Form.Label>
                      GST Number <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      required
                      type="text"
                      name="client.gstNumber"
                      value={quotationData.client.gstNumber}
                      onChange={!selectedClientIdForForm ? handleInputChange : undefined}
                      readOnly={!!selectedClientIdForForm}
                    />
                  </Form.Group>
                </div>
                <div className="row">
                  <Form.Group className="mb-3 col-md-6">
                    <Form.Label>
                      Email <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      type="email"
                      name="client.email"
                      value={quotationData.client.email}
                      onChange={!selectedClientIdForForm ? handleInputChange : undefined}
                      readOnly={!!selectedClientIdForForm}
                    />
                  </Form.Group>
                  <Form.Group className="mb-3 col-md-6">
                    <Form.Label>
                      Phone <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      type="tel"
                      name="client.phone"
                      value={quotationData.client.phone}
                      onChange={!selectedClientIdForForm ? handleInputChange : undefined}
                      readOnly={!!selectedClientIdForForm}
                    />
                  </Form.Group>
                </div>

                {!selectedClientIdForForm &&
                  quotationData.client.companyName &&
                  quotationData.client.gstNumber &&
                  quotationData.client.email &&
                  quotationData.client.phone && (
                    <Button
                      variant="success"
                      onClick={handleSaveClientDetails}
                      className="mb-3"
                      disabled={isSavingClient}
                    >
                      {isSavingClient ? "Saving Client..." : "Save New Client"}
                    </Button>
                  )
                }

                <h5>Goods Details</h5>
                <GoodsTable
                  goods={quotationData.goods}
                  handleGoodsChange={handleGoodsChange}
                  currentQuotation={currentQuotation}
                  isEditing={true}
                  onAddItem={handleAddItem}
                  onDeleteItem={handleDeleteItem}
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
              <Modal.Footer
                style={{
                  borderTop: "1px solid #dee2e6",
                  padding: "15px",
                  flexShrink: 0,
                }}
              >
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowModal(false);
                    setCurrentQuotation(null);
                    resetForm();
                  }}
                  disabled={isLoading}
                >
                  Close
                </Button>
                <Button variant="primary" type="submit" disabled={isLoading}>
                  {isLoading
                    ? currentQuotation
                      ? "Updating..."
                      : "Saving..."
                    : currentQuotation
                      ? "Update Quotation"
                      : "Save Quotation"}
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
          error={error} // Pass error to CreateTicketModal if it needs to display it
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
          <Modal.Body
            className="pdf-viewer-container"
            style={{ height: "600px" }}
          >
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

        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss draggable pauseOnHover />

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
