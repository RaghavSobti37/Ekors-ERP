import React, { useState, useEffect, useCallback, useMemo } from "react";
import apiClient from "../utils/apiClient"; // Import apiClient
import "../css/Style.css";
import Navbar from "../components/Navbar.jsx";
import Pagination from "../components/Pagination";
import { saveAs } from 'file-saver'; // For downloading files
import { getAuthToken } from "../utils/authUtils";
import * as XLSX from "xlsx";
import ActionButtons from "../components/ActionButtons";
import {
  Eye, // View
  PencilSquare, // Edit
  Trash, // Delete
  BarChart, // Generate Report
} from "react-bootstrap-icons";

const debug = (message, data = null) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[DEBUG] ${message}`, data);
  }
};

export default function Items() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "name",
    direction: "asc",
  });
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    quantity: "",
    price: "",
    gstRate: "0",
    hsnCode: "",
    unit: "Nos",
    category: "",
    subcategory: "General",
    maxDiscountPercentage: "",
  });
  const [showModal, setShowModal] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [purchaseHistory, setPurchaseHistory] = useState({});
  const [purchaseHistoryLoading, setPurchaseHistoryLoading] = useState({}); // Track loading state per item
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [currentItemIndex, setCurrentItemIndex] = useState(-1);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedSubcategory, setSelectedSubcategory] = useState("All");
  const [purchaseData, setPurchaseData] = useState({
    companyName: "",
    gstNumber: "",
    address: "",
    stateName: "",
    invoiceNumber: "",
    date: new Date().toISOString().split("T")[0],
    quantity: "",
    price: "",
    gstRate: "0",
    description: "",
    items: [],
  });
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [filteredItemsList, setFilteredItemsList] = useState([]);
  const [showItemSearch, setShowItemSearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // const [isUpdatingFromExcel, setIsUpdatingFromExcel] = useState(false); // Old state for server-side excel
  const [isProcessingExcel, setIsProcessingExcel] = useState(false); // For upload/export
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [excelUpdateStatus, setExcelUpdateStatus] = useState({
    error: null,
    success: null,
    details: [],
  });

  const showSuccess = (message) => {
    // TODO: Replace with a proper toast notification library for better UX
    // Could use a toast library here
    alert(message);
  };

  useEffect(() => {
    debug("Component mounted or dependencies changed", { items, categories });
  }, [items, categories]);

  const fetchItems = useCallback(async () => {
    try {
      debug("Starting to fetch items");
      setLoading(true);
      setError(null);
      const response = await apiClient("/items"); // Use apiClient
      debug("Items fetched successfully", response);
      setItems(response);
    } catch (err) {
      debug("Error fetching items", err);
      console.error("Error fetching items:", err);
      setError("Failed to load items. Please try again.");
    } finally {
      debug("Finished items fetch attempt");
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      debug("Attempting to fetch categories");
      // Categories endpoint is public, but using apiClient for consistency is fine
      const categoriesData = await apiClient("/items/categories", {
        timeout: 5000,
      });
      debug("Categories data received", categoriesData);

      if (Array.isArray(categoriesData)) {
        setCategories(categoriesData);
      } else if (categoriesData === null || categoriesData === undefined) {
        // Handle cases where API might return null/undefined for no categories, or if apiClient returns that for a 204
        debug(
          "Received null or undefined for categories, setting to empty array.",
          categoriesData
        );
        setCategories([]);
      } else {
        // This case implies apiClient returned something unexpected that wasn't an array or null/undefined
        throw new Error(
          `Expected an array of categories, but received type: ${typeof categoriesData}`
        );
      }
    } catch (err) {
      const errorDetails = {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
        config: err.config,
      };

      debug("Categories fetch failed", errorDetails);

      let errorMessage = "Failed to load categories";
      if (err.response) {
        // Server responded with error status
        errorMessage += ` (${err.response.status})`;
        if (err.response.data?.message) {
          errorMessage += `: ${err.response.data.message}`;
        }
      } else if (err.request) {
        // Request was made but no response received
        errorMessage += ": No response from server";
      } else {
        // Something else happened
        errorMessage += `: ${err.message}`;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    fetchCategories();

    return () => {
      setItems([]);
      setCategories([]);
    };
  }, [fetchItems, fetchCategories]);

  useEffect(() => {
    if (itemSearchTerm.trim() !== "") {
      // Ensure items is an array and iterable before filtering
      if (Array.isArray(items) && items.length > 0) {
        const filtered = items.filter(
          (item) =>
            item.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
            (item.hsnCode &&
              item.hsnCode.toLowerCase().includes(itemSearchTerm.toLowerCase()))
        );
        setFilteredItemsList(filtered);
      } else {
        setFilteredItemsList([]); // Set to empty if items is not ready or empty
      }
    } else {
      setFilteredItemsList([]);
    }
  }, [itemSearchTerm, items]);

  const fetchPurchaseHistory = useCallback(async (itemId) => {
    try {
      // Set loading state for this specific item
      setPurchaseHistoryLoading((prev) => ({ ...prev, [itemId]: true }));
      // Clear any previous errors
      setError(null);

      const response = await apiClient(`/items/${itemId}/purchases`, {
        timeout: 5000,
      });

      setPurchaseHistory((prev) => ({
        ...prev,
        [itemId]: response.data || [],
      }));
    } catch (err) {
      console.error("Fetch purchase history error:", err);
      setError(
        `Failed to load history: ${err.response?.data?.message || err.message}`
      );
      setPurchaseHistory((prev) => ({
        ...prev,
        [itemId]: [],
      }));
    } finally {
      // Clear loading state for this specific item
      setPurchaseHistoryLoading((prev) => ({ ...prev, [itemId]: false }));
    }
  }, []);

  const handleError = (error, customMessage) => {
    debug("Error occurred", error);
    const message =
      error.response?.data?.message ||
      error.message ||
      customMessage ||
      "An unexpected error occurred";
    setError(message);

    // Show error to user (you might want to use a toast notification instead)
    alert(message);
  };

  const handleEdit = (item) => {
    setEditingItem(item._id);
    setFormData({
      name: item.name,
      quantity: item.quantity.toString(),
      price: item.price.toString(),
      gstRate: item.gstRate.toString(),
      hsnCode: item.hsnCode || "",
      unit: item.unit || "Nos",
      category: item.category || "",
      subcategory: item.subcategory || "General",
      maxDiscountPercentage: (item.maxDiscountPercentage || 0).toString(),
    });
  };

  const handleCancel = () => {
    setEditingItem(null);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value.toLowerCase());
    setCurrentPage(1);
  };

  const handleSave = async () => {
    if (!formData.name) {
      setError("Item name is required");
      return;
    }

    if (!editingItem) {
      setError("No item selected for editing.");
      return;
    }

    try {
      setIsSubmitting(true);
      const updatedItem = {
        name: formData.name,
        quantity: parseFloat(formData.quantity) || 0,
        price: parseFloat(formData.price) || 0,
        gstRate: parseFloat(formData.gstRate) || 0,
        hsnCode: formData.hsnCode || "",
        unit: formData.unit,
        category: formData.category,
        subcategory: formData.subcategory,
        maxDiscountPercentage: parseFloat(formData.maxDiscountPercentage) || 0,
      };

      await apiClient(`/items/${editingItem}`, {
        method: "PUT",
        body: updatedItem,
      });
      await fetchItems();
      setEditingItem(null);
      setError(null);
      showSuccess("Item saved successfully!");
    } catch (err) {
      console.error("Error updating item:", err);
      setError(
        `Failed to update item: ${err.response?.data?.message || err.message}`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedItems = useMemo(() => {
    // First check if items is a valid array
    if (!Array.isArray(items)) {
      debug("sortedItems: items is not an array, returning []");
      return [];
    }

    // Create a copy for sorting
    const sortableItems = [...items];
    debug("sortedItems: Sorting items", { count: sortableItems.length, sortConfig });

    sortableItems.sort((a, b) => {
      // Prioritize items needing restock
      if (a.needsRestock && !b.needsRestock) return -1;
      if (!a.needsRestock && b.needsRestock) return 1;

      // Then sort by the configured key
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      // If primary sort key is the same, you could add a secondary sort, e.g., by name
      // if (a.name < b.name) return -1;
      // if (a.name > b.name) return 1;
      return 0;
    });

    return sortableItems;
  }, [items, sortConfig]);

  const filteredItems = useMemo(() => {
    return sortedItems.filter((item) => {
      const matchesCategory =
        selectedCategory === "All" || item.category === selectedCategory;
      const matchesSubcategory =
        selectedSubcategory === "All" ||
        item.subcategory === selectedSubcategory;
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.hsnCode &&
          item.hsnCode.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesCategory && matchesSubcategory && matchesSearch;
    });
  }, [sortedItems, selectedCategory, selectedSubcategory, searchTerm]);

  const currentItems = useMemo(() => {
    const indexOfLast = currentPage * itemsPerPage;
    const indexOfFirst = indexOfLast - itemsPerPage;
    return filteredItems.slice(indexOfFirst, indexOfLast);
  }, [filteredItems, currentPage, itemsPerPage]);

  const totalPages = useMemo(
    () => Math.ceil(filteredItems.length / itemsPerPage),
    [filteredItems, itemsPerPage]
  );

  const addNewPurchaseItem = () => {
    setPurchaseData({
      ...purchaseData,
      items: [
        ...(purchaseData.items || []),
        {
          description: "",
          quantity: "1",
          price: "",
          gstRate: "0",
        },
      ],
    });
  };

  const addExistingItemToPurchase = (item) => {
    setPurchaseData({
      ...purchaseData,
      items: [
        ...(purchaseData.items || []),
        {
          itemId: item._id,
          description: item.name,
          quantity: "1",
          price: item.price.toString(),
          gstRate: item.gstRate.toString(),
        },
      ],
    });
    setItemSearchTerm("");
    setShowItemSearch(false);
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...(purchaseData.items || [])];
    if (!updatedItems[index]) {
      updatedItems[index] = {
        description: "",
        quantity: "1",
        price: "",
        gstRate: "0",
      };
    }
    updatedItems[index][field] = value;
    setPurchaseData({
      ...purchaseData,
      items: updatedItems,
    });
  };

  const openPurchaseModal = () => {
    setPurchaseData({
      companyName: "",
      gstNumber: "",
      address: "",
      stateName: "",
      invoiceNumber: "",
      date: new Date().toISOString().split("T")[0],
      items: [
        {
          description: "",
          quantity: "1",
          price: "",
          gstRate: "0",
        },
      ],
    });
    setShowPurchaseModal(true);
  };

  const removeItem = (index) => {
    const updatedItems = [...purchaseData.items];
    updatedItems.splice(index, 1);
    setPurchaseData({
      ...purchaseData,
      items: updatedItems,
    });
  };

  const calculateItemAmount = (item) => {
    const quantity = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.price) || 0;
    const gstRate = parseFloat(item.gstRate) || 0;

    return quantity * price * (1 + gstRate / 100);
  };

  const calculateTotalAmount = () => {
    if (!purchaseData.items || purchaseData.items.length === 0) return 0;
    return purchaseData.items.reduce(
      (sum, item) => sum + calculateItemAmount(item),
      0
    );
  };

  const isPurchaseDataValid = useCallback(() => {
    if (
      !purchaseData.companyName ||
      !purchaseData.invoiceNumber ||
      !purchaseData.date
    ) {
      return false;
    }

    if (!purchaseData.items || purchaseData.items.length === 0) {
      return false;
    }

    return purchaseData.items.every(
      (item) =>
        item.description &&
        parseFloat(item.quantity) > 0 &&
        parseFloat(item.price) >= 0
    );
  }, [purchaseData]);

  const resetPurchaseForm = () => {
    setPurchaseData({
      companyName: "",
      gstNumber: "",
      address: "",
      stateName: "",
      invoiceNumber: "",
      date: new Date().toISOString().split("T")[0],
      quantity: "",
      price: "",
      gstRate: "0",
      items: [],
    });
    setItemSearchTerm("");
    setShowItemSearch(false);
  };

  const handleAddItem = async () => {
    if (!formData.name) {
      setError("Item name is required");
      return;
    }

    try {
      setIsSubmitting(true);
      const newItem = {
        name: formData.name,
        quantity: parseFloat(formData.quantity) || 0,
        price: parseFloat(formData.price) || 0,
        gstRate: parseFloat(formData.gstRate) || 0,
        hsnCode: formData.hsnCode || "",
        unit: formData.unit,
        category: formData.category,
        subcategory: formData.subcategory,
        maxDiscountPercentage: parseFloat(formData.maxDiscountPercentage) || 0,
      };

      await apiClient("/items", { method: "POST", body: newItem });
      await fetchItems();
      setShowModal(false);
      setFormData({
        name: "",
        quantity: "",
        price: "",
        gstRate: "0",
        hsnCode: "",
        unit: "Nos",
        category: "",
        subcategory: "General",
        maxDiscountPercentage: "",
      });
      setError(null);
    } catch (err) {
      console.error("Error adding item:", err);
      setError("Failed to add item. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePurchaseChange = (e) => {
    setPurchaseData({ ...purchaseData, [e.target.name]: e.target.value });
  };

  const toggleDetails = async (id) => {
    if (expandedRow !== id) {
      await fetchPurchaseHistory(id);
    }
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        setIsSubmitting(true);
        await apiClient(`/items/${id}`, { method: "DELETE" });
        await fetchItems();
      } catch (err) {
        console.error("Error deleting item:", err);
        setError("Failed to delete item.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const addPurchaseEntry = async () => {
    try {
      setIsSubmitting(true);
      setError(null); // Clear previous errors

      if (!isPurchaseDataValid()) {
        setError(
          "Please fill all required fields and ensure each item has a description, quantity, and price"
        );
        return false;
      }

      const purchaseDataToSend = {
        companyName: purchaseData.companyName,
        gstNumber: purchaseData.gstNumber,
        address: purchaseData.address,
        stateName: purchaseData.stateName,
        invoiceNumber: purchaseData.invoiceNumber,
        date: purchaseData.date,
        items: purchaseData.items.map((item) => ({
          itemId: item.itemId || null, // Allow null for generic items
          description: item.description,
          quantity: parseFloat(item.quantity),
          price: parseFloat(item.price),
          gstRate: parseFloat(item.gstRate || 0),
        })),
      };

      await apiClient(`/items/purchase`, {
        method: "POST",
        body: purchaseDataToSend,
      });

      await fetchItems();
      setShowPurchaseModal(false);
      resetPurchaseForm();
      showSuccess("Purchase added successfully!");
      return true;
    } catch (err) {
      console.error("Error adding purchase entry:", err);
      let detailedErrorMessage = "Failed to add purchase entry.";
      if (err.response && err.response.data) {
        detailedErrorMessage += ` ${err.response.data.message || ""}`;
        if (err.response.data.errors) {
          // Mongoose validation errors
          const validationErrors = Object.values(err.response.data.errors)
            .map((e) => e.message) // e.g., "Path `name` is required."
            .join("; ");
          detailedErrorMessage += ` Details: ${validationErrors}`;
        } else if (
          typeof err.response.data === "string" &&
          err.response.data.length < 200
        ) {
          // Avoid overly long string responses
          detailedErrorMessage += ` Server response: ${err.response.data}`;
        }
      } else if (err.message) {
        detailedErrorMessage += ` ${err.message}`;
      }
      setError(detailedErrorMessage);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportToExcel = async () => {
    setIsExportingExcel(true);
    setExcelUpdateStatus({ error: null, success: null, details: [] }); // Clear previous status
    if (
      !window.confirm("This will download an Excel file of the current item list. Continue?")
    ) {
      setIsExportingExcel(false);
      return;
    }
    try {
      // Using fetch directly for blob handling simplicity here:
      const token = localStorage.getItem("erp-user");
      const fetchResponse = await fetch('/api/items/export-excel', { // Adjust API_URL if your proxy isn't set up
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${token}`,
          },
      });

      if (!fetchResponse.ok) {
          const errorData = await fetchResponse.json().catch(() => ({ message: fetchResponse.statusText }));
          throw new Error(errorData.message || `Failed to export Excel: ${fetchResponse.status}`);
      }

      const blob = await fetchResponse.blob();
      saveAs(blob, 'items_export.xlsx');
      setExcelUpdateStatus({ error: null, success: 'Items exported to Excel successfully!', details: [] });
      showSuccess('Items exported to Excel successfully!');

    } catch (err) {
      console.error("Error exporting to Excel:", err);
      const message = err.message || "Failed to export items to Excel.";
      setExcelUpdateStatus({ error: message, success: null, details: [] });
      setError(message); // Show error in the main error display
    } finally {
      setIsExportingExcel(false);
    }
  };

  // This function will now handle file selection AND initiate processing
  const handleFileSelectedForUploadAndProcess = async (event) => {
    const file = event.target.files[0];
    setExcelUpdateStatus({ error: null, success: null, details: [] }); // Clear status on new file select

    if (!file) {
      event.target.value = null; // Reset file input if no file selected
      return;
    }

    // Confirmation before processing
    if (!window.confirm(
        "WARNING: This will synchronize the database with the selected Excel file.\n\n" +
        "- Items in Excel will be CREATED or UPDATED in the database.\n" +
        "- Items in the database BUT NOT IN THIS EXCEL FILE will be DELETED.\n\n" +
        "Are you absolutely sure you want to proceed?"
      )) {
      return;
    }
    setIsProcessingExcel(true);

    const formData = new FormData();
    formData.append('excelFile', file); 

    try {
      const token = getAuthToken(); // Use authUtils
      const fetchResponse = await fetch('/api/items/import-uploaded-excel', { // Adjust API_URL if needed
          method: 'POST',
          headers: {
              'Authorization': `Bearer ${token}`,
              // 'Content-Type': 'multipart/form-data' // Fetch sets this automatically for FormData
          },
          body: formData,
      });

      const responseData = await fetchResponse.json();

      if (!fetchResponse.ok) {
        throw new Error(responseData.message || `Failed to process Excel: ${fetchResponse.status}`);
      }

      const response = responseData;

      let successMessage = `Excel sync complete: ${response.itemsCreated || 0} created, ${response.itemsUpdated || 0} updated, ${response.itemsDeleted || 0} deleted.`;
      

      if (response.parsingErrors && response.parsingErrors.length > 0) {
        successMessage += ` Encountered ${response.parsingErrors.length} parsing issues. Check console for details.`;
        console.warn("Excel Parsing Issues:", response.parsingErrors);
      }
      if (response.databaseProcessingErrors && response.databaseProcessingErrors.length > 0) {
        successMessage += ` Encountered ${response.databaseProcessingErrors.length} database processing errors. Check console for details.`;
        console.warn("Database Processing Errors:", response.databaseProcessingErrors);
      }
      setExcelUpdateStatus({ error: null, success: successMessage, details: response.databaseProcessingDetails || [] });
      showSuccess(successMessage);
      fetchItems(); // Refresh the list
      // Reset file input visually
      const fileInput = document.getElementById('excel-upload-input');
      if (fileInput) {
        fileInput.value = null;
      }
    } catch (err) {
      console.error("Error updating from Excel:", err);
      const message =
        err.response?.data?.message ||
        err.message ||
        "Failed to update items from Excel.";
      setExcelUpdateStatus({ error: message, success: null, details: [] });
      setError(message); // Show error in the main error display
    } finally {
      setIsProcessingExcel(false);
      event.target.value = null; // Reset file input after processing attempt
    }
  };

  // Comment out or remove the old handleUpdateFromExcel if it's no longer used
  // const handleUpdateFromExcel = async () => { ... };

  const anyLoading = isSubmitting || isProcessingExcel || isExportingExcel;
  
  return (
    <div className="items-container">
      <Navbar showPurchaseModal={openPurchaseModal} />
      <div className="container mt-4">
        {/* <h2 style={{ color: "black" }}>Items List</h2> */}

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        {excelUpdateStatus.error && (
          <div className="alert alert-danger" role="alert">
            Excel Update Error: {excelUpdateStatus.error}
          </div>
        )}
        {excelUpdateStatus.success && (
          <div className="alert alert-success" role="alert">
            {excelUpdateStatus.success}
          </div>
        )}

        <div className="top-controls-container">
          {/* Row 1: Title, Add Item Button, Search Bar */}
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap">
            <h2 style={{ color: "black", margin: 0 }} className="me-auto">Items List</h2>
            
            <div className="d-flex align-items-center gap-2 mt-2 mt-md-0"> {/* mt-2 mt-md-0 for responsiveness */}
              {" "}
              <button
                onClick={() => setShowModal(true)}
                className="btn btn-success px-3" // Adjusted padding
                disabled={anyLoading}
              >
                {isSubmitting ? "Processing..." : "Add New Item"}
              </button>
              <input
                type="text"
                placeholder="🔍 Search items or HSN codes..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="form-control search-input"
                style={{ minWidth: "250px" }} // Ensure it has some width
                disabled={anyLoading}
              />
            </div>
          </div>

          {/* Row 2: Filters and Excel Buttons */}
          <div className="d-flex justify-content-between align-items-center gap-2 mb-3 flex-wrap">
            <div className="d-flex align-items-center gap-2 mt-2 mt-md-0"> {/* Group for Excel buttons */}
              <button
                onClick={handleExportToExcel}
                className="btn btn-outline-primary"
                disabled={anyLoading}
              >
                {isExportingExcel ? "Exporting..." : "Export to Excel"}
              </button>

              <button
                onClick={() => document.getElementById('excel-upload-input')?.click()}
                className="btn btn-info"
                disabled={anyLoading} 
              >
                {isProcessingExcel ? "Processing..." : "Upload & Update"}
              </button>
            </div>
            
            <div className="d-flex align-items-center gap-2 mt-2 mt-md-0"> {/* Group for filters */}
              <select
                className="form-select"
                style={{ width: "200px" }}
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedSubcategory("All");
                  setCurrentPage(1);
                }}
                disabled={anyLoading}
              >
                <option value="All">All Categories</option>
                {Array.isArray(categories) &&
                  categories.map((cat) => (
                    <option key={cat.category} value={cat.category}>
                      {cat.category}
                    </option>
                  ))}
              </select>
              <select
                className="form-select"
                style={{ width: "200px" }}
                value={selectedSubcategory}
                onChange={(e) => {
                  setSelectedSubcategory(e.target.value);
                  setCurrentPage(1);
                }}
                disabled={selectedCategory === "All" || anyLoading}
              >
                <option value="All">All Subcategories</option>
                {selectedCategory !== "All" &&
                  Array.isArray(categories) &&
                  categories
                    .find((c) => c.category === selectedCategory)
                    ?.subcategories.map((subcat) => (
                      <option key={subcat} value={subcat}>
                        {subcat}
                      </option>
                    ))}
              </select>
            </div>
          </div>
        </div>
        
        {/* Hidden file input, triggered by the "Upload & Update" button */}
            <input
              type="file"
              id="excel-upload-input"
              style={{ display: 'none' }}
              accept=".xlsx, .xls"
              onChange={handleFileSelectedForUploadAndProcess}
              disabled={anyLoading}
            />

        <div className="table-responsive">
          <table className="table table-striped table-bordered">
            <thead className="table-dark">
              <tr>
                {[
                  "name",
                  // "category",
                  // "subcategory",
                  "quantity",
                  "price",
                  "unit",
                  "gstRate",
                  // "image", // Added image column
                ].map((key) => (
                  <th
                    key={key}
                    onClick={() => !anyLoading && requestSort(key)}
                    style={{
                      cursor: anyLoading ? "not-allowed" : "pointer",
                    }}
                  >
                    {key.charAt(0).toUpperCase() +
                      key.slice(1).replace(/([A-Z])/g, " $1")}
                    {sortConfig.key === key &&
                      (sortConfig.direction === "asc" ? " ↑" : " ↓")}
                  </th>
                ))}
                <th
                  onClick={() =>
                    !anyLoading && requestSort("maxDiscountPercentage")
                  }
                  style={{
                    cursor: anyLoading ? "not-allowed" : "pointer",
                  }}
                >
                  Max Disc. %
                  {sortConfig.key === "maxDiscountPercentage" &&
                    (sortConfig.direction === "asc" ? " ↑" : " ↓")}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? (
                currentItems.map((item) => (
                  <React.Fragment key={item._id}>
                    <tr>
                      <td>
                        {editingItem === item._id ? (
                          <input
                            className="form-control"
                            name="name"
                            value={formData.name}
                            onChange={(e) =>
                              setFormData({ ...formData, name: e.target.value })
                            }
                            disabled={anyLoading}
                          />
                        ) : (
                          item.name
                        )}
                        {item.needsRestock && (
                          <span className="badge bg-danger ms-2" title={` Threshold: ${item.lowStockThreshold}`}>
                            ⚠️ Restock
                          </span>
                        )}
                      </td>
                      {/* <td>{item.category || "-"}</td>
                      <td>{item.subcategory || "-"}</td> */}
                      <td>
                        {editingItem === item._id ? (
                          <input
                            type="number"
                            className="form-control"
                            name="quantity"
                            value={formData.quantity}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                quantity: e.target.value,
                              })
                            }
                            disabled={anyLoading}
                          />
                        ) : (
                          item.quantity
                        )}
                      </td>
                      <td>
                        {editingItem === item._id ? (
                          <input
                            type="number"
                            step="0.01"
                            className="form-control"
                            name="price"
                            value={formData.price}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                price: e.target.value,
                              })
                            }
                            disabled={anyLoading}
                          />
                        ) : (
                          `₹${parseFloat(item.price).toFixed(2)}`
                        )}
                      </td>
                      <td>{item.unit || "Nos"}</td>
                      <td>
                        {editingItem === item._id ? (
                          <input
                            type="number"
                            step="0.01"
                            className="form-control"
                            name="gstRate"
                            value={formData.gstRate}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                gstRate: e.target.value,
                              })
                            }
                            disabled={anyLoading}
                          />
                        ) : (
                          `${item.gstRate || 0}%`
                        )}
                      </td>
                      {/* <td>
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="item-image"
                            onClick={() => window.open(item.image, "_blank")}
                          />
                        ) : (
                          "-"
                        )}
                      </td> */}
                      <td>
                        {editingItem === item._id ? (
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            name="maxDiscountPercentage"
                            value={formData.maxDiscountPercentage}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                maxDiscountPercentage: e.target.value,
                              })
                            }
                            min="0"
                            max="100"
                            placeholder="Max %"
                            disabled={anyLoading}
                          />
                        ) : item.maxDiscountPercentage > 0 ? (
                          `${item.maxDiscountPercentage}%`
                        ) : (
                          "-"
                        )}
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          {editingItem === item._id ? (
                            <>
                              <button
                                onClick={handleSave}
                                className="btn btn-success btn-sm"
                                disabled={anyLoading}
                              >
                                {isSubmitting ? "Saving..." : "Save"}
                              </button>
                              <button
                                onClick={handleCancel}
                                className="btn btn-secondary btn-sm"
                                disabled={anyLoading}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => toggleDetails(item._id)}
                                className="btn btn-info btn-sm"
                                disabled={anyLoading}
                                title="View"
                              >
                                👁️
                              </button>

                              <button
                                onClick={() => handleEdit(item)}
                                className="btn btn-primary btn-sm"
                                disabled={anyLoading}
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDelete(item._id)}
                                className="btn btn-danger btn-sm"
                                disabled={anyLoading}
                                title="Delete"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {expandedRow === item._id && (
                      <tr>
                        <td colSpan="9" className="expanded-row">
                          <div className="expanded-container">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                              <h6>Item Details</h6>
                              {item.image && (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="image-preview"
                                />
                              )}
                            </div>
                            <div className="row">
                              <div className="col-md-6">
                                <p>
                                  <strong>Name:</strong> {item.name}
                                </p>
                                <p>
                                  <strong>Category:</strong>{" "}
                                  {item.category || "-"}
                                </p>
                                <p>
                                  <strong>Subcategory:</strong>{" "}
                                  {item.subcategory || "-"}
                                </p>
                                <p>
                                  <strong>Quantity:</strong> {item.quantity}
                                  {item.needsRestock && ` (Threshold: ${item.lowStockThreshold},`}
                                </p>
                              </div>
                              <div className="col-md-6">
                                <p>
                                  <strong>Price:</strong> ₹
                                  {item.price.toFixed(2)}
                                </p>
                                <p>
                                  <strong>Unit:</strong> {item.unit || "Nos"}
                                </p>
                                <p>
                                  <strong>GST Rate:</strong> {item.gstRate}%
                                </p>
                                <p>
                                  <strong>HSN Code:</strong>{" "}
                                  {item.hsnCode || "-"}
                                </p>
                                <p>
                                  <strong>Max Discount:</strong>{" "}
                                  {item.maxDiscountPercentage > 0
                                    ? `${item.maxDiscountPercentage}%`
                                    : "N/A"}
                                </p>
                              </div>
                            </div>

                            <div className="d-flex justify-content-between align-items-center mb-3 mt-3">
                              <h6>Purchase History</h6>
                            </div>
                            {purchaseHistory[item._id]?.length > 0 ? (
                              <table className="table table-sm table-striped table-bordered">
                                <thead className="table-secondary">
                                  <tr>
                                    <th>Date</th>
                                    <th>Supplier</th>
                                    <th>GST No</th>
                                    <th>Invoice No</th>
                                    <th>Qty</th>
                                    <th>Price</th>
                                    <th>GST Amt</th>
                                    <th>Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {purchaseHistory[item._id].map(
                                    (purchase, idx) => {
                                      const itemTotal =
                                        purchase.price * purchase.quantity;
                                      const gstAmount =
                                        itemTotal * (purchase.gstRate / 100);
                                      const totalWithGst =
                                        itemTotal + gstAmount;

                                      return (
                                        <tr key={purchase._id || idx}>
                                          <td>
                                            {new Date(
                                              purchase.date
                                            ).toLocaleDateString()}
                                          </td>
                                          <td>{purchase.companyName}</td>
                                          <td>{purchase.gstNumber || "-"}</td>
                                          <td>{purchase.invoiceNumber}</td>
                                          <td>{purchase.quantity}</td>
                                          <td>₹{purchase.price.toFixed(2)}</td>
                                          <td>₹{gstAmount.toFixed(2)}</td>
                                          <td>₹{totalWithGst.toFixed(2)}</td>
                                        </tr>
                                      );
                                    }
                                  )}
                                </tbody>
                              </table>
                            ) : (
                              <div className="alert alert-info">
                                {error
                                  ? `Error loading history: ${error}`
                                  : "No purchase history found"}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="text-center">
                    No items found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => {
              if (page >= 1 && page <= totalPages) setCurrentPage(page);
            }}
          />
        </div>

        {/* Add/Edit Item Modal */}
        {showModal && (
          <div className="modal-backdrop full-screen-modal">
            <div className="modal-content full-screen-content">
              <div className="modal-header">
                <h5 className="modal-title">Add New Item</h5>
                <button
                  type="button"
                  className="close"
                  onClick={() => {
                    setShowModal(false);
                    setFormData({
                      name: "",
                      quantity: "",
                      price: "",
                      gstRate: "0",
                      hsnCode: "",
                      unit: "Nos",
                      category: "",
                      subcategory: "General",
                      maxDiscountPercentage: "",
                    });
                  }}
                >
                  <span>&times;</span>
                </button>
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6">
                    <div className="form-group">
                      <label>Name*</label>
                      <input
                        className="form-control mb-2"
                        placeholder="Name"
                        name="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Quantity</label>
                      <input
                        type="number"
                        className="form-control mb-2"
                        placeholder="Quantity"
                        name="quantity"
                        value={formData.quantity}
                        onChange={(e) =>
                          setFormData({ ...formData, quantity: e.target.value })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>Price*</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control mb-2"
                        placeholder="Price"
                        name="price"
                        value={formData.price}
                        onChange={(e) =>
                          setFormData({ ...formData, price: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>GST Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control mb-2"
                        placeholder="GST Rate"
                        name="gstRate"
                        value={formData.gstRate}
                        onChange={(e) =>
                          setFormData({ ...formData, gstRate: e.target.value })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>HSN Code</label>
                      <input
                        className="form-control mb-2"
                        placeholder="HSN Code"
                        name="hsnCode"
                        value={formData.hsnCode}
                        onChange={(e) =>
                          setFormData({ ...formData, hsnCode: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-group">
                      <label>Unit</label>
                      <select
                        className="form-control mb-2"
                        name="unit"
                        value={formData.unit}
                        onChange={(e) =>
                          setFormData({ ...formData, unit: e.target.value })
                        }
                      >
                        <option value="Nos">Nos</option>
                        <option value="Mtr">Meter</option>
                        <option value="PKT">Packet</option>
                        <option value="Pair">Pair</option>
                        <option value="Set">Set</option>
                        <option value="Bottle">Bottle</option>
                        <option value="KG">Kilogram</option>
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Category</label>
                      <select
                        className="form-control mb-2"
                        name="category"
                        value={formData.category}
                        onChange={(e) =>
                          setFormData({ ...formData, category: e.target.value })
                        }
                      >
                        <option value="">Select Category</option>
                        {Array.isArray(categories) &&
                          categories.map((cat) => (
                            <option key={cat.category} value={cat.category}>
                              {cat.category}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Subcategory</label>
                      <select
                        className="form-control mb-2"
                        name="subcategory"
                        value={formData.subcategory}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            subcategory: e.target.value,
                          })
                        }
                        disabled={!formData.category}
                      >
                        <option value="General">General</option>
                        {formData.category &&
                          Array.isArray(categories) &&
                          categories
                            .find((c) => c.category === formData.category)
                            ?.subcategories.map((subcat) => (
                              <option key={subcat} value={subcat}>
                                {subcat}
                              </option>
                            ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="maxDiscountPercentageModalItemForm">
                        Max Discount (%)
                      </label>
                      <input
                        type="number"
                        className="form-control mb-2"
                        id="maxDiscountPercentageModalItemForm"
                        placeholder="Max Discount % (0-100)"
                        name="maxDiscountPercentage"
                        value={formData.maxDiscountPercentage}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            maxDiscountPercentage: e.target.value,
                          })
                        }
                        min="0"
                        max="100"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setFormData({
                      name: "",
                      quantity: "",
                      price: "",
                      gstRate: "0",
                      hsnCode: "",
                      unit: "Nos",
                      category: "",
                      subcategory: "General",
                      maxDiscountPercentage: "",
                    });
                    setError(null);
                  }}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddItem}
                  className="btn btn-success"
                  disabled={
                    !formData.name ||
                    !formData.price ||
                    !formData.category ||
                    isSubmitting
                  }
                >
                  {isSubmitting ? "Adding..." : "Add New Item"}
                </button>
              </div>
            </div>
          </div>
        )}

        {showPurchaseModal && (
          <div className="modal-backdrop full-screen-modal">
            <div className="modal-content full-screen-content">
              <div className="modal-header">
                <h5 className="modal-title">Purchase Tracking</h5>
                <button
                  type="button"
                  className="close"
                  onClick={() => {
                    setShowPurchaseModal(false);
                    resetPurchaseForm();
                  }}
                >
                  <span>&times;</span>
                </button>
              </div>
              <div className="modal-body">
                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}
                <div className="row">
                  <div className="col-md-6">
                    <div className="form-group">
                      <label>Company Name*</label>
                      <input
                        className="form-control mb-2"
                        placeholder="Company Name"
                        name="companyName"
                        value={purchaseData.companyName}
                        onChange={handlePurchaseChange}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-group">
                      <label>GST Number</label>
                      <input
                        className="form-control mb-2"
                        placeholder="GST Number"
                        name="gstNumber"
                        value={purchaseData.gstNumber}
                        onChange={handlePurchaseChange}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label>Address</label>
                  <input
                    className="form-control mb-2"
                    placeholder="Address"
                    name="address"
                    value={purchaseData.address}
                    onChange={handlePurchaseChange}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="row">
                  <div className="col-md-6">
                    <div className="form-group">
                      <label>State</label>
                      <input
                        className="form-control mb-2"
                        placeholder="State Name"
                        name="stateName"
                        value={purchaseData.stateName}
                        onChange={handlePurchaseChange}
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="form-group">
                      <label>Invoice Number*</label>
                      <input
                        className="form-control mb-2"
                        placeholder="Invoice Number"
                        name="invoiceNumber"
                        value={purchaseData.invoiceNumber}
                        onChange={handlePurchaseChange}
                        required
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>
                <div className="form-group">
                  <label>Invoice Date*</label>
                  <input
                    type="date"
                    className="form-control mb-3"
                    name="date"
                    value={purchaseData.date}
                    onChange={handlePurchaseChange}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <h6>Items Purchased</h6>
                {purchaseData.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="purchase-item-container mb-3 p-3 border rounded"
                  >
                    <div className="position-relative">
                      <label>Search Item</label>
                      <input
                        className="form-control mb-2"
                        placeholder="Search item by name or HSN..."
                        value={idx === currentItemIndex ? itemSearchTerm : ""}
                        onChange={(e) => {
                          setItemSearchTerm(e.target.value);
                          setCurrentItemIndex(idx);
                          setShowItemSearch(true);
                        }}
                        onFocus={() => setCurrentItemIndex(idx)}
                        disabled={isSubmitting}
                      />

                      {filteredItemsList.length > 0 &&
                        currentItemIndex === idx &&
                        showItemSearch && (
                          <div className="suggestions-dropdown">
                            {filteredItemsList.map((suggestion, i) => (
                              <div
                                key={i}
                                className="suggestion-item"
                                onClick={() => {
                                  handleItemChange(
                                    idx,
                                    "description",
                                    suggestion.name
                                  );
                                  handleItemChange(
                                    idx,
                                    "price",
                                    suggestion.price.toString()
                                  );
                                  handleItemChange(
                                    idx,
                                    "gstRate",
                                    suggestion.gstRate.toString()
                                  );
                                  setItemSearchTerm("");
                                  setShowItemSearch(false);
                                }}
                              >
                                <strong>{suggestion.name}</strong>
                                <span className="text-muted">
                                  {" "}
                                  - ₹{suggestion.price.toFixed(2)}
                                </span>
                                <br />
                                <small>
                                  HSN: {suggestion.hsnCode || "N/A"}, GST:{" "}
                                  {suggestion.gstRate || 0}%
                                </small>
                              </div>
                            ))}
                          </div>
                        )}
                    </div>

                    {item.description && (
                      <div className="selected-item-details mb-2 p-2 bg-light border rounded">
                        <strong>{item.description}</strong>
                        {item.price && (
                          <small className="d-block">
                            Price: ₹{item.price}, GST: {item.gstRate || 0}%
                          </small>
                        )}
                      </div>
                    )}

                    <div className="row">
                      <div className="col-md-3">
                        <div className="form-group">
                          <label>Description*</label>
                          <input
                            type="text"
                            className="form-control mb-2"
                            placeholder="Description"
                            value={item.description || ""}
                            onChange={(e) =>
                              handleItemChange(
                                idx,
                                "description",
                                e.target.value
                              )
                            }
                            required
                          />
                        </div>
                      </div>
                      <div className="col-md-2">
                        <div className="form-group">
                          <label>Price*</label>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control mb-2"
                            placeholder="Price"
                            value={item.price || ""}
                            onChange={(e) =>
                              handleItemChange(idx, "price", e.target.value)
                            }
                            required
                          />
                        </div>
                      </div>
                      <div className="col-md-2">
                        <div className="form-group">
                          <label>Quantity*</label>
                          <input
                            type="number"
                            className="form-control mb-2"
                            placeholder="Quantity"
                            value={item.quantity || ""}
                            onChange={(e) =>
                              handleItemChange(idx, "quantity", e.target.value)
                            }
                            required
                          />
                        </div>
                      </div>
                      <div className="col-md-2">
                        <div className="form-group">
                          <label>GST Rate (%)</label>
                          <input
                            type="number"
                            step="0.01"
                            className="form-control mb-2"
                            placeholder="GST Rate"
                            value={item.gstRate || "0"}
                            onChange={(e) =>
                              handleItemChange(idx, "gstRate", e.target.value)
                            }
                          />
                        </div>
                      </div>
                      <div className="col-md-2 d-flex align-items-end">
                        <button
                          onClick={() => removeItem(idx)}
                          className="btn btn-danger btn-block"
                          disabled={purchaseData.items.length === 1}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                <div className="d-flex justify-content-between mb-3">
                  <button
                    onClick={addNewPurchaseItem}
                    className="btn btn-outline-primary"
                  >
                    Add Another Item
                  </button>
                  <div className="total-amount">
                    <strong>
                      Total Amount: ₹{calculateTotalAmount().toFixed(2)}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  onClick={() => {
                    setShowPurchaseModal(false);
                    resetPurchaseForm();
                  }}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={addPurchaseEntry}
                  className="btn btn-success"
                  disabled={!isPurchaseDataValid() || isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Submit Purchase"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
