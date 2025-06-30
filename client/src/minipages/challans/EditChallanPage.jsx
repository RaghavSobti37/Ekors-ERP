import React, { useState, useEffect, useCallback } from "react";
import {
  Form,
  Button as BsButton,
  Alert,
  Spinner,
  Row,
  Col,
  Card,
} from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import ReusablePageStructure from "../../components/ReusablePageStructure.jsx";
import ClientSearchComponent from "../../components/ClientSearchComponent.jsx"; // Ensure this path is correct
import { useAuth } from "../../context/AuthContext.jsx";
import apiClient from "../../utils/apiClient";
import { handleApiError, showToast } from "../../utils/helpers";

const EditChallanPageComponent = () => {
  const { id: challanId } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const initialFormData = {
    companyName: "",
    phone: "",
    email: "",
    totalBilling: "",
    billNumber: "",
    media: null, // For new file upload
    existingDocument: null, // To store info about current document
  };

  const [formData, setFormData] = useState(initialFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formValidated, setFormValidated] = useState(false);

  const fetchChallanDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiClient(`challans/${challanId}`);
      setFormData({
        companyName: data.companyName || "",
        phone: data.phone || "",
        email: data.email || "",
        totalBilling: data.totalBilling || "",
        billNumber: data.billNumber || "",
        media: null,
        existingDocument: data.document
          ? { name: data.document.originalName, id: data._id }
          : null,
      });
      setError(null);
    } catch (err) {
      const errorMessage = handleApiError(
        err,
        "Failed to fetch challan details.",
        authUser,
        "challanActivity"
      );
      setError(errorMessage);
      toast.error(errorMessage);
      // navigate("/challans"); // Optionally navigate back if fetch fails critically
    } finally {
      setIsLoading(false);
    }
  }, [challanId, authUser]);

  useEffect(() => {
    fetchChallanDetails();
  }, [fetchChallanDetails]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleFileChange = useCallback((e) => {
    setFormData((prev) => ({ ...prev, media: e.target.files[0] }));
  }, []);

  const handleClientSelect = useCallback((client) => {
    setFormData((prev) => ({
      ...prev,
      companyName: client.companyName || "",
      phone: client.phone || "",
      email: client.email || "",
    }));
  }, []);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      const form = e.currentTarget;
      if (form.checkValidity() === false) {
        e.stopPropagation();
        setFormValidated(true);
        toast.error("Please fill all required fields.");
        return;
      }
      setFormValidated(true);

      setIsLoading(true);
      setError(null);

      try {
        const submitData = new FormData();
        submitData.append("companyName", formData.companyName);
        submitData.append("phone", formData.phone);
        submitData.append("email", formData.email);
        submitData.append("totalBilling", formData.totalBilling);
        submitData.append("billNumber", formData.billNumber || "");
        if (formData.media) {
          submitData.append("media", formData.media);
        }

        await apiClient(`challans/${challanId}`, {
          method: "PUT",
          body: submitData,
        });

        showToast("Challan updated successfully!", true);
        navigate("/challans");
      } catch (err) {
        const errorMessage = handleApiError(
          err,
          "Failed to update challan.",
          authUser,
          "challanActivity"
        );
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [challanId, formData, authUser, navigate]
  );

  if (isLoading && !formData.companyName) {
    // Show full page loader only on initial load
    return (
      <ReusablePageStructure title="Loading Challan...">
        <div className="text-center p-5">
          <Spinner animation="border" />
        </div>
      </ReusablePageStructure>
    );
  }

  return (
    <ReusablePageStructure
      title={`Edit Challan - ${formData.companyName || challanId}`}
      footerContent={
        <>
          <BsButton
            variant="secondary"
            onClick={() => navigate("/challans")}
            disabled={isLoading}
          >
            Cancel
          </BsButton>
          <BsButton
            type="submit"
            form="challan-form"
            variant="primary"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                />{" "}
                Updating...
              </>
            ) : (
              "Update Challan"
            )}
          </BsButton>
        </>
      }
    >
      {error && (
        <Alert variant="danger" onClose={() => setError(null)} dismissible>
          {error}
        </Alert>
      )}
      <Form
        id="challan-form"
        noValidate
        validated={formValidated}
        onSubmit={handleSubmit}
      >
        <Card className="mb-3">
          <Card.Header as="h5">Client Details</Card.Header>
          <Card.Body>
            <Form.Group className="mb-3">
              <Form.Label>
                Search and Select Client (Optional: to update client details)
              </Form.Label>
              <ClientSearchComponent
                onClientSelect={handleClientSelect}
                placeholder="Search client by Name, Email, GST..."
              />
            </Form.Group>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Company Name <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    required
                    type="text"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleInputChange}
                    placeholder="Company Name"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Phone <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    required
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="Phone Number"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Email <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    required
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Email Address"
                  />
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        <Card className="mb-3">
          <Card.Header as="h5">Billing & Document</Card.Header>
          <Card.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Total Billing (₹) <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    required
                    type="number"
                    name="totalBilling"
                    value={formData.totalBilling}
                    onChange={handleInputChange}
                    placeholder="Total Billing Amount"
                    min="0"
                    step="0.01"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Bill Number (Optional)</Form.Label>
                  <Form.Control
                    type="text"
                    name="billNumber"
                    value={formData.billNumber}
                    onChange={handleInputChange}
                    placeholder="Bill Number (if any)"
                  />
                </Form.Group>
              </Col>
            </Row>
            <Form.Group className="mb-3">
              <Form.Label>
                Upload New Document (Optional: replaces existing)
              </Form.Label>
              <Form.Control
                type="file"
                name="media"
                accept="image/*,application/pdf"
                onChange={handleFileChange}
              />
              {formData.media && (
                <Form.Text className="text-muted">
                  Selected file to upload: {formData.media.name}
                </Form.Text>
              )}
              {!formData.media && formData.existingDocument && (
                <Form.Text className="text-success d-block mt-1">
                  Current document: {formData.existingDocument.name}
                </Form.Text>
              )}
            </Form.Group>
          </Card.Body>
        </Card>
      </Form>
    </ReusablePageStructure>
  );
};

export default React.memo(EditChallanPageComponent);
