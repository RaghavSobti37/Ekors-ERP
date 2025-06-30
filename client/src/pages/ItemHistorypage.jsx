import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ReusablePageStructure from "../components/ReusablePageStructure";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { Spinner, Button, Alert } from "react-bootstrap";
import apiClient from "../utils/apiClient";
import { useAuth } from "../context/AuthContext";
import { showToast, handleApiError } from "../utils/helpers";
import { EraserFill } from "react-bootstrap-icons";
import ReusableTable from "../components/ReusableTable";

const transformLogEntry = (log) => ({
  _id: log._id,
  date: new Date(log.date),
  type: log.type,
  user: log.userReference
    ? `${log.userReference.firstname || ""} ${
        log.userReference.lastname || ""
      }`.trim() || log.userReference.email
    : "System",
  details: log.details || log.type,
  quantityChange: parseFloat(log.quantityChange) || 0,
  ticketNumber: log.ticketReference?.ticketNumber,
  source: "inventoryLog",
});

const transformExcelHistory = (entry) => {
  let importedByUserDisplay = "System";
  if (entry.importedBy) {
    importedByUserDisplay =
      `${entry.importedBy.firstname || ""} ${
        entry.importedBy.lastname || ""
      }`.trim() || entry.importedBy.email;
  }
  let changesSummary = "";
  if (entry.action === "created") {
    const createdQty = entry.snapshot?.quantity;
    changesSummary = `Initial state set. (Qty: ${parseFloat(createdQty) || 0})`;
  } else if (entry.action === "updated") {
    const qtyChangeInfo = entry.changes?.find((c) => c.field === "quantity");
    const otherChanges = entry.changes?.filter((c) => c.field !== "quantity");
    let qtySummary = qtyChangeInfo
      ? `Quantity: ${parseFloat(qtyChangeInfo.oldValue) || 0} -> ${
          parseFloat(qtyChangeInfo.newValue) || 0
        }`
      : "";
    let otherChangesSummary = otherChanges
      ?.map((c) => `${c.field}: ${c.oldValue} -> ${c.newValue}`)
      .join("; ");
    changesSummary = [qtySummary, otherChangesSummary]
      .filter(Boolean)
      .join("; ");
    if (!changesSummary) changesSummary = "Details updated.";
  }

  return {
    _id: entry._id,
    date: new Date(entry.importedAt),
    type: `Excel Import (${entry.action})`,
    user: importedByUserDisplay,
    details: `${changesSummary} (File: ${entry.fileName || "N/A"})`,
    quantityChange: 0,
    source: "excelHistory",
  };
};

