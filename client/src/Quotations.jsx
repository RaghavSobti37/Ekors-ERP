import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import { Modal, Button, Form, Table, Alert } from "react-bootstrap";
import Navbar from "./components/Navbar.jsx";
import { useAuth } from "./context/AuthContext";
import { useNavigate } from "react-router-dom";

const formatDateForInput = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const GoodsTable = ({ goods, handleGoodsChange, currentQuotation, isEditing }) => {
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
                                {!isEditing ? (
                                    item.description
                                ) : (
                                    <Form.Control
                                        required
                                        type="text"
                                        value={item.description}
                                        onChange={(e) =>
                                            handleGoodsChange(index, "description", e.target.value)
                                        }
                                    />
                                )}
                            </td>
                            <td>
                                {!isEditing ? (
                                    item.hsnSacCode
                                ) : (
                                    <Form.Control
                                        required
                                        type="text"
                                        value={item.hsnSacCode}
                                        onChange={(e) =>
                                            handleGoodsChange(index, "hsnSacCode", e.target.value)
                                        }
                                    />
                                )}
                            </td>
                            <td>
                                {!isEditing ? (
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
                                {!isEditing ? (
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
                            <td className="align-middle">₹{item.amount.toFixed(2)}</td>
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
    const [quotationsCount, setQuotationsCount] = useState(0);
    const [sortConfig, setSortConfig] = useState({
        key: null,
        direction: "ascending",
    });
    const [searchTerm, setSearchTerm] = useState("");
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    
    // Function to get authentication data from localStorage
    const getAuthToken = () => {
        try {
          const userData = JSON.parse(localStorage.getItem('erp-user'));
          if (!userData || typeof userData !== 'object') {
            return null;
          }
          return userData.token;
        } catch (e) {
          console.error('Failed to parse user data:', e);
          return null;
        }
      };

      const generateQuotationNumber = () => {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
        
        return `Q-${day}${month}-${hours}${minutes}${seconds}${milliseconds}`;
    };

      // Update your modal opening function
      const openCreateModal = async () => {
        setCurrentQuotation(null);
        
        // Generate the new quotation number
        const newQuotationNumber = generateQuotationNumber();
        
        setQuotationData({
            ...initialQuotationData,
            referenceNumber: newQuotationNumber
        });
        
        setShowModal(true);
    };

    const initialQuotationData = {
        date: formatDateForInput(new Date()),
        referenceNumber: generateQuotationNumber(),
        validityDate: formatDateForInput(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)),
        dispatchDays: 7,
        orderIssuedBy: "",
        goods: [],
        totalQuantity: 0,
        totalAmount: 0,
        gstAmount: 0,
        grandTotal: 0,
        client: {
            companyName: "",
            gstNumber: "",
            email: "",
            phone: "",
        },
    };

    const [quotationData, setQuotationData] = useState(initialQuotationData);

    const fetchQuotations = useCallback(async () => {
        if (loading || !user) return;
        
        setIsLoading(true);
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }
            
            const response = await axios.get("http://localhost:3000/api/quotations", {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            setQuotations(response.data);
            setQuotationsCount(response.data.length); // Store the count
            setError(null);
        } catch (error) {
            console.error("Error fetching quotations:", error);
            setError(
                error.response?.data?.message ||
                error.message ||
                "Failed to load quotations. Please try again."
            );
            
            if (error.response?.status === 401) {
                navigate('/login', { state: { from: '/quotations' } });
            }
        } finally {
            setIsLoading(false);
        }
    }, [user, loading, navigate]);

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login', { state: { from: '/quotations' } });
        } else {
            fetchQuotations();
        }
    }, [user, loading, navigate, fetchQuotations]);

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

    const filteredQuotations = useMemo(() => {
        if (!searchTerm) return sortedQuotations;
        
        const term = searchTerm.toLowerCase();
        return sortedQuotations.filter(quotation => 
            quotation.referenceNumber?.toLowerCase().includes(term) ||
            quotation.client?.companyName?.toLowerCase().includes(term) ||
            quotation.client?.gstNumber?.toLowerCase().includes(term) ||
            quotation.goods.some(item => 
                item.description?.toLowerCase().includes(term) ||
                item.hsnSacCode?.toLowerCase().includes(term)
            )
        );
    }, [sortedQuotations, searchTerm]);

    const requestSort = (key) => {
        let direction = "ascending";
        if (sortConfig.key === key && sortConfig.direction === "ascending") {
            direction = "descending";
        }
        setSortConfig({ key, direction });
    };

    const addGoodsRow = () => {
        const newGoods = [...quotationData.goods, {
            srNo: quotationData.goods.length + 1,
            description: "",
            hsnSacCode: "",
            quantity: 1,
            price: 0,
            amount: 0,
        }];
    
        setQuotationData({
            ...quotationData,
            goods: newGoods
        });
    };

    const handleGoodsChange = (index, field, value) => {
        const updatedGoods = [...quotationData.goods];
    
        if (['quantity', 'price', 'amount'].includes(field)) {
            value = Number(value);
        }
    
        updatedGoods[index][field] = value;
    
        if (field === 'quantity' || field === 'price') {
            updatedGoods[index].amount = updatedGoods[index].quantity * updatedGoods[index].price;
        }
    
        const totalQuantity = updatedGoods.reduce(
            (sum, item) => sum + item.quantity,
            0
        );
        const totalAmount = updatedGoods.reduce(
            (sum, item) => sum + item.amount,
            0
        );
        const gstAmount = totalAmount * 0.18;
        const grandTotal = totalAmount + gstAmount;
    
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

        if (name.startsWith("client.")) {
            const field = name.split(".")[1];
            setQuotationData(prev => ({
                ...prev,
                client: {
                    ...prev.client,
                    [field]: value
                }
            }));
        } else {
            setQuotationData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setFormValidated(true);
        
        // Validate form and goods
        const form = event.currentTarget;
        if (form.checkValidity() === false || quotationData.goods.length === 0) {
            event.stopPropagation();
            return;
        }
    
        setIsLoading(true);
        try {
            const token = getAuthToken();
            if (!token) {
                throw new Error('No authentication token found');
            }
    
            // Prepare the submission data
            const submissionData = {
                referenceNumber: currentQuotation 
                    ? quotationData.referenceNumber 
                    : generateQuotationNumber(),
                date: new Date(quotationData.date).toISOString(),
                validityDate: new Date(quotationData.validityDate).toISOString(),
                dispatchDays: Number(quotationData.dispatchDays),
                orderIssuedBy: quotationData.orderIssuedBy,
                goods: quotationData.goods.map(item => ({
                    srNo: item.srNo,
                    description: item.description,
                    hsnSacCode: item.hsnSacCode,
                    quantity: Number(item.quantity),
                    price: Number(item.price),
                    amount: Number(item.amount),
                })),
                totalQuantity: Number(quotationData.totalQuantity),
                totalAmount: Number(quotationData.totalAmount),
                gstAmount: Number(quotationData.gstAmount),
                grandTotal: Number(quotationData.grandTotal),
                client: {
                    companyName: quotationData.client.companyName,
                    gstNumber: quotationData.client.gstNumber,
                    email: quotationData.client.email,
                    phone: String(quotationData.client.phone),
                }
            };
    
            // Determine API endpoint and method
            const url = currentQuotation
                ? `http://localhost:3000/api/quotations/${currentQuotation._id}`
                : "http://localhost:3000/api/quotations";
            
            const method = currentQuotation ? "put" : "post";
    
            // Make the API call
            const response = await axios[method](url, submissionData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
    
            if (response.status === 200 || response.status === 201) {
                fetchQuotations();
                setShowModal(false);
                resetForm();
                setError(null);
                setCurrentQuotation(null);
            }
        } catch (error) {
            console.error("Error saving quotation:", error);
            let errorMessage = "Failed to save quotation. Please try again.";
            
            if (error.response) {
                errorMessage = error.response.data.message || 
                             error.response.data.error || 
                             errorMessage;
                
                if (error.response.status === 401) {
                    navigate('/login', { state: { from: '/quotations' } });
                    return;
                }
            } else if (error.request) {
                errorMessage = "No response from server. Please check your connection.";
            }
            
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setQuotationData(initialQuotationData);
        setFormValidated(false);
    };

    const handleCreateTicket = (quotation) => {
        window.location.href = `/create-ticket?quotationId=${quotation._id}`;
    };


    const handleEdit = (quotation) => {
        setCurrentQuotation(quotation);
        setQuotationData({
            date: formatDateForInput(quotation.date),
            referenceNumber: quotation.referenceNumber,
            validityDate: formatDateForInput(quotation.validityDate),
            dispatchDays: quotation.dispatchDays,
            packingCharges: quotation.packingCharges,
            orderIssuedBy: quotation.orderIssuedBy,
            goods: quotation.goods.map(item => ({
                ...item,
                quantity: Number(item.quantity),
                price: Number(item.price),
                amount: Number(item.amount)
            })),
            totalQuantity: Number(quotation.totalQuantity),
            totalAmount: Number(quotation.totalAmount),
            gstAmount: Number(quotation.gstAmount),
            grandTotal: Number(quotation.grandTotal),
            client: {
                companyName: quotation.client?.companyName || "",
                gstNumber: quotation.client?.gstNumber || "",
                email: quotation.client?.email || "",
                phone: quotation.client?.phone || "",
            },
        });
        setShowModal(true);
    };

    const getFieldValue = (fieldName) => {
        if (fieldName.startsWith("client.")) {
            const field = fieldName.split(".")[1];
            return quotationData.client[field];
        }
        return quotationData[fieldName];
    };

    return (
        <div>
            <Navbar />
            <div className="container mt-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                    <h2 style={{ color: "black" }}>Quotations</h2>
                    <div className="d-flex align-items-center gap-3" style={{ width: "50%" }}>
                        <Form.Control
                            type="search"
                            placeholder="Search here"
                            className="me-2"
                            aria-label="Search"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                borderRadius: "20px",
                                padding: "8px 20px",
                                border: "1px solid #ced4da",
                                boxShadow: "none"
                            }}
                        />
                        <Button
                            variant="primary"
                            onClick={() => {
                                setCurrentQuotation(null);
                                setShowModal(true);
                                handleCreateNew();
                            }}
                        >
                            Create New Quotation
                        </Button>
                    </div>
                </div>

                {error && <Alert variant="danger">{error}</Alert>}

                <Table striped bordered hover responsive className="mt-3">
                    <thead className="table-dark">
                        <tr>
                            <th
                                onClick={() => requestSort("referenceNumber")}
                                style={{ cursor: "pointer" }}
                            >
                                Reference No{" "}
                                <SortIndicator
                                    columnKey="referenceNumber"
                                    sortConfig={sortConfig}
                                />
                            </th>
                            <th
                                onClick={() => requestSort("client.companyName")}
                                style={{ cursor: "pointer" }}
                            >
                                Company Name{" "}
                                <SortIndicator
                                    columnKey="client.companyName"
                                    sortConfig={sortConfig}
                                />
                            </th>
                            <th
                                onClick={() => requestSort("client.gstNumber")}
                                style={{ cursor: "pointer" }}
                            >
                                GST Number{" "}
                                <SortIndicator
                                    columnKey="client.gstNumber"
                                    sortConfig={sortConfig}
                                />
                            </th>
                            <th
                                onClick={() => requestSort("grandTotal")}
                                style={{ cursor: "pointer" }}
                            >
                                Grand Total (₹){" "}
                                <SortIndicator columnKey="grandTotal" sortConfig={sortConfig} />
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
                        ) : filteredQuotations.length > 0 ? (
                            filteredQuotations.map((quotation) => (
                                <tr key={quotation._id}>
                                    <td>{quotation.referenceNumber}</td>
                                    <td>{quotation.client?.companyName}</td>
                                    <td>{quotation.client?.gstNumber}</td>
                                    <td className="text-end">
                                        {quotation.grandTotal.toFixed(2)}
                                    </td>
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

                <Modal show={showModal} onHide={() => {
                    setShowModal(false);
                    setCurrentQuotation(null);
                    resetForm();
                }} size="xl" fullscreen="md-down">
                    <Modal.Header closeButton>
                        <Modal.Title>
                            {currentQuotation ? "Edit Quotation" : "Create New Quotation"}
                        </Modal.Title>
                    </Modal.Header>
                    <Form noValidate validated={formValidated} onSubmit={handleSubmit}>
                        <Modal.Body>
                            <div className="row">
                                <Form.Group className="mb-3 col-md-4">
                                    <Form.Label>
                                        Date <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Control
                                        required
                                        type="date"
                                        name="date"
                                        value={quotationData.date}
                                        onChange={handleInputChange}
                                        disabled={!!currentQuotation}
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3 col-md-4">
                                    <Form.Label>
                                        Quotation Number <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Control
                                        required
                                        type="text"
                                        name="referenceNumber"
                                        value={quotationData.referenceNumber}
                                        placeholder="Quotation Number"
                                        disabled
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3 col-md-4">
                                    <Form.Label>
                                        Validity Date <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Control
                                        required
                                        type="date"
                                        name="validityDate"
                                        value={quotationData.validityDate}
                                        onChange={handleInputChange}
                                        disabled={!!currentQuotation}
                                    />
                                </Form.Group>
                            </div>

                            <div className="row">
                                <Form.Group className="mb-3 col-md-6">
                                    <Form.Label>
                                        Company Name <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Control
                                        required
                                        type="text"
                                        name="client.companyName"
                                        value={quotationData.client.companyName}
                                        onChange={handleInputChange}
                                        placeholder="Enter company name"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3 col-md-6">
                                    <Form.Label>
                                        GST Number <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Control
                                        required
                                        type="text"
                                        name="client.gstNumber"
                                        value={quotationData.client.gstNumber}
                                        onChange={handleInputChange}
                                        placeholder="GST Number"
                                    />
                                </Form.Group>
                            </div>

                            <div className="row">
                                <Form.Group className="mb-3 col-md-6">
                                    <Form.Label>
                                        Contact Email <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Control
                                        required
                                        type="email"
                                        name="client.email"
                                        value={quotationData.client.email}
                                        onChange={handleInputChange}
                                        placeholder="Client email"
                                    />
                                </Form.Group>

                                <Form.Group className="mb-3 col-md-6">
                                    <Form.Label>
                                        Contact Phone <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Control
                                        required
                                        type="tel"
                                        name="client.phone"
                                        value={quotationData.client.phone}
                                        onChange={handleInputChange}
                                        placeholder="Client Phone"
                                    />
                                </Form.Group>
                            </div>

                            <div className="row">
                                <Form.Group className="mb-3 col-md-6">
                                    <Form.Label>
                                        Order Issued By <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Control
                                        required
                                        type="text"
                                        name="orderIssuedBy"
                                        value={getFieldValue("orderIssuedBy")}
                                        onChange={handleInputChange}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3 col-md-4">
                                    <Form.Label>
                                        Dispatch Days <span className="text-danger">*</span>
                                    </Form.Label>
                                    <Form.Control
                                        required
                                        type="number"
                                        min="1"
                                        name="dispatchDays"
                                        value={getFieldValue("dispatchDays")}
                                        onChange={handleInputChange}
                                    />
                                </Form.Group>
                            </div>

                            <h5 className="mt-4">Goods Details <span className="text-danger">*</span></h5>

                            {!currentQuotation && quotationData.goods.length === 0 && (
                                <Alert variant="warning">Please add at least one item</Alert>
                            )}

                            <GoodsTable
                                goods={quotationData.goods}
                                handleGoodsChange={handleGoodsChange}
                                currentQuotation={currentQuotation}
                                isEditing={true}
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
                                            Total Quantity: <strong>{quotationData.totalQuantity}</strong>
                                        </p>
                                    </div>
                                    <div className="col-md-4">
                                        <p>
                                            Total Amount: <strong>₹{quotationData.totalAmount.toFixed(2)}</strong>
                                        </p>
                                    </div>
                                    <div className="col-md-4">
                                        <p>
                                            GST (18%): <strong>₹{quotationData.gstAmount.toFixed(2)}</strong>
                                        </p>
                                    </div>
                                </div>
                                <div className="row">
                                    <div className="col-md-12">
                                        <h5>Grand Total: ₹{quotationData.grandTotal.toFixed(2)}</h5>
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