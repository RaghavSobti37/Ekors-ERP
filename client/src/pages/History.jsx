import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import ActionButtons from "../components/ActionButtons";
import Footer from "../components/Footer";
import {
  showToast,
  handleApiError,
  formatDisplayDate as formatDisplayDateHelper,
} from "../utils/helpers";
import { toast } from "react-toastify"; // Library for toast notifications, ToastContainer removed
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Table, Button, Alert } from "react-bootstrap";
import Pagination from "../components/Pagination";
import ReusableTable from "../components/ReusableTable";
import apiClient from "../utils/apiClient";
import { getAuthToken as getAuthTokenUtil } from "../utils/authUtils";
import ReusableModal from "../components/ReusableModal.jsx";
import "../css/Style.css";
import "react-toastify/dist/ReactToastify.css";

export default function History() {
  const [historyData, setHistoryData] = useState([]);
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const itemsPerPage = 4;
  const { user } = useAuth();
  const navigate = useNavigate();

  const dateToYYYYMMDD = (dateObj) => {
    return dateObj.toISOString().split('T')[0];
  };

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
          totalTime: `${Math.floor(totalMinutes / 60)} hours, ${
            totalMinutes % 60
          } minutes`,
          taskCount: entry.logs?.length || 0,
        };
      });

      setHistoryData(withTotal);
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
  }, [user, navigate]);

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
  const handleEdit = (entry) => {
    // entry.date is expected to be in YYYY-MM-DD format from the backend
    navigate(`/logtime/${entry.date}`);
  };

  const handleDelete = async (entryId) => {
    if (window.confirm("Are you sure you want to delete this entry?")) {
      const token = getAuthTokenUtil();
      if (!token) {
        showToast(
          "Authentication token not found. Please log in again.",
          false
        );
        setError("Authentication token not found. Please log in again."); // Optional: set page error
        // navigate("/login"); // Optional: redirect to login
        return;
      }

      try {
        setIsLoading(true); // Set loading after token check
        await apiClient(`/logtime/${entryId}`, { method: "DELETE" });

        await fetchHistory();
        showToast("Entry deleted successfully!", true);
      } catch (error) {
        const errorMessage = handleApiError(
          error,
          `Failed to delete entry ${entryId}`
        );

        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const closeModal = () => {
    setSelectedEntry(null);
  };

  const handleAddNewEntry = () => {
    const today = new Date();
    const formattedDateYYYYMMDD = dateToYYYYMMDD(today);
    navigate(`/logtime/${formattedDateYYYYMMDD}`);
  };

  const currentEntries = historyData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  const totalPages = Math.ceil(historyData.length / itemsPerPage);

  return (
    <div>
      <Navbar />
      <div className="container mt-4">
        {error && !selectedEntry && ( // Simplified error display condition
          <Alert variant="danger" onClose={() => setError(null)} dismissible>
            {error}
          </Alert>
        )}

        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 style={{ color: "black" }}>Time Log History</h2>
          <Button variant="primary" onClick={handleAddNewEntry}>
            + Add New Entry
          </Button>
        </div>

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
              isLoading={isLoading}
            />
          )}
          noDataMessage="No time log history found."
          tableClassName="mt-3"
          theadClassName="table-dark"
        />

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
        />
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
        >
          {error && <Alert variant="danger">{error}</Alert>}
          <Table striped bordered hover responsive>
            <thead className="table-dark">
              <tr>
                <th>Task</th>
                <th>Start Time</th>
                <th>Finish Time</th>
                <th>Time Spent</th>
              </tr>
            </thead>
            <tbody className="text-center">
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
