import React, { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Form,
  Spinner,
  Alert,
  Tab,
  Tabs,
  Table,
} from "react-bootstrap";
import { FaFileExcel, FaChartBar } from "react-icons/fa";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
// import apiClient from "../utils/apiClient"; // No longer using shared apiClient directly here to ensure consistency
import axios from "axios"; // Import axios
import { getAuthToken } from "../utils/authUtils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Create a local apiClient instance, similar to QuotationReportModal.jsx
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000", // This should point to your API base, e.g., http://localhost:3000/api
});

const fullScreenModalStyle = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '95vw',
  height: '95vh',
  maxWidth: 'none',
  margin: 0,
  padding: 0,
  overflow: 'auto',
  backgroundColor: 'white',
  border: '1px solid #dee2e6',
  borderRadius: '0.3rem',
  boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
  zIndex: 1050
};

const TicketReportModal = ({ show, onHide }) => {
  const [period, setPeriod] = useState("7days");
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportData, setReportData] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");

  const periodOptions = [
    { value: "7days", label: "Last 7 Days" },
    { value: "30days", label: "Last 30 Days" },
    { value: "90days", label: "Last 90 Days" },
    { value: "1year", label: "Last Year" },
    { value: "financialYear", label: "Financial Year" },
    { value: "all", label: "All Time" },
  ];

  const ticketStatusOrder = [
    "Quotation Sent", "PO Received", "Payment Pending", "Inspection",
    "Packing List", "Invoice Sent", "Hold", "Closed"
  ];

  const fetchReport = async () => {
    setLoading(true);
    setError("");
    setReportData(null);

    try {
      const token = getAuthToken();
      if (!token) {
        setError("Authentication token not found. Please log in again.");
        setLoading(false);
        return;
      }

      // Ensure your apiClient is configured for the correct base URL
      // The path should be relative to the baseURL, e.g., 'reports/tickets' if baseURL includes '/api'
      const response = await apiClient.get(`reports/tickets`, { // Changed path
        params: { period },
        headers: { Authorization: `Bearer ${token}` },
      });
      setReportData(response.data.data);
    } catch (err) {
      let errorMessage = "Failed to fetch ticket report. An unknown error occurred.";
      if (err.response) {
        errorMessage = err.response.data?.message || err.response.data?.error || `Server error: ${err.response.status}`;
      } else if (err.request) {
        errorMessage = "No response from server. Check network connection.";
      } else {
        errorMessage = `Request error: ${err.message}`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleExportToExcel = async () => {
    setExportLoading(true);
    setError("");
    
    try {
      const token = getAuthToken();
      if (!token) {
        setError("Authentication token not found. Please log in again.");
        setExportLoading(false);
        return;
      }

      const response = await apiClient.get(`reports/tickets`, { // Changed path
        params: { period, exportToExcel: "true" }, // Add exportToExcel param
        responseType: "blob",
        headers: { Authorization: `Bearer ${token}` },
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `ticket-report-${period}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      let errorMessage = "Failed to export ticket report. An unknown error occurred.";
       if (err.response) {
        // Try to parse error from blob if it's a JSON error response
        if (err.response.data instanceof Blob && err.response.data.type === "application/json") {
          const errorJson = await err.response.data.text();
          const parsedError = JSON.parse(errorJson);
          errorMessage = parsedError.message || parsedError.error || `Server error: ${err.response.status}`;
        } else {
          errorMessage = err.response.data?.message || err.response.data?.error || `Server error: ${err.response.status}`;
        }
      } else if (err.request) {
        errorMessage = "No response from server during export.";
      } else {
        errorMessage = `Export error: ${err.message}`;
      }
      setError(errorMessage);
    } finally {
      setExportLoading(false);
    }
  };

  useEffect(() => {
    if (show) {
      fetchReport();
    }
  }, [show, period]);

  const renderSummaryTab = () => (
    <div className="report-summary">
      {loading && !reportData && (
        <div className="text-center p-5">
          <Spinner animation="border" /> 
          <p>Loading ticket report...</p>
        </div>
      )}
      
      {!loading && reportData && (
        <>
          <div className="report-header mb-4">
            <h4>Ticket Activity Report</h4>
            <p className="text-muted">
              Period: {reportData.period} ({reportData.dateRange})
            </p>
          </div>

          <Table striped bordered hover size="sm" className="mt-3">
            <tbody>
              <tr><td>Total Tickets Created</td><td>{reportData.totalTickets}</td></tr>
              {ticketStatusOrder.map(status => (
                <tr key={status}>
                  <td>{status} Tickets</td>
                  <td>{reportData.statusCounts?.[status] || 0}</td>
                </tr>
              ))}
              {reportData.statusCounts?.other > 0 && (
                 <tr><td>Other Status Tickets</td><td>{reportData.statusCounts.other}</td></tr>
              )}
              <tr><td>Unique Clients (based on Company Name)</td><td>{reportData.uniqueClientsCount}</td></tr>
              <tr><td>Total Value of Closed Tickets</td><td>₹{reportData.totalValueClosedTickets?.toFixed(2)}</td></tr>
            </tbody>
          </Table>
        </>
      )}
    </div>
  );

  const renderChartsTab = () => {
    if (!reportData || !reportData.statusCounts) return null;

    const chartData = {
      labels: ticketStatusOrder,
      datasets: [
        {
          label: "Ticket Status",
          data: ticketStatusOrder.map(status => reportData.statusCounts?.[status] || 0),
          backgroundColor: [ // Add more colors if needed
            "rgba(75, 192, 192, 0.6)", "rgba(54, 162, 235, 0.6)", "rgba(255, 206, 86, 0.6)",
            "rgba(153, 102, 255, 0.6)", "rgba(255, 159, 64, 0.6)", "rgba(201, 203, 207, 0.6)",
            "rgba(255, 99, 132, 0.6)", "rgba(100, 255, 100, 0.6)"
          ],
          borderColor: [
            "rgba(75, 192, 192, 1)", "rgba(54, 162, 235, 1)", "rgba(255, 206, 86, 1)",
            "rgba(153, 102, 255, 1)", "rgba(255, 159, 64, 1)", "rgba(201, 203, 207, 1)",
            "rgba(255, 99, 132, 1)", "rgba(100, 255, 100, 1)"
          ],
          borderWidth: 1,
        },
      ],
    };

    return (
      <div className="report-charts">
        <div className="chart-container mb-4">
          <h5>Ticket Status Distribution</h5>
          <Bar data={chartData} options={{ responsive: true, plugins: { legend: { position: "top" }}}} />
        </div>
      </div>
    );
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <div style={fullScreenModalStyle}>
        <Modal.Header closeButton>
          <Modal.Title>Ticket Activity Report</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          
          <div className="report-controls mb-3">
            <Form.Group controlId="periodSelect">
              <Form.Label>Report Period</Form.Label>
              <Form.Control as="select" value={period} onChange={(e) => setPeriod(e.target.value)} disabled={loading || exportLoading}>
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Form.Control>
            </Form.Group>
          </div>

          <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-3">
            <Tab eventKey="summary" title="Summary">{renderSummaryTab()}</Tab>
            <Tab eventKey="charts" title="Charts">{renderChartsTab()}</Tab>
          </Tabs>
        </Modal.Body>
        <Modal.Footer>
          <div className="d-flex justify-content-between w-100">
            <div>
              <Button variant="outline-primary" onClick={fetchReport} disabled={loading || exportLoading}>
                {loading ? <><Spinner as="span" size="sm" animation="border" /> Refreshing...</> : "Refresh"}
              </Button>
            </div>
            <div>
              <Button variant="outline-success" onClick={handleExportToExcel} disabled={loading || exportLoading || !reportData || reportData.totalTickets === 0} className="me-2">
                {exportLoading ? <><Spinner as="span" size="sm" animation="border" /> Exporting...</> : <><FaFileExcel className="me-1" />Export Excel</>}
              </Button>
              <Button variant="secondary" onClick={onHide} disabled={exportLoading}>Close</Button>
            </div>
          </div>
        </Modal.Footer>
      </div>
    </Modal>
  );
};

export default TicketReportModal;