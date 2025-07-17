import React, { useState, useEffect, useCallback } from "react";
import { Alert, Button as BsButton, Form, Modal, Badge } from "react-bootstrap";
import { PlusCircle, PencilSquare, Trash, ArrowLeft, StarFill } from "react-bootstrap-icons";
import { useAuth } from "../context/AuthContext";
import apiClient from "../utils/apiClient";
import LoadingSpinner from "../components/LoadingSpinner";
import { toast } from "react-toastify";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ReusableModal from "../components/ReusableModal";
import ReusableTable from "../components/ReusableTable";
import "../css/StaticInfo.css";

const StaticInfo = () => {
    const { user } = useAuth();
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Edit Field Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [fieldToEdit, setFieldToEdit] = useState(null);
    const [editValue, setEditValue] = useState("");

    // Add Field/Company Modal State
    const [showAddModal, setShowAddModal] = useState(false);
    const [addModalType, setAddModalType] = useState('company'); // 'company' or 'field'
    // Track all company fields in nested structure
    const [newCompanyData, setNewCompanyData] = useState({
        companyName: '',
        gstin: '',
        cin: '',
        addresses: {
            companyAddress: '',
            officeAddress: ''
        },
        contacts: {
            contactNumbers: '', // comma separated
            email: ''
        },
        bank: {
            bankName: '',
            accountNumber: '',
            ifscCode: '',
            branch: ''
        }
    });
    const [newFieldPath, setNewFieldPath] = useState("");
    const [newFieldValue, setNewFieldValue] = useState("");
    const [addError, setAddError] = useState(null);

    const fetchCompanies = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await apiClient('/company');
            setCompanies(data);
        } catch (err) {
            setError(err.message || "Failed to fetch companies.");
            toast.error("Failed to fetch companies.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCompanies();
    }, [fetchCompanies]);

    // Handlers for field modifications
    const handleEditField = (field) => {
        setFieldToEdit(field);
        setEditValue(field.value);
        setShowEditModal(true);
    };

    const handleSaveField = async () => {
        if (!fieldToEdit || !selectedCompany) return;
        try {
            await apiClient(`/company/${selectedCompany._id}/field`, {
                method: 'PUT',
                body: { field: fieldToEdit.key, value: editValue },
            });
            toast.success(`Field "${fieldToEdit.key}" updated.`);
            // Refresh the selected company's data
            const updatedCompanyData = await apiClient(`/company`);
            setCompanies(updatedCompanyData);
            const freshlyUpdatedCompany = updatedCompanyData.find(c => c._id === selectedCompany._id);
            setSelectedCompany(freshlyUpdatedCompany);
            setShowEditModal(false);
        } catch (err) {
            toast.error(`Failed to update field: ${err.message}`);
        }
    };

    const handleDeleteField = async (fieldKey) => {
        if (!selectedCompany || !window.confirm(`Delete field "${fieldKey}"?`)) return;
        try {
            await apiClient(`/company/${selectedCompany._id}/field`, {
                method: 'DELETE',
                body: { field: fieldKey },
            });
            toast.success(`Field "${fieldKey}" deleted.`);
            const updatedCompanyData = await apiClient(`/company`);
            setCompanies(updatedCompanyData);
            const freshlyUpdatedCompany = updatedCompanyData.find(c => c._id === selectedCompany._id);
            setSelectedCompany(freshlyUpdatedCompany);
        } catch (err) {
            toast.error(`Failed to delete field: ${err.message}`);
        }
    };

    // Handlers for entire company documents
    const handleDeleteCompany = async (companyId) => {
        if (!window.confirm("Are you sure you want to delete this entire company record? This action cannot be undone.")) return;
        try {
            await apiClient(`/company/${companyId}`, { method: 'DELETE' });
            toast.success("Company deleted successfully.");
            fetchCompanies(); // Refresh the list
        } catch (err) {
            toast.error(`Failed to delete company: ${err.data?.message || err.message}`);
        }
    };

    const handleSetDefault = async (companyId) => {
        try {
            await apiClient(`/company/${companyId}/set-default`, { method: 'PATCH' });
            toast.success("Company set as default.");
            fetchCompanies(); // Refresh list to show new default
        } catch (err) {
            toast.error(`Failed to set default: ${err.message}`);
        }
    };

    // Handler for both Add Company and Add Field modals
    const handleAddSubmit = async () => {
        setAddError(null);
        if (addModalType === 'company') {
            if (!newCompanyData.companyName) {
                setAddError("Company Name is required.");
                return;
            }
            try {
                // Send all entered fields as company object
                await apiClient('/company', { method: 'POST', body: { company: newCompanyData } });
                toast.success("New company added.");
                setShowAddModal(false);
                // Reset all fields
                const resetObj = {};
                allCompanyFields.forEach(f => { resetObj[f] = ''; });
                setNewCompanyData(resetObj);
                fetchCompanies();
            } catch (err) {
                setAddError(err.message || "Failed to add company.");
            }
        } else { // 'field'
            if (!newFieldPath.trim() || !newFieldPath.startsWith("company.")) {
                setAddError("Field path must start with 'company.'");
                return;
            }
            try {
                await apiClient(`/company/${selectedCompany._id}/field`, {
                    method: 'PUT',
                    body: { field: newFieldPath.trim(), value: newFieldValue },
                });
                toast.success("New field added.");
                setShowAddModal(false);
                setNewFieldPath("");
                setNewFieldValue("");
                const updatedCompanyData = await apiClient(`/company`);
                setCompanies(updatedCompanyData);
                const freshlyUpdatedCompany = updatedCompanyData.find(c => c._id === selectedCompany._id);
                setSelectedCompany(freshlyUpdatedCompany);
            } catch (err) {
                setAddError(err.message || "Failed to add field.");
            }
        }
    };

    // Recursive component to render the nested data for a selected company
    const RenderInfoNode = ({ data, pathPrefix = "" }) => (
        <div className="info-node-container">
            {Object.entries(data).map(([key, value]) => {
                const currentPath = pathPrefix ? `${pathPrefix}.${key}` : key;
                if (typeof value === "object" && value !== null && !Array.isArray(value)) {
                    return (
                        <div key={currentPath} className="nested-object-node">
                            <strong className="node-key">{key}:</strong>
                            <RenderInfoNode data={value} pathPrefix={currentPath} />
                        </div>
                    );
                } else {
                    const displayValue = Array.isArray(value) ? value.join(", ") : String(value ?? "");
                    return (
                        <div key={currentPath} className="leaf-node">
                            <div className="leaf-content">
                                <strong className="node-key">{key}:</strong>
                                <span className="node-value">{displayValue}</span>
                            </div>
                            <div className="node-actions">
                                <BsButton variant="outline-warning" size="sm" onClick={() => handleEditField({ key: currentPath, value: displayValue })} title="Edit"><PencilSquare /></BsButton>
                                <BsButton variant="outline-danger" size="sm" onClick={() => handleDeleteField(currentPath)} title="Delete"><Trash /></BsButton>
                            </div>
                        </div>
                    );
                }
            })}
        </div>
    );

    const companyColumns = [
        { key: 'companyName', header: 'Company Name', renderCell: (item) => item.company.companyName },
        { key: 'gstin', header: 'GSTIN', renderCell: (item) => item.company.gstin || 'N/A' },
        {
            key: 'isDefault', header: 'Default', renderCell: (item) =>
                item.isDefault ? <Badge bg="success">Yes</Badge> : <Badge bg="secondary">No</Badge>
        },
    ];

    // Main Render Logic
    if (isLoading) return <LoadingSpinner show={true} />;
    if (error) return <Alert variant="danger">{error}</Alert>;

    return (
        <>
            <Navbar />
            <div className="container mt-4">
                {selectedCompany ? (
                    // DETAIL VIEW
                    <div className="static-info-page-container">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <BsButton variant="secondary" onClick={() => setSelectedCompany(null)}>
                                <ArrowLeft /> Back to List
                            </BsButton>
                            <h2 className="m-0">{selectedCompany.company.companyName}</h2>
                            <BsButton variant="primary" onClick={() => { setAddModalType('field'); setShowAddModal(true); }}>
                                <PlusCircle /> Add Field
                            </BsButton>
                        </div>
                        <div className="company-info-tree">
                            <RenderInfoNode data={selectedCompany.company} pathPrefix="company" />
                        </div>
                    </div>
                ) : (
                    // LIST VIEW
                    <div className="static-info-page-container">
                        <div className="d-flex justify-content-between align-items-center mb-4">
                            <h2 className="m-0">Manage Companies</h2>
                            <BsButton variant="primary" onClick={() => { setAddModalType('company'); setShowAddModal(true); }}>
                                <PlusCircle /> Add New Company
                            </BsButton>
                        </div>
                        <ReusableTable
                            columns={companyColumns}
                            data={companies}
                            keyField="_id"
                            noDataMessage="No companies found. Add one to get started."
                            renderActions={(item) => (
                                <div className="d-flex gap-2 justify-content-center">
                                    <BsButton variant="info" size="sm" onClick={() => setSelectedCompany(item)} title="View & Edit Details"><PencilSquare /></BsButton>
                                    {!item.isDefault && <BsButton variant="success" size="sm" onClick={() => handleSetDefault(item._id)} title="Set as Default"><StarFill /></BsButton>}
                                    {!item.isDefault && <BsButton variant="danger" size="sm" onClick={() => handleDeleteCompany(item._id)} title="Delete Company"><Trash /></BsButton>}
                                </div>
                            )}
                        />
                    </div>
                )}
            </div>

            {/* Edit Field Modal */}
            {fieldToEdit && (
                <ReusableModal
                    show={showEditModal}
                    onHide={() => setShowEditModal(false)}
                    title={`Edit Field: ${fieldToEdit.key}`}
                    footerContent={
                        <>
                            <BsButton variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</BsButton>
                            <BsButton variant="primary" onClick={handleSaveField}>Save Changes</BsButton>
                        </>
                    }
                >
                    <Form.Group>
                        <Form.Label>Value</Form.Label>
                        <Form.Control type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} autoFocus />
                    </Form.Group>
                </ReusableModal>
            )}

            {/* Add Company / Add Field Modal */}
            <ReusableModal
                show={showAddModal}
                onHide={() => setShowAddModal(false)}
                title={addModalType === 'company' ? 'Add New Company' : 'Add New Field'}
                footerContent={
                    <>
                        <BsButton variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</BsButton>
                        <BsButton variant="primary" onClick={handleAddSubmit}>Save</BsButton>
                    </>
                }
                size="xl"
            >
                {addError && <Alert variant="danger">{addError}</Alert>}
                {addModalType === 'company' ? (
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Company Name <span className="text-danger">*</span></Form.Label>
                            <Form.Control type="text" value={newCompanyData.companyName} onChange={e => setNewCompanyData({ ...newCompanyData, companyName: e.target.value })} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>GSTIN</Form.Label>
                            <Form.Control type="text" value={newCompanyData.gstin} onChange={e => setNewCompanyData({ ...newCompanyData, gstin: e.target.value })} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>CIN</Form.Label>
                            <Form.Control type="text" value={newCompanyData.cin} onChange={e => setNewCompanyData({ ...newCompanyData, cin: e.target.value })} />
                        </Form.Group>
                        <hr />
                        <h5>Addresses</h5>
                        <Form.Group className="mb-3">
                            <Form.Label>Company Address</Form.Label>
                            <Form.Control type="text" value={newCompanyData.addresses.companyAddress} onChange={e => setNewCompanyData({ ...newCompanyData, addresses: { ...newCompanyData.addresses, companyAddress: e.target.value } })} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Office Address</Form.Label>
                            <Form.Control type="text" value={newCompanyData.addresses.officeAddress} onChange={e => setNewCompanyData({ ...newCompanyData, addresses: { ...newCompanyData.addresses, officeAddress: e.target.value } })} />
                        </Form.Group>
                        <hr />
                        <h5>Contacts</h5>
                        <Form.Group className="mb-3">
                            <Form.Label>Contact Numbers</Form.Label>
                            <Form.Control type="text" placeholder="Comma separated" value={newCompanyData.contacts.contactNumbers} onChange={e => setNewCompanyData({ ...newCompanyData, contacts: { ...newCompanyData.contacts, contactNumbers: e.target.value } })} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Email</Form.Label>
                            <Form.Control type="email" value={newCompanyData.contacts.email} onChange={e => setNewCompanyData({ ...newCompanyData, contacts: { ...newCompanyData.contacts, email: e.target.value } })} />
                        </Form.Group>
                        <hr />
                        <h5>Bank</h5>
                        <Form.Group className="mb-3">
                            <Form.Label>Bank Name</Form.Label>
                            <Form.Control type="text" value={newCompanyData.bank.bankName} onChange={e => setNewCompanyData({ ...newCompanyData, bank: { ...newCompanyData.bank, bankName: e.target.value } })} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Account Number</Form.Label>
                            <Form.Control type="text" value={newCompanyData.bank.accountNumber} onChange={e => setNewCompanyData({ ...newCompanyData, bank: { ...newCompanyData.bank, accountNumber: e.target.value } })} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>IFSC Code</Form.Label>
                            <Form.Control type="text" value={newCompanyData.bank.ifscCode} onChange={e => setNewCompanyData({ ...newCompanyData, bank: { ...newCompanyData.bank, ifscCode: e.target.value } })} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Branch</Form.Label>
                            <Form.Control type="text" value={newCompanyData.bank.branch} onChange={e => setNewCompanyData({ ...newCompanyData, bank: { ...newCompanyData.bank, branch: e.target.value } })} />
                        </Form.Group>
                    </Form>
                ) : (
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Field Path</Form.Label>
                            <Form.Control type="text" placeholder="e.g., company.contacts.fax" value={newFieldPath} onChange={(e) => setNewFieldPath(e.target.value)} />
                            <Form.Text className="text-muted">Must start with `company.`</Form.Text>
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Value</Form.Label>
                            <Form.Control type="text" placeholder="Enter value" value={newFieldValue} onChange={(e) => setNewFieldValue(e.target.value)} />
                        </Form.Group>
                    </Form>
                )}
            </ReusableModal>
            <Footer />
        </>
    );
};

export default StaticInfo;
