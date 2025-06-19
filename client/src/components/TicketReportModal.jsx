// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/minipages/tickets/TicketReportPage.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Button,
  Form,
  Spinner,
  Alert,
  Row,
  Col,
  // Nav, // Nav was unused
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
import axios from "axios";
import { getAuthToken } from "../utils/authUtils";
import ReusablePageStructure from "../components/ReusablePageStructure.jsx";
// import { useNavigate } from "react-router-dom"; // Removed as navigate is unused

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
});

const TicketReportPageComponent = () => {
  const [period, setPeriod] = useState("");
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportData, setReportData] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  // const navigate = useNavigate(); // Removed as navigate is unused

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

  const fetchReport = useCallback(async () => {
    if (!period) {
      setReportData(null);
      setError("");
      return;
    }
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

      const response = await apiClient.get(`reports/tickets`, {
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
  }, [period]);

  const handleExportToExcel = useCallback(async () => {
    if (!period || !reportData) return;
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
        params: { period, exportToExcel: "true" },
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
        if (
          err.response.data instanceof Blob &&
          err.response.data.type === "application/json"
        ) {
          try {
            const errorJson = await err.response.data.text();
            const parsedError = JSON.parse(errorJson);
            errorMessage =
              parsedError.message ||
              parsedError.error ||
              `Server error: ${err.response.status}`;
          } catch (parseError) {
            errorMessage = `Server error: ${err.response.status} (Could not parse error response)`;
          }
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
  }, [period, reportData]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]); // fetchReport is already memoized

  const renderSummaryTab = useCallback(() => {
    if (!reportData) return null;
    return (
      <div className="report-summary">
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
              <td>₹{(reportData.totalValueClosedTickets || 0).toFixed(2)}</td>
            </tr>
          </tbody>
        </Table>
      </div>
    );
  }, [reportData, ticketStatusOrder]);

  const renderChartsTab = useCallback(() => {
    if (!reportData || !reportData.statusCounts)
      return (
        <Alert variant="info" className="mt-3">
          Chart data is not available.
        </Alert>
      );

    const chartData = {
      labels: ticketStatusOrder,
      datasets: [
        {
          label: "Ticket Status",
          data: ticketStatusOrder.map(
            (status) => reportData.statusCounts?.[status] || 0
          ),
          backgroundColor: [
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
  }, [reportData, ticketStatusOrder]); // ticketStatusOrder is a stable constant

  const reportPageTitle = (
    <div>
      Ticket Activity Report
      {reportData && !loading && reportData.period && reportData.dateRange && (
        <div style={{ fontSize: "0.8rem", fontWeight: "normal", opacity: 0.9 }}>
          Period:{" "}
          {periodOptions.find((p) => p.value === reportData.period)?.label ||
            reportData.period}{" "}
          ({reportData.dateRange})
        </div>
      )}
    </div>
  );

  const pageContent = (
    <>
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
          </Form.Select>
        </Col>
        <Col md={3}>
          <Button
            className="w-100"
            variant={activeTab === "summary" ? "primary" : "outline-primary"}
            onClick={() => setActiveTab("summary")}
            disabled={loading || exportLoading || !period}
          >
            Summary
          </Button>
        </Col>
        <Col md={3}>
          <Button
            className="w-100"
            variant={activeTab === "charts" ? "primary" : "outline-primary"}
            onClick={() => setActiveTab("charts")}
            disabled={loading || exportLoading || !period}
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
              !period ||
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

      {/* Content Display Area */}
      {loading && (
        <div className="text-center p-5">
          <Spinner animation="border" />
          <p>Loading report data...</p>
        </div>
      )}
      {!loading && error && <Alert variant="danger">{error}</Alert>}
      {!loading && !error && !period && (
        <Alert variant="info" className="text-center">
          Please select a report period to view data.
        </Alert>
      )}
      {!loading && !error && period && !reportData && (
        <Alert variant="info" className="text-center">
          No data found for the selected period, or an error occurred.
        </Alert>
      )}

      {!loading && !error && period && reportData && (
        <div className="mt-3">
          {activeTab === "summary" && renderSummaryTab()}
          {activeTab === "charts" && renderChartsTab()}
        </div>
      )}
    </>
  );

  const pageFooter = null; // Unused, but kept for consistency if needed later

  return (
    <ReusablePageStructure title={reportPageTitle} footerContent={pageFooter}>
      {pageContent}
    </ReusablePageStructure>
  );
};

export default React.memo(TicketReportPageComponent);
