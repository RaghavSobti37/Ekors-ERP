import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Form, Button as BsButton, Alert, Spinner, Card } from "react-bootstrap";
import ReusablePageStructure from "../../components/ReusablePageStructure";
import apiClient from "../../utils/apiClient";
import { useAuth } from "../../context/AuthContext";
import { handleApiError } from "../../utils/helpers";
import { toast } from "react-toastify";

const EditClientPage = () => {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const [formData, setFormData] = useState({
    companyName: "",
    clientName: "",
    email: "",
    phone: "",
    gstNumber: "",
  });
  const [originalCreator, setOriginalCreator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchClientDetails = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient(`/clients/${clientId}`);
      // Assuming apiClient returns the data object directly
      if (!response || typeof response !== 'object') {
        throw new Error("Invalid response structure from API.");
      }
      const { companyName, clientName, email, phone, gstNumber, user } = response; 

      setFormData({ companyName, clientName, email, phone, gstNumber });
      setOriginalCreator(user); // Store original creator info
      setError("");
    } catch (err) {
      setError(handleApiError(err, "Failed to fetch client details."));
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (authUser?.role !== 'super-admin') {
        // Non-super-admins might be able to edit their own clients.
        // For now, strictly super-admin as per "super-admin can also modify".
        // If users can edit their own, this check needs to be more nuanced.
        // The controller `updateClient` allows owners to update.
        // So, if not super-admin, we should check if authUser._id === originalCreator?._id
        // This check is better done after fetching client details.
    }
    fetchClientDetails();
  }, [fetchClientDetails, authUser]);
  
   useEffect(() => {
    if (!loading && authUser && originalCreator && authUser.role !== 'super-admin' && authUser._id !== originalCreator._id) {
      toast.error("You are not authorized to edit this client.");
      navigate("/users", { state: { activeView: 'clients' } });
    }
  }, [loading, authUser, originalCreator, navigate]);


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiClient(`/clients/${clientId}`, {
        method: "PUT",
        body: formData,
      });
      toast.success("Client updated successfully!");
      navigate("/users", { state: { activeView: 'clients' } }); // Navigate back to client list in dashboard
    } catch (err) {
      setError(handleApiError(err, "Failed to update client."));
      toast.error("Failed to update client.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <ReusablePageStructure title="Loading Client Editor...">
        <div className="text-center"><Spinner animation="border" /></div>
      </ReusablePageStructure>
    );
  }

  if (error && !formData.companyName) { // Show error if initial load failed
    return (
      <ReusablePageStructure title="Error">
        <Alert variant="danger">{error}</Alert>
      </ReusablePageStructure>
    );
  }
  
  // Final authorization check before rendering form for non-super-admins
  if (authUser && originalCreator && authUser.role !== 'super-admin' && authUser._id !== originalCreator._id) {
      return (
        <ReusablePageStructure title="Unauthorized">
          <Alert variant="danger">You are not authorized to edit this client.</Alert>
        </ReusablePageStructure>
      );
  }


  return (
    <ReusablePageStructure
      title={`Edit Client: ${formData.companyName || "..."}`}
      footerContent={
        <>
          <BsButton variant="secondary" onClick={() => navigate("/clients")} disabled={saving}>
            Back to Clients
          </BsButton>
          <BsButton variant="primary" type="submit" form="edit-client-form" disabled={saving}>
            {saving ? <><Spinner as="span" animation="border" size="sm" /> Saving...</> : "Save Changes"}
          </BsButton>
        </>
      }
    >
      <Card>
        <Card.Header as="h5">Client Details</Card.Header>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form id="edit-client-form" onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Company Name <span className="text-danger">*</span></Form.Label>
              <Form.Control
                name="companyName"
                value={formData.companyName}
                onChange={handleInputChange}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Contact Person Name <span className="text-danger">*</span></Form.Label>
              <Form.Control
                name="clientName"
                value={formData.clientName}
                onChange={handleInputChange}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email <span className="text-danger">*</span></Form.Label>
              <Form.Control
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Phone <span className="text-danger">*</span></Form.Label>
              <Form.Control
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>GST Number <span className="text-danger">*</span></Form.Label>
              <Form.Control
                name="gstNumber"
                value={formData.gstNumber}
                onChange={handleInputChange}
                required
              />
            </Form.Group>
             {originalCreator && (
                <p className="text-muted small">
                    Originally created by: {originalCreator.firstname} {originalCreator.lastname} ({originalCreator.email})
                </p>
            )}
          </Form>
        </Card.Body>
      </Card>
    </ReusablePageStructure>
  );
};

export default EditClientPage;
