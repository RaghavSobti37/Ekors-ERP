// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/pages/TicketDetailsPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Form, Button as BsButton, Alert, Spinner, Row, Col, Table, Card, Badge } from "react-bootstrap";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import ReusablePageStructure from "../../components/ReusablePageStructure.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import apiClient from "../../utils/apiClient";
import { handleApiError, formatDateForInput } from "../../utils/helpers";
import frontendLogger from "../../utils/frontendLogger.js";
import { PDFViewer } from "@react-pdf/renderer";
import PIPDF from "../../components/PIPDF.jsx";
import QuotationPDF from "../../components/QuotationPDF.jsx";
import { PIActions } from "../../pages/Tickets.jsx"; 

const TicketDetailsPage = () => {
  const { id: ticketIdFromParams } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const auth = useAuth();

  const [ticket, setTicket] = useState(location.state?.ticketData || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // States for payment and document upload (can be expanded)
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(formatDateForInput(new Date()));
  const [paymentReference, setPaymentReference] = useState("");
  const [uploadingDocType, setUploadingDocType] = useState(null);

  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [pdfPreviewConfig, setPdfPreviewConfig] = useState({ type: null, data: null });


  const fetchTicketDetails = useCallback(async () => {
    if (!ticketIdFromParams) return;
    setIsLoading(true);
    try {
      const data = await apiClient(`/tickets/${ticketIdFromParams}`, {
        params: { populate: "client,currentAssignee,createdBy,transferHistory.from,transferHistory.to,transferHistory.transferredBy,statusHistory.changedBy,documents.quotation.uploadedBy,documents.po.uploadedBy,documents.pi.uploadedBy,documents.challan.uploadedBy,documents.packingList.uploadedBy,documents.feedback.uploadedBy,documents.other.uploadedBy,payments.recordedBy" },
      });
      setTicket(data);
      setPaymentAmount(data.grandTotal - (data.payments?.reduce((sum, p) => sum + p.amount, 0) || 0));
    } catch (err) {
      handleApiError(err, "Failed to fetch ticket details.", authUser, "ticketDetailsActivity");
      navigate("/tickets");
    } finally {
      setIsLoading(false);
    }
  }, [ticketIdFromParams, navigate, authUser]);

  useEffect(() => {
    if (!location.state?.ticketData && ticketIdFromParams) {
      fetchTicketDetails();
    } else if (location.state?.ticketData) {
        const initialTicket = location.state.ticketData;
        setTicket(initialTicket);
        setPaymentAmount(initialTicket.grandTotal - (initialTicket.payments?.reduce((sum, p) => sum + p.amount, 0) || 0));
    }
  }, [ticketIdFromParams, location.state, fetchTicketDetails]);

  const handlePaymentSubmit = async () => {
    setIsLoading(true); setError(null);
    try {
      const responseData = await apiClient(`/tickets/${ticket._id}/payments`, {
        method: "POST", body: { amount: paymentAmount, date: paymentDate, reference: paymentReference },
      });
      if (responseData) {
        fetchTicketDetails(); // Refresh ticket details to show new payment
        toast.success("Payment recorded!");
        frontendLogger.info("paymentActivity", "Payment recorded", authUser, { ticketId: ticket._id, amount: paymentAmount, action: "RECORD_PAYMENT_SUCCESS" });
        setPaymentAmount(0); setPaymentReference(""); // Reset form
      }
    } catch (err) {
      const errorMsg = handleApiError(err, "Failed to record payment", authUser, "paymentActivity");
      setError(errorMsg); toast.error(errorMsg);
    } finally { setIsLoading(false); }
  };

  const handleSpecificDocumentUpload = async (file, docType) => {
    // ... (Simplified version, adapt from Tickets.jsx)
    if (!file) { toast.warn("Please select a file."); return; }
    setIsLoading(true);
    const formData = new FormData();
    formData.append("document", file);
    formData.append("documentType", docType);
    try {
      await apiClient(`/tickets/${ticket._id}/documents`, { method: "POST", body: formData });
      fetchTicketDetails(); // Refresh
      toast.success(`${docType.toUpperCase()} uploaded.`);
    } catch (err) {
      handleApiError(err, `Failed to upload ${docType}.`, authUser, "documentUpload");
    } finally { setIsLoading(false); setUploadingDocType(null); }
  };

  const handleDocumentDelete = async (docType, documentPath) => {
    // ... (Simplified version, adapt from Tickets.jsx)
    if (!window.confirm(`Are you sure you want to delete this ${docType}?`)) return;
    setIsLoading(true);
    try {
      await apiClient(`/tickets/${ticket._id}/documents`, { method: "DELETE", body: { documentType: docType, documentPath } });
      fetchTicketDetails(); // Refresh
      toast.success(`${docType.toUpperCase()} deleted.`);
    } catch (err) {
      handleApiError(err, `Failed to delete ${docType}.`, authUser, "documentDelete");
    } finally { setIsLoading(false); }
  };

  const renderPdfPreviewModal = () => (
    <ReusablePageStructure
        showBackButton={true} // This modal is now a page, so back button is good
        title={`${pdfPreviewConfig.type?.toUpperCase()} Preview - ${ticket?.ticketNumber}`}
        footerContent={
            <>
                {pdfPreviewConfig.type === "PI" && ticket && <PIActions ticket={ticket} />}
                <BsButton variant="secondary" onClick={() => setShowPdfPreviewModal(false)}>Close Preview</BsButton>
            </>
        }
    >
        {pdfPreviewConfig.type && ticket && (
            <div style={{ height: 'calc(100vh - 220px)', overflowY: 'auto' }}> {/* Adjust height */}
                <PDFViewer width="100%" height="99%">
                    {pdfPreviewConfig.type === "quotation" ? (
                        <QuotationPDF quotation={{ ...ticket, client: ticket.client || { companyName: ticket.companyName } }} /> // Adapt ticket to quotation structure
                    ) : (
                        <PIPDF ticket={ticket} />
                    )}
                </PDFViewer>
            </div>
        )}
    </ReusablePageStructure>
  );

  if (showPdfPreviewModal) {
      return renderPdfPreviewModal();
  }

  if (authLoading || isLoading || !ticket) {
    return <ReusablePageStructure title="Loading Ticket Details..."><div className="text-center"><Spinner animation="border" /></div></ReusablePageStructure>;
  }

  return (
    <ReusablePageStructure
      title={`Ticket Details - ${ticket.ticketNumber}`}
      footerContent={<BsButton variant="secondary" onClick={() => navigate("/tickets")}>Back to Tickets</BsButton>}
    >
      {error && <Alert variant="danger">{error}</Alert>}
      <Row>
        <Col md={6}>
          <Card className="mb-3">
            <Card.Header>Ticket Information</Card.Header>
            <Card.Body>
              <p><strong>Company:</strong> {ticket.companyName}</p>
              <p><strong>Quotation No:</strong> {ticket.quotationNumber}</p>
              <p><strong>Status:</strong> <Badge bg="info">{ticket.status}</Badge></p>
              <p><strong>Assignee:</strong> {ticket.currentAssignee?.firstname} {ticket.currentAssignee?.lastname || "N/A"}</p>
              {/* ... More ticket info ... */}
            </Card.Body>
          </Card>
          <Card className="mb-3">
            <Card.Header>Record Payment</Card.Header>
            <Card.Body>
              <Form.Group className="mb-2"><Form.Label>Amount</Form.Label><Form.Control type="number" value={paymentAmount} onChange={e => setPaymentAmount(parseFloat(e.target.value))} /></Form.Group>
              <Form.Group className="mb-2"><Form.Label>Date</Form.Label><Form.Control type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></Form.Group>
              <Form.Group className="mb-3"><Form.Label>Reference (Optional)</Form.Label><Form.Control type="text" value={paymentReference} onChange={e => setPaymentReference(e.target.value)} /></Form.Group>
              <BsButton onClick={handlePaymentSubmit} disabled={isLoading || paymentAmount <= 0}>Record Payment</BsButton>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="mb-3">
            <Card.Header>Documents</Card.Header>
            <Card.Body>
              {/* ... Document upload/view/delete UI similar to the modal in Tickets.jsx ... */}
              {/* Example for PI */}
              <div className="d-flex justify-content-between align-items-center mb-2">
                <span>Proforma Invoice (PI)</span>
                <div>
                  {ticket.documents?.pi?.path && <BsButton variant="outline-info" size="sm" className="me-2" onClick={() => window.open(`${import.meta.env.VITE_API_BASE_URL}/uploads/${ticket._id}/${ticket.documents.pi.path}`, "_blank")}>View</BsButton>}
                  <BsButton variant="outline-primary" size="sm" className="me-2" onClick={() => { setPdfPreviewConfig({ type: "pi", data: ticket }); setShowPdfPreviewModal(true); }}>Generate/Preview</BsButton>
                  <BsButton variant="outline-success" size="sm" onClick={() => document.getElementById('pi-upload').click()}>Upload</BsButton>
                  <input type="file" id="pi-upload" style={{display: 'none'}} onChange={e => handleSpecificDocumentUpload(e.target.files[0], 'pi')} />
                </div>
              </div>
              {/* ... Repeat for other document types ... */}
            </Card.Body>
          </Card>
          {/* Payment History, Status History, Transfer History Tables */}
        </Col>
      </Row>
    </ReusablePageStructure>
  );
};

export default TicketDetailsPage;
