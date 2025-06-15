// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/pages/QuotationFormPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Form, Button, Alert, Spinner, Table } from "react-bootstrap";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import ReusablePageStructure from "../../components/ReusablePageStructure.jsx"; // Ensure this path is correct
import ClientSearchComponent from "../../components/ClientSearchComponent.jsx";
import ItemSearchComponent from "../../components/ItemSearch.jsx";
import QuotationSearchComponent from "../../components/QuotationSearchComponent.jsx";
import apiClient from "../../utils/apiClient.js";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  handleApiError,
  formatDateForInput as formatDateForInputHelper,
} from "../../utils/helpers.js";
import frontendLogger from "../../utils/frontendLogger.js";
import axios from "axios"; // For pincode API call

const GoodsTable = ({
  goods,
  handleGoodsChange,
  isEditing, // This will always be true in the form context
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
            <th>Description <span className="text-danger">*</span></th>
            <th>HSN/SAC <span className="text-danger">*</span></th>
            <th>Qty <span className="text-danger">*</span></th>
            <th>Unit <span className="text-danger">*</span></th>
            <th>Price <span className="text-danger">*</span></th>
            <th>GST <span className="text-danger">*</span></th>
            <th>Amount</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {goods.map((item, index) => (
            <tr key={index}>
              <td>{item.srNo}</td>
              <td style={{ minWidth: "250px" }}>
                <Form.Control
                  required
                  type="text"
                  value={item.description || ""}
                  onChange={(e) => handleGoodsChange(index, "description", e.target.value)}
                  placeholder="Item Description"
                />
                {item.subtexts && item.subtexts.map((subtext, subtextIndex) => (
                  <div key={subtextIndex} className="d-flex mt-1">
                    <Form.Control
                      type="text"
                      value={subtext}
                      onChange={(e) => handleGoodsChange(index, "subtexts", e.target.value, subtextIndex)}
                      placeholder={`Subtext ${subtextIndex + 1}`}
                      className="form-control-sm me-1"
                      style={{ fontStyle: "italic" }}
                    />
                    <Button variant="outline-danger" size="sm" onClick={() => onDeleteSubtext(index, subtextIndex)}>&times;</Button>
                  </div>
                ))}
                <Button variant="outline-primary" size="sm" className="mt-1" onClick={() => onAddSubtext(index)}>+ Subtext</Button>
              </td>
              <td>
                <Form.Control
                  required
                  type="text"
                  value={item.hsnSacCode || ""}
                  onChange={(e) => handleGoodsChange(index, "hsnSacCode", e.target.value)}
                  placeholder="HSN/SAC"
                />
              </td>
              <td>
                <Form.Control
                  required
                  type="number"
                  min="1"
                  value={item.quantity || 1}
                  onChange={(e) => handleGoodsChange(index, "quantity", e.target.value)}
                />
              </td>
              <td>
                <Form.Control
                  as="select"
                  value={item.unit || "Nos"}
                  onChange={(e) => handleGoodsChange(index, "unit", e.target.value)}
                >
                  <option value="Nos">Nos</option>
                  <option value="Mtr">Mtr</option>
                  <option value="PKT">PKT</option>
                  <option value="Pair">Pair</option>
                  <option value="Set">Set</option>
                  <option value="Bottle">Bottle</option>
                  <option value="KG">KG</option>
                </Form.Control>
              </td>
              <td>
                <Form.Control
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={item.price || 0}
                  onChange={(e) => handleGoodsChange(index, "price", e.target.value)}
                />
              </td>
              <td>
                <Form.Control
                  required
                  type="number"
                  min="0"
                  step="0.1"
                  value={item.gstRate === null ? "" : item.gstRate}
                  onChange={(e) => handleGoodsChange(index, "gstRate", e.target.value)}
                />
              </td>
              <td className="align-middle">₹{(item.amount || 0).toFixed(2)}</td>
              <td className="align-middle">
                <Button variant="danger" size="sm" onClick={() => onDeleteItem(index)}>Delete</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="mb-3">
        <h6>Search and Add Items</h6>
        <ItemSearchComponent
          onItemSelect={onAddItem}
          placeholder="Search items to add to quotation..."
          onDropdownToggle={onItemSearchDropdownToggle}
        />
      </div>
    </div>
  );
};

const QuotationFormPage = () => {
  const { id: quotationIdFromParams } = useParams(); // For editing
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const auth = useAuth(); // For logging context

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

  const initialQuotationData = {
    date: formatDateForInputHelper(new Date()),
    referenceNumber: generateQuotationNumber(),
    validityDate: formatDateForInputHelper(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)),
    orderIssuedBy: user?.id || "",
    billingAddress: { address1: "", address2: "", city: "", state: "", pincode: "" },
    goods: [],
    totalQuantity: 0, totalAmount: 0, gstAmount: 0, grandTotal: 0,
    status: "open",
    client: { _id: null, companyName: "", clientName: "", gstNumber: "", email: "", phone: "" },
  };

  const [quotationData, setQuotationData] = useState(
    location.state?.quotationDataForForm || initialQuotationData
  );
  const [isEditing, setIsEditing] = useState(!!quotationIdFromParams || !!location.state?.isEditing);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formValidated, setFormValidated] = useState(false);
  const [selectedClientIdForForm, setSelectedClientIdForForm] = useState(quotationData.client?._id || null);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isFetchingBillingAddress, setIsFetchingBillingAddress] = useState(false);
  const [isItemSearchDropdownOpenInModal, setIsItemSearchDropdownOpenInModal] = useState(false);
  const [isReplicating, setIsReplicating] = useState(false);
  const [isLoadingReplicationDetails, setIsLoadingReplicationDetails] = useState(false);

  const quotationFormId = "quotation-form-page";

  // Fetch quotation data if editing and not passed via state
  useEffect(() => {
    if (isEditing && quotationIdFromParams && !location.state?.quotationDataForForm) {
      const fetchQuotation = async () => {
        setIsLoading(true);
        try {
          const fetchedQuotation = await apiClient(`/quotations/${quotationIdFromParams}`);
          const orderIssuedByIdToSet = fetchedQuotation.orderIssuedBy?._id || fetchedQuotation.orderIssuedBy || fetchedQuotation.user?._id || fetchedQuotation.user || user?.id;
          
          setQuotationData({
            date: formatDateForInputHelper(fetchedQuotation.date),
            referenceNumber: fetchedQuotation.referenceNumber,
            validityDate: formatDateForInputHelper(fetchedQuotation.validityDate),
            orderIssuedBy: typeof orderIssuedByIdToSet === 'object' && orderIssuedByIdToSet !== null ? orderIssuedByIdToSet._id : orderIssuedByIdToSet,
            goods: fetchedQuotation.goods.map(item => ({ ...item, quantity: Number(item.quantity), price: Number(item.price), amount: Number(item.amount), unit: item.unit || "Nos", originalPrice: Number(item.originalPrice || item.price), maxDiscountPercentage: item.maxDiscountPercentage ? Number(item.maxDiscountPercentage) : 0, gstRate: parseFloat(item.gstRate || 0), subtexts: item.subtexts || [] })),
            totalQuantity: Number(fetchedQuotation.totalQuantity),
            totalAmount: Number(fetchedQuotation.totalAmount),
            gstAmount: Number(fetchedQuotation.gstAmount),
            grandTotal: Number(fetchedQuotation.grandTotal),
            billingAddress: fetchedQuotation.billingAddress || initialQuotationData.billingAddress,
            status: fetchedQuotation.status || "open",
            client: { companyName: fetchedQuotation.client?.companyName || "", gstNumber: fetchedQuotation.client?.gstNumber || "", clientName: fetchedQuotation.client?.clientName || "", email: fetchedQuotation.client?.email || "", phone: fetchedQuotation.client?.phone || "", _id: fetchedQuotation.client?._id || null },
          });
          setSelectedClientIdForForm(fetchedQuotation.client?._id || null);
        } catch (err) {
          handleApiError(err, "Failed to fetch quotation for editing.", auth.user, "quotationFormActivity");
          navigate("/quotations");
        } finally {
          setIsLoading(false);
        }
      };
      fetchQuotation();
    } else if (location.state?.quotationDataForForm) {
        setQuotationData(location.state.quotationDataForForm);
        setSelectedClientIdForForm(location.state.quotationDataForForm.client?._id || null);
    }
     if (!isEditing && !location.state?.quotationDataForForm) { // Ensure orderIssuedBy is set for new forms
        setQuotationData(prev => ({...prev, orderIssuedBy: user?.id || ""}));
    }
  }, [quotationIdFromParams, isEditing, location.state, navigate, user, auth.user]);


  const recalculateTotals = (goodsList) => {
    const totalQuantity = goodsList.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const totalAmount = goodsList.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const gstAmount = goodsList.reduce((sum, item) => sum + Number(item.amount || 0) * (parseFloat(item.gstRate || 0) / 100), 0);
    const grandTotal = totalAmount + gstAmount;
    return { totalQuantity, totalAmount, gstAmount, grandTotal };
  };

  const handleAddItem = (item) => {
    const newGoods = [
      ...quotationData.goods,
      { srNo: quotationData.goods.length + 1, description: item.name, hsnSacCode: item.hsnCode || "", quantity: 1, unit: item.unit || "Nos", price: parseFloat(item.sellingPrice) || 0, amount: parseFloat(item.sellingPrice) || 0, originalPrice: parseFloat(item.sellingPrice) || 0, maxDiscountPercentage: parseFloat(item.maxDiscountPercentage) || 0, gstRate: parseFloat(item.gstRate || 0), subtexts: [] },
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
      updatedGoods[index][field] = value === "" ? null : parseFloat(value);
    } else {
      if (["quantity", "price", "amount"].includes(field)) value = Number(value);
      updatedGoods[index][field] = value;
    }

    if (field === "quantity" || field === "price") {
      updatedGoods[index].amount = (updatedGoods[index].quantity || 0) * (updatedGoods[index].price || 0);
    }

    if (field === "price") {
      const currentItem = updatedGoods[index];
      const newPrice = parseFloat(value);
      const originalPrice = parseFloat(currentItem.originalPrice);
      const maxDiscountPerc = parseFloat(currentItem.maxDiscountPercentage);
      if (!isNaN(newPrice) && !isNaN(originalPrice)) {
        if (!isNaN(maxDiscountPerc) && maxDiscountPerc > 0) {
          const minAllowedPrice = originalPrice * (1 - maxDiscountPerc / 100);
          if (newPrice < minAllowedPrice) priceValidationError = `Discount for ${currentItem.description} exceeds ${maxDiscountPerc}%. Min price ₹${minAllowedPrice.toFixed(2)}.`;
        } else {
          if (newPrice < originalPrice) priceValidationError = `Price for ${currentItem.description} (₹${newPrice.toFixed(2)}) < original (₹${originalPrice.toFixed(2)}) with no discount.`;
        }
      } else if (String(value).trim() !== "" && isNaN(newPrice)) {
        priceValidationError = `Invalid price for ${currentItem.description}.`;
      }
    }
    updatedGoods.forEach(item => { if (!item.unit) item.unit = "Nos"; });
    const totals = recalculateTotals(updatedGoods);
    setQuotationData({ ...quotationData, goods: updatedGoods, ...totals });
    if (priceValidationError) { setError(priceValidationError); toast.warn(priceValidationError); }
    else if (error && (error.includes(`Discount for ${updatedGoods[index].description}`) || error.includes(`Price for ${updatedGoods[index].description}`))) { setError(null); }
  };

  const handleDeleteItem = (indexToDelete) => {
    const updatedGoods = quotationData.goods.filter((_, index) => index !== indexToDelete).map((item, index) => ({ ...item, srNo: index + 1 }));
    const totals = recalculateTotals(updatedGoods);
    setQuotationData(prevData => ({ ...prevData, goods: updatedGoods, ...totals }));
  };

  const handleAddSubtext = (itemIndex) => {
    const updatedGoods = [...quotationData.goods];
    if (!updatedGoods[itemIndex].subtexts) updatedGoods[itemIndex].subtexts = [];
    updatedGoods[itemIndex].subtexts.push("");
    setQuotationData(prevData => ({ ...prevData, goods: updatedGoods }));
  };

  const handleDeleteSubtext = (itemIndex, subtextIndexToDelete) => {
    const updatedGoods = [...quotationData.goods];
    updatedGoods[itemIndex].subtexts.splice(subtextIndexToDelete, 1);
    setQuotationData(prevData => ({ ...prevData, goods: updatedGoods }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("client.")) {
      const clientField = name.split(".")[1];
      let processedValue = value;
      if (clientField === "gstNumber") processedValue = value.toUpperCase();
      else if (clientField === "email") processedValue = value.toLowerCase();
      setQuotationData(prev => ({ ...prev, client: { ...prev.client, [clientField]: processedValue } }));
    } else if (name.startsWith("billingAddress.")) {
      const addressField = name.split(".")[1];
      setQuotationData(prev => ({ ...prev, billingAddress: { ...prev.billingAddress, [addressField]: value } }));
      if (addressField === "pincode" && value.length === 6) {
        setTimeout(() => fetchBillingAddressFromPincode(value), 0);
      }
    } else {
      setQuotationData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleClientSelect = (client) => {
    setQuotationData(prev => ({ ...prev, client: { _id: client._id, companyName: client.companyName || "", clientName: client.clientName || "", gstNumber: client.gstNumber || "", email: client.email || "", phone: client.phone || "" } }));
    setSelectedClientIdForForm(client._id);
    setError(null);
  };

  const handleSaveClientDetails = async () => {
    const { companyName: rawCompanyName, gstNumber: rawGstNumber, email: rawEmail, phone: rawPhone } = quotationData.client;
    const companyName = rawCompanyName?.trim(); const gstNumber = rawGstNumber?.trim(); const email = rawEmail?.trim(); const phone = rawPhone?.trim(); const clientName = quotationData.client.clientName?.trim();
    if (!companyName || !gstNumber || !email || !phone || !clientName) { const msg = "All client fields (Company Name, Client Name, GST Number, Email, Phone) are required."; setError(msg); toast.warn(msg); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; if (!emailRegex.test(email)) { const msg = "Invalid email format."; setError(msg); toast.warn(msg); return; }
    const phoneRegex = /^\d{10}$/; if (!phoneRegex.test(phone)) { const msg = "Phone number must be 10 digits."; setError(msg); toast.warn(msg); return; }
    setIsSavingClient(true); setError(null);
    const clientPayload = { companyName, gstNumber: gstNumber.toUpperCase(), clientName, phone, email };
    try {
      const responseData = await apiClient("/clients", { method: "POST", body: clientPayload });
      if (responseData && responseData._id) {
        setQuotationData(prev => ({ ...prev, client: { ...responseData } }));
        setSelectedClientIdForForm(responseData._id);
        setError(null); toast.success("Client saved successfully!");
        if (auth.user) frontendLogger.info("clientActivity", "New client saved successfully", auth.user, { clientId: responseData._id, clientName: responseData.companyName, action: "SAVE_NEW_CLIENT_SUCCESS" });
      } else { setError("Failed to save client: Unexpected response."); toast.error("Failed to save client: Unexpected response."); }
    } catch (error) {
      const errorMessage = handleApiError(error, "Failed to save client details.", auth.user, "clientActivity");
      setError(errorMessage); toast.error(errorMessage);
      if (auth.user) frontendLogger.error("clientActivity", "Failed to save new client", auth.user, { clientPayload, errorMessage: error.data?.message || error.message, stack: error.stack, responseData: error.data, action: "SAVE_NEW_CLIENT_FAILURE" });
    } finally { setIsSavingClient(false); }
  };

  const fetchBillingAddressFromPincode = async (pincode) => {
    if (!pincode || pincode.length !== 6) return;
    setIsFetchingBillingAddress(true);
    try {
      const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = response.data[0];
      if (data.Status === "Success") {
        const postOffice = data.PostOffice[0];
        setQuotationData(prev => ({ ...prev, billingAddress: { ...prev.billingAddress, city: postOffice.District, state: postOffice.State } }));
        toast.success(`City and State auto-filled for pincode ${pincode}.`);
      } else { toast.warn(`Could not find details for pincode ${pincode}.`); }
    } catch (error) { console.error("Error fetching billing address:", error); toast.error("Error fetching address details."); }
    finally { setIsFetchingBillingAddress(false); }
  };

  const handleReplicationSelect = async (selectedQuotationStub) => {
    if (!selectedQuotationStub || !selectedQuotationStub._id) { toast.error("Invalid quotation selected for replication."); return; }
    setIsLoadingReplicationDetails(true); setError(null);
    try {
      const fullQuotation = await apiClient(`/quotations/${selectedQuotationStub._id}`);
      if (!fullQuotation || !fullQuotation.client || !fullQuotation.goods) { throw new Error("Incomplete quotation data for replication."); }
      const replicatedGoods = fullQuotation.goods.map((item, index) => ({ description: item.description, hsnSacCode: item.hsnSacCode || "", quantity: Number(item.quantity || 1), unit: item.unit || "Nos", price: Number(item.price || 0), amount: Number(item.quantity || 1) * Number(item.price || 0), originalPrice: Number(item.originalPrice || item.price), maxDiscountPercentage: item.maxDiscountPercentage ? Number(item.maxDiscountPercentage) : 0, srNo: index + 1, gstRate: parseFloat(item.gstRate || 0), subtexts: item.subtexts || [] }));
      const totals = recalculateTotals(replicatedGoods);
      setQuotationData(prevData => ({ ...prevData, client: { _id: fullQuotation.client._id, companyName: fullQuotation.client.companyName || "", gstNumber: fullQuotation.client.gstNumber || "", clientName: fullQuotation.client.clientName || "", email: fullQuotation.client.email || "", phone: fullQuotation.client.phone || "" }, billingAddress: fullQuotation.billingAddress || initialQuotationData.billingAddress, goods: replicatedGoods, ...totals, referenceNumber: generateQuotationNumber(), date: formatDateForInputHelper(new Date()) })); // New ref number and date
      setSelectedClientIdForForm(fullQuotation.client._id);
      setIsReplicating(false); // Turn off replication mode after selection
      toast.info("Quotation data replicated. Review and save as new.");
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to load quotation details for replication.");
      setError(errorMessage); toast.error(errorMessage);
    } finally { setIsLoadingReplicationDetails(false); }
  };

  const handleSubmit = async (event) => {
    event.preventDefault(); setFormValidated(true);
    const form = event.currentTarget;
    if (form.checkValidity() === false) { event.stopPropagation(); setError("Please fill in all required fields."); toast.error("Please fill in all required fields."); return; }
    if (!quotationData.client._id) { if (quotationData.client.companyName || quotationData.client.gstNumber || quotationData.client.email || quotationData.client.phone) { setError("Save new client details first."); toast.warn("Save new client details first."); } else { setError("Select or save client details."); toast.warn("Select or save client details."); } return; }
    if (!quotationData.goods || quotationData.goods.length === 0) { setError("Add at least one item."); toast.error("Add at least one item."); return; }
    for (let i = 0; i < quotationData.goods.length; i++) {
      const item = quotationData.goods[i];
      if (!item.description || !(parseFloat(item.quantity) > 0) || !(parseFloat(item.price) >= 0) || !item.unit) { const itemErrorMsg = `Item ${i + 1} incomplete.`; setError(itemErrorMsg); toast.error(itemErrorMsg); return; }
      if (item.maxDiscountPercentage > 0) { const minAllowedPrice = item.originalPrice * (1 - (item.maxDiscountPercentage || 0) / 100); if (parseFloat(item.price) < minAllowedPrice) { const priceErrorMsg = `Warning: Price for ${item.description} (₹${parseFloat(item.price).toFixed(2)}) is below minimum (₹${minAllowedPrice.toFixed(2)}) due to discount limit of ${item.maxDiscountPercentage}%.`; setError(priceErrorMsg); toast.warn(priceErrorMsg); } }
    }
    setIsLoading(true); setError(null);
    const submissionData = { referenceNumber: quotationData.referenceNumber, date: new Date(quotationData.date).toISOString(), validityDate: new Date(quotationData.validityDate).toISOString(), orderIssuedBy: quotationData.orderIssuedBy, goods: quotationData.goods.map(item => ({ srNo: item.srNo, description: item.description, hsnSacCode: item.hsnSacCode || "", quantity: Number(item.quantity), unit: item.unit || "Nos", price: Number(item.price), amount: Number(item.amount), originalPrice: Number(item.originalPrice), maxDiscountPercentage: item.maxDiscountPercentage ? Number(item.maxDiscountPercentage) : 0, gstRate: item.gstRate === null ? 0 : parseFloat(item.gstRate || 0), subtexts: item.subtexts || [] })), totalQuantity: Number(quotationData.totalQuantity), totalAmount: Number(quotationData.totalAmount), gstAmount: Number(quotationData.gstAmount), grandTotal: Number(quotationData.grandTotal), status: quotationData.status || "open", client: quotationData.client, billingAddress: quotationData.billingAddress };
    try {
      const url = isEditing && quotationIdFromParams ? `/quotations/${quotationIdFromParams}` : "/quotations";
      const method = isEditing && quotationIdFromParams ? "put" : "post";
      const responseData = await apiClient(url, { method, body: submissionData });
      if (responseData) {
        toast.success(`Quotation ${submissionData.referenceNumber} ${isEditing ? "updated" : "created"}!`);
        if (auth.user) frontendLogger.info("quotationActivity", `Quotation ${submissionData.referenceNumber} ${isEditing ? "updated" : "created"}`, auth.user, { quotationId: responseData._id, action: isEditing ? "UPDATE_QUOTATION_SUCCESS" : "CREATE_QUOTATION_SUCCESS" });
        navigate("/quotations"); // Navigate back to the list
      }
    } catch (error) {
      const errorMessage = handleApiError(error, "Failed to save quotation.", auth.user, "quotationActivity");
      if (error.status === 401) { navigate("/login", { state: { from: `/quotations/form${quotationIdFromParams ? `/${quotationIdFromParams}` : ''}` } }); return; }
      setError(errorMessage); toast.error(errorMessage);
      if (auth.user) frontendLogger.error("quotationActivity", isEditing ? "Failed to update" : "Failed to create", auth.user, { referenceNumber: quotationData.referenceNumber, quotationId: quotationIdFromParams, submittedData: submissionData, action: isEditing ? "UPDATE_QUOTATION_FAILURE" : "CREATE_QUOTATION_FAILURE" });
    } finally { setIsLoading(false); }
  };

  const pageTitle = isEditing ? `Edit Quotation - ${quotationData.referenceNumber}` : `Create New Quotation - ${quotationData.referenceNumber}`;
  const pageFooter = (
    <>
      <Button variant="secondary" onClick={() => navigate("/quotations")} disabled={isLoading || isLoadingReplicationDetails}>Cancel</Button>
      <Button variant="primary" type="submit" form={quotationFormId} disabled={isLoading || isLoadingReplicationDetails}>
        {isLoading || isLoadingReplicationDetails ? (isEditing ? "Updating..." : "Saving...") : (isEditing ? "Update Quotation" : "Save Quotation")}
      </Button>
    </>
  );

  if (authLoading || (isEditing && isLoading && !quotationData.referenceNumber)) { // Show loading if auth is loading OR if editing and main data not yet loaded
    return <div className="text-center p-5"><Spinner animation="border" /> Loading form...</div>;
  }

  return (
    <ReusablePageStructure showBackButton={true} title={pageTitle} footerContent={pageFooter}>
      <Form id={quotationFormId} noValidate validated={formValidated} onSubmit={handleSubmit}>
        {!isEditing && (
          <>
            <Form.Group className="mb-3"><Form.Check type="checkbox" label="Replicate Existing Quotation?" checked={isReplicating} onChange={(e) => setIsReplicating(e.target.checked)} /></Form.Group>
            {isReplicating && !isLoadingReplicationDetails && (<QuotationSearchComponent onQuotationSelect={handleReplicationSelect} placeholder="Search quotation to replicate..." />)}
            {isLoadingReplicationDetails && (<div className="text-center my-3"><Spinner animation="border" /> <p>Loading quotation details...</p></div>)}
          </>
        )}
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="row">
          <Form.Group className="mb-3 col-md-4"><Form.Label>Issue Date <span className="text-danger">*</span></Form.Label><Form.Control required type="date" name="date" value={quotationData.date} onChange={handleInputChange} disabled={isLoadingReplicationDetails} /></Form.Group>
          <Form.Group className="mb-3 col-md-4"><Form.Label>Validity Date <span className="text-danger">*</span></Form.Label><Form.Control required type="date" name="validityDate" value={quotationData.validityDate} onChange={handleInputChange} disabled={isLoadingReplicationDetails} /></Form.Group>
          {new Date(quotationData.validityDate) < new Date(quotationData.date) && (<Alert variant="warning" className="mt-0 mb-2 p-2 small">Warning: Validity date is before issue date.</Alert>)}
          <Form.Group className="mb-3 col-md-4">
            <Form.Label>Status <span className="text-danger">*</span></Form.Label>
            {(isEditing && (quotationData.status === "running" || quotationData.status === "closed")) ? (
              <Form.Control type="text" value={quotationData.status.charAt(0).toUpperCase() + quotationData.status.slice(1)} readOnly disabled={isLoadingReplicationDetails} />
            ) : (
              <Form.Select required name="status" value={quotationData.status} onChange={handleInputChange} disabled={isLoadingReplicationDetails}>
                <option value="open">Open</option><option value="hold">Hold</option>
              </Form.Select>
            )}
          </Form.Group>
        </div>
        <h5 style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem", marginBottom: "1rem" }}>Client Details</h5>
        <div className="row mb-3"><div className="col-12"><ClientSearchComponent onClientSelect={handleClientSelect} placeholder="Search & select client" currentClientId={selectedClientIdForForm} disabled={isLoadingReplicationDetails} /></div></div>
        <div className="row">
          <Form.Group className="mb-3 col-md-6"><Form.Label>Company Name <span className="text-danger">*</span></Form.Label><Form.Control required type="text" name="client.companyName" value={quotationData.client.companyName} onChange={!selectedClientIdForForm ? handleInputChange : undefined} readOnly={!!selectedClientIdForForm} disabled={isLoadingReplicationDetails} /></Form.Group>
          <Form.Group className="mb-3 col-md-6"><Form.Label>Client Name (Contact Person) <span className="text-danger">*</span></Form.Label><Form.Control required type="text" name="client.clientName" value={quotationData.client.clientName || ""} onChange={!selectedClientIdForForm ? handleInputChange : undefined} readOnly={!!selectedClientIdForForm} disabled={isLoadingReplicationDetails} placeholder="Enter contact person's name" /></Form.Group>
        </div>
        <div className="row">
          <Form.Group className="mb-3 col-md-6"><Form.Label>GST Number <span className="text-danger">*</span></Form.Label><Form.Control required type="text" name="client.gstNumber" value={quotationData.client.gstNumber} onChange={!selectedClientIdForForm ? handleInputChange : undefined} readOnly={!!selectedClientIdForForm} disabled={isLoadingReplicationDetails} /></Form.Group>
          <Form.Group className="mb-3 col-md-6"><Form.Label>Email <span className="text-danger">*</span></Form.Label><Form.Control type="email" name="client.email" value={quotationData.client.email} onChange={!selectedClientIdForForm ? handleInputChange : undefined} readOnly={!!selectedClientIdForForm} disabled={isLoadingReplicationDetails} /></Form.Group>
        </div>
        <div className="row mb-3 align-items-end">
          <Form.Group className="mb-3 col-md-6"><Form.Label>Phone <span className="text-danger">*</span></Form.Label><Form.Control type="tel" name="client.phone" value={quotationData.client.phone} onChange={!selectedClientIdForForm ? handleInputChange : undefined} readOnly={!!selectedClientIdForForm} disabled={isLoadingReplicationDetails} /></Form.Group>
          <div className="col-md-6 d-flex gap-2 justify-content-start justify-content-md-end align-items-center mb-3">
            <Button variant="outline-secondary" size="sm" onClick={() => { setSelectedClientIdForForm(null); setQuotationData(prev => ({ ...prev, client: { ...initialQuotationData.client, _id: null } })); }} disabled={isLoadingReplicationDetails || !selectedClientIdForForm}>Clear/Edit Client</Button>
            <Button variant="success" size="sm" onClick={handleSaveClientDetails} disabled={isSavingClient || isLoadingReplicationDetails || !!selectedClientIdForForm || !(quotationData.client.companyName && quotationData.client.gstNumber && quotationData.client.clientName && quotationData.client.phone)}>{isSavingClient ? "Saving..." : "Save New Client"}</Button>
          </div>
        </div>
        <h5 style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem", marginBottom: "1rem" }}>Billing Address</h5>
        <div className="row">
          <Form.Group className="mb-3 col-md-6"><Form.Label>Address Line 1 <span className="text-danger">*</span></Form.Label><Form.Control required type="text" name="billingAddress.address1" value={quotationData.billingAddress.address1} onChange={handleInputChange} disabled={isLoadingReplicationDetails || isFetchingBillingAddress} /></Form.Group>
          <Form.Group className="mb-3 col-md-6"><Form.Label>Address Line 2</Form.Label><Form.Control type="text" name="billingAddress.address2" value={quotationData.billingAddress.address2} onChange={handleInputChange} disabled={isLoadingReplicationDetails || isFetchingBillingAddress} /></Form.Group>
        </div>
        <div className="row">
          <Form.Group className="mb-3 col-md-4"><Form.Label>Pincode <span className="text-danger">*</span></Form.Label><Form.Control required type="text" name="billingAddress.pincode" value={quotationData.billingAddress.pincode} pattern="[0-9]{6}" onChange={handleInputChange} disabled={isLoadingReplicationDetails || isFetchingBillingAddress} /><Form.Text className="text-muted">6-digit pincode for City & State.</Form.Text></Form.Group>
          <Form.Group className="mb-3 col-md-4"><Form.Label>City <span className="text-danger">*</span></Form.Label><Form.Control required type="text" name="billingAddress.city" value={quotationData.billingAddress.city} onChange={handleInputChange} disabled={isLoadingReplicationDetails || isFetchingBillingAddress} readOnly={!(isLoadingReplicationDetails || isFetchingBillingAddress) && !!quotationData.billingAddress.city} /></Form.Group>
          <Form.Group className="mb-3 col-md-4"><Form.Label>State <span className="text-danger">*</span></Form.Label><Form.Control required type="text" name="billingAddress.state" value={quotationData.billingAddress.state} onChange={handleInputChange} disabled={isLoadingReplicationDetails || isFetchingBillingAddress} readOnly={!(isLoadingReplicationDetails || isFetchingBillingAddress) && !!quotationData.billingAddress.state} /></Form.Group>
        </div>
        <h5 style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem", marginBottom: "1rem" }}>Goods Details</h5>
        <GoodsTable goods={quotationData.goods} handleGoodsChange={handleGoodsChange} isEditing={true} onAddItem={handleAddItem} onDeleteItem={handleDeleteItem} onAddSubtext={handleAddSubtext} onDeleteSubtext={handleDeleteSubtext} onItemSearchDropdownToggle={setIsItemSearchDropdownOpenInModal} />
        {isItemSearchDropdownOpenInModal && (<div style={{ height: "300px" }}></div>)}
        <div className="bg-light p-3 rounded mt-3">
          <h5 className="text-center mb-3">Quotation Summary</h5>
          <Table bordered size="sm">
            <tbody>
              <tr><td>Total Quantity</td><td className="text-end"><strong>{quotationData.totalQuantity}</strong></td></tr>
              <tr><td>Total Amount (Subtotal)</td><td className="text-end"><strong>₹{quotationData.totalAmount.toFixed(2)}</strong></td></tr>
              <tr><td>Total GST</td><td className="text-end"><strong>₹{quotationData.gstAmount.toFixed(2)}</strong></td></tr>
              <tr><td style={{ fontWeight: "bold", fontSize: "1.1rem" }}>Grand Total</td><td className="text-end" style={{ fontWeight: "bold", fontSize: "1.1rem" }}><strong>₹{quotationData.grandTotal.toFixed(2)}</strong></td></tr>
            </tbody>
          </Table>
        </div>
      </Form>
    </ReusablePageStructure>
  );
};

export default QuotationFormPage;
