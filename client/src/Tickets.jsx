import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import {
  Modal,
  Button,
  Form,
  Table,
  ProgressBar,
  Alert,
  Dropdown,
} from "react-bootstrap";
import Navbar from "./components/Navbar.jsx";
import Searchbar from "./components/Searchbar.jsx";
import {
  PDFViewer,
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  PDFDownloadLink,
} from "@react-pdf/renderer";

// PDF Document Templates


// import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: "Helvetica" },
  header: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: "center",
    fontWeight: "bold",
  },
  section: { marginBottom: 15 },
  row: {
    flexDirection: "row",
    marginBottom: 8,
    borderBottom: "1px solid #eee",
    paddingBottom: 8,
  },
  label: { width: 150, fontWeight: "bold" },
  value: { flex: 1 },
  table: { display: "table", width: "auto", marginTop: 20 },
  tableRow: { flexDirection: "row" },
  tableColHeader: {
    width: "25%",
    fontWeight: "bold",
    border: "1px solid #000",
    padding: 5,
  },
  tableCol: { width: "25%", border: "1px solid #000", padding: 5 },


  page: {
    padding: 30,
    fontSize: 11,
    fontFamily: "Helvetica",
  },
  header: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  section: {
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: "25%",
    fontWeight: "bold",
  },
  value: {
    width: "75%",
  },
  addressBlock: {
    marginTop: 5,
    marginBottom: 15,
  },
  table: {
    borderWidth: 1,
    borderColor: "#000",
    marginTop: 10,
  },
  tableRow: {
    flexDirection: "row",
  },
  tableHeader: {
    backgroundColor: "#f0f0f0",
    fontWeight: "bold",
  },
  tableCol: {
    borderRightWidth: 1,
    borderColor: "#000",
    padding: 4,
    textAlign: "center",
  },
  snCol: {
    width: "10%",
  },
  descCol: {
    width: "40%",
  },
  unitCol: {
    width: "10%",
  },
  qtyCol: {
    width: "10%",
  },
  rateCol: {
    width: "15%",
  },
  amtCol: {
    width: "15%",
    borderRightWidth: 0,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 5,
    fontWeight: "bold",
  },
  terms: {
    marginTop: 15,
    fontSize: 9,
    lineHeight: 1.5,
  },
  footer: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 10,
    color: "red",
  },
});

