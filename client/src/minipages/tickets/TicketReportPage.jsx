// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/pages/TicketReportPage.jsx
import React, { useState, useEffect } from "react";
import {
  Button,
  Form,
  Spinner,
  Alert,
  Row,
  Col,
  Nav,
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
import { getAuthToken } from "../../utils/authUtils";
import ReusablePageStructure from "../../components/ReusablePageStructure.jsx"; // Import page structure
import { useNavigate } from "react-router-dom"; // For navigation

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

// This is now TicketReportPage
const TicketReportPage = () => {
  const [period, setPeriod] = useState("7days");
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportData, setReportData] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  const navigate = useNavigate();

  const periodOptions = [
    { value: "7days", label: "Last 7 Days" },
    { value: "30days", label: "Last 30 Days" },
    { value: "90days", label: "Last 90 Days" },
    { value: "1year", label: "Last Year" },
    { value: "financialYear", label: "Financial Year" },
    { value: "all", label: "All Time" },
  ];

  const ticketStatusOrder = [
    "Quotation Sent",
    "PO Received",
    "Payment Pending",
    "Inspection",
    "Packing List",
    "Invoice Sent",
    "Hold",
    "Closed",
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
      const response = await apiClient.get(`reports/tickets`, {
        // Changed path
        params: { period },
        headers: { Authorization: `Bearer ${token}` },
      });
      setReportData(response.data.data);
    } catch (err) {
      let errorMessage =
        "Failed to fetch ticket report. An unknown error occurred.";
      if (err.response) {
        errorMessage =
          err.response.data?.message ||
          err.response.data?.error ||
          `Server error: ${err.response.status}`;
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

      const response = await apiClient.get(`reports/tickets`, {
        // Changed path
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
      let errorMessage =
        "Failed to export ticket report. An unknown error occurred.";
      if (err.response) {
        // Try to parse error from blob if it's a JSON error response
        if (
          err.response.data instanceof Blob &&
          err.response.data.type === "application/json"
        ) {
          const errorJson = await err.response.data.text();
          const parsedError = JSON.parse(errorJson);
          errorMessage =
            parsedError.message ||
            parsedError.error ||
            `Server error: ${err.response.status}`;
        } else {
          errorMessage =
            err.response.data?.message ||
            err.response.data?.error ||
            `Server error: ${err.response.status}`;
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
    fetchReport(); // Fetch on mount and when period changes
  }, [period]);

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
              <tr>
                <td>Total Tickets Created</td>
                <td>{reportData.totalTickets}</td>
              </tr>
              {ticketStatusOrder.map((status) => (
                <tr key={status}>
                  <td>{status} Tickets</td>
                  <td>{reportData.statusCounts?.[status] || 0}</td>
                </tr>
              ))}
              {reportData.statusCounts?.other > 0 && (
                <tr>
                  <td>Other Status Tickets</td>
                  <td>{reportData.statusCounts.other}</td>
                </tr>
              )}
              <tr>
                <td>Unique Clients (based on Company Name)</td>
                <td>{reportData.uniqueClientsCount}</td>
              </tr>
              <tr>
                <td>Total Value of Closed Tickets</td>
                <td>₹{reportData.totalValueClosedTickets?.toFixed(2)}</td>
              </tr>
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
          data: ticketStatusOrder.map(
            (status) => reportData.statusCounts?.[status] || 0
          ),
          backgroundColor: [
            // Add more colors if needed
            "rgba(75, 192, 192, 0.6)",
            "rgba(54, 162, 235, 0.6)",
            "rgba(255, 206, 86, 0.6)",
            "rgba(153, 102, 255, 0.6)",
            "rgba(255, 159, 64, 0.6)",
            "rgba(201, 203, 207, 0.6)",
            "rgba(255, 99, 132, 0.6)",
            "rgba(100, 255, 100, 0.6)",
          ],
          borderColor: [
            "rgba(75, 192, 192, 1)",
            "rgba(54, 162, 235, 1)",
            "rgba(255, 206, 86, 1)",
            "rgba(153, 102, 255, 1)",
            "rgba(255, 159, 64, 1)",
            "rgba(201, 203, 207, 1)",
            "rgba(255, 99, 132, 1)",
            "rgba(100, 255, 100, 1)",
          ],
          borderWidth: 1,
        },
      ],
    };

    return (
      <div className="report-charts">
        <div className="chart-container mb-4">
          <h5>Ticket Status Distribution</h5>
          <Bar
            data={chartData}
            options={{
              responsive: true,
              plugins: { legend: { position: "top" } },
            }}
          />
        </div>
      </div>
    );
  };

  const pageContent = (
    <>
      {error && <Alert variant="danger">{error}</Alert>}
      {/* Controls Row */}
      <Row className="mb-4 gx-3">
        <Col md={3}>
          <Form.Select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            disabled={loading || exportLoading}
          >
            <option value="">Select Report Period</option>
            {periodOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Form.Select>{" "}
        </Col>

        <Col md={3}>
          <Button
            className="w-100"
            variant={activeTab === "summary" ? "primary" : "outline-primary"}
            onClick={() => setActiveTab("summary")}
            disabled={loading || exportLoading}
          >
            Summary
          </Button>
        </Col>

        <Col md={3}>
          <Button
            className="w-100"
            variant={activeTab === "charts" ? "primary" : "outline-primary"}
            onClick={() => setActiveTab("charts")}
            disabled={loading || exportLoading}
          >
            <FaChartBar className="me-1" />
            Charts
          </Button>
        </Col>
        <Col md={3}>
          <Button
            className="w-100"
            variant="outline-success"
            onClick={handleExportToExcel}
            disabled={
              loading ||
              exportLoading ||
              !reportData ||
              reportData.totalTickets === 0
            }
          >
            {exportLoading ? (
              <>
                <Spinner as="span" size="sm" animation="border" /> Exporting...
              </>
            ) : (
              <>
                <FaFileExcel className="me-1" />
                Export Excel
              </>
            )}
          </Button>
        </Col>
      </Row>
      <div className="mt-3">
        {" "}
        {activeTab === "summary" && renderSummaryTab()}
        {activeTab === "charts" && renderChartsTab()}
      </div>
    </>
  );

  const pageFooter = null;

  return (
    <ReusablePageStructure
      title="Ticket Activity Report"
      footerContent={pageFooter}
    >
      {pageContent}
    </ReusablePageStructure>
  );
};

export default TicketReportPage;
