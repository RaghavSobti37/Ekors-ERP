import React, { useState, useEffect } from "react";
import axios from "axios";
import { Modal, Button, Form, Table, ProgressBar } from "react-bootstrap";
import Navbar from './components/Navbar.jsx'

export default function Dashboard() {
  const [showModal, setShowModal] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [ticketData, setTicketData] = useState({
    quotationNumber: "",
    billingAddress: "",
    shippingAddress: "",
    goods: [],
    totalQuantity: 0,
    totalAmount: 0,
    gstAmount: 0,
    grandTotal: 0,
    status: "Quotation Sent", // Default status
  });

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const response = await axios.get("http://localhost:3000/tickets");
      setTickets(response.data);
    } catch (error) {
      console.error("Error fetching tickets:", error);
    }
  };

  const addRow = () => {
    setTicketData({
      ...ticketData,
      goods: [
        ...ticketData.goods,
        { srNo: ticketData.goods.length + 1, description: "", hsnSacCode: "", quantity: 1, price: 0, amount: 0 },
      ],
    });
  };

  const handleGoodsChange = (index, field, value) => {
    const updatedGoods = [...ticketData.goods];
    updatedGoods[index][field] = value;
    updatedGoods[index].amount = updatedGoods[index].quantity * updatedGoods[index].price;

    const totalQuantity = updatedGoods.reduce((sum, item) => sum + Number(item.quantity), 0);
    const totalAmount = updatedGoods.reduce((sum, item) => sum + Number(item.amount), 0);
    const gstAmount = totalAmount * 0.18; // 18% GST
    const grandTotal = totalAmount + gstAmount;

    setTicketData({ ...ticketData, goods: updatedGoods, totalQuantity, totalAmount, gstAmount, grandTotal });
  };

  const handleSubmit = async () => {
    try {
      const response = await axios.post("http://localhost:3000/create-ticket", ticketData);
      if (response.status === 201 || response.status === 200) {
        fetchTickets(); // Fetch updated tickets from DB
        setShowModal(false);
        resetForm(); // Reset form fields after submission
      }
    } catch (error) {
      console.error("Error creating ticket:", error);
    }
  };

  const resetForm = () => {
    setTicketData({
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
  };

  const statusStages = [
    "Quotation Sent",
    "PO Received",
    "Payment Pending",
    "Inspection",
    "Packing List",
    "Invoice Sent",
    "Completed",
  ];

  return (

    <div>
      <Navbar />
    <div className="container text2x1 font-bold [#000000]">
      <h2>Open Tickets</h2>
      <Button onClick={() => setShowModal(true)}>Create New Ticket</Button>

      <Table striped bordered hover className="mt-3">
        <thead>
          <tr>
            <th>Ticket Number</th>
            <th>Quotation No</th>
            <th>Date</th>
            <th>Billing Address</th>
            <th>Shipping Address</th>
            <th>Progress</th>
          </tr>
        </thead>
        <tbody>
          {tickets.length > 0 ? (
            tickets.map((ticket, index) => {
              const progressPercentage = ((statusStages.indexOf(ticket.status) + 1) / statusStages.length) * 100;
              return (
                <tr key={index}>
                  <td>{ticket.ticketNumber}</td>
                  <td>{ticket.quotationNumber}</td>
                  <td>{new Date(ticket.date).toLocaleDateString()}</td>
                  <td>{ticket.billingAddress}</td>
                  <td>{ticket.shippingAddress}</td>
                  <td>
                    <ProgressBar now={progressPercentage} label={ticket.status} />
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

      {/* Modal for Creating Ticket */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Create Ticket</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>Quotation Number</Form.Label>
              <Form.Control
                type="text"
                value={ticketData.quotationNumber}
                onChange={(e) => setTicketData({ ...ticketData, quotationNumber: e.target.value })}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Billing Address</Form.Label>
              <Form.Control
                type="text"
                value={ticketData.billingAddress}
                onChange={(e) => setTicketData({ ...ticketData, billingAddress: e.target.value })}
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Shipping Address</Form.Label>
              <Form.Control
                type="text"
                value={ticketData.shippingAddress}
                onChange={(e) => setTicketData({ ...ticketData, shippingAddress: e.target.value })}
              />
            </Form.Group>

            <h5>Goods</h5>
            <Table>
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
                    <td>
                      <Form.Control
                        type="text"
                        value={item.description}
                        onChange={(e) => handleGoodsChange(index, "description", e.target.value)}
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="text"
                        value={item.hsnSacCode}
                        onChange={(e) => handleGoodsChange(index, "hsnSacCode", e.target.value)}
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleGoodsChange(index, "quantity", e.target.value)}
                      />
                    </td>
                    <td>
                      <Form.Control
                        type="number"
                        value={item.price}
                        onChange={(e) => handleGoodsChange(index, "price", e.target.value)}
                      />
                    </td>
                    <td>{item.amount}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Button onClick={addRow}>Add Row</Button>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Close
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Save Ticket
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
    </div>
  );
}
