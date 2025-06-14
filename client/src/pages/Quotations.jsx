// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/pages/Quotations.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Modal,
  Button,
  Form,
  Table,
  Alert,
  Spinner,
  OverlayTrigger,
  Tooltip,
} from "react-bootstrap";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import ClientSearchComponent from "../components/ClientSearchComponent.jsx";
import ItemSearchComponent from "../components/ItemSearch";
import QuotationPDF, { QuotationActions } from "../components/QuotationPDF";
import CreateTicketModal from "../components/CreateTicketModal.jsx";
import Pagination from "../components/Pagination";
import Footer from "../components/Footer";
import ReusableTable from "../components/ReusableTable.jsx";
import SearchBar from "../components/Searchbar.jsx";
import { getAuthToken as retrieveAuthToken } from "../utils/authUtils";
import ActionButtons from "../components/ActionButtons";
import { ToastContainer, toast } from "react-toastify";
import frontendLogger from "../utils/frontendLogger.js";
import "react-toastify/dist/ReactToastify.css";
import { PDFViewer } from "@react-pdf/renderer";
import {
  showToast,
  handleApiError,
  formatDateForInput as formatDateForInputHelper,
} from "../utils/helpers";
import apiClient from "../utils/apiClient";
import "../css/Style.css";
import "../css/Items.css";
import ReusableModal from "../components/ReusableModal.jsx";
import QuotationReportModal from "../components/QuotationReportModal.jsx";
import { FaChartBar, FaArchive } from "react-icons/fa";
import axios from "axios"; // For pincode API call
import QuotationSearchComponent from "../components/QuotationSearchComponent.jsx"; // Assuming this exists

