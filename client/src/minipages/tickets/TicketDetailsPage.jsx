// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/pages/TicketDetailsPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Form, Button as BsButton, Alert, Spinner, Row, Col, Table, Card, Badge, ButtonGroup } from "react-bootstrap";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import ReusablePageStructure from "../../components/ReusablePageStructure.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import apiClient from "../../utils/apiClient";
import { handleApiError, formatDateForInput, formatDateTime } from "../../utils/helpers";
import frontendLogger from "../../utils/frontendLogger.js";
import { PDFViewer } from "@react-pdf/renderer";
import PIPDF from "../../components/PIPDF.jsx";
import QuotationPDF from "../../components/QuotationPDF.jsx";
import { PIActions } from "../../pages/Tickets.jsx"; // Assuming PIActions is correctly defined and exported
import { FaEye, FaUpload, FaTrash, FaFilePdf } from "react-icons/fa"; // Removed unused FaDownload, FaFileWord, FaPlus

const getStatusBadgeColor = (status) => {
  switch (status) {
    case "Quotation Sent": return "info";
    case "PO Received": return "primary";
    case "Payment Pending": return "warning";
    case "Inspection": return "secondary";
    case "Packing List": return "dark";
    case "Invoice Sent": return "success";
    case "Hold": return "danger";
    case "Closed": return "success";
    default: return "dark";
  }
};

