import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  Button,
  Form,
  Spinner,
  Alert,
  Nav,
  Row,
  Col,
} from "react-bootstrap";
import { FaFilePdf, FaChartBar } from "react-icons/fa"; // Removed FaFileExcel, FaTimes
import axios from "axios";
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

import { getAuthToken } from "../utils/authUtils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Define an Axios instance for API calls to the backend
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:3000",
});

const UserReportModalComponent = ({ show, onHide, user }) => {
  const [period, setPeriod] = useState("7days");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reportData, setReportData] = useState(null);
  const [activeTab, setActiveTab] = useState("summary");
  const periodOptions = [
    { value: "7days", label: "Last 7 Days" },
    { value: "30days", label: "Last 30 Days" },
    { value: "90days", label: "Last 90 Days" },
    { value: "150days", label: "Last 150 Days" },
    { value: "1year", label: "Last Year" },
    { value: "financialYear", label: "Financial Year" },
  ];

  const fetchReport = useCallback(async () => {
    if (!user || !user._id) {
      setError("User information is missing. Cannot fetch report.");
      return;
    }
    setLoading(true);
    setError(""); // Clear previous error
    setReportData(null); // Clear previous data
    try {
      const token = getAuthToken(); // Use the centralized function
      if (!token) {
        setError("Authentication token not found. Please log in again.");
        setLoading(false);
        return;
      }
      const response = await apiClient.get(`/reports/users/${user._id}`, {
        params: { period },
        headers: { Authorization: `Bearer ${token}` },
      });
      setReportData(response.data.data);
    } catch (err) {
      let errorMessage = "Failed to fetch report. An unknown error occurred.";
      if (err.response) {
        if (err.response.data) {
          if (typeof err.response.data === "string") {
            errorMessage = err.response.data;
          } else if (err.response.data.error) {
            errorMessage = err.response.data.error;
            if (err.response.data.details)
              errorMessage += ` (Details: ${err.response.data.details})`;
          } else if (err.response.data.message) {
            // For generic error objects
            errorMessage = err.response.data.message;
          } else {
            errorMessage = `Server error: ${err.response.status}. Please check server logs.`;
          }
        } else {
          errorMessage = `Server error: ${err.response.status}. No additional data. Please check server logs.`;
        }
      } else if (err.request) {
        errorMessage =
          "Failed to fetch report. No response from server. Check network or if server is running.";
      } else {
        errorMessage = `Failed to fetch report: ${err.message}`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user, period]);

  const generatePDF = useCallback(async () => {
    if (!user || !user._id) {
      setError("User information is missing. Cannot generate PDF.");
      return;
    }
    const token = getAuthToken(); // Use the centralized function
    if (!token) {
      setError("Authentication token not found. Please log in again.");
      return;
    }
    try {
      const response = await apiClient.get(
        `/reports/users/${user._id}/generate-pdf`,
        {
          params: { period },
          responseType: "blob",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `user-report-${user.firstname}-${user.lastname}.pdf`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url); // Clean up blob URL
    } catch (err) {
      let pdfErrorMessage =
        "Failed to generate PDF. An unknown error occurred.";
      if (err.response) {
        try {
          // Error response for PDF might be a Blob containing JSON text, or already JSON/string
          const errorData =
            err.response.data instanceof Blob
              ? JSON.parse(await err.response.data.text())
              : err.response.data;

          if (typeof errorData === "string") {
            pdfErrorMessage = errorData;
          } else if (errorData && errorData.error) {
            pdfErrorMessage = errorData.error;
            if (errorData.details) {
              pdfErrorMessage += ` (Details: ${errorData.details})`;
            }
          } else if (errorData && errorData.message) {
            pdfErrorMessage = errorData.message;
          } else {
            pdfErrorMessage = `Server error during PDF generation: ${err.response.status}. Check server logs.`;
          }
        } catch (parseError) {
          pdfErrorMessage = `Failed to parse PDF error response. Server status: ${err.response.status}.`;
        }
      } else if (err.request) {
        pdfErrorMessage =
          "No response from server during PDF generation. Check network or if server is running.";
      } else {
        pdfErrorMessage = `Error setting up PDF request: ${err.message}`;
      }
      setError(pdfErrorMessage);
    }
  }, [user, period]);

  useEffect(() => {
    if (show && user?._id) {
      fetchReport();
    } else if (show && !user?._id) {
      setError("User data not available to fetch report.");
      setReportData(null); // Clear any stale data
    }
  }, [show, user, period, fetchReport]); // Added fetchReport to dependencies

  const totalTimeSpentInHours = reportData?.logTimeStats?.totalTimeSpent
    ? (reportData.logTimeStats.totalTimeSpent / 60).toFixed(2)
    : "0.00";

  const renderSummaryTab = useCallback(() => {
    if (loading && !reportData)
      return (
        <div className="text-center p-5">
          <Spinner animation="border" /> <p>Loading report...</p>
        </div>
      );
    if (!loading && !reportData && !error)
      return (
        <div className="text-center p-3">
          <p>Select a period to view the report.</p>
        </div>
      );
    if (!reportData) return null; // If error occurred or no data after loading
    return (
      <div className="report-summary">
        {reportData && (
          <>
            <div className="report-header mb-4">
              <h4>
                Activity Report for {reportData.user.firstname}{" "}
                {reportData.user.lastname}
              </h4>
              <p className="text-muted">Period: {reportData.period}</p>
            </div>

            <div className="stats-grid mb-4">
              <div className="stat-card">
                <h5>Quotations</h5>
                <div className="stat-value">
                  {reportData?.quotationStats?.total ?? 0}
                </div>
                <div className="stat-details">
                  <span className="text-success">
                    Open: {reportData.quotationStats.open}
                  </span>
                  <span className="text-warning">
                    Hold: {reportData.quotationStats.hold}
                  </span>
                  <span className="text-primary">
                    Closed: {reportData.quotationStats.closed}
                  </span>
                </div>
                <div className="stat-amount">
                  Total (Closed): ₹
                  {(reportData.quotationStats?.totalAmount || 0).toFixed(2)}
                </div>
              </div>

              <div className="stat-card">
                <h5>Tickets</h5>
                <div className="stat-value">{reportData.ticketStats.total}</div>
                <div className="stat-details">
                  <span className="text-success">
                    Open: {reportData.ticketStats.open}
                  </span>
                  <span className="text-warning">
                    Hold: {reportData.ticketStats.hold}
                  </span>
                  <span className="text-primary">
                    Closed: {reportData.ticketStats.closed}
                  </span>
                </div>
                <div className="stat-amount">
                  Total (Closed): ₹
                  {(reportData.ticketStats?.totalAmount || 0).toFixed(2)}
                </div>
              </div>

              <div className="stat-card">
                <h5>Time Logged</h5>
                <div className="stat-value">
                  {reportData.logTimeStats?.totalTasks ?? 0}
                </div>
                <div className="stat-details">
                  <span>Total Hours:</span>
                  <span className="text-info">{totalTimeSpentInHours}</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }, [reportData, loading, error, totalTimeSpentInHours]);

  const renderChartsTab = useCallback(() => {
    if (!reportData) return null;

    const quotationData = {
      labels: ["Open", "Hold", "Closed"],
      datasets: [
        {
          label: "Quotations",
          data: [
            reportData.quotationStats.open,
            reportData.quotationStats.hold,
            reportData.quotationStats.closed,
          ],
          backgroundColor: [
            "rgba(75, 192, 192, 0.6)",
            "rgba(255, 206, 86, 0.6)",
            "rgba(54, 162, 235, 0.6)",
          ],
          borderColor: [
            "rgba(75, 192, 192, 1)",
            "rgba(255, 206, 86, 1)",
            "rgba(54, 162, 235, 1)",
          ],
          borderWidth: 1,
        },
      ],
    };

    const ticketData = {
      labels: ["Open", "Hold", "Closed"],
      datasets: [
        {
          label: "Tickets",
          data: [
            reportData.ticketStats.open,
            reportData.ticketStats.hold,
            reportData.ticketStats.closed,
          ],
          backgroundColor: [
            "rgba(75, 192, 192, 0.6)",
            "rgba(255, 206, 86, 0.6)",
            "rgba(54, 162, 235, 0.6)",
          ],
          borderColor: [
            "rgba(75, 192, 192, 1)",
            "rgba(255, 206, 86, 1)",
            "rgba(54, 162, 235, 1)",
          ],
          borderWidth: 1,
        },
      ],
    };

    return (
      <div className="report-charts">
        <div className="chart-container mb-4">
          <h5>Quotation Status</h5>
          <Bar
            data={quotationData}
            options={{
              responsive: true,
              plugins: {
                legend: {
                  position: "top",
                },
              },
            }}
          />
        </div>

        <div className="chart-container mb-4">
          <h5>Ticket Status</h5>
          <Bar
            data={ticketData}
            options={{
              responsive: true,
              plugins: {
                legend: {
                  position: "top",
                },
              },
            }}
          />
        </div>
      </div>
    );
  }, [reportData]);

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header
        closeButton
        style={{ backgroundColor: "maroon", color: "white" }}
      >
        <Modal.Title>
          {user ? `${user.firstname} ${user.lastname}'s Report` : "User Report"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <Row className="mb-3 align-items-end">
          <Col md={5} className="mb-3 mb-md-0">
            <Form.Group controlId="periodSelectModal" className="mb-0">
              <Form.Label>Report Period</Form.Label>
              <Form.Control
                as="select"
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value);
                }}
                disabled={loading}
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Form.Control>
            </Form.Group>
          </Col>
          <Col md={7}>
            <Nav
              variant="tabs"
              activeKey={activeTab}
              onSelect={(k) => {
                setActiveTab(k);
              }}
              className="user-report-nav-tabs"
            >
              <Nav.Item>
                <Nav.Link eventKey="summary">Summary</Nav.Link>
              </Nav.Item>
              <Nav.Item>
                <Nav.Link
                  eventKey="charts"
                  style={activeTab !== "charts" ? { color: "#0d6efd" } : {}}
                >
                  {" "}
                  {/* Highlight inactive Charts tab */}
                  <FaChartBar className="me-1" />
                  Charts
                </Nav.Link>
              </Nav.Item>
            </Nav>
          </Col>
        </Row>
        <div className="mt-3">
          {" "}
          {/* Content area for tabs */}
          {activeTab === "summary" && renderSummaryTab()}
          {activeTab === "charts" && renderChartsTab()}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="d-flex justify-content-between w-100">
          <div>
            <Button
              variant="outline-primary"
              onClick={fetchReport}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
          <div>
            {/* <Button
              variant="outline-success"
              onClick={exportToExcel}
              className="me-2"
            >
              <FaFileExcel className="me-1" />
              Export Excel
            </Button> */}
            <Button
              variant="outline-danger"
              onClick={generatePDF}
              disabled={loading || !reportData}
            >
              <FaFilePdf className="me-1" />
              Generate PDF
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default React.memo(UserReportModalComponent);
