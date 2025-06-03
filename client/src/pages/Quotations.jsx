import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Button, Form, Table, Alert } from "react-bootstrap";
import Navbar from "../components/Navbar.jsx"; // Navigation bar component
import { useAuth } from "../context/AuthContext"; // Authentication context
import { useNavigate } from "react-router-dom";
import ClientSearchComponent from "../components/ClientSearchComponent.jsx"; // Component for searching clients
import ItemSearchComponent from "../components/ItemSearch"; // Component for searching items
import QuotationPDF from "../components/QuotationPDF"; // Component for rendering Quotation PDF
import CreateTicketModal from "../components/CreateTicketModal.jsx"; // Modal for creating tickets from quotations
import Pagination from "../components/Pagination"; // Component for table pagination
import ReusableTable from "../components/ReusableTable.jsx"; // Component for displaying data in a table
import SearchBar from "../components/Searchbar.jsx"; // Import the new SearchBar
import ActionButtons from "../components/ActionButtons"; // Component for table action buttons
import { ToastContainer, toast } from "react-toastify"; // Library for toast notifications
import frontendLogger from "../utils/frontendLogger.js"; // Utility for frontend logging
import "react-toastify/dist/ReactToastify.css";
import { PDFViewer, PDFDownloadLink } from "@react-pdf/renderer"; // Components for PDF viewing and downloading
import {
  showToast,
  handleApiError,
  formatDateForInput as formatDateForInputHelper,
} from "../utils/helpers"; // Utility functions
import apiClient from "../utils/apiClient"; // Utility for making API requests
import { getAuthToken as getAuthTokenUtil } from "../utils/authUtils"; // Utility for retrieving auth token
import "../css/Style.css"; // General styles
import "../css/Items.css"; // Assuming this is still needed for other parts of Quotations.jsx
import ReusableModal from "../components/ReusableModal.jsx";
import QuotationReportModal from "../components/QuotationReportModal.jsx";
import { FaChartBar } from "react-icons/fa"; // Import icon for report button

