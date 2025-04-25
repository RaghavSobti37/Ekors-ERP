import React from "react";
import { Modal, Button, Form, Table } from "react-bootstrap";

const CreateTicketModal = ({
  show,
  onHide,
  ticketData,
  setTicketData,
  handleTicketSubmit,
  isLoading,
  error,
}) => {
  return (
    <Modal show={show} onHide={onHide} dialogClassName="modal-fullscreen">
      <Modal.Header closeButton>
        <Modal.Title>Create Ticket from Quotation</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleTicketSubmit}>
        <Modal.Body>
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
                  onChange={(e) =>
                    setTicketData({
                      ...ticketData,
                      billingAddress: [
                        e.target.value,
                        ...ticketData.billingAddress.slice(1),
                      ],
                    })
                  }
                  placeholder="Address line 1"
                />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Label>Address Line 2</Form.Label>
                <Form.Control
                  value={ticketData.billingAddress[1] || ""}
                  onChange={(e) =>
                    setTicketData({
                      ...ticketData,
                      billingAddress: [
                        ticketData.billingAddress[0],
                        e.target.value,
                        ...ticketData.billingAddress.slice(2),
                      ],
                    })
                  }
                  placeholder="Address line 2"
                />
              </Form.Group>
              <div className="row">
                <Form.Group className="mb-2 col-md-4">
                  <Form.Label>State <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    required
                    value={ticketData.billingAddress[2] || ""}
                    onChange={(e) =>
                      setTicketData({
                        ...ticketData,
                        billingAddress: [
                          ...ticketData.billingAddress.slice(0, 2),
                          e.target.value,
                          ...ticketData.billingAddress.slice(3),
                        ],
                      })
                    }
                    placeholder="State"
                  />
                </Form.Group>
                <Form.Group className="mb-2 col-md-4">
                  <Form.Label>City <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    required
                    value={ticketData.billingAddress[3] || ""}
                    onChange={(e) =>
                      setTicketData({
                        ...ticketData,
                        billingAddress: [
                          ...ticketData.billingAddress.slice(0, 3),
                          e.target.value,
                          ...ticketData.billingAddress.slice(4),
                        ],
                      })
                    }
                    placeholder="City"
                  />
                </Form.Group>
                <Form.Group className="mb-2 col-md-4">
                  <Form.Label>Pincode <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    required
                    type="text"
                    pattern="[0-9]{6}"
                    value={ticketData.billingAddress[4] || ""}
                    onChange={(e) =>
                      setTicketData({
                        ...ticketData,
                        billingAddress: [
                          ...ticketData.billingAddress.slice(0, 4),
                          e.target.value,
                        ],
                      })
                    }
                    placeholder="Pincode"
                  />
                </Form.Group>
              </div>
            </Form.Group>

            <Form.Group className="mb-3 col-md-6">
              <Form.Label>Shipping Address</Form.Label>
              <Form.Group className="mb-2">
                <Form.Label>Address Line 1 <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  required
                  value={ticketData.shippingAddress[0] || ""}
                  onChange={(e) =>
                    setTicketData({
                      ...ticketData,
                      shippingAddress: [
                        e.target.value,
                        ...ticketData.shippingAddress.slice(1),
                      ],
                    })
                  }
                  placeholder="Address line 1"
                />
              </Form.Group>
              <Form.Group className="mb-2">
                <Form.Label>Address Line 2</Form.Label>
                <Form.Control
                  value={ticketData.shippingAddress[1] || ""}
                  onChange={(e) =>
                    setTicketData({
                      ...ticketData,
                      shippingAddress: [
                        ticketData.shippingAddress[0],
                        e.target.value,
                        ...ticketData.shippingAddress.slice(2),
                      ],
                    })
                  }
                  placeholder="Address line 2"
                />
              </Form.Group>
              <div className="row">
                <Form.Group className="mb-2 col-md-4">
                  <Form.Label>State <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    required
                    value={ticketData.shippingAddress[2] || ""}
                    onChange={(e) =>
                      setTicketData({
                        ...ticketData,
                        shippingAddress: [
                          ...ticketData.shippingAddress.slice(0, 2),
                          e.target.value,
                          ...ticketData.shippingAddress.slice(3),
                        ],
                      })
                    }
                    placeholder="State"
                  />
                </Form.Group>
                <Form.Group className="mb-2 col-md-4">
                  <Form.Label>City <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    required
                    value={ticketData.shippingAddress[3] || ""}
                    onChange={(e) =>
                      setTicketData({
                        ...ticketData,
                        shippingAddress: [
                          ...ticketData.shippingAddress.slice(0, 3),
                          e.target.value,
                          ...ticketData.shippingAddress.slice(4),
                        ],
                      })
                    }
                    placeholder="City"
                  />
                </Form.Group>
                <Form.Group className="mb-2 col-md-4">
                  <Form.Label>Pincode <span className="text-danger">*</span></Form.Label>
                  <Form.Control
                    required
                    type="text"
                    pattern="[0-9]{6}"
                    value={ticketData.shippingAddress[4] || ""}
                    onChange={(e) =>
                      setTicketData({
                        ...ticketData,
                        shippingAddress: [
                          ...ticketData.shippingAddress.slice(0, 4),
                          e.target.value,
                        ],
                      })
                    }
                    placeholder="Pincode"
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
                  Total Amount:{" "}
                  <strong>₹{ticketData.totalAmount.toFixed(2)}</strong>
                </p>
              </div>
              <div className="col-md-4">
                <p>
                  GST (18%):{" "}
                  <strong>₹{ticketData.gstAmount.toFixed(2)}</strong>
                </p>
              </div>
            </div>
            <div className="row">
              <div className="col-md-12">
                <h5>Grand Total: ₹{ticketData.grandTotal.toFixed(2)}</h5>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={isLoading}>
            {isLoading ? "Creating..." : "Create Ticket"}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default CreateTicketModal;