// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/components/CreateTicketModal.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Button, Form, Table, Spinner, Alert } from "react-bootstrap";
import axios from "axios"; // Keep axios if used for pincode or other direct calls
import ReusablePageStructure from "./ReusablePageStructure.jsx";
import ActionButtons from "./ActionButtons.jsx";
import { useNavigate, useLocation } from "react-router-dom";
import apiClient from "../utils/apiClient.js";
import { useAuth } from "../context/AuthContext.jsx";
import { handleApiError, showToast, getReadOnlyFieldStyle } from "../utils/helpers.js";
import { getInitialTicketPayload, recalculateTicketTotals, mapQuotationToTicketPayload } from "../utils/payloads.js";
import ClientSearchComponent from "./ClientSearchComponent.jsx"; // Import client search component

const CreateTicketPage = () => {
  const COMPANY_REFERENCE_STATE = "UTTAR PRADESH";
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  // const [showPIPreviewModal, setShowPIPreviewModal] = useState(false); // Replaced by navigation to a PI preview page

  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser } = useAuth();

  // Get source quotation data if available
  const sourceQuotationData = location.state?.sourceQuotationData || null;
  
  // Create initial ticket data using our shared payload utilities
  const initialTicketData = sourceQuotationData 
    ? mapQuotationToTicketPayload(sourceQuotationData, authUser?.id)
    : location.state?.ticketDataForForm || getInitialTicketPayload(authUser?.id);

  // Create state for component
  const [ticketData, setTicketData] = useState(initialTicketData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [roundedGrandTotal, setRoundedGrandTotal] = useState(null);
  const [roundOffAmount, setRoundOffAmount] = useState(0);

    const handleRoundOff = useCallback(() => {
    const currentGrandTotal = ticketData.grandTotal || 0;
    const decimalPart = currentGrandTotal - Math.floor(currentGrandTotal);
    let newRoundedTotal;
    let newRoundOffAmount;

    if (decimalPart < 0.5) {
      newRoundedTotal = Math.floor(currentGrandTotal);
      newRoundOffAmount = -decimalPart;
    } else {
      newRoundedTotal = Math.ceil(currentGrandTotal);
      newRoundOffAmount = 1 - decimalPart;
    }
    setRoundedGrandTotal(newRoundedTotal);
    setRoundOffAmount(newRoundOffAmount);
  }, [ticketData.grandTotal]);
  
  // Define readonly style for form fields
  const readOnlyFieldStyle = getReadOnlyFieldStyle();
  const handleTicketSubmit = async (event) => {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    // Use our utility to recalculate all totals before submission
    const recalculatedTotals = recalculateTicketTotals(ticketData);

    // Prepare standardized ticket payload
    const newTicketDetailsPayload = {
      ...ticketData,
      ...recalculatedTotals, // Apply the recalculated totals
      // Ensure client data is properly passed
      client: ticketData.client?._id || null,
      clientPhone: ticketData.clientPhone || "",
      clientGstNumber: ticketData.clientGstNumber || "",
      billingAddress: {
        address1: ticketData.billingAddress?.address1 || "",
        address2: ticketData.billingAddress?.address2 || "",
        city: ticketData.billingAddress?.city || "",
        state: ticketData.billingAddress?.state || "",
        pincode: ticketData.billingAddress?.pincode || "",
      },
      // If shipping is same as billing, copy billing address
      shippingAddress: ticketData.shippingSameAsBilling
        ? {
            address1: ticketData.billingAddress?.address1 || "",
            address2: ticketData.billingAddress?.address2 || "",
            city: ticketData.billingAddress?.city || "",
            state: ticketData.billingAddress?.state || "",
            pincode: ticketData.billingAddress?.pincode || "",
          }
        : ticketData.shippingAddressObj || {},
      // Standardize goods data
      goods: ticketData.goods.map((g, idx) => ({
        srNo: idx + 1,
        description: g.description || "",
        hsnCode: g.hsnCode || "",
        quantity: Number(g.quantity) || 0,
        unit: g.unit || "nos",
        price: Number(g.price) || 0,
        amount: Number(g.amount) || 0,
        gstRate: parseFloat(g.gstRate || 0),
        subtexts: g.subtexts || [],
        originalItem: g.originalItem?._id || g.originalItem || null,
      })),
      // Convert dates to ISO strings
      deadline: ticketData.deadline
        ? new Date(ticketData.deadline).toISOString()
        : null,
      // Always include round off information
      roundOff: roundOffAmount,
      finalRoundedAmount: roundedGrandTotal || Math.round(ticketData.grandTotal || 0),
    };

    // Ensure we're using the consistent payload structure from the backend
    const finalPayload = {
      newTicketDetails: newTicketDetailsPayload,
      sourceQuotationData: sourceQuotationData
        ? {
            _id: sourceQuotationData._id,
            referenceNumber: sourceQuotationData.referenceNumber,
            billingAddress: sourceQuotationData.billingAddress,
            client: sourceQuotationData.client,
            user: sourceQuotationData.user,
          }
        : null,
    };

    try {
      const response = await apiClient("/tickets", {
        method: "POST",
        body: finalPayload,
      });
      showToast(
        `Ticket ${
          response.ticketNumber || finalPayload.newTicketDetails.ticketNumber || "new"
        } created successfully!`,
        true
      );
      navigate("/tickets"); // Navigate to tickets list or details page
    } catch (err) {
      const errorMsg = handleApiError(
        err,
        "Failed to create ticket.",
        authUser,
        "createTicketActivity"
      );
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateTaxes = useCallback(() => {
    if (
      !ticketData.goods ||
      !ticketData.billingAddress ||
      !ticketData.billingAddress.state
    ) {
      // Ensure billing state is available
      setTicketData((prev) => ({
        ...prev,
        gstBreakdown: [],
        totalCgstAmount: 0,
        totalSgstAmount: 0,
        totalIgstAmount: 0,
        finalGstAmount: 0,
        grandTotal: prev.totalAmount || 0,
        isBillingStateSameAsCompany: false,
      }));
      return;
    }

    const billingState = (ticketData.billingAddress.state || "")
      .toUpperCase()
      .trim();
    const isBillingStateSameAsCompany =
      billingState === COMPANY_REFERENCE_STATE.toUpperCase().trim();
    const gstGroups = {};

    (ticketData.goods || []).forEach((item) => {
      // Ensure goods is an array
      const itemGstRate = parseFloat(item.gstRate);
      if (!isNaN(itemGstRate) && itemGstRate >= 0 && item.amount > 0) {
        // Consider 0% GST items for taxable amount if needed, but not for tax calculation
        if (!gstGroups[itemGstRate]) {
          gstGroups[itemGstRate] = { taxableAmount: 0 };
        }
        gstGroups[itemGstRate].taxableAmount += item.amount || 0;
      }
    });

    const newGstBreakdown = [];
    let runningTotalCgst = 0;
    let runningTotalSgst = 0;
    let runningTotalIgst = 0;

    for (const rateKey in gstGroups) {
      const group = gstGroups[rateKey];
      const itemGstRate = parseFloat(rateKey);
      if (isNaN(itemGstRate) || itemGstRate < 0) continue;

      const taxableAmount = group.taxableAmount;
      let cgstAmount = 0,
        sgstAmount = 0,
        igstAmount = 0;
      let cgstRate = 0,
        sgstRate = 0,
        igstRate = 0;
      if (itemGstRate > 0) {
        // Only calculate tax for rates > 0
        if (isBillingStateSameAsCompany) {
          cgstRate = itemGstRate / 2;
          sgstRate = itemGstRate / 2;
          cgstAmount = (taxableAmount * cgstRate) / 100;
          sgstAmount = (taxableAmount * sgstRate) / 100;
          runningTotalCgst += cgstAmount;
          runningTotalSgst += sgstAmount;
        } else {
          igstRate = itemGstRate;
          igstAmount = (taxableAmount * igstRate) / 100;
          runningTotalIgst += igstAmount;
        }
      }

      newGstBreakdown.push({
        itemGstRate,
        taxableAmount,
        cgstRate,
        cgstAmount,
        sgstRate,
        sgstAmount,
        igstRate,
        igstAmount,
      });
    }

    const finalGstAmount =
      runningTotalCgst + runningTotalSgst + runningTotalIgst;
    const currentTotalAmount = ticketData.totalAmount || 0;
    const grandTotal = currentTotalAmount + finalGstAmount;

    setTicketData((prev) => ({
      ...prev,
      gstBreakdown: newGstBreakdown,
      totalCgstAmount: runningTotalCgst,
      totalSgstAmount: runningTotalSgst,
      totalIgstAmount: runningTotalIgst,
      finalGstAmount,
      grandTotal,
      isBillingStateSameAsCompany,
    }));
    setRoundedGrandTotal(null);
    setRoundOffAmount(0);
  }, [
    ticketData.goods,
    ticketData.billingAddress,
    ticketData.totalAmount,
    COMPANY_REFERENCE_STATE,
    setTicketData,
  ]);

  useEffect(() => {
    calculateTaxes();
    // Automatically calculate round off whenever taxes are calculated
    if (ticketData.grandTotal) {
      handleRoundOff();
    }
  }, [calculateTaxes, ticketData.grandTotal, handleRoundOff]);

  useEffect(() => {
    if (ticketData.shippingSameAsBilling) {
      setTicketData((prev) => ({
        ...prev,
        shippingAddressObj: {
          address1: prev.billingAddress?.address1 || "",
          address2: prev.billingAddress?.address2 || "",
          state: prev.billingAddress?.state || "",
          city: prev.billingAddress?.city || "",
          pincode: prev.billingAddress?.pincode || "",
        },
      }));
    }
  }, [
    ticketData.shippingSameAsBilling,
    ticketData.billingAddress,
    setTicketData,
  ]);

  const fetchAddressFromPincode = async (pincode, addressType) => {
    if (!pincode || pincode.length !== 6) return;
    setIsFetchingAddress(true);
    try {
      const response = await axios.get(
        `https://api.postalpincode.in/pincode/${pincode}`
      );
      const data = response.data[0];
      if (data.Status === "Success") {
        const postOffice = data.PostOffice[0];
        setTicketData((prev) => {
          let newBillingAddress = { ...prev.billingAddress };
          let newShippingObj = { ...(prev.shippingAddressObj || {}) };
          if (addressType === "billingAddress") {
            newBillingAddress.state = postOffice.State;
            newBillingAddress.city = postOffice.District;
            newBillingAddress.pincode = pincode;
            if (prev.shippingSameAsBilling) {
              newShippingObj.state = postOffice.State;
              newShippingObj.city = postOffice.District;
              newShippingObj.pincode = pincode;
            }
          } else if (addressType === "shippingAddressObj") {
            newShippingObj.state = postOffice.State;
            newShippingObj.city = postOffice.District;
            newShippingObj.pincode = pincode;
          }
          return {
            ...prev,
            billingAddress: newBillingAddress,
            shippingAddressObj: newShippingObj,
          };
        });
      }
    } catch (error) {
      console.error("Error fetching address:", error);
    } finally {
      setIsFetchingAddress(false);
    }
  };

  // Handle pincode change
  const handlePincodeChange = (e, addressType) => {
    const pincode = e.target.value;
    setTicketData((prev) => {
      let newBillingAddress = { ...prev.billingAddress };
      let newShippingObj = { ...(prev.shippingAddressObj || {}) };
      
      if (addressType === "billingAddress") {
        newBillingAddress.pincode = pincode;
        if (prev.shippingSameAsBilling) newShippingObj.pincode = pincode;
      } else if (addressType === "shippingAddressObj") {
        newShippingObj.pincode = pincode;
      }
      
      return {
        ...prev,
        billingAddress: newBillingAddress,
        shippingAddressObj: newShippingObj,
      };
    });
    if (pincode.length === 6)
      setTimeout(() => fetchAddressFromPincode(pincode, addressType), 0);
  };

  // Handle address change
  const handleAddressChange = (e, addressType, field) => {
    const { value } = e.target;
    setTicketData((prev) => {
      let newBillingAddress = { ...prev.billingAddress };
      let newShippingObj = { ...(prev.shippingAddressObj || {}) };
      
      if (addressType === "billingAddress") {
        newBillingAddress[field] = value;
        if (prev.shippingSameAsBilling) {
          // Keep shipping address in sync with billing address
          newShippingObj[field] = value;
        }
      } else if (addressType === "shippingAddressObj") {
        newShippingObj[field] = value;
      }
      
      return {
        ...prev,
        billingAddress: newBillingAddress,
        shippingAddressObj: newShippingObj,
      };
    });
  };

  // Handle same as billing change
  const handleSameAsBillingChange = (e) => {
    const isChecked = e.target.checked;
    setTicketData((prev) => {
      const newShippingAddressObj = isChecked
        ? {
            address1: prev.billingAddress?.address1 || "",
            address2: prev.billingAddress?.address2 || "",
            state: prev.billingAddress?.state || "",
            city: prev.billingAddress?.city || "",
            pincode: prev.billingAddress?.pincode || "",
          }
        : { ...(prev.shippingAddressObj || {}) };
      return {
        ...prev,
        shippingSameAsBilling: isChecked,
        shippingAddressObj: newShippingAddressObj,
      };
    });


  };

  // Handle client selection
  const handleClientSelect = (client) => {
    setTicketData((prevData) => ({
      ...prevData,
      client: client,
      companyName: client.companyName || prevData.companyName,
      clientPhone: client.phone || prevData.clientPhone,
      clientGstNumber: client.gstNumber || prevData.clientGstNumber,
      // If client has a default billing address, use it
      billingAddress: client.defaultAddress ? {
        address1: client.defaultAddress.address1 || "",
        address2: client.defaultAddress.address2 || "",
        city: client.defaultAddress.city || "",
        state: client.defaultAddress.state || "",
        pincode: client.defaultAddress.pincode || ""
      } : prevData.billingAddress
    }));
  };

  const handlePreviewPI = () => {
    const ticketForPreview = {
      ...ticketData, // All fields from ticketData (companyName, quotationNumber, goods, all tax fields, etc.)
      // Convert billingAddress and shippingAddress to required format for PDF
      billingAddress: [
        ticketData.billingAddress?.address1 || "",
        ticketData.billingAddress?.address2 || "",
        ticketData.billingAddress?.state || "",
        ticketData.billingAddress?.city || "",
        ticketData.billingAddress?.pincode || ""
      ],
      shippingAddress: ticketData.shippingSameAsBilling
        ? [
            ticketData.billingAddress?.address1 || "",
            ticketData.billingAddress?.address2 || "",
            ticketData.billingAddress?.state || "",
            ticketData.billingAddress?.city || "",
            ticketData.billingAddress?.pincode || ""
          ] 
        : [
            ticketData.shippingAddressObj?.address1 || "",
            ticketData.shippingAddressObj?.address2 || "",
            ticketData.shippingAddressObj?.state || "",
            ticketData.shippingAddressObj?.city || "",
            ticketData.shippingAddressObj?.pincode || "",
          ],
      roundOff: roundOffAmount, // Pass rounding info to PDF
      finalRoundedAmount: roundedGrandTotal,
    };
    navigate("/tickets/pi-preview", { state: { ticketForPreview } });
  };

  const pageContent = (
    <Form id="create-ticket-form" onSubmit={handleTicketSubmit}>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="row">
        <Form.Group className="mb-3 col-md-6">
          <Form.Label>
            Client <span className="text-danger">*</span>
          </Form.Label>
          <ClientSearchComponent
            onClientSelect={handleClientSelect}
            currentClientId={ticketData.client?._id}
            placeholder="Search for a client..."
          />
        </Form.Group>
        <Form.Group className="mb-3 col-md-6">
          <Form.Label>
            Company Name <span className="text-danger">*</span>
          </Form.Label>
          <Form.Control
            required
            type="text"
            value={ticketData.companyName || ""}
            onChange={(e) => setTicketData({ ...ticketData, companyName: e.target.value })}
          />
        </Form.Group>
        <Form.Group className="mb-3 col-md-6">
          <Form.Label>Ticket Number</Form.Label>
          <Form.Control
            type="text"
            value="(Auto-generated)"
            readOnly
            disabled
            style={readOnlyFieldStyle}
          />
        </Form.Group>
        <Form.Group className="mb-3 col-md-6">
          <Form.Label>
            Quotation Number <span className="text-danger">*</span>
          </Form.Label>
          <Form.Control
            required
            type="text"
            value={ticketData.quotationNumber || ""}
            readOnly={!!sourceQuotationData}
            disabled={!!sourceQuotationData}
            style={sourceQuotationData ? readOnlyFieldStyle : {}}
            onChange={(e) => !sourceQuotationData && setTicketData({ ...ticketData, quotationNumber: e.target.value })}
          />
        </Form.Group>
        <Form.Group className="mb-3 col-md-6">
          <Form.Label>Client Phone</Form.Label>
          <Form.Control
            type="text"
            value={ticketData.clientPhone || ""}
            onChange={(e) => setTicketData({ ...ticketData, clientPhone: e.target.value })}
          />
        </Form.Group>
        <Form.Group className="mb-3 col-md-6">
          <Form.Label>Client GST Number</Form.Label>
          <Form.Control
            type="text"
            value={ticketData.clientGstNumber || ""}
            onChange={(e) => setTicketData({ ...ticketData, clientGstNumber: e.target.value })}
          />
        </Form.Group>
      </div>
      <div className="row">
        <Form.Group className="mb-3 col-md-6">
          <Form.Label>Billing Address</Form.Label>
          <Form.Group className="mb-2">
            <Form.Label>
              Address Line 1 <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              required
              value={ticketData.billingAddress?.address1 || ""}
              onChange={(e) => handleAddressChange(e, "billingAddress", "address1")}
              placeholder="Address line 1"
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Address Line 2</Form.Label>
            <Form.Control
              value={ticketData.billingAddress?.address2 || ""}
              onChange={(e) => handleAddressChange(e, "billingAddress", "address2")}
              placeholder="Address line 2"
            />
          </Form.Group>
          <div className="row">
            <Form.Group className="mb-2 col-md-4">
              <Form.Label>
                Pincode <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                required
                type="text"
                pattern="[0-9]{6}"
                value={ticketData.billingAddress?.pincode || ""}
                onChange={(e) => handlePincodeChange(e, "billingAddress")}
                placeholder="Pincode"
                disabled={isFetchingAddress}
              />
              <Form.Text className="text-muted">6-digit pincode</Form.Text>
            </Form.Group>
            <Form.Group className="mb-2 col-md-4">
              <Form.Label>
                State <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                required
                value={ticketData.billingAddress?.state || ""}
                onChange={(e) => handleAddressChange(e, "billingAddress", "state")}
                placeholder="State"
                readOnly={!isFetchingAddress && !!ticketData.billingAddress?.state}
                style={(!isFetchingAddress && !!ticketData.billingAddress[2]) ? readOnlyFieldStyle : {}}
              />
            </Form.Group>
            <Form.Group className="mb-2 col-md-4">
              <Form.Label>
                City <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                required
                value={ticketData.billingAddress?.city || ""}
                onChange={(e) => handleAddressChange(e, "billingAddress", "city")}
                placeholder="City"
                readOnly={!isFetchingAddress && !!ticketData.billingAddress?.city}
                style={(!isFetchingAddress && !!ticketData.billingAddress[3]) ? readOnlyFieldStyle : {}}
              />
            </Form.Group>
          </div>
        </Form.Group>
        <Form.Group className="mb-3 col-md-6">
          <div className="d-flex justify-content-between align-items-center">
            <Form.Label>Shipping Address</Form.Label>
            <Form.Check
              type="checkbox"
              label="Same as Billing"
              checked={ticketData.shippingSameAsBilling || false}
              onChange={handleSameAsBillingChange}
              className="mb-2"
            />
          </div>
          <Form.Group className="mb-2">
            <Form.Label>
              Address Line 1 <span className="text-danger">*</span>
            </Form.Label>
            <Form.Control
              required={!ticketData.shippingSameAsBilling}
              value={ticketData.shippingAddressObj?.address1 || ""}
              onChange={(e) =>
                handleAddressChange(e, "shippingAddressObj", "address1")
              }
              placeholder="Address line 1"
              disabled={ticketData.shippingSameAsBilling}
            />
          </Form.Group>
          <Form.Group className="mb-2">
            <Form.Label>Address Line 2</Form.Label>
            <Form.Control
              value={ticketData.shippingAddressObj?.address2 || ""}
              onChange={(e) =>
                handleAddressChange(e, "shippingAddressObj", "address2")
              }
              placeholder="Address line 2"
              disabled={ticketData.shippingSameAsBilling}
            />
          </Form.Group>
          <div className="row">
            <Form.Group className="mb-2 col-md-4">
              <Form.Label>
                Pincode <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                required={!ticketData.shippingSameAsBilling}
                type="text"
                pattern="[0-9]{6}"
                value={ticketData.shippingAddressObj?.pincode || ""}
                onChange={(e) => handlePincodeChange(e, "shippingAddressObj")}
                placeholder="Pincode"
                disabled={isFetchingAddress || ticketData.shippingSameAsBilling}
              />
              <Form.Text className="text-muted">6-digit pincode</Form.Text>
            </Form.Group>
            <Form.Group className="mb-2 col-md-4">
              <Form.Label>
                State <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                required={!ticketData.shippingSameAsBilling}
                value={ticketData.shippingAddressObj?.state || ""}
                onChange={(e) =>
                  handleAddressChange(e, "shippingAddressObj", "state")
                }
                placeholder="State"
                readOnly={
                  (!isFetchingAddress &&
                    !!ticketData.shippingAddressObj?.state) ||
                  ticketData.shippingSameAsBilling
                }
              />
            </Form.Group>
            <Form.Group className="mb-2 col-md-4">
              <Form.Label>
                City <span className="text-danger">*</span>
              </Form.Label>
              <Form.Control
                required={!ticketData.shippingSameAsBilling}
                value={ticketData.shippingAddressObj?.city || ""}
                onChange={(e) =>
                  handleAddressChange(e, "shippingAddressObj", "city")
                }
                placeholder="City"
                readOnly={
                  (!isFetchingAddress &&
                    !!ticketData.shippingAddressObj?.city) ||
                  ticketData.shippingSameAsBilling
                }
              />
            </Form.Group>
          </div>
        </Form.Group>
      </div>
      <h5 className="mt-4">Goods Details</h5>
      <div className="table-responsive">
        <Table bordered className="mb-3">
          <thead>
            <tr>
              <th>Sr No.</th>
              <th>Description</th>
              <th>HSN/SAC</th>
              <th>Qty</th>
              <th>Price</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {ticketData.goods.map((item, index) => (
              <tr key={index}>
                <td>{item.srNo}</td>
                <td>{item.description}</td>
                <td>{item.hsnCode}</td>
                <td>{item.quantity}</td>
                <td>₹{(item.price || 0).toFixed(2)}</td>
                <td>₹{(item.amount || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      <div className="bg-light p-3 rounded" >
        <div className="row">
          <div className="col-md-8 ms-auto" > {/* Added ms-auto to align to the right */}
            <Table bordered size="sm" className="ms-auto" style={{maxWidth: "500px"}}> {/* Added ms-auto and max-width for better alignment */}
              <tbody>
                {(ticketData.gstBreakdown || []).map((gstGroup, index) => (
                  <React.Fragment key={index}>
                    {gstGroup.itemGstRate > 0 &&
                      (ticketData.isBillingStateSameAsCompany ? (
                        <>
                          <tr>
                            <td>
                              CGST ({gstGroup.cgstRate.toFixed(2)}% on ₹
                              {gstGroup.taxableAmount.toFixed(2)})
                            </td>
                            <td className="text-end">
                              ₹{(gstGroup.cgstAmount || 0).toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td>
                              SGST ({gstGroup.sgstRate.toFixed(2)}% on ₹
                              {gstGroup.taxableAmount.toFixed(2)})
                            </td>
                            <td className="text-end">
                              ₹{(gstGroup.sgstAmount || 0).toFixed(2)}
                            </td>
                          </tr>
                        </>
                      ) : (
                        <tr>
                          <td>
                            IGST ({gstGroup.igstRate.toFixed(2)}% on ₹
                            {gstGroup.taxableAmount.toFixed(2)})
                          </td>
                          <td className="text-end">
                            ₹{(gstGroup.igstAmount || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                ))}
                <tr className="table-active" >
                  <td>
                    <strong>Total Tax</strong>
                  </td>
                  <td className="text-end">
                    <strong>
                      ₹{(ticketData.finalGstAmount || 0).toFixed(2)}
                    </strong>
                  </td>
                </tr>
                <tr className="table-secondary">
                  <td>
                    <strong>Grand Total (Before Round Off)</strong>
                  </td>
                  <td className="text-end">
                    <strong>₹{(ticketData.grandTotal || 0).toFixed(2)}</strong>
                  </td>
                </tr>
                <tr>
                  <td>Round Off</td>
                  <td className="text-end">₹{roundOffAmount.toFixed(2)}</td>
                </tr>
                <tr className="table-success">
                  <td>
                    <strong>Final Amount</strong>
                  </td>
                  <td className="text-end">
                    <strong>₹{(roundedGrandTotal || ticketData.grandTotal || 0).toFixed(2)}</strong>
                  </td>
                </tr>
              </tbody>
            </Table>
          </div>
        </div>
        {/* Round off is now automatic */}
        <div style={{ clear: "both" }}></div>
      </div>
    </Form>
  );

  const pageFooter = (
    <>
      <ActionButtons
        item={ticketData} // Pass ticketData as the item
        onView={handlePreviewPI} // Use onView for "Preview PI", text will be "View"
        isLoading={isLoading || isFetchingAddress} // Pass combined loading state
        size="md" // Match typical modal button size
      />
      <Button
        variant="secondary"
        onClick={() => navigate(-1)}
        disabled={isLoading || isFetchingAddress}
      >
        Cancel
      </Button>
      <Button
        variant="primary"
        type="submit"
        form="create-ticket-form"
        disabled={isLoading || isFetchingAddress}
      >
        {" "}
        {isLoading ? "Creating..." : "Create Ticket"}
      </Button>
    </>
  );

  return (
    <ReusablePageStructure
      title="Create Ticket from Quotation"
      footerContent={pageFooter}
    >
      {pageContent}
    </ReusablePageStructure>
  );
};

export default CreateTicketPage;
