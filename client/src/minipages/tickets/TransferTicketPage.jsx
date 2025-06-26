// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/pages/TransferTicketPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Form, Button as BsButton, Alert, Spinner, Badge, Row, Col, Table, Card } from "react-bootstrap";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import ReusablePageStructure from "../../components/ReusablePageStructure.jsx";
import UserSearchComponent from "../../components/UserSearchComponent.jsx"; 
import { useAuth } from "../../context/AuthContext.jsx";
import apiClient from "../../utils/apiClient";
import { handleApiError } from "../../utils/helpers";
import frontendLogger from "../../utils/frontendLogger.js";

const TransferTicketPage = () => {
  const { id: ticketIdFromParams } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth(); 
  const [ticketToTransfer, setTicketToTransfer] = useState(location.state?.ticketDataForTransfer || null);
  const [selectedUserToTransfer, setSelectedUserToTransfer] = useState(null);
  const [transferNote, setTransferNote] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTicketDetails = useCallback(async () => {
    if (!ticketIdFromParams || ticketToTransfer) return; // Don't fetch if already have data
    setIsLoading(true);
    try {
      const data = await apiClient(`/tickets/${ticketIdFromParams}`, {
         params: { populate: "currentAssignee,createdBy,transferHistory.from,transferHistory.to,transferHistory.transferredBy" } 
      });
      setTicketToTransfer(data);
    } catch (err) {
      handleApiError(err, "Failed to fetch ticket details for transfer.", authUser, "transferTicketActivity");
      navigate("/tickets");
    } finally {
      setIsLoading(false);
    }
  }, [ticketIdFromParams, navigate, authUser, ticketToTransfer]);

  useEffect(() => { // This effect correctly calls the memoized fetchTicketDetails
    if (!location.state?.ticketDataForTransfer && ticketIdFromParams) {
      fetchTicketDetails();
    }
  }, [ticketIdFromParams, location.state, fetchTicketDetails]);
  const handleUserSelect = useCallback((user) => {
    setSelectedUserToTransfer(user);
    setError(null);
  }, [setSelectedUserToTransfer, setError]); // setError and setSelectedUserToTransfer are stable

  const handleConfirmTransfer = useCallback(async () => {
    if (!selectedUserToTransfer) { setError("Please select a user to transfer the ticket to."); toast.warn("Select user."); return; }
    setIsLoading(true); setError(null);
    try {
      const responseData = await apiClient(`/tickets/${ticketToTransfer._id}/transfer`, {
        method: "POST", body: { userId: selectedUserToTransfer._id, note: transferNote },
      });
      if (responseData && responseData.ticket) {
        toast.success(`Ticket transferred to ${responseData.ticket.currentAssignee.firstname}`);
        frontendLogger.info("ticketActivity", `Ticket transferred to ${responseData.ticket.currentAssignee.firstname}`, authUser, { ticketId: ticketToTransfer._id, transferredTo: selectedUserToTransfer._id, action: "TRANSFER_TICKET_SUCCESS" });
        navigate("/tickets");
      }
    } catch (err) {
      const errorMsg = handleApiError(err, "Failed to transfer ticket", authUser, "transferTicketActivity");
      setError(errorMsg); toast.error(errorMsg);
      frontendLogger.error("ticketActivity", `Failed to transfer ticket ${ticketToTransfer?._id}`, authUser, { ticketId: ticketToTransfer?._id, action: "TRANSFER_TICKET_FAILURE" });
    } finally { setIsLoading(false); }
  }, [selectedUserToTransfer, ticketToTransfer?._id, transferNote, navigate, authUser, setIsLoading, setError]);

  if (authLoading || (isLoading && !ticketToTransfer)) {
    return <ReusablePageStructure title="Loading Transfer Details..."><div className="text-center"><Spinner animation="border" /></div></ReusablePageStructure>;
  }
  if (!ticketToTransfer) {
    return <ReusablePageStructure title="Error"><Alert variant="danger">Ticket data not found.</Alert></ReusablePageStructure>;
  }

  const renderTransferHistory = () => {
    if (!ticketToTransfer.transferHistory || ticketToTransfer.transferHistory.length === 0) {
      return <p>No transfer history for this ticket.</p>;
    }
    return (
      <Card className="mt-4">
        <Card.Header as="h5" style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem" }}>
            <i className="bi bi-arrow-repeat me-1"></i>Transfer History
        </Card.Header>
        <Card.Body>
        <Table striped bordered hover responsive size="sm">
          <thead>
            <tr><th>Date</th><th>From</th><th>To</th><th>Transferred By</th><th>Note</th></tr>
          </thead>
          <tbody>
            {ticketToTransfer.transferHistory.map((entry, index) => (
              <tr key={index}>
                <td>{entry.transferredAt ? new Date(entry.transferredAt).toLocaleString() : 'N/A'}</td>
                <td>{entry.from ? `${entry.from.firstname} ${entry.from.lastname}` : 'System/Initial'}</td>
                <td>{entry.to ? `${entry.to.firstname} ${entry.to.lastname}` : 'N/A'}</td>
                <td>{entry.transferredBy ? `${entry.transferredBy.firstname} ${entry.transferredBy.lastname}` : 'System'}</td>
                <td>{entry.note || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
        </Card.Body>
      </Card>
    );
  };

  return (
    <ReusablePageStructure
      title={`Transfer Ticket - ${ticketToTransfer.ticketNumber}`}
      footerContent={
        <>
          <BsButton variant="secondary" onClick={() => navigate("/tickets")} disabled={isLoading}>Cancel</BsButton>
          <BsButton variant="primary" onClick={handleConfirmTransfer} disabled={!selectedUserToTransfer || isLoading}>
            {isLoading ? "Transferring..." : "Confirm Transfer"}
          </BsButton>
        </>
      }
    >
      {error && <Alert variant="danger">{error}</Alert>}
      
      <Card className="mb-4">
        <Card.Header as="h5" style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem" }}>
            <i className="bi bi-person-plus-fill me-1"></i>Select User to Transfer To
        </Card.Header>
        <Card.Body>
            <UserSearchComponent onUserSelect={handleUserSelect} currentAssigneeId={ticketToTransfer.currentAssignee?._id} />
        </Card.Body>
      </Card>

      {selectedUserToTransfer && (
        <Card className="mb-3 bg-light">
            <Card.Header as="h6"><i className="bi bi-person-check-fill me-1"></i>Selected User Details</Card.Header>
            <Card.Body>
                <p><strong>Name:</strong> {selectedUserToTransfer.firstname} {selectedUserToTransfer.lastname}</p>
                <p><strong>Email:</strong> {selectedUserToTransfer.email}</p>
                <p><strong>Role:</strong> <Badge bg="info">{selectedUserToTransfer.role}</Badge></p>
            </Card.Body>
        </Card>
      )}

      <Form.Group className="mb-3">
        <Form.Label>Transfer Note (Optional)</Form.Label>
        <Form.Control as="textarea" rows={2} value={transferNote} onChange={(e) => setTransferNote(e.target.value)} placeholder="Add any notes about this transfer..." />
      </Form.Group>

      <Card className="mt-4">
        <Card.Header as="h5" style={{ fontWeight: "bold", textAlign: "center", backgroundColor: "#f0f2f5", padding: "0.5rem", borderRadius: "0.25rem" }}>
            <i className="bi bi-ticket-detailed-fill me-1"></i>Ticket Summary
        </Card.Header>
        <Card.Body>
            <p><strong>Company:</strong> {ticketToTransfer.companyName}</p>
            <p><strong>Quotation:</strong> {ticketToTransfer.quotationNumber}</p>
            <p><strong>Current Assignee:</strong> {ticketToTransfer.currentAssignee?.firstname} {ticketToTransfer.currentAssignee?.lastname || "N/A"}</p>
            <p><strong>Status:</strong> <Badge bg="secondary">{ticketToTransfer.status}</Badge></p>
        </Card.Body>
      </Card>

      {renderTransferHistory()}
    </ReusablePageStructure>
  );
};

export default TransferTicketPage;
