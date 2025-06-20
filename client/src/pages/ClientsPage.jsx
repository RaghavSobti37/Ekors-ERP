import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { BriefcaseFill, PeopleFill, PlusCircle } from "react-bootstrap-icons";
import Navbar from "../components/Navbar";
import { Button as BsButton, Alert, Form, Nav, Card } from "react-bootstrap";
import Pagination from "../components/Pagination";
import Footer from "../components/Footer";
import ReusableTable from "../components/ReusableTable";
import SearchBar from "../components/Searchbar";
import Unauthorized from "../components/Unauthorized";
import ActionButtons from "../components/ActionButtons";
import apiClient from "../utils/apiClient";
import { toast } from "react-toastify";
import { handleApiError } from "../utils/helpers";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import "../css/Users.css"; // Reusing some styles from Users.css

const ClientsPage = () => {
  const navigate = useNavigate();
  const location = useLocation(); // Although not strictly needed for back navigation, good practice
  const { user: authUser, loading: authLoading } = useAuth();

  // Client Management State
  const [clients, setClients] = useState([]);
  const [clientSearchTerm, setClientSearchTerm] = useState("");
  const [currentClientPage, setCurrentClientPage] = useState(1);
  const [clientItemsPerPage, setClientItemsPerPage] = useState(5);
  const [totalClientPages, setTotalClientPages] = useState(1);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientError, setClientError] = useState(""); // Separate error state for clients
  const [isUnauthorized, setIsUnauthorized] = useState(false); // Separate unauthorized state
  const [clientSortConfig, setClientSortConfig] = useState({
    key: "companyName",
    direction: "asc",
  });

  const fetchClientsDashboardData = useCallback(async (page = 1, limit = 5, search = "", sortKey = "companyName", sortDirection = "asc") => {
    setClientsLoading(true);
    setClientError(""); // Clear previous errors
    setIsUnauthorized(false); // Clear previous auth errors
    try {
      let url = `/clients?page=${page}&limit=${limit}&sortBy=${sortKey}&order=${sortDirection}`;
      if (search && search.trim() !== "") {
        url += `&search=${encodeURIComponent(search.trim())}`;
      }
      const response = await apiClient(url);

      if (response && Array.isArray(response.clients)) {
        setClients(response.clients);
        setTotalClientPages(response.totalPages || 1);
        setCurrentClientPage(response.currentPage || 1);
      } else {
        console.error("Unexpected response structure for clients:", response);
        setClientError("Failed to fetch clients: Unexpected data format.");
        setClients([]);
        setTotalClientPages(1);
        setCurrentClientPage(1);
      }
    } catch (err) {
      const errorMsg = handleApiError(err, "Failed to fetch clients");
      setClientError(errorMsg);
      setClients([]);
      setTotalClientPages(1);
      setCurrentClientPage(1);
      if (err.status === 403) setIsUnauthorized(true);
    } finally {
      setClientsLoading(false);
    }
  }, []);

  // Effect for search, sort, and filter changes
  useEffect(() => {
    const timerId = setTimeout(() => {
      if (!authLoading && authUser) {
        fetchClientsDashboardData(1, clientItemsPerPage, clientSearchTerm, clientSortConfig.key, clientSortConfig.direction);
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(timerId);
  }, [authLoading, authUser, clientSearchTerm, clientItemsPerPage, clientSortConfig, fetchClientsDashboardData]);

  // Effect for pagination changes (when search/sort/filters are stable)
  useEffect(() => {
    if (!authLoading && authUser) {
      // This will fetch when currentPage changes, assuming other filters are handled by the above useEffect
      fetchClientsDashboardData(currentClientPage, clientItemsPerPage, clientSearchTerm, clientSortConfig.key, clientSortConfig.direction);
    }
  }, [authLoading, authUser, currentClientPage, fetchClientsDashboardData]); // Removed clientItemsPerPage, clientSearchTerm, clientSortConfig as they trigger reset to page 1

  const handleClientSearch = () => {
    // Trigger search from input, resets to page 1
    setCurrentPage(1); // Reset to page 1 on explicit search
    // The debounced useEffect will handle the fetch
  };

  // Client action handlers
  const handleViewClient = (client) => {
    navigate(`/clients/view/${client._id}`);
  };

  const handleEditClient = (client) => {
    navigate(`/clients/edit/${client._id}`);
  };

  const handleDeleteClient = async (clientToDelete) => {
    if (window.confirm(`Are you sure you want to delete client ${clientToDelete.companyName}? This action cannot be undone.`)) {
      try {
        await apiClient(`/clients/${clientToDelete._id}`, { method: "DELETE" });
        toast.success("Client deleted successfully");
        // Refresh client list, staying on the current page if possible
        fetchClientsDashboardData(currentClientPage, clientItemsPerPage, clientSearchTerm, clientSortConfig.key, clientSortConfig.direction);
      } catch (err) {
        toast.error(handleApiError(err, "Failed to delete client"));
      }
    }
  };

  const handleClientSort = (key) => {
    let direction = "asc";
    if (clientSortConfig.key === key && clientSortConfig.direction === "asc") {
      direction = "desc";
    }
    setClientSortConfig({ key, direction });
    setCurrentClientPage(1); // Reset to page 1 on sort change
    // fetchClientsDashboardData will be called by the useEffect watching clientSortConfig
  };

  if (authLoading) {
     return <LoadingSpinner show={true} />; // Show spinner while auth is loading
  }

  if (isUnauthorized) {
    return <Unauthorized />;
  }

  return (
    <>
      <Navbar />
      <LoadingSpinner show={clientsLoading} /> {/* Show spinner only for client data loading */}
      <div className="container mt-4">
        {clientError && (
          <Alert variant="danger" onClose={() => setClientError("")} dismissible>
            {clientError}
          </Alert>
        )}

        {/* Top controls row - similar to Users.jsx */}
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap" style={{ gap: "1rem" }}>
          <h2 className="m-0 text-nowrap">Client Management</h2>
          <div className="d-flex align-items-center flex-grow-1 justify-content-end flex-wrap" style={{ gap: "1rem" }}>
            <div style={{ minWidth: "250px", maxWidth: "400px" }} className="flex-grow-1">
              <SearchBar
                searchTerm={clientSearchTerm}
                setSearchTerm={setClientSearchTerm} // Changed prop name to match SearchBar
                onSearch={handleClientSearch}
                placeholder="Search clients..."
                showButton={true}
                onAddNew={() => navigate("/clients/create")}
                buttonText="Add New Client"
                buttonIcon={<PlusCircle size={18} />}
                // Removed explicit style to allow flex-grow
                disabled={clientsLoading}
              />
            </div>
          </div>
        </div>

        <ReusableTable
          columns={[
            { key: "companyName", header: "Company Name", sortable: true },
            { key: "clientName", header: "Contact Person", sortable: true },
            {
              key: "user",
              header: "Created By",
              sortable: true,
              renderCell: (client) =>
                client.user ? `${client.user.firstname} ${client.user.lastname}` : "N/A",
            },
            {
              key: "quotations",
              header: "Quotations (T/O/C)",
              sortable: false,
              tooltip: "Total / Open / Closed Quotations",
              renderCell: (client) =>
                `${client.quotationStats?.total || 0} / ${client.quotationStats?.open || 0} / ${client.quotationStats?.closed || 0}`,
            },
            {
              key: "tickets",
              header: "Tickets (T/O/C)",
              sortable: false,
              tooltip: "Total / Open / Closed Tickets",
              renderCell: (client) =>
                `${client.ticketStats?.total || 0} / ${client.ticketStats?.open || 0} / ${client.ticketStats?.closed || 0}`,
            },
          ]}
          data={clients}
          keyField="_id"
          onSort={handleClientSort}
          sortConfig={clientSortConfig}
          isLoading={clientsLoading}
          error={clientError && !clientsLoading ? clientError : null}
          renderActions={(client) => (
            <ActionButtons
              item={client}
              onView={() => handleViewClient(client)}
              onEdit={(authUser?.role === 'super-admin' || (authUser?.role === 'admin' && client.user?._id === authUser?._id) || (client.user?._id === authUser?._id)) ? () => handleEditClient(client) : null}
              onDelete={authUser?.role === 'super-admin' ? () => handleDeleteClient(client) : null}
              isLoading={clientsLoading}
            />
          )}
          noDataMessage="No clients found."
        />
        {!clientsLoading && clients.length > 0 && (
          <Pagination
            currentPage={currentClientPage}
            totalItems={totalClientPages * clientItemsPerPage}
            itemsPerPage={clientItemsPerPage}
            onPageChange={setCurrentClientPage}
            onItemsPerPageChange={setClientItemsPerPage}
          />
        )}

      </div>
      <Footer />
    </>
  );
};

export default ClientsPage;
