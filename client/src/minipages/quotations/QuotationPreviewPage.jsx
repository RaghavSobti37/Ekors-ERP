// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/pages/QuotationPreviewPage.jsx
import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { PDFViewer } from '@react-pdf/renderer';
import { Spinner, Alert, Button } from 'react-bootstrap';
import ReusablePageStructure from '../../components/ReusablePageStructure.jsx'; // Ensure this path is correct
import QuotationPDF, { QuotationActions } from '../../components/QuotationPDF.jsx'; // Ensure this path is correct
import apiClient from '../../utils/apiClient.js';
import { useAuth } from '../../context/AuthContext.jsx'; // Keep useAuth for logging
import { useCompanyInfo } from '../../context/CompanyInfoContext.jsx'; // Import useCompanyInfo
import { handleApiError } from '../../utils/helpers.js';

const QuotationPreviewPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const { companyInfo, isLoading: isCompanyInfoLoading, error: companyInfoError } = useCompanyInfo();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [quotation, setQuotation] = useState(location.state?.quotationToPreview || null);
  const [isLoading, setIsLoading] = useState(!quotation); // Load if not passed in state
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!quotation && id) {
      const fetchQuotation = async () => {
        setIsLoading(true);
        setError(null);
        try {
          const data = await apiClient(`/quotations/${id}`);
          setQuotation(data);
        } catch (err) {
          const errorMessage = handleApiError(err, "Failed to load quotation for preview.", user, "quotationPreviewActivity");
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      };
      fetchQuotation();
    }
  }, [id, quotation, user]);

  if (isCompanyInfoLoading) {
    return <ReusablePageStructure showBackButton={true} title="Loading Company Info..."><div className="text-center p-5"><Spinner animation="border" /></div></ReusablePageStructure>;
  }

  if (isLoading) {
    return <ReusablePageStructure showBackButton={true} title="Loading Quotation..."><div className="text-center p-5"><Spinner animation="border" /></div></ReusablePageStructure>;
  }

  if (error) {
    return <ReusablePageStructure showBackButton={true} title="Error"><Alert variant="danger">{error}</Alert></ReusablePageStructure>;
  }
  
  if (companyInfoError) {
    return <ReusablePageStructure showBackButton={true} title="Error"><Alert variant="danger">{companyInfoError}</Alert></ReusablePageStructure>;
  }

  if (!quotation) {
    return <ReusablePageStructure showBackButton={true} title="Quotation Not Found"><Alert variant="warning">The quotation could not be found.</Alert></ReusablePageStructure>;
  }

  return (
    <ReusablePageStructure showBackButton={true} title={`Quotation Preview - ${quotation.referenceNumber}`} footerContent={<QuotationActions quotation={quotation} />}>
      <div style={{ height: 'calc(100vh - 200px)', overflowY: 'auto' }}> {/* Adjust height as needed */}
        <PDFViewer width="100%" height="99%"><QuotationPDF quotation={quotation} companyInfo={companyInfo} /></PDFViewer>
      </div>
    </ReusablePageStructure>
  );
};

export default QuotationPreviewPage;