const GoodsTable = ({
  goods,
  handleGoodsChange,
  isEditing,
  onAddItem,
  onDeleteItem,
  onAddSubtext,
  onDeleteSubtext,
  onItemSearchDropdownToggle,
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
            <th>
              HSN/SAC <span className="text-danger">*</span>
            </th>
            <th>
              Qty <span className="text-danger">*</span>
            </th>
            <th>
              Unit <span className="text-danger">*</span>
            </th>
            <th>
              Price <span className="text-danger">*</span>
            </th>
            <th>
              GST <span className="text-danger">*</span>
            </th>
            <th>Amount</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {goods.map((item, index) => (
            <tr key={index}>
              <td>{item.srNo}</td>
              <td style={{ minWidth: "250px" }}>
                {!isEditing ? (
                  <>
                    {item.description || ""}
                    {item.subtexts && item.subtexts.length > 0 && (
                      <div className="mt-1">
                        {item.subtexts.map((st, stIndex) => (
                          <em
                            key={stIndex}
                            className="d-block text-muted small"
                          >
                            - {st}
                          </em>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <Form.Control
                      required
                      type="text"
                      value={item.description || ""}
                      onChange={(e) =>
                        handleGoodsChange(index, "description", e.target.value)
                      }
                      placeholder="Item Description"
                    />
                    {item.subtexts &&
                      item.subtexts.map((subtext, subtextIndex) => (
                        <div key={subtextIndex} className="d-flex mt-1">
                          <Form.Control
                            type="text"
                            value={subtext}
                            onChange={(e) =>
                              handleGoodsChange(
                                index,
                                "subtexts",
                                e.target.value,
                                subtextIndex
                              )
                            }
                            placeholder={`Subtext ${subtextIndex + 1}`}
                            className="form-control-sm me-1"
                            style={{ fontStyle: "italic" }}
                          />
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => onDeleteSubtext(index, subtextIndex)}
                          >
                            &times;
                          </Button>
                        </div>
                      ))}
                    <Button
                      variant="outline-primary"
                      size="sm"
                      className="mt-1"
                      onClick={() => onAddSubtext(index)}
                    >
                      + Subtext
                    </Button>
                  </>
                )}
              </td>
              <td>
                {!isEditing ? (
                  item.hsnSacCode || ""
                ) : (
                  <Form.Control
                    required
                    type="text"
                    value={item.hsnSacCode || ""}
                    onChange={(e) =>
                      handleGoodsChange(index, "hsnSacCode", e.target.value)
                    }
                    placeholder="HSN/SAC"
                  />
                )}
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
                  />
                )}
              </td>
              <td>
                {!isEditing ? (
                  `${item.gstRate || 0}%`
                ) : (
                  <Form.Control
                    required
                    type="number"
                    min="0"
                    step="0.1" // Allow decimal GST rates
                    value={item.gstRate === null ? "" : item.gstRate} // Handle null for empty display
                    onChange={(e) =>
                      handleGoodsChange(index, "gstRate", e.target.value)
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
            onDropdownToggle={onItemSearchDropdownToggle}
          />
        </div>
      )}
    </div>
  );
};

export default function Quotations() {
  const [isReplicating, setIsReplicating] = useState(false);
  const [isLoadingReplicationDetails, setIsLoadingReplicationDetails] =
    useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [quotations, setQuotations] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentQuotation, setCurrentQuotation] = useState(null);
  const [formValidated, setFormValidated] = useState(false);
  const [quotationsCount, setQuotationsCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: "referenceNumber",
    direction: "descending",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [selectedClientIdForForm, setSelectedClientIdForForm] = useState(null);
  const { user, loading } = useAuth();
  const [isFetchingBillingAddress, setIsFetchingBillingAddress] =
    useState(false);
  const auth = useAuth();
  const [statusFilter, setStatusFilter] = useState("all");
  const navigate = useNavigate();
  const [showQuotationReportModal, setShowQuotationReportModal] =
    useState(false);
  const [sourceQuotationForTicket, setSourceQuotationForTicket] =
    useState(null); // To store the quotation being used to create a ticket
  const [isItemSearchDropdownOpenInModal, setIsItemSearchDropdownOpenInModal] =
    useState(false);
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

  const recalculateTotals = (goodsList) => {
    const totalQuantity = goodsList.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );
    const totalAmount = goodsList.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );
    // GST amount for quotation summary (can be different from ticket's final GST due to state rules)
    const gstAmount = goodsList.reduce(
      (sum, item) =>
        sum + Number(item.amount || 0) * (parseFloat(item.gstRate || 0) / 100),
      0
    );
    const grandTotal = totalAmount + gstAmount;
    return { totalQuantity, totalAmount, gstAmount, grandTotal };
  };

  const handleReplicationSelect = async (selectedQuotationStub) => {
    if (!selectedQuotationStub || !selectedQuotationStub._id) {
      toast.error("Invalid quotation selected for replication.");
      return;
    }
    setIsLoadingReplicationDetails(true);
    setError(null);
    try {
      const fullQuotation = await apiClient(
        `/quotations/${selectedQuotationStub._id}`
      );
      if (!fullQuotation || !fullQuotation.client || !fullQuotation.goods) {
        throw new Error("Incomplete quotation data received for replication.");
      }

      const replicatedGoods = fullQuotation.goods.map((item, index) => {
        const quantity = Number(item.quantity || 1);
        const price = Number(item.price || 0);
        return {
          description: item.description,
          hsnSacCode: item.hsnSacCode || "",
          quantity: quantity,
          unit: item.unit || "Nos",
          price: price,
          amount: quantity * price,
          originalPrice: Number(item.originalPrice || item.price),
          maxDiscountPercentage: item.maxDiscountPercentage
            ? Number(item.maxDiscountPercentage)
            : 0,
          srNo: index + 1,
          gstRate: parseFloat(item.gstRate || 0), // Ensure gstRate is a number
          subtexts: item.subtexts || [],
        };
      });

      const totals = recalculateTotals(replicatedGoods);

      setQuotationData((prevData) => ({
        ...prevData,
        client: {
          _id: fullQuotation.client._id,
          companyName: fullQuotation.client.companyName || "",
          gstNumber: fullQuotation.client.gstNumber || "",
          clientName: fullQuotation.client.clientName || "",
          email: fullQuotation.client.email || "",
          phone: fullQuotation.client.phone || "",
        },
        billingAddress:
          fullQuotation.billingAddress || initialQuotationData.billingAddress,
        goods: replicatedGoods,
        ...totals,
      }));
      setSelectedClientIdForForm(fullQuotation.client._id);
      setIsReplicating(false);
      toast.info("Quotation data replicated. Review and save as new.");
    } catch (err) {
      const errorMessage = handleApiError(
        err,
        "Failed to load quotation details for replication."
      );
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoadingReplicationDetails(false);
    }
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
    const clientName = quotationData.client.clientName?.trim();

    if (!companyName || !gstNumber || !email || !phone || !clientName) {
      const msg =
        "All client fields (Company Name, Client Name, GST Number, Email, Phone) are required and cannot be just whitespace.";
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
      companyName,
      gstNumber: gstNumber.toUpperCase(),
      clientName,
      phone,
      email,
    };
    try {
      const responseData = await apiClient("/clients", {
        method: "POST",
        body: clientPayload,
      });
      if (responseData && responseData._id) {
        setQuotationData((prev) => ({ ...prev, client: { ...responseData } }));
        setSelectedClientIdForForm(responseData._id);
        setError(null);
        toast.success("Client saved successfully!");
        if (auth.user) {
          frontendLogger.info(
            "clientActivity",
            "New client saved successfully",
            auth.user,
            {
              clientId: responseData._id,
              clientName: responseData.companyName,
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
        frontendLogger.error(
          "clientActivity",
          "Failed to save new client",
          auth.user,
          {
            clientPayload,
            errorMessage: error.data?.message || error.message,
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
    date: formatDateForInputHelper(new Date()),
    referenceNumber: generateQuotationNumber(),
    validityDate: formatDateForInputHelper(
      new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    ),
    orderIssuedBy: "",
    billingAddress: {
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
    status: "open",
    client: {
      _id: null,
      companyName: "",
      clientName: "",
      gstNumber: "",
      email: "",
      phone: "",
    },
  };

  const [quotationData, setQuotationData] = useState(initialQuotationData);
  const [ticketData, setTicketData] = useState({
    companyName: "",
    quotationNumber: "",
    billingAddress: ["", "", "", "", ""], // add1, add2, state, city, pincode
    shippingAddressObj: {
      address1: "",
      address2: "",
      city: "",
      state: "",
      pincode: "",
    },
    shippingSameAsBilling: false,
    goods: [],
    totalQuantity: 0,
    totalAmount: 0, // Pre-GST total
    // New GST fields for CreateTicketModal
    gstBreakdown: [],
    totalCgstAmount: 0,
    totalSgstAmount: 0,
    totalIgstAmount: 0,
    finalGstAmount: 0, // This will be the sum of CGST+SGST or IGST
    grandTotal: 0, // This will be totalAmount + finalGstAmount
    isBillingStateSameAsCompany: false, // Determined in CreateTicketModal
    status: "Quotation Sent",
    clientPhone: "",
    clientGstNumber: "",
  });

  const fetchQuotations = useCallback(async () => {
    if (loading || !user) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      const endpoint = `/quotations${
        params.toString() ? `?${params.toString()}` : ""
      }`;
      const data = await apiClient(endpoint);
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
      if (auth.user) {
        frontendLogger.error(
          "quotationActivity",
          "Failed to fetch quotations",
          auth.user,
          {
            errorMessage: error.response?.data?.message || error.message,
            statusFilter,
            action: "FETCH_QUOTATIONS_FAILURE",
          }
        );
      }
      if (error.status === 401) {
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
      const valA = sortConfig.key.includes(".")
        ? sortConfig.key.split(".").reduce((o, i) => o?.[i], a)
        : a[sortConfig.key];
      const valB = sortConfig.key.includes(".")
        ? sortConfig.key.split(".").reduce((o, i) => o?.[i], b)
        : b[sortConfig.key];
      if (valA < valB) return sortConfig.direction === "ascending" ? -1 : 1;
      if (valA > valB) return sortConfig.direction === "ascending" ? 1 : -1;
      return 0;
    });
  }, [quotations, sortConfig]);

  const filteredQuotations = useMemo(() => {
    let filtered = sortedQuotations;
    if (statusFilter !== "all")
      filtered = filtered.filter(
        (quotation) => quotation.status === statusFilter
      );
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (q) =>
          q.referenceNumber?.toLowerCase().includes(term) ||
          q.client?.companyName?.toLowerCase().includes(term) ||
          q.client?.gstNumber?.toLowerCase().includes(term) ||
          q.goods.some(
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
    if (sortConfig.key === key && sortConfig.direction === "descending")
      direction = "ascending";
    setSortConfig({ key, direction });
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
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
        price: parseFloat(item.sellingPrice) || 0,
        amount: parseFloat(item.sellingPrice) || 0,
        originalPrice: parseFloat(item.sellingPrice) || 0,
        maxDiscountPercentage: parseFloat(item.maxDiscountPercentage) || 0,
        gstRate: parseFloat(item.gstRate) || 0, // Ensure gstRate is a number
        subtexts: [],
      },
    ];
    const totals = recalculateTotals(newGoods);
    setQuotationData({ ...quotationData, goods: newGoods, ...totals });
    setError(null);
  };

  const handleGoodsChange = (index, field, value, subtextIndex = null) => {
    const updatedGoods = [...quotationData.goods];
    let priceValidationError = null;

    if (field === "subtexts" && subtextIndex !== null) {
      if (!updatedGoods[index].subtexts) updatedGoods[index].subtexts = [];
      updatedGoods[index].subtexts[subtextIndex] = value;
    } else if (field === "gstRate") {
      updatedGoods[index][field] = value === "" ? null : parseFloat(value); // Allow empty string for null, parse others
    } else {
      if (["quantity", "price", "amount"].includes(field))
        value = Number(value);
      updatedGoods[index][field] = value;
    }

    if (field === "quantity" || field === "price") {
      updatedGoods[index].amount =
        (updatedGoods[index].quantity || 0) * (updatedGoods[index].price || 0);
    }

    if (field === "price") {
      const currentItem = updatedGoods[index];
      const newPrice = parseFloat(value);
      const originalPrice = parseFloat(currentItem.originalPrice);
      const maxDiscountPerc = parseFloat(currentItem.maxDiscountPercentage);
      if (!isNaN(newPrice) && !isNaN(originalPrice)) {
        if (!isNaN(maxDiscountPerc) && maxDiscountPerc > 0) {
          const minAllowedPrice = originalPrice * (1 - maxDiscountPerc / 100);
          if (newPrice < minAllowedPrice)
            priceValidationError = `Discount for ${
              currentItem.description
            } exceeds ${maxDiscountPerc}%. Min price ₹${minAllowedPrice.toFixed(
              2
            )}.`;
        } else {
          if (newPrice < originalPrice)
            priceValidationError = `Price for ${
              currentItem.description
            } (₹${newPrice.toFixed(2)}) < original (₹${originalPrice.toFixed(
              2
            )}) with no discount.`;
        }
      } else if (String(value).trim() !== "" && isNaN(newPrice)) {
        priceValidationError = `Invalid price for ${currentItem.description}.`;
      }
    }
    updatedGoods.forEach((item) => {
      if (!item.unit) item.unit = "Nos";
    });
    const totals = recalculateTotals(updatedGoods);
    setQuotationData({ ...quotationData, goods: updatedGoods, ...totals });
    if (priceValidationError) {
      setError(priceValidationError);
      toast.warn(priceValidationError);
    } else if (
      error &&
      (error.includes(`Discount for ${updatedGoods[index].description}`) ||
        error.includes(`Price for ${updatedGoods[index].description}`))
    ) {
      setError(null);
    }
  };

  const fetchBillingAddressFromPincode = async (pincode) => {
    if (!pincode || pincode.length !== 6) return;
    setIsFetchingBillingAddress(true);
    try {
      const response = await axios.get(
        `https://api.postalpincode.in/pincode/${pincode}`
      );
      const data = response.data[0];
      if (data.Status === "Success") {
        const postOffice = data.PostOffice[0];
        setQuotationData((prev) => ({
          ...prev,
          billingAddress: {
            ...prev.billingAddress,
            city: postOffice.District,
            state: postOffice.State,
          },
        }));
        toast.success(`City and State auto-filled for pincode ${pincode}.`);
      } else {
        toast.warn(
          `Could not find details for pincode ${pincode}. Please enter manually.`
        );
      }
    } catch (error) {
      console.error("Error fetching billing address from pincode:", error);
      toast.error("Error fetching address details. Please enter manually.");
    } finally {
      setIsFetchingBillingAddress(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("client.")) {
      const clientField = name.split(".")[1];
      let processedValue = value;
      if (clientField === "gstNumber") processedValue = value.toUpperCase();
      else if (clientField === "email") processedValue = value.toLowerCase();
      setQuotationData((prev) => ({
        ...prev,
        client: { ...prev.client, [clientField]: processedValue },
      }));
    } else if (name.startsWith("billingAddress.")) {
      const addressField = name.split(".")[1];
      setQuotationData((prev) => ({
        ...prev,
        billingAddress: { ...prev.billingAddress, [addressField]: value },
      }));
      if (addressField === "pincode" && value.length === 6) {
        setTimeout(() => fetchBillingAddressFromPincode(value), 0);
      }
    } else {
      setQuotationData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleDeleteItem = (indexToDelete) => {
    const updatedGoods = quotationData.goods
      .filter((_, index) => index !== indexToDelete)
      .map((item, index) => ({ ...item, srNo: index + 1 }));
    const totals = recalculateTotals(updatedGoods);
    setQuotationData((prevData) => ({
      ...prevData,
      goods: updatedGoods,
      ...totals,
    }));
  };

  const handleAddSubtext = (itemIndex) => {
    const updatedGoods = [...quotationData.goods];
    if (!updatedGoods[itemIndex].subtexts)
      updatedGoods[itemIndex].subtexts = [];
    updatedGoods[itemIndex].subtexts.push("");
    setQuotationData((prevData) => ({ ...prevData, goods: updatedGoods }));
  };

  const handleDeleteSubtext = (itemIndex, subtextIndexToDelete) => {
    const updatedGoods = [...quotationData.goods];
    updatedGoods[itemIndex].subtexts.splice(subtextIndexToDelete, 1);
    setQuotationData((prevData) => ({ ...prevData, goods: updatedGoods }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormValidated(true);
    const form = event.currentTarget;
    if (form.checkValidity() === false) {
      event.stopPropagation();
      setError("Please fill in all required fields.");
      toast.error("Please fill in all required fields.");
      return;
    }
    if (!quotationData.client._id) {
      if (
        quotationData.client.companyName ||
        quotationData.client.gstNumber ||
        quotationData.client.email ||
        quotationData.client.phone
      ) {
        setError("Save new client details first.");
        toast.warn("Save new client details first.");
      } else {
        setError("Select or save client details.");
        toast.warn("Select or save client details.");
      }
      return;
    }
    if (!quotationData.goods || quotationData.goods.length === 0) {
      setError("Add at least one item.");
      toast.error("Add at least one item.");
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
        const itemErrorMsg = `Item ${i + 1} incomplete.`;
        setError(itemErrorMsg);
        toast.error(itemErrorMsg);
        return;
      }
      if (item.maxDiscountPercentage > 0) {
        const minAllowedPrice =
          item.originalPrice * (1 - (item.maxDiscountPercentage || 0) / 100);
        if (parseFloat(item.price) < minAllowedPrice) {
          const priceErrorMsg = `Warning: Price for ${item.description} (₹${parseFloat(item.price).toFixed(2)}) is below the minimum allowed (₹${minAllowedPrice.toFixed(2)}) due to discount limit of ${item.maxDiscountPercentage}%. You can still save.`;
          setError(priceErrorMsg);
          toast.warn(priceErrorMsg); // Changed to warn as it's not blocking
          // Removed return; to allow submission
        }
      }
    }

    setIsLoading(true);
    setError(null);
    const submissionData = {
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
        gstRate: item.gstRate === null ? 0 : parseFloat(item.gstRate || 0), // Ensure number, default 0 if null/undefined
        subtexts: item.subtexts || [],
      })),
      totalQuantity: Number(quotationData.totalQuantity),
      totalAmount: Number(quotationData.totalAmount),
      gstAmount: Number(quotationData.gstAmount),
      grandTotal: Number(quotationData.grandTotal),
      status: quotationData.status || "open",
      client: quotationData.client,
      billingAddress: quotationData.billingAddress,
    };
    try {
      const url = currentQuotation
        ? `/quotations/${currentQuotation._id}`
        : "/quotations";
      const method = currentQuotation ? "put" : "post";
      const responseData = await apiClient(url, {
        method,
        body: submissionData,
      });
      if (responseData) {
        fetchQuotations();
        setShowModal(false);
        resetForm();
        setCurrentQuotation(null);
        toast.success(
          `Quotation ${submissionData.referenceNumber} ${
            currentQuotation ? "updated" : "created"
          }!`
        );
        if (auth.user) {
          frontendLogger.info(
            "quotationActivity",
            `Quotation ${submissionData.referenceNumber} ${
              currentQuotation ? "updated" : "created"
            }`,
            auth.user,
            {
              quotationId: responseData._id,
              action: currentQuotation
                ? "UPDATE_QUOTATION_SUCCESS"
                : "CREATE_QUOTATION_SUCCESS",
            }
          );
        }
      }
    } catch (error) {
      const errorMessage = handleApiError(
        error,
        "Failed to save quotation.",
        auth.user,
        "quotationActivity"
      );
      if (error.status === 401) {
        navigate("/login", { state: { from: "/quotations" } });
        return;
      }
      setError(errorMessage);
      toast.error(errorMessage);
      if (auth.user) {
        frontendLogger.error(
          "quotationActivity",
          currentQuotation ? "Failed to update" : "Failed to create",
          auth.user,
          {
            referenceNumber: quotationData.referenceNumber,
            quotationId: currentQuotation?._id,
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

  const updateLinkedTickets = async (quotation) => {
    await Ticket.updateMany(
      { quotationNumber: quotation.referenceNumber },
      {
        $set: {
          companyName: quotation.client.companyName,
          goods: quotation.goods,
          billingAddress: quotation.billingAddress,
          clientPhone: quotation.client.phone,
          clientGstNumber: quotation.client.gstNumber,
        },
      }
    );
  };

  const resetForm = () => {
    setQuotationData(initialQuotationData);
    setFormValidated(false);
    setSelectedClientIdForForm(null);
    setError(null);
    setIsReplicating(false);
  };

  const generateTicketNumber = async () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `EKORS/${year}${month}${day}${hours}${minutes}${seconds}`;
  };

  const handleCreateTicket = async (quotation) => {
    setSourceQuotationForTicket(quotation); // Store the source quotation

    const ticketNumber = await generateTicketNumber();
    const quotationBillingAddressObject = quotation.billingAddress || {};
    const ticketBillingAddressArrayFromQuotation = [
      quotationBillingAddressObject.address1 || "",
      quotationBillingAddressObject.address2 || "",
      quotationBillingAddressObject.state || "",
      quotationBillingAddressObject.city || "",
      quotationBillingAddressObject.pincode || "",
    ];

    const clientData = quotation.client || {};
    setTicketData({
      ticketNumber,
      companyName: quotation.client?.companyName || "",
      quotationNumber: quotation.referenceNumber,
      billingAddress: ticketBillingAddressArrayFromQuotation,
      shippingAddressObj: {
        address1: "",
        address2: "",
        city: "",
        state: "",
        pincode: "",
      }, // Reset for modal
      shippingSameAsBilling: false, // Reset for modal
      goods: quotation.goods.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        price: Number(item.price),
        amount: Number(item.amount),
        gstRate: parseFloat(item.gstRate || 0), // Ensure gstRate is a number
        subtexts: item.subtexts || [],
      })),
      clientPhone: clientData.phone || "",
      clientGstNumber: clientData.gstNumber || "",
      totalQuantity: Number(quotation.totalQuantity),
      totalAmount: Number(quotation.totalAmount), // This is pre-GST total
      // Ensure all potentially required fields for a Ticket are present
      dispatchDays: quotation.dispatchDays || "7-10 working days", // Default if not on quotation
      validityDate: quotation.validityDate
        ? new Date(quotation.validityDate).toISOString()
        : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // Default or from quotation
      termsAndConditions:
        quotation.termsAndConditions ||
        "1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged if payment is not made within the stipulated time.\n3. Subject to Noida jurisdiction.", // Default if not on quotation
      // Initialize new GST fields for CreateTicketModal
      gstBreakdown: [],
      totalCgstAmount: 0,
      totalSgstAmount: 0,
      totalIgstAmount: 0,
      finalGstAmount: 0,
      grandTotal: 0, // Will be calculated by CreateTicketModal
      isBillingStateSameAsCompany: false, // Will be calculated by CreateTicketModal
      status: "Quotation Sent",
      clientPhone: quotation.client?.phone || "",
      clientGstNumber: quotation.client?.gstNumber || "",
    });
    setShowTicketModal(true);
  };

  const checkExistingTicket = async (quotationNumber) => {
    try {
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
            errorMessage: error.data?.message || error.message,
            action: "CHECK_EXISTING_TICKET_FAILURE",
          }
        );
      }
      return false;
    }
  };

  const handleTicketSubmit = async (event) => {
    // This function is passed to CreateTicketModal
    event.preventDefault();
    // Validation should happen inside CreateTicketModal or be passed if complex
    // For now, assume ticketData is validated and ready from CreateTicketModal's perspective
    setIsLoading(true);
    setError(null);
    let completeTicketData = {};
    try {
      const ticketExists = await checkExistingTicket(
        ticketData.quotationNumber
      );
      if (ticketExists) {
        setError("A ticket already exists for this quotation.");
        toast.warn("A ticket already exists for this quotation.");
        setIsLoading(false);
        return;
      }
      if (!auth.user || !auth.user.id) {
        const noUserIdError = "User ID not found. Please re-login.";
        setError(noUserIdError);
        toast.error(noUserIdError);
        throw new Error(noUserIdError);
      }

      // shippingAddress (array) is now constructed in backend based on shippingAddressObj and shippingSameAsBilling
      completeTicketData = {
        newTicketDetails: {
          // Encapsulate new ticket data
          ...ticketData, // This includes all new GST fields calculated by CreateTicketModal
          createdBy: auth.user.id,
          currentAssignee: auth.user.id,
          statusHistory: [
            {
              status: ticketData.status,
              changedAt: new Date(),
              changedBy: auth.user.id,
            },
          ],
          // shippingAddressObj and shippingSameAsBilling are sent; backend resolves shippingAddress array
          documents: {
            quotation: null,
            po: null,
            pi: null,
            challan: null,
            packingList: null,
            feedback: null,
            other: [],
          },
        },
        sourceQuotationData: sourceQuotationForTicket, // Send the source quotation data
      };
      // Clear the stored source quotation after use
      setSourceQuotationForTicket(null);

      console.log(
        "Data being sent to backend (completeTicketData.newTicketDetails):",
        JSON.stringify(completeTicketData.newTicketDetails, null, 2)
      );

      const responseData = await apiClient("/tickets", {
        method: "POST",
        body: completeTicketData,
      });
      if (responseData) {
        setShowTicketModal(false);
        setError(null);
        toast.success(
          `Ticket ${responseData.ticketNumber} created successfully!`
        );
        if (auth.user) {
          frontendLogger.info(
            "ticketActivity",
            `Ticket ${responseData.ticketNumber} created from quotation ${ticketData.quotationNumber}`,
            auth.user,
            {
              action: "TICKET_CREATED_FROM_QUOTATION_SUCCESS",
              ticketNumber: responseData.ticketNumber,
              quotationNumber: ticketData.quotationNumber,
            }
          );
        }
        fetchQuotations(); // Refresh quotations list (e.g., to update status or ticket link)
      }
    } catch (error) {
      const errorMessage = handleApiError(
        error,
        "Failed to create ticket.",
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
            ticketDataSubmitted: completeTicketData,
            action: "CREATE_TICKET_FROM_QUOTATION_FAILURE",
          }
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = async (quotation) => {
    setCurrentQuotation(quotation);
    let orderIssuedByIdToSet =
      quotation.orderIssuedBy?._id ||
      quotation.orderIssuedBy ||
      quotation.user?._id ||
      quotation.user ||
      user?.id;
    if (
      typeof orderIssuedByIdToSet === "object" &&
      orderIssuedByIdToSet !== null
    )
      orderIssuedByIdToSet = orderIssuedByIdToSet._id;

    setQuotationData({
      date: formatDateForInputHelper(quotation.date),
      referenceNumber: quotation.referenceNumber,
      validityDate: formatDateForInputHelper(quotation.validityDate),
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
        gstRate: parseFloat(item.gstRate || 0), // Ensure gstRate is a number
        subtexts: item.subtexts || [],
      })),
      totalQuantity: Number(quotation.totalQuantity),
      totalAmount: Number(quotation.totalAmount),
      gstAmount: Number(quotation.gstAmount),
      grandTotal: Number(quotation.grandTotal),
      billingAddress:
        quotation.billingAddress || initialQuotationData.billingAddress,
      status: quotation.status || "open",
      client: {
        companyName: quotation.client?.companyName || "",
        gstNumber: quotation.client?.gstNumber || "",
        clientName: quotation.client?.clientName || "",
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
      setError("User data not available.");
      toast.error("User data not available.");
      return;
    }
    setCurrentQuotation(null);
    setQuotationData({
      ...initialQuotationData,
      date: formatDateForInputHelper(new Date()),
      referenceNumber: generateQuotationNumber(),
      orderIssuedBy: user.id,
      client: { ...initialQuotationData.client, _id: null },
      billingAddress: { ...initialQuotationData.billingAddress },
    });
    setSelectedClientIdForForm(null);
    setIsReplicating(false);
    setFormValidated(false);
    setShowModal(true);
  };

  const handleDeleteQuotation = async (quotation) => {
    if (!quotation || !quotation._id) {
      setError("Invalid quotation.");
      toast.error("Invalid quotation.");
      return;
    }
    if (!window.confirm(`Delete quotation ${quotation.referenceNumber}?`))
      return;
    setIsLoading(true);
    setError(null);
    try {
      await apiClient(`/quotations/${quotation._id}`, { method: "DELETE" });
      setError(null);
      setCurrentQuotation(null);
      setShowModal(false);
      resetForm();
      fetchQuotations();
      toast.success(`Quotation ${quotation.referenceNumber} deleted.`);
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
        "Failed to delete quotation.",
        auth.user,
        "quotationActivity"
      );
      if (error.status === 401) {
        navigate("/login", { state: { from: "/quotations" } });
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
        clientName: client.clientName || "",
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
              className="flex-grow-1"
            />
            <div className="d-flex align-items-center gap-2">
              {["all", "open", "running", "closed", "hold"].map((s) => (
                <Form.Check
                  inline
                  key={s}
                  label={s.charAt(0).toUpperCase() + s.slice(1)}
                  name="statusFilter"
                  type="radio"
                  id={`status-${s}`}
                  checked={statusFilter === s}
                  onChange={() => {
                    setStatusFilter(s);
                    setCurrentPage(1);
                  }}
                />
              ))}
            </div>
            <Button variant="primary" onClick={openCreateModal}>
              ➕ Quotation
            </Button>
            {(user?.role === "admin" || user?.role === "super-admin") && (
              <Button
                variant="info"
                onClick={() => setShowQuotationReportModal(true)}
                disabled={isLoading}
              >
                <FaChartBar className="me-1" /> Report
              </Button>
            )}
          </div>
        </div>

        {error && !isLoading && <Alert variant="danger">{error}</Alert>}
        {isLoading && (
          <div className="text-center my-3">
            <Spinner animation="border" /> <p>Loading quotations...</p>
          </div>
        )}

        <ReusableTable
          columns={[
            {
              key: "referenceNumber",
              header: "Reference No",
              sortable: true,
              tooltip: "yymmdd-hhmmss",
            },
            {
              key: "client.companyName",
              header: "Company Name",
              sortable: true,
              renderCell: (item) => item.client?.companyName,
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
                  },
                ]
              : []),
            {
              key: "validityDate",
              header: "Validity Date",
              sortable: true,
              renderCell: (item) => formatDateForInputHelper(item.validityDate),
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
                      : "bg-warning"
                  }`}
                >
                  {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                </span>
              ),
              tooltip: "Current status (Open, Running, Hold, Closed).",
            },
          ]}
          data={currentItems}
          keyField="_id"
          isLoading={isLoading}
          error={
            error && currentItems.length === 0 && !isLoading ? error : null
          }
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
              }
              onView={() => {
                setCurrentQuotation(quotation);
                setShowPdfModal(true);
              }}
              onDelete={
                user?.role === "super-admin" ? handleDeleteQuotation : undefined
              }
              isLoading={isLoading}
              isCreateTicketDisabled={
                quotation.status === "closed" ||
                quotation.status === "running" ||
                quotation.status === "hold"
              }
              editTooltipText={`Edit Quotation ${quotation.referenceNumber}`}
              createTicketTooltipText={`Create Ticket from Quotation ${quotation.referenceNumber}`}
              createTicketDisabledTooltip={
                quotation.status === "closed" ||
                quotation.status === "running" ||
                quotation.status === "hold"
                  ? `Cannot create ticket. Quotation is ${quotation.status}.`
                  : `Create Ticket from Quotation ${quotation.referenceNumber}`
              }
              viewTooltipText={`View PDF for Quotation ${quotation.referenceNumber}`}
              deleteTooltipText={
                user?.role === "super-admin"
                  ? `Delete Quotation ${quotation.referenceNumber}`
                  : "Delete (disabled)"
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
                disabled={isLoading || isLoadingReplicationDetails}
              >
                Close
              </Button>
              <Button
                variant="primary"
                type="submit"
                form={quotationFormId}
                disabled={isLoading || isLoadingReplicationDetails}
              >
                {isLoading || isLoadingReplicationDetails
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
            {!currentQuotation && (
              <>
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Replicate Existing Quotation?"
                    checked={isReplicating}
                    onChange={(e) => setIsReplicating(e.target.checked)}
                  />
                </Form.Group>
                {isReplicating && !isLoadingReplicationDetails && (
                  <QuotationSearchComponent
                    onQuotationSelect={handleReplicationSelect}
                    placeholder="Search quotation to replicate..."
                  />
                )}
                {isLoadingReplicationDetails && (
                  <div className="text-center my-3">
                    <Spinner animation="border" />{" "}
                    <p>Loading quotation details...</p>
                  </div>
                )}
              </>
            )}
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
                  disabled={isLoadingReplicationDetails}
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
                  disabled={isLoadingReplicationDetails}
                />
              </Form.Group>
              {new Date(quotationData.validityDate) <
                new Date(quotationData.date) && (
                <Alert variant="warning" className="mt-0 mb-2 p-2 small">
                  Warning: Validity date is before issue date.
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
                    disabled={isLoadingReplicationDetails}
                  />
                ) : (
                  <Form.Select
                    required
                    name="status"
                    value={quotationData.status}
                    onChange={handleInputChange}
                    disabled={isLoadingReplicationDetails}
                  >
                    <option value="open">Open</option>
                    <option value="hold">Hold</option>
                  </Form.Select>
                )}
              </Form.Group>
            </div>

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
              Client Details
            </h5>
            <div className="row mb-3">
              <div className="col-12">
                <ClientSearchComponent
                  onClientSelect={handleClientSelect}
                  placeholder="Search & select client"
                  currentClientId={selectedClientIdForForm}
                  disabled={isLoadingReplicationDetails}
                />
              </div>
            </div>
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
                  disabled={isLoadingReplicationDetails}
                />
              </Form.Group>
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>
                  Client Name (Contact Person){" "}
                  <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  required
                  type="text"
                  name="client.clientName"
                  value={quotationData.client.clientName || ""}
                  onChange={
                    !selectedClientIdForForm ? handleInputChange : undefined
                  }
                  readOnly={!!selectedClientIdForForm}
                  disabled={isLoadingReplicationDetails}
                  placeholder="Enter contact person's name"
                />
              </Form.Group>
            </div>
            <div className="row">
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
                  disabled={isLoadingReplicationDetails}
                />
              </Form.Group>
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
                  disabled={isLoadingReplicationDetails}
                />
              </Form.Group>
            </div>
            <div className="row mb-3 align-items-end">
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
                  disabled={isLoadingReplicationDetails}
                />
              </Form.Group>
              <div className="col-md-6 d-flex gap-2 justify-content-start justify-content-md-end align-items-center mb-3">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedClientIdForForm(null);
                    setQuotationData((prev) => ({
                      ...prev,
                      client: { ...initialQuotationData.client, _id: null },
                    }));
                  }}
                  disabled={
                    isLoadingReplicationDetails || !selectedClientIdForForm
                  }
                >
                  Clear/Edit Client
                </Button>
                <Button
                  variant="success"
                  size="sm"
                  onClick={handleSaveClientDetails}
                  disabled={
                    isSavingClient ||
                    isLoadingReplicationDetails ||
                    !!selectedClientIdForForm ||
                    !(
                      quotationData.client.companyName &&
                      quotationData.client.gstNumber &&
                      quotationData.client.clientName &&
                      quotationData.client.phone
                    )
                  }
                >
                  {isSavingClient ? "Saving..." : "Save New Client"}
                </Button>
              </div>
            </div>
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
              Billing Address
            </h5>
            <div className="row">
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>
                  Address Line 1 <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  required
                  type="text"
                  name="billingAddress.address1"
                  value={quotationData.billingAddress.address1}
                  onChange={handleInputChange}
                  disabled={
                    isLoadingReplicationDetails || isFetchingBillingAddress
                  }
                />
              </Form.Group>
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>Address Line 2</Form.Label>
                <Form.Control
                  type="text"
                  name="billingAddress.address2"
                  value={quotationData.billingAddress.address2}
                  onChange={handleInputChange}
                  disabled={
                    isLoadingReplicationDetails || isFetchingBillingAddress
                  }
                />
              </Form.Group>
            </div>
            <div className="row">
              <Form.Group className="mb-3 col-md-4">
                <Form.Label>
                  Pincode <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  required
                  type="text"
                  name="billingAddress.pincode"
                  value={quotationData.billingAddress.pincode}
                  pattern="[0-9]{6}"
                  onChange={handleInputChange}
                  disabled={
                    isLoadingReplicationDetails || isFetchingBillingAddress
                  }
                />
                <Form.Text className="text-muted">
                  6-digit pincode for City & State.
                </Form.Text>
              </Form.Group>
              <Form.Group className="mb-3 col-md-4">
                <Form.Label>
                  City <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  required
                  type="text"
                  name="billingAddress.city"
                  value={quotationData.billingAddress.city}
                  onChange={handleInputChange}
                  disabled={
                    isLoadingReplicationDetails || isFetchingBillingAddress
                  }
                  readOnly={
                    !(
                      isLoadingReplicationDetails || isFetchingBillingAddress
                    ) && !!quotationData.billingAddress.city
                  }
                />
              </Form.Group>
              <Form.Group className="mb-3 col-md-4">
                <Form.Label>
                  State <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  required
                  type="text"
                  name="billingAddress.state"
                  value={quotationData.billingAddress.state}
                  onChange={handleInputChange}
                  disabled={
                    isLoadingReplicationDetails || isFetchingBillingAddress
                  }
                  readOnly={
                    !(
                      isLoadingReplicationDetails || isFetchingBillingAddress
                    ) && !!quotationData.billingAddress.state
                  }
                />
              </Form.Group>
            </div>

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
              Goods Details
            </h5>
            <GoodsTable
              goods={quotationData.goods}
              handleGoodsChange={handleGoodsChange}
              isEditing={true}
              onAddItem={handleAddItem}
              onDeleteItem={handleDeleteItem}
              onAddSubtext={handleAddSubtext}
              onDeleteSubtext={handleDeleteSubtext}
              onItemSearchDropdownToggle={setIsItemSearchDropdownOpenInModal}
            />
            {isItemSearchDropdownOpenInModal && (
              <div style={{ height: "300px" }}></div>
            )}
            <div className="bg-light p-3 rounded mt-3">
              <h5 className="text-center mb-3">Quotation Summary</h5>
              <Table bordered size="sm">
                <tbody>
                  <tr>
                    <td>Total Quantity</td>
                    <td className="text-end">
                      <strong>{quotationData.totalQuantity}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Total Amount (Subtotal)</td>
                    <td className="text-end">
                      <strong>₹{quotationData.totalAmount.toFixed(2)}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Total GST</td>
                    <td className="text-end">
                      <strong>₹{quotationData.gstAmount.toFixed(2)}</strong>
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
                      <strong>₹{quotationData.grandTotal.toFixed(2)}</strong>
                    </td>
                  </tr>
                </tbody>
              </Table>
            </div>
          </Form>
        </ReusableModal>

        <CreateTicketModal
          show={showTicketModal}
          onHide={() => setShowTicketModal(false)}
          ticketData={ticketData}
          setTicketData={setTicketData} // Pass setTicketData for CreateTicketModal to update it
          handleTicketSubmit={handleTicketSubmit} // Pass the submit handler
          isLoading={isLoading} // Pass loading state for disabling buttons
          error={error} // Pass error state for displaying errors
        />

        <ReusableModal
          show={showPdfModal}
          onHide={() => setShowPdfModal(false)}
          title={`Quotation - ${currentQuotation?.referenceNumber}`}
          footerContent={
            currentQuotation && (
              <QuotationActions quotation={currentQuotation} />
            )
          }
        >
          {currentQuotation && (
            <div
              className="flex-grow-1 d-flex flex-column overflow-hidden"
              style={{ height: "80vh" }}
            >
              <PDFViewer className="flex-grow-1 w-100">
                <QuotationPDF quotation={currentQuotation} />
              </PDFViewer>
            </div>
          )}
        </ReusableModal>
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
      <Footer />
      <ToastContainer position="bottom-right" autoClose={3000} />
    </div>
  );
}
