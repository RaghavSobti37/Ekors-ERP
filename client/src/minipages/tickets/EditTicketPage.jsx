// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/pages/EditTicketPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Form, Button as BsButton, Alert, Spinner, Row, Col, Table, ProgressBar, Badge } from "react-bootstrap";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import ReusablePageStructure from "../../components/ReusablePageStructure.jsx";
import ItemSearchComponent from "../../components/ItemSearch.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import apiClient from "../../utils/apiClient";
import { handleApiError, formatDateForInput } from "../../utils/helpers";
import frontendLogger from "../../utils/frontendLogger.js";
import axios from "axios"; // For pincode API

const COMPANY_REFERENCE_STATE = "UTTAR PRADESH";
const statusStages = ["Quotation Sent", "PO Received", "Payment Pending", "Inspection", "Packing List", "Invoice Sent", "Hold", "Closed"];


const EditTicketPage = () => {
  const { id: ticketIdFromParams } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const auth = useAuth();

  const initialTicketData = {
    companyName: "", quotationNumber: "",
    billingAddress: { address1: "", address2: "", city: "", state: "", pincode: "" },
    shippingAddress: { address1: "", address2: "", city: "", state: "", pincode: "" },
    shippingSameAsBilling: false,
    goods: [], totalQuantity: 0, totalAmount: 0,
    gstBreakdown: [], totalCgstAmount: 0, totalSgstAmount: 0, totalIgstAmount: 0,
    finalGstAmount: 0, grandTotal: 0, isBillingStateSameAsCompany: false,
    status: "Quotation Sent", deadline: null,
    documents: { quotation: null, po: null, pi: null, challan: null, packingList: null, feedback: null, other: [] },
    dispatchDays: "7-10 working", validityDate: new Date(new Date().setDate(new Date().getDate() + 15)).toISOString(),
    clientPhone: "", clientGstNumber: "",
    termsAndConditions: "1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged if payment is not made within the stipulated time.\n3. Subject to Noida jurisdiction.",
    statusHistory: [],
    currentAssignee: null,
    createdAt: null,
  };

  const [ticketData, setTicketData] = useState(location.state?.ticketDataForForm || initialTicketData);
  const [originalStatus, setOriginalStatus] = useState("");
  const [statusChangeComment, setStatusChangeComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isItemSearchDropdownOpen, setIsItemSearchDropdownOpen] = useState(false);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);

  const fetchTicketDetails = useCallback(async () => {
    if (!ticketIdFromParams) return;
    setIsLoading(true);
    try {
      const data = await apiClient(`/tickets/${ticketIdFromParams}`, {
        params: { populate: "client,currentAssignee,createdBy,transferHistory.from,transferHistory.to,transferHistory.transferredBy,statusHistory.changedBy,documents.quotation.uploadedBy,documents.po.uploadedBy,documents.pi.uploadedBy,documents.challan.uploadedBy,documents.packingList.uploadedBy,documents.feedback.uploadedBy,documents.other.uploadedBy" },
      });
      const billingAddressObj = Array.isArray(data.billingAddress) && data.billingAddress.length === 5
        ? { address1: data.billingAddress[0] || "", address2: data.billingAddress[1] || "", state: data.billingAddress[2] || "", city: data.billingAddress[3] || "", pincode: data.billingAddress[4] || "" }
        : (typeof data.billingAddress === 'object' && data.billingAddress !== null)
          ? data.billingAddress
          : initialTicketData.billingAddress;

      const shippingAddressObj = Array.isArray(data.shippingAddress) && data.shippingAddress.length === 5
        ? { address1: data.shippingAddress[0] || "", address2: data.shippingAddress[1] || "", state: data.shippingAddress[2] || "", city: data.shippingAddress[3] || "", pincode: data.shippingAddress[4] || "" }
        : (typeof data.shippingAddress === 'object' && data.shippingAddress !== null)
          ? data.shippingAddress
          : initialTicketData.shippingAddress;

      setTicketData({
        ...initialTicketData, // Start with defaults to ensure all fields are present
        ...data,
        billingAddress: billingAddressObj,
        shippingAddress: shippingAddressObj,
        deadline: data.deadline ? formatDateForInput(data.deadline) : null,
        validityDate: data.validityDate ? formatDateForInput(data.validityDate) : initialTicketData.validityDate,
        goods: (data.goods || []).map(g => ({
            ...g, 
            originalPrice: g.originalPrice || g.price,
            maxDiscountPercentage: Number(g.maxDiscountPercentage || 0),
            gstRate: parseFloat(g.gstRate || 0),
            subtexts: g.subtexts || [],
        })),
      });
      setOriginalStatus(data.status);
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
            shippingAddress: shippingAddressObj,
            deadline: initialData.deadline ? formatDateForInput(initialData.deadline) : null,
            validityDate: initialData.validityDate ? formatDateForInput(initialData.validityDate) : initialTicketData.validityDate,
            goods: (initialData.goods || []).map(g => ({
                ...g, 
                originalPrice: g.originalPrice || g.price,
                maxDiscountPercentage: Number(g.maxDiscountPercentage || 0),
                gstRate: parseFloat(g.gstRate || 0),
                subtexts: g.subtexts || [],
            })),
        });
        setOriginalStatus(initialData.status);
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
    setTicketData(prev => ({
        ...prev, gstBreakdown: newGstBreakdown, totalCgstAmount: runningTotalCgst,
        totalSgstAmount: runningTotalSgst, totalIgstAmount: runningTotalIgst,
        finalGstAmount, grandTotal, isBillingStateSameAsCompany,
    }));
  }, [ticketData.goods, ticketData.billingAddress?.state, ticketData.totalAmount]);

  useEffect(() => {
    calculateTaxes();
  }, [calculateTaxes]);

  const updateTotals = (goods) => {
    const totalQuantity = goods.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalAmount = goods.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    setTicketData(prev => ({ ...prev, goods, totalQuantity, totalAmount }));
    // calculateTaxes will be called by its own useEffect dependency on goods or totalAmount
  };

  const handleTicketGoodsChange = (index, field, value, subtextIndex = null) => {
    const updatedGoods = [...ticketData.goods];
    if (field === "subtexts" && subtextIndex !== null) {
      if (!updatedGoods[index].subtexts) updatedGoods[index].subtexts = [];
      updatedGoods[index].subtexts[subtextIndex] = value;
    } else if (field === "gstRate") {
        updatedGoods[index][field] = value === "" ? null : parseFloat(value);
    } else {
      updatedGoods[index][field] = (["quantity", "price"].includes(field)) ? Number(value) : value;
    }
    if (field === "quantity" || field === "price") {
      updatedGoods[index].amount = (Number(updatedGoods[index].quantity) || 0) * (Number(updatedGoods[index].price) || 0);
    }
    updateTotals(updatedGoods);
  };

  const handleAddItemToTicket = (item) => {
    const newGoods = [
      ...ticketData.goods,
      {
        srNo: ticketData.goods.length + 1, description: item.name, hsnSacCode: item.hsnCode || "",
        quantity: 1, unit: item.unit || "Nos", price: Number(item.sellingPrice) || 0,
        amount: (Number(item.sellingPrice) || 0) * 1, originalPrice: Number(item.sellingPrice) || 0,
        maxDiscountPercentage: Number(item.maxDiscountPercentage || 0),
        gstRate: parseFloat(item.gstRate || 0),
        subtexts: [],
      },
    ];
    updateTotals(newGoods);
  };

  const handleDeleteItemFromTicket = (indexToDelete) => {
    const updatedGoods = ticketData.goods.filter((_, index) => index !== indexToDelete)
      .map((item, index) => ({ ...item, srNo: index + 1 }));
    updateTotals(updatedGoods);
  };

  const handleAddSubtextToTicketItem = (itemIndex) => {
    const updatedGoods = [...ticketData.goods];
    if (!updatedGoods[itemIndex].subtexts) updatedGoods[itemIndex].subtexts = [];
    updatedGoods[itemIndex].subtexts.push("");
    setTicketData((prevData) => ({ ...prevData, goods: updatedGoods }));
  };

  const handleDeleteSubtextFromTicketItem = (itemIndex, subtextIndexToDelete) => {
    const updatedGoods = [...ticketData.goods];
    updatedGoods[itemIndex].subtexts.splice(subtextIndexToDelete, 1);
    setTicketData((prevData) => ({ ...prevData, goods: updatedGoods }));
  };

  const handleAddressChange = (type, field, value) => {
    setTicketData(prev => ({
      ...prev,
      [type]: { ...(prev[type] || {}), [field]: value }
    }));
    if (type === 'billingAddress' && field === 'state') {
        // calculateTaxes will pick this up
    }
  };

  const handlePincodeChangeForAddress = async (type, pincode) => {
    handleAddressChange(type, 'pincode', pincode);
    if (pincode.length === 6) {
        setIsFetchingAddress(true);
        try {
            const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);
            const data = response.data[0];
            if (data.Status === "Success") {
                const postOffice = data.PostOffice[0];
                setTicketData(prev => {
                    const updatedAddress = { ...prev[type], city: postOffice.District, state: postOffice.State, pincode };
                    const newTicketData = { ...prev, [type]: updatedAddress };
                    if (type === 'billingAddress' && prev.shippingSameAsBilling) {
                        newTicketData.shippingAddress = { ...updatedAddress };
                    }
                    return newTicketData;
                });
            } else { toast.warn(`Pincode ${pincode} not found or invalid.`); }
        } catch (err) { toast.error("Error fetching address from pincode."); }
        finally { setIsFetchingAddress(false); }
    }
  };

  const handleStatusChange = (status) => {
    setTicketData({ ...ticketData, status });
    if (status !== originalStatus) setStatusChangeComment(""); // Reset comment if status changes
  };

  const handleUpdateTicket = async () => {
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
        billingAddress: [ // Convert back to array for backend
          ticketData.billingAddress.address1 || "", ticketData.billingAddress.address2 || "",
          ticketData.billingAddress.state || "", ticketData.billingAddress.city || "",
          ticketData.billingAddress.pincode || ""
        ],
        shippingAddress: ticketData.shippingSameAsBilling
          ? [ ticketData.billingAddress.address1 || "", ticketData.billingAddress.address2 || "",
              ticketData.billingAddress.state || "", ticketData.billingAddress.city || "",
              ticketData.billingAddress.pincode || "" ]
          : [ ticketData.shippingAddress.address1 || "", ticketData.shippingAddress.address2 || "",
              ticketData.shippingAddress.state || "", ticketData.shippingAddress.city || "",
              ticketData.shippingAddress.pincode || "" ],
        goods: ticketData.goods.map(g => ({
          ...g, gstRate: parseFloat(g.gstRate || 0),
          originalPrice: g.originalPrice, maxDiscountPercentage: Number(g.maxDiscountPercentage || 0),
          subtexts: g.subtexts || [],
        })),
      };
      // Remove fields that shouldn't be sent or are managed by backend
      delete updatePayload._id; delete updatePayload.__v; delete updatePayload.createdAt; delete updatePayload.updatedAt;
      delete updatePayload.currentAssignee; delete updatePayload.createdBy; delete updatePayload.statusHistory; delete updatePayload.transferHistory;

      const responseData = await apiClient(`/tickets/${ticketIdFromParams}`, { method: "PUT", body: updatePayload });
      if (responseData) {
        toast.success(`Ticket ${ticketData.ticketNumber} updated!`);
        frontendLogger.info("ticketActivity", `Ticket ${ticketData.ticketNumber} updated`, authUser, { ticketId: ticketIdFromParams, action: "UPDATE_TICKET_SUCCESS" });
        navigate("/tickets");
      }
    } catch (error) {
      const errorMsg = handleApiError(error, "Failed to update ticket", authUser, "ticketActivity");
      setError(errorMsg); toast.error(errorMsg);
      frontendLogger.error("ticketActivity", `Failed to update ticket ${ticketData.ticketNumber}`, authUser, { ticketId: ticketIdFromParams, action: "UPDATE_TICKET_FAILURE" });
    } finally { setIsLoading(false); }
  };

  const getStatusBadgeColor = (status) => { /* ... same as in Tickets.jsx ... */ return "secondary"; }; // Placeholder

  if (authLoading || (isLoading && !ticketData.ticketNumber)) {
    return <ReusablePageStructure title="Loading Ticket..."><div className="text-center"><Spinner animation="border" /></div></ReusablePageStructure>;
  }

  return (
    <ReusablePageStructure
      title={`Edit Ticket - ${ticketData.ticketNumber || "New Ticket"}`}
      footerContent={
        <>
          <BsButton variant="secondary" onClick={() => navigate("/tickets")} disabled={isLoading}>Cancel</BsButton>
          <BsButton variant="primary" onClick={handleUpdateTicket} disabled={isLoading}>
            {isLoading ? "Updating..." : "Update Ticket"}
          </BsButton>
        </>
      }
    >
      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
      {/* ProgressBarWithStages and StatusHistory would be here */}
      {/* Form fields for company, quotation, deadline, addresses, goods, summary, terms */}
      <Form>
        {/* ... Form structure similar to the modal in Tickets.jsx ... */}
        {/* Example: Status Change Comment */}
        {ticketData.status !== originalStatus && (
            <Form.Group className="my-3">
              <Form.Label htmlFor="statusChangeCommentInput" className="fw-bold">Comment for Status Change (Required)</Form.Label>
              <Form.Control as="textarea" id="statusChangeCommentInput" rows={2} value={statusChangeComment} onChange={(e) => setStatusChangeComment(e.target.value)} placeholder={`Explain why status is changing to "${ticketData.status}"...`} maxLength={200} required />
            </Form.Group>
        )}
        {/* ... Other form fields ... */}
      </Form>
    </ReusablePageStructure>
  );
};

export default EditTicketPage;
