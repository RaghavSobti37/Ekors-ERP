// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/pages/PIPreviewPage.jsx
import { useLocation, useNavigate } from 'react-router-dom';
import { PDFViewer } from '@react-pdf/renderer';
import { Alert, Button } from 'react-bootstrap';
import ReusablePageStructure from '../../components/ReusablePageStructure.jsx'; // Ensure this path is correct
import PIPDF from '../../components/PIPDF.jsx'; // Ensure this path is correct

const PIPreviewPage = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const ticketForPreview = location.state?.ticketForPreview;

  if (!ticketForPreview) {
    return (
      <ReusablePageStructure showBackButton={true} title="Error">
        <Alert variant="danger">No Proforma Invoice data available for preview. Please go back and try again.</Alert>
        <Button variant="primary" onClick={() => navigate(-1)}>Go Back</Button>
      </ReusablePageStructure>
    );
  }

  return (
    <ReusablePageStructure showBackButton={true}
      title={`PI Preview - ${ticketForPreview.ticketNumber || ticketForPreview.quotationNumber}`}
      footerContent={<Button variant="secondary" onClick={() => navigate(-1)}>Close Preview</Button>}
    >
      <div style={{ height: 'calc(100vh - 200px)', overflowY: 'auto' }}> {/* Adjust height as needed */}
        <PDFViewer width="100%" height="99%">
          <PIPDF ticket={ticketForPreview} />
        </PDFViewer>
      </div>
    </ReusablePageStructure>
  );
};

export default PIPreviewPage;
