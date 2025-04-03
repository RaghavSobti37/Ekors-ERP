import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Modal,
  Button,
  Form,
  Table,
  ProgressBar,
  Alert,
} from "react-bootstrap";
import Navbar from "./components/Navbar.jsx";

export default function Dashboard() {
  const [showModal, setShowModal] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [ticketData, setTicketData] = useState({
    companyName: "",
    quotationNumber: "",
    billingAddress: "",
    shippingAddress: "",
    goods: [],
    totalQuantity: 0,
    totalAmount: 0,
    gstAmount: 0,
    grandTotal: 0,
    status: "Quotation Sent",
  });
  const [formValidated, setFormValidated] = useState(false);

  const statusStages = [
    "Quotation Sent",
    "PO Received",
    "Payment Pending",
    "Inspection",
    "Packing List",
    "Invoice Sent",
    "Completed",
  ];

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("http://localhost:3000/tickets");
      // Sort tickets by date (newest first)
      const sortedTickets = response.data.sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      );
      setTickets(sortedTickets);
      setError(null);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      setError("Failed to load tickets. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const addRow = () => {
    setTicketData({
      ...ticketData,
      goods: [
        ...ticketData.goods,
        {
          srNo: ticketData.goods.length + 1,
          description: "",
          hsnSacCode: "",
          quantity: 1,
          price: 0,
          amount: 0,
        },
      ],
    });
  };

  const handleGoodsChange = (index, field, value) => {
    const updatedGoods = [...ticketData.goods];
    updatedGoods[index][field] = value;
    updatedGoods[index].amount =
      updatedGoods[index].quantity * updatedGoods[index].price;

    const totalQuantity = updatedGoods.reduce(
      (sum, item) => sum + Number(item.quantity),
      0
    );
    const totalAmount = updatedGoods.reduce(
      (sum, item) => sum + Number(item.amount),
      0
    );
    const gstAmount = totalAmount * 0.18;
    const grandTotal = totalAmount + gstAmount;

    setTicketData({
      ...ticketData,
      goods: updatedGoods,
      totalQuantity,
      totalAmount,
      gstAmount,
      grandTotal,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormValidated(true);

    const form = event.currentTarget;
    if (form.checkValidity() === false || ticketData.goods.length === 0) {
      event.stopPropagation();
      return;
    }

    try {
      // Generate sequential ticket number
      const nextTicketNumber = `T-${(tickets.length + 1)
        .toString()
        .padStart(6, "0")}`;

      const ticketToSubmit = {
        ...ticketData,
        ticketNumber: nextTicketNumber,
        date: new Date().toISOString(),
        companyName: ticketData.companyName,
      };

      const response = await axios.post(
        "http://localhost:3000/create-ticket",
        ticketToSubmit
      );
      if (response.status === 201 || response.status === 200) {
        fetchTickets();
        setShowModal(false);
        resetForm();
      }
    } catch (error) {
      console.error("Error creating ticket:", error);
      setError("Failed to create ticket. Please try again.");
    }
  };

  const resetForm = () => {
    setTicketData({
      companyName: "",
      quotationNumber: "",
      billingAddress: "",
      shippingAddress: "",
      goods: [],
      totalQuantity: 0,
      totalAmount: 0,
      gstAmount: 0,
      grandTotal: 0,
      status: "Quotation Sent",
    });
    setFormValidated(false);
  };

  return (
    <div>
      <Navbar />
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>Open Tickets</h2>
          <Button variant="primary" onClick={() => setShowModal(true)}>
            Create New Ticket
          </Button>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <Table striped bordered hover responsive className="mt-3">
          <thead className="table-dark">
            <tr>
              <th>Ticket Number</th>
              <th>Quotation No</th>
              <th>Company Name</th>
              <th>Date</th>
              <th>Grand Total (₹)</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="6" className="text-center">
                  Loading tickets...
                </td>
              </tr>
            ) : tickets.length > 0 ? (
              tickets.map((ticket) => {
                const progressPercentage = Math.round(
                  ((statusStages.indexOf(ticket.status) + 1) /
                    statusStages.length) *
                    100
                );
                return (
                  <tr key={ticket.ticketNumber}>
                    <td>{ticket.ticketNumber}</td>
                    <td>{ticket.quotationNumber}</td>
                    <td>{ticket.companyName}</td>
                    <td>
                      {new Date(ticket.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="text-end">{ticket.grandTotal.toFixed(2)}</td>
                    <td>
                      <div className="d-flex flex-column">
                        <ProgressBar
                          now={progressPercentage}
                          label={`${progressPercentage}%`}
                          variant={getProgressBarVariant(progressPercentage)}
                          className="mb-1"
                          style={{ height: "20px" }}
                        />
                        <small className="text-center fw-bold">
                          {ticket.status}
                        </small>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="text-center">
                  No tickets found.
                </td>
              </tr>
            )}
          </tbody>
        </Table>

        <Modal
          show={showModal}
          onHide={() => {
            setShowModal(false);
            resetForm();
          }}
          size="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>Create New Ticket</Modal.Title>
          </Modal.Header>
          <Form noValidate validated={formValidated} onSubmit={handleSubmit}>
            <Modal.Body>
              <div className="row">
                <Form.Group className="mb-3 col-md-6">
                  <Form.Label>Date</Form.Label>
                  <Form.Control
                    type="text"
                    value={new Date().toLocaleDateString()}
                    readOnly
                    disabled
                  />
                </Form.Group>
              </div>
              <div className="row">
                <Form.Group className="mb-3 col-md-6">
                  <Form.Label>Company Name*</Form.Label>
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
                    placeholder="Enter company name"
                  />
                  <Form.Control.Feedback type="invalid">
                    Please provide a company name.
                  </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-3 col-md-6">
                  <Form.Label>Quotation Number*</Form.Label>
                  <Form.Control
                    required
                    type="text"
                    value={ticketData.quotationNumber}
                    onChange={(e) =>
                      setTicketData({
                        ...ticketData,
                        quotationNumber: e.target.value,
                      })
                    }
                    placeholder="Enter quotation number"
                  />
                  <Form.Control.Feedback type="invalid">
                    Please provide a quotation number.
                  </Form.Control.Feedback>
                </Form.Group>
              </div>

              <div className="row">
                <Form.Group className="mb-3 col-md-6">
                  <Form.Label>Billing Address*</Form.Label>
                  <Form.Control
                    required
                    as="textarea"
                    rows={3}
                    value={ticketData.billingAddress}
                    onChange={(e) =>
                      setTicketData({
                        ...ticketData,
                        billingAddress: e.target.value,
                      })
                    }
                    placeholder="Enter billing address"
                  />
                </Form.Group>

                <Form.Group className="mb-3 col-md-6">
                  <Form.Label>Shipping Address*</Form.Label>
                  <Form.Control
                    required
                    as="textarea"
                    rows={3}
                    value={ticketData.shippingAddress}
                    onChange={(e) =>
                      setTicketData({
                        ...ticketData,
                        shippingAddress: e.target.value,
                      })
                    }
                    placeholder="Enter shipping address"
                  />
                </Form.Group>
              </div>

              <h5 className="mt-4">Goods Details*</h5>
              {ticketData.goods.length === 0 && (
                <Alert variant="warning">Please add at least one item</Alert>
              )}
              <div className="table-responsive">
                <Table bordered className="mb-3">
                  <thead>
                    <tr>
                      <th>Sr No.</th>
                      <th>Description*</th>
                      <th>HSN/SAC*</th>
                      <th>Qty*</th>
                      <th>Price*</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticketData.goods.map((item, index) => (
                      <tr key={index}>
                        <td>{item.srNo}</td>
                        <td>
                          <Form.Control
                            required
                            type="text"
                            value={item.description}
                            onChange={(e) =>
                              handleGoodsChange(
                                index,
                                "description",
                                e.target.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <Form.Control
                            required
                            type="text"
                            value={item.hsnSacCode}
                            onChange={(e) =>
                              handleGoodsChange(
                                index,
                                "hsnSacCode",
                                e.target.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <Form.Control
                            required
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              handleGoodsChange(
                                index,
                                "quantity",
                                e.target.value
                              )
                            }
                          />
                        </td>
                        <td>
                          <Form.Control
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.price}
                            onChange={(e) =>
                              handleGoodsChange(index, "price", e.target.value)
                            }
                          />
                        </td>
                        <td className="align-middle">
                          ₹{item.amount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              <Button
                variant="outline-primary"
                onClick={addRow}
                className="mb-3"
              >
                + Add Item
              </Button>

              <div className="bg-light p-3 rounded">
                <div className="row">
                  <div className="col-md-4">
                    <p>
                      Total Quantity:{" "}
                      <strong>{ticketData.totalQuantity}</strong>
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
              <Button
                variant="secondary"
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit">
                Create Ticket
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>
      </div>
    </div>
  );
}

function getProgressBarVariant(percentage) {
  if (percentage < 30) return "danger";
  if (percentage < 70) return "warning";
  return "success";
}
