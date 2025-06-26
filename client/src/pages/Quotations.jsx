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
import frontendLogger from "../utils/frontendLogger.js";
import "react-toastify/dist/ReactToastify.css";
import {
  showToast,
  handleApiError,
  formatDateForInput as formatDateForInputHelper, generateNextTicketNumber
} from "../utils/helpers"; // Import helper function
import apiClient from "../utils/apiClient";
import "../css/Style.css";
import "../css/Items.css";
import { FaChartBar } from "react-icons/fa";

export default function Quotations() {
  const [quotations, setQuotations] = useState([]); // Holds current page's quotations
  const [totalQuotations, setTotalQuotations] = useState(0); // Total quotations for pagination
  const { generateNextQuotationNumber } = useAuth();
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

  // Initial state for quotation data, will be populated from backend defaults
  const initialQuotationData = useMemo(() => ({
    date: formatDateForInputHelper(new Date()), // Placeholder, will be overwritten by backend default or current date
    referenceNumber: "", // Placeholder, will be fetched from backend
    validityDate: formatDateForInputHelper(new Date()), // Placeholder, will be fetched from backend
    orderIssuedBy: "",
    billingAddress: {
      address1: "", address2: "", city: "", state: "", pincode: "",
    },
    goods: [],
    totalQuantity: 0, totalAmount: 0, gstAmount: 0, grandTotal: 0,
    status: "open",
    client: { _id: null, companyName: "", clientName: "", gstNumber: "", email: "", phone: "", },
    dispatchDays: "", // Placeholder for backend default
    termsAndConditions: "", // Placeholder for backend default
  }), []);


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
      if (authUserFromContext) { 
        frontendLogger.error(
          "quotationActivity",
          "Failed to fetch quotations",
          authUserFromContext,
          {
            errorMessage: error.response?.data?.message || error.message,
            statusFilter,
            action: "FETCH_QUOTATIONS_FAILURE",
          }
        );
      }
      if (error.status === 401) {
        toast.error("Authentication failed. Please log in again.");
        navigate("/login", { state: { from: "/quotations" } });
      }
    } finally {
      setIsLoading(false);
    }
  }, [user, authLoading, navigate, statusFilter, searchTerm, authUserFromContext, currentPage, itemsPerPage, sortConfig.key, sortConfig.direction]);

  useEffect(() => {
    if (!authLoading && !user) {
      if (window.location.pathname !== "/login") {
        navigate("/login", { state: { from: "/quotations" } });
      }
    } else if (user) {
      fetchQuotations(currentPage, itemsPerPage); 
    }
  }, [user, authLoading, navigate, fetchQuotations, currentPage, itemsPerPage]); 


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
  }, [searchTerm, statusFilter, sortConfig]); 

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
setIsLoading(true); // Show loading spinner
    try {
      // Fetch the FULL quotation object to get all details, including 'goods'
      const fullQuotation = await apiClient(`/quotations/${quotation._id}`);
      setSourceQuotationForTicket(fullQuotation); // Set the full quotation for the ticket

      let defaultDeadline = new Date();
      defaultDeadline.setDate(defaultDeadline.getDate() + 10); // Default fallback deadline

      const quotationBillingAddressObject = fullQuotation.billingAddress || {};
      const ticketBillingAddressArrayFromQuotation = [
        quotationBillingAddressObject.address1 || "",
        quotationBillingAddressObject.address2 || "",
        quotationBillingAddressObject.state || "",
        quotationBillingAddressObject.city || "",
        quotationBillingAddressObject.pincode || "",
      ];
      const clientData = fullQuotation.client || {};

      const ticketNumberToSet = generateNextTicketNumber(); // Generate ticket number on frontend
      const ticketDataForForm = {
        ticketNumber: ticketNumberToSet,
        companyName: fullQuotation.client?.companyName || "",
        quotationNumber: fullQuotation.referenceNumber,
        billingAddress: ticketBillingAddressArrayFromQuotation,
        shippingAddressObj: { address1: "", address2: "", city: "", state: "", pincode: "" },
        shippingSameAsBilling: false,
        goods: fullQuotation.goods.map((item) => ({ // Use fullQuotation.goods here
          ...item,
          quantity: Number(item.quantity),
          price: Number(item.price),
          amount: Number(item.amount),
          gstRate: parseFloat(item.gstRate || 0),
          subtexts: item.subtexts || [],
        })),
        clientPhone: clientData.phone || "",
        clientGstNumber: clientData.gstNumber || "",
        totalQuantity: Number(fullQuotation.totalQuantity),
        totalAmount: Number(fullQuotation.totalAmount),
        dispatchDays: fullQuotation.dispatchDays || "7-10 working days",
        validityDate: fullQuotation.validityDate ? new Date(fullQuotation.validityDate).toISOString() : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
        termsAndConditions: fullQuotation.termsAndConditions || "1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged if payment is not made within the stipulated time.\n3. Subject to Noida jurisdiction.",
        gstBreakdown: [], totalCgstAmount: 0, totalSgstAmount: 0, totalIgstAmount: 0,
        finalGstAmount: 0, grandTotal: 0, isBillingStateSameAsCompany: false,
        status: "Quotation Sent",
        deadline: defaultDeadline.toISOString().split("T")[0],
      };
      navigate("/tickets/create-from-quotation", { state: { ticketDataForForm, sourceQuotationData: fullQuotation } });
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to load quotation details to create ticket.", authUserFromContext, "quotationActivity");
      toast.error(errorMessage);
    } finally {
      setIsLoading(false); // Hide loading spinner
    }
  }, [navigate, authUserFromContext]);

  const handleEdit = useCallback((quotation) => {
    // The form page is now responsible for fetching the full quotation details.
    // We just need to navigate to the correct URL with the ID.
    // The `isEditing` flag can be passed in state if the form is used for both create and edit.
    navigate(`/quotations/form/${quotation._id}`, { state: { isEditing: true } });
  }, [navigate]); 

  const openCreateModal = useCallback(async () => { 
    if (!user) { toast.error("User data not available."); return; }
    setIsLoading(true); // Show loading spinner while fetching defaults
    let newQuotationData = { ...initialQuotationData };
    try {
      // Fetch defaults from backend
      const defaults = await apiClient('/quotations/defaults');
      newQuotationData = {
        ...initialQuotationData,
        date: formatDateForInputHelper(new Date()), // Current date for creation
        referenceNumber: defaults.nextQuotationNumber,
        validityDate: defaults.defaultValidityDate,
        dispatchDays: defaults.defaultDispatchDays,
        termsAndConditions: defaults.defaultTermsAndConditions,
        orderIssuedBy: user.id,
      };
      setError(null);
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to fetch quotation defaults. Using fallback values.", authUserFromContext, "quotationActivity");
      setError(errorMessage);
      toast.error(errorMessage);
      // Fallback to client-side defaults if API fails
      newQuotationData.validityDate = formatDateForInputHelper(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)); // Fallback validity
      newQuotationData.orderIssuedBy = user.id; // Corrected syntax: assign to newQuotationData
  };
    navigate("/quotations/form", { state: { isEditing: false } }); // No need to pass quotationDataForForm here
  }, [navigate, user, initialQuotationData]); 

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
        frontendLogger.info(
          "quotationActivity",
          `Quotation ${quotation.referenceNumber} deleted`,
          authUserFromContext,
          {
            quotationId: quotation._id,
            referenceNumber: quotation.referenceNumber,
            action: "DELETE_QUOTATION_SUCCESS",
          }
        );
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
      if (authUserFromContext) {
        frontendLogger.error(
          "quotationActivity", "Failed to delete quotation", authUserFromContext,
          {
            quotationId: quotation._id, referenceNumber: quotation.referenceNumber,
            action: "DELETE_QUOTATION_FAILURE",
          }
        );
      }
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
                placeholder="Search quotations..."
                className="w-100"
            />
          </div>

          <Button variant="primary" onClick={openCreateModal} title="Create New Quotation" style={{ whiteSpace: "nowrap" }}>
            ➕ Quotation
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
                user={user}
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