const ItemHistoryPage = () => {
  const { itemId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [item, setItem] = useState(null);
  const [inventoryLogs, setInventoryLogs] = useState([]);
  const [ticketLogs, setTicketLogs] = useState([]);
  const [editLogs, setEditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortDirection, setSortDirection] = useState("desc");

  const fetchItemHistory = useCallback(async (currentSortDir = sortDirection) => {
    if (!itemId) {
      setError("No item ID provided for history.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const itemData = await apiClient(`/items/${itemId}`, {
        params: {
          populate:
            "inventoryLog.userReference,inventoryLog.ticketReference,excelImportHistory.importedBy,createdBy,reviewedBy",
        },
      });

      setItem(itemData);
      // console.log("Frontend received itemData.inventoryLog:", itemData.inventoryLog);

      const allInventoryLogs = [];
      const allTicketLogs = [];
      const allEditLogs = [];

      if (Array.isArray(itemData.inventoryLog)) {
        itemData.inventoryLog.forEach((log) => {
          const transformed = transformLogEntry(log);
          // Separate ticket-related logs.
          // This is now more robust: it checks for a populated ticket number OR
          // if the log type string contains "ticket", ensuring categorization
          // even if population fails for any reason.
          if (transformed.ticketNumber || (transformed.type && transformed.type.toLowerCase().includes('ticket'))) {
            allTicketLogs.push(transformed);
          }
          // Separate edit logs
          else if (transformed.type === "Item Details Updated") {
            allEditLogs.push(transformed);
          } else {
            allInventoryLogs.push(transformed);
          }
        });
      }

      if (Array.isArray(itemData.excelImportHistory)) {
        allInventoryLogs.push(...itemData.excelImportHistory.map(transformExcelHistory));
      }

      const sortFunc = (a, b) => {
        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        return currentSortDir === "asc" ? dateA - dateB : dateB - dateA;
      };

      setInventoryLogs(allInventoryLogs.sort(sortFunc));
      setTicketLogs(allTicketLogs.sort(sortFunc));
      setEditLogs(allEditLogs.sort(sortFunc));
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to load item history.", user);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [itemId, user, sortDirection]);

  useEffect(() => {
    fetchItemHistory();
  }, [fetchItemHistory]);

  const handleSort = useCallback(() => {
    const newDirection = sortDirection === "desc" ? "asc" : "desc";
    setSortDirection(newDirection);
    fetchItemHistory(newDirection);
  }, [sortDirection, fetchItemHistory]);

  const handleDeleteLogEntry = useCallback(async (logId, source) => {
    if (!window.confirm("Are you sure you want to delete this specific log entry? This action is irreversible.")) {
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient(`/items/${itemId}/log/${logId}`, {
        method: "DELETE",
        params: { source },
      });
      showToast("Log entry deleted successfully.", true);
      await fetchItemHistory();
    } catch (err) {
      handleApiError(err, "Failed to delete log entry.", user);
    } finally {
      setIsSubmitting(false);
    }
  }, [user, itemId, fetchItemHistory]);

  const handleClearAllLogs = useCallback(async () => {
    if (!window.confirm("DANGER: This will permanently delete ALL inventory, ticket, and excel import logs for this item. This action cannot be undone. Are you absolutely sure?")) {
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient(`/items/${itemId}/clear-logs`, {
        method: "DELETE",
      });
      showToast("All logs for this item have been cleared.", true);
      await fetchItemHistory(); // Refresh the history view
    } catch (err) {
      handleApiError(err, "Failed to clear logs.", user);
    } finally {
      setIsSubmitting(false);
    }
  }, [itemId, fetchItemHistory, user]);

  const handleGoBack = useCallback(() => {
    navigate("/items");
  }, [navigate]);

  const hasLogs = inventoryLogs.length > 0 || editLogs.length > 0;

  if (loading) {
    return (
      <div className="text-center p-4">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading history...</span>
        </Spinner>
      </div>
    );
  }

  if (error) return <Alert variant="danger">{error}</Alert>;
  if (!item) return <Alert variant="info">Item not found or no data available.</Alert>;

  const sharedColumns = [
    { key: "date", header: "Date", sortable: true, renderCell: (e) => e.date.toLocaleString() },
    { key: "type", header: "Type", sortable: true },
    { key: "user", header: "User/Source", sortable: true }, // Added
    { key: "details", header: "Details", renderCell: (e) => (
      <>{e.details}{e.ticketNumber ? ` (Ticket: ${e.ticketNumber})` : ""}</>
    )},
    { key: "quantityChange", header: "Qty Change", sortable: true, renderCell: (e) => <span className={e.quantityChange > 0 ? "text-success fw-bold" : e.quantityChange < 0 ? "text-danger fw-bold" : ""}>{e.quantityChange > 0 ? `+${e.quantityChange.toFixed(2)}` : e.quantityChange !== 0 ? e.quantityChange.toFixed(2) : "-"}</span> },
  ];

  const editColumns = [
    { key: "date", header: "Date", sortable: true, renderCell: (e) => e.date.toLocaleString() },
    { key: "user", header: "User/Source", sortable: true },
    { key: "details", header: "Details of Changes", renderCell: (e) => <span style={{ whiteSpace: "pre-wrap" }}>{e.details}</span> },
  ];

  return (
    <>
      <Navbar />
      <ReusablePageStructure title="Item History" showBackButton onBack={handleGoBack}>
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h5 className="mb-0">History for: {item.name}</h5>
          {user?.role === 'super-admin' && (
            <Button
              variant="outline-danger"
              size="sm"
              onClick={handleClearAllLogs}
              disabled={isSubmitting || loading}
              title="Permanently delete all logs for this item"
            >
              <EraserFill className="me-1" /> Clear All Logs
            </Button>
          )}
        </div>

        {ticketLogs.length > 0 && (
          <div className="mb-4">
            <h5>Ticket Interactions</h5>
            <ReusableTable columns={sharedColumns} data={ticketLogs} keyField="_id" isLoading={loading} error={error} onSort={handleSort} sortConfig={{ key: "date", direction: sortDirection === "asc" ? "ascending" : "descending" }} noDataMessage="No ticket-related logs found." tableClassName="table-sm" theadClassName="table-light sticky-top" />
          </div>
        )}

        {inventoryLogs.length > 0 && (
          <div className="mb-4">
            <h5>Other Inventory Logs (Purchases, Manual Adjustments)</h5>
            <ReusableTable columns={sharedColumns} data={inventoryLogs} keyField="_id" isLoading={loading} error={error} onSort={handleSort} sortConfig={{ key: "date", direction: sortDirection === "asc" ? "ascending" : "descending" }} noDataMessage="No other inventory logs found." tableClassName="table-sm" theadClassName="table-light sticky-top" />
          </div>
        )}

        {editLogs.length > 0 && (
          <div className="mb-4">
            <h5>Item Detail Edits</h5>
            <ReusableTable columns={editColumns} data={editLogs} keyField="_id" isLoading={loading} error={error} onSort={handleSort} sortConfig={{ key: "date", direction: sortDirection === "asc" ? "ascending" : "descending" }} noDataMessage="No item detail edit logs found." tableClassName="table-sm" theadClassName="table-light sticky-top" />
          </div>
        )}

        {!hasLogs && !loading && <Alert variant="info">No history found for this item.</Alert>}
      </ReusablePageStructure>
      <Footer />
    </>
  );
};

export default ItemHistoryPage;
