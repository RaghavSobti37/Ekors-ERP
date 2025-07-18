// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/pages/Quotations.jsx
import { useState, useEffect, useCallback , useMemo } from "react";
import {
  Button,
  Form,
  Alert,
} from "react-bootstrap";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import Pagination from "../components/Pagination";
import Footer from "../components/Footer";
import ReusableTable from "../components/ReusableTable.jsx";
import SearchBar from "../components/Searchbar.jsx";
import ActionButtons from "../components/ActionButtons";
import LoadingSpinner from "../components/LoadingSpinner.jsx"; // Import LoadingSpinner
import { toast } from "react-toastify";

import "react-toastify/dist/ReactToastify.css";
import {
  showToast,
  handleApiError,
  formatDateForInput as formatDateForInputHelper,
} from "../utils/helpers";
import apiClient from "../utils/apiClient";
import "../css/Style.css";
import "../css/Items.css";
import { FaChartBar } from "react-icons/fa";
import { PlusCircle } from "react-bootstrap-icons";

export default function Quotations() {
  const [quotations, setQuotations] = useState([]); // Holds current page's quotations
  const [totalQuotations, setTotalQuotations] = useState(0); // Total quotations for pagination
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [sortConfig, setSortConfig] = useState({
    key: "referenceNumber",
    direction: "descending",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const { user, loading: authLoading, user: authUserFromContext } = useAuth();
  const [statusFilter, setStatusFilter] = useState("all");
  const navigate = useNavigate(); // isLoading is for local fetch, authLoading is for AuthContext
  const [isLoading, setIsLoading] = useState(false); // Local loading state for fetch
  const [sourceQuotationForTicket, setSourceQuotationForTicket] = useState(null); 

  const generateQuotationNumber = useCallback(() => { 
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `Q-${year}${month}${day}-${hours}${minutes}${seconds}`;
  }, []);

  const initialQuotationData = useMemo(() => ({ 
    date: formatDateForInputHelper(new Date()),
    referenceNumber: generateQuotationNumber(),
    validityDate: formatDateForInputHelper(
      new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    ),
    orderIssuedBy: "",
    billingAddress: {
      address1: "", address2: "", city: "", state: "", pincode: "",
    },
    goods: [],
    totalQuantity: 0, totalAmount: 0, gstAmount: 0, grandTotal: 0,
    status: "open",
    client: {
      _id: null, companyName: "", clientName: "", gstNumber: "", email: "", phone: "",
    },
  }), [generateQuotationNumber]);


  const fetchQuotations = useCallback(async (page = currentPage, limit = itemsPerPage) => {
    if (authLoading || !user) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", limit.toString());
      params.append("sortKey", sortConfig.key);
      params.append("sortDirection", sortConfig.direction);
      if (statusFilter !== "all") params.append("status", statusFilter);
      if (searchTerm) params.append("search", searchTerm);

      const endpoint = `/quotations${params.toString() ? `?${params.toString()}` : ""}`;
      const data = await apiClient(endpoint);
      setQuotations(data.data || []); 
      setTotalQuotations(data.totalItems || 0);
      setError(null);
    } catch (error) {
      const errorMessage = handleApiError(
        error,
        "Failed to load quotations. Please try again.",
        authUserFromContext, 
        "quotationActivity"
      );
      setError(errorMessage);
      setQuotations([]);
      setTotalQuotations(0);
      showToast(errorMessage, false); 
      if (error.status === 401) {
        toast.error("Authentication failed. Please log in again.");
        navigate("/login", { state: { from: "/quotations" } });
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, authLoading, navigate, statusFilter, authUserFromContext, currentPage, itemsPerPage, sortConfig.key, sortConfig.direction, searchTerm]);

  useEffect(() => {
    if (!authLoading && !user) {
      if (window.location.pathname !== "/login") {
        navigate("/login", { state: { from: "/quotations" } });
      }
    } else if (user) {
      fetchQuotations(currentPage, itemsPerPage); 
    }
  }, [user, authLoading, navigate, fetchQuotations, currentPage, itemsPerPage, statusFilter, sortConfig]); 


  const requestSort = useCallback((key) => {
    let direction = "descending";
    if (sortConfig.key === key) {
      direction = sortConfig.direction === "ascending" ? "descending" : "ascending";
    } else if (key === "grandTotal" || key === "date" || key === "validityDate") {
      direction = "descending";
    } else {
      direction = "ascending";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1); 
  }, [sortConfig]);

  useEffect(() => {
    if (!authLoading && !user) {
      if (window.location.pathname !== "/login") {
        navigate("/login", { state: { from: "/quotations" } });
      }
    }
  }, [user, authLoading, navigate]);

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  useEffect(() => { 
    setCurrentPage(1);
  }, [statusFilter, sortConfig]); 

  // Add debouncing for search term
  useEffect(() => {
    const timeout = setTimeout(() => {
      setCurrentPage(1);
      fetchQuotations();
    }, 400); // Debounce delay
    return () => clearTimeout(timeout);
  }, [searchTerm]);


  const reportButtonElement = (user?.role === "admin" || user?.role === "super-admin") && (
    <Button
      variant="info"
      onClick={() => navigate("/quotations/report")}
      title="View Quotation Activity Reports"
      size="sm" 
    >
      <FaChartBar className="me-1" /> Report
    </Button>
  );


  const resetForm = useCallback(() => { 
    setError(null);
  }, []);

  const handleCreateTicket = useCallback(async (quotation) => {
    setSourceQuotationForTicket(quotation);
    
    // Check if quotation has shipping address
    if (!quotation.shippingAddress?.address1) {
      toast.info("Billing address will be used as shipping address since no shipping address was defined.");
    }
    
    try {
      setIsLoading(true);
      
      // Create ticket from quotation - the backend will handle status update to "running"
      const response = await apiClient(`/tickets`, {
        method: 'POST',
        body: {
          newTicketDetails: {
            userId: user?.id
          },
          sourceQuotationData: quotation
        }
      });
      
      toast.success("Ticket created successfully!");
      
      // Refresh quotations list to show updated status (should be "running" now)
      fetchQuotations(currentPage, itemsPerPage);
      
      // Navigate to the edit page for the new ticket
      navigate(`/tickets/edit/${response._id}`);
      
    } catch (error) {
      console.error("Error creating ticket:", error);
      const errorMessage = error.response?.data?.error || error.message || "Unknown error occurred";
      toast.error("Failed to create ticket: " + errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [navigate, setSourceQuotationForTicket, setIsLoading, user, toast, currentPage, itemsPerPage, fetchQuotations]); 

  const handleEdit = useCallback(async (quotation) => {
    let orderIssuedByIdToSet =
      quotation.orderIssuedBy?._id || quotation.orderIssuedBy ||
      quotation.user?._id || quotation.user || user?.id;
    if (typeof orderIssuedByIdToSet === "object" && orderIssuedByIdToSet !== null) {
      orderIssuedByIdToSet = orderIssuedByIdToSet._id;
    }

    const quotationDataForForm = {
      date: formatDateForInputHelper(quotation.date),
      referenceNumber: quotation.referenceNumber,
      validityDate: formatDateForInputHelper(quotation.validityDate),
      orderIssuedBy: orderIssuedByIdToSet,
      goods: quotation.goods.map((item) => ({
        ...item,
        quantity: Number(item.quantity), price: Number(item.price), amount: Number(item.amount),
        sellingPrice: Number(item.sellingPrice),
        unit: item.unit || "nos",
        originalPrice: Number(item.sellingPrice || item.originalPrice || item.price),
        maxDiscountPercentage: item.maxDiscountPercentage ? Number(item.maxDiscountPercentage) : 0,
        gstRate: parseFloat(item.gstRate || 0),
        subtexts: item.subtexts || [],
        originalItem: item.originalItem?._id || item.originalItem || item.itemId,
        units: item.units || [], // <-- always attach units for edit
      })),
      totalQuantity: Number(quotation.totalQuantity), totalAmount: Number(quotation.totalAmount),
      gstAmount: Number(quotation.gstAmount), grandTotal: Number(quotation.grandTotal),
      billingAddress: quotation.billingAddress || initialQuotationData.billingAddress,
      status: quotation.status || "open",
      client: {
        companyName: quotation.client?.companyName || "", gstNumber: quotation.client?.gstNumber || "",
        clientName: quotation.client?.clientName || "", email: quotation.client?.email || "",
        phone: quotation.client?.phone || "", _id: quotation.client?._id || null,
      },
    };
    navigate(`/quotations/form/${quotation._id}`, { state: { quotationDataForForm, isEditing: true } });
  }, [navigate, user, initialQuotationData]); 

  const openCreateModal = useCallback(async () => { 
    if (!user) {
      toast.error("User data not available.");
      return;
    }
    const newQuotationData = {
      ...initialQuotationData, 
      date: formatDateForInputHelper(new Date()),
      referenceNumber: generateQuotationNumber(),
      orderIssuedBy: user.id, 
    };
    navigate("/quotations/form", { state: { quotationDataForForm: newQuotationData, isEditing: false } });
  }, [navigate, user, initialQuotationData, generateQuotationNumber]); 

  const handleDeleteQuotation = useCallback(async (quotation) => {
    if (!quotation || !quotation._id) {
      toast.error("Invalid quotation.");
      return;
    }
    if (!window.confirm(`Delete quotation ${quotation.referenceNumber}?`)) return;

    setIsLoading(true); 
    setError(null);
    try {
      await apiClient(`/quotations/${quotation._id}`, { method: "DELETE" });
      resetForm(); 
      if (quotations.length === 1 && currentPage > 1) {
        setCurrentPage(prevPage => prevPage - 1); 
      } else {
        fetchQuotations(currentPage, itemsPerPage); 
      }
      toast.success(`Quotation ${quotation.referenceNumber} deleted.`);
    } catch (error) {
      const errorMessage = handleApiError(
        error, "Failed to delete quotation.", authUserFromContext, "quotationActivity"
      );
      if (error.status === 401) {
        navigate("/login", { state: { from: "/quotations" } });
        return;
      }
      setError(errorMessage); 
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [authUserFromContext, resetForm, fetchQuotations, navigate, quotations.length, currentPage, itemsPerPage]);


  return (
    <div>
      <Navbar />
      <LoadingSpinner show={isLoading || authLoading} /> {/* Show spinner during data fetch or auth loading */}
      <div className="container mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap" style={{ gap: "1rem" }}>
          <h2 style={{ color: "black", margin: 0, whiteSpace: "nowrap" }}>Quotations</h2>

          <div className="filter-dropdown-group">
            <Form.Select
              aria-label="Status filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="form-select-sm"
              style={{ width: 'auto', minWidth: '200px' }}
            >
              <option value="all">Sort By Status</option>
              {["open", "running", "closed", "hold"].map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Form.Select>
          </div>

          <div className="d-flex align-items-center" style={{ minWidth: "200px", flexGrow: 1, maxWidth: "400px" }}>
            <SearchBar
                value={searchTerm}
                setSearchTerm={(value) => setSearchTerm(value)} 
                placeholder="Search by Company Name, or Client Name..."
                className="w-100"
            />
          </div>

          <Button variant="success" onClick={openCreateModal} title="Create New Quotation" style={{ whiteSpace: "nowrap" }}>
            <PlusCircle size={18} className="me-1" /> New Quotation
          </Button>
        </div>

        {!isLoading && !authLoading && error && <Alert variant="danger">{error}</Alert>}

        {!isLoading && !authLoading && !error && (
          <ReusableTable
            columns={[
              { key: "referenceNumber", header: "Reference No", sortable: true, tooltip: "Quotation Reference Number (yymmdd-hhmmss format)" },
              { key: "client.companyName", header: "Company Name", sortable: true, renderCell: (item) => item.client?.companyName || "N/A" },
              ...(user?.role === "super-admin" ? [{
                  key: "user.firstname", header: "Created By", sortable: true,
                  renderCell: (item) => `${item.user?.firstname || ""} ${item.user?.lastname || ""}`.trim() || "N/A",
              }] : []),
              { key: "validityDate", header: "Validity Date", sortable: true, renderCell: (item) => formatDateForInputHelper(item.validityDate) },
              { key: "status", header: "Status", sortable: true,
                renderCell: (item) => (
                  <span className={`badge bg-${item.status === "open" ? "primary" : item.status === "closed" ? "success" : item.status === "running" ? "info" : "warning"}`}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </span>
                ),
                tooltip: "Current status (Open, Running, Hold, Closed).",
              },
            ]}
            data={quotations} 
            keyField="_id"
            onSort={requestSort}
            sortConfig={sortConfig}
            renderActions={(quotation) => (
              <ActionButtons
                item={quotation}
                onEdit={handleEdit}
                onCreateTicket={quotation.status !== "closed" && quotation.status !== "running" ? handleCreateTicket : undefined}
                onView={() => navigate(`/quotations/preview/${quotation._id}`, { state: { quotationToPreview: quotation } })}
                onDelete={user?.role === "super-admin" ? handleDeleteQuotation : undefined}
                isLoading={isLoading} 
                createTicketDisabled={isLoading || quotation.status === "closed" || quotation.status === "running" || quotation.status === "hold"}
              />
            )}
            noDataMessage="No quotations found."
            tableClassName="mt-3"
            theadClassName="table-dark"
          />        
        )}

        {totalQuotations > 0 && !isLoading && (
          <Pagination
            currentPage={currentPage}
            totalItems={totalQuotations}
            itemsPerPage={itemsPerPage}
            onPageChange={(page) => {
              const totalPages = Math.ceil(totalQuotations / itemsPerPage);
              if (page >= 1 && page <= totalPages) { setCurrentPage(page); }
            }}
            onItemsPerPageChange={handleItemsPerPageChange}
            reportButton={reportButtonElement} 
          />
        )}
      </div>
      <Footer />
    </div>
  );
}