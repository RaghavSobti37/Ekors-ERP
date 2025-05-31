import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { Modal, Button, Form, Table, Alert } from "react-bootstrap";
import {
  Eye, // View
  PencilSquare, // Edit
  Trash, // Delete
  PlusSquare, // Create Ticket
} from "react-bootstrap-icons";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import ClientSearchComponent from "../components/ClientSearchComponent.jsx";
import ItemSearchComponent from "../components/ItemSearch";
import QuotationPDF from "../components/QuotationPDF";
import CreateTicketModal from "../components/CreateTicketModal.jsx";
import "../css/Quotation.css";
import "../css/Style.css";
import Pagination from "../components/Pagination";
import "../css/Items.css";
import ReusableTable from "../components/ReusableTable.jsx";
// SortIndicator is not directly used here but ReusableTable might use it.
// import SortIndicator from "../components/SortIndicator.jsx";

import ActionButtons from "../components/ActionButtons";
import { ToastContainer, toast } from "react-toastify";
import frontendLogger from "../utils/frontendLogger.js";
import "react-toastify/dist/ReactToastify.css";
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer";

import { showToast, handleApiError } from "../utils/helpers";

const fullScreenModalStyle = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "95vw",
  height: "95vh",
  maxWidth: "none",
  margin: 0,
  padding: 0,
  overflow: "auto",
  backgroundColor: "white",
  border: "1px solid #dee2e6",
  borderRadius: "0.3rem",
  boxShadow: "0 0.5rem 1rem rgba(0, 0, 0, 0.15)",
  zIndex: 1050,
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
                    readOnly={
                      isEditing &&
                      !(Number(item.maxDiscountPercentage || 0) > 0)
                    }
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
    key: "date",
    direction: "descending",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedClientIdForForm, setSelectedClientIdForForm] = useState(null);
  const { user, loading } = useAuth();
  const auth = useAuth();
  const [statusFilter, setStatusFilter] = useState("all");
  const navigate = useNavigate();

  const getAuthToken = () => {
    try {
      const token = localStorage.getItem("erp-user");
      return token || null;
    } catch (e) {
      toast.error("Error accessing local storage for authentication token.");
      const errorDetails = {
        errorMessage: e.message,
        stack: e.stack,
        context: "getAuthToken - localStorage access",
      };
      if (auth.user) {
        frontendLogger.error(
          "localStorageAccess",
          "Failed to get auth token from localStorage",
          auth.user,
          errorDetails
        );
      } else {
        frontendLogger.error(
          "localStorageAccess",
          "Failed to get auth token from localStorage (user not authenticated)",
          null,
          errorDetails
        );
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
    return `Q-${year}${month}${day}-${hours}${minutes}${seconds}`;
  };

  const handleSaveClientDetails = async () => {
    const {
      companyName: rawCompanyName,
      gstNumber: rawGstNumber,
      email: rawEmail,
      phone: rawPhone,
    } = quotationData.client;

    const companyName = rawCompanyName?.trim();
    const gstNumber = rawGstNumber?.trim();
    const email = rawEmail?.trim();
    const phone = rawPhone?.trim();

    if (!companyName || !gstNumber || !email || !phone) {
      const msg =
        "All client fields (Company Name, GST, Email, Phone) are required and cannot be just whitespace.";
      setError(msg);
      toast.warn(msg);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      const msg = "Invalid email format.";
      setError(msg);
      toast.warn(msg);
      return;
    }

    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) {
      const msg = "Phone number must be 10 digits.";
      setError(msg);
      toast.warn(msg);
      return;
    }

    setIsSavingClient(true);
    setError(null);
    const clientPayload = {
      companyName: companyName,
      gstNumber: gstNumber.toUpperCase(),
      email: email.toLowerCase(),
      phone: phone,
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
          client: { ...response.data },
        }));
        setSelectedClientIdForForm(response.data._id);
        setError(null);
        toast.success("Client saved successfully!");
        if (auth.user) {
          frontendLogger.info(
            "clientActivity",
            "New client saved successfully",
            auth.user,
            {
              clientId: response.data._id,
              clientName: response.data.companyName,
              action: "SAVE_NEW_CLIENT_SUCCESS",
            }
          );
        }
      } else {
        setError("Failed to save client: Unexpected response from server.");
        toast.error("Failed to save client: Unexpected response from server.");
      }
    } catch (error) {
      let errorMessage = "Failed to save client details.";
      if (error.response?.data?.field === "gstNumber") {
        errorMessage =
          error.response.data.message ||
          "This GST Number is already registered.";
      } else if (error.response?.data?.field === "email") {
        errorMessage =
          error.response.data.message || "This Email is already registered.";
      } else {
        errorMessage = error.response?.data?.message || errorMessage;
      }
      setError(errorMessage);
      toast.error(errorMessage);

      if (auth.user) {
        frontendLogger.error(
          "clientActivity",
          "Failed to save new client",
          auth.user,
          {
            clientPayload: clientPayload,
            errorMessage: error.response?.data?.message || error.message,
            stack: error.stack,
            responseData: error.response?.data,
            action: "SAVE_NEW_CLIENT_FAILURE",
          }
        );
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
      _id: null,
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

      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const url = `http://localhost:3000/api/quotations${
        params.toString() ? `?${params.toString()}` : ""
      }`;

      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setQuotations(response.data);
      setQuotationsCount(response.data.length);
      setError(null);
    } catch (error) {
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to load quotations. Please try again.";
      setError(errorMessage);
      showToast(errorMessage, false);

      if (auth.user) {
        frontendLogger.error(
          "quotationActivity",
          "Failed to fetch quotations",
          auth.user,
          {
            errorMessage: error.response?.data?.message || error.message,
            stack: error.stack,
            responseData: error.response?.data,
            statusFilter,
            action: "FETCH_QUOTATIONS_FAILURE",
          }
        );
      }

      if (error.response?.status === 401) {
        toast.error("Authentication failed. Please log in again.");
        navigate("/login", { state: { from: "/quotations" } });
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, loading, navigate, statusFilter, auth]);

  useEffect(() => {
    if (!loading && !user) {
      if (window.location.pathname !== "/login")
        navigate("/login", { state: { from: "/quotations" } });
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
      if (sortConfig.key === "date" || sortConfig.key === "validityDate") {
        const dateA = new Date(a[sortConfig.key]);
        const dateB = new Date(b[sortConfig.key]);
        return sortConfig.direction === "ascending"
          ? dateA - dateB
          : dateB - dateA;
      }
      if (sortConfig.key === "grandTotal") {
        return sortConfig.direction === "ascending"
          ? a.grandTotal - b.grandTotal
          : b.grandTotal - a.grandTotal;
      }
      // For string comparisons like client.companyName or referenceNumber
      const valA = sortConfig.key.includes('.') ? sortConfig.key.split('.').reduce((o, i) => o?.[i], a) : a[sortConfig.key];
      const valB = sortConfig.key.includes('.') ? sortConfig.key.split('.').reduce((o, i) => o?.[i], b) : b[sortConfig.key];

      if (valA < valB) {
        return sortConfig.direction === "ascending" ? -1 : 1;
      }
      if (valA > valB) {
        return sortConfig.direction === "ascending" ? 1 : -1;
      }
      return 0;
    });
  }, [quotations, sortConfig]);

  const filteredQuotations = useMemo(() => {
    let filtered = sortedQuotations;

    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (quotation) => quotation.status === statusFilter
      );
    }

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
        unit: item.unit || "Nos",
        price: item.price,
        amount: item.price,
        originalPrice: item.price,
        maxDiscountPercentage: item.maxDiscountPercentage,
      },
    ];

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
    setError(null);
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

    if (field === "price") {
      const currentItem = updatedGoods[index];
      const newPrice = parseFloat(value);
      const originalPrice = parseFloat(currentItem.originalPrice);
      const maxDiscountPerc = parseFloat(currentItem.maxDiscountPercentage);

      if (!isNaN(newPrice) && !isNaN(originalPrice)) {
        if (!isNaN(maxDiscountPerc) && maxDiscountPerc > 0) {
          const minAllowedPrice = originalPrice * (1 - maxDiscountPerc / 100);
          if (newPrice < minAllowedPrice) {
            priceValidationError = `Discount for ${
              currentItem.description
            } exceeds the maximum allowed ${maxDiscountPerc}%. Minimum price is ₹${minAllowedPrice.toFixed(
              2
            )}.`;
          }
        } else {
          if (newPrice < originalPrice) {
            priceValidationError = `Price for ${
              currentItem.description
            } (₹${newPrice.toFixed(
              2
            )}) cannot be lower than the original price (₹${originalPrice.toFixed(
              2
            )}) as no discount is applicable.`;
          }
        }
      } else {
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
      if (
        error &&
        (error.includes(`Discount for ${updatedGoods[index].description}`) ||
          error.includes(`Price for ${updatedGoods[index].description}`))
      ) {
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
    const renumberedGoods = updatedGoods.map((item, index) => ({
      ...item,
      srNo: index + 1,
    }));
    const totalQuantity = renumberedGoods.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );
    const totalAmount = renumberedGoods.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    const gstAmount = totalAmount * 0.18;
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
      if (
        quotationData.client.companyName ||
        quotationData.client.gstNumber ||
        quotationData.client.email ||
        quotationData.client.phone
      ) {
        setError(
          "You have entered new client details. Please click 'Save New Client' before saving the quotation."
        );
        toast.warn(
          "You have entered new client details. Please click 'Save New Client' before saving the quotation."
        );
      } else {
        setError(
          "Please select an existing client or enter and save details for a new client."
        );
        toast.warn(
          "Please select an existing client or enter and save details for a new client."
        );
      }
      return;
    }

    if (!quotationData.goods || quotationData.goods.length === 0) {
      setError("Please add at least one item to the quotation.");
      toast.error("Please add at least one item to the quotation.");
      return;
    }

    for (let i = 0; i < quotationData.goods.length; i++) {
      const item = quotationData.goods[i];
      if (
        !item.description ||
        !(parseFloat(item.quantity) > 0) ||
        !(parseFloat(item.price) >= 0) ||
        !item.unit
      ) {
        const itemErrorMsg = `Item ${
          i + 1
        } is incomplete. Please fill all required fields.`;
        setError(itemErrorMsg);
        toast.error(itemErrorMsg);
        return;
      }
      if (item.maxDiscountPercentage > 0) {
        const minAllowedPrice =
          item.originalPrice * (1 - (item.maxDiscountPercentage || 0) / 100);
        if (parseFloat(item.price) < minAllowedPrice) {
          const priceErrorMsg = `Price for ${item.description} (₹${parseFloat(
            item.price
          ).toFixed(
            2
          )}) is below the minimum allowed price (₹${minAllowedPrice.toFixed(
            2
          )}) due to ${item.maxDiscountPercentage}% max discount.`;
          setError(priceErrorMsg);
          toast.error(priceErrorMsg);
          return;
        }
      }
    }

    if (error && error.includes("exceeds the maximum allowed")) {
      setError(null);
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error("No authentication token found");
      }

      submissionData = {
        referenceNumber: quotationData.referenceNumber,
        date: new Date(quotationData.date).toISOString(),
        validityDate: new Date(quotationData.validityDate).toISOString(),
        orderIssuedBy: quotationData.orderIssuedBy,
        goods: quotationData.goods.map((item) => ({
          srNo: item.srNo,
          description: item.description,
          hsnSacCode: item.hsnSacCode || "",
          quantity: Number(item.quantity),
          unit: item.unit || "Nos",
          price: Number(item.price),
          amount: Number(item.amount),
          originalPrice: Number(item.originalPrice),
          maxDiscountPercentage: item.maxDiscountPercentage
            ? Number(item.maxDiscountPercentage)
            : 0,
        })),
        totalQuantity: Number(quotationData.totalQuantity),
        totalAmount: Number(quotationData.totalAmount),
        gstAmount: Number(quotationData.gstAmount),
        grandTotal: Number(quotationData.grandTotal),
        status: quotationData.status || "open",
        client: quotationData.client,
      };

      const url = currentQuotation
        ? `http://localhost:3000/api/quotations/${currentQuotation._id}`
        : "http://localhost:3000/api/quotations";
      const method = currentQuotation ? "put" : "post";

      const response = await axiosmethod;

      if (response.status === 200 || response.status === 201) {
        fetchQuotations();
        setShowModal(false);
        resetForm();
        setCurrentQuotation(null);
        toast.success(
          `Quotation ${submissionData.referenceNumber} ${
            currentQuotation ? "updated" : "created"
          } successfully!`
        );

        if (auth.user) {
          frontendLogger.info(
            "quotationActivity",
            `Quotation ${submissionData.referenceNumber} ${
              currentQuotation ? "updated" : "created"
            }`,
            auth.user,
            {
              quotationId: response.data._id,
              referenceNumber: submissionData.referenceNumber,
              action: currentQuotation
                ? "UPDATE_QUOTATION_SUCCESS"
                : "CREATE_QUOTATION_SUCCESS",
            }
          );
        }
      }
    } catch (error) {
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
      setError(errorMessage);
      toast.error(errorMessage);

      if (auth.user) {
        frontendLogger.error(
          "quotationActivity",
          currentQuotation
            ? "Failed to update quotation"
            : "Failed to create quotation",
          auth.user,
          {
            referenceNumber: quotationData.referenceNumber,
            quotationId: currentQuotation?._id,
            errorMessage: error.response?.data?.message || error.message,
            stack: error.stack,
            responseData: error.response?.data,
            submittedData: submissionData,
            action: currentQuotation
              ? "UPDATE_QUOTATION_FAILURE"
              : "CREATE_QUOTATION_FAILURE",
          }
        );
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
      toast.error(
        "Failed to generate ticket number. Using a temporary number."
      );
      if (auth.user) {
        frontendLogger.error(
          "ticketActivity",
          "Failed to generate ticket number from API",
          auth.user,
          {
            errorMessage: error.response?.data?.message || error.message,
            stack: error.stack,
            responseData: error.response?.data,
            action: "GENERATE_TICKET_NUMBER_FAILURE",
          }
        );
      }
    }
  };

  const handleCreateTicket = async (quotation) => {
    const ticketNumber = await generateTicketNumber();

    // Prepare address arrays from quotation's client
    const clientBillingAddress = quotation.client?.billingAddress || {};
    const clientShippingAddress = quotation.client?.shippingAddress || {};

    const billingAddressArray = [
      clientBillingAddress.address1 || "", clientBillingAddress.address2 || "",
      clientBillingAddress.state || "", clientBillingAddress.city || "", clientBillingAddress.pincode || ""
    ];
    const shippingAddressArray = [
      clientShippingAddress.address1 || "", clientShippingAddress.address2 || "",
      clientShippingAddress.state || "", clientShippingAddress.city || "", clientShippingAddress.pincode || ""
    ];

    setTicketData({
      ticketNumber,
      companyName: quotation.client?.companyName || "",
      quotationNumber: quotation.referenceNumber,
      billingAddress: billingAddressArray,
      shippingAddress: shippingAddressArray,
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
      toast.error("Failed to check for existing ticket.");
      if (auth.user) {
        frontendLogger.error(
          "ticketActivity",
          "Failed to check for existing ticket",
          auth.user,
          {
            quotationNumber,
            errorMessage: error.response?.data?.message || error.message,
            stack: error.stack,
            responseData: error.response?.data,
            action: "CHECK_EXISTING_TICKET_FAILURE",
          }
        );
      }
      return false;
    }
  };

  const handleTicketSubmit = async (event) => {
    event.preventDefault();
    setFormValidated(true);
    let completeTicketData = {};

    try {
      setIsLoading(true);
      setError(null);

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

      if (!auth.user || !auth.user.id) {
        const noUserIdError =
          "User ID not found in authentication context. Please re-login.";
        setError(noUserIdError);
        toast.error(noUserIdError);
        throw new Error(noUserIdError);
      }

      completeTicketData = {
        ...ticketData,
        createdBy: auth.user.id,
        currentAssignee: auth.user.id,
        statusHistory: [
          {
            status: ticketData.status,
            changedAt: new Date(),
            changedBy: auth.user.id,
          },
        ],
        documents: {
          quotation: null,
          po: null,
          pi: null,
          challan: null,
          packingList: null,
          feedback: null,
          other: [],
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
        toast.success(
          `Ticket ${response.data.ticketNumber} created successfully!`
        );
        if (auth.user) {
          frontendLogger.info(
            "ticketActivity",
            `Ticket ${response.data.ticketNumber} created successfully from quotation ${ticketData.quotationNumber}`,
            auth.user,
            {
              action: "TICKET_CREATED_FROM_QUOTATION_SUCCESS",
              ticketNumber: response.data.ticketNumber,
              quotationNumber: ticketData.quotationNumber,
            }
          );
        }
        fetchQuotations(); // Refresh quotations to update status to 'running'
        // navigate("/tickets"); // Optional: navigate to tickets page
      }
    } catch (error) {
      let errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Failed to create ticket. Please try again.";
      setError(errorMessage);
      toast.error(errorMessage);

      if (auth.user) {
        frontendLogger.error(
          "ticketActivity",
          "Failed to create ticket from quotation",
          auth.user,
          {
            quotationNumber: ticketData.quotationNumber,
            errorMessage: error.response?.data?.message || error.message,
            stack: error.stack,
            responseData: error.response?.data,
            ticketDataSubmitted: completeTicketData,
            action: "CREATE_TICKET_FROM_QUOTATION_FAILURE",
          }
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (quotation) => {
    setCurrentQuotation(quotation);
    let orderIssuedByIdToSet = null;
    if (quotation.orderIssuedBy) {
      orderIssuedByIdToSet =
        quotation.orderIssuedBy._id || quotation.orderIssuedBy;
    } else if (quotation.user) {
      orderIssuedByIdToSet = quotation.user._id || quotation.user;
    } else if (user && user.id) {
      orderIssuedByIdToSet = user.id;
    }
    if (
      typeof orderIssuedByIdToSet === "object" &&
      orderIssuedByIdToSet !== null
    ) {
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
        unit: item.unit || "Nos",
        originalPrice: Number(item.originalPrice || item.price),
        maxDiscountPercentage: item.maxDiscountPercentage
          ? Number(item.maxDiscountPercentage)
          : 0,
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
      setError("User data is not available. Please log in again.");
      toast.error("User data is not available. Please log in again.");
      return;
    }
    setCurrentQuotation(null);
    setQuotationData({
      ...initialQuotationData,
      date: formatDateForInput(new Date()),
      referenceNumber: generateQuotationNumber(),
      orderIssuedBy: user.id,
      client: { ...initialQuotationData.client, _id: null },
    });
    setSelectedClientIdForForm(null);
    setFormValidated(false);
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
      setError(null);
      setCurrentQuotation(null);
      setShowModal(false);
      resetForm();
      fetchQuotations();
      toast.success(
        `Quotation ${quotation.referenceNumber} deleted successfully.`
      );
      if (auth.user) {
        frontendLogger.info(
          "quotationActivity",
          `Quotation ${quotation.referenceNumber} deleted`,
          auth.user,
          {
            quotationId: quotation._id,
            referenceNumber: quotation.referenceNumber,
            action: "DELETE_QUOTATION_SUCCESS",
          }
        );
      }
    } catch (error) {
      let errorMessage =
        error.response?.data?.message ||
        "Failed to delete quotation. Please try again.";
      if (error.response) {
        if (error.response.status === 401) {
          navigate("/login", { state: { from: "/quotations" } });
          toast.error("Authentication failed. Please log in again.");
          setIsLoading(false);
          return;
        }
      } else if (error.request) {
        errorMessage =
          "No response from server. Check your network connection.";
      }
      setError(errorMessage);
      toast.error(errorMessage);
      if (auth.user) {
        frontendLogger.error(
          "quotationActivity",
          "Failed to delete quotation",
          error, // Changed from error to auth.user, then back to error for full object
          auth.user,
          {
            quotationId: quotation._id,
            referenceNumber: quotation.referenceNumber,
            errorMessage: error.response?.data?.message || error.message,
            stack: error.stack,
            responseData: error.response?.data,
            action: "DELETE_QUOTATION_FAILURE",
          }
        );
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
    setError(null);
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
                label="Running"
                name="statusFilter"
                type="radio"
                id="status-running"
                checked={statusFilter === "running"}
                onChange={() => {
                  setStatusFilter("running");
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
            { key: "referenceNumber", header: "Reference No", sortable: true, tooltip: "year month day - (24h) hrs mins secs" },
            {
              key: "client.companyName",
              header: "Company Name",
              sortable: true,
              renderCell: (item) => item.client?.companyName,
              // tooltip: "The name of the client company."
            },
            ...(user?.role === "super-admin"
              ? [
                  {
                    key: "user.firstname",
                    header: "Created By",
                    sortable: true,
                    renderCell: (item) =>
                      `${item.user?.firstname || ""} ${
                        item.user?.lastname || ""
                      }`,
                    // tooltip: "User who created this quotation."
                  },
                ]
              : []),
            {
              key: "validityDate",
              header: "Validity Date",
              sortable: true,
              renderCell: (item) => formatDateForInput(item.validityDate),
              // tooltip: "The date until which the quotation is valid."
            },
            {
              key: "grandTotal",
              header: "Total (₹)",
              sortable: true,
              renderCell: (item) => item.grandTotal.toFixed(2),
              cellClassName: "text-end",
              // tooltip: "The total amount of the quotation including taxes."
            },
            {
              key: "status",
              header: "Status",
              sortable: true,
              renderCell: (item) => (
                <span
                  className={`badge ${
                    item.status === "open"
                      ? "bg-primary"
                      : item.status === "closed"
                      ? "bg-success"
                      : item.status === "running"
                      ? "bg-info" 
                      : "bg-warning" // for 'hold'
                  }`}
                >
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </span>
              ),
              tooltip: "Current status of the quotation (Open, Running, Hold, Closed)."
            },
          ]}
          data={currentItems}
          keyField="_id"
          isLoading={isLoading}
          error={error && currentItems.length === 0 ? error : null}
          onSort={requestSort}
          sortConfig={sortConfig}
          
          renderActions={(quotation) => (
            <ActionButtons
              item={quotation}
              onEdit={handleEdit}
              onCreateTicket={quotation.status !== 'closed' && quotation.status !== 'running' ? handleCreateTicket : undefined} // Disable if closed or running
              onView={() => {
                setCurrentQuotation(quotation);
                setShowPdfModal(true);
              }}
              onDelete={
                user?.role === "super-admin" ? handleDeleteQuotation : undefined
              }
              isLoading={isLoading}
              // Disable create ticket button if status is 'closed' or 'running'
              isCreateTicketDisabled={quotation.status === 'closed' || quotation.status === 'running'}
              createTicketDisabledTooltip={
                (quotation.status === 'closed' || quotation.status === 'running') 
                ? `Cannot create ticket for a quotation that is already ${quotation.status}.` 
                : "Create a new ticket from this quotation."
              }
            />
          )}
          noDataMessage="No quotations found."
          tableClassName="mt-3"
          theadClassName="table-dark"
        />

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
                flexShrink: 0,
              }}
            >
              <Modal.Title>
                {currentQuotation
                  ? `Edit Quotation - ${quotationData.referenceNumber}`
                  : `Create New Quotation - ${quotationData.referenceNumber}`}
              </Modal.Title>
            </Modal.Header>
            <Form
              noValidate
              validated={formValidated}
              onSubmit={handleSubmit}
              style={{
                display: "flex",
                flexDirection: "column",
                flexGrow: 1,
                overflow: "hidden",
              }}
            >
              <Modal.Body
                style={{
                  flexGrow: 1,
                  overflowY: "auto",
                  padding: "20px",
                }}
              >
                 {error && <Alert variant="danger">{error}</Alert>}
                <div className="row">
                  <Form.Group className="mb-3 col-md-4">
                    <Form.Label>
                      Issue Date <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Control
                      required
                      type="date"
                      name="date"
                      value={quotationData.date}
                      onChange={handleInputChange}
                    />
                  </Form.Group>
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
                    {(currentQuotation && (currentQuotation.status === 'running' || currentQuotation.status === 'closed')) || (quotationData.status === 'running' || quotationData.status === 'closed') ? (
                      <Form.Control
                        type="text"
                        value={quotationData.status.charAt(0).toUpperCase() + quotationData.status.slice(1)}
                        readOnly
                      />
                    ) : (
                      <Form.Select
                        required
                        name="status"
                        value={quotationData.status}
                        onChange={handleInputChange}
                      >
                        <option value="open">Open</option>
                        <option value="hold">Hold</option>
                      </Form.Select>
                    )}
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
                            _id: null,
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
                      onChange={
                        !selectedClientIdForForm ? handleInputChange : undefined
                      }
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
                      onChange={
                        !selectedClientIdForForm ? handleInputChange : undefined
                      }
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
                      onChange={
                        !selectedClientIdForForm ? handleInputChange : undefined
                      }
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
                      onChange={
                        !selectedClientIdForForm ? handleInputChange : undefined
                      }
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
                  )}

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
                      <h5>
                        Grand Total: ₹{quotationData.grandTotal.toFixed(2)}
                      </h5>
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

        <CreateTicketModal
          show={showTicketModal}
          onHide={() => setShowTicketModal(false)}
          ticketData={ticketData}
          setTicketData={setTicketData}
          handleTicketSubmit={handleTicketSubmit}
          isLoading={isLoading}
          error={error}
        />

        <Modal
          show={showPdfModal}
          onHide={() => setShowPdfModal(false)}
          dialogClassName="custom-modal"
          contentClassName="custom-modal-content"
        >
          <Modal.Header closeButton>
            <Modal.Title>
              Quotation PDF - {currentQuotation?.referenceNumber}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="p-0 d-flex flex-column">
            {currentQuotation && (
              <>
                <div className="flex-grow-1 d-flex flex-column overflow-hidden">
                  <PDFViewer className="flex-grow-1 w-100 pdf-fullscreen-viewer">
                    <QuotationPDF quotation={currentQuotation} />
                  </PDFViewer>
                </div>
                <div className="d-flex justify-content-center gap-2 p-3 border-top">
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
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />

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