const QuotationTemplate = ({ ticket }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}></Text>

      <View style={styles.section}>
        <Text>CIN NO- U40106UP2020PTC127954</Text>
        <Text>Ref: E-KORS/2025-26</Text>
        
      </View>

      <View style={styles.section}>
        <Text>To,</Text>
        <Text>{ticket.companyName}</Text>
        
        <Text>Site:- Assam</Text>
        <Text>Sub: Quotation for Earthing Material and Installation</Text>
      </View>

      <Text style={styles.section}>
        Dear Sir,{"\n"}Thanks for your enquiry of <Text style={{ fontWeight: "bold" }}>Earthing Items</Text>. 
        As per your requirement, here we are giving you our prices. Kindly view it.
      </Text>

      <Text style={{ fontWeight: "bold", marginTop: 10 }}>Supply & Installation</Text>

      <View style={styles.table}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={[styles.tableCol, styles.snCol]}>S. No</Text>
          <Text style={[styles.tableCol, styles.descCol]}>Item Description</Text>
          <Text style={[styles.tableCol, styles.unitCol]}>Unit</Text>
          <Text style={[styles.tableCol, styles.qtyCol]}>Qty</Text>
          <Text style={[styles.tableCol, styles.rateCol]}>Rate</Text>
          <Text style={[styles.tableCol, styles.amtCol]}>Amount</Text>
        </View>

        {ticket.goods.map((item, index) => (
          <View style={styles.tableRow} key={index}>
            <Text style={[styles.tableCol, styles.snCol]}>{index + 1}</Text>
            <Text style={[styles.tableCol, styles.descCol]}>{item.description}</Text>
            <Text style={[styles.tableCol, styles.unitCol]}>{item.unit}</Text>
            <Text style={[styles.tableCol, styles.qtyCol]}>{item.quantity}</Text>
            <Text style={[styles.tableCol, styles.rateCol]}>
              ₹{item.price.toFixed(2)}
            </Text>
            <Text style={[styles.tableCol, styles.amtCol]}>
              ₹{(item.price * item.quantity).toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.totalRow}>
        <Text>Total: ₹{ticket.totalAmount.toFixed(2)}</Text>
      </View>

      <View style={styles.terms}>
        <Text>Terms & Conditions:</Text>
        <Text>Material is Ex-Factory Noida</Text>
        <Text>GST:     18% extra applicable</Text>
        <Text>Payment:     100% advance before dispatch</Text>
        <Text>Freight:     Extra on actual before dispatch</Text>
        <Text>Dispatch:     Within 10 days after receiving Formal PO and Advance</Text>
        <Text>E-way bill:     As applicable</Text>
        <Text>Quotation Validity:     11 April 2025</Text>
        <Text>PO Name:     Order to be placed in the name of "E-KORS PVT LTD"</Text> 
        
      </View>

      <Text style={{ marginTop: 10 }}>
        Hoping for your valuable order at the earliest.
      </Text>
      <Text style={{ marginTop: 10 }}>Thanking you in anticipation.</Text>
      <Text style={{ marginTop: 10 }}>For E-KORS Private Limited</Text>

      <Text style={styles.footer}>
        E-KORS PVT LTD{"\n"}
        Com Add: Plot No. C2, Sector 115, Noida – 201307{"\n"}
        Ph. No. 9711127989 / 9870262345{"\n"}
        Email: info@kors.co.in , Sales@kors.co.in{"\n"}
        GST No. – 09AAFCE8706R1ZV
      </Text>
    </Page>
  </Document>
);



const SortIndicator = ({ columnKey, sortConfig }) => {
  if (sortConfig.key !== columnKey) return <span>↕️</span>;
  return sortConfig.direction === "ascending" ? (
    <span>⬆️</span>
  ) : (
    <span>⬇️</span>
  );
};

export default function Dashboard() {
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editTicket, setEditTicket] = useState(null);
  const [documentType, setDocumentType] = useState(null);
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
    documents: {
      // Initialize documents object
      quotation: "",
      po: "",
      pi: "",
      challan: "",
      packingList: "",
      feedback: "",
    },
  });
  const [formValidated, setFormValidated] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: null,
    direction: "ascending",
  });

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
      console.log("Fetched tickets:", response.data);
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
  const sortedTickets = useMemo(() => {
    if (!sortConfig.key) return tickets;

    return [...tickets].sort((a, b) => {
      if (sortConfig.key === "date") {
        const dateA = new Date(a.createdAt);
        const dateB = new Date(b.createdAt);
        return sortConfig.direction === "ascending"
          ? dateA - dateB
          : dateB - dateA;
      }
      if (sortConfig.key === "grandTotal") {
        return sortConfig.direction === "ascending"
          ? a.grandTotal - b.grandTotal
          : b.grandTotal - a.grandTotal;
      }

      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === "ascending" ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === "ascending" ? 1 : -1;
      }
      return 0;
    });
  }, [tickets, sortConfig]);

  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
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
      documents: {
        quotation: "",
        po: "",
        pi: "",
        challan: "",
        packingList: "",
        feedback: "",
      },
    });
    setFormValidated(false);
  };

  const handleEdit = (ticket) => {

    //debugging
    console.log("Editing ticket:", ticket);
    console.log("Ticket ID:", ticket._id);


    setEditTicket(ticket);
    setTicketData({
      companyName: ticket.companyName,
      quotationNumber: ticket.quotationNumber,
      billingAddress: ticket.billingAddress,
      shippingAddress: ticket.shippingAddress,
      goods: ticket.goods,
      totalQuantity: ticket.totalQuantity,
      totalAmount: ticket.totalAmount,
      gstAmount: ticket.gstAmount,
      grandTotal: ticket.grandTotal,
      status: ticket.status,
      documents: ticket.documents || {
        // Fallback if documents don't exist
        quotation: "",
        po: "",
        pi: "",
        challan: "",
        packingList: "",
        feedback: "",
      },
    });
    setShowEditModal(true);
  };

  const handleStatusChange = (status) => {
    setTicketData({ ...ticketData, status });
  };

  const handleUpdateTicket = async () => {
    try {
      console.log("Updating ticket with ID:", editTicket._id);
      
      // Prepare the update data
      const updateData = {
        ...ticketData,
        // Ensure we don't send React-specific properties
        _id: undefined,
        __v: undefined,
        createdAt: undefined,
        updatedAt: undefined
      };
    
      const response = await axios.put(
        `http://localhost:3000/tickets/${editTicket.id || editTicket._id}`,
        updateData,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.status === 200) {
        fetchTickets(); // Refresh the ticket list
        setShowEditModal(false);
        setError(null); // Clear any previous errors
      }
    } catch (error) {
      console.error("Error updating ticket:", error);
      console.error("Full error object:", JSON.stringify(error, null, 2));
      setError(`Failed to update ticket: ${error.response?.data?.message || error.message}`);
    }
  };


  const renderDocumentSection = () => {
    if (!documentType || !editTicket) return null;

    return (
      <div className="mt-4 p-3 border rounded">
        <h5 className="mt-4">{documentType.toUpperCase()} Document</h5>
        <PDFViewer width="100%" height="500px" className="mb-3">
          {documentType === "quotation" && (
            <QuotationTemplate ticket={editTicket} />
          )}
        </PDFViewer>
        <PDFDownloadLink
          document={
            documentType === "quotation" ? (
              <QuotationTemplate ticket={editTicket} />
            ) : (
              <></>
            )
          }
          fileName={`${documentType}_${editTicket.quotationNumber}.pdf`}
        >
          {({ loading }) => (
            <Button variant="primary" disabled={loading}>
              {loading ? "Generating PDF..." : "Download PDF"}
            </Button>
          )}
        </PDFDownloadLink>
        <Button
          variant="secondary"
          onClick={() => setDocumentType(null)}
          className="ms-2"
        >
          Close
        </Button>
      </div>
    );
  };

  const handleDocumentUpload = async (file, documentType) => {
    try {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("documentType", documentType);

      const response = await axios.post(
        `http://localhost:3000/tickets/${editTicket._id}/documents`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      // Update local state with the new document path
      setTicketData((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          [documentType]: response.data.documents[documentType],
        },
      }));

      // Also update the editTicket reference
      setEditTicket((prev) => ({
        ...prev,
        documents: {
          ...prev.documents,
          [documentType]: response.data.documents[documentType],
        },
      }));

      return true;
    } catch (error) {
      console.error("Error uploading document:", error);
      setError("Failed to upload document");
      return false;
    }
  };

  return (
    <div>
      <Navbar />
      <Searchbar />
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
              <th
                onClick={() => requestSort("ticketNumber")}
                style={{ cursor: "pointer" }}
              >
                Ticket Number{" "}
                <SortIndicator
                  columnKey="ticketNumber"
                  sortConfig={sortConfig}
                />
              </th>
              <th
                onClick={() => requestSort("quotationNumber")}
                style={{ cursor: "pointer" }}
              >
                Quotation No{" "}
                <SortIndicator
                  columnKey="quotationNumber"
                  sortConfig={sortConfig}
                />
              </th>
              <th
                onClick={() => requestSort("companyName")}
                style={{ cursor: "pointer" }}
              >
                Company Name{" "}
                <SortIndicator
                  columnKey="companyName"
                  sortConfig={sortConfig}
                />
              </th>
              <th
                onClick={() => requestSort("date")}
                style={{ cursor: "pointer" }}
              >
                Date <SortIndicator columnKey="date" sortConfig={sortConfig} />
              </th>
              <th
                onClick={() => requestSort("grandTotal")}
                style={{ cursor: "pointer" }}
              >
                Grand Total (₹){" "}
                <SortIndicator columnKey="grandTotal" sortConfig={sortConfig} />
              </th>
              <th>Progress</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan="7" className="text-center">
                  Loading tickets...
                </td>
              </tr>
            ) : sortedTickets.length > 0 ? (
              sortedTickets.map((ticket) => {
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
                    <td>
                      <Button
                        variant="info"
                        size="sm"
                        onClick={() => handleEdit(ticket)}
                      >
                        Edit
                      </Button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="7" className="text-center">
                  No tickets found.
                </td>
              </tr>
            )}
          </tbody>
        </Table>

        {/* Create Ticket Modal */}
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

        {/* Edit Ticket Modal */}
        <Modal
          show={showEditModal}
          onHide={() => setShowEditModal(false)}
          size="xl"
          fullscreen
        >
          <Modal.Header closeButton>
            <Modal.Title>Edit Ticket - {editTicket?.ticketNumber}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {/* Status Progress Bar */}
            <div className="mb-4">
              <ProgressBar style={{ height: "30px" }}>
                {statusStages.map((stage, index) => {
                  const isCompleted =
                    statusStages.indexOf(ticketData.status) >= index;
                  const isCurrent = ticketData.status === stage;
                  return (
                    <ProgressBar
                      key={stage}
                      now={100 / statusStages.length}
                      variant={isCompleted ? "success" : "secondary"}
                      label={isCurrent ? stage : ""}
                      animated={isCurrent}
                    />
                  );
                })}
              </ProgressBar>
            </div>

            {/* Status Update Dropdown */}
            <div className="row mb-4">
              <Form.Group className="col-md-6">
                <Form.Label>Update Status</Form.Label>
                <Dropdown>
                  <Dropdown.Toggle variant="primary" id="status-dropdown">
                    {ticketData.status}
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    {statusStages.map((stage) => (
                      <Dropdown.Item
                        key={stage}
                        onClick={() => handleStatusChange(stage)}
                      >
                        {stage}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                </Dropdown>
              </Form.Group>
              <Form.Group className="col-md-6">
                <Form.Label>Date</Form.Label>
                <Form.Control
                  type="text"
                  value={new Date(editTicket?.createdAt).toLocaleDateString()}
                  readOnly
                  disabled
                />
              </Form.Group>
            </div>

            {/* Company and Quotation Info */}
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
                />
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
                />
              </Form.Group>
            </div>

            {/* Address Information */}
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
                />
              </Form.Group>
            </div>

            {/* Goods Details */}
            <h5 className="mt-4">Goods Details*</h5>
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
                            handleGoodsChange(index, "quantity", e.target.value)
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
            <Button variant="outline-primary" onClick={addRow} className="mb-3">
              + Add Item
            </Button>

            {/* Totals Section */}
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
            {/* Documents Section */}
            <div className="mt-4">
              <h4>Documents</h4>
              <div className="d-flex flex-wrap gap-2 mb-3">
                {Object.entries({
                  quotation: "Quotation",
                  po: "PO",
                  pi: "PI",
                  challan: "Challan",
                  packingList: "Packing List",
                  feedback: "Feedback",
                }).map(([docKey, docName]) => (
                  <div key={docKey} className="d-flex align-items-center gap-2">
                    <Button
                      variant={
                        documentType === docKey ? "primary" : "outline-primary"
                      }
                      onClick={() => setDocumentType(docKey)}
                    >
                      {docName}
                    </Button>
                    {ticketData.documents?.[docKey] && (
                      <a
                        href={`http://localhost:3000/${ticketData.documents[docKey]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-success btn-sm"
                      >
                        View
                      </a>
                    )}
                    <input
                      type="file"
                      id={`upload-${docKey}`}
                      style={{ display: "none" }}
                      onChange={(e) =>
                        handleDocumentUpload(e.target.files[0], docKey)
                      }
                      accept=".pdf,.doc,.docx,.xls,.xlsx"
                    />
                    <label
                      htmlFor={`upload-${docKey}`}
                      className="btn btn-info btn-sm mb-0"
                    >
                      Upload
                    </label>
                  </div>
                ))}
              </div>
              {renderDocumentSection()}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleUpdateTicket}>
              Update Ticket
            </Button>
          </Modal.Footer>
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
