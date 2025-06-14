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
    // Define the company's reference state (e.g., based on a known pincode or configuration)
  // For '201301' (Noida), the state is Uttar Pradesh.
  const COMPANY_REFERENCE_STATE = "UTTAR PRADESH";
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [isSameState, setIsSameState] = useState(true); // Track if billing and shipping states are same

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
    maxHeight: 'calc(95vh - 120px)',
    overflowY: 'auto',
    padding: '20px'
  };

  // Modal footer style (sticky at bottom)
  const modalFooterStyle = {
    position: 'sticky',
    bottom: 0,
    zIndex: 1050,
    backgroundColor: 'white',
    borderTop: '1px solid #dee2e6',
    padding: '15px'
  };

  // Check if states are same whenever billing or shipping state changes
  useEffect(() => {
    calculateTaxes();
  }, [      ticketData.billingAddress, // For billing state
      ticketData.goods, // For item amounts and their individual GST rates
      ticketData.totalAmount,    // Sum of item.amount (pre-GST)
      ]);

  // Update shipping address when billing address changes and sameAsBilling is checked
  useEffect(() => {
    if (sameAsBilling) {
      const newShippingAddress = [...ticketData.billingAddress];
      setTicketData({
        ...ticketData,
        shippingAddress: newShippingAddress
      });
      setIsSameState(true);
    }
  }, [sameAsBilling, ticketData.billingAddress]);

  // Function to calculate taxes based on whether states are same
