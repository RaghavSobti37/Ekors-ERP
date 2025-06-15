// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/pages/Quotations.jsx
import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Button,
  Form,
  Alert,
  Spinner,
} from "react-bootstrap";
import Navbar from "../components/Navbar.jsx";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
// ClientSearchComponent, ItemSearchComponent, QuotationPDF, CreateTicketModal are now part of separate pages or handled differently
import Pagination from "../components/Pagination";
import Footer from "../components/Footer";
import ReusableTable from "../components/ReusableTable.jsx";
import SearchBar from "../components/Searchbar.jsx";
import ActionButtons from "../components/ActionButtons";
import { ToastContainer, toast } from "react-toastify";
import frontendLogger from "../utils/frontendLogger.js";
import "react-toastify/dist/ReactToastify.css";
// PDFViewer is used in QuotationPreviewPage.jsx
import {
  showToast,
  handleApiError,
  formatDateForInput as formatDateForInputHelper,
} from "../utils/helpers";
import apiClient from "../utils/apiClient";
import "../css/Style.css";
import "../css/Items.css";
// ReusablePageStructure is used by the new page components, not directly here for the form
// QuotationReportModal is now QuotationReportPage.jsx
import { FaChartBar } from "react-icons/fa";

export default function Quotations() {
  // State related to modals and forms are removed or moved to respective page components
  const [quotations, setQuotations] = useState([]);
  const [error, setError] = useState(null);
  // const [isLoading, setIsLoading] = useState(false); // Local isLoading can be removed or used for more granular control
  // const [currentQuotation, setCurrentQuotation] = useState(null); // Only needed if passing to PDF preview page via state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [sortConfig, setSortConfig] = useState({
    key: "referenceNumber",
    direction: "descending",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const { user, loading: authLoading } = useAuth(); // Renamed loading to authLoading to avoid conflict
  const { showPageLoader, hidePageLoader, user: authUserFromContext } = useAuth(); // Get loader functions
  const [statusFilter, setStatusFilter] = useState("all");
  const navigate = useNavigate();
  // const [showQuotationReportModal, setShowQuotationReportModal] = useState(false); // Replaced by navigation
  const [sourceQuotationForTicket, setSourceQuotationForTicket] = useState(null); // To store the quotation being used to create a ticket

  const generateQuotationNumber = () => { // This might be needed if generating on client before navigating to form
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `Q-${year}${month}${day}-${hours}${minutes}${seconds}`;
  };

  const initialQuotationData = { // This is mainly for preparing data for the form page
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
  };

  // ticketData state is removed as CreateTicketModal is now CreateTicketPage
  // and will manage its own state, receiving initial data via navigation state.

  const fetchQuotations = useCallback(async () => {
    if (authLoading || !user) return;
    showPageLoader(); // Show global loader
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      // Add search term to params if your backend supports it for server-side search
      if (searchTerm) params.append("search", searchTerm);

      const endpoint = `/quotations${params.toString() ? `?${params.toString()}` : ""}`;
      const data = await apiClient(endpoint);
      setQuotations(data);
      setError(null);
    } catch (error) {
      const errorMessage = handleApiError(
        error,
        "Failed to load quotations. Please try again.",
        authUserFromContext, // Use user from context
        "quotationActivity"
      );
      setError(errorMessage);
      showToast(errorMessage, false); // Assuming showToast is a helper you have
      if (authUserFromContext) { // Use user from context
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
      hidePageLoader(); // Hide global loader
    }
  }, [user, authLoading, navigate, statusFilter, searchTerm, authUserFromContext, showPageLoader, hidePageLoader]);

  useEffect(() => {
    if (!authLoading && !user) {
      if (window.location.pathname !== "/login") {
        navigate("/login", { state: { from: "/quotations" } });
      }
    } else if (user) {
      fetchQuotations();
    }
  }, [user, authLoading, navigate, fetchQuotations]);

  // Client-side search/filter if backend doesn't support it fully
  const filteredAndSortedQuotations = useMemo(() => {
    let processedQuotations = [...quotations];

    // Client-side search (if backend doesn't handle it or for refinement)
    // If backend handles search, this client-side search might be redundant or for additional local filtering.
    // For this example, let's assume backend search is primary, and this is for local refinement if needed.
    // If `searchTerm` is already passed to backend, this part might be simplified or removed.
    if (searchTerm && !quotations.length) { // If backend search is active, quotations might already be filtered
        // This block might not be needed if backend search is comprehensive
    } else if (searchTerm) {
        const term = searchTerm.toLowerCase();
        processedQuotations = processedQuotations.filter(
            (q) =>
            q.referenceNumber?.toLowerCase().includes(term) ||
            q.client?.companyName?.toLowerCase().includes(term) ||
            q.client?.gstNumber?.toLowerCase().includes(term) ||
            q.goods.some(
                (item) =>
                item.description?.toLowerCase().includes(term) ||
                item.hsnSacCode?.toLowerCase().includes(term)
            )
        );
    }


    // Sorting
    if (sortConfig.key) {
      processedQuotations.sort((a, b) => {
        if (sortConfig.key === "date" || sortConfig.key === "validityDate") {
          const dateA = new Date(a[sortConfig.key]);
          const dateB = new Date(b[sortConfig.key]);
          return sortConfig.direction === "ascending" ? dateA - dateB : dateB - dateA;
        }
        if (sortConfig.key === "grandTotal") {
          return sortConfig.direction === "ascending" ? a.grandTotal - b.grandTotal : b.grandTotal - a.grandTotal;
        }
        const valA = sortConfig.key.includes(".") ? sortConfig.key.split(".").reduce((o, i) => o?.[i], a) : a[sortConfig.key];
        const valB = sortConfig.key.includes(".") ? sortConfig.key.split(".").reduce((o, i) => o?.[i], b) : b[sortConfig.key];

        if (valA === null || valA === undefined) return 1; // Sort nulls/undefined to the end
        if (valB === null || valB === undefined) return -1;

        if (valA < valB) return sortConfig.direction === "ascending" ? -1 : 1;
        if (valA > valB) return sortConfig.direction === "ascending" ? 1 : -1;
        return 0;
      });
    }
    return processedQuotations;
  }, [quotations, sortConfig, searchTerm]);


  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredAndSortedQuotations.slice(indexOfFirstItem, indexOfLastItem);

  const requestSort = (key) => {
    let direction = "descending"; // Default to descending for most columns
    if (sortConfig.key === key) {
        direction = sortConfig.direction === "ascending" ? "descending" : "ascending";
    } else if (key === "grandTotal" || key === "date" || key === "validityDate") {
        direction = "descending"; // Specific default for these
    } else {
        direction = "ascending"; // Default for text fields
    }
    setSortConfig({ key, direction });
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  useEffect(() => { // Reset page to 1 when search term or status filter changes
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // Prepare the Report button element to pass to Pagination
  const reportButtonElement = (user?.role === "admin" || user?.role === "super-admin") && (
    <Button
      variant="info"
      onClick={() => navigate("/quotations/report")}
      // disabled={isLoading} // Global loader handles this, or use local isLoading if still needed
      title="View Quotation Reports"
      size="sm" // To match items per page selector style
    >
      <FaChartBar className="me-1" /> Report
    </Button>
  );


  const resetForm = () => { // This is less relevant now as form is on a separate page
    // setQuotationData(initialQuotationData); // Form state is in QuotationFormPage
    setError(null);
  };

  const generateTicketNumber = async () => { // This might be needed if generating on client before navigating
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `EKORS/${year}${month}${day}${hours}${minutes}${seconds}`;
  };

  const handleCreateTicket = async (quotation) => {
    setSourceQuotationForTicket(quotation);
    const defaultDeadline = new Date();
    defaultDeadline.setDate(defaultDeadline.getDate() + 10);

    const ticketNumberToSet = await generateTicketNumber();
    const quotationBillingAddressObject = quotation.billingAddress || {};
    const ticketBillingAddressArrayFromQuotation = [
      quotationBillingAddressObject.address1 || "",
      quotationBillingAddressObject.address2 || "",
      quotationBillingAddressObject.state || "",
      quotationBillingAddressObject.city || "",
      quotationBillingAddressObject.pincode || "",
    ];
    const clientData = quotation.client || {};

    const ticketDataForForm = {
      ticketNumber: ticketNumberToSet,
      companyName: quotation.client?.companyName || "",
      quotationNumber: quotation.referenceNumber,
      billingAddress: ticketBillingAddressArrayFromQuotation, // Array form for CreateTicketPage
      shippingAddressObj: { address1: "", address2: "", city: "", state: "", pincode: "" }, // Object form for CreateTicketPage
      shippingSameAsBilling: false,
      goods: quotation.goods.map((item) => ({
        ...item,
        quantity: Number(item.quantity),
        price: Number(item.price),
        amount: Number(item.amount),
        gstRate: parseFloat(item.gstRate || 0),
        subtexts: item.subtexts || [],
      })),
      clientPhone: clientData.phone || "",
      clientGstNumber: clientData.gstNumber || "",
      totalQuantity: Number(quotation.totalQuantity),
      totalAmount: Number(quotation.totalAmount),
      dispatchDays: quotation.dispatchDays || "7-10 working days",
      validityDate: quotation.validityDate ? new Date(quotation.validityDate).toISOString() : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      termsAndConditions: quotation.termsAndConditions || "1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged if payment is not made within the stipulated time.\n3. Subject to Noida jurisdiction.",
      gstBreakdown: [], totalCgstAmount: 0, totalSgstAmount: 0, totalIgstAmount: 0,
      finalGstAmount: 0, grandTotal: 0, isBillingStateSameAsCompany: false,
      status: "Quotation Sent",
      deadline: defaultDeadline.toISOString().split("T")[0],
    };
    navigate("/tickets/create-from-quotation", { state: { ticketDataForForm, sourceQuotationData: quotation } });
  };


  const handleEdit = async (quotation) => {
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
        unit: item.unit || "Nos", originalPrice: Number(item.originalPrice || item.price),
        maxDiscountPercentage: item.maxDiscountPercentage ? Number(item.maxDiscountPercentage) : 0,
        gstRate: parseFloat(item.gstRate || 0),
        subtexts: item.subtexts || [],
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
  };

  const openCreateModal = async () => { // Renamed from openCreateModal to reflect it's for navigation
    if (!user) {
      toast.error("User data not available.");
      return;
    }
    const newQuotationData = {
      ...initialQuotationData, // Uses the structure defined above
      date: formatDateForInputHelper(new Date()),
      referenceNumber: generateQuotationNumber(),
      orderIssuedBy: user.id, // Assuming user object has id
    };
    navigate("/quotations/form", { state: { quotationDataForForm: newQuotationData, isEditing: false } });
  };

  const handleDeleteQuotation = async (quotation) => {
    if (!quotation || !quotation._id) {
      toast.error("Invalid quotation.");
      return;
    }
    if (!window.confirm(`Delete quotation ${quotation.referenceNumber}?`)) return;

    showPageLoader();
    setError(null);
    try {
      await apiClient(`/quotations/${quotation._id}`, { method: "DELETE" });
      resetForm(); // Clears local error state
      fetchQuotations(); // Refreshes the list
      toast.success(`Quotation ${quotation.referenceNumber} deleted.`);
      if (auth.user) {
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
      }
    } catch (error) {
      const errorMessage = handleApiError(
        error, "Failed to delete quotation.", authUserFromContext, "quotationActivity"
      );
      if (error.status === 401) {
        navigate("/login", { state: { from: "/quotations" } });
        hidePageLoader();
        return;
      }
      setError(errorMessage); // Set local error state
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
      hidePageLoader();
    }
  };


  return (
    <div>
      <Navbar />
      <div className="container mt-4">
        {/* Header Section: Title, Add Button, Search, and Status Filter Dropdown */}
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

          {/* Search Bar - takes available space */}
          <div className="d-flex align-items-center" style={{ minWidth: "200px", flexGrow: 1, maxWidth: "400px" }}>
            <SearchBar
                value={searchTerm}
                setSearchTerm={(value) => setSearchTerm(value)} // Pass setSearchTerm directly
                placeholder="Search quotations..."
                className="w-100"
            />
          </div>

                    <Button variant="primary" onClick={openCreateModal} title="Create New Quotation" style={{ whiteSpace: "nowrap" }}>
            ➕ Quotation
          </Button>

          {/* Status Filter Dropdown */}
          
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

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
          data={currentItems}
          keyField="_id"
          // isLoading and error props for ReusableTable might not be needed if global spinner covers it
          onSort={requestSort}
          sortConfig={sortConfig}
          renderActions={(quotation) => (
            <ActionButtons
              item={quotation}
              onEdit={handleEdit}
              onCreateTicket={quotation.status !== "closed" && quotation.status !== "running" ? handleCreateTicket : undefined}
              onView={() => navigate(`/quotations/preview/${quotation._id}`, { state: { quotationToPreview: quotation } })}
              onDelete={user?.role === "super-admin" ? handleDeleteQuotation : undefined}
              // isLoading={isLoading} // Can be removed if global loader is sufficient
              disabled={{ // Specific disable conditions
                createTicket: quotation.status === "closed" || quotation.status === "running" || quotation.status === "hold",
                // Add other specific disables if needed, e.g., edit: quotation.status === 'closed'
              }}
              // Tooltips can be managed by ActionButtons or passed if highly dynamic
            />
          )}
          noDataMessage="No quotations found."
          tableClassName="mt-3"
          theadClassName="table-dark"
        />

        {/* Modals for form, PDF preview, and report are now separate pages */}

        {filteredAndSortedQuotations.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredAndSortedQuotations.length}
            itemsPerPage={itemsPerPage}
            onPageChange={(page) => {
              const totalPages = Math.ceil(filteredAndSortedQuotations.length / itemsPerPage);
              if (page >= 1 && page <= totalPages) setCurrentPage(page);
            }}
            onItemsPerPageChange={handleItemsPerPageChange}
            reportButton={reportButtonElement} // Pass the report button here
          />
        )}
      </div>
      <Footer />
      {/* ToastContainer is now in App.jsx */}
    </div>
  );
}
