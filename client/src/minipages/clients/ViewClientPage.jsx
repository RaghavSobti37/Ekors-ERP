import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Alert, Spinner, Card, Table, Badge, Row, Col, Button as BsButton } from "react-bootstrap";
import ReusablePageStructure from "../../components/ReusablePageStructure";
import apiClient from "../../utils/apiClient";
import { useAuth } from "../../context/AuthContext";
import { handleApiError, formatDateTime } from "../../utils/helpers";
import { Eye } from "react-bootstrap-icons";

const ViewClientPage = () => {
  const { id: clientId } = useParams();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchClientDetails = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient(`/clients/${clientId}`);
      // Assuming apiClient returns the data object directly
      if (!response || typeof response !== 'object') {
        throw new Error("Invalid response structure from API.");
      }
      setClient(response);
      setError("");
    } catch (err) {
      setError(handleApiError(err, "Failed to fetch client details."));
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    fetchClientDetails();
  }, [fetchClientDetails]);

  if (loading) {
    return (
      <ReusablePageStructure title="Loading Client Details...">
        <div className="text-center">
          <Spinner animation="border" />
        </div>
      </ReusablePageStructure>
    );
  }

  if (error) {
    return (
      <ReusablePageStructure title="Error">
        <Alert variant="danger">{error}</Alert>
      </ReusablePageStructure>
    );
  }

  if (!client) {
    return (
      <ReusablePageStructure title="Client Not Found">
        <Alert variant="warning">The client could not be found or you do not have permission to view it.</Alert>
      </ReusablePageStructure>
    );
  }
  
  const getQuotationStatusBadge = (status) => {
    // Simplified, expand as needed
    if (status === 'closed') return 'success';
    if (status === 'open') return 'primary';
    return 'secondary';
  };

  const getTicketStatusBadge = (status) => {
    // Simplified, expand as needed
    if (status === 'Closed') return 'success';
    if (status === 'Open' || status === 'Quotation Sent' || status === 'PO Received') return 'primary'; // Example open statuses
    return 'warning';
  };


  return (
    <ReusablePageStructure
      title={`Client: ${client.companyName}`}
      footerContent={
        <BsButton variant="primary" onClick={() => navigate("/clients")}>
          Back to Client List
        </BsButton>
      }
    >
      <Row>
        <Col md={6}>
          <Card className="mb-3">
            <Card.Header as="h5">Client Information</Card.Header>
            <Card.Body>
              <p><strong>Company Name:</strong> {client.companyName}</p>
              <p><strong>Contact Person:</strong> {client.clientName || "N/A"}</p>
              <p><strong>Email:</strong> {client.email}</p>
              <p><strong>Phone:</strong> {client.phone}</p>
              <p><strong>GST Number:</strong> {client.gstNumber}</p>
              <p>
                <strong>Created By:</strong>{" "}
                {client.user ? `${client.user.firstname} ${client.user.lastname}` : "N/A"}
              </p>
              <p><strong>Created At:</strong> {formatDateTime(client.createdAt)}</p>
              <p><strong>Last Updated:</strong> {formatDateTime(client.updatedAt)}</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="mb-3">
            <Card.Header as="h5">Stats</Card.Header>
            <Card.Body>
              <p><strong>Total Quotations:</strong> {client.quotationStats?.total || 0}</p>
              <p><strong>Open Quotations:</strong> {client.quotationStats?.open || 0}</p>
              <p><strong>Closed Quotations:</strong> {client.quotationStats?.closed || 0}</p>
              <hr />
              <p><strong>Total Tickets:</strong> {client.ticketStats?.total || 0}</p>
              <p><strong>Open Tickets:</strong> {client.ticketStats?.open || 0}</p>
              <p><strong>Closed Tickets:</strong> {client.ticketStats?.closed || 0}</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Card className="mb-3">
        <Card.Header as="h5">Quotations</Card.Header>
        <Card.Body>
          {client.quotations && client.quotations.length > 0 ? (
            <Table striped bordered hover responsive size="sm">
              <thead>
                <tr>
                  <th>Ref. Number</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {client.quotations.map((q) => (
                  <tr key={q._id}>
                    <td>{q.referenceNumber}</td>
                    <td>{new Date(q.date).toLocaleDateString()}</td>
                    <td><Badge bg={getQuotationStatusBadge(q.status)}>{q.status}</Badge></td>
                    <td>₹{q.grandTotal?.toFixed(2)}</td>
                    <td>
                      <BsButton variant="outline-primary" size="sm" onClick={() => navigate(`/quotations/preview/${q._id}`)}>
                        <Eye /> View
                      </BsButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p>No quotations found for this client.</p>
          )}
        </Card.Body>
      </Card>

      <Card className="mb-3">
        <Card.Header as="h5">Tickets</Card.Header>
        <Card.Body>
          {client.tickets && client.tickets.length > 0 ? (
            <Table striped bordered hover responsive size="sm">
              <thead>
                <tr>
                  <th>Ticket Number</th>
                  <th>Status</th>
                  <th>Amount</th>
                  <th>Deadline</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {client.tickets.map((t) => (
                  <tr key={t._id}>
                    <td>{t.ticketNumber}</td>
                    <td><Badge bg={getTicketStatusBadge(t.status)}>{t.status}</Badge></td>
                    <td>₹{t.grandTotal?.toFixed(2)}</td>
                    <td>{t.deadline ? new Date(t.deadline).toLocaleDateString() : "N/A"}</td>
                    <td>
                      <BsButton variant="outline-primary" size="sm" onClick={() => navigate(`/tickets/details/${t._id}`)}>
                         <Eye /> View
                      </BsButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <p>No tickets found for this client.</p>
          )}
        </Card.Body>
      </Card>
    </ReusablePageStructure>
  );
};

export default ViewClientPage;
