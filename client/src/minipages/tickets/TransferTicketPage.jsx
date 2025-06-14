// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/pages/TransferTicketPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import { Form, Button as BsButton, Alert, Spinner, Badge, Row, Col } from "react-bootstrap";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import ReusablePageStructure from "../../components/ReusablePageStructure.jsx";
// import UserSearchComponent from "../../components/UserSearchComponent.jsx"; // Assuming this is a generic user search
import { useAuth } from "../../context/AuthContext.jsx";
import apiClient from "../../utils/apiClient";
import { handleApiError } from "../../utils/helpers";
import frontendLogger from "../../utils/frontendLogger.js";

const TransferTicketPage = () => {
  const { id: ticketIdFromParams } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();
  const auth = useAuth();

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
         params: { populate: "currentAssignee,createdBy" } // Populate necessary fields
      });
      setTicketToTransfer(data);
    } catch (err) {
      handleApiError(err, "Failed to fetch ticket details for transfer.", authUser, "transferTicketActivity");
      navigate("/tickets");
    } finally {
      setIsLoading(false);
    }
  }, [ticketIdFromParams, navigate, authUser, ticketToTransfer]);

  useEffect(() => {
    if (!location.state?.ticketDataForTransfer && ticketIdFromParams) {
      fetchTicketDetails();
    }
  }, [ticketIdFromParams, location.state, fetchTicketDetails]);

  const handleUserSelect = (user) => {
    setSelectedUserToTransfer(user);
    setError(null);
  };

  const handleConfirmTransfer = async () => {
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
  };

  if (authLoading || (isLoading && !ticketToTransfer)) {
    return <ReusablePageStructure title="Loading Transfer Details..."><div className="text-center"><Spinner animation="border" /></div></ReusablePageStructure>;
  }
  if (!ticketToTransfer) {
    return <ReusablePageStructure title="Error"><Alert variant="danger">Ticket data not found.</Alert></ReusablePageStructure>;
  }

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
      <div className="mb-4">
        <h5 className="mb-3">Search User to Transfer To</h5>
        <UserSearchComponent onUserSelect={handleUserSelect} authContext={auth} />
      </div>

      {selectedUserToTransfer && (
        <div className="selected-user-info p-3 border rounded bg-light mb-3">
          <h6>Selected User:</h6>
          <p><strong>Name:</strong> {selectedUserToTransfer.firstname} {selectedUserToTransfer.lastname}</p>
          <p><strong>Email:</strong> {selectedUserToTransfer.email}</p>
          <p><strong>Role:</strong> <Badge bg="info">{selectedUserToTransfer.role}</Badge></p>
        </div>
      )}

      <Form.Group className="mb-3">
        <Form.Label>Transfer Note (Optional)</Form.Label>
        <Form.Control as="textarea" rows={3} value={transferNote} onChange={(e) => setTransferNote(e.target.value)} placeholder="Add any notes about this transfer..." />
      </Form.Group>

      <div className="ticket-summary mt-4 p-3 border rounded">
        <h5>Ticket Summary</h5>
        <p><strong>Company:</strong> {ticketToTransfer.companyName}</p>
        <p><strong>Quotation:</strong> {ticketToTransfer.quotationNumber}</p>
        <p><strong>Current Assignee:</strong> {ticketToTransfer.currentAssignee?.firstname} {ticketToTransfer.currentAssignee?.lastname || "N/A"}</p>
        <p><strong>Status:</strong> <Badge bg="secondary">{ticketToTransfer.status}</Badge></p>
      </div>
    </ReusablePageStructure>
  );
};

export default TransferTicketPage;
