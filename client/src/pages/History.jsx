import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import "../css/Style.css";
import ActionButtons from "../components/ActionButtons";
import {
  Eye, // View
  PencilSquare, // Edit
  Trash, // Delete
  BarChart, // Generate Report
} from 'react-bootstrap-icons';
import { showToast, handleApiError } from '../utils/helpers'; // Import helpers
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LogtimeModal from "../components/LogtimeModal";
import { Table, Button, Alert } from "react-bootstrap";
import Pagination from '../components/Pagination';
import ReusableTable from "../components/ReusableTable";
import SortIndicator from "../components/SortIndicator";

const formatDisplayDate = (dateString) => {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString("default", { month: "long" });
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

   const getAuthToken = () => {
    try {
      const token = localStorage.getItem("erp-user");
    console.log("[DEBUG Client Quotations.jsx] getAuthToken retrieved:", token ? "Token present" : "No token");
    return token || null;
    } catch (e) {
      console.error("Failed to parse user data:", e);
      return null;
    }
  };
  

export default function History() {
  const [historyData, setHistoryData] = useState([]);
  const [sortOrder, setSortOrder] = useState("desc");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [editingEntry, setEditingEntry] = useState(null);
  const itemsPerPage = 4; // Hardcoded to 4
  const { user } = useAuth();
  const navigate = useNavigate();

  const fetchHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch("http://localhost:3000/api/logtime/all", {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }
      showToast("History fetched successfully", true);
      
      const data = await response.json();
      const withTotal = data.map((entry) => {
        let totalMinutes = 0;
        entry.logs?.forEach((log) => {
          const [h, m] = log.timeSpent.split(":").map(Number);
          if (!isNaN(h) && !isNaN(m)) totalMinutes += h * 60 + m;
        });
        return {
          ...entry,
          totalTime: `${Math.floor(totalMinutes / 60)} hours, ${totalMinutes % 60} minutes`,
          taskCount: entry.logs?.length || 0,
        };
      });
      setHistoryData(withTotal);
        setError(null);
      } catch (error) {
      console.error("Error fetching history:", error);
      showToast(error.message || "Failed to fetch history", false);
      setError(error.message || "Failed to fetch history");
      if (error.message.includes('authentication')) {
        navigate('/login');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
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

  const handleView = (entry) => {
    setSelectedEntry(entry);
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
  };

  const handleDelete = async (entryId) => {
    if (window.confirm("Are you sure you want to delete this entry?")) {
      try {
        const token = getAuthToken();
        if (!token) {
          throw new Error('No authentication token found');
        }

        const response = await fetch(`http://localhost:3000/api/logtime/${entryId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to delete entry');
        }

        // Refresh the history after deletion
        await fetchHistory();
        showToast("Entry deleted successfully!", true);
      } catch (error) {
        console.error("Error deleting entry:", error);
        setError(error.message || "Failed to delete entry");
      }
    }
  };

  const closeModal = () => {
    setSelectedEntry(null);
    setEditingEntry(null);
  };

  const handleAddNewEntry = () => {
    const today = new Date();
    const formattedDate = formatDisplayDate(today);
    setSelectedDate(formattedDate);
    setShowAddModal(true);
  };

  const handleSaveSuccess = () => {
    fetchHistory();
    setShowAddModal(false);
    setEditingEntry(null);
  };

  const handleAddLogTime = () => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
    setShowLogTimeModal(true);
  };

  const handleLogTimeSuccess = () => {
    setShowLogTimeModal(false);
    fetchHistory(); // Refresh the history data
  };

  const totalPages = Math.ceil(historyData.length / itemsPerPage);
  const currentEntries = historyData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  if (isLoading) {
    return (
      <div>
        <Navbar />
        <div className="log-time-container">
          <div className="loading">Loading history...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Navbar />
        <div className="log-time-container">
          <div className="error-message" style={{ color: "red" }}>
            {error}
          </div>
          <button onClick={fetchHistory}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <div className="container mt-4">
        {error && !selectedEntry && !showAddModal && !editingEntry && (
          <Alert variant="danger" onClose={() => setError(null)} dismissible>
            {error}
          </Alert>
        )}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 style={{ color: "black" }}>Time Log History</h2>
          <Button
              variant="primary"
              onClick={handleAddNewEntry}
            >
              + Add New Entry
            </Button>
        </div>

        <ReusableTable
          columns={[
            { key: 'date', header: 'Date', sortable: true, renderCell: (item) => formatDisplayDate(item.date), headerClassName: 'centered', cellClassName: 'centered' },
            { key: 'totalTime', header: 'Total Time', headerClassName: 'centered', cellClassName: 'centered' },
            { key: 'taskCount', header: 'Tasks', headerClassName: 'centered', cellClassName: 'centered' },
          ]}
          data={currentEntries}
          keyField="_id" // Assuming entries have _id, adjust if it's 'id' or other
          isLoading={isLoading && currentEntries.length === 0}
          error={error && currentEntries.length === 0 ? error : null}
          onSort={() => handleSort()} // Simplified sort toggle for this page
          sortConfig={{ key: 'date', direction: sortOrder === 'asc' ? 'ascending' : 'descending' }}
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
          onPageChange={(page) => {
            if (page >= 1 && page <= totalPages) setCurrentPage(page);
          }}
        />
      </div>

      {/* Modal for log details */}
      {selectedEntry && (
        <div className="popup-overlay" onClick={closeModal}>
          <div className="popup-form ninety-five-percent" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3>Details for {formatDisplayDate(selectedEntry.date)}</h3>
              <button className="close-btn" onClick={closeModal}>✖</button>
            </div>
            <div className="form-content"> {/* Use form-content for padding like in Challan */}
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
            <div className="form-actions">
              <Button variant="secondary" onClick={closeModal}>
                Close
              </Button>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for adding new entry */}
      {showAddModal && (
        <div className="popup-overlay" onClick={() => setShowAddModal(false)}>
            <div className="popup-form ninety-five-percent" onClick={(e) => e.stopPropagation()}>
              <div className="popup-header">
                <h3>Add New Log Entry</h3>
                <button className="close-btn" onClick={() => setShowAddModal(false)}>✖</button>
              </div>
              {/* Assuming LogtimeModal is just the form content, not a full modal itself */}
              <LogtimeModal
                date={selectedDate}
                onClose={() => setShowAddModal(false)}
                onSave={handleSaveSuccess}
              />
            </div>
        </div>
      )}

      {/* Modal for editing existing entry */}
      {editingEntry && (
         <div className="popup-overlay" onClick={closeModal}>
            <div className="popup-form ninety-five-percent" onClick={(e) => e.stopPropagation()}>
              <div className="popup-header">
                <h3>Edit Log Entry for {formatDisplayDate(editingEntry.date)}</h3>
                <button className="close-btn" onClick={closeModal}>✖</button>
              </div>
              <LogtimeModal
                date={editingEntry.date}
                entryData={editingEntry}
                onClose={closeModal}
                onSave={handleSaveSuccess}
                isEditMode={true}
              />
            </div>
        </div>
      )}
    </div>
  );
}