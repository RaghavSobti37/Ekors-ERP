// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/pages/EditTicketPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Form, Button as BsButton, Alert, Spinner, Row, Col, Table, Badge, Card, ProgressBar } from "react-bootstrap";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import ReusablePageStructure from "../../components/ReusablePageStructure.jsx"; // Ensure this path is correct
import ItemSearchComponent from "../../components/ItemSearch.jsx"; // Ensure this path is correct
import { useAuth } from "../../context/AuthContext.jsx";
import apiClient from "../../utils/apiClient";
import { handleApiError, formatDateForInput, generateNextTicketNumber } from "../../utils/helpers"; // Import generateNextTicketNumber
import { calculateItemPriceAndQuantity } from "../../utils/unitConversion.js";
import axios from "axios"; // For pincode API
import { getInitialTicketPayload, recalculateTicketTotals, mapQuotationToTicketPayload } from "../../utils/payloads";

const COMPANY_REFERENCE_STATE = "UTTAR PRADESH";
const statusStages = ["Quotation Sent", "PO Received", "Payment Pending", "Inspection", "Packing List", "Invoice Sent", "Hold", "Closed"];


const EditTicketPage = () => {
  const { id: ticketIdFromParams } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();

  const initialTicketData = getInitialTicketPayload(); // Use getInitialTicketPayload for initial state

  const [ticketData, setTicketData] = useState(location.state?.ticketDataForForm || initialTicketData);
  const [originalStatus, setOriginalStatus] = useState("");
  const [statusChangeComment, setStatusChangeComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
    const [roundedGrandTotal, setRoundedGrandTotal] = useState(null);
  const [roundOffAmount, setRoundOffAmount] = useState(0);

  const [error, setError] = useState(null);
  const [isItemSearchDropdownOpen, setIsItemSearchDropdownOpen] = useState(false);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [formValidated, setFormValidated] = useState(false);
  const [isFetchingQuotation, setIsFetchingQuotation] = useState(false);

// Modify the fetchTicketDetails function to better handle address formats
const fetchTicketDetails = useCallback(async () => {
  if (!ticketIdFromParams) return;
  setIsLoading(true);
  try {
    const data = await apiClient(`/tickets/${ticketIdFromParams}`, {
      params: { populate: "client,currentAssignee,createdBy,transferHistory.from,transferHistory.to,transferHistory.transferredBy,statusHistory.changedBy,documents.quotation.uploadedBy,documents.po.uploadedBy,documents.pi.uploadedBy,documents.challan.uploadedBy,documents.packingList.uploadedBy,documents.feedback.uploadedBy,documents.other.uploadedBy" },
    });

    // Enhanced address handling - ensure addresses are always objects with expected properties
    let billingAddressObj = initialTicketData.billingAddress;
    if (data.billingAddress) {
      if (Array.isArray(data.billingAddress)) {
        // Handle legacy array format if it exists
        billingAddressObj = {
          address1: data.billingAddress[0] || "",
          address2: data.billingAddress[1] || "",
          state: data.billingAddress[2] || "",
          city: data.billingAddress[3] || "",
          pincode: data.billingAddress[4] || "",
        };
      } else if (typeof data.billingAddress === 'object') {
        // Handle object format (current schema)
        billingAddressObj = {
          address1: data.billingAddress.address1 || "",
          address2: data.billingAddress.address2 || "",
          city: data.billingAddress.city || "",
          state: data.billingAddress.state || "",
          pincode: data.billingAddress.pincode || "",
        };
      }
    }

    let shippingAddressObj = initialTicketData.shippingAddress;
    if (data.shippingAddress) {
      if (Array.isArray(data.shippingAddress)) {
        // Handle legacy array format if it exists
        shippingAddressObj = {
          address1: data.shippingAddress[0] || "",
          address2: data.shippingAddress[1] || "",
          state: data.shippingAddress[2] || "",
          city: data.shippingAddress[3] || "",
          pincode: data.shippingAddress[4] || "",
        };
      } else if (typeof data.shippingAddress === 'object') {
        // Handle object format (current schema)
        shippingAddressObj = {
          address1: data.shippingAddress.address1 || "",
          address2: data.shippingAddress.address2 || "",
          city: data.shippingAddress.city || "",
          state: data.shippingAddress.state || "",
          pincode: data.shippingAddress.pincode || "",
        };
      }
    }
    
    // If shippingSameAsBilling is true but no shipping address, use billing address
    if (data.shippingSameAsBilling && (!data.shippingAddress || Object.values(shippingAddressObj).every(v => !v))) {
      shippingAddressObj = { ...billingAddressObj };
    }

    setTicketData({
      ...initialTicketData,
      ...data,
      billingAddress: billingAddressObj,
      shippingAddress: shippingAddressObj,
      goods: (data.goods || []).map(g => ({
        ...g,
        hsnCode: g.hsnCode || "", // Defensive: always set hsnCode
        originalItem: g.originalItem?._id || g.originalItem || undefined,
        quantity: Number(g.quantity || 0),
        price: Number(g.price || 0),
        amount: Number(g.amount || 0),
        gstRate: parseFloat(g.gstRate || 0),
        subtexts: g.subtexts || [],
      })),
    });
    setOriginalStatus(data.status);
    setRoundOffAmount(data.roundOff || 0);
    setRoundedGrandTotal(data.finalRoundedAmount !== undefined && data.finalRoundedAmount !== null 
      ? data.finalRoundedAmount 
      : data.grandTotal + (data.roundOff || 0));
  } catch (err) {
    handleApiError(err, "Failed to fetch ticket details.", authUser, "editTicketActivity");
    navigate("/tickets");
  } finally {
    setIsLoading(false);
  }
}, [ticketIdFromParams, navigate, authUser]);

  useEffect(() => {
    if (location.state?.ticketDataForForm) {
        const initialData = location.state.ticketDataForForm;
        const billingAddressObj = Array.isArray(initialData.billingAddress) && initialData.billingAddress.length === 5
            ? { address1: initialData.billingAddress[0] || "", address2: initialData.billingAddress[1] || "", state: initialData.billingAddress[2] || "", city: initialData.billingAddress[3] || "", pincode: initialData.billingAddress[4] || "" }
            : (typeof initialData.billingAddress === 'object' && initialData.billingAddress !== null) ? initialData.billingAddress : initialTicketData.billingAddress;
        const shippingAddressObj = Array.isArray(initialData.shippingAddress) && initialData.shippingAddress.length === 5
            ? { address1: initialData.shippingAddress[0] || "", address2: initialData.shippingAddress[1] || "", state: initialData.shippingAddress[2] || "", city: initialData.shippingAddress[3] || "", pincode: initialData.shippingAddress[4] || "" }
            : (typeof initialData.shippingAddress === 'object' && initialData.shippingAddress !== null) ? initialData.shippingAddress : initialTicketData.shippingAddress;
        
        setTicketData({
            ...initialTicketData,
            ...initialData,
            billingAddress: billingAddressObj,
            clientPhone: initialData.clientPhone || initialData.client?.phone || "",
            clientGstNumber: initialData.clientGstNumber || initialData.client?.gstNumber || "",
            shippingAddress: shippingAddressObj,
            deadline: initialData.deadline ? formatDateForInput(initialData.deadline) : null,
            validityDate: initialData.validityDate ? formatDateForInput(initialData.validityDate) : initialTicketData.validityDate,
            goods: (initialData.goods || []).map(g => ({
                ...g,
                hsnCode: g.hsnCode || "",
                originalItem: g.originalItem?._id || g.originalItem || undefined,
                originalPrice: g.originalPrice || g.price,
                maxDiscountPercentage: Number(g.maxDiscountPercentage || 0),
                gstRate: parseFloat(g.gstRate || 0),
                subtexts: g.subtexts || [],
            })),
        });
        setOriginalStatus(initialData.status);
        setRoundOffAmount(initialData.roundOff || 0);
        setRoundedGrandTotal(initialData.finalRoundedAmount !== undefined && initialData.finalRoundedAmount !== null ? initialData.finalRoundedAmount : initialData.grandTotal + (initialData.roundOff || 0));

    } else if (ticketIdFromParams) {
      fetchTicketDetails();
    }
  }, [ticketIdFromParams, location.state, fetchTicketDetails]);


  const calculateTaxes = useCallback(() => {
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

    // Calculate roundOff and finalRoundedAmount
    const decimalPart = grandTotal - Math.floor(grandTotal);
    let newRoundOffAmount;
    let newFinalRoundedAmount;

    if (decimalPart === 0) {
      newRoundOffAmount = 0;
      newFinalRoundedAmount = grandTotal;
    } else if (decimalPart < 0.50) {
      newFinalRoundedAmount = Math.floor(grandTotal);
      newRoundOffAmount = -decimalPart;
    } else {
      newFinalRoundedAmount = Math.ceil(grandTotal);
      newRoundOffAmount = 1 - decimalPart;
    }

    setTicketData(prev => ({ ...prev, gstBreakdown: newGstBreakdown, totalCgstAmount: runningTotalCgst, totalSgstAmount: runningTotalSgst, totalIgstAmount: runningTotalIgst, finalGstAmount, grandTotal, isBillingStateSameAsCompany, roundOff: newRoundOffAmount, finalRoundedAmount: newFinalRoundedAmount }));
  }, [ticketData.goods, ticketData.billingAddress?.state, ticketData.totalAmount]);
  useEffect(() => {
    calculateTaxes();
  }, [calculateTaxes]);

  const handleTicketGoodsChange = useCallback((index, field, value, subtextIndex = null) => {
    setTicketData(prev => {
      const updatedGoods = [...prev.goods];
      const itemToUpdate = { ...updatedGoods[index] };

      if (field === "subtexts" && subtextIndex !== null) {
        if (!itemToUpdate.subtexts) itemToUpdate.subtexts = [];
        itemToUpdate.subtexts[subtextIndex] = value;
      } else if (field === "gstRate") {
        itemToUpdate[field] = value === "" ? null : parseFloat(value);
      } else {
        itemToUpdate[field] = (["quantity", "price"].includes(field)) ? Number(value) : value;
      }

      if (field === "quantity" || field === "price") {
        itemToUpdate.amount = (Number(itemToUpdate.quantity) || 0) * (Number(itemToUpdate.price) || 0);
      }
      updatedGoods[index] = itemToUpdate;

      const totalQuantity = updatedGoods.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const totalAmount = updatedGoods.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return { ...prev, goods: updatedGoods, totalQuantity, totalAmount };
    });
  }, [setTicketData]);

  const handleAddItemToTicket = useCallback((item) => {
    setTicketData(prev => {
      // Determine the default unit to use (e.g., the base unit)
      const defaultUnit = item.units.find(u => u.isBaseUnit)?.name || item.units[0]?.name || "nos";
      const { pricePerSelectedUnit } = calculateItemPriceAndQuantity(item, 1, defaultUnit);

      const newGoodsItem = {
        srNo: prev.goods.length + 1, description: item.name, hsnCode: item.hsnCode || "",
        quantity: 1, unit: defaultUnit, // Set default unit
        price: pricePerSelectedUnit, // Price per selected unit (already calculated based on base unit)
        amount: pricePerSelectedUnit, // Amount for 1 quantity
        originalPrice: parseFloat(item.sellingPrice) || 0, // Store base selling price (direct property)
        maxDiscountPercentage: Number(item.maxDiscountPercentage || 0),
        gstRate: parseFloat(item.gstRate || 0),
        subtexts: [],
        originalItem: item, // Store the full item object for unit conversion
      };
      const newGoods = [...prev.goods, newGoodsItem];
      const totalQuantity = newGoods.reduce((sum, i) => sum + Number(i.quantity || 0), 0);
      const totalAmount = newGoods.reduce((sum, i) => sum + Number(i.amount || 0), 0);
      return { ...prev, goods: newGoods, totalQuantity, totalAmount };
    });
  }, [setTicketData]);

  const handleDeleteItemFromTicket = useCallback((indexToDelete) => {
    setTicketData(prev => {
      const updatedGoods = prev.goods.filter((_, index) => index !== indexToDelete)
        .map((item, index) => ({ ...item, srNo: index + 1 }));
      const totalQuantity = updatedGoods.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const totalAmount = updatedGoods.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      return { ...prev, goods: updatedGoods, totalQuantity, totalAmount };
    });
  }, [setTicketData]);

  const handleAddSubtextToTicketItem = useCallback((itemIndex) => {
    setTicketData(prev => {
      const updatedGoods = [...prev.goods];
      if (!updatedGoods[itemIndex].subtexts) updatedGoods[itemIndex].subtexts = [];
      updatedGoods[itemIndex].subtexts.push("");
      return { ...prev, goods: updatedGoods };
    });
  }, [setTicketData]);

  const handleDeleteSubtextFromTicketItem = useCallback((itemIndex, subtextIndexToDelete) => {
    setTicketData(prev => {
      const updatedGoods = [...prev.goods];
      updatedGoods[itemIndex].subtexts.splice(subtextIndexToDelete, 1);
      return { ...prev, goods: updatedGoods };
    });
  }, [setTicketData]);

  const handleAddressChange = useCallback((type, field, value) => {
    setTicketData(prev => {
      const newAddress = { ...(prev[type] || initialTicketData[type]), [field]: value };
      const newState = { ...prev, [type]: newAddress };
      if (type === 'billingAddress' && prev.shippingSameAsBilling) {
        newState.shippingAddress = { ...newAddress };
      }
      return newState;
    });
  }, [initialTicketData, setTicketData]);

  const handlePincodeChangeForAddress = useCallback(async (type, pincode) => {
    // Update pincode in state immediately
    setTicketData(prev => {
      const newAddress = { ...(prev[type] || initialTicketData[type]), pincode };
      const newState = { ...prev, [type]: newAddress };
      if (type === 'billingAddress' && prev.shippingSameAsBilling) {
        newState.shippingAddress = { ...newAddress };
      }
      return newState;
    });

    if (pincode.length === 6) {
        setIsFetchingAddress(true);
        try {
            const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);
            const data = response.data[0];
            if (data.Status === "Success") {
                const postOffice = data.PostOffice[0];
                setTicketData(prev => {
                    const currentAddress = { ...(prev[type] || initialTicketData[type]) };
                    const updatedAddress = { ...currentAddress, city: postOffice.District, state: postOffice.State, pincode }; // Ensure pincode is also set here
                    const newState = { ...prev, [type]: updatedAddress };
                    if (type === 'billingAddress' && prev.shippingSameAsBilling) {
                        newState.shippingAddress = { ...updatedAddress };
                    }
                    return newState;
                });
            } else { toast.warn(`Pincode ${pincode} not found or invalid.`); }
        } catch (err) { toast.error("Error fetching address from pincode."); }
        finally { setIsFetchingAddress(false); }
    }
  }, [initialTicketData, setTicketData, setIsFetchingAddress]);

  const handleUpdateTicket = useCallback(async () => {
    setFormValidated(true);
    // Basic form validation (can be expanded)
    if (!ticketData.companyName || !ticketData.billingAddress.address1 || !ticketData.billingAddress.pincode || !ticketData.billingAddress.city || !ticketData.billingAddress.state) {
        toast.error("Please fill all required fields (Company Name, Billing Address details).");
        return;
    }
    setIsLoading(true); setError(null);
    if (ticketData.status !== originalStatus && !statusChangeComment.trim()) {
      toast.warn("Comment for status change is required."); setIsLoading(false); return;
    }
    try {
      const updatePayload = {
        ...ticketData,
        deadline: ticketData.deadline ? new Date(ticketData.deadline).toISOString() : null,
        validityDate: ticketData.validityDate ? new Date(ticketData.validityDate).toISOString() : null,
        statusChangeComment: ticketData.status !== originalStatus ? statusChangeComment : undefined,
        // Send billing address as an object (not an array)
        billingAddress: {
          address1: ticketData.billingAddress.address1 || "",
          address2: ticketData.billingAddress.address2 || "",
          city: ticketData.billingAddress.city || "",
          state: ticketData.billingAddress.state || "",
          pincode: ticketData.billingAddress.pincode || ""
        },
        // Handle shipping address as an object too, respecting shippingSameAsBilling flag
        shippingAddress: ticketData.shippingSameAsBilling
          ? {
              address1: ticketData.billingAddress.address1 || "",
              address2: ticketData.billingAddress.address2 || "",
              city: ticketData.billingAddress.city || "",
              state: ticketData.billingAddress.state || "",
              pincode: ticketData.billingAddress.pincode || ""
            }
          : {
              address1: ticketData.shippingAddress.address1 || "",
              address2: ticketData.shippingAddress.address2 || "",
              city: ticketData.shippingAddress.city || "",
              state: ticketData.shippingAddress.state || "",
              pincode: ticketData.shippingAddress.pincode || ""
            },
        goods: ticketData.goods.map(g => ({
          ...g,
          hsnCode: g.hsnCode || "",
          originalItem: g.originalItem?._id || g.originalItem || undefined,
          gstRate: parseFloat(g.gstRate || 0),
          maxDiscountPercentage: Number(g.maxDiscountPercentage || 0),
          subtexts: g.subtexts || [],
        })),
        termsAndConditions: ticketData.termsAndConditions, // Ensure terms and conditions are sent
        roundOff: ticketData.roundOff, // Use the value from ticketData state
        finalRoundedAmount: ticketData.finalRoundedAmount, // Use the value from ticketData state
        // The backend will recalculate totalQuantity, totalAmount, GST, etc.
      };
      // Remove fields that shouldn't be sent or are managed by backend
      delete updatePayload._id; delete updatePayload.__v; delete updatePayload.createdAt; delete updatePayload.updatedAt;
      delete updatePayload.currentAssignee; delete updatePayload.createdBy; delete updatePayload.statusHistory; delete updatePayload.transferHistory;

      const responseData = await apiClient(`/tickets/${ticketIdFromParams}`, { method: "PUT", body: updatePayload });
      console.log("Frontend sending updatePayload:", updatePayload); // <-- ADDED DEBUG LOG

      if (responseData) {
        toast.success(`Ticket ${ticketData.ticketNumber} updated!`);
        navigate("/tickets");
      } // Removed setFormValidated from here
    } catch (error) {
      const errorMsg = handleApiError(error, "Failed to update ticket", authUser, "ticketActivity");
      setError(errorMsg); toast.error(errorMsg);
    } finally { setIsLoading(false); } // Removed setFormValidated from here
  }, [ticketData, originalStatus, statusChangeComment, ticketIdFromParams, navigate, authUser, roundOffAmount, roundedGrandTotal, setFormValidated, setIsLoading, setError, setStatusChangeComment]);

  const handleQuotationNumberClick = useCallback(async () => { // Removed setFormValidated from here
    if (!ticketData.quotationNumber) {
      toast.info("No quotation number associated with this ticket.");
      return;
    }
    setIsFetchingQuotation(true);
    try {
      // Assuming an endpoint to fetch quotation by reference number
      // This endpoint should return the quotation object including its _id
      const response = await apiClient(`/quotations/by-reference/${ticketData.quotationNumber}`);
      if (response && response._id) {
        navigate(`/quotations/form/${response._id}`);
      } else {
        toast.error("Could not find the corresponding quotation.");
      }
    } catch (err) {
      handleApiError(err, "Failed to fetch quotation details.", authUser, "fetchQuotationForEdit");
      toast.error("Error navigating to quotation.");
    } finally {
      setIsFetchingQuotation(false);
    } // Removed setFormValidated from here
  }, [ticketData.quotationNumber, navigate, authUser, setIsFetchingQuotation]);

  const getStatusBadgeColor = (status) => {
    // Implementation based on your Tickets.jsx logic
    switch (status) {
      case "Quotation Sent": return "info";
      case "PO Received": return "primary";
      case "Payment Pending": return "warning";
      case "Inspection": return "secondary";
      case "Packing List": return "dark";
      case "Invoice Sent": return "success";
      case "Hold": return "danger";
      case "Closed": return "success";
      default: return "dark";
    }
  };

  const handleStatusChange = useCallback((status) => {
    setTicketData(prev => ({ ...prev, status }));
    if (status !== originalStatus) {
        setStatusChangeComment(""); // setStatusChangeComment is stable
    }
  }, [originalStatus, setTicketData, setStatusChangeComment]);

  if (authLoading || (isLoading && !ticketData._id && ticketIdFromParams)) { // Check if loading initial data for an existing ticket
    return <ReusablePageStructure title="Loading Ticket..."><Spinner animation="border" /></ReusablePageStructure>;
  }

  return (
    <ReusablePageStructure
      title={`Edit Ticket - ${ticketData.ticketNumber || "New Ticket"}`}
      footerContent={
        <>
          <BsButton variant="secondary" onClick={() => navigate("/tickets")} disabled={isLoading}>Cancel</BsButton>
          <BsButton variant="primary" onClick={handleUpdateTicket} disabled={isLoading || isFetchingAddress}>
            {isLoading ? "Updating..." : "Update Ticket"}
          </BsButton>
        </>
      }
    >
      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}

      {/* Progress Bar With Stages */}
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
                variant={isCompleted ? getStatusBadgeColor(stage) : "secondary"}
                label={isCurrent ? stage : ""}
                animated={isCurrent}
                onClick={() => handleStatusChange(stage)}
                style={{ cursor: "pointer", transition: "background-color 0.3s ease" }}
                title={`Set status to: ${stage}`}
              />
            );
          })}
        </ProgressBar>
        <div className="d-flex justify-content-between mt-2">
          {statusStages.map((stage) => (
            <small
              key={stage}
              className={`text-center ${ticketData.status === stage ? `fw-bold text-${getStatusBadgeColor(stage)}` : "text-muted"}`}
              style={{ width: `${100 / statusStages.length}%`, cursor: "pointer", transition: "color 0.3s ease, font-weight 0.3s ease" }}
              onClick={() => handleStatusChange(stage)}
              title={`Set status to: ${stage}`}
            >
              {stage.split(" ")[0]} {/* Show only first word for brevity if needed */}
            </small>
          ))}
        </div>
      </div>

      {/* Status Change Comment */}
        {ticketData.status !== originalStatus && (
            <Form.Group className="my-3">
              <Form.Label htmlFor="statusChangeCommentInput" className="fw-bold">Comment for Status Change (Required)</Form.Label>
              <Form.Control as="textarea" id="statusChangeCommentInput" rows={2} value={statusChangeComment} onChange={(e) => setStatusChangeComment(e.target.value)} placeholder={`Explain why status is changing to "${ticketData.status}"...`} maxLength={200} required />
              <Form.Text muted>Max 200 characters.</Form.Text>
            </Form.Group>
        )}

      {/* Status History Table */}
      {ticketData.statusHistory && ticketData.statusHistory.length > 0 && (
        <div className="mt-4">
          <h5 style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem", marginBottom: "1rem" }}>
            <i className="bi bi-card-list me-1"></i>Status Change History
          </h5>
          <Table striped bordered hover size="sm" responsive>
            <thead className="table-light">
              <tr><th>Changed By</th><th>Date</th><th>Status Changed To</th><th>Comment</th></tr>
            </thead>
            <tbody>
              {ticketData.statusHistory.slice().reverse().map((historyItem, index) => (
                <tr key={historyItem._id || index}>
                  <td>{
                    historyItem.changedBy 
                      ? (typeof historyItem.changedBy === 'object' && historyItem.changedBy.firstname)
                        ? `${historyItem.changedBy.firstname} ${historyItem.changedBy.lastname}`.trim() 
                        : (typeof historyItem.changedBy === 'object' && historyItem.changedBy.email)
                          ? historyItem.changedBy.email
                          : "Unknown User"
                      : "N/A"
                  }</td>
                  <td>{historyItem.changedAt ? new Date(historyItem.changedAt).toLocaleString() : 'N/A'}</td>
                  <td><Badge bg={getStatusBadgeColor(historyItem.status)}>{historyItem.status}</Badge></td>
                  <td title={historyItem.note || "No comment"}>{(historyItem.note || "N/A").substring(0, 50) + (historyItem.note && historyItem.note.length > 50 ? "..." : "")}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      <hr />

      {/* Main Form Content */}
      <Form noValidate validated={formValidated} onSubmit={(e) => { e.preventDefault(); handleUpdateTicket(); }}>
        <h5 style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem", marginBottom: "1rem" }}>
            <i className="bi bi-info-circle-fill me-1"></i>Ticket & Client Information
        </h5>
        <Row className="mb-3">
            <Col md={4}><Form.Group><Form.Label>Company Name <span className="text-danger">*</span></Form.Label><Form.Control required type="text" value={ticketData.companyName || ""} onChange={(e) => setTicketData({ ...ticketData, companyName: e.target.value })} /></Form.Group></Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Quotation Number</Form.Label>
                <div className="d-flex align-items-center">
                  <Form.Control 
                    type="text" 
                    value={ticketData.quotationNumber || ""} 
                    readOnly 
                    onClick={handleQuotationNumberClick}
                    style={{cursor: ticketData.quotationNumber ? 'pointer' : 'default', textDecoration: ticketData.quotationNumber ? 'underline' : 'none', color: ticketData.quotationNumber ? 'blue' : 'inherit'}}
                    title={ticketData.quotationNumber ? "Click to view/edit quotation" : "No quotation linked"}
                  />
                  {isFetchingQuotation && <Spinner animation="border" size="sm" className="ms-2" />}
                </div>
              </Form.Group>
            </Col>
             <Col md={4}><Form.Group className="mb-3"><Form.Label>Dispatch Days</Form.Label><Form.Control type="text" name="dispatchDays" value={ticketData.dispatchDays || ""} onChange={(e) => setTicketData(prev => ({ ...prev, dispatchDays: e.target.value }))} placeholder="e.g. 7-10 working days" /></Form.Group></Col>
            
        </Row>
        <Row className="mb-3">
            <Col md={4}>
                <Form.Group><Form.Label>Client Phone</Form.Label><Form.Control type="tel" value={ticketData.clientPhone || ""} onChange={(e) => setTicketData({ ...ticketData, clientPhone: e.target.value })} placeholder="Enter 10 Digit Client Number" /></Form.Group>
            </Col>
            <Col md={4}>
                <Form.Group><Form.Label>Client GST Number</Form.Label><Form.Control type="text" value={ticketData.clientGstNumber || ""} onChange={(e) => setTicketData({ ...ticketData, clientGstNumber: e.target.value.toUpperCase() })} placeholder="Enter Client GST Number" /></Form.Group>
            </Col>
            <Col md={4}>
                <Form.Group><Form.Label>Deadline</Form.Label><Form.Control type="date" value={ticketData.deadline || ""} onChange={(e) => setTicketData({ ...ticketData, deadline: e.target.value })} /></Form.Group>
            </Col>
        </Row>
        <h5 style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem", marginBottom: "1rem" }}>
            <i className="bi bi-geo-alt-fill me-1"></i>Address Details
        </h5>

        <Row>
            <Col md={6}>
                <Card className="mb-3">
                    <Card.Header as="h5"><i className="bi bi-building me-1"></i>Billing Address</Card.Header>
                    <Card.Body>
                        <Row><Col md={12}><Form.Group className="mb-2"><Form.Label>Address Line 1 <span className="text-danger">*</span></Form.Label><Form.Control required value={ticketData.billingAddress?.address1 || ""} onChange={(e) => handleAddressChange("billingAddress", "address1", e.target.value)} placeholder="Address line 1" disabled={isFetchingAddress} /></Form.Group></Col></Row>
                        <Row><Col md={12}><Form.Group className="mb-2"><Form.Label>Address Line 2</Form.Label><Form.Control value={ticketData.billingAddress?.address2 || ""} onChange={(e) => handleAddressChange("billingAddress", "address2", e.target.value)} placeholder="Address line 2" disabled={isFetchingAddress} /></Form.Group></Col></Row>
                        <Row><Col md={4}><Form.Group className="mb-2"><Form.Label>Pincode <span className="text-danger">*</span></Form.Label><Form.Control required type="text" pattern="[0-9]{6}" value={ticketData.billingAddress?.pincode || ""} onChange={(e) => handlePincodeChangeForAddress("billingAddress", e.target.value)} placeholder="Pincode" disabled={isFetchingAddress} /><Form.Text className="text-muted">6-digit</Form.Text></Form.Group></Col>
                            <Col md={4}><Form.Group className="mb-2"><Form.Label>City <span className="text-danger">*</span></Form.Label><Form.Control required value={ticketData.billingAddress?.city || ""} onChange={(e) => handleAddressChange("billingAddress", "city", e.target.value)} placeholder="City" readOnly={!isFetchingAddress && !!ticketData.billingAddress?.city} disabled={isFetchingAddress} /></Form.Group></Col>
                            <Col md={4}><Form.Group className="mb-2"><Form.Label>State <span className="text-danger">*</span></Form.Label><Form.Control required value={ticketData.billingAddress?.state || ""} onChange={(e) => handleAddressChange("billingAddress", "state", e.target.value)} placeholder="State" readOnly={!isFetchingAddress && !!ticketData.billingAddress?.state} disabled={isFetchingAddress} /></Form.Group></Col>
                        </Row>
                    </Card.Body>
                </Card>
            </Col>
            <Col md={6}>
                <Card className="mb-3">
                    <Card.Header as="h5"><i className="bi bi-truck me-1"></i>Shipping Address</Card.Header>
                    <Card.Body style={{ minHeight: '230px' /* Approximate height of billing address card */ }}>
                        <Form.Group className="mb-2">
                            <Form.Check type="checkbox" label="Shipping address same as billing" checked={ticketData.shippingSameAsBilling} onChange={(e) => { const isChecked = e.target.checked; setTicketData((prev) => ({ ...prev, shippingSameAsBilling: isChecked, shippingAddress: isChecked ? { ...prev.billingAddress } : initialTicketData.shippingAddress })); }} disabled={isFetchingAddress} />
                        </Form.Group>
                        {!ticketData.shippingSameAsBilling && (
                            <>
                                <Row><Col md={12}><Form.Group className="mb-2"><Form.Label>Address Line 1 <span className="text-danger">*</span></Form.Label><Form.Control required={!ticketData.shippingSameAsBilling} value={ticketData.shippingAddress?.address1 || ""} onChange={(e) => handleAddressChange("shippingAddress", "address1", e.target.value)} placeholder="Address line 1" disabled={isFetchingAddress} /></Form.Group></Col></Row>
                                <Row><Col md={12}><Form.Group className="mb-2"><Form.Label>Address Line 2</Form.Label><Form.Control value={ticketData.shippingAddress?.address2 || ""} onChange={(e) => handleAddressChange("shippingAddress", "address2", e.target.value)} placeholder="Address line 2" disabled={isFetchingAddress} /></Form.Group></Col></Row>
                                <Row><Col md={4}><Form.Group className="mb-2"><Form.Label>Pincode <span className="text-danger">*</span></Form.Label><Form.Control required={!ticketData.shippingSameAsBilling} type="text" pattern="[0-9]{6}" value={ticketData.shippingAddress?.pincode || ""} onChange={(e) => handlePincodeChangeForAddress("shippingAddress", e.target.value)} placeholder="Pincode" disabled={isFetchingAddress} /><Form.Text className="text-muted">6-digit</Form.Text></Form.Group></Col>
                                    <Col md={4}><Form.Group className="mb-2"><Form.Label>City <span className="text-danger">*</span></Form.Label><Form.Control required={!ticketData.shippingSameAsBilling} value={ticketData.shippingAddress?.city || ""} onChange={(e) => handleAddressChange("shippingAddress", "city", e.target.value)} placeholder="City" readOnly={!isFetchingAddress && !!ticketData.shippingAddress?.city} disabled={isFetchingAddress} /></Form.Group></Col>
                                    <Col md={4}><Form.Group className="mb-2"><Form.Label>State <span className="text-danger">*</span></Form.Label><Form.Control required={!ticketData.shippingSameAsBilling} value={ticketData.shippingAddress?.state || ""} onChange={(e) => handleAddressChange("shippingAddress", "state", e.target.value)} placeholder="State" readOnly={!isFetchingAddress && !!ticketData.shippingAddress?.state} disabled={isFetchingAddress} /></Form.Group></Col>
                                </Row>
                            </>
                        )}
                    </Card.Body>
                </Card>
            </Col>
        </Row>

        <h5 style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem", marginBlock: "1.5rem" }}>
            <i className="bi bi-box-seam me-1"></i>Goods Details*
        </h5>
        <ItemSearchComponent onItemSelect={handleAddItemToTicket} onDropdownToggle={setIsItemSearchDropdownOpen} placeholder="Search and add item..."/>
        {isItemSearchDropdownOpen && <div style={{ height: "200px" }}></div> /* Spacer for open dropdown */}
        <div className="table-responsive mt-3">
          <Table bordered hover size="sm">
            <thead className="table-light"><tr><th>Sr.</th><th>Desc.*</th><th>HSN/SAC*</th><th>Qty*</th><th>Unit</th><th>GST%*</th><th>Price*</th><th>Amount</th><th>Actions</th></tr></thead>
            <tbody>
              {ticketData.goods.map((item, index) => (
                <React.Fragment key={index}>
                <tr>
                  <td className="align-middle text-center">{item.srNo}</td>
                  <td style={{minWidth: "250px"}}>
                    <Form.Control required type="text" value={item.description} onChange={(e) => handleTicketGoodsChange(index, "description", e.target.value)} placeholder="Description" />
                     {item.subtexts && item.subtexts.map((subtext, subtextIndex) => (
                        <div key={subtextIndex} className="d-flex mt-1">
                            <Form.Control type="text" bsPrefix="form-control form-control-sm" value={subtext} onChange={(e) => handleTicketGoodsChange(index, "subtexts", e.target.value, subtextIndex)} placeholder={`Subtext ${subtextIndex + 1}`} />
                            <BsButton variant="outline-danger" size="sm" onClick={() => handleDeleteSubtextFromTicketItem(index, subtextIndex)}>&times;</BsButton>
                        </div>
                    ))}
                    <BsButton variant="outline-primary" size="sm" className="mt-1" onClick={() => handleAddSubtextToTicketItem(index)}>+ Subtext</BsButton>
                  </td>
                  <td><Form.Control required type="text" value={item.hsnCode} onChange={(e) => handleTicketGoodsChange(index, "hsnCode", e.target.value)} placeholder="HSN Code" /></td>
                  <td><Form.Control required type="number" value={item.quantity} onChange={(e) => handleTicketGoodsChange(index, "quantity", e.target.value)} placeholder="Qty" min="0" /></td>
                  <td style={{ minWidth: "100px" }}>
                    {(item.units && item.units.length > 0) ? (
                      <Form.Select
                        value={item.unit || item.units[0]?.name || "nos"}
                        onChange={(e) => handleTicketGoodsChange(index, "unit", e.target.value)}
                      >
                        {item.units.map((unitOption) => (
                          <option key={unitOption.name} value={unitOption.name}>{unitOption.name}</option>
                        ))}
                      </Form.Select>
                    ) : (item.originalItem && item.originalItem.units && item.originalItem.units.length > 0) ? (
                      <Form.Select
                        value={item.unit || item.originalItem.pricing?.baseUnit || "nos"}
                        onChange={(e) => handleTicketGoodsChange(index, "unit", e.target.value)}
                      >
                        {item.originalItem.units.map((unitOption) => (
                          <option key={unitOption.name} value={unitOption.name}>{unitOption.name}</option>
                        ))}
                      </Form.Select>
                    ) : (
                      <Form.Control
                        type="text"
                        value={item.unit || "nos"}
                        readOnly={false}
                        onChange={(e) => handleTicketGoodsChange(index, "unit", e.target.value)}
                      />
                    )}
                  </td>
                  <td><Form.Control required type="number" value={item.gstRate === null ? "" : item.gstRate} onChange={(e) => handleTicketGoodsChange(index, "gstRate", e.target.value)} placeholder="GST %" min="0" step="0.1" /></td>
                  <td><Form.Control required type="number" value={item.price} onChange={(e) => handleTicketGoodsChange(index, "price", e.target.value)} placeholder="Price" min="0" step="0.01" /></td>
                  <td className="align-middle text-end">{(item.amount || 0).toFixed(2)}</td>
                  <td className="align-middle text-center"><BsButton variant="danger" size="sm" onClick={() => handleDeleteItemFromTicket(index)}><i className="bi bi-trash"></i></BsButton></td>
                </tr>
                </React.Fragment>
              ))}
            </tbody>
          </Table>
        </div>

        <Card className="mt-3 mb-3 bg-light">
            <Card.Header as="h5" style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#e9ecef", padding: "0.5rem", borderRadius: "0.25rem", marginBlockEnd: "1rem" }}>
                <i className="bi bi-calculator me-1"></i>Ticket Financial Summary
            </Card.Header>
            <Card.Body>
                <Row>
                    <Col md={4}>
                        <Table bordered size="sm"><tbody>
                            <tr><td>Total Quantity</td><td className="text-end"><strong>{ticketData.totalQuantity || 0}</strong></td></tr>
                            <tr><td>Total Amount (Pre-GST)</td><td className="text-end"><strong>₹{(ticketData.totalAmount || 0).toFixed(2)}</strong></td></tr>
                        </tbody></Table>
                    </Col>
                    <Col md={8}>
                        <Table bordered size="sm"><tbody>
                            {(ticketData.gstBreakdown || []).map((gstGroup, index) => (
                                <React.Fragment key={index}>
                                {gstGroup.itemGstRate > 0 && (
                                    ticketData.isBillingStateSameAsCompany ? (
                                    <>
                                        <tr><td>CGST ({gstGroup.cgstRate?.toFixed(2) || 0}% on ₹{gstGroup.taxableAmount?.toFixed(2) || 0})</td><td className="text-end">₹{(gstGroup.cgstAmount || 0).toFixed(2)}</td></tr>
                                        <tr><td>SGST ({gstGroup.sgstRate?.toFixed(2) || 0}% on ₹{gstGroup.taxableAmount?.toFixed(2) || 0})</td><td className="text-end">₹{(gstGroup.sgstAmount || 0).toFixed(2)}</td></tr>
                                    </>
                                    ) : (
                                    <tr><td>IGST ({gstGroup.igstRate?.toFixed(2) || 0}% on ₹{gstGroup.taxableAmount?.toFixed(2) || 0})</td><td className="text-end">₹{(gstGroup.igstAmount || 0).toFixed(2)}</td></tr>
                                    )
                                )}
                                </React.Fragment>
                            ))}
<tr className="table-active">
                                <td><strong>Total Tax</strong></td>
                                <td className="text-end"><strong>₹{(ticketData.finalGstAmount || 0).toFixed(2)}</strong></td>
                            </tr>
                            <tr className="table-secondary"><td><strong>Grand Total (Before Round Off)</strong></td><td className="text-end"><strong>₹{(ticketData.grandTotal || 0).toFixed(2)}</strong></td></tr>
                            {roundedGrandTotal !== null && (
                                <>
                                <tr>
                                    <td>Round Off</td>
                                    <td className="text-end">₹{roundOffAmount.toFixed(2)}</td>
                                </tr>
                                <tr className="table-success"><td><strong>Final Amount</strong></td><td className="text-end"><strong>₹{roundedGrandTotal.toFixed(2)}</strong></td></tr>
                                </>
                            )}
                        </tbody></Table>
                    </Col>
                </Row>
            </Card.Body>
        </Card>
      
      </Form>
    </ReusablePageStructure>
  );
};

export default EditTicketPage;
