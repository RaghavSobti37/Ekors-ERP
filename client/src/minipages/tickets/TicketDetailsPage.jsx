// TicketDetailsPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Form,
  Button,
  Alert,
  Spinner,
  Row,
  Col,
  Table,
  Card,
  Badge,
  ButtonGroup,
} from "react-bootstrap";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import ReusablePageStructure from "../../components/ReusablePageStructure.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import apiClient from "../../utils/apiClient";
import {
  handleApiError,
  formatDateForInput,
  formatDateTime,
} from "../../utils/helpers";
<<<<<<< HEAD
import frontendLogger from "../../utils/frontendLogger.js";
import ActionButtons from "../../components/ActionButtons.jsx";
import { FaEye, FaUpload, FaTrash, FaFilePdf } from "react-icons/fa";
import { useCompanyInfo } from "../../context/CompanyInfoContext.jsx";
=======
import { PDFViewer } from "@react-pdf/renderer";
import PIPDF from "../../components/PIPDF.jsx";
import QuotationPDF from "../../components/QuotationPDF.jsx";
import { PIActions } from "../../pages/Tickets.jsx"; // Assuming PIActions is correctly defined and exported
import { FaEye, FaUpload, FaTrash, FaFilePdf } from "react-icons/fa"; // Removed unused FaDownload, FaFileWord, FaPlus
import { useCompanyInfo } from "../../context/CompanyInfoContext.jsx"; // Import useCompanyInfo
>>>>>>> 871eea39ee2777f57e4fdae8e5265e13500dde3a

const getStatusBadgeColor = (status) => {
  switch (status) {
    case "Quotation Sent":
      return "info";
    case "PO Received":
      return "primary";
    case "Payment Pending":
      return "warning";
    case "Inspection":
      return "secondary";
    case "Packing List":
      return "dark";
    case "Invoice Sent":
      return "success";
    case "Hold":
      return "danger";
    case "Closed":
      return "success";
    default:
      return "dark";
  }
};

