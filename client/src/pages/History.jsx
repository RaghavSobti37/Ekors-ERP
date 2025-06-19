import { useState, useEffect, useCallback } from "react";
import Navbar from "../components/Navbar";
import ActionButtons from "../components/ActionButtons";
import Footer from "../components/Footer";
import {
  showToast,
  handleApiError,
  formatDisplayDate as formatDisplayDateHelper,
} from "../utils/helpers";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Table, Button, Alert } from "react-bootstrap";
import Pagination from "../components/Pagination";
import ReusableTable from "../components/ReusableTable";
import apiClient from "../utils/apiClient";
import { getAuthToken as getAuthTokenUtil } from "../utils/authUtils";
import ReusableModal from "../components/ReusableModal.jsx";
import LoadingSpinner from "../components/LoadingSpinner.jsx"; // Import LoadingSpinner
import "../css/Style.css";
import "react-toastify/dist/ReactToastify.css";

export default function History() {
  const [historyData, setHistoryData] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: "date", direction: "desc" });
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const itemsPerPage = 4;
  const { user, loading: authLoading } = useAuth(); // Get authLoading state
  const navigate = useNavigate();

  const dateToYYYYMMDD = (dateObj) => {
    return dateObj.toISOString().split("T")[0];
  };

  const [totalHistoryCount, setTotalHistoryCount] = useState(0);

  const fetchHistory = useCallback(async (page = 1, limit = itemsPerPage, sortKey = sortConfig.key, sortDirection = sortConfig.direction) => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getAuthTokenUtil();
      if (!token) throw new Error("No authentication token found");

      const response = await apiClient("/logtime", { // Assuming endpoint supports pagination & sorting
        params: { page, limit, sortKey, sortDirection },
      });

      const processedData = (response.data || []).map((entry) => {
        let totalMinutes = 0;
        // Ensure logs is an array before trying to iterate
        if (!Array.isArray(entry.logs)) entry.logs = []; 
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

      setHistoryData(processedData);
      setTotalHistoryCount(response.totalItems || 0);
    } catch (error) {
      const errorMessage = handleApiError(error, "Failed to fetch history");
      setError(errorMessage);
      setHistoryData([]); setTotalHistoryCount(0);
      showToast(errorMessage, false);
      if (error.message.includes("authentication")) {
        navigate("/login");
      }
    } finally {
      setIsLoading(false);
    }
  }, [itemsPerPage, sortConfig.key, sortConfig.direction, navigate]); // Removed user from deps, handleApiError can take it as arg

  useEffect(() => {
    if (!user) {
      navigate("/login");
      return;
    }
    fetchHistory(currentPage, itemsPerPage, sortConfig.key, sortConfig.direction);
  }, [user, navigate, currentPage, itemsPerPage, sortConfig, fetchHistory]);

  const handleSort = useCallback((key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1); // Reset to first page on sort change
  }, [sortConfig]);

  const handleView = useCallback((entry) => setSelectedEntry(entry), []);
  const handleEdit = useCallback((entry) => {
    // entry.date is expected to be in YYYY-MM-DD format from the backend
    navigate(`/logtime/${entry.date}`);
  }, [navigate]);

  const handleDelete = useCallback(async (entryId) => {
    if (window.confirm("Are you sure you want to delete this entry?")) {
      const token = getAuthTokenUtil();
      if (!token) {
        showToast("Authentication token not found. Please log in again.", false);
        setError("Authentication token not found. Please log in again."); // Optional: set page error
        // navigate("/login"); // Optional: redirect to login
        return;
      }

      try {
        setIsLoading(true); // Set loading after token check
        await apiClient(`/logtime/${entryId}`, { method: "DELETE" });
        showToast("Entry deleted successfully!", true);
        // Refresh logic
        if (historyData.length === 1 && currentPage > 1) {
          setCurrentPage(prevPage => prevPage - 1);
        } else {
          fetchHistory(currentPage, itemsPerPage, sortConfig.key, sortConfig.direction);
        }
      } catch (error) {
        const errorMessage = handleApiError(error, `Failed to delete entry ${entryId}`, user);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    }
  }, [historyData.length, currentPage, itemsPerPage, sortConfig, fetchHistory, user]);

  const closeModal = useCallback(() => {
    setSelectedEntry(null);
  }, []);

  const handleAddNewEntry = useCallback(() => {
    const today = new Date();
    const formattedDateYYYYMMDD = dateToYYYYMMDD(today);
    navigate(`/logtime/${formattedDateYYYYMMDD}`);
  }, [navigate]);

  const goToPage = useCallback((page) => {
    const totalPages = Math.ceil(totalHistoryCount / itemsPerPage);
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalHistoryCount, itemsPerPage]);

  return (
    <div>
      <Navbar />
      <LoadingSpinner show={isLoading || authLoading} /> {/* Show spinner during data fetch or auth loading */}
      <div className="container mt-4">
        {!isLoading && !authLoading && error && !selectedEntry && ( 
          <Alert variant="danger" onClose={() => setError(null)} dismissible>
            {error}
          </Alert>
        )}

        {/* Render content only if not loading and no error, or handle error within components */}
        {!isLoading && !authLoading && !error && (
          <>
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2 style={{ color: "black" }}>Time Log History</h2>
              <Button variant="primary" onClick={handleAddNewEntry} disabled={isLoading || authLoading}>
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
              data={historyData}
              keyField="_id"
              isLoading={(isLoading || authLoading) && historyData.length === 0}
              error={error && historyData.length === 0 ? error : null}
              onSort={handleSort}
              sortConfig={{
                key: sortConfig.key,
                direction: sortConfig.direction === "asc" ? "ascending" : "descending",
              }}
              renderActions={(entry) => (
                <ActionButtons
                  item={entry}
                  onView={() => handleView(entry)}
                  onEdit={handleEdit}
                  onDelete={() => handleDelete(entry._id)}
                  isLoading={isLoading || authLoading}
                />
              )}
              noDataMessage="No time log history found."
              tableClassName="mt-3"
              theadClassName="table-dark"
            />
          </>
        )}

        {totalHistoryCount > 0 && !isLoading && !authLoading && (
          <Pagination
            currentPage={currentPage}
            totalItems={totalHistoryCount}
            itemsPerPage={itemsPerPage}
            onPageChange={goToPage}
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