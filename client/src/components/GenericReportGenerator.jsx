import React, { useState } from 'react';
import { Modal, Button, Form, Spinner, Alert } from 'react-bootstrap';
import { FaFileExcel } from 'react-icons/fa';
import apiClient from '../utils/apiClient';
import { handleApiError, showToast } from '../utils/helpers';
import { saveAs } from 'file-saver';

const GenericReportGenerator = ({ show, onHide, entityName, apiEndpoint }) => {
  const [period, setPeriod] = useState('7days');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const periodOptions = [
    { value: '7days', label: 'Last 7 Days' },
    { value: '30days', label: 'Last 30 Days' },
    { value: '90days', label: 'Last 90 Days' },
    { value: '1year', label: 'Last Year' },
    { value: 'financialYear', label: 'Current Financial Year' },
    { value: 'all', label: 'All Time' },
  ];

  const handleGenerateReport = async () => {
    if (!apiEndpoint) {
      setError('API endpoint for the report is not configured.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      // apiClient by default expects JSON, but for file downloads,
      // we need the raw response to handle it as a blob.
      // We'll assume apiClient can be modified or a direct fetch is used here for blob handling.
      
      // Using direct fetch for simplicity in blob handling for this example:
      const token = localStorage.getItem('erp-user'); // Or use getAuthToken from utils
      const headers = {
        'Authorization': `Bearer ${token}`,
      };

      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}${apiEndpoint}?period=${period}`, { headers });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { message: await response.text() || `Request failed with status ${response.status}` };
        }
        throw { status: response.status, data: errorData, message: errorData.message };
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('content-disposition');
      let fileName = `${entityName.toLowerCase().replace(/\s+/g, '_')}_report.xlsx`; // Default filename

      if (contentDisposition) {
        const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/i);
        if (fileNameMatch && fileNameMatch.length === 2) {
          fileName = fileNameMatch[1];
        }
      }
      
      saveAs(blob, fileName);
      showToast(`${entityName} report generated successfully!`, true);
      onHide(); // Close modal on success

    } catch (err) {
      const errorMessage = handleApiError(err, `Failed to generate ${entityName} report.`);
      setError(errorMessage);
      showToast(errorMessage, false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>Generate {entityName} Excel Report</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <Form.Group controlId="reportPeriodSelect">
          <Form.Label>Select Report Period</Form.Label>
          <Form.Control
            as="select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            disabled={loading}
          >
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Form.Control>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide} disabled={loading}>
          Cancel
        </Button>
        <Button variant="success" onClick={handleGenerateReport} disabled={loading}>
          {loading ? (
            <>
              <Spinner
                as="span"
                animation="border"
                size="sm"
                role="status"
                aria-hidden="true"
              />
              <span className="ms-2">Generating...</span>
            </>
          ) : (
            <>
              <FaFileExcel className="me-2" />
              Generate Report
            </>
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default GenericReportGenerator;