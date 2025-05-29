import React, { useState, useEffect } from "react";
import {
  Modal,
  Button,
  Form,
  Spinner,
  Alert,
  Tab,
  Tabs,
} from "react-bootstrap";
import { FaFilePdf, FaFileExcel, FaChartBar, FaTimes } from "react-icons/fa";
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
  baseURL: "http://localhost:3000", // Adjust if your backend runs on a different port/URL
});

const UserReportModal = ({ show, onHide, user }) => {
  console.log(
    "[UserReportModal.jsx] Component RENDER/UPDATE. Props - show:", show, 
    "user:", user ? { _id: user._id, firstname: user.firstname } : "null"
  );

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

  const fetchReport = async () => {
    if (!user || !user._id) {
      console.warn("[UserReportModal.jsx] fetchReport: User or user ID is missing. Aborting fetch.", user);
      setError("User information is missing. Cannot fetch report.");
      return;
    }
    console.log(`[UserReportModal.jsx] fetchReport START: UserID: ${user._id}, Period: ${period}`);

    setLoading(true);
    setError(""); // Clear previous error
    setReportData(null); // Clear previous data

    try {
      const token = getAuthToken(); // Use the centralized function

      if (!token) {
        console.error("[UserReportModal.jsx] fetchReport: Auth token not found.");
        setError("Authentication token not found. Please log in again.");
        setLoading(false);
        return;
      }

      console.log(`[UserReportModal.jsx] fetchReport: Making API call to /api/reports/users/${user._id} with period ${period}`);
      const response = await apiClient.get(`/api/reports/users/${user._id}`, {
        params: { period },
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("[UserReportModal.jsx] fetchReport: API call SUCCEEDED. Response status:", response.status, "Data:", response.data);
      setReportData(response.data.data);
      console.log("[UserReportModal.jsx] fetchReport: reportData state updated.");
    } catch (err) {
      console.error("[UserReportModal.jsx] fetchReport: API call FAILED.");
      console.error("[UserReportModal.jsx] fetchReport: Full Axios error object:", JSON.parse(JSON.stringify(err))); // Deep clone for better logging
      
      let errorMessage = "Failed to fetch report. An unknown error occurred.";
      
      if (err.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error("[UserReportModal.jsx] fetchReport: Server Response Data:", err.response.data);
        console.error("[UserReportModal.jsx] fetchReport: Server Response Status:", err.response.status);
        if (err.response.data) {
          if (typeof err.response.data === 'string') {
            errorMessage = err.response.data;
          } else if (err.response.data.error) {
            errorMessage = err.response.data.error;
            if (err.response.data.details) {
              errorMessage += ` (Details: ${err.response.data.details})`;
            }
          } else if (err.response.data.message) { // For generic error objects
            errorMessage = err.response.data.message;
          } else {
            errorMessage = `Server error: ${err.response.status}. Please check server logs.`;
          }
        } else {
          errorMessage = `Server error: ${err.response.status}. No additional data. Please check server logs.`;
        }
      } else if (err.request) {
        // The request was made but no response was received
        console.error("[UserReportModal.jsx] fetchReport: No response received:", err.request);
        errorMessage = "Failed to fetch report. No response from server. Check network or if server is running.";
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error("[UserReportModal.jsx] fetchReport: Error setting up request:", err.message);
        errorMessage = `Failed to fetch report: ${err.message}`;
      }
      setError(errorMessage);
      console.error("[UserReportModal.jsx] fetchReport: Error state updated with message:", errorMessage);
    } finally {
      setLoading(false);
      console.log("[UserReportModal.jsx] fetchReport END: Loading set to false.");
    }
  };

  const generatePDF = async () => {
    if (!user || !user._id) {
      console.warn("[UserReportModal.jsx] generatePDF: User or user ID is missing. Aborting PDF generation.");
      setError("User information is missing. Cannot generate PDF.");
      return;
    }
    const token = getAuthToken(); // Use the centralized function

    if (!token) {
      console.error("[UserReportModal.jsx] generatePDF: Auth token not found.");
      setError("Authentication token not found. Please log in again.");
      return;
    }
    console.log(`[UserReportModal.jsx] generatePDF START: UserID: ${user._id}, Period: ${period}`);

    try {
      const response = await apiClient.get(
        `/api/reports/users/${user._id}/generate-pdf`,
        {
          params: { period },
          responseType: "blob",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      console.log("[UserReportModal.jsx] generatePDF: API call SUCCEEDED. Response status:", response.status, "Response Type:", response.headers['content-type']);
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
      console.log("[UserReportModal.jsx] generatePDF: PDF download initiated.");
    } catch (err) {
      console.error("[UserReportModal.jsx] generatePDF: API call FAILED.");
      console.error("[UserReportModal.jsx] generatePDF: Full Axios error object:", JSON.parse(JSON.stringify(err)));
      
      let pdfErrorMessage = "Failed to generate PDF. An unknown error occurred.";
      if (err.response) {
        try {
          // Error response for PDF might be a Blob containing JSON text, or already JSON/string
          const errorData = (err.response.data instanceof Blob)
            ? JSON.parse(await err.response.data.text()) 
            : err.response.data;
            
          if (typeof errorData === 'string') {
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
        pdfErrorMessage = "No response from server during PDF generation. Check network or if server is running.";
      } else {
        pdfErrorMessage = `Error setting up PDF request: ${err.message}`;
      }
      setError(pdfErrorMessage);
      console.error("[UserReportModal.jsx] generatePDF: Error state updated with message:", pdfErrorMessage);
    }
  };

  useEffect(() => {
    console.log(
      "[UserReportModal.jsx] useEffect [show, user?._id, period] triggered. show:", show, 
      "user ID:", user?._id, 
      "period:", period
    );
    if (show && user?._id) {
      console.log("[UserReportModal.jsx] useEffect: Conditions met (show=true, user._id exists). Calling fetchReport.");
      fetchReport();
    } else if (show && !user?._id) {
      console.warn("[UserReportModal.jsx] useEffect: Modal is shown but user ID is missing. Report will not be fetched.");
      setError("User data not available to fetch report.");
      setReportData(null); // Clear any stale data
    } else if (!show) {
      console.log("[UserReportModal.jsx] useEffect: Modal is hidden. Clearing report data and error.");
      // Optionally clear data when modal is hidden to ensure fresh data next time
      // setReportData(null); 
      // setError("");
    }
  }, [show, user?._id, period]); // user?._id ensures re-fetch if user object changes with a new ID

  useEffect(() => {
    console.log("[UserReportModal.jsx] State change: activeTab updated to:", activeTab);
  }, [activeTab]);



  const totalTimeSpentInHours = reportData?.logTimeStats?.totalTimeSpent
    ? (reportData.logTimeStats.totalTimeSpent / 60).toFixed(2)
    : "0.00";


  const renderSummaryTab = () => (
    // No changes to the JSX structure, only adding a log
    <div className="report-summary">
      {console.log("[UserReportModal.jsx] renderSummaryTab: Rendering. Loading:", loading, "ReportData:", reportData ? "Exists" : "null")}
      {loading && !reportData ? <div className="text-center p-5"><Spinner animation="border" /> <p>Loading report...</p></div> : null}
      {!loading && !reportData && !error && <div className="text-center p-3"><p>Select a period to view the report.</p></div>}
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
                Total (Closed): ₹{(reportData.ticketStats?.totalAmount || 0).toFixed(2)}
              </div>
            </div>

            <div className="stat-card">
              <h5>Time Logged</h5>
              <div className="stat-value">
                {reportData.logTimeStats?.totalTasks ?? 0}
              </div>
              <div className="stat-details">
                <span>Total Hours:</span>
                <span className="text-info">
                  {totalTimeSpentInHours}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderChartsTab = () => {
    console.log("[UserReportModal.jsx] renderChartsTab: Rendering. ReportData:", reportData ? "Exists" : "null");
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
  };

  return (
    <Modal show={show} onHide={onHide} size="lg" centered>
      <Modal.Header closeButton>
        <Modal.Title>
          {user ? `${user.firstname} ${user.lastname}'s Report` : "User Report"}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="report-controls mb-3">
          <Form.Group controlId="periodSelect">
            <Form.Label>Report Period</Form.Label>
            <Form.Control
              as="select"
              value={period}
              onChange={(e) => {
                console.log("[UserReportModal.jsx] Period dropdown CHANGED. New value:", e.target.value);
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
        </div>

        <Tabs
          activeKey={activeTab}
          onSelect={(k) => {
            console.log("[UserReportModal.jsx] Tab SELECTED. New activeKey:", k);
            setActiveTab(k);
          }}
          className="mb-3"
        >
          <Tab eventKey="summary" title="Summary">
            {renderSummaryTab()}
          </Tab>
          <Tab eventKey="charts" title="Charts">
            {renderChartsTab()}
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <div className="d-flex justify-content-between w-100">
          <div>
            <Button variant="outline-primary" onClick={() => {
              console.log("[UserReportModal.jsx] Refresh button CLICKED.");
              fetchReport();
            }}>
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
            <Button variant="outline-danger" onClick={() => {
              console.log("[UserReportModal.jsx] Generate PDF button CLICKED.");
              generatePDF();
            }}>
              <FaFilePdf className="me-1" />
              Generate PDF
            </Button>
          </div>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default UserReportModal;
