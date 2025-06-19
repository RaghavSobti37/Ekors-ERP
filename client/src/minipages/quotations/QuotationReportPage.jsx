// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/minipages/quotations/QuotationReportPage.jsx
import { useState, useEffect, useCallback } from "react";
import { Button, Form, Spinner, Alert, Table, Row, Col } from "react-bootstrap";
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
import apiClient from "../../utils/apiClient.js"; // Using global apiClient
import ReusablePageStructure from "../../components/ReusablePageStructure.jsx";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const QuotationReportPage = () => {
  const [period, setPeriod] = useState("");
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
      // Updated endpoint to use the reports base path
      const response = await apiClient(`/reports/quotations/summary`, { // Using apiClient as a function
        params: { period },
        method: 'GET'
      });
      setReportData(response.data);
    } catch (err) {
      let errorMessage = "Failed to fetch report. An unknown error occurred.";
      if (err.response) {
        if (typeof err.response.data === "string") {
          errorMessage = err.response.data;
        } else if (err.response.data?.error) {
          errorMessage = err.response.data.error;
        } else if (err.response.data?.message) {
          errorMessage = err.response.data.message;
        } else {
          errorMessage = `Server error: ${err.response.status}`;
        }
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
      // Updated endpoint to use the reports base path
      const response = await apiClient(`/reports/quotations/excel`, { // Using apiClient as a function
        params: { period },
        responseType: "blob", // apiClient should be configured to handle this or pass it to axios
        method: 'GET'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `quotation-report-${period}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      let errorMessage = "Failed to export report. An unknown error occurred.";
      if (err.response) {
        errorMessage =
          err.response.data?.message || `Server error: ${err.response.status}`;
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
  }, [fetchReport]);

  const renderSummaryTab = () => {
    if (!reportData) return null;
    return (
      <div className="report-summary">
        <Table striped bordered hover size="sm" className="mt-3">
          <tbody>
            <tr>
              <td>Total Quotations Created</td>
              <td>{reportData.totalQuotations}</td>
            </tr>
            <tr>
              <td>Open Quotations</td>
              <td>{reportData.statusCounts?.open || 0}</td>
            </tr>
            <tr>
              <td>Running Quotations</td>
              <td>{reportData.statusCounts?.running || 0}</td>
            </tr>
            <tr>
              <td>Hold Quotations</td>
              <td>{reportData.statusCounts?.hold || 0}</td>
            </tr>
            <tr>
              <td>Closed Quotations</td>
              <td>{reportData.statusCounts?.closed || 0}</td>
            </tr>
            <tr>
              <td>Unique Clients</td>
              <td>{reportData.uniqueClientsCount}</td>
            </tr>
            <tr>
              <td>Total Value of Closed Quotations</td>
              <td>₹{(reportData.totalClosedValue || 0).toFixed(2)}</td>
            </tr>
          </tbody>
        </Table>
      </div>
    );
  };

  const renderChartsTab = () => {
    if (!reportData || !reportData.statusCounts)
      return (
        <Alert variant="info" className="mt-3">
          Chart data is not available.
        </Alert>
      );
    const statusData = {
      labels: ["Open", "Running", "Hold", "Closed"],
      datasets: [
        {
          label: "Quotation Status",
          data: [
            reportData.statusCounts?.open || 0,
            reportData.statusCounts?.running || 0,
            reportData.statusCounts?.hold || 0,
            reportData.statusCounts?.closed || 0,
          ],
          backgroundColor: [
            "rgba(75, 192, 192, 0.6)",
            "rgba(54, 162, 235, 0.6)",
            "rgba(255, 206, 86, 0.6)",
            "rgba(153, 102, 255, 0.6)",
          ],
          borderColor: [
            "rgba(75, 192, 192, 1)",
            "rgba(54, 162, 235, 1)",
            "rgba(255, 206, 86, 1)",
            "rgba(153, 102, 255, 1)",
          ],
          borderWidth: 1,
        },
      ],
    };
    return (
      <div className="report-charts">
        <div className="chart-container mb-4">
          <h5>Quotation Status Distribution</h5>
          <Bar
            data={statusData}
            options={{
              responsive: true,
              plugins: { legend: { position: "top" } },
            }}
          />
        </div>
      </div>
    );
  };

  const reportPageTitle = (
    <div>
      Quotation Activity Report
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
              reportData.totalQuotations === 0
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

  return (
    <ReusablePageStructure title={reportPageTitle} footerContent={null}>
      {pageContent}
    </ReusablePageStructure>
  );
};

export default QuotationReportPage;
