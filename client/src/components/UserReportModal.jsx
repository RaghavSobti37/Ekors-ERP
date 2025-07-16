import React, { useState, useEffect, useCallback } from "react";
import {
  Modal,
  Button,
  Form,
  Spinner,
  Alert,
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
import "../css/UserReportModal.css";

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

  // New render functions for single page layout
  const renderSummaryContent = useCallback(() => {
    if (!reportData) return null;
    
    return (
      <Row>
        <Col md={4}>
          <div className="report-card">
            <div className="report-card-header">
              <h6 className="mb-0">📄 Quotations</h6>
            </div>
            <div className="report-metric">
              <span className="report-metric-label">Total</span>
              <span className="report-metric-value">{reportData.quotationStats.total}</span>
            </div>
            <div className="report-metric">
              <span className="report-metric-label">Open</span>
              <span className="report-metric-value positive">{reportData.quotationStats.open}</span>
            </div>
            <div className="report-metric">
              <span className="report-metric-label">Hold</span>
              <span className="report-metric-value warning">{reportData.quotationStats.hold}</span>
            </div>
            <div className="report-metric">
              <span className="report-metric-label">Closed</span>
              <span className="report-metric-value">{reportData.quotationStats.closed}</span>
            </div>
            <div className="report-metric">
              <span className="report-metric-label">Total Value</span>
              <span className="report-metric-value">₹{(reportData.quotationStats.totalAmount || 0).toFixed(2)}</span>
            </div>
            <div className="stat-breakdown">
              <small>Open: ₹{(reportData.quotationStats.openAmount || 0).toFixed(2)}</small>
              <small>Hold: ₹{(reportData.quotationStats.holdAmount || 0).toFixed(2)}</small>
              <small>Closed: ₹{(reportData.quotationStats.closedAmount || 0).toFixed(2)}</small>
            </div>
          </div>
        </Col>
        
        <Col md={4}>
          <div className="report-card">
            <div className="report-card-header">
              <h6 className="mb-0">🎫 Tickets</h6>
            </div>
            <div className="report-metric">
              <span className="report-metric-label">Total</span>
              <span className="report-metric-value">{reportData.ticketStats.total}</span>
            </div>
            <div className="report-metric">
              <span className="report-metric-label">Open</span>
              <span className="report-metric-value positive">{reportData.ticketStats.open}</span>
            </div>
            <div className="report-metric">
              <span className="report-metric-label">Hold</span>
              <span className="report-metric-value warning">{reportData.ticketStats.hold}</span>
            </div>
            <div className="report-metric">
              <span className="report-metric-label">Closed</span>
              <span className="report-metric-value">{reportData.ticketStats.closed}</span>
            </div>
            <div className="report-metric">
              <span className="report-metric-label">Total Value</span>
              <span className="report-metric-value">₹{(reportData.ticketStats.totalAmount || 0).toFixed(2)}</span>
            </div>
            <div className="stat-breakdown">
              <small>Open: ₹{(reportData.ticketStats.openAmount || 0).toFixed(2)}</small>
              <small>Hold: ₹{(reportData.ticketStats.holdAmount || 0).toFixed(2)}</small>
              <small>Closed: ₹{(reportData.ticketStats.closedAmount || 0).toFixed(2)}</small>
            </div>
          </div>
        </Col>
        
        <Col md={4}>
          <div className="report-card">
            <div className="report-card-header">
              <h6 className="mb-0">⏱️ Time Logs</h6>
            </div>
            <div className="report-metric">
              <span className="report-metric-label">Total Tasks</span>
              <span className="report-metric-value">{reportData.logTimeStats.totalTasks}</span>
            </div>
            <div className="report-metric">
              <span className="report-metric-label">Total Hours</span>
              <span className="report-metric-value">{((reportData.logTimeStats.totalTimeSpent || 0) / 60).toFixed(1)}h</span>
            </div>
            <div className="report-metric">
              <span className="report-metric-label">Avg per Task</span>
              <span className="report-metric-value">
                {reportData.logTimeStats.totalTasks > 0 
                  ? ((reportData.logTimeStats.totalTimeSpent / reportData.logTimeStats.totalTasks) / 60).toFixed(1) 
                  : '0'}h
              </span>
            </div>
            <div className="report-metric">
              <span className="report-metric-label">Productivity</span>
              <span className="report-metric-value positive">
                {reportData.logTimeStats.totalTasks > 0 ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        </Col>
      </Row>
    );
  }, [reportData]);

  const renderChartsContent = useCallback(() => {
    if (!reportData) return null;
    
    // Define chart data
    const quotationVsTicketData = {
      labels: ['Total', 'Open', 'Hold', 'Closed'],
      datasets: [
        {
          label: 'Quotations',
          data: [
            reportData.quotationStats.total,
            reportData.quotationStats.open,
            reportData.quotationStats.hold,
            reportData.quotationStats.closed
          ],
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        },
        {
          label: 'Tickets',
          data: [
            reportData.ticketStats.total,
            reportData.ticketStats.open,
            reportData.ticketStats.hold,
            reportData.ticketStats.closed
          ],
          backgroundColor: 'rgba(255, 99, 132, 0.6)',
          borderColor: 'rgba(255, 99, 132, 1)',
          borderWidth: 1
        }
      ]
    };

    const statusDistributionData = {
      labels: ['Open', 'Hold', 'Closed'],
      datasets: [
        {
          label: 'Status Distribution',
          data: [
            reportData.quotationStats.open + reportData.ticketStats.open,
            reportData.quotationStats.hold + reportData.ticketStats.hold,
            reportData.quotationStats.closed + reportData.ticketStats.closed
          ],
          backgroundColor: [
            'rgba(75, 192, 192, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(153, 102, 255, 0.6)'
          ],
          borderColor: [
            'rgba(75, 192, 192, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(153, 102, 255, 1)'
          ],
          borderWidth: 1
        }
      ]
    };
    
    return (
      <Row>
        <Col md={6}>
          <div className="chart-container">
            <div className="chart-title">Quotations vs Tickets</div>
            <Bar
              data={quotationVsTicketData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                  },
                  title: {
                    display: true,
                    text: 'Performance Comparison'
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true
                  }
                }
              }}
              height={150}
            />
          </div>
        </Col>
        
        <Col md={6}>
          <div className="chart-container">
            <div className="chart-title">Status Distribution</div>
            <Bar
              data={statusDistributionData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                  },
                  title: {
                    display: true,
                    text: 'Work Status Breakdown'
                  }
                },
                scales: {
                  y: {
                    beginAtZero: true
                  }
                }
              }}
              height={150}
            />
          </div>
        </Col>
      </Row>
    );
  }, [reportData]);

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
                  <div>Total Value: ₹{(reportData.quotationStats?.totalAmount || 0).toFixed(2)}</div>
                  <div className="stat-breakdown">
                    <small>Open: ₹{(reportData.quotationStats?.openAmount || 0).toFixed(2)}</small>
                    <small>Hold: ₹{(reportData.quotationStats?.holdAmount || 0).toFixed(2)}</small>
                    <small>Closed: ₹{(reportData.quotationStats?.closedAmount || 0).toFixed(2)}</small>
                  </div>
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
                  <div>Total Value: ₹{(reportData.ticketStats?.totalAmount || 0).toFixed(2)}</div>
                  <div className="stat-breakdown">
                    <small>Open: ₹{(reportData.ticketStats?.openAmount || 0).toFixed(2)}</small>
                    <small>Hold: ₹{(reportData.ticketStats?.holdAmount || 0).toFixed(2)}</small>
                    <small>Closed: ₹{(reportData.ticketStats?.closedAmount || 0).toFixed(2)}</small>
                  </div>
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
    <Modal 
      show={show} 
      onHide={onHide} 
      size="xl" 
      className="user-report-modal fullscreen-modal"
      backdrop={true}
      keyboard={true}
    >
      <Modal.Header
        closeButton
        style={{ backgroundColor: "maroon", color: "white", borderBottom: "2px solid #660000" }}
      >
        <Modal.Title className="fw-bold">
          {user ? `${user.firstname} ${user.lastname}'s Comprehensive Report` : "User Report"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ overflowY: "auto", padding: "20px" }}>
        {error && <Alert variant="danger">{error}</Alert>}
        <Row className="mb-4 align-items-center">
          <Col md={3} className="mb-3 mb-md-0">
            <Form.Group controlId="periodSelectModal" className="mb-0">
              <Form.Label className="fw-semibold">Report Period</Form.Label>
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
          <Col md={6} className="text-center">
            <div className="report-generation-info">
              <small className="text-muted">
                <strong>Report Generated By:</strong> {user?.firstname} {user?.lastname}<br/>
                <strong>Generated On:</strong> {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
              </small>
            </div>
          </Col>
          <Col md={3} className="text-end">
            <div className="d-flex gap-2 justify-content-end">
              <Button
                variant="outline-primary"
                size="sm"
                onClick={fetchReport}
                disabled={loading}
              >
                🔄 Refresh
              </Button>
              <Button
                variant="outline-danger"
                size="sm"
                onClick={generatePDF}
                disabled={loading || !reportData}
              >
                <FaFilePdf className="me-1" />
                Generate PDF
              </Button>
            </div>
          </Col>
        </Row>
        
        {/* Single page content - no tabs */}
        <div className="report-content">
          {loading && (
            <div className="d-flex justify-content-center align-items-center loading-state">
              <div className="text-center">
                <Spinner animation="border" variant="primary" />
                <p className="mt-2">Loading report data...</p>
              </div>
            </div>
          )}
          
          {!loading && reportData && (
            <div className="single-page-report">
              {/* Summary Section */}
              <div className="summary-section mb-4">
                <h5 className="section-title">📊 Performance Summary</h5>
                {renderSummaryContent()}
              </div>
              
              {/* Charts Section */}
              <div className="charts-section">
                <h5 className="section-title">📈 Analytics & Charts</h5>
                {renderChartsContent()}
              </div>
            </div>
          )}
          
          {!loading && !reportData && !error && (
            <div className="text-center p-5">
              <p className="text-muted">Select a period and click refresh to view the report.</p>
            </div>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer className="bg-light">
        <div className="d-flex justify-content-between w-100 align-items-center">
          <div className="text-muted small">
            {reportData && (
              <span>
                Report for: <strong>{reportData.user.firstname} {reportData.user.lastname}</strong> | 
                Period: <strong>{reportData.period}</strong>
              </span>
            )}
          </div>
          <div>
            <Button
              variant="secondary"
              onClick={onHide}
            >
              Close
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default React.memo(UserReportModalComponent);
