import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { Modal, Button, Form, Table, Alert, Dropdown } from "react-bootstrap";
import Navbar from "./components/Navbar.jsx";
import {
    PDFViewer,
    Document,
    Page,
    Text,
    View,
    StyleSheet,
    PDFDownloadLink,
} from "@react-pdf/renderer";
import { format } from 'date-fns';

// PDF Document Template
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
    label: { width: 200, fontWeight: "bold" },
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
});

// GoodsTable Component - extracted for readability
const GoodsTable = ({ goods, handleGoodsChange, currentQuotation }) => {
    return (
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
                    {goods.map((item, index) => (
                        <tr key={index}>
                            <td>{item.srNo}</td>
                            <td>
                                {currentQuotation ? (
                                    item.description
                                ) : (
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
                                )}
                            </td>
                            <td>
                                {currentQuotation ? (
                                    item.hsnSacCode
                                ) : (
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
                                )}
                            </td>
                            <td>
                                {currentQuotation ? (
                                    item.quantity
                                ) : (
                                    <Form.Control
                                        required
                                        type="number"
                                        min="1"
                                        value={item.quantity}
                                        onChange={(e) =>
                                            handleGoodsChange(index, "quantity", e.target.value)
                                        }
                                    />
                                )}
                            </td>
                            <td>
                                {currentQuotation ? (
                                    item.price.toFixed(2)
                                ) : (
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
                                )}
                            </td>
                            <td className="align-middle">
                                ₹{item.amount.toFixed(2)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </Table>
        </div>
    );
};

const SortIndicator = ({ columnKey, sortConfig }) => {
    if (sortConfig.key !== columnKey) return <span>↕️</span>;
    return sortConfig.direction === "ascending" ? (
        <span>⬆️</span>
    ) : (
        <span>⬇️</span>
    );
};

export default function Quotations() {
    const [showModal, setShowModal] = useState(false);
    const [quotations, setQuotations] = useState([]);
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [currentQuotation, setCurrentQuotation] = useState(null);
    const [formValidated, setFormValidated] = useState(false);
    const [sortConfig, setSortConfig] = useState({
        key: null,
        direction: "ascending",
    });

    // Initial form values
    const initialQuotationData = {
        date: format(new Date(), 'yyyy-MM-dd'),
        referenceNumber: "",
        companyName: "",
        gstNumber: "",
        email: "",
        phone: "",
        ewayBillNumber: "",
        transportId: "",
        vehicleDetails: "",
        billingAddress: "",
        shippingAddress: "",
        bankDetails: "",
        materialLocation: "factory",
        dispatchDays: 7,
        validityDate: format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'),
        packingCharges: 0,
        orderIssuedBy: "",
        goods: [],
        totalQuantity: 0,
        totalAmount: 0,
        gstAmount: 0,
        grandTotal: 0
    };

    const [quotationData, setQuotationData] = useState(initialQuotationData);

    useEffect(() => {
        fetchQuotations();
    }, []);

    const fetchQuotations = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await axios.get("http://localhost:3000/api/quotations");
            setQuotations(response.data);
            setError(null);
        } catch (error) {
            console.error("Error fetching quotations:", error);
            setError(error.response?.data?.message ||
                error.message ||
                "Failed to load quotations. Please try again.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const sortedQuotations = useMemo(() => {
        if (!sortConfig.key) return quotations;

        return [...quotations].sort((a, b) => {
            if (sortConfig.key === "date") {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
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
    }, [quotations, sortConfig]);

    const requestSort = (key) => {
        let direction = "ascending";
        if (sortConfig.key === key && sortConfig.direction === "ascending") {
            direction = "descending";
        }
        setSortConfig({ key, direction });
    };

    const addGoodsRow = () => {
        setQuotationData({
            ...quotationData,
            goods: [
                ...quotationData.goods,
                {
                    srNo: quotationData.goods.length + 1,
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
        const updatedGoods = [...quotationData.goods];
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
        const grandTotal = totalAmount + gstAmount + Number(quotationData.packingCharges);

        setQuotationData({
            ...quotationData,
            goods: updatedGoods,
            totalQuantity,
            totalAmount,
            gstAmount,
            grandTotal,
        });
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        // Recalculate totals if packing charges change
        if (name === "packingCharges") {
            const grandTotal = quotationData.totalAmount + quotationData.gstAmount + Number(value);
            setQuotationData({
                ...quotationData,
                [name]: value,
                grandTotal
            });
        } else {
            setQuotationData({
                ...quotationData,
                [name]: value
            });
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormValidated(true);

        const form = event.currentTarget;
        if (form.checkValidity() === false || quotationData.goods.length === 0) {
            event.stopPropagation();
            return;
        }

        setIsLoading(true);
        try {
            const response = await axios.post(
                "http://localhost:3000/api/quotations",
                quotationData,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.status === 201) {
                fetchQuotations();
                setShowModal(false);
                resetForm();
                setError(null);
            }
        } catch (error) {
            console.error("Error creating quotation:", error);
            setError(error.response?.data?.message ||
                error.message ||
                "Failed to create quotation. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setQuotationData(initialQuotationData);
        setFormValidated(false);
    };

    const handleCreateTicket = (quotation) => {
        // Redirect to tickets page with quotation data
        window.location.href = `/tickets?quotationId=${quotation._id}`;
    };

    const handleEdit = (quotation) => {
        setCurrentQuotation(quotation);
        setQuotationData({
            date: quotation.date,
            referenceNumber: quotation.referenceNumber,
            companyName: quotation.companyName,
            gstNumber: quotation.gstNumber,
            email: quotation.email,
            phone: quotation.phone,
            ewayBillNumber: quotation.ewayBillNumber,
            transportId: quotation.transportId,
            vehicleDetails: quotation.vehicleDetails,
            billingAddress: quotation.billingAddress,
            shippingAddress: quotation.shippingAddress,
            bankDetails: quotation.bankDetails,
            materialLocation: quotation.materialLocation,
            dispatchDays: quotation.dispatchDays,
            validityDate: quotation.validityDate,
            packingCharges: quotation.packingCharges,
            orderIssuedBy: quotation.orderIssuedBy,
            goods: quotation.goods,
            totalQuantity: quotation.totalQuantity,
            totalAmount: quotation.totalAmount,
            gstAmount: quotation.gstAmount,
            grandTotal: quotation.grandTotal
        });
        setShowModal(true);
    };

    // Function to get the value for the form control
    const getFieldValue = (fieldName) => {
        return currentQuotation ? currentQuotation[fieldName] : quotationData[fieldName];
    };

    return (
        <div>
            <Navbar />
            <div className="container mt-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h2 style={{ color: 'black' }}>Quotations</h2>
                    <Button variant="primary" onClick={() => {
                        setCurrentQuotation(null);
                        setShowModal(true);
                    }}>
                        Create New Quotation
                    </Button>
                </div>

                {error && <Alert variant="danger">{error}</Alert>}

                <Table striped bordered hover responsive className="mt-3">
                    <thead className="table-dark">
                        <tr>
                            <th onClick={() => requestSort("referenceNumber")} style={{ cursor: "pointer" }}>
                                Reference No <SortIndicator columnKey="referenceNumber" sortConfig={sortConfig} />
                            </th>
                            <th onClick={() => requestSort("companyName")} style={{ cursor: "pointer" }}>
                                Company Name <SortIndicator columnKey="companyName" sortConfig={sortConfig} />
                            </th>
                            <th onClick={() => requestSort("gstNumber")} style={{ cursor: "pointer" }}>
                                GST Number <SortIndicator columnKey="gstNumber" sortConfig={sortConfig} />
                            </th>
                            <th>Billing Address</th>
                            <th>Shipping Address</th>
                            <th onClick={() => requestSort("grandTotal")} style={{ cursor: "pointer" }}>
                                Grand Total (₹) <SortIndicator columnKey="grandTotal" sortConfig={sortConfig} />
                            </th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan="7" className="text-center">
                                    Loading quotations...
                                </td>
                            </tr>
                        ) : sortedQuotations.length > 0 ? (
                            sortedQuotations.map((quotation) => (
                                <tr key={quotation._id}>
                                    <td>{quotation.referenceNumber}</td>
                                    <td>{quotation.companyName}</td>
                                    <td>{quotation.gstNumber}</td>
                                    <td>{quotation.billingAddress}</td>
                                    <td>{quotation.shippingAddress}</td>
                                    <td className="text-end">{quotation.grandTotal.toFixed(2)}</td>
                                    <td>
                                        <div className="d-flex gap-2">
                                            <Button
                                                variant="info"
                                                size="sm"
                                                onClick={() => handleEdit(quotation)}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                variant="success"
                                                size="sm"
                                                onClick={() => handleCreateTicket(quotation)}
                                            >
                                                Create Ticket
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="7" className="text-center">
                                    No quotations found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </Table>

                {/* Create/Edit Quotation Modal */}
                <Modal
                    show={showModal}
                    onHide={() => {
                        setShowModal(false);
                        setCurrentQuotation(null);
                        resetForm();
                    }}
                    size="xl"
                    fullscreen="md-down"
                >
                    <Modal.Header closeButton>
                        <Modal.Title>
                            {currentQuotation ? "Edit Quotation" : "Create New Quotation"}
                        </Modal.Title>
                    </Modal.Header>
                    <Form noValidate validated={formValidated} onSubmit={handleSubmit}>
                        <Modal.Body>
                            <div className="row">
                                <Form.Group className="mb-3 col-md-4">
                                    <Form.Label>Date*</Form.Label>
                                    <Form.Control
                                        required
                                        type="date"
                                        name="date"
                                        value={getFieldValue("date")}
                                        onChange={handleInputChange}
                                        disabled={!!currentQuotation}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3 col-md-4">
                                    <Form.Label>Reference Number*</Form.Label>
                                    <Form.Control
                                        required
                                        type="text"
                                        name="referenceNumber"
                                        value={getFieldValue("referenceNumber")}
                                        onChange={handleInputChange}
                                        placeholder="Q-2023-001"
                                        disabled={!!currentQuotation}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3 col-md-4">
                                    <Form.Label>Validity Date*</Form.Label>
                                    <Form.Control
                                        required
                                        type="date"
                                        name="validityDate"
                                        value={getFieldValue("validityDate")}
                                        onChange={handleInputChange}
                                        disabled={!!currentQuotation}
                                    />
                                </Form.Group>
                            </div>

                            <div className="row">
                                <Form.Group className="mb-3 col-md-6">
                                    <Form.Label>Company Name*</Form.Label>
                                    <Form.Control
                                        required
                                        type="text"
                                        name="companyName"
                                        value={getFieldValue("companyName")}
                                        onChange={handleInputChange}
                                        placeholder="Enter company name"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3 col-md-6">
                                    <Form.Label>GST Number*</Form.Label>
                                    <Form.Control
                                        required
                                        type="text"
                                        name="gstNumber"
                                        value={getFieldValue("gstNumber")}
                                        onChange={handleInputChange}
                                        placeholder="22AAAAA0000A1Z5"
                                    />
                                </Form.Group>
                            </div>

                            <div className="row">
                                <Form.Group className="mb-3 col-md-6">
                                    <Form.Label>Contact Email*</Form.Label>
                                    <Form.Control
                                        required
                                        type="email"
                                        name="email"
                                        value={getFieldValue("email")}
                                        onChange={handleInputChange}
                                        placeholder="contact@company.com"
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3 col-md-6">
                                    <Form.Label>Contact Phone*</Form.Label>
                                    <Form.Control
                                        required
                                        type="tel"
                                        name="phone"
                                        value={getFieldValue("phone")}
                                        onChange={handleInputChange}
                                        placeholder="9876543210"
                                    />
                                </Form.Group>
                            </div>

                            <div className="row">
                                <Form.Group className="mb-3 col-md-6">
                                    <Form.Label>Billing Address*</Form.Label>
                                    <Form.Control
                                        required
                                        as="textarea"
                                        rows={3}
                                        name="billingAddress"
                                        value={getFieldValue("billingAddress")}
                                        onChange={handleInputChange}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3 col-md-6">
                                    <Form.Label>Shipping Address*</Form.Label>
                                    <Form.Control
                                        required
                                        as="textarea"
                                        rows={3}
                                        name="shippingAddress"
                                        value={getFieldValue("shippingAddress")}
                                        onChange={handleInputChange}
                                    />
                                </Form.Group>
                            </div>

                            <div className="row">
                                <Form.Group className="mb-3 col-md-6">
                                    <Form.Label>Bank Account Details*</Form.Label>
                                    <Form.Control
                                        required
                                        as="textarea"
                                        rows={2}
                                        name="bankDetails"
                                        value={getFieldValue("bankDetails")}
                                        onChange={handleInputChange}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3 col-md-6">
                                    <Form.Label>Order Issued By*</Form.Label>
                                    <Form.Control
                                        required
                                        type="text"
                                        name="orderIssuedBy"
                                        value={getFieldValue("orderIssuedBy")}
                                        onChange={handleInputChange}
                                    />
                                </Form.Group>
                            </div>

                            <div className="row">
                                <Form.Group className="mb-3 col-md-4">
                                    <Form.Label>Material Location*</Form.Label>
                                    <Form.Select
                                        name="materialLocation"
                                        value={getFieldValue("materialLocation")}
                                        onChange={handleInputChange}
                                    >
                                        <option value="factory">Factory</option>
                                        <option value="godown">Godown</option>
                                        <option value="other">Other Location</option>
                                    </Form.Select>
                                </Form.Group>
                                <Form.Group className="mb-3 col-md-4">
                                    <Form.Label>Dispatch Days*</Form.Label>
                                    <Form.Control
                                        required
                                        type="number"
                                        min="1"
                                        name="dispatchDays"
                                        value={getFieldValue("dispatchDays")}
                                        onChange={handleInputChange}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3 col-md-4">
                                    <Form.Label>Packing Charges (₹)*</Form.Label>
                                    <Form.Control
                                        required
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        name="packingCharges"
                                        value={getFieldValue("packingCharges")}
                                        onChange={handleInputChange}
                                    />
                                </Form.Group>
                            </div>

                            <div className="row">
                                <Form.Group className="mb-3 col-md-4">
                                    <Form.Label>E-way Bill Number</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="ewayBillNumber"
                                        value={getFieldValue("ewayBillNumber")}
                                        onChange={handleInputChange}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3 col-md-4">
                                    <Form.Label>Transport ID</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="transportId"
                                        value={getFieldValue("transportId")}
                                        onChange={handleInputChange}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3 col-md-4">
                                    <Form.Label>Vehicle Details</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="vehicleDetails"
                                        value={getFieldValue("vehicleDetails")}
                                        onChange={handleInputChange}
                                    />
                                </Form.Group>
                            </div>

                            <h5 className="mt-4">Goods Details*</h5>
                            {(!currentQuotation && quotationData.goods.length === 0) && (
                                <Alert variant="warning">Please add at least one item</Alert>
                            )}

                            <GoodsTable
                                goods={quotationData.goods}
                                handleGoodsChange={handleGoodsChange}
                                currentQuotation={currentQuotation}
                            />

                            {!currentQuotation && (
                                <Button
                                    variant="outline-primary"
                                    onClick={addGoodsRow}
                                    className="mb-3"
                                >
                                    + Add Item
                                </Button>
                            )}

                            <div className="bg-light p-3 rounded">
                                <div className="row">
                                    <div className="col-md-4">
                                        <p>
                                            Total Quantity:
                                            <strong>{quotationData.totalQuantity}</strong>
                                        </p>
                                    </div>
                                    <div className="col-md-4">
                                        <p>
                                            Total Amount:
                                            <strong>₹{quotationData.totalAmount.toFixed(2)}</strong>
                                        </p>
                                    </div>
                                    <div className="col-md-4">
                                        <p>
                                            GST (18%):
                                            <strong>₹{quotationData.gstAmount.toFixed(2)}</strong>
                                        </p>
                                    </div>
                                </div>
                                <div className="row">
                                    <div className="col-md-12">
                                        <h5>
                                            Grand Total: ₹
                                            {quotationData.grandTotal.toFixed(2)}
                                        </h5>
                                    </div>
                                </div>
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    setShowModal(false);
                                    setCurrentQuotation(null);
                                    resetForm();
                                }}
                            >
                                Close
                            </Button>
                            <Button variant="primary" type="submit">
                                {currentQuotation ? "Update Quotation" : "Save Quotation"}
                            </Button>
                        </Modal.Footer>
                    </Form>
                </Modal>
            </div>
        </div>
    );
}