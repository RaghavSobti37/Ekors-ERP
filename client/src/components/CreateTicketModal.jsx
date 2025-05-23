import React, { useState, useEffect } from "react";
import { Modal, Button, Form, Table } from "react-bootstrap";
import axios from "axios";

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
  const [sameAsBilling, setSameAsBilling] = useState(false);

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
    backgroundColor: 'white',
    border: '1px solid #dee2e6',
    borderRadius: '0.3rem',
    boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
    zIndex: 1050,
    display: show ? 'flex' : 'none',
    flexDirection: 'column',
    overflow: 'hidden' // Prevent double scroll bars
  };

  // Modal header style
  const modalHeaderStyle = {
    borderBottom: '1px solid #dee2e6',
    padding: '1rem',
    flexShrink: 0 // Prevent header from shrinking
  };

  // Modal body style with single scroll
  const modalBodyStyle = {
    flexGrow: 1,
    overflowY: 'auto', // Only scroll the body
    padding: '20px'
  };

  // Modal footer style (sticky at bottom)
  const modalFooterStyle = {
    borderTop: '1px solid #dee2e6',
    padding: '15px',
    flexShrink: 0 // Prevent footer from shrinking
  };

  // Update shipping address when billing address changes and sameAsBilling is checked
  useEffect(() => {
    if (sameAsBilling) {
      setTicketData({
        ...ticketData,
        shippingAddress: [...ticketData.billingAddress]
      });
    }
  }, [sameAsBilling, ticketData.billingAddress]);

  const fetchAddressFromPincode = async (pincode, addressType) => {
    if (!pincode || pincode.length !== 6) {
      console.log("Invalid pincode:", pincode);
      return;
    }
    
    setIsFetchingAddress(true);
    try {
      console.log("Fetching address for pincode:", pincode);
      const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`);
      console.log("API Response:", response.data);
      
      const data = response.data[0];
      
      if (data.Status === "Success") {
        const postOffice = data.PostOffice[0];
        console.log("Post Office Data:", postOffice);
        const newAddress = [...ticketData[addressType]];
        newAddress[2] = postOffice.State; // State
        newAddress[3] = postOffice.District; // City
        newAddress[4] = pincode;
        
        console.log("New Address:", newAddress);
        setTicketData({
          ...ticketData,
          [addressType]: newAddress
        });
      } else {
        console.log("API returned error status:", data.Status, data.Message);
      }
    } catch (error) {
      console.error("Error fetching address:", error);
      if (error.response) {
        console.error("Response data:", error.response.data);
        console.error("Response status:", error.response.status);
      }
    } finally {
      setIsFetchingAddress(false);
    }
  };

  const handlePincodeChange = (e, addressType) => {
    const pincode = e.target.value;
    const newAddress = [...ticketData[addressType]];
    newAddress[4] = pincode;
    
    setTicketData({
      ...ticketData,
      [addressType]: newAddress
    });

    if (pincode.length === 6) {
      setTimeout(() => {
        fetchAddressFromPincode(pincode, addressType);
      }, 0);
    }
  };

  const handleAddressChange = (e, addressType, index) => {
    const value = e.target.value;
    const newAddress = [...ticketData[addressType]];
    newAddress[index] = value;
    
    setTicketData({
      ...ticketData,
      [addressType]: newAddress
    });

    if (sameAsBilling && addressType === 'billingAddress') {
      const newShippingAddress = [...ticketData.shippingAddress];
      newShippingAddress[index] = value;
      
      setTicketData(prevData => ({
        ...prevData,
        shippingAddress: newShippingAddress
      }));
    }
  };

  const handleSameAsBillingChange = (e) => {
    const isChecked = e.target.checked;
    setSameAsBilling(isChecked);
    
    if (isChecked) {
      setTicketData({
        ...ticketData,
        shippingAddress: [...ticketData.billingAddress]
      });
    }
  };

  return (
    <div style={fullScreenModalStyle}>
      <Modal.Header closeButton onHide={onHide} style={modalHeaderStyle}>
        <Modal.Title>Create Ticket from Quotation</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleTicketSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Modal.Body style={modalBodyStyle}>
          {error && <div className="alert alert-danger">{error}</div>}
          
          <div className="row">
            <Form.Group className="mb-3 col-md-6">
              <Form.Label>Company Name <span className="text-danger">*</span></Form.Label>
              <Form.Control
                required
                type="text"
                value={ticketData.companyName}
                onChange={(e) =>
                  setTicketData({
                    ...ticketData,
                    companyName: e.target.value,
                  })
                }
              />
            </Form.Group>
            <Form.Group className="mb-3 col-md-6">
              <Form.Label>Ticket Number</Form.Label>
              <Form.Control
                type="text"
                value={ticketData.ticketNumber}
                readOnly={true}
                disabled={true}
              />
            </Form.Group>
            <Form.Group className="mb-3 col-md-6">
              <Form.Label>Quotation Number <span className="text-danger">*</span></Form.Label>
              <Form.Control
                required
                type="text"
                value={ticketData.quotationNumber}
                readOnly
                disabled
              />
            </Form.Group>
          </div>

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
                  <Form.Label>Pincode*</Form.Label>
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
                    Enter a 6-digit pincode to auto-fill state and city
                  </Form.Text>
                </Form.Group>
                <Form.Group className="mb-2 col-md-4">
                  <Form.Label>State <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    required
                    value={ticketData.billingAddress[2] || ""}
                    onChange={(e) => handleAddressChange(e, 'billingAddress', 2)}
                    placeholder="State"
                    disabled={isFetchingAddress}
                  />
                </Form.Group>
                <Form.Group className="mb-2 col-md-4">
                  <Form.Label>City <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    required
                    value={ticketData.billingAddress[3] || ""}
                    onChange={(e) => handleAddressChange(e, 'billingAddress', 3)}
                    placeholder="City"
                    disabled={isFetchingAddress}
                  />
                </Form.Group>
              </div>
            </Form.Group>

            <Form.Group className="mb-3 col-md-6">
              <div className="d-flex justify-content-between align-items-center">
                <Form.Label>Shipping Address*</Form.Label>
                <Form.Check
                  type="checkbox"
                  label="Same as Billing Address"
                  checked={sameAsBilling}
                  onChange={handleSameAsBillingChange}
                  className="mb-2"
                />
              </div>
              <Form.Group className="mb-2">
                <Form.Label>Address Line 1*</Form.Label>
                <Form.Control
                  required
                  value={ticketData.shippingAddress[0] || ""}
                  onChange={(e) => handleAddressChange(e, 'shippingAddress', 0)}
                  placeholder="Address line 1"
                  disabled={sameAsBilling}
                />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Label>Address Line 2</Form.Label>
                <Form.Control
                  value={ticketData.shippingAddress[1] || ""}
                  onChange={(e) => handleAddressChange(e, 'shippingAddress', 1)}
                  placeholder="Address line 2"
                  disabled={sameAsBilling}
                />
              </Form.Group>
              <div className="row">
                <Form.Group className="mb-2 col-md-4">
                  <Form.Label>Pincode <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    required
                    type="text"
                    pattern="[0-9]{6}"
                    value={ticketData.shippingAddress[4] || ""}
                    onChange={(e) => handlePincodeChange(e, 'shippingAddress')}
                    placeholder="Pincode"
                    disabled={isFetchingAddress || sameAsBilling}
                  />
                  <Form.Text className="text-muted">
                    Enter a 6-digit pincode to auto-fill state and city
                  </Form.Text>
                </Form.Group>
                <Form.Group className="mb-2 col-md-4">
                  <Form.Label>State*</Form.Label>
                  <Form.Control
                    required
                    value={ticketData.shippingAddress[2] || ""}
                    onChange={(e) => handleAddressChange(e, 'shippingAddress', 2)}
                    placeholder="State"
                    disabled={isFetchingAddress || sameAsBilling}
                  />
                </Form.Group>
                <Form.Group className="mb-2 col-md-4">
                  <Form.Label>City*</Form.Label>
                  <Form.Control
                    required
                    value={ticketData.shippingAddress[3] || ""}
                    onChange={(e) => handleAddressChange(e, 'shippingAddress', 3)}
                    placeholder="City"
                    disabled={isFetchingAddress || sameAsBilling}
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
                    <td>₹{item.price.toFixed(2)}</td>
                    <td>₹{item.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="bg-light p-3 rounded">
            <div className="row">
              <div className="col-md-4">
                <p>
                  Total Quantity: <strong>{ticketData.totalQuantity}</strong>
                </p>
              </div>
              <div className="col-md-4">
                <p>
                  Total Amount: <strong>₹{ticketData.totalAmount.toFixed(2)}</strong>
                </p>
              </div>
              <div className="col-md-4">
                <p>
                  GST (18%): <strong>₹{ticketData.gstAmount.toFixed(2)}</strong>
                </p>
              </div>
            </div>
            <div className="row">
              <div className="col-md-12">
                <h5>Grand Total: ₹{ticketData.grandTotal.toFixed(2)}</h5>
              </div>
            </div>
          </div>
          <Modal.Footer style={modalFooterStyle}>
          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isLoading || isFetchingAddress}>
            Create Ticket
            {isLoading ? "Creating..." : "Create Ticket"}
          </Button>
        </Modal.Footer>
        </Modal.Body>
        
      </Form>
    </div>
  );
};

export default CreateTicketModal;