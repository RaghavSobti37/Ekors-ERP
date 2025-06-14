// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/components/CreateTicketModal.jsx
import React, { useState, useEffect , useCallback} from "react";
import { Modal, Button, Form, Table, Spinner } from "react-bootstrap";
import axios from "axios";
import ReusableModal from "./ReusableModal.jsx"; // For PI Preview
import PIPDF from "./PIPDF.jsx"; // For PI Preview
import { PDFViewer } from "@react-pdf/renderer"; // For PI Preview

const CreateTicketModal = ({
  show,
  onHide,
  ticketData,
  setTicketData,
  handleTicketSubmit,
  isLoading,
  error,
}) => {
  const COMPANY_REFERENCE_STATE = "UTTAR PRADESH";
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
const [showPIPreviewModal, setShowPIPreviewModal] = useState(false);

  const fullScreenModalStyle = {
    position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
    width: '95vw', height: '95vh', maxWidth: 'none', margin: 0, padding: 0,
    overflow: 'auto', backgroundColor: 'white', border: '1px solid #dee2e6',
    borderRadius: '0.3rem', boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)', zIndex: 1050
  };
  const modalBodyStyle = { maxHeight: 'calc(95vh - 120px)', overflowY: 'auto', padding: '20px' };
  const modalFooterStyle = {
    position: 'sticky', bottom: 0, zIndex: 1051, backgroundColor: 'white',
    borderTop: '1px solid #dee2e6', padding: '15px'
  };

  const calculateTaxes = useCallback(() => {
    if (!ticketData.goods || !ticketData.billingAddress || !ticketData.billingAddress[2]) { // Ensure billing state is available
      setTicketData(prev => ({
        ...prev,
        gstBreakdown: [], totalCgstAmount: 0, totalSgstAmount: 0, totalIgstAmount: 0,
        finalGstAmount: 0, grandTotal: prev.totalAmount || 0, isBillingStateSameAsCompany: false,
      }));
      return;
    }

    const billingState = (ticketData.billingAddress[2] || "").toUpperCase().trim();
    const isBillingStateSameAsCompany = billingState === COMPANY_REFERENCE_STATE.toUpperCase().trim();
    const gstGroups = {};

    (ticketData.goods || []).forEach(item => {
      const itemGstRate = parseFloat(item.gstRate);
      if (!isNaN(itemGstRate) && itemGstRate >= 0 && item.amount > 0) { // Consider 0% GST items for taxable amount if needed, but not for tax calculation
        if (!gstGroups[itemGstRate]) {
          gstGroups[itemGstRate] = { taxableAmount: 0 };
        }
        gstGroups[itemGstRate].taxableAmount += (item.amount || 0);
      }
    });

    const newGstBreakdown = [];
    let runningTotalCgst = 0;
    let runningTotalSgst = 0;
    let runningTotalIgst = 0;

    for (const rateKey in gstGroups) {
      const group = gstGroups[rateKey];
      const itemGstRate = parseFloat(rateKey);
      if (isNaN(itemGstRate) || itemGstRate < 0) continue; // Skip invalid rates

      const taxableAmount = group.taxableAmount;
      let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
      let cgstRate = 0, sgstRate = 0, igstRate = 0;

      if (itemGstRate > 0) { // Only calculate tax for rates > 0
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
        itemGstRate, taxableAmount, cgstRate, cgstAmount,
        sgstRate, sgstAmount, igstRate, igstAmount,
      });
    }

    const finalGstAmount = runningTotalCgst + runningTotalSgst + runningTotalIgst;
    const currentTotalAmount = ticketData.totalAmount || 0;
    const grandTotal = currentTotalAmount + finalGstAmount;

    setTicketData(prev => ({
      ...prev, gstBreakdown: newGstBreakdown, totalCgstAmount: runningTotalCgst,
      totalSgstAmount: runningTotalSgst, totalIgstAmount: runningTotalIgst,
      finalGstAmount, grandTotal, isBillingStateSameAsCompany,
    }));
  }, [ticketData.goods, ticketData.billingAddress, ticketData.totalAmount, COMPANY_REFERENCE_STATE, setTicketData]);

  useEffect(() => {
    calculateTaxes();
  }, [calculateTaxes]);


  useEffect(() => {
    if (ticketData.shippingSameAsBilling) {
      setTicketData(prev => ({
        ...prev,
        shippingAddressObj: {
          address1: prev.billingAddress[0] || "", address2: prev.billingAddress[1] || "",
          state:    prev.billingAddress[2] || "", city:     prev.billingAddress[3] || "",
          pincode:  prev.billingAddress[4] || "",
        }
      }));
    }
  }, [ticketData.shippingSameAsBilling, ticketData.billingAddress, setTicketData]);

  const fetchAddressFromPincode = async (pincode, addressType) => {
    if (!pincode || pincode.length !== 6) return;
    setIsFetchingAddress(true);
    try {
      const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = response.data[0];
      if (data.Status === "Success") {
        const postOffice = data.PostOffice[0];
        setTicketData(prev => {
          let newBillingArray = [...prev.billingAddress];
          let newShippingObj = { ...(prev.shippingAddressObj || {}) };
          if (addressType === 'billingAddress') {
            newBillingArray[2] = postOffice.State; newBillingArray[3] = postOffice.District; newBillingArray[4] = pincode;
            if (prev.shippingSameAsBilling) {
              newShippingObj.state = postOffice.State; newShippingObj.city = postOffice.District; newShippingObj.pincode = pincode;
            }
          } else if (addressType === 'shippingAddressObj') {
            newShippingObj.state = postOffice.State; newShippingObj.city = postOffice.District; newShippingObj.pincode = pincode;
          }
          return { ...prev, billingAddress: newBillingArray, shippingAddressObj: newShippingObj };
        });
      }
    } catch (error) { console.error("Error fetching address:", error); }
    finally { setIsFetchingAddress(false); }
  };

  const handlePincodeChange = (e, addressType) => {
    const pincode = e.target.value;
    setTicketData(prev => {
      let newBillingArray = [...prev.billingAddress];
      let newShippingObj = { ...(prev.shippingAddressObj || {}) };
      if (addressType === 'billingAddress') {
        newBillingArray[4] = pincode;
        if (prev.shippingSameAsBilling) newShippingObj.pincode = pincode;
      } else if (addressType === 'shippingAddressObj') {
        newShippingObj.pincode = pincode;
      }
      return { ...prev, billingAddress: newBillingArray, shippingAddressObj: newShippingObj };
    });
    if (pincode.length === 6) setTimeout(() => fetchAddressFromPincode(pincode, addressType), 0);
  };

  const handleAddressChange = (e, addressType, fieldOrIndex) => {
    const { value } = e.target;
    setTicketData(prev => {
      let newBillingArray = [...prev.billingAddress];
      let newShippingObj = { ...(prev.shippingAddressObj || {}) };
      if (addressType === 'billingAddress') {
        newBillingArray[fieldOrIndex] = value;
        if (prev.shippingSameAsBilling) {
          if (fieldOrIndex === 0) newShippingObj.address1 = value;
          else if (fieldOrIndex === 1) newShippingObj.address2 = value;
          else if (fieldOrIndex === 2) newShippingObj.state = value;
          else if (fieldOrIndex === 3) newShippingObj.city = value;
        }
      } else if (addressType === 'shippingAddressObj') {
        newShippingObj[fieldOrIndex] = value;
      }
      return { ...prev, billingAddress: newBillingArray, shippingAddressObj: newShippingObj };
    });
  };

  const handleSameAsBillingChange = (e) => {
    const isChecked = e.target.checked;
    setTicketData(prev => {
      const newShippingAddressObj = isChecked
        ? { address1: prev.billingAddress[0] || "", address2: prev.billingAddress[1] || "",
            state: prev.billingAddress[2] || "", city: prev.billingAddress[3] || "",
            pincode: prev.billingAddress[4] || "" }
        : { ...(prev.shippingAddressObj || {}) };
      return { ...prev, shippingSameAsBilling: isChecked, shippingAddressObj: newShippingAddressObj };
    });
  };

   const handlePreviewPI = () => {
    // Construct the ticket object exactly as PIPDF expects it
    // This ensures that what PIPDF gets is consistent.
    // billingAddress is already an array in ticketData.
    // shippingAddress needs to be constructed from shippingAddressObj if not same as billing.
    const ticketForPreview = {
      ...ticketData, // All fields from ticketData (companyName, quotationNumber, goods, all tax fields, etc.)
      // Ensure shippingAddress is an array for PIPDF
      shippingAddress: ticketData.shippingSameAsBilling
        ? [...ticketData.billingAddress] // A copy of the billingAddress array
        : [ // Construct from shippingAddressObj
            ticketData.shippingAddressObj?.address1 || "",
            ticketData.shippingAddressObj?.address2 || "",
            ticketData.shippingAddressObj?.state || "",
            ticketData.shippingAddressObj?.city || "",
            ticketData.shippingAddressObj?.pincode || "",
          ],
    };
    // Now, you would set a state to show a modal containing PIPDF with ticketForPreview
    setShowPIPreviewModal(true);
  };

  return (
    <div style={{ display: show ? 'block' : 'none' }}>
      <div style={fullScreenModalStyle}>
        <Modal.Header closeButton onHide={onHide} style={{ borderBottom: '1px solid #dee2e6' }}>
          <Modal.Title>Create Ticket from Quotation</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleTicketSubmit}>
          <Modal.Body style={modalBodyStyle}>
            {error && <div className="alert alert-danger">{error}</div>}
            <div className="row">
              <Form.Group className="mb-3 col-md-6"><Form.Label>Company Name <span className="text-danger">*</span></Form.Label><Form.Control required readOnly type="text" value={ticketData.companyName || ""} /></Form.Group>
              <Form.Group className="mb-3 col-md-6"><Form.Label>Ticket Number</Form.Label><Form.Control type="text" value={ticketData.ticketNumber || ""} readOnly disabled /></Form.Group>
              <Form.Group className="mb-3 col-md-6"><Form.Label>Quotation Number <span className="text-danger">*</span></Form.Label><Form.Control required type="text" value={ticketData.quotationNumber || ""} readOnly disabled /></Form.Group>
            </div>
            <div className="row">
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>Billing Address</Form.Label>
                <Form.Group className="mb-2"><Form.Label>Address Line 1 <span className="text-danger">*</span></Form.Label><Form.Control required value={ticketData.billingAddress[0] || ""} onChange={(e) => handleAddressChange(e, 'billingAddress', 0)} placeholder="Address line 1" /></Form.Group>
                <Form.Group className="mb-2"><Form.Label>Address Line 2</Form.Label><Form.Control value={ticketData.billingAddress[1] || ""} onChange={(e) => handleAddressChange(e, 'billingAddress', 1)} placeholder="Address line 2" /></Form.Group>
                <div className="row">
                  <Form.Group className="mb-2 col-md-4"><Form.Label>Pincode <span className="text-danger">*</span></Form.Label><Form.Control required type="text" pattern="[0-9]{6}" value={ticketData.billingAddress[4] || ""} onChange={(e) => handlePincodeChange(e, 'billingAddress')} placeholder="Pincode" disabled={isFetchingAddress} /><Form.Text className="text-muted">6-digit pincode</Form.Text></Form.Group>
                  <Form.Group className="mb-2 col-md-4"><Form.Label>State <span className="text-danger">*</span></Form.Label><Form.Control required value={ticketData.billingAddress[2] || ""} onChange={(e) => handleAddressChange(e, 'billingAddress', 2)} placeholder="State" readOnly={!isFetchingAddress && !!ticketData.billingAddress[2]} /></Form.Group>
                  <Form.Group className="mb-2 col-md-4"><Form.Label>City <span className="text-danger">*</span></Form.Label><Form.Control required value={ticketData.billingAddress[3] || ""} onChange={(e) => handleAddressChange(e, 'billingAddress', 3)} placeholder="City" readOnly={!isFetchingAddress && !!ticketData.billingAddress[3]} /></Form.Group>
                </div>
              </Form.Group>
              <Form.Group className="mb-3 col-md-6">
                <div className="d-flex justify-content-between align-items-center"><Form.Label>Shipping Address</Form.Label><Form.Check type="checkbox" label="Same as Billing" checked={ticketData.shippingSameAsBilling || false} onChange={handleSameAsBillingChange} className="mb-2" /></div>
                <Form.Group className="mb-2"><Form.Label>Address Line 1 <span className="text-danger">*</span></Form.Label><Form.Control required={!ticketData.shippingSameAsBilling} value={ticketData.shippingAddressObj?.address1 || ""} onChange={(e) => handleAddressChange(e, 'shippingAddressObj', 'address1')} placeholder="Address line 1" disabled={ticketData.shippingSameAsBilling} /></Form.Group>
                <Form.Group className="mb-2"><Form.Label>Address Line 2</Form.Label><Form.Control value={ticketData.shippingAddressObj?.address2 || ""} onChange={(e) => handleAddressChange(e, 'shippingAddressObj', 'address2')} placeholder="Address line 2" disabled={ticketData.shippingSameAsBilling} /></Form.Group>
                <div className="row">
                  <Form.Group className="mb-2 col-md-4"><Form.Label>Pincode <span className="text-danger">*</span></Form.Label><Form.Control required={!ticketData.shippingSameAsBilling} type="text" pattern="[0-9]{6}" value={ticketData.shippingAddressObj?.pincode || ""} onChange={(e) => handlePincodeChange(e, 'shippingAddressObj')} placeholder="Pincode" disabled={isFetchingAddress || ticketData.shippingSameAsBilling} /><Form.Text className="text-muted">6-digit pincode</Form.Text></Form.Group>
                  <Form.Group className="mb-2 col-md-4"><Form.Label>State <span className="text-danger">*</span></Form.Label><Form.Control required={!ticketData.shippingSameAsBilling} value={ticketData.shippingAddressObj?.state || ""} onChange={(e) => handleAddressChange(e, 'shippingAddressObj', 'state')} placeholder="State" readOnly={(!isFetchingAddress && !!ticketData.shippingAddressObj?.state) || ticketData.shippingSameAsBilling} /></Form.Group>
                  <Form.Group className="mb-2 col-md-4"><Form.Label>City <span className="text-danger">*</span></Form.Label><Form.Control required={!ticketData.shippingSameAsBilling} value={ticketData.shippingAddressObj?.city || ""} onChange={(e) => handleAddressChange(e, 'shippingAddressObj', 'city')} placeholder="City" readOnly={(!isFetchingAddress && !!ticketData.shippingAddressObj?.city) || ticketData.shippingSameAsBilling} /></Form.Group>
                </div>
              </Form.Group>
            </div>
            <h5 className="mt-4">Goods Details</h5>
            <div className="table-responsive">
              <Table bordered className="mb-3">
                <thead><tr><th>Sr No.</th><th>Description</th><th>HSN/SAC</th><th>Qty</th><th>Price</th><th>Amount</th></tr></thead>
                <tbody>
                  {ticketData.goods.map((item, index) => (
                    <tr key={index}><td>{item.srNo}</td><td>{item.description}</td><td>{item.hsnSacCode}</td><td>{item.quantity}</td><td>₹{(item.price || 0).toFixed(2)}</td><td>₹{(item.amount || 0).toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <div className="bg-light p-3 rounded">
              <div className="row">
                <div className="col-md-4">
                  <Table bordered size="sm"><tbody>
                    <tr><td>Total Quantity</td><td className="text-end"><strong>{ticketData.totalQuantity || 0}</strong></td></tr>
                    <tr><td>Total Amount (Pre-GST)</td><td className="text-end"><strong>₹{(ticketData.totalAmount || 0).toFixed(2)}</strong></td></tr>
                  </tbody></Table>
                </div>
                <div className="col-md-8">
                  <Table bordered size="sm">
                    <tbody>
                      {(ticketData.gstBreakdown || []).map((gstGroup, index) => (
                        <React.Fragment key={index}>
                          {gstGroup.itemGstRate > 0 && ( // Only show rows if there's a GST rate > 0 for this group
                            ticketData.isBillingStateSameAsCompany ? (
                              <>
                                <tr><td>CGST ({gstGroup.cgstRate.toFixed(2)}% on ₹{gstGroup.taxableAmount.toFixed(2)})</td><td className="text-end">₹{(gstGroup.cgstAmount || 0).toFixed(2)}</td></tr>
                                <tr><td>SGST ({gstGroup.sgstRate.toFixed(2)}% on ₹{gstGroup.taxableAmount.toFixed(2)})</td><td className="text-end">₹{(gstGroup.sgstAmount || 0).toFixed(2)}</td></tr>
                              </>
                            ) : (
                              <tr><td>IGST ({gstGroup.igstRate.toFixed(2)}% on ₹{gstGroup.taxableAmount.toFixed(2)})</td><td className="text-end">₹{(gstGroup.igstAmount || 0).toFixed(2)}</td></tr>
                            )
                          )}
                        </React.Fragment>
                      ))}
                      <tr className="table-active"><td><strong>Total Tax</strong></td><td className="text-end"><strong>₹{(ticketData.finalGstAmount || 0).toFixed(2)}</strong></td></tr>
                      <tr className="table-success"><td><strong>Grand Total</strong></td><td className="text-end"><strong>₹{(ticketData.grandTotal || 0).toFixed(2)}</strong></td></tr>
                    </tbody>
                  </Table>
                </div>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer style={modalFooterStyle}>
              <Button variant="info" onClick={handlePreviewPI} disabled={isLoading || isFetchingAddress}>
              Preview PI
            </Button>
            <Button variant="secondary" onClick={onHide} disabled={isLoading || isFetchingAddress}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={isLoading || isFetchingAddress}>
              {isLoading ? "Creating..." : "Create Ticket"}
            </Button>
          </Modal.Footer>
        </Form>
                {showPIPreviewModal && (
          <ReusableModal
            show={showPIPreviewModal}
            onHide={() => setShowPIPreviewModal(false)}
            title={`PI Preview - ${ticketData.ticketNumber || ticketData.quotationNumber}`}
            size="xl" // Or your preferred size
          >
            <div style={{ height: '80vh', overflowY: 'auto' }}>
              <PDFViewer width="100%" height="99%">
                <PIPDF ticket={{...ticketData, shippingAddress: ticketData.shippingSameAsBilling ? [...ticketData.billingAddress] : [ticketData.shippingAddressObj?.address1 || "", ticketData.shippingAddressObj?.address2 || "", ticketData.shippingAddressObj?.state || "", ticketData.shippingAddressObj?.city || "", ticketData.shippingAddressObj?.pincode || ""]}} />
              </PDFViewer>
            </div>
          </ReusableModal>
        )}

      </div>
    </div>
  );
};

export default CreateTicketModal;
