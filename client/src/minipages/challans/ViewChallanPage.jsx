import React, { useState, useEffect, useCallback } from "react";
import { Button as BsButton, Alert, Spinner, Row, Col, Card, Modal, Table } from "react-bootstrap";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import ReusablePageStructure from "../../components/ReusablePageStructure.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import apiClient from "../../utils/apiClient";
import { handleApiError, formatDateForInput } from "../../utils/helpers";

const ViewChallanPageComponent = () => {
  const { id: challanId } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();

  const [challanData, setChallanData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [documentPreview, setDocumentPreview] = useState({ url: null, type: null, show: false });

  const fetchChallanDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch challan details, including populated createdBy and updatedBy
      const data = await apiClient(`challans/${challanId}?populate=createdBy,updatedBy`);
      setChallanData(data);
      setError(null);
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to fetch challan details.", authUser, "challanActivity");
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [challanId, authUser]);

  useEffect(() => {
    fetchChallanDetails();
  }, [fetchChallanDetails]);

  const previewDocument = useCallback(async () => {
    if (!challanData || !challanData.document) {
      toast.warn("No document available for this challan.");
      return;
    }
    setIsLoading(true);
    try {
      const blob = await apiClient(`challans/${challanId}/document`, { responseType: 'blob' });
      const contentType = blob.type;
      const url = window.URL.createObjectURL(blob);
      setDocumentPreview({ url, type: contentType, show: true });
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to load document.", authUser, "challanActivity");
      setError(errorMessage); toast.error(errorMessage);
      setDocumentPreview({ url: null, type: null, show: false });
    } finally {
      setIsLoading(false);
    }
  }, [challanData, challanId, authUser]);

  const closePreview = useCallback(() => {
    if (documentPreview.url) window.URL.revokeObjectURL(documentPreview.url);
    setDocumentPreview({ url: null, type: null, show: false });
  }, [documentPreview.url]);

  if (isLoading && !challanData) {
    return <ReusablePageStructure title="Loading Challan..."><div className="text-center p-5"><Spinner animation="border" /></div></ReusablePageStructure>;
  }

  if (error && !challanData) {
    return <ReusablePageStructure title="Error"><Alert variant="danger">{error}</Alert></ReusablePageStructure>;
  }

  if (!challanData) {
    return <ReusablePageStructure title="Challan Not Found"><Alert variant="warning">Challan data could not be loaded or does not exist.</Alert></ReusablePageStructure>;
  }

  return (
    <ReusablePageStructure
      title={`View Challan: ${challanData.companyName}`}
      footerContent={<BsButton variant="secondary" onClick={() => navigate("/challans")}>Back to List</BsButton>}
    >
      {error && <Alert variant="danger" onClose={() => setError(null)} dismissible>{error}</Alert>}
      <Card>
        <Card.Header as="h5">Challan Details</Card.Header>
        <Card.Body>
          <Table bordered striped responsive="sm">
            <tbody>
              <tr><td><strong>Company Name:</strong></td><td>{challanData.companyName}</td></tr>
              <tr><td><strong>Phone:</strong></td><td>{challanData.phone}</td></tr>
              <tr><td><strong>Email:</strong></td><td>{challanData.email}</td></tr>
              <tr><td><strong>Total Billing (₹):</strong></td><td>{challanData.totalBilling}</td></tr>
              <tr><td><strong>Bill Number:</strong></td><td>{challanData.billNumber || "N/A"}</td></tr>
              <tr><td><strong>Created At:</strong></td><td>{new Date(challanData.createdAt).toLocaleString()}</td></tr>
              <tr><td><strong>Created By:</strong></td><td>{`${challanData.createdBy?.firstname || ''} ${challanData.createdBy?.lastname || ''}`.trim() || "System"}</td></tr>
              {challanData.updatedAt && challanData.updatedBy && (
                <>
                  <tr><td><strong>Last Updated At:</strong></td><td>{new Date(challanData.updatedAt).toLocaleString()}</td></tr>
                  <tr><td><strong>Updated By:</strong></td><td>{`${challanData.updatedBy?.firstname || ''} ${challanData.updatedBy?.lastname || ''}`.trim() || "System"}</td></tr>
                </>
              )}
              <tr>
                <td><strong>Document:</strong></td>
                <td>
                  {challanData.document?.originalName ? (
                    <>
                      {challanData.document.originalName}
                      <BsButton variant="link" size="sm" onClick={previewDocument} disabled={isLoading}>Preview</BsButton>
                    </>
                  ) : "No document uploaded"}
                </td>
              </tr>
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <Modal show={documentPreview.show} onHide={closePreview} size="lg" centered>
        <Modal.Header closeButton><Modal.Title>Document Preview</Modal.Title></Modal.Header>
        <Modal.Body style={{ textAlign: 'center' }}>
          {documentPreview.type?.includes("application/pdf") ? (
            <iframe src={documentPreview.url} title="Document Preview" style={{ width: "100%", height: "75vh", border: "none" }} />
          ) : (
            <img src={documentPreview.url} alt="Document Preview" style={{ maxWidth: "100%", maxHeight: "75vh" }} />
          )}
        </Modal.Body>
      </Modal>
    </ReusablePageStructure>
  );
};

export default React.memo(ViewChallanPageComponent);
