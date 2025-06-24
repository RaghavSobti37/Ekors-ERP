import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaUndo, FaEye } from "react-icons/fa";
import Navbar from "../components/Navbar";
import { Button as BsButton, Alert, Form, Card, Modal } from "react-bootstrap";
import Pagination from "../components/Pagination";
import Footer from "../components/Footer";
import ReusableTable from "../components/ReusableTable";
import SearchBar from "../components/Searchbar"; // Assuming SearchBar can be generic
import Unauthorized from "../components/Unauthorized";
import ActionButtons from "../components/ActionButtons";
import apiClient from "../utils/apiClient";
import { toast } from "react-toastify";
import { handleApiError, formatDateTime } from "../utils/helpers";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import "../css/Users.css"; // Reusing some styles

const BackupsPage = () => {
  const navigate = useNavigate();
  const { user: authUser, loading: authLoading } = useAuth();

  const [backups, setBackups] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [modelFilter, setModelFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [totalPages, setTotalPages] = useState(1);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState("");
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [sortConfig, setSortConfig] = useState({
    key: "deletedAt",
    direction: "desc",
  });

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedBackupDetails, setSelectedBackupDetails] = useState(null);

  const fetchBackups = useCallback(
    async (page, limit, search, model, sortKey, sortDir) => {
      setDataLoading(true);
      setError("");
      setIsUnauthorized(false);
      try {
        let url = `/backups?page=${page}&limit=${limit}&sortBy=${sortKey}&order=${sortDir}`;
        if (search.trim())
          url += `&search=${encodeURIComponent(search.trim())}`;
        if (model.trim()) url += `&model=${encodeURIComponent(model.trim())}`;

        const response = await apiClient(url);
        if (response && Array.isArray(response.backups)) {
          setBackups(response.backups);
          setTotalPages(response.totalPages || 1);
          setCurrentPage(response.currentPage || 1);
        } else {
          setError("Failed to fetch backups: Unexpected data format.");
          setBackups([]);
          setTotalPages(1);
          setCurrentPage(1);
        }
      } catch (err) {
        const errorMsg = handleApiError(err, "Failed to fetch backups");
        setError(errorMsg);
        setBackups([]);
        setTotalPages(1);
        setCurrentPage(1);
        if (err.status === 403) setIsUnauthorized(true);
      } finally {
        setDataLoading(false);
      }
    },
    []
  ); // State setters from useState are stable and don't need to be in deps

  // Effect for search, modelFilter, sortConfig, and itemsPerPage changes (triggers fetch for page 1)
  useEffect(() => {
    const timerId = setTimeout(() => {
      if (!authLoading && authUser?.role === "super-admin") {
        fetchBackups(
          1,
          itemsPerPage,
          searchTerm,
          modelFilter,
          sortConfig.key,
          sortConfig.direction
        ); // Reset to page 1 on search/filter change
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(timerId);
  }, [
    authLoading,
    authUser,
    searchTerm,
    modelFilter,
    itemsPerPage,
    sortConfig.key,
    sortConfig.direction,
    fetchBackups,
  ]); // itemsPerPage change also resets to page 1

  // Effect for currentPage changes (uses current filters/sort)
  useEffect(() => {
    if (!authLoading && authUser?.role === "super-admin") {
      // This effect should only run when currentPage changes,
      // assuming other parameters (searchTerm, modelFilter, sortConfig, itemsPerPage) are stable
      // or handled by the effect above which resets to page 1.
      fetchBackups(
        currentPage,
        itemsPerPage,
        searchTerm,
        modelFilter,
        sortConfig.key,
        sortConfig.direction
      );
    }
  }, [authLoading, authUser, currentPage, fetchBackups]); // Only currentPage and fetchBackups (stable)

  const handleSearch = () => {
    setCurrentPage(1); // Reset to page 1 on explicit search
    // The debounced useEffect will handle the fetch
  };
  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc")
      direction = "desc";
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const handleViewDetails = (backup) => {
    setSelectedBackupDetails(backup);
    setShowDetailsModal(true);
  };

  const handleRestore = async (backupId, modelName, originalId) => {
    const confirmMessage = `Are you sure you want to restore this ${modelName} (Original ID: ${originalId})? This will attempt to re-insert it into the database. If an item with the same ID already exists, restoration might fail.`;
    if (window.confirm(confirmMessage)) {
      setDataLoading(true);
      try {
        await apiClient(`/backups/${backupId}/restore`, { method: "POST" });
        toast.success(`${modelName} restored successfully!`);
        fetchBackups(
          currentPage,
          itemsPerPage,
          searchTerm,
          modelFilter,
          sortConfig.key,
          sortConfig.direction
        ); // Refresh list
      } catch (err) {
        const errorMsg = handleApiError(err, `Failed to restore ${modelName}`);
        toast.error(errorMsg);
        if (err.response?.data?.conflict) {
          toast.error("Conflict: An item with the original ID already exists.");
        }
      } finally {
        setDataLoading(false);
      }
    }
  };

  if (authLoading) return <LoadingSpinner show={true} />;
  if (isUnauthorized) return <Unauthorized />;

  const backupColumns = [
    { key: "originalModel", header: "Type", sortable: true },
    { key: "originalId", header: "Original ID", sortable: true },
    {
      key: "data.name",
      header: "Name/Identifier",
      renderCell: (item) =>
        item.data?.name ||
        item.data?.companyName ||
        item.data?.ticketNumber ||
        item.data?.referenceNumber ||
        item.data?.title ||
        "N/A",
    },
    {
      key: "deletedAt",
      header: "Deleted At",
      sortable: true,
      renderCell: (item) => formatDateTime(item.deletedAt),
    },
    {
      key: "deletedBy.email",
      header: "Deleted By",
      sortable: true,
      renderCell: (item) => item.deletedBy?.email || "N/A",
    },
    // { key: "backupReason", header: "Reason", sortable: true },
  ];

  return (
    <>
      <Navbar />
      <LoadingSpinner show={dataLoading} />
      <div className="container mt-4">
        {error && (
          <Alert variant="danger" onClose={() => setError("")} dismissible>
            {error}
          </Alert>
        )}
        {/* Removed Card and Card.Body wrapper for direct layout control like Users.jsx */}

        {/* Top controls row - similar to Users.jsx */}
        <div
          className="d-flex justify-content-between align-items-center mb-4 flex-wrap"
          style={{ gap: "1rem" }}
        >
          <h2 className="m-0 text-nowrap">Backup Management</h2>

          <div
            className="d-flex align-items-center flex-grow-1 justify-content-end flex-wrap"
            style={{ gap: "1rem" }}
          >
            <Form.Control
              as="select"
              value={modelFilter}
              onChange={(e) => {
                setModelFilter(e.target.value);
                // setCurrentPage(1); // Debounced useEffect will handle reset to page 1
              }}
              className="form-select-sm"
              style={{ width: "auto", minWidth: "180px" }}
              disabled={dataLoading}
            >
              <option value="">All Types</option>
              <option value="User">User</option>
              <option value="Client">Client</option>
              <option value="Quotation">Quotation</option>
              <option value="Ticket">Ticket</option>
              <option value="Item">Item</option>
              <option value="Challan">Challan</option>
            </Form.Control>
            <div
              style={{ minWidth: "250px", maxWidth: "400px" }}
              className="flex-grow-1"
            >
              <SearchBar
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                onSearch={handleSearch}
                placeholder="Search backups..."
                style={{ maxWidth: "300px" }}
                disabled={dataLoading}
                // Removed explicit style={{ maxWidth: "300px" }} to allow flex-grow
              />
            </div>
          </div>
        </div>

        <ReusableTable
          columns={backupColumns}
          data={backups}
          keyField="_id"
          onSort={handleSort}
          sortConfig={sortConfig}
          isLoading={dataLoading}
          error={error && !dataLoading ? error : null}
          renderActions={(item) => (
            <>
              <BsButton
                variant="outline-info"
                size="sm"
                onClick={() => handleViewDetails(item)}
                className="me-2"
                title="View Details"
              >
                <FaEye />
              </BsButton>
              <BsButton
                variant="outline-warning"
                size="sm"
                onClick={() =>
                  handleRestore(item._id, item.originalModel, item.originalId)
                }
                title="Restore"
              >
                <FaUndo />
              </BsButton>
            </>
          )}
          noDataMessage="No backup entries found."
        />
        {!dataLoading && backups.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={totalPages * itemsPerPage}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        )}
      </div>
      <Footer />

      {selectedBackupDetails && (
        <Modal
          show={showDetailsModal}
          onHide={() => setShowDetailsModal(false)}
          size="lg"
          centered
        >
          <Modal.Header closeButton>
            <Modal.Title>
              Backup Details: {selectedBackupDetails.originalModel} (
              {selectedBackupDetails.originalId})
            </Modal.Title>
          </Modal.Header>
          <Modal.Body style={{ maxHeight: "70vh", overflowY: "auto" }}>
            <pre>{JSON.stringify(selectedBackupDetails.data, null, 2)}</pre>
            <hr />
            <p>
              <strong>Deleted At:</strong>{" "}
              {formatDateTime(selectedBackupDetails.deletedAt)}
            </p>
            <p>
              <strong>Deleted By:</strong>{" "}
              {selectedBackupDetails.deletedBy?.firstname}{" "}
              {selectedBackupDetails.deletedBy?.lastname} (
              {selectedBackupDetails.deletedBy?.email})
            </p>
            {/* <p>
              <strong>Reason:</strong> {selectedBackupDetails.backupReason}
            </p> */}
            {selectedBackupDetails.originalCreatedAt && (
              <p>
                <strong>Original Created At:</strong>{" "}
                {formatDateTime(selectedBackupDetails.originalCreatedAt)}
              </p>
            )}
            {selectedBackupDetails.originalUpdatedAt && (
              <p>
                <strong>Original Updated At:</strong>{" "}
                {formatDateTime(selectedBackupDetails.originalUpdatedAt)}
              </p>
            )}
          </Modal.Body>
          <Modal.Footer>
            <BsButton
              variant="secondary"
              onClick={() => setShowDetailsModal(false)}
            >
              Close
            </BsButton>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );
};

export default BackupsPage;