const TicketDetailsPage = () => {
  const { id: ticketIdFromParams } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const {
    companyInfo,
    isLoading: isCompanyInfoLoading,
    error: companyInfoError,
  } = useCompanyInfo();
  const [ticket, setTicket] = useState(location.state?.ticketData || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  // States for payment and document upload (can be expanded)
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(
    formatDateForInput(new Date())
  );
  const [paymentReference, setPaymentReference] = useState("");
  const [uploadingDoc, setUploadingDoc] = useState({
    type: null,
    file: null,
    isOther: false,
  });
  const [otherDocumentFile, setOtherDocumentFile] = useState(null);

  const fetchTicketDetails = useCallback(async () => {
    if (!ticketIdFromParams) return;
    setIsLoading(true);
    try {
      const data = await apiClient(`/tickets/${ticketIdFromParams}`, {
        params: {
          populate:
            "client,currentAssignee,createdBy,transferHistory.from,transferHistory.to,transferHistory.transferredBy,statusHistory.changedBy,documents.quotation.uploadedBy,documents.po.uploadedBy,documents.pi.uploadedBy,documents.challan.uploadedBy,documents.packingList.uploadedBy,documents.feedback.uploadedBy,documents.other.uploadedBy,payments.recordedBy,payments.paymentProof.uploadedBy",
        },
      });
      setTicket(data);
      setPaymentAmount(
        data.grandTotal -
          (data.payments?.reduce((sum, p) => sum + p.amount, 0) || 0)
      );
    } catch (err) {
      const errorMessage = handleApiError(
        err,
        "Failed to fetch ticket details.",
        authUser,
        "ticketDetailsActivity"
      );
      setError(errorMessage);
      if (err.status === 401 || err.response?.status === 401) {
        toast.error("Authentication failed. Please log in again.");
        navigate('/login', { state: { from: location.pathname } });
      }
    } finally {
      setIsLoading(false);
    }
  }, [ticketIdFromParams, navigate, authUser, location.pathname]);

  useEffect(() => {
    if (!location.state?.ticketData && ticketIdFromParams) {
      // Only fetch once auth state is resolved to avoid race conditions.
      if (!authLoading) {
        fetchTicketDetails();
      }
    } else if (location.state?.ticketData) {
      const initialTicket = location.state.ticketData;
      setTicket(initialTicket);
      setPaymentAmount(
        initialTicket.grandTotal -
          (initialTicket.payments?.reduce((sum, p) => sum + p.amount, 0) || 0)
      );
    }
  }, [ticketIdFromParams, location.state, fetchTicketDetails, authLoading]);

  const handlePaymentSubmit = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const responseData = await apiClient(`/tickets/${ticket._id}/payments`, {
        method: "POST",
        body: {
          amount: paymentAmount,
          date: paymentDate,
          reference: paymentReference,
        },
      });
      if (responseData && responseData.ticket) {
        fetchTicketDetails();
        toast.success("Payment recorded!");
        frontendLogger.info("paymentActivity", "Payment recorded", authUser, {
          ticketId: ticket._id,
          amount: paymentAmount,
          action: "RECORD_PAYMENT_SUCCESS",
        });
        setPaymentAmount(0);
        setPaymentReference(""); // Reset form
      }
    } catch (err) {
      const errorMsg = handleApiError(
        err,
        "Failed to record payment",
        authUser,
        "paymentActivity"
      );
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [
    ticket?._id,
    paymentAmount,
    paymentDate,
    paymentReference,
    fetchTicketDetails,
    authUser,
  ]);

  const handleDocumentUpload = useCallback(
    async (file, docType, isOther = false) => {
      if (!file) {
        toast.warn("Please select a file.");
        return;
      }
      setIsLoading(true);
      const formData = new FormData();
      formData.append("document", file);
      formData.append("documentType", docType);
      if (isOther) formData.append("isOther", "true");
      try {
        await apiClient(`/tickets/${ticket._id}/documents`, {
          method: "POST",
          body: formData,
        });
        fetchTicketDetails();
        toast.success(
          `${docType.replace(/([A-Z])/g, " $1").trim()} uploaded successfully.`
        );
        if (isOther) setOtherDocumentFile(null); // Clear file input for other docs
      } catch (err) {
        handleApiError(
          err,
          `Failed to upload ${docType}.`,
          authUser,
          "documentUpload"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [ticket?._id, fetchTicketDetails, authUser]
  );

  const handleDocumentDelete = useCallback(
    async (docType, doc, isOther = false) => {
      const documentId = isOther ? doc?._id : undefined; // Get ID only if it's an 'other' doc
      const docName = isOther ? doc?.originalName : docType;

      if (isOther && !documentId) {
        toast.error("Cannot delete document: missing a valid document ID.");
        return;
      }

      if (!window.confirm(`Are you sure you want to delete this document: ${docName}?`))
        return;

      setIsLoading(true);
      try {
        await apiClient(`/tickets/${ticket._id}/documents`, {
          method: "DELETE",
          body: { documentType: docType, documentId: documentId, isOther },
        });
        fetchTicketDetails();
        toast.success(`${docType.replace(/([A-Z])/g, " $1").trim()} deleted.`);
      } catch (err) {
        handleApiError(
          err,
          `Failed to delete ${docType}.`,
          authUser,
          "documentDelete"
        );
      } finally {
        setIsLoading(false);
      }
    },
    [ticket?._id, fetchTicketDetails, authUser]
  );

  if (authLoading || isLoading || !ticket) {
    return (
      <ReusablePageStructure title="Loading Ticket Details...">
        <div className="text-center">
          <Spinner animation="border" />
        </div>
      </ReusablePageStructure>
    );
  }

  const documentTypesConfig = [
    {
      label: "Quotation",
      type: "quotation",
      canGenerate: true,
      canPreview: true,
    },
    { label: "Purchase Order (PO)", type: "po" },
    {
      label: "Performa Invoice (PI)",
      type: "pi",
      canGenerate: true,
      canPreview: true,
      canDownloadWord: true,
    },
    // { label: "Challan", type: "challan" },
    // { label: "Packing List", type: "packingList" },
    { label: "Feedback Form", type: "feedback" },
  ];

  if (companyInfoError) {
    return (
      <ReusablePageStructure title="Error">
        <Alert variant="danger">{companyInfoError}</Alert>
      </ReusablePageStructure>
    );
  }

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
                <p className="small text-muted">
                  Uploaded: {formatDateTime(doc.uploadedAt)} by{" "}
                  {doc.uploadedBy?.firstname}
                </p>
                <ButtonGroup>
                  <Button
                    variant="outline-info"
                    size="sm"
                    onClick={() =>
                      window.open(
                        `${import.meta.env.VITE_API_BASE_URL}/uploads/${
                          ticket._id
                        }/${doc.path}`,
                        "_blank"
                      )
                    }
                    title="View Document"
                  >
                    <FaEye /> View
                  </Button>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => handleDocumentDelete(docConfig.type, doc, false)}
                    title="Delete Document"
                  >
                    <FaTrash /> Delete
                  </Button>
                </ButtonGroup>
              </>
            ) : (
              <p className="text-muted">Not uploaded</p>
            )}
            <p className="small text-muted mt-1 mb-0">
              Accepted: .pdf, .doc(x), .xls(x), .jpg, .png
            </p>
            <div className="mt-2">
              <input
                type="file"
                id={`${docConfig.type}-upload`}
                style={{ display: "none" }}
                onChange={(e) =>
                  handleDocumentUpload(e.target.files[0], docConfig.type)
                }
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.png"
              />
              <Button
                variant="outline-success"
                size="sm"
                onClick={() =>
                  document.getElementById(`${docConfig.type}-upload`).click()
                }
                className="me-2"
                title="Upload Document"
              >
                <FaUpload /> Upload
              </Button>
              {docConfig.canGenerate && (
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={async () => {
                    if (docConfig.type === "quotation") {
                      if (!ticket.quotationNumber) {
                        toast.warn(
                          "No quotation number linked to this ticket."
                        );
                        return;
                      }
                      try {
                        setIsLoading(true); // Use main page loading spinner
                        const fetchedQuotation = await apiClient(
                          `/quotations/by-reference/${ticket.quotationNumber}`
                        );
                        if (fetchedQuotation && fetchedQuotation._id) {
                          navigate(`/quotations/preview/${fetchedQuotation._id}`); // Navigate to existing QuotationPreviewPage
                        } else {
                          toast.error("Could not find the linked quotation.");
                        }
                      } catch (e) {
                        handleApiError(
                          e,
                          "Failed to load quotation for preview.",
                          authUser,
                          "ticketDetailsActivity"
                        );
                      } finally {
                        setIsLoading(false);
                      }
                    } else if (docConfig.type === "pi") {
                      navigate(`/tickets/preview/pi/${ticket._id}`);
                    }
                  }}
                  title={`Generate/Preview ${docConfig.label}`}
                  disabled={isLoading}
                >
                  <FaFilePdf /> Preview
                </Button>
              )}
            </div>
          </Card.Body>
        </Card>
      </Col>
    );
  };

  return (
    <ReusablePageStructure
      title={`Ticket Details - ${ticket.ticketNumber}`}
      headerContent={
        <ActionButtons item={ticket} onEdit={() => navigate(`/tickets/edit/${ticket._id}`)} onTransfer={() => navigate(`/tickets/transfer/${ticket._id}`)} user={authUser} />
      }
      footerContent={
        <Button variant="secondary" onClick={() => navigate("/tickets")}>
          Back to Tickets
        </Button>
      }
    >
      {error && <Alert variant="danger">{error}</Alert>}
      <Row>
        <Col md={7}>
          <Card className="mb-3">
            <Card.Header>Ticket Information</Card.Header>
            <Card.Body>
              <Row>
                <Col md={6}>
                  <p>
                    <strong>Company:</strong> {ticket.companyName}
                  </p>
                  <p>
                    <strong>Quotation No:</strong>{" "}
                    {ticket.quotationNumber || "N/A"}
                  </p>
                  <p>
                    <strong>Created By:</strong> {ticket.createdBy?.firstname}{" "}
                    {ticket.createdBy?.lastname}
                  </p>
                  <p>
                    <strong>Created At:</strong>{" "}
                    {formatDateTime(ticket.createdAt)}
                  </p>
                </Col>
                <Col md={6}>
                  <p>
                    <strong>Status:</strong>{" "}
                    <Badge bg={getStatusBadgeColor(ticket.status)}>
                      {ticket.status}
                    </Badge>
                  </p>
                  <p>
                    <strong>Assignee:</strong>{" "}
                    {ticket.currentAssignee?.firstname}{" "}
                    {ticket.currentAssignee?.lastname || "N/A"}
                  </p>
                  <p>
                    <strong>Deadline:</strong>{" "}
                    {ticket.deadline
                      ? formatDateForInput(ticket.deadline)
                      : "N/A"}
                  </p>
                </Col>
              </Row>
              <p>
                <strong>Grand Total:</strong> ₹{ticket.grandTotal?.toFixed(2)}
              </p>
            </Card.Body>
          </Card>

          <h5 className="mt-4 mb-3">Primary Documents</h5>
          <Row>{documentTypesConfig.map(renderDocumentCard)}</Row>

          <Card className="mb-3 mt-3">
            <Card.Header as="h6">Other Documents</Card.Header>
            <Card.Body>
              <Form.Group as={Row} className="mb-3 align-items-center">
                <Col sm={8}>
                  <Form.Control
                    type="file"
                    onChange={(e) => setOtherDocumentFile(e.target.files[0])}
                  />
                </Col>
                <Col sm={4}>
                  <Button
                    variant="success"
                    onClick={() =>
                      handleDocumentUpload(otherDocumentFile, "other", true)
                    }
                    disabled={!otherDocumentFile || isLoading}
                    className="w-100"
                  >
                    <FaUpload /> Upload Other
                  </Button>
                </Col>
              </Form.Group>
              <Form.Group as={Row} className="mb-3">
                <Col sm={{ span: 8, offset: 0 }}>
                  <p className="small text-muted mt-0 mb-0">
                    Accepted: .pdf, .doc(x), .xls(x), .jpg, .png
                  </p>
                </Col>
              </Form.Group>
              {ticket.documents?.other && ticket.documents.other.length > 0 ? (
                <Table striped bordered hover size="sm">
                  <thead>
                    <tr>
                      <th>File Name</th>
                      <th>Uploaded</th>
                      <th>By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticket.documents.other.map((doc, index) => (
                      <tr key={doc._id || index}>
                        <td>{doc.originalName || doc.path.split("/").pop()}</td>
                        <td>{formatDateTime(doc.uploadedAt)}</td>
                        <td>{doc.uploadedBy?.firstname}</td>
                        <td>
                          <ButtonGroup>
                            <Button
                              variant="outline-info"
                              size="sm"
                              onClick={() =>
                                window.open(
                                  `${
                                    import.meta.env.VITE_API_BASE_URL
                                  }/uploads/${ticket._id}/${doc.path}`,
                                  "_blank"
                                )
                              }
                            >
                              <FaEye />
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleDocumentDelete("other", doc, true)}
                            >
                              <FaTrash />
                            </Button>
                          </ButtonGroup>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <p>No other documents uploaded.</p>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={5}>
          {ticket.payments && ticket.payments.length > 0 && (
            <Card className="mb-3">
              <Card.Header>Payment History</Card.Header>
              <Card.Body>
                <Table striped bordered hover size="sm">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Ref</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticket.payments.map((p) => (
                      <tr key={p._id}>
                        <td>{formatDateForInput(p.date)}</td>
                        <td>₹{p.amount.toFixed(2)}</td>
                        <td>{p.reference || "N/A"}</td>
                        <td>{p.recordedBy?.firstname}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          )}

          {ticket.statusHistory && ticket.statusHistory.length > 0 && (
            <Card className="mb-3">
              <Card.Header>Status History</Card.Header>
              <Card.Body>
                <Table striped bordered hover size="sm">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Comment</th>
                      <th>By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticket.statusHistory.map((s) => (
                      <tr key={s._id}>
                        <td>{formatDateTime(s.changedAt)}</td>
                        <td>
                          <Badge bg={getStatusBadgeColor(s.status)}>
                            {s.status}
                          </Badge>
                        </td>
                        <td>{s.note || "-"}</td>
                        <td>{s.changedBy?.firstname || "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </ReusablePageStructure>
  );
};

export default TicketDetailsPage;
