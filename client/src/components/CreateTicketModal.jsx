import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Table } from "react-bootstrap";
// import apiClient from "../utils/apiClient"; // Not used directly in this version
import axios from "axios"; // Import axios for the external API call

const CreateTicketModal = ({
  show,
  onHide,
  ticketData,
  setTicketData,
  handleTicketSubmit,
  isLoading,
  error,
}) => {
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  // const [sameAsBilling, setSameAsBilling] = useState(false); // Replaced by ticketData.shippingSameAsBilling
  const [isSameState, setIsSameState] = useState(true); // Local UI state for tax display

  // Full screen modal style
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

  // Modal body style with scroll
  const modalBodyStyle = {
    maxHeight: 'calc(95vh - 120px)', // Adjusted for header and footer
    overflowY: 'auto',
    padding: '20px'
  };

  // Modal footer style (sticky at bottom)
  const modalFooterStyle = {
    position: 'sticky',
    bottom: 0,
    zIndex: 1050, // Ensure footer is above body content if body overflows
    backgroundColor: 'white',
    borderTop: '1px solid #dee2e6',
    padding: '15px'
  };

  // Function to calculate taxes based on whether states are same
  // This function updates the parent's ticketData state
  const calculateTaxes = (sameStateEvaluation) => {
    const gstRate = sameStateEvaluation ? 9 : 18; // 9% CGST+SGST for same state, 18% IGST for different states

    const totalAmount = ticketData.totalAmount || 0;
    const gstAmount = (totalAmount * gstRate) / 100;
    const grandTotal = totalAmount + gstAmount;

    setTicketData(prev => ({
      ...prev,
      gstRate, // Store the component rate (e.g., 9 for CGST/SGST, 18 for IGST)
      gstAmount,
      grandTotal,
      isSameState: sameStateEvaluation // Store the boolean result for backend/logging if needed
    }));
  };

  // Check if states are same whenever billing or shipping state changes
  useEffect(() => {
    const billingState = ticketData.billingAddress[2] || "";
    const shippingState = ticketData.shippingSameAsBilling
                            ? billingState // If same, shipping state is same as billing state
                            : ticketData.shippingAddressObj?.state || ""; // Else, use shipping object's state
    
    const newIsSameState = billingState === shippingState;
    setIsSameState(newIsSameState); // Update local UI state

    calculateTaxes(newIsSameState); // Update parent ticketData with new tax calculations
  }, [
      ticketData.billingAddress, // Watch the whole array
      ticketData.shippingAddressObj, // Watch the whole object
      ticketData.shippingSameAsBilling,
      ticketData.totalAmount,
      // setTicketData // Avoid including setTicketData if it's stable from parent
  ]);


  const fetchAddressFromPincode = async (pincode, addressType) => {
    if (!pincode || pincode.length !== 6) {
      return;
    }
    setIsFetchingAddress(true);
    try {
      const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = response.data[0];

      if (data.Status === "Success") {
        const postOffice = data.PostOffice[0];
        setTicketData(prev => {
          let newBillingArray = [...prev.billingAddress];
          let newShippingObj = { ...(prev.shippingAddressObj || { address1: "", address2: "", city: "", state: "", pincode: "" }) };

          if (addressType === 'billingAddress') {
            newBillingArray[2] = postOffice.State;    // State is index 2
            newBillingArray[3] = postOffice.District; // City is index 3
            newBillingArray[4] = pincode;             // Pincode is index 4
            if (prev.shippingSameAsBilling) { // If "same as billing", update shippingObj too
              newShippingObj.state = postOffice.State;
              newShippingObj.city = postOffice.District;
              newShippingObj.pincode = pincode;
            }
          } else if (addressType === 'shippingAddressObj') { // Only for shippingAddressObj
            newShippingObj.state = postOffice.State;
            newShippingObj.city = postOffice.District;
            newShippingObj.pincode = pincode;
          }
          return { ...prev, billingAddress: newBillingArray, shippingAddressObj: newShippingObj };
        });
      }
    } catch (error) {
      console.error("Error fetching address:", error);
    } finally {
      setIsFetchingAddress(false);
    }
  };

  const handlePincodeChange = (e, addressType) => {
    const pincode = e.target.value;
    if (addressType === 'billingAddress') {
      const newBillingArray = [...ticketData.billingAddress];
      newBillingArray[4] = pincode; // Pincode is at index 4

      setTicketData(prev => {
        let newShippingObj = { ...(prev.shippingAddressObj || { address1: "", address2: "", city: "", state: "", pincode: "" }) };
        if (prev.shippingSameAsBilling) {
          newShippingObj.pincode = pincode; // Update shipping pincode if "same as"
        }
        return { ...prev, billingAddress: newBillingArray, shippingAddressObj: newShippingObj };
      });

      if (pincode.length === 6) {
        setTimeout(() => fetchAddressFromPincode(pincode, 'billingAddress'), 0);
      }
    } else if (addressType === 'shippingAddressObj') { // For shippingAddressObj
      setTicketData(prev => ({
        ...prev,
        shippingAddressObj: { ...(prev.shippingAddressObj || { address1: "", address2: "", city: "", state: "", pincode: "" }), pincode: pincode }
      }));
      if (pincode.length === 6) {
        setTimeout(() => fetchAddressFromPincode(pincode, 'shippingAddressObj'), 0);
      }
    }
  };

  const handleAddressChange = (e, addressType, fieldOrIndex) => {
    const { value } = e.target;
    if (addressType === 'billingAddress') { // Billing address is an array
      const newBillingArray = [...ticketData.billingAddress];
      newBillingArray[fieldOrIndex] = value; // fieldOrIndex is the index (0-3 for add1,add2,state,city)

      setTicketData(prev => {
        let newShippingObj = { ...(prev.shippingAddressObj || { address1: "", address2: "", city: "", state: "", pincode: "" }) };
        if (prev.shippingSameAsBilling) { // If "same as billing" is checked
          if (fieldOrIndex === 0) newShippingObj.address1 = value;
          else if (fieldOrIndex === 1) newShippingObj.address2 = value;
          else if (fieldOrIndex === 2) newShippingObj.state = value;    // state
          else if (fieldOrIndex === 3) newShippingObj.city = value;     // city
        }
        return { ...prev, billingAddress: newBillingArray, shippingAddressObj: newShippingObj };
      });
    } else if (addressType === 'shippingAddressObj') { // Shipping address is an object
      setTicketData(prev => ({
        ...prev,
        shippingAddressObj: {
          ...(prev.shippingAddressObj || { address1: "", address2: "", city: "", state: "", pincode: "" }),
          [fieldOrIndex]: value, // fieldOrIndex is the key ('address1', 'address2', 'city', 'state')
        }
      }));
    }
  };

  const handleSameAsBillingChange = (e) => {
    const isChecked = e.target.checked;
    setTicketData(prev => {
      const newShippingAddressObj = isChecked
        ? { // Populate from billingAddress array
            address1: prev.billingAddress[0] || "",
            address2: prev.billingAddress[1] || "",
            state:    prev.billingAddress[2] || "",
            city:     prev.billingAddress[3] || "",
            pincode:  prev.billingAddress[4] || "",
          }
          // When unchecking, retain current shippingAddressObj values or reset
        : { ...(prev.shippingAddressObj || { address1: "", address2: "", city: "", state: "", pincode: "" }) }; 

      return {
        ...prev,
        shippingSameAsBilling: isChecked,
        shippingAddressObj: newShippingAddressObj,
      };
    });
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
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>Company Name <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  required
                  readOnly ={true}
                  type="text"
                  value={ticketData.companyName || ""}
                  // onChange is not needed for readOnly fields from quotation
                />
              </Form.Group>
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>Ticket Number</Form.Label>
                <Form.Control
                  type="text"
                  value={ticketData.ticketNumber || ""}
                  readOnly={true}
                  disabled={true}
                />
              </Form.Group>
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>Quotation Number <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  required
                  type="text"
                  value={ticketData.quotationNumber || ""}
                  readOnly
                  disabled
                />
              </Form.Group>
            </div>

            {/* Billing Address Section (uses ticketData.billingAddress array) */}
            <div className="row">
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>Billing Address</Form.Label>
                <Form.Group className="mb-2">
                  <Form.Label>Address Line 1 <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    required
                    value={ticketData.billingAddress[0] || ""}
                    onChange={(e) => handleAddressChange(e, 'billingAddress', 0)}
                    placeholder="Address line 1"
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Address Line 2</Form.Label>
                  <Form.Control
                    value={ticketData.billingAddress[1] || ""}
                    onChange={(e) => handleAddressChange(e, 'billingAddress', 1)}
                    placeholder="Address line 2"
                  />
                </Form.Group>
                <div className="row">
                  <Form.Group className="mb-2 col-md-4">
                    <Form.Label>Pincode <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      required
                      type="text"
                      pattern="[0-9]{6}"
                      value={ticketData.billingAddress[4] || ""}
                      onChange={(e) => handlePincodeChange(e, 'billingAddress')}
                      placeholder="Pincode"
                      disabled={isFetchingAddress}
                    />
                    <Form.Text className="text-muted">
                      6-digit pincode for state/city
                    </Form.Text>
                  </Form.Group>
                  <Form.Group className="mb-2 col-md-4">
                    <Form.Label>State <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      required
                      value={ticketData.billingAddress[2] || ""}
                      onChange={(e) => handleAddressChange(e, 'billingAddress', 2)}
                      placeholder="State"
                      readOnly={!isFetchingAddress && !!ticketData.billingAddress[2]}
                    />
                  </Form.Group>
                  <Form.Group className="mb-2 col-md-4">
                    <Form.Label>City <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      required
                      value={ticketData.billingAddress[3] || ""}
                      onChange={(e) => handleAddressChange(e, 'billingAddress', 3)}
                      placeholder="City"
                      readOnly={!isFetchingAddress && !!ticketData.billingAddress[3]}
                    />
                  </Form.Group>
                </div>
              </Form.Group>

              {/* Shipping Address Section (uses ticketData.shippingAddressObj object) */}
              <Form.Group className="mb-3 col-md-6">
                <div className="d-flex justify-content-between align-items-center">
                  <Form.Label>Shipping Address</Form.Label>
                  <Form.Check
                    type="checkbox"
                    label="Same as Billing Address"
                    checked={ticketData.shippingSameAsBilling || false}
                    onChange={handleSameAsBillingChange}
                    className="mb-2"
                  />
                </div>
                <Form.Group className="mb-2">
                  <Form.Label>Address Line 1 <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    required={!ticketData.shippingSameAsBilling}
                    value={ticketData.shippingAddressObj?.address1 || ""}
                    onChange={(e) => handleAddressChange(e, 'shippingAddressObj', 'address1')}
                    placeholder="Address line 1"
                    disabled={ticketData.shippingSameAsBilling}
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>Address Line 2</Form.Label>
                  <Form.Control
                    value={ticketData.shippingAddressObj?.address2 || ""}
                    onChange={(e) => handleAddressChange(e, 'shippingAddressObj', 'address2')}
                    placeholder="Address line 2"
                    disabled={ticketData.shippingSameAsBilling}
                  />
                </Form.Group>
                <div className="row">
                  <Form.Group className="mb-2 col-md-4">
                    <Form.Label>Pincode <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      required={!ticketData.shippingSameAsBilling}
                      type="text"
                      pattern="[0-9]{6}"
                      value={ticketData.shippingAddressObj?.pincode || ""}
                      onChange={(e) => handlePincodeChange(e, 'shippingAddressObj')}
                      placeholder="Pincode"
                      disabled={isFetchingAddress || ticketData.shippingSameAsBilling}
                    />
                     <Form.Text className="text-muted">
                      6-digit pincode for state/city
                    </Form.Text>
                  </Form.Group>
                  <Form.Group className="mb-2 col-md-4">
                    <Form.Label>State <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      required={!ticketData.shippingSameAsBilling}
                      value={ticketData.shippingAddressObj?.state || ""}
                      onChange={(e) => handleAddressChange(e, 'shippingAddressObj', 'state')}
                      placeholder="State"
                      readOnly={(!isFetchingAddress && !!ticketData.shippingAddressObj?.state) || ticketData.shippingSameAsBilling}
                    />
                  </Form.Group>
                  <Form.Group className="mb-2 col-md-4">
                    <Form.Label>City <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      required={!ticketData.shippingSameAsBilling}
                      value={ticketData.shippingAddressObj?.city || ""}
                      onChange={(e) => handleAddressChange(e, 'shippingAddressObj', 'city')}
                      placeholder="City"
                      readOnly={(!isFetchingAddress && !!ticketData.shippingAddressObj?.city) || ticketData.shippingSameAsBilling}
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
                      <td>{item.hsnSacCode}</td>
                      <td>{item.quantity}</td>
                      <td>₹{(item.price || 0).toFixed(2)}</td>
                      <td>₹{(item.amount || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            <div className="bg-light p-3 rounded">
              <div className="row">
                <div className="col-md-4">
                  <Table bordered size="sm">
                    <tbody>
                      <tr>
                        <td>Total Quantity</td>
                        <td className="text-end"><strong>{ticketData.totalQuantity || 0}</strong></td>
                      </tr>
                      <tr>
                        <td>Total Amount</td>
                        <td className="text-end"><strong>₹{(ticketData.totalAmount || 0).toFixed(2)}</strong></td>
                      </tr>
                    </tbody>
                  </Table>
                </div>
                <div className="col-md-8">
                  <Table bordered size="sm">
                    <tbody>
                      {isSameState ? ( // Use local UI state for display
                        <>
                          <tr>
                            <td>CGST (9%)</td>
                            <td className="text-end">₹{((ticketData.gstAmount || 0) / 2).toFixed(2)}</td>
                          </tr>
                          <tr>
                            <td>SGST (9%)</td>
                            <td className="text-end">₹{((ticketData.gstAmount || 0) / 2).toFixed(2)}</td>
                          </tr>
                        </>
                      ) : (
                        <tr>
                          <td>IGST (18%)</td>
                          <td className="text-end">₹{(ticketData.gstAmount || 0).toFixed(2)}</td>
                        </tr>
                      )}
                      <tr className="table-active">
                        <td><strong>Total Tax</strong></td>
                        <td className="text-end"><strong>₹{(ticketData.gstAmount || 0).toFixed(2)}</strong></td>
                      </tr>
                      <tr className="table-success">
                        <td><strong>Grand Total</strong></td>
                        <td className="text-end"><strong>₹{(ticketData.grandTotal || 0).toFixed(2)}</strong></td>
                      </tr>
                    </tbody>
                  </Table>
                </div>
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer style={modalFooterStyle}>
            <Button variant="secondary" onClick={onHide} disabled={isLoading || isFetchingAddress}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isLoading || isFetchingAddress}>
              {isLoading ? "Creating..." : "Create Ticket"}
            </Button>
          </Modal.Footer>
        </Form>
      </div>
    </div>
  );
};

export default CreateTicketModal;
