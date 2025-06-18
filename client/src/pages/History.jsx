import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import ActionButtons from "../components/ActionButtons";
import Footer from "../components/Footer";
import {
  showToast,
  handleApiError,
  formatDisplayDate as formatDisplayDateHelper,
} from "../utils/helpers";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Table, Button, Alert, Form, Offcanvas } from "react-bootstrap";
import Pagination from "../components/Pagination";
import ReusableTable from "../components/ReusableTable";
import apiClient from "../utils/apiClient";
import { getAuthToken as getAuthTokenUtil } from "../utils/authUtils";
import ReusableModal from "../components/ReusableModal.jsx";
import "../css/Style.css";
import { FaPlus, FaFilter, FaSearch } from "react-icons/fa";

export default function History() {
  const [historyData, setHistoryData] = useState([]);
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const itemsPerPage = 4;
  const { user } = useAuth();
  const navigate = useNavigate();

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getAuthTokenUtil();
      if (!token) throw new Error("No authentication token found");
      const data = await apiClient("/logtime/all");

      const withTotal = data.map((entry) => {
        let totalMinutes = 0;
        entry.logs?.forEach((log) => {
          const [h, m] = log.timeSpent.split(":").map(Number);
          if (!isNaN(h) && !isNaN(m)) totalMinutes += h * 60 + m;
        });
        return {
          ...entry,
          totalTime: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`,
          taskCount: entry.logs?.length || 0,
        };
      });

      // Apply search filter if searchTerm exists
      const filteredData = searchTerm 
        ? withTotal.filter(entry => 
            formatDisplayDateHelper(entry.date).toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.totalTime.toLowerCase().includes(searchTerm.toLowerCase()) ||
            entry.logs.some(log => log.task.toLowerCase().includes(searchTerm.toLowerCase()))
          )
        : withTotal;

      setHistoryData(filteredData);
    } catch (error) {
      const errorMessage = handleApiError(error, "Failed to fetch history");
      setError(errorMessage);
      showToast(errorMessage, false);
      if (error.message.includes("authentication")) {
        navigate("/login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchHistory();
  }, [user, navigate, searchTerm]);

  const handleSort = () => {
    const newOrder = sortOrder === "asc" ? "desc" : "asc";
    const sorted = [...historyData].sort((a, b) =>
      newOrder === "asc"
        ? new Date(a.date) - new Date(b.date)
        : new Date(b.date) - new Date(a.date)
    );
    setSortOrder(newOrder);
    setHistoryData(sorted);
  };

  const handleView = (entry) => setSelectedEntry(entry);
  const handleEdit = (entry) => navigate(`/logtime/${entry.date}`);

  const handleDelete = async (entryId) => {
    if (window.confirm("Are you sure you want to delete this entry?")) {
      const token = getAuthTokenUtil();
      if (!token) {
        showToast("Authentication token not found. Please log in again.", false);
        setError("Authentication token not found. Please log in again.");
        return;
      }

      try {
        setIsLoading(true);
        await apiClient(`/logtime/${entryId}`, { method: "DELETE" });
        await fetchHistory();
        showToast("Entry deleted successfully!", true);
      } catch (error) {
        const errorMessage = handleApiError(error, `Failed to delete entry ${entryId}`);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const closeModal = () => setSelectedEntry(null);

  const handleAddNewEntry = () => {
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    navigate(`/logtime/${formattedDate}`);
  };

  const currentEntries = historyData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const goToPage = (page) => {
    if (page >= 1 && page <= Math.ceil(historyData.length / itemsPerPage)) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="history-page">
      <Navbar />
      <div className="container mt-3">
        {error && !selectedEntry && (
          <Alert variant="danger" onClose={() => setError(null)} dismissible>
            {error}
          </Alert>
        )}

        {/* Mobile Header */}
        {isMobileView && (
          <div className="mobile-history-header">
            <h2>Time Log History</h2>
            <div className="mobile-history-actions">
              <Button 
                variant="outline-secondary" 
                onClick={() => setShowMobileFilters(true)}
                className="mobile-filter-btn"
              >
                <FaFilter /> Filters
              </Button>
              <Button 
                variant="primary" 
                onClick={handleAddNewEntry}
                className="mobile-add-btn"
              >
                <FaPlus />
              </Button>
            </div>
          </div>
        )}

        {/* Desktop Header */}
        {!isMobileView && (
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 style={{ color: "black" }}>Time Log History</h2>
            <div className="history-controls">
              <Form.Control
                type="text"
                placeholder="Search entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="history-search"
              />
              <Button variant="primary" onClick={handleAddNewEntry}>
                + Add New Entry
              </Button>
            </div>
          </div>
        )}

        {/* Mobile Filters Offcanvas */}
        <Offcanvas 
          show={showMobileFilters} 
          onHide={() => setShowMobileFilters(false)}
          placement="end"
          className="mobile-filters-offcanvas"
        >
          <Offcanvas.Header closeButton>
            <Offcanvas.Title>History Filters</Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body>
            <div className="mobile-filter-options">
              <Form.Group>
                <Form.Label>Search Entries</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Search by date, time or task..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </Form.Group>
              <Button 
                variant="secondary" 
                onClick={() => {
                  setSearchTerm("");
                  setShowMobileFilters(false);
                }}
                className="mt-3"
              >
                Clear Filters
              </Button>
            </div>
          </Offcanvas.Body>
        </Offcanvas>

        {isLoading && historyData.length === 0 ? (
          <div className="loading-history">
            <p>Loading history entries...</p>
          </div>
        ) : historyData.length === 0 ? (
          <div className="empty-history">
            <p>No time log history found.</p>
            {searchTerm && (
              <Button variant="link" onClick={() => setSearchTerm("")}>
                Clear search
              </Button>
            )}
          </div>
        ) : isMobileView ? (
          // Mobile View - Card Layout
          <div className="mobile-history-entries">
            {currentEntries.map((entry) => (
              <div key={entry._id} className="mobile-history-card">
                <div className="mobile-history-card-header">
                  <h5>{formatDisplayDateHelper(entry.date)}</h5>
                  <span className="badge bg-primary">{entry.taskCount} tasks</span>
                </div>
                <div className="mobile-history-card-body">
                  <div className="mobile-history-time">
                    <strong>Total:</strong> {entry.totalTime}
                  </div>
                  <div className="mobile-history-actions">
                    <ActionButtons
                      item={entry}
                      onView={handleView}
                      onEdit={handleEdit}
                      onDelete={() => handleDelete(entry._id)}
                      isMobile={true}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Desktop View - Table Layout
          <ReusableTable
            columns={[
              {
                key: "date",
                header: "Date",
                sortable: true,
                renderCell: (item) => formatDisplayDateHelper(item.date),
                headerClassName: "centered",
                cellClassName: "centered",
              },
              {
                key: "totalTime",
                header: "Total Time",
                headerClassName: "centered",
                cellClassName: "centered",
              },
              {
                key: "taskCount",
                header: "Tasks",
                headerClassName: "centered",
                cellClassName: "centered",
                renderCell: (item) => <span className="badge bg-primary">{item.taskCount}</span>
              },
            ]}
            data={currentEntries}
            keyField="_id"
            isLoading={isLoading && currentEntries.length === 0}
            error={error && currentEntries.length === 0 ? error : null}
            onSort={handleSort}
            sortConfig={{
              key: "date",
              direction: sortOrder === "asc" ? "ascending" : "descending",
            }}
            renderActions={(entry) => (
              <ActionButtons
                item={entry}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={() => handleDelete(entry._id)}
              />
            )}
            noDataMessage="No time log history found."
            tableClassName="mt-3"
            theadClassName="table-dark"
          />
        )}

        {historyData.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={historyData.length}
            itemsPerPage={itemsPerPage}
            onPageChange={goToPage}
            isMobile={isMobileView}
          />
        )}
      </div>

      {/* View Modal */}
      {selectedEntry && (
        <ReusableModal
          show={!!selectedEntry}
          onHide={closeModal}
          title={`Details for ${formatDisplayDateHelper(selectedEntry.date)}`}
          footerContent={
            <Button variant="secondary" onClick={closeModal}>
              Close
            </Button>
          }
          size="lg"
        >
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="modal-time-summary">
            <strong>Total Time:</strong> {selectedEntry.totalTime}
            <br />
            <strong>Tasks:</strong> {selectedEntry.taskCount}
          </div>
          <Table striped bordered hover responsive className="modal-time-table">
            <thead className="table-dark">
              <tr>
                <th>Task</th>
                <th>Start Time</th>
                <th>Finish Time</th>
                <th>Time Spent</th>
              </tr>
            </thead>
            <tbody>
              {selectedEntry.logs.map((log, i) => (
                <tr key={i}>
                  <td>{log.task}</td>
                  <td>{log.start}</td>
                  <td>{log.finish}</td>
                  <td>{log.timeSpent}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </ReusableModal>
      )}

      <Footer />
    </div>
  );
}