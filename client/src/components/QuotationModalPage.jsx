import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Form, Button, Alert, Spinner, Table } from 'react-bootstrap';
import ClientSearchComponent from './ClientSearchComponent';
import QuotationSearchComponent from './QuotationSearchComponent';

const QuotationPage = () => {
  const { id } = useParams(); // For edit mode
  const navigate = useNavigate();
  
  // State management
  const [quotationData, setQuotationData] = useState({
    referenceNumber: '',
    date: '',
    validityDate: '',
    status: 'open',
    client: {
      companyName: '',
      clientName: '',
      gstNumber: '',
      email: '',
      phone: '',
      _id: null
    },
    billingAddress: {
      address1: '',
      address2: '',
      city: '',
      state: '',
      pincode: ''
    },
    goods: [],
    totalQuantity: 0,
    totalAmount: 0,
    gstAmount: 0,
    grandTotal: 0
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [formValidated, setFormValidated] = useState(false);
  const [selectedClientIdForForm, setSelectedClientIdForForm] = useState(null);
  const [isReplicating, setIsReplicating] = useState(false);
  const [isLoadingReplicationDetails, setIsLoadingReplicationDetails] = useState(false);
  const [isFetchingBillingAddress, setIsFetchingBillingAddress] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [isItemSearchDropdownOpenInModal, setIsItemSearchDropdownOpenInModal] = useState(false);

  // Load quotation data if in edit mode
  useEffect(() => {
    if (id) {
      const fetchQuotation = async () => {
        setIsLoading(true);
        try {
          // Replace with your actual API call
          const response = await fetch(`/api/quotations/${id}`);
          const data = await response.json();
          setQuotationData(data);
          if (data.client._id) {
            setSelectedClientIdForForm(data.client._id);
          }
        } catch (err) {
          setError('Failed to load quotation data');
        } finally {
          setIsLoading(false);
        }
      };
      fetchQuotation();
    }
  }, [id]);

  // Form handlers
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setQuotationData(prev => {
      const keys = name.split('.');
      if (keys.length === 1) {
        return { ...prev, [name]: value };
      } else if (keys.length === 2) {
        return { ...prev, [keys[0]]: { ...prev[keys[0]], [keys[1]]: value } };
      } else if (keys.length === 3) {
        return { 
          ...prev, 
          [keys[0]]: { 
            ...prev[keys[0]], 
            [keys[1]]: { 
              ...prev[keys[0]][keys[1]], 
              [keys[2]]: value 
            } 
          } 
        };
      }
      return prev;
    });
  };

  const handleClientSelect = (client) => {
    setSelectedClientIdForForm(client._id);
    setQuotationData(prev => ({
      ...prev,
      client: {
        companyName: client.companyName,
        clientName: client.contactPerson || '',
        gstNumber: client.gstNumber || '',
        email: client.email || '',
        phone: client.phone || '',
        _id: client._id
      },
      billingAddress: client.billingAddress || {
        address1: '',
        address2: '',
        city: '',
        state: '',
        pincode: ''
      }
    }));
  };

  const handleReplicationSelect = async (quotation) => {
    setIsLoadingReplicationDetails(true);
    try {
      // Replace with your actual API call
      const response = await fetch(`/api/quotations/${quotation._id}`);
      const data = await response.json();
      setQuotationData(data);
      if (data.client._id) {
        setSelectedClientIdForForm(data.client._id);
      }
    } catch (err) {
      setError('Failed to load quotation details for replication');
    } finally {
      setIsLoadingReplicationDetails(false);
    }
  };

  const handleAddItem = () => {
    setQuotationData(prev => ({
      ...prev,
      goods: [...prev.goods, {
        sn: prev.goods.length + 1,
        description: '',
        hsnSacCode: '',
        quantity: 1,
        unit: 'NOS',
        price: 0,
        amount: 0,
        gstRate: 18,
        subtexts: []
      }]
    }));
  };

  const handleDeleteItem = (index) => {
    setQuotationData(prev => ({
      ...prev,
      goods: prev.goods.filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, sn: i + 1 }))
    }));
  };

  const handleAddSubtext = (itemIndex) => {
    setQuotationData(prev => {
      const newGoods = [...prev.goods];
      newGoods[itemIndex].subtexts = [...(newGoods[itemIndex].subtexts || []), ''];
      return { ...prev, goods: newGoods };
    });
  };

  const handleDeleteSubtext = (itemIndex, subtextIndex) => {
    setQuotationData(prev => {
      const newGoods = [...prev.goods];
      newGoods[itemIndex].subtexts = newGoods[itemIndex].subtexts.filter((_, i) => i !== subtextIndex);
      return { ...prev, goods: newGoods };
    });
  };

  const handleGoodsChange = (updatedGoods) => {
    setQuotationData(prev => ({
      ...prev,
      goods: updatedGoods,
      // Recalculate totals
      totalQuantity: updatedGoods.reduce((sum, item) => sum + Number(item.quantity), 0),
      totalAmount: updatedGoods.reduce((sum, item) => sum + Number(item.amount), 0),
      gstAmount: updatedGoods.reduce((sum, item) => sum + (Number(item.amount) * Number(item.gstRate) / 100), 0),
      grandTotal: updatedGoods.reduce((sum, item) => sum + Number(item.amount), 0) + 
        updatedGoods.reduce((sum, item) => sum + (Number(item.amount) * Number(item.gstRate) / 100), 0)
    }));
  };

  const handleSaveClientDetails = async () => {
    setIsSavingClient(true);
    try {
      // Replace with your actual API call
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          companyName: quotationData.client.companyName,
          contactPerson: quotationData.client.clientName,
          gstNumber: quotationData.client.gstNumber,
          email: quotationData.client.email,
          phone: quotationData.client.phone,
          billingAddress: quotationData.billingAddress
        })
      });
      const data = await response.json();
      setSelectedClientIdForForm(data._id);
      setQuotationData(prev => ({
        ...prev,
        client: {
          ...prev.client,
          _id: data._id
        }
      }));
    } catch (err) {
      setError('Failed to save client details');
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const form = e.currentTarget;
    if (form.checkValidity() === false) {
      setFormValidated(true);
      return;
    }

    setIsSaving(true);
    try {
      const method = id ? 'PUT' : 'POST';
      const url = id ? `/api/quotations/${id}` : '/api/quotations';
      
      // Replace with your actual API call
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(quotationData)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save quotation');
      }
      
      const data = await response.json();
      navigate(`/quotations/${data._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setQuotationData({
      referenceNumber: '',
      date: '',
      validityDate: '',
      status: 'open',
      client: {
        companyName: '',
        clientName: '',
        gstNumber: '',
        email: '',
        phone: '',
        _id: null
      },
      billingAddress: {
        address1: '',
        address2: '',
        city: '',
        state: '',
        pincode: ''
      },
      goods: [],
      totalQuantity: 0,
      totalAmount: 0,
      gstAmount: 0,
      grandTotal: 0
    });
    setSelectedClientIdForForm(null);
    setFormValidated(false);
    setError('');
  };

  return (
    <div className="container mt-4">
      <div className="card">
        <div className="card-header">
          <h2 className="mb-0">
            {id ? `Edit Quotation - ${quotationData.referenceNumber}` : 'Create New Quotation'}
          </h2>
        </div>
        
        <div className="card-body">
          <Form noValidate validated={formValidated} onSubmit={handleSubmit}>
            {!id && (
              <>
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Replicate Existing Quotation?"
                    checked={isReplicating}
                    onChange={(e) => setIsReplicating(e.target.checked)}
                  />
                </Form.Group>
                {isReplicating && !isLoadingReplicationDetails && (
                  <QuotationSearchComponent
                    onQuotationSelect={handleReplicationSelect}
                    placeholder="Search quotation to replicate..."
                  />
                )}
                {isLoadingReplicationDetails && (
                  <div className="text-center my-3">
                    <Spinner animation="border" />{' '}
                    <p>Loading quotation details...</p>
                  </div>
                )}
              </>
            )}
            
            {error && <Alert variant="danger">{error}</Alert>}
            
            <div className="row">
              <Form.Group className="mb-3 col-md-4">
                <Form.Label>
                  Issue Date <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  required
                  type="date"
                  name="date"
                  value={quotationData.date}
                  onChange={handleInputChange}
                  disabled={isLoadingReplicationDetails}
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
                  disabled={isLoadingReplicationDetails}
                />
              </Form.Group>
              
              {new Date(quotationData.validityDate) < new Date(quotationData.date) && (
                <Alert variant="warning" className="mt-0 mb-2 p-2 small">
                  Warning: Validity date is before the issue date.
                </Alert>
              )}
              
              <Form.Group className="mb-3 col-md-4">
                <Form.Label>
                  Status <span className="text-danger">*</span>
                </Form.Label>
                {(id && (quotationData.status === 'running' || quotationData.status === 'closed')) || 
                quotationData.status === 'running' || 
                quotationData.status === 'closed' ? (
                  <Form.Control
                    type="text"
                    value={quotationData.status.charAt(0).toUpperCase() + quotationData.status.slice(1)}
                    readOnly
                    disabled={isLoadingReplicationDetails}
                  />
                ) : (
                  <Form.Select
                    required
                    name="status"
                    value={quotationData.status}
                    onChange={handleInputChange}
                    disabled={isLoadingReplicationDetails}
                  >
                    <option value="open">Open</option>
                    <option value="hold">Hold</option>
                  </Form.Select>
                )}
              </Form.Group>
            </div>

            <h5 className="section-header">Client Details</h5>
            <div className="row mb-3">
              <div className="col-12">
                <ClientSearchComponent
                  onClientSelect={handleClientSelect}
                  placeholder="Search & select client"
                  currentClientId={selectedClientIdForForm}
                  disabled={isLoadingReplicationDetails}
                />
              </div>
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
                  onChange={!selectedClientIdForForm ? handleInputChange : undefined}
                  readOnly={!!selectedClientIdForForm}
                  disabled={isLoadingReplicationDetails}
                />
              </Form.Group>
              
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>
                  Client Name (Contact Person) <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  required
                  type="text"
                  name="client.clientName"
                  value={quotationData.client.clientName || ''}
                  onChange={!selectedClientIdForForm ? handleInputChange : undefined}
                  readOnly={!!selectedClientIdForForm}
                  disabled={isLoadingReplicationDetails}
                  placeholder="Enter contact person's name"
                />
              </Form.Group>
            </div>
            
            <div className="row">
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>
                  GST Number <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  required
                  type="text"
                  name="client.gstNumber"
                  value={quotationData.client.gstNumber}
                  onChange={!selectedClientIdForForm ? handleInputChange : undefined}
                  readOnly={!!selectedClientIdForForm}
                  disabled={isLoadingReplicationDetails}
                />
              </Form.Group>
              
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>
                  Email <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="email"
                  name="client.email"
                  value={quotationData.client.email}
                  onChange={!selectedClientIdForForm ? handleInputChange : undefined}
                  readOnly={!!selectedClientIdForForm}
                  disabled={isLoadingReplicationDetails}
                />
              </Form.Group>
            </div>
            
            <div className="row mb-3 align-items-end">
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>
                  Phone <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  type="tel"
                  name="client.phone"
                  value={quotationData.client.phone}
                  onChange={!selectedClientIdForForm ? handleInputChange : undefined}
                  readOnly={!!selectedClientIdForForm}
                  disabled={isLoadingReplicationDetails}
                />
              </Form.Group>
              
              <div className="col-md-6 d-flex gap-2 justify-content-start justify-content-md-end align-items-center mb-3">
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={() => {
                    setSelectedClientIdForForm(null);
                    setQuotationData(prev => ({
                      ...prev,
                      client: {
                        ...initialQuotationData.client,
                        _id: null,
                      },
                    }));
                  }}
                  disabled={isLoadingReplicationDetails || !selectedClientIdForForm}
                >
                  Clear/Edit Client Details
                </Button>
                
                <Button
                  variant="success"
                  size="sm"
                  onClick={handleSaveClientDetails}
                  disabled={
                    isSavingClient ||
                    isLoadingReplicationDetails ||
                    !!selectedClientIdForForm ||
                    !(
                      quotationData.client.companyName &&
                      quotationData.client.gstNumber &&
                      quotationData.client.clientName &&
                      quotationData.client.phone
                    )
                  }
                >
                  {isSavingClient ? 'Saving...' : 'Save New Client'}
                </Button>
              </div>
            </div>
            
            <h5 className="section-header">Billing Address</h5>
            <div className="row">
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>
                  Address Line 1 <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  required
                  type="text"
                  name="billingAddress.address1"
                  value={quotationData.billingAddress.address1}
                  onChange={handleInputChange}
                  disabled={isLoadingReplicationDetails || isFetchingBillingAddress}
                />
              </Form.Group>
              
              <Form.Group className="mb-3 col-md-6">
                <Form.Label>Address Line 2</Form.Label>
                <Form.Control
                  type="text"
                  name="billingAddress.address2"
                  value={quotationData.billingAddress.address2}
                  onChange={handleInputChange}
                  disabled={isLoadingReplicationDetails || isFetchingBillingAddress}
                />
              </Form.Group>
            </div>
            
            <div className="row">
              <Form.Group className="mb-3 col-md-4">
                <Form.Label>
                  Pincode <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  required
                  type="text"
                  name="billingAddress.pincode"
                  value={quotationData.billingAddress.pincode}
                  pattern="[0-9]{6}"
                  onChange={handleInputChange}
                  disabled={isLoadingReplicationDetails || isFetchingBillingAddress}
                />
                <Form.Text className="text-muted">
                  Enter 6-digit pincode to auto-fill City & State.
                </Form.Text>
              </Form.Group>
              
              <Form.Group className="mb-3 col-md-4">
                <Form.Label>
                  City <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  required
                  type="text"
                  name="billingAddress.city"
                  value={quotationData.billingAddress.city}
                  onChange={handleInputChange}
                  disabled={isLoadingReplicationDetails || isFetchingBillingAddress}
                  readOnly={
                    !(isLoadingReplicationDetails || isFetchingBillingAddress) && 
                    !!quotationData.billingAddress.city
                  }
                />
              </Form.Group>
              
              <Form.Group className="mb-3 col-md-4">
                <Form.Label>
                  State <span className="text-danger">*</span>
                </Form.Label>
                <Form.Control
                  required
                  type="text"
                  name="billingAddress.state"
                  value={quotationData.billingAddress.state}
                  onChange={handleInputChange}
                  disabled={isLoadingReplicationDetails || isFetchingBillingAddress}
                  readOnly={
                    !(isLoadingReplicationDetails || isFetchingBillingAddress) && 
                    !!quotationData.billingAddress.state
                  }
                />
              </Form.Group>
            </div>

            <h5 className="section-header">Goods Details</h5>
            <GoodsTable
              goods={quotationData.goods}
              handleGoodsChange={handleGoodsChange}
              isEditing={true}
              onAddItem={handleAddItem}
              onDeleteItem={handleDeleteItem}
              onAddSubtext={handleAddSubtext}
              onDeleteSubtext={handleDeleteSubtext}
              onItemSearchDropdownToggle={setIsItemSearchDropdownOpenInModal}
            />
            
            {isItemSearchDropdownOpenInModal && (
              <div style={{ height: '300px' }}></div>
            )}
            
            <div className="bg-light p-3 rounded mt-3">
              <h5 className="text-center mb-3">Quotation Summary</h5>
              <Table bordered size="sm">
                <tbody>
                  <tr>
                    <td>Total Quantity</td>
                    <td className="text-end">
                      <strong>{quotationData.totalQuantity}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Total Amount (Subtotal)</td>
                    <td className="text-end">
                      <strong>₹{quotationData.totalAmount.toFixed(2)}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Total GST</td>
                    <td className="text-end">
                      <strong>₹{quotationData.gstAmount.toFixed(2)}</strong>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>
                      Grand Total
                    </td>
                    <td
                      className="text-end"
                      style={{ fontWeight: 'bold', fontSize: '1.1rem' }}
                    >
                      <strong>₹{quotationData.grandTotal.toFixed(2)}</strong>
                    </td>
                  </tr>
                </tbody>
              </Table>
            </div>
            
            <div className="d-flex justify-content-between mt-4">
              <Button
                variant="secondary"
                onClick={() => navigate(-1)}
                disabled={isLoading || isLoadingReplicationDetails}
              >
                Cancel
              </Button>
              
              <Button
                variant="primary"
                type="submit"
                disabled={isLoading || isLoadingReplicationDetails || isSaving}
              >
                {isSaving ? (id ? 'Updating...' : 'Saving...') : (id ? 'Update Quotation' : 'Save Quotation')}
              </Button>
            </div>
          </Form>
        </div>
      </div>
    </div>
  );
};

// Add this to your CSS or as a style tag
const sectionHeaderStyle = {
  fontWeight: 'bold',
  textAlign: 'center',
  backgroundColor: '#f0f2f5',
  padding: '0.5rem',
  borderRadius: '0.25rem',
  marginBottom: '1rem'
};

export default QuotationPage;