const GoodsTable = ({
  goods,
  handleGoodsChange,
  isEditing, // currentQuotation prop removed as isEditing implies its context
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
  const [itemsPerPage, setItemsPerPage] = useState(5); // Default items per page
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
  const [showQuotationReportModal, setShowQuotationReportModal] =
    useState(false);
  // reportPeriod, quotationReportSummary, reportLoading, exportLoading states are removed
  // as QuotationReportModal will manage these internally.
  const quotationFormId = "quotation-form";
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
      const token = getAuthTokenUtil(); // Use utility
      if (!token) throw new Error("No authentication token found");

      const responseData = await apiClient("/clients", {
        // Use apiClient
        method: "POST",
        body: clientPayload,
      });
      if (responseData && responseData._id) {
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
              clientId: responseData._id,
              clientName: responseData.companyName, // Corrected: use responseData
              action: "SAVE_NEW_CLIENT_SUCCESS",
            }
          );
        }
      } else {
        setError("Failed to save client: Unexpected response from server.");
        toast.error("Failed to save client: Unexpected response from server.");
      }
    } catch (error) {
      const errorMessage = handleApiError(
        error,
        "Failed to save client details.",
        auth.user,
        "clientActivity"
      );
      setError(errorMessage);
      toast.error(errorMessage);

      if (auth.user) {
        // handleApiError already logs, but if more specific logging is needed:
        frontendLogger.error(
          "clientActivity",
          "Failed to save new client",
          auth.user,
          {
            clientPayload: clientPayload,
            // Error details are already part of the error object passed to handleApiError
            // but can be logged again if needed for this specific context
            errorMessage: error.data?.message || error.message, // apiClient error structure
            stack: error.stack,
            responseData: error.data,
            action: "SAVE_NEW_CLIENT_FAILURE",
          }
        );
      }
    } finally {
      setIsSavingClient(false);
    }
  };

  const initialQuotationData = {
    date: formatDateForInputHelper(new Date()), // Use helper
    referenceNumber: generateQuotationNumber(),
    validityDate: formatDateForInputHelper(
      // Use helper
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
      const token = getAuthTokenUtil(); // Use utility
      if (!token) {
        throw new Error("No authentication token found");
      }

      const params = new URLSearchParams();
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }

      const endpoint = `/quotations${
        params.toString() ? `?${params.toString()}` : ""
      }`;

      const data = await apiClient(endpoint); // Use apiClient

      setQuotations(data);
      setQuotationsCount(data.length);
      setError(null);
    } catch (error) {
      const errorMessage = handleApiError(
        error,
        "Failed to load quotations. Please try again.",
        auth.user,
        "quotationActivity"
      );
      setError(errorMessage);
      showToast(errorMessage, false);
      // handleApiError already logs, but if more specific logging is needed:
      if (auth.user) {
        frontendLogger.error(
          "quotationActivity",
          "Failed to fetch quotations",
          auth.user,
          {
            errorMessage: error.response?.data?.message || error.message,
            // stack: error.stack, // Already in handleApiError
            // responseData: error.response?.data, // Already in handleApiError
            statusFilter,
            action: "FETCH_QUOTATIONS_FAILURE",
          }
        );
      }

      if (error.status === 401) {
        // apiClient error structure
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
      const valA = sortConfig.key.includes(".")
        ? sortConfig.key.split(".").reduce((o, i) => o?.[i], a)
        : a[sortConfig.key];
      const valB = sortConfig.key.includes(".")
        ? sortConfig.key.split(".").reduce((o, i) => o?.[i], b)
        : b[sortConfig.key];

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

  const requestSort = (key) => {
    let direction = "descending";
    if (sortConfig.key === key && sortConfig.direction === "descending") {
      direction = "ascending";
    }
    setSortConfig({ key, direction });
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to the first page
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
        price: item.sellingPrice, // Use sellingPrice from item
        amount: item.sellingPrice,  // Initial amount is sellingPrice * 1
        originalPrice: item.sellingPrice, // Store original selling price
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
      const token = getAuthTokenUtil(); // Use utility
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
        ? `/quotations/${currentQuotation._id}`
        : "/quotations";
      const method = currentQuotation ? "put" : "post";

      const responseData = await apiClient(url, {
        method,
        body: submissionData,
      }); // Use apiClient

      if (responseData) {
        // apiClient returns data directly on success
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
              action: currentQuotation // Corrected: use responseData
                ? "UPDATE_QUOTATION_SUCCESS"
                : "CREATE_QUOTATION_SUCCESS",
            }
          );
        }
      }
    } catch (error) {
      const errorMessage = handleApiError(
        error,
        "Failed to save quotation. Please try again.",
        auth.user,
        "quotationActivity"
      );
      if (error.status === 401) {
        // apiClient error structure
        navigate("/login", { state: { from: "/quotations" } });
        return; // Already handled by handleApiError and toast
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
            // errorMessage: error.data?.message || error.message, // Already in handleApiError
            // stack: error.stack, // Already in handleApiError
            // responseData: error.data, // Already in handleApiError
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
      const token = getAuthTokenUtil(); // Use utility
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
            // errorMessage: error.data?.message || error.message, // apiClient error structure
            // stack: error.stack,
            // responseData: error.data,
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
      clientBillingAddress.address1 || "",
      clientBillingAddress.address2 || "",
      clientBillingAddress.state || "",
      clientBillingAddress.city || "",
      clientBillingAddress.pincode || "",
    ];
    const shippingAddressArray = [
      clientShippingAddress.address1 || "",
      clientShippingAddress.address2 || "",
      clientShippingAddress.state || "",
      clientShippingAddress.city || "",
      clientShippingAddress.pincode || "",
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
      const token = getAuthTokenUtil(); // Use utility
      if (!token) {
        throw new Error("No authentication token found");
      }
      // Use apiClient
      const data = await apiClient(`/tickets/check/${quotationNumber}`);
      return data.exists;
    } catch (error) {
      const errorMessage = handleApiError(
        error,
        "Failed to check for existing ticket.",
        auth.user,
        "ticketActivity"
      );
      toast.error(errorMessage);
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

      const token = getAuthTokenUtil(); // Use utility
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

      const responseData = await apiClient("/tickets", {
        // Use apiClient
        method: "POST",
        body: completeTicketData,
      });

      if (responseData) {
        // apiClient returns data directly on success
        setShowTicketModal(false);
        setError(null);
        toast.success(
          `Ticket ${responseData.ticketNumber} created successfully!`
        );
        if (auth.user) {
          frontendLogger.info(
            "ticketActivity",
            `Ticket ${responseData.ticketNumber} created successfully from quotation ${ticketData.quotationNumber}`,
            auth.user,
            {
              action: "TICKET_CREATED_FROM_QUOTATION_SUCCESS",
              ticketNumber: responseData.ticketNumber, // Corrected: use responseData
              quotationNumber: ticketData.quotationNumber,
            }
          );
        }
        fetchQuotations(); // Refresh quotations to update status to 'running'
        // navigate("/tickets"); // Optional: navigate to tickets page
      }
    } catch (error) {
      const errorMessage = handleApiError(
        error,
        "Failed to create ticket. Please try again.",
        auth.user,
        "ticketActivity"
      );
      setError(errorMessage);
      toast.error(errorMessage);

      if (auth.user) {
        frontendLogger.error(
          "ticketActivity",
          "Failed to create ticket from quotation",
          auth.user,
          {
            quotationNumber: ticketData.quotationNumber,
            // errorMessage: error.data?.message || error.message, // apiClient error structure
            // stack: error.stack,
            // responseData: error.data,
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
      date: formatDateForInputHelper(quotation.date), // Use helper
      referenceNumber: quotation.referenceNumber,
      validityDate: formatDateForInputHelper(quotation.validityDate), // Use helper
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
      date: formatDateForInputHelper(new Date()), // Use helper
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
      const token = getAuthTokenUtil(); // Use utility
      if (!token) throw new Error("No authentication token found");

      await apiClient(`/quotations/${quotation._id}`, { method: "DELETE" }); // Use apiClient

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
      const errorMessage = handleApiError(
        error,
        "Failed to delete quotation. Please try again.",
        auth.user,
        "quotationActivity"
      );
      if (error.status === 401) {
        // apiClient error structure
        navigate("/login", { state: { from: "/quotations" } });
        // toast.error is handled by handleApiError
        setIsLoading(false);
        return;
      }
      setError(errorMessage);
      toast.error(errorMessage);
      if (auth.user) {
        frontendLogger.error(
          "quotationActivity",
          "Failed to delete quotation",
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
            style={{ width: "82%" }}
          >
            <SearchBar
              value={searchTerm}
              setSearchTerm={setSearchTerm}
              placeholder="Search quotations..."
              className="flex-grow-1" // Allow search bar to take available space
            />
            <div className="d-flex align-items-center gap-2">
              {/* Status Filters */}
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
              ➕ Quotation
            </Button>
            <Button
              variant="info"
              onClick={() => setShowQuotationReportModal(true)}
              disabled={isLoading}
            >
              <FaChartBar className="me-1" /> Report
            </Button>
          </div>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <ReusableTable
          columns={[
            {
              key: "referenceNumber",
              header: "Reference No",
              sortable: true,
              tooltip: "year month day - (24h) hrs mins secs",
            },
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
              renderCell: (item) => formatDateForInputHelper(item.validityDate), // Use helper
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
              tooltip:
                "Current status of the quotation (Open, Running, Hold, Closed).",
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
              onCreateTicket={
                quotation.status !== "closed" && quotation.status !== "running"
                  ? handleCreateTicket
                  : undefined
              } // Disable if closed or running
              onView={() => {
                setCurrentQuotation(quotation);
                setShowPdfModal(true);
              }}
              onDelete={
                user?.role === "super-admin" ? handleDeleteQuotation : undefined
              }
              isLoading={isLoading}
              // Disable create ticket button if status is 'closed' or 'running'
              isCreateTicketDisabled={
                quotation.status === "closed" ||
                quotation.status === "running" ||
                quotations.status === "hold"
              }
              createTicketDisabledTooltip={
                quotation.status === "closed" || quotation.status === "running"
                  ? `Cannot create ticket for a quotation that is already ${quotation.status}.`
                  : "Create a new ticket from this quotation."
              }
            />
          )}
          noDataMessage="No quotations found."
          tableClassName="mt-3"
          theadClassName="table-dark"
        />

        <ReusableModal
          show={showModal}
          onHide={() => {
            setShowModal(false);
            setCurrentQuotation(null);
            resetForm();
          }}
          title={
            currentQuotation
              ? `Edit Quotation - ${quotationData.referenceNumber}`
              : `Create New Quotation - ${quotationData.referenceNumber}`
          }
          footerContent={
            <>
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
              <Button
                variant="primary"
                type="submit"
                form={quotationFormId}
                disabled={isLoading}
              >
                {isLoading
                  ? currentQuotation
                    ? "Updating..."
                    : "Saving..."
                  : currentQuotation
                  ? "Update Quotation"
                  : "Save Quotation"}
              </Button>
            </>
          }
        >
          <Form
            id={quotationFormId}
            noValidate
            validated={formValidated}
            onSubmit={handleSubmit}
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
              {new Date(quotationData.validityDate) <
                new Date(quotationData.date) && (
                <Alert variant="warning" className="mt-0 mb-2 p-2 small">
                  Warning: Validity date is before the issue date.
                </Alert>
              )}
              <Form.Group className="mb-3 col-md-4">
                <Form.Label>
                  Status <span className="text-danger">*</span>
                </Form.Label>
                {(currentQuotation &&
                  (currentQuotation.status === "running" ||
                    currentQuotation.status === "closed")) ||
                quotationData.status === "running" ||
                quotationData.status === "closed" ? (
                  <Form.Control
                    type="text"
                    value={
                      quotationData.status.charAt(0).toUpperCase() +
                      quotationData.status.slice(1)
                    }
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
              isEditing={true} // Always editing in this modal
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
          </Form>
        </ReusableModal>

        <CreateTicketModal
          show={showTicketModal}
          onHide={() => setShowTicketModal(false)}
          ticketData={ticketData}
          setTicketData={setTicketData}
          handleTicketSubmit={handleTicketSubmit}
          isLoading={isLoading}
          error={error}
        />

        <ReusableModal
          show={showPdfModal}
          onHide={() => setShowPdfModal(false)}
          title={`Quotation PDF - ${currentQuotation?.referenceNumber}`}
          footerContent={
            currentQuotation && (
              <div className="d-flex justify-content-center gap-2">
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
            )
          }
        >
          {currentQuotation && (
            <div
              className="flex-grow-1 d-flex flex-column overflow-hidden"
              style={{ height: "80vh" }}
            >
              {" "}
              {/* Adjust height as needed */}
              <PDFViewer className="flex-grow-1 w-100">
                <QuotationPDF quotation={currentQuotation} />
              </PDFViewer>
            </div>
          )}
        </ReusableModal>

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

        {filteredQuotations.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredQuotations.length}
            itemsPerPage={itemsPerPage}
            onPageChange={(page) => {
              const currentTotalPages = Math.ceil(
                filteredQuotations.length / itemsPerPage
              );
              if (page >= 1 && page <= currentTotalPages) setCurrentPage(page);
            }}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        )}
      </div>
      <QuotationReportModal
        show={showQuotationReportModal}
        onHide={() => setShowQuotationReportModal(false)}
      />
    </div>
  );
}