const TicketDetailsPage = () => {
  const { id: ticketIdFromParams } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();

  const [ticket, setTicket] = useState(location.state?.ticketData || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // States for payment and document upload (can be expanded)
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(formatDateForInput(new Date()));
  const [paymentReference, setPaymentReference] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState({ type: null, file: null, isOther: false });

  const [showPdfPreviewModal, setShowPdfPreviewModal] = useState(false);
  const [pdfPreviewConfig, setPdfPreviewConfig] = useState({ type: null, data: null });
  const [otherDocumentFile, setOtherDocumentFile] = useState(null);


  const fetchTicketDetails = useCallback(async () => {
    if (!ticketIdFromParams) return;
    setIsLoading(true);
    try {
      const data = await apiClient(`/tickets/${ticketIdFromParams}`, {
        params: { populate: "client,currentAssignee,createdBy,transferHistory.from,transferHistory.to,transferHistory.transferredBy,statusHistory.changedBy,documents.quotation.uploadedBy,documents.po.uploadedBy,documents.pi.uploadedBy,documents.challan.uploadedBy,documents.packingList.uploadedBy,documents.feedback.uploadedBy,documents.other.uploadedBy,payments.recordedBy,payments.paymentProof.uploadedBy" },
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

  const handlePaymentSubmit = useCallback(async () => {
    setIsLoading(true); setError(null);
    try {
      const responseData = await apiClient(`/tickets/${ticket._id}/payments`, {
        method: "POST", body: { amount: paymentAmount, date: paymentDate, reference: paymentReference },
      });
      if (responseData && responseData.ticket) {
        fetchTicketDetails(); 
        toast.success("Payment recorded!");
        frontendLogger.info("paymentActivity", "Payment recorded", authUser, { ticketId: ticket._id, amount: paymentAmount, action: "RECORD_PAYMENT_SUCCESS" });
        setPaymentAmount(0); setPaymentReference(""); // Reset form
      }
    } catch (err) {
      const errorMsg = handleApiError(err, "Failed to record payment", authUser, "paymentActivity");
      setError(errorMsg); toast.error(errorMsg);
    } finally { setIsLoading(false); }
  }, [ticket?._id, paymentAmount, paymentDate, paymentReference, fetchTicketDetails, authUser, setIsLoading, setError, setPaymentAmount, setPaymentReference]);

  const handleDocumentUpload = useCallback(async (file, docType, isOther = false) => {
    if (!file) { toast.warn("Please select a file."); return; }
    setIsLoading(true);
    const formData = new FormData();
    formData.append("document", file);
    formData.append("documentType", docType);
    if (isOther) formData.append("isOther", "true");
    try {
      await apiClient(`/tickets/${ticket._id}/documents`, { method: "POST", body: formData });
      fetchTicketDetails();
      toast.success(`${docType.replace(/([A-Z])/g, ' $1').trim()} uploaded successfully.`);
      if (isOther) setOtherDocumentFile(null); // Clear file input for other docs
    } catch (err) {
      handleApiError(err, `Failed to upload ${docType}.`, authUser, "documentUpload");
    } finally { setIsLoading(false); }
  }, [ticket?._id, fetchTicketDetails, authUser, setIsLoading, setOtherDocumentFile]);

  const handleDocumentDelete = useCallback(async (docType, documentId, isOther = false) => {
    if (!window.confirm(`Are you sure you want to delete this ${docType}?`)) return;
    setIsLoading(true);
    try {
      await apiClient(`/tickets/${ticket._id}/documents`, { 
        method: "DELETE", 
        body: { documentType: docType, documentId: documentId, isOther } 
      });
      fetchTicketDetails();
      toast.success(`${docType.replace(/([A-Z])/g, ' $1').trim()} deleted.`);
    } catch (err) {
      handleApiError(err, `Failed to delete ${docType}.`, authUser, "documentDelete");
    } finally { 
      setIsLoading(false); 
    }
  }, [ticket?._id, fetchTicketDetails, authUser, setIsLoading]);

  const renderPdfPreviewModal = () => (
    <ReusablePageStructure
        showBackButton={true} // This modal is now a page, so back button is good
        title={`${pdfPreviewConfig.type?.toUpperCase()} Preview - ${ticket?.ticketNumber}`}
        footerContent={
            <> {/* PIActions might need to be adapted if it's for a modal context */}
                {pdfPreviewConfig.type === "PI" && ticket && <PIActions ticket={ticket} />}
                <BsButton variant="secondary" onClick={() => setShowPdfPreviewModal(false)}>Close Preview</BsButton>
            </>
        }
    >
        {pdfPreviewConfig.type && ticket && (
            <div style={{ height: 'calc(100vh - 220px)', overflowY: 'auto' }}> {/* Adjust height */}
                <PDFViewer width="100%" height="99%">
                    {pdfPreviewConfig.type === "quotation" ? (
                        <QuotationPDF quotation={{ ...ticket, client: ticket.client || { companyName: ticket.companyName }, referenceNumber: ticket.quotationNumber }} />
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

  const documentTypes = [
    { label: "Quotation", type: "quotation", canGenerate: true, canPreview: true },
    { label: "Purchase Order (PO)", type: "po" },
    { label: "Proforma Invoice (PI)", type: "pi", canGenerate: true, canPreview: true, canDownloadWord: true },
    { label: "Challan", type: "challan" },
    { label: "Packing List", type: "packingList" },
    { label: "Feedback Form", type: "feedback" },
  ];

  const renderDocumentCard = (docConfig) => {
    const doc = ticket.documents?.[docConfig.type];
    const docId = doc?._id; // Assuming backend provides _id for the document record

    return (
      <Col md={4} key={docConfig.type} className="mb-3">
        <Card>
          <Card.Header as="h6">{docConfig.label}</Card.Header>
          <Card.Body className="text-center">
            {doc && doc.path ? (
              <>
                <p className="small text-muted">Uploaded: {formatDateTime(doc.uploadedAt)} by {doc.uploadedBy?.firstname}</p>
                <ButtonGroup>
                  <BsButton variant="outline-info" size="sm" onClick={() => window.open(`${import.meta.env.VITE_API_BASE_URL}/uploads/${ticket._id}/${doc.path}`, "_blank")} title="View Document">
                    <FaEye /> View
                  </BsButton>
                  <BsButton variant="outline-danger" size="sm" onClick={() => handleDocumentDelete(docConfig.type, docId)} title="Delete Document">
                    <FaTrash /> Delete
                  </BsButton>
                </ButtonGroup>
              </>
            ) : (
              <p className="text-muted">Not uploaded</p>
            )}
            <div className="mt-2">
              <input type="file" id={`${docConfig.type}-upload`} style={{ display: 'none' }} onChange={e => handleDocumentUpload(e.target.files[0], docConfig.type)} accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png" />
              <BsButton variant="outline-success" size="sm" onClick={() => document.getElementById(`${docConfig.type}-upload`).click()} className="me-2" title="Upload Document">
                <FaUpload /> Upload
              </BsButton>
              {docConfig.canGenerate && (
                <BsButton variant="outline-primary" size="sm" onClick={() => { setPdfPreviewConfig({ type: docConfig.type, data: ticket }); setShowPdfPreviewModal(true); }} title={`Generate/Preview ${docConfig.label}`}>
                  <FaFilePdf /> Preview
                </BsButton>
              )}
               {/* {docConfig.type === "pi" && ticket && ( // Specific for PI Word download
                 <BsButton variant="outline-secondary" size="sm" className="ms-2" onClick={() => PIActions({ ticket }).handleDownloadWord()} title="Download PI as Word">
                    <FaFileWord /> Word
                 </BsButton>
               )} */}
            </div>
          </Card.Body>
        </Card>
      </Col>
    );
  };

  return (
    <ReusablePageStructure
      title={`Ticket Details - ${ticket.ticketNumber}`}
      footerContent={<BsButton variant="secondary" onClick={() => navigate("/tickets")}>Back to Tickets</BsButton>}
    >
      {error && <Alert variant="danger">{error}</Alert>}
      <Row>
        <Col md={7}> {/* Main Ticket Info and Documents */}
          <Card className="mb-3">
            <Card.Header>Ticket Information</Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <p><strong>Company:</strong> {ticket.companyName}</p>
                  <p><strong>Quotation No:</strong> {ticket.quotationNumber || "N/A"}</p>
                  <p><strong>Created By:</strong> {ticket.createdBy?.firstname} {ticket.createdBy?.lastname}</p>
                  <p><strong>Created At:</strong> {formatDateTime(ticket.createdAt)}</p>
                </Col>
                <Col md={6}>
                  <p><strong>Status:</strong> <Badge bg={getStatusBadgeColor(ticket.status)}>{ticket.status}</Badge></p>
                  <p><strong>Assignee:</strong> {ticket.currentAssignee?.firstname} {ticket.currentAssignee?.lastname || "N/A"}</p>
                  <p><strong>Deadline:</strong> {ticket.deadline ? formatDateForInput(ticket.deadline) : "N/A"}</p>
                </Col>
              </Row>
               <p><strong>Grand Total:</strong> ₹{ticket.grandTotal?.toFixed(2)}</p>
            </Card.Body>
          </Card>

          <h5 className="mt-4 mb-3">Primary Documents</h5>
          <Row>{documentTypes.map(renderDocumentCard)}</Row>

          <Card className="mb-3 mt-3">
            <Card.Header as="h6">Other Documents</Card.Header>
            <Card.Body>
              <Form.Group as={Row} className="mb-3 align-items-center">
                <Col sm={8}>
                  <Form.Control type="file" onChange={(e) => setOtherDocumentFile(e.target.files[0])} />
                </Col>
                <Col sm={4}>
                  <BsButton variant="success" onClick={() => handleDocumentUpload(otherDocumentFile, 'other', true)} disabled={!otherDocumentFile || isLoading} className="w-100">
                    <FaUpload /> Upload Other
                  </BsButton>
                </Col>
              </Form.Group>
              {ticket.documents?.other && ticket.documents.other.length > 0 ? (
                <Table striped bordered hover size="sm">
                  <thead><tr><th>File Name</th><th>Uploaded</th><th>By</th><th>Actions</th></tr></thead>
                  <tbody>
                    {ticket.documents.other.map((doc, index) => (
                      <tr key={doc._id || index}>
                        <td>{doc.originalName || doc.path.split('/').pop()}</td>
                        <td>{formatDateTime(doc.uploadedAt)}</td>
                        <td>{doc.uploadedBy?.firstname}</td>
                        <td>
                          <ButtonGroup>
                            <BsButton variant="outline-info" size="sm" onClick={() => window.open(`${import.meta.env.VITE_API_BASE_URL}/uploads/${ticket._id}/${doc.path}`, "_blank")}><FaEye /></BsButton>
                            <BsButton variant="outline-danger" size="sm" onClick={() => handleDocumentDelete('other', doc._id, true)}><FaTrash /></BsButton>
                          </ButtonGroup>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : <p>No other documents uploaded.</p>}
            </Card.Body>
          </Card>
        </Col>

        <Col md={5}> {/* Sidebar for Payments, History */}

          {ticket.payments && ticket.payments.length > 0 && (
            <Card className="mb-3"><Card.Header>Payment History</Card.Header><Card.Body>
              <Table striped bordered hover size="sm"><thead><tr><th>Date</th><th>Amount</th><th>Ref</th><th>By</th></tr></thead><tbody>
                {ticket.payments.map(p => (<tr key={p._id}><td>{formatDateForInput(p.date)}</td><td>₹{p.amount.toFixed(2)}</td><td>{p.reference || 'N/A'}</td><td>{p.recordedBy?.firstname}</td></tr>))}
              </tbody></Table></Card.Body></Card>
          )}
          {ticket.statusHistory && ticket.statusHistory.length > 0 && (
            <Card className="mb-3"><Card.Header>Status History</Card.Header><Card.Body>
              <Table striped bordered hover size="sm"><thead><tr><th>Date</th><th>Status</th><th>Comment</th><th>By</th></tr></thead><tbody>
                {ticket.statusHistory.map(s => (<tr key={s._id}><td>{formatDateTime(s.changedAt)}</td><td><Badge bg={getStatusBadgeColor(s.status)}>{s.status}</Badge></td><td>{s.comment || 'N/A'}</td><td>{s.changedBy?.firstname}</td></tr>))}
              </tbody></Table></Card.Body></Card>
          )}
        </Col>
      </Row>
    </ReusablePageStructure>
  );
};

export default TicketDetailsPage;