const calculateTaxes = () => {
    if (!ticketData.goods || !ticketData.billingAddress) {
      setTicketData(prev => ({
        ...prev,
        gstBreakdown: [],
        totalCgstAmount: 0,
        totalSgstAmount: 0,
        totalIgstAmount: 0,
        finalGstAmount: 0,
        grandTotal: prev.totalAmount || 0, // totalAmount is sum of item.amount before GST
        isBillingStateSameAsCompany: false,
      }));
      return;
    }

    const billingState = (ticketData.billingAddress[2] || "").toUpperCase().trim();
    const isBillingStateSameAsCompany = billingState === COMPANY_REFERENCE_STATE.toUpperCase().trim();

    const gstGroups = {}; // Group items by their GST rate

    (ticketData.goods || []).forEach(item => {
      const itemGstRate = parseFloat(item.gstRate); // Each item should have a gstRate
      if (itemGstRate > 0 && item.amount > 0) {
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
      const taxableAmount = group.taxableAmount;
      let cgstAmount = 0, sgstAmount = 0, igstAmount = 0;
      let cgstRate = 0, sgstRate = 0, igstRate = 0;

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

      newGstBreakdown.push({
        itemGstRate: itemGstRate,
        taxableAmount: taxableAmount,
        cgstRate: cgstRate,
        cgstAmount: cgstAmount,
        sgstRate: sgstRate,
        sgstAmount: sgstAmount,
        igstRate: igstRate,
        igstAmount: igstAmount,
      });
    }

    const finalGstAmount = runningTotalCgst + runningTotalSgst + runningTotalIgst;
    const currentTotalAmount = ticketData.totalAmount || 0; // Sum of item.amount (pre-GST)
    const grandTotal = currentTotalAmount + finalGstAmount;

    setTicketData(prev => ({
      ...prev,
  gstBreakdown: newGstBreakdown,
      totalCgstAmount: runningTotalCgst,
      totalSgstAmount: runningTotalSgst,
      totalIgstAmount: runningTotalIgst,
      finalGstAmount: finalGstAmount,
      grandTotal,
        isBillingStateSameAsCompany: isBillingStateSameAsCompany
    }));
  };

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
      setIsSameState(true);
    }
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
                  type="text"
                  value={ticketData.companyName}
                  onChange={(e) =>
                    setTicketData({
                      ...ticketData,
                      companyName: e.target.value,
                    })
                  } // This onChange will not be triggered if readOnly is true
                  readOnly // Make Company Name read-only
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
                      readOnly={!isFetchingAddress && !!ticketData.billingAddress[2]} // Read-only if fetched/pre-filled and not fetching
                    />
                  </Form.Group>
                  <Form.Group className="mb-2 col-md-4">
                    <Form.Label>City <span className="text-danger">*</span></Form.Label>
                    <Form.Control
                      required
                      value={ticketData.billingAddress[3] || ""}
                      onChange={(e) => handleAddressChange(e, 'billingAddress', 3)}
                      placeholder="City"
                      readOnly={!isFetchingAddress && !!ticketData.billingAddress[3]} // Read-only if fetched/pre-filled and not fetching
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
                      readOnly={(!isFetchingAddress && !!ticketData.shippingAddress[2]) || sameAsBilling}
                    />
                  </Form.Group>
                  <Form.Group className="mb-2 col-md-4">
                    <Form.Label>City*</Form.Label>
                    <Form.Control
                      required
                      value={ticketData.shippingAddress[3] || ""}
                      onChange={(e) => handleAddressChange(e, 'shippingAddress', 3)}
                      placeholder="City"
                      readOnly={(!isFetchingAddress && !!ticketData.shippingAddress[3]) || sameAsBilling}
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
                {/* <div className="col-md-4">
                  <p>
                    Total Quantity: <strong>{ticketData.totalQuantity}</strong>
                  </p>
                </div> */}
                <div className="bg-light p-3 rounded">
                  <div className="row">
                    <div className="col-md-4">
                      <Table bordered size="sm">
                        <tbody>
                          <tr>
                            <td>Total Quantity</td>
                            <td className="text-end"><strong>{ticketData.totalQuantity}</strong></td>
                          </tr>
                          <tr>
                            <td>Total Amount</td>
                            <td className="text-end"><strong>₹{ticketData.totalAmount.toFixed(2)}</strong></td>
                          </tr>
                        </tbody>
                      </Table>
                    </div>
                    <div className="col-md-8">
                      <Table bordered size="sm">
                        {/* <thead>
                          <tr>
                            <th>Tax Description</th>
                            <th className="text-end">Amount (₹)</th>
                          </tr>
                        </thead> */}
                        <tbody>
                           {(ticketData.gstBreakdown || []).map((gstGroup, index) => (
                        <React.Fragment key={index}>
                          {ticketData.isBillingStateSameAsCompany ? (
                            <>
                              <tr>
                                <td>CGST ({gstGroup.cgstRate.toFixed(2)}% on ₹{gstGroup.taxableAmount.toFixed(2)})</td>
                                <td className="text-end">₹{(gstGroup.cgstAmount || 0).toFixed(2)}</td>
                              </tr>
                              <tr>
                                <td>SGST ({gstGroup.sgstRate.toFixed(2)}% on ₹{gstGroup.taxableAmount.toFixed(2)})</td>
                                <td className="text-end">₹{(gstGroup.sgstAmount || 0).toFixed(2)}</td>
                              </tr>
                            </>
                          ) : (
                            <tr>
                              <td>IGST ({gstGroup.igstRate.toFixed(2)}% on ₹{gstGroup.taxableAmount.toFixed(2)})</td>
                              <td className="text-end">₹{(gstGroup.igstAmount || 0).toFixed(2)}</td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                          <tr className="table-active">
                            <td><strong>Total Tax</strong></td>
                            <td className="text-end">
                          <strong>
                            ₹
                            {ticketData.isBillingStateSameAsCompany
                              ? ((ticketData.totalCgstAmount || 0) + (ticketData.totalSgstAmount || 0)).toFixed(2)
                              : (ticketData.totalIgstAmount || 0).toFixed(2)}
                          </strong>
                        </td>
                          </tr>
                          <tr className="table-success">
                            <td><strong>Grand Total</strong></td>
                            <td className="text-end"><strong>₹{ticketData.grandTotal.toFixed(2)}</strong></td>
                          </tr>
                        </tbody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>
              {/* <div className="row">
                <div className="col-md-12">
                  <h5>Grand Total: ₹{ticketData.grandTotal.toFixed(2)}</h5>
                </div>
              </div> */}
            </div>
          </Modal.Body>
          <Modal.Footer style={modalFooterStyle}>
            <Button variant="secondary" onClick={onHide}>
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