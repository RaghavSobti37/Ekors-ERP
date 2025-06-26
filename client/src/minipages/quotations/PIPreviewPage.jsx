// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/minipages/quotations/PIPreviewPage.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PDFViewer } from '@react-pdf/renderer';
import { Spinner, Alert, Button } from 'react-bootstrap';
import ReusablePageStructure from '../../components/ReusablePageStructure.jsx';
import PIPDF from '../../components/PIPDF.jsx';
import { generatePIDocx } from '../../utils/generatePIDocx.js';
import { saveAs } from 'file-saver';
import { Packer } from 'docx';
import apiClient from '../../utils/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCompanyInfo } from '../../context/CompanyInfoContext.jsx';
import { handleApiError } from '../../utils/helpers.js';
import ActionButtons from '../../components/ActionButtons.jsx';
import { toast } from 'react-toastify';

const PIPreviewPage = () => {
  const { id } = useParams();
  const { companyInfo, isLoading: isCompanyInfoLoading, error: companyInfoError } = useCompanyInfo();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [ticket, setTicket] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      setError("No ticket ID provided for preview.");
      return;
    }
    
    // We will attempt to fetch the ticket once auth loading is complete.
    // The API call itself will serve as the authentication check.
    if (!authLoading) {
      const fetchTicket = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const data = await apiClient(`/tickets/${id}`);
          setTicket(data);
        } catch (err) {
          const errorMessage = handleApiError(err, "Failed to load ticket for PI preview.", user, "piPreviewActivity");
          setError(errorMessage);
          if (err.status === 401 || err.response?.status === 401) {
            toast.error("Authentication failed. Please log in again.");
            navigate('/login', { state: { from: `/tickets/preview/pi/${id}` } });
          }
        } finally {
          setIsLoading(false);
        }
      };
      fetchTicket();
    }
  }, [id, user, authLoading, navigate]);

  const ticketWithRounding = useMemo(() => {
    if (!ticket) return null;
    const decimalPart = (ticket.grandTotal || 0) - Math.floor(ticket.grandTotal || 0);
    let roundOff = 0;
    let finalRoundedAmount = ticket.grandTotal || 0;

    if (decimalPart !== 0) {
      if (decimalPart < 0.50) {
        finalRoundedAmount = Math.floor(ticket.grandTotal || 0);
        roundOff = -decimalPart;
      } else {
        finalRoundedAmount = Math.ceil(ticket.grandTotal || 0);
        roundOff = 1 - decimalPart;
      }
    }
    return { ...ticket, finalRoundedAmount, roundOff };
  }, [ticket]);

  const handleDownloadWord = useCallback(async () => {
    if (!ticketWithRounding) return;
    try {
      const doc = generatePIDocx(ticketWithRounding);
      const blob = await Packer.toBlob(doc);
      saveAs(blob, `PI_${ticketWithRounding.ticketNumber || ticketWithRounding.quotationNumber}.docx`);
    } catch (error) {
      console.error("Error generating PI Word document:", error);
      toast.error("Failed to generate PI Word document.");
    }
  }, [ticketWithRounding]);

  if (isCompanyInfoLoading || isLoading || authLoading) { // Include authLoading in overall loading
    return <ReusablePageStructure showBackButton={true} title="Loading Preview..."><div className="text-center p-5"><Spinner animation="border" /></div></ReusablePageStructure>;
  }

  if (error || companyInfoError) {
    return <ReusablePageStructure showBackButton={true} title="Error"><Alert variant="danger">{error || companyInfoError}</Alert></ReusablePageStructure>;
  }

  if (!ticketWithRounding) {
    return <ReusablePageStructure showBackButton={true} title="Ticket Not Found"><Alert variant="warning">The ticket could not be found.</Alert></ReusablePageStructure>;
  }

  const footerActions = (
    <ActionButtons
      item={ticketWithRounding}
      onDownloadWord={handleDownloadWord}
      size="md"
    />
  );

  return (
    <ReusablePageStructure showBackButton={true} title={`PI Preview - ${ticketWithRounding.ticketNumber}`} footerContent={footerActions}>
      <div style={{ height: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <PDFViewer width="100%" height="99%">
          <PIPDF ticketData={ticketWithRounding} companyInfo={companyInfo} />
        </PDFViewer>
      </div>
    </ReusablePageStructure>
  );
};

export default PIPreviewPage;
