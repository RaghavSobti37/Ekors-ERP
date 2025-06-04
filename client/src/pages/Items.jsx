import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import apiClient from "../utils/apiClient";
import Navbar from "../components/Navbar.jsx";
import Pagination from "../components/Pagination";
import { saveAs } from "file-saver";
import { getAuthToken } from "../utils/authUtils";
import { showToast, handleApiError } from "../utils/helpers";
import SearchBar from "../components/Searchbar.jsx";
import * as XLSX from "xlsx";
import {
  Eye,
  Trash,
  FileEarmarkArrowDown,
  FileEarmarkArrowUp,
  PlusCircle,
} from "react-bootstrap-icons";
import "../css/Style.css";

// Constants
const DEFAULT_LOW_QUANTITY_THRESHOLD_ITEMS_PAGE = 3;
const LOCAL_STORAGE_LOW_QUANTITY_KEY_ITEMS_PAGE = "globalLowStockThresholdSetting";

// Debug utility
const debug = (message, data = null) => {
  if (process.env.NODE_ENV === "development") {
    console.log(`[DEBUG] ${message}`, data);
  }
};

// Initial form states
const initialFormData = {
  name: "",
  quantity: "",
  sellingPrice: "",
  buyingPrice: "",
  gstRate: "0",
  hsnCode: "",
  unit: "Nos",
  category: "",
  subcategory: "General",
  maxDiscountPercentage: "",
  lowStockThreshold: "5",
};

const initialPurchaseData = {
  companyName: "",
  gstNumber: "",
  address: "",
  stateName: "",
  invoiceNumber: "",
  date: new Date().toISOString().split("T")[0],
  items: [],
};

export default function Items() {
  // State hooks
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [purchaseHistory, setPurchaseHistory] = useState({});
  const [purchaseHistoryLoading, setPurchaseHistoryLoading] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [currentItemIndex, setCurrentItemIndex] = useState(-1);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedSubcategory, setSelectedSubcategory] = useState("All");
  const [purchaseData, setPurchaseData] = useState(initialPurchaseData);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [filteredItemsList, setFilteredItemsList] = useState([]);
  const [showItemSearch, setShowItemSearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [excelUpdateStatus, setExcelUpdateStatus] = useState({
    error: null,
    success: null,
    details: [],
  });
  const [showViewItemModal, setShowViewItemModal] = useState(false);
  const [quantityFilterThreshold, setQuantityFilterThreshold] = useState(null);
  const [effectiveLowStockThreshold, setEffectiveLowStockThreshold] = useState(
    DEFAULT_LOW_QUANTITY_THRESHOLD_ITEMS_PAGE
  );

  const location = useLocation();
  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );
  const stockAlertFilterActive = queryParams.get("filter") === "stock_alerts";
  const lowStockWarningQueryThreshold = parseInt(queryParams.get("lowThreshold"), 10);

  // Helper functions
  const showSuccess = (message) => showToast(message, true);

  // Data fetching
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient("/items");
      setItems(response);
      showSuccess("Items Fetched Successfully");
    } catch (err) {
      setError(handleApiError(err, "Failed to load items. Please try again."));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const categoriesData = await apiClient("/items/categories", { timeout: 5000 });
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
    } catch (err) {
      setError(handleApiError(err, "Failed to load categories."));
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPurchaseHistory = useCallback(async (itemId) => {
    try {
      setPurchaseHistoryLoading((prev) => ({ ...prev, [itemId]: true }));
      setError(null);
      const response = await apiClient(`/items/${itemId}/purchases`, { timeout: 5000 });
      setPurchaseHistory((prev) => ({ ...prev, [itemId]: response || [] }));
    } catch (err) {
      setError(handleApiError(err, "Failed to load history."));
      setPurchaseHistory((prev) => ({ ...prev, [itemId]: [] }));
    } finally {
      setPurchaseHistoryLoading((prev) => ({ ...prev, [itemId]: false }));
    }
  }, []);

  // Effects
  useEffect(() => {
    const storedThreshold = localStorage.getItem(LOCAL_STORAGE_LOW_QUANTITY_KEY_ITEMS_PAGE);
    setEffectiveLowStockThreshold(
      storedThreshold ? parseInt(storedThreshold, 10) : DEFAULT_LOW_QUANTITY_THRESHOLD_ITEMS_PAGE
    );
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
    if (itemSearchTerm.trim() !== "" && Array.isArray(items) && items.length > 0) {
      const filtered = items.filter(
        (item) =>
          item.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
          (item.hsnCode && item.hsnCode.toLowerCase().includes(itemSearchTerm.toLowerCase()))
      );
      setFilteredItemsList(filtered);
    } else {
      setFilteredItemsList([]);
    }
  }, [itemSearchTerm, items]);

  // Handlers
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value.toLowerCase());
    setCurrentPage(1);
  };

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const handleGlobalThresholdChange = (e) => {
    const newThreshold = parseInt(e.target.value, 10) || DEFAULT_LOW_QUANTITY_THRESHOLD_ITEMS_PAGE;
    setEffectiveLowStockThreshold(newThreshold);
    localStorage.setItem(LOCAL_STORAGE_LOW_QUANTITY_KEY_ITEMS_PAGE, newThreshold.toString());
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
          price: item.buyingPrice ? item.buyingPrice.toString() : (item.lastPurchasePrice ? item.lastPurchasePrice.toString() : "0"),
          gstRate: item.gstRate.toString(),
        },
      ],
    });
    setItemSearchTerm("");
    setShowItemSearch(false);
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      quantity: item.quantity?.toString() || "0",
      sellingPrice: item.sellingPrice?.toString() || "0",
      buyingPrice: item.buyingPrice?.toString() || "0",
      gstRate: item.gstRate?.toString() || "0",
      hsnCode: item.hsnCode || "",
      unit: item.unit || "Nos",
      category: item.category || "",
      subcategory: item.subcategory || "General",
      lowStockThreshold: item.lowStockThreshold?.toString() || "5",
      maxDiscountPercentage: item.maxDiscountPercentage?.toString() || "",
    });
    setShowEditItemModal(true);
  };

  const handleSaveEditedItem = async () => {
    if (!editingItem || !formData.name) {
      setError("Item name is required for editing.");
      return;
    }
    try {
      setIsSubmitting(true);
      const updatedItemPayload = { 
        ...formData,
        quantity: parseFloat(formData.quantity) || 0,
        sellingPrice: parseFloat(formData.sellingPrice) || 0,
        buyingPrice: parseFloat(formData.buyingPrice) || 0,
        gstRate: parseFloat(formData.gstRate) || 0,
        lowStockThreshold: parseFloat(formData.lowStockThreshold) || 0,
        maxDiscountPercentage: parseFloat(formData.maxDiscountPercentage) || 0,
      };

      await apiClient(`/items/${editingItem._id}`, {
        method: "PUT",
        body: updatedItemPayload,
      });
      await fetchItems();
      setShowEditItemModal(false);
      setEditingItem(null);
      showSuccess("Item updated successfully!");
    } catch (err) {
      setError(handleApiError(err, "Failed to update item."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...(purchaseData.items || [])];
    updatedItems[index] = {
      ...(updatedItems[index] || {
        description: "",
        quantity: "1",
        price: "",
        gstRate: "0",
      }),
      [field]: value
    };
    setPurchaseData({ ...purchaseData, items: updatedItems });
  };

  const openPurchaseModal = () => {
    setPurchaseData({
      ...initialPurchaseData,
      items: [{ description: "", quantity: "1", price: "", gstRate: "0" }]
    });
    setShowPurchaseModal(true);
  };

  const addNewPurchaseItem = () => {
    setPurchaseData(prev => ({
      ...prev,
      items: [
        ...(prev.items || []),
        { description: "", quantity: "1", price: "", gstRate: "0" }
      ],
    }));
  };

  const removeItem = (index) => {
    const updatedItems = [...purchaseData.items];
    updatedItems.splice(index, 1);
    setPurchaseData({ ...purchaseData, items: updatedItems });
  };

  const calculateItemAmount = (item) => {
    const quantity = parseFloat(item.quantity) || 0;
    const price = parseFloat(item.price) || 0;
    const gstRate = parseFloat(item.gstRate) || 0;
    return quantity * price * (1 + gstRate / 100);
  };

  const calculateTotalAmount = () => {
    if (!purchaseData.items || purchaseData.items.length === 0) return 0;
    return purchaseData.items.reduce((sum, item) => sum + calculateItemAmount(item), 0);
  };

  const isPurchaseDataValid = useCallback(() => {
    if (!purchaseData.companyName || !purchaseData.invoiceNumber || !purchaseData.date) {
      return false;
    }
    return purchaseData.items?.every(item => 
      item.description && parseFloat(item.quantity) > 0 && parseFloat(item.price) >= 0
    );
  }, [purchaseData]);

  const resetPurchaseForm = () => {
    setPurchaseData(initialPurchaseData);
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
      const newItemPayload = {
        name: formData.name,
        quantity: parseFloat(formData.quantity) || 0,
        sellingPrice: parseFloat(formData.sellingPrice) || 0,
        buyingPrice: parseFloat(formData.buyingPrice) || 0,
        gstRate: parseFloat(formData.gstRate) || 0,
        hsnCode: formData.hsnCode || "",
        unit: formData.unit,
        category: formData.category,
        subcategory: formData.subcategory,
        maxDiscountPercentage: parseFloat(formData.maxDiscountPercentage) || 0,
        lowStockThreshold: parseFloat(formData.lowStockThreshold) || 5,
      };

      await apiClient("/items", { method: "POST", body: newItemPayload });
      await fetchItems();
      setShowModal(false);
      setFormData(initialFormData);
      showSuccess("Item added successfully!");
    } catch (err) {
      setError(handleApiError(err, "Failed to add item. Please try again."));
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
    const itemToView = items.find((item) => item._id === id);
    if (itemToView) {
      setEditingItem(itemToView);
      setShowViewItemModal(true);
    }
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        setIsSubmitting(true);
        await apiClient(`/items/${id}`, { method: "DELETE" });
        await fetchItems();
        showSuccess("Item Deleted Successfully");
      } catch (err) {
        setError(handleApiError(err, "Failed to delete item."));
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const addPurchaseEntry = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (!isPurchaseDataValid()) {
        setError("Please fill all required fields and ensure each item has a description, quantity, and price");
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
          itemId: item.itemId || null,
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
      const detailedErrorMessage = `Failed to add purchase entry. ${err.response?.data?.message || err.message}`;
      setError(detailedErrorMessage);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportToExcel = async () => {
    setIsExportingExcel(true);
    setExcelUpdateStatus({ error: null, success: null, details: [] });
    
    if (!window.confirm("This will download an Excel file of the current item list. Continue?")) {
      setIsExportingExcel(false);
      return;
    }
    
    try {
      const response = await apiClient("/items/export-excel", {
        method: "GET",
        rawResponse: true,
      });

      const blob = await response.blob();
      saveAs(blob, "items_export.xlsx");
      setExcelUpdateStatus({
        error: null,
        success: "Items exported to Excel successfully!",
        details: [],
      });
      showSuccess("Items exported to Excel successfully!");
    } catch (err) {
      const displayMessage = `Failed to export items. ${err.status ? `Status: ${err.status}.` : ''} ${err.data?.message || err.message || 'Please try again.'}`;
      setExcelUpdateStatus({ error: displayMessage, success: null, details: [] });
      setError(displayMessage);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleFileSelectedForUploadAndProcess = async (event) => {
    const file = event.target.files[0];
    setExcelUpdateStatus({ error: null, success: null, details: [] });

    if (!file) return;

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
    formData.append("excelFile", file);

    try {
      const response = await apiClient("/items/import-uploaded-excel", {
        method: "POST",
        body: formData,
        isFormData: true,
      });

      let successMessage = `Excel sync complete: ${
        response.itemsCreated || 0
      } created, ${response.itemsUpdated || 0} updated, ${
        response.itemsDeleted || 0
      } deleted.`;

      if (response.parsingErrors?.length > 0) {
        successMessage += ` Encountered ${response.parsingErrors.length} parsing issues.`;
      }
      if (response.databaseProcessingErrors?.length > 0) {
        successMessage += ` Encountered ${response.databaseProcessingErrors.length} database processing errors.`;
      }
      
      setExcelUpdateStatus({
        error: null,
        success: successMessage,
        details: response.databaseProcessingDetails || [],
      });
      showSuccess(successMessage);
      fetchItems();
    } catch (err) {
      const displayMessage = `Failed to update from Excel. ${err.status ? `Status: ${err.status}.` : ''} ${err.data?.message || err.message || 'Please check the file and try again.'}`;
      setExcelUpdateStatus({ error: displayMessage, success: null, details: [] });
      setError(displayMessage);
    } finally {
      setIsProcessingExcel(false);
      event.target.value = null;
    }
  };

  // Computed values
  const itemsToDisplay = useMemo(() => {
    if (!Array.isArray(items)) return [];

    let processedItems = [...items];

    if (stockAlertFilterActive) {
      processedItems = processedItems.filter(
        (item) =>
          item.quantity <= 0 || // Needs restock
          (item.quantity > 0 && item.quantity <= (item.lowStockThreshold || 5)) // Low stock based on item's threshold
      );
    } else {
      processedItems = processedItems.filter((item) => {
        const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
        const matchesSubcategory = selectedSubcategory === "All" || item.subcategory === selectedSubcategory;
        const matchesSearch = 
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.hsnCode && item.hsnCode.toLowerCase().includes(searchTerm.toLowerCase()));
        
        const matchesQuantity = quantityFilterThreshold === null || 
          (Number.isFinite(quantityFilterThreshold) && item.quantity <= quantityFilterThreshold);
        
        return matchesCategory && matchesSubcategory && matchesSearch && matchesQuantity;
      });
    }

    processedItems.sort((a, b) => {
      if (stockAlertFilterActive) {
        // Sort by quantity primarily for stock alerts
        if (a.quantity !== b.quantity) return a.quantity - b.quantity;
      } else {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "asc" ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === "asc" ? 1 : -1;
        }
      }
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
    
    return processedItems;
  }, [
    items,
    stockAlertFilterActive,
    selectedCategory,
    selectedSubcategory,
    searchTerm,
    quantityFilterThreshold,
    sortConfig,
  ]);

  const currentItems = useMemo(() => {
    const indexOfLast = currentPage * itemsPerPage;
    const indexOfFirst = indexOfLast - itemsPerPage;
    return itemsToDisplay.slice(indexOfFirst, indexOfLast);
  }, [itemsToDisplay, currentPage, itemsPerPage]);

  const anyLoading = isSubmitting || isProcessingExcel || isExportingExcel;

  // Render
  return (
    <div className="items-container">
      <Navbar showPurchaseModal={openPurchaseModal} />
      <div className="container mt-4">
        {/* Error and success messages */}
        {error && <div className="alert alert-danger" role="alert">{error}</div>}
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

        {/* Top controls */}
        <div className="top-controls-container">
          <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h2 style={{ color: "black", margin: 0 }} className="me-auto">
              {stockAlertFilterActive ? `Stock Alerts` : "All Items List"}
            </h2>

            <div className="d-flex align-items-center gap-2">
              <SearchBar
                searchTerm={searchTerm}
                setSearchTerm={(value) => {
                  setSearchTerm(value.toLowerCase());
                  setCurrentPage(1);
                }}
                placeholder="Search items or HSN codes..."
                showButton={false}
                className="flex-grow-1"
                disabled={anyLoading || stockAlertFilterActive}
              />
              <button
                onClick={handleExportToExcel}
                className="btn btn-info"
                disabled={anyLoading}
                title="Export to Excel"
              >
                Export Excel
                {isExportingExcel ? (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                ) : (
                  <FileEarmarkArrowDown />
                )}
              </button>
              <button
                onClick={() => document.getElementById("excel-upload-input")?.click()}
                className="btn btn-info"
                disabled={anyLoading}
                title="Upload & Update from Excel"
              >
                Upload Excel
                {isProcessingExcel ? (
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                ) : (
                  <FileEarmarkArrowUp />
                )}
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="btn btn-success d-flex align-items-center"
                disabled={anyLoading}
                title="Add New Item"
                style={{ gap: "0.35rem" }}
              >
                <PlusCircle size={18} />
                Add New Item
              </button>
            </div>
          </div>

          <div className="d-flex align-items-stretch flex-wrap gap-2 mb-3 w-100">
            <div className="flex-fill" style={{ minWidth: "150px" }}>
              <select
                className="form-select w-100"
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setSelectedSubcategory("All");
                  setCurrentPage(1);
                }}
                disabled={anyLoading || stockAlertFilterActive}
              >
                <option value="All">All Categories</option>
                {Array.isArray(categories) &&
                  categories.map((cat) => (
                    <option key={cat.category} value={cat.category}>
                      {cat.category}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex-fill" style={{ minWidth: "150px" }}>
              <select
                className="form-select w-100"
                value={selectedSubcategory}
                onChange={(e) => {
                  setSelectedSubcategory(e.target.value);
                  setCurrentPage(1);
                }}
                disabled={selectedCategory === "All" || anyLoading || stockAlertFilterActive}
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

            <div className="flex-fill" style={{ minWidth: "150px" }}>
              <select
                className="form-select w-100"
                value={quantityFilterThreshold === null ? "All" : quantityFilterThreshold}
                onChange={(e) => {
                  const value = e.target.value;
                  setQuantityFilterThreshold(value === "All" ? null : parseInt(value, 10));
                  setCurrentPage(1);
                }}
                disabled={anyLoading || stockAlertFilterActive}
                title="Filter by quantity"
              >
                <option value="All">All Quantities</option>
                <option value="0">0 (Out of Stock)</option>
                <option value="1">1 and below</option>
                <option value="3">3 and below</option>
                <option value="5">5 and below</option>
                <option value="10">10 and below</option>
                <option value="20">20 and below</option>
              </select>
            </div>
          </div>
        </div>

        {/* Excel upload input (hidden) */}
        <input
          type="file"
          id="excel-upload-input"
          style={{ display: "none" }}
          accept=".xlsx, .xls"
          onChange={handleFileSelectedForUploadAndProcess}
          disabled={anyLoading}
        />

        {/* Main table */}
        <div className="table-responsive">
          <table className="table table-striped table-bordered">
            <thead className="table-dark">
              <tr>
                {["name", "quantity", "sellingPrice", "buyingPrice", "unit", "gstRate"].map((key) => (
                  <th
                    key={key}
                    onClick={() => !anyLoading && requestSort(key)}
                    style={{ cursor: anyLoading ? "not-allowed" : "pointer" }}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, " $1")}
                    {sortConfig.key === key && (sortConfig.direction === "asc" ? " ↑" : " ↓")}
                  </th>
                ))}
                <th
                  onClick={() => !anyLoading && requestSort("maxDiscountPercentage")}
                  style={{ cursor: anyLoading ? "not-allowed" : "pointer" }}
                >
                  Max Disc. %
                  {sortConfig.key === "maxDiscountPercentage" && (sortConfig.direction === "asc" ? " ↑" : " ↓")}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? (
                currentItems.map((item) => (
                  <React.Fragment key={item._id}>
                    <tr>
                      <td>{item.name}</td>
                      <td>
                        {item.quantity}
                        {item.quantity <= 0 ? (
                          <span className="badge bg-danger ms-2"
                            title="Out of stock! Needs immediate restock."
                          >
                            ⚠️ Restock
                          </span>
                        ) : item.quantity > 0 && item.quantity <= (item.lowStockThreshold || 5) ? (
                          <span className="badge bg-warning text-dark ms-2"
                            title={`Stock is low (≤ ${item.lowStockThreshold || 5}). Needs restock.`}
                          >
                            🔥 Low Stock
                          </span>
                        ) : null}
                      </td>
                      <td>{`₹${parseFloat(item.sellingPrice).toFixed(2)}`}</td>
                      <td>{`₹${parseFloat(item.buyingPrice || 0).toFixed(2)}`}</td>
                      <td>{item.unit || "Nos"}</td>
                      <td>{`${item.gstRate || 0}%`}</td>
                      <td>
                        {item.maxDiscountPercentage > 0 ? `${item.maxDiscountPercentage}%` : "-"}
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <button
                            onClick={() => toggleDetails(item._id)}
                            className="btn btn-info btn-sm"
                            disabled={anyLoading}
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(item._id)}
                            className="btn btn-danger btn-sm"
                            disabled={anyLoading}
                            title="Delete Item"
                          >
                            <Trash size={16} />
                          </button>
                          <button
                            onClick={() => handleEditItem(item)}
                            className="btn btn-warning btn-sm"
                            disabled={anyLoading}
                            title="Edit Item"
                          >
                            <Eye size={16} />
                          </button>
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
                                <img src={item.image} alt={item.name} className="image-preview" />
                              )}
                            </div>
                            <table className="table table-sm table-bordered item-details-table">
                              <tbody>
                                {[
                                  ["Name", item.name],
                                  ["Category", item.category || "-"],
                                  ["Subcategory", item.subcategory || "-"],                                  
                                  ["Quantity", (() => {
                                      let qtyText = `${item.quantity}`;
                                      if (item.quantity <= 0) {
                                        qtyText += " (Out of stock! Needs immediate restock.)";
                                      } else if (item.quantity > 0 && item.quantity <= (item.lowStockThreshold || 5)) {
                                        qtyText += ` (Stock is low. Item specific threshold: ${item.lowStockThreshold || 5})`;
                                      }
                                      return qtyText;
                                    })()],
                                  ["Selling Price", `₹${parseFloat(item.sellingPrice).toFixed(2)}`],
                                  ["Buying Price", `₹${parseFloat(item.buyingPrice || 0).toFixed(2)}`],
                                  ["Unit", item.unit || "Nos"],
                                  ["GST Rate", `${item.gstRate}%`],
                                  ["HSN Code", item.hsnCode || "-"],
                                  ["Max Discount", item.maxDiscountPercentage > 0 ? `${item.maxDiscountPercentage}%` : "N/A"],
                                ].map(([label, value], idx) => (
                                  <tr key={idx}>
                                    <td><strong>{label}</strong></td>
                                    <td>{value}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            <div className="d-flex justify-content-between align-items-center mb-3 mt-3">
                              <h6>Purchase History</h6>
                            </div>
                            {purchaseHistory[item._id]?.length > 0 ? (
                              <table className="table table-sm table-striped table-bordered">
                                <thead className="table-secondary">
                                  <tr>
                                    <th>Date</th>
                                    <th>Supplier</th>
                                    <th>Added By</th>
                                    <th>Invoice No</th>
                                    <th>Qty</th>
                                    <th>Price (₹)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {purchaseHistory[item._id].map((purchase, idx) => (
                                    <tr key={purchase._id || idx}>
                                      <td>{new Date(purchase.date).toLocaleDateString()}</td>
                                      <td>{purchase.companyName}</td>
                                      <td>{purchase.createdByName || "N/A"}</td>
                                      <td>{purchase.invoiceNumber}</td>
                                      <td>{purchase.quantity}</td>
                                      <td>₹{purchase.price.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div className="alert alert-info">
                                {error ? `Error loading history: ${error}` : "No purchase history found"}
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
          
          {itemsToDisplay.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={itemsToDisplay.length}
              itemsPerPage={itemsPerPage}
              onPageChange={(page) => {
                const totalPages = Math.ceil(itemsToDisplay.length / itemsPerPage);
                if (page >= 1 && page <= totalPages) setCurrentPage(page);
              }}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          )}
        </div>

        {/* Modals */}
        {showModal && (
          <Modal
            title="Add New Item"
            onClose={() => {
              setShowModal(false);
              setFormData(initialFormData);
            }}
            onSubmit={handleAddItem}
            submitText={isSubmitting ? "Adding..." : "Add New Item"}
            submitDisabled={
              !formData.name || !formData.sellingPrice || !formData.category || isSubmitting
            }
          >
            <ItemForm 
              formData={formData} 
              setFormData={setFormData} 
              categories={categories} 
            />
          </Modal>
        )}

        {showViewItemModal && editingItem && (
          <Modal
            title={`View Item: ${editingItem.name}`}
            onClose={() => {
              setShowViewItemModal(false);
              setEditingItem(null);
            }}
            submitText="Close"
            submitOnly
          >
            <ItemViewDetails 
              item={editingItem} 
              purchaseHistory={purchaseHistory} 
              purchaseHistoryLoading={purchaseHistoryLoading}
              error={error}
              stockAlertFilterActive={stockAlertFilterActive}
              lowStockWarningQueryThreshold={lowStockWarningQueryThreshold}
              effectiveLowStockThreshold={effectiveLowStockThreshold}
            />
          </Modal>
        )}

        {showEditItemModal && editingItem && (
          <Modal
            title={`Edit Item: ${editingItem.name}`}
            onClose={() => {
              setShowEditItemModal(false); // Close the modal
              setEditingItem(null); // Clear the editing item state
              setError(null); // Clear any previous errors
            }}
            // The content below this line becomes the modal body
          >
                {error && <div className="alert alert-danger">{error}</div>}
                <div className="row">
                  <div className="col-md-6">
                    <div className="form-group">
                      <label>Name*</label>
                      <input
                        className="form-control mb-2"
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
                        name="quantity"
                        value={formData.quantity}
                        onChange={(e) =>
                          setFormData({ ...formData, quantity: e.target.value })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>Selling Price*</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control mb-2"
                        name="sellingPrice"
                        value={formData.sellingPrice}
                        onChange={(e) =>
                          setFormData({ ...formData, sellingPrice: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Buying Price</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control mb-2"
                        name="buyingPrice"
                        value={formData.buyingPrice}
                        onChange={(e) =>
                          setFormData({ ...formData, buyingPrice: e.target.value })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>GST Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control mb-2"
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
                      <label>Max Discount (%)</label>
                      <input
                        type="number"
                        className="form-control mb-2"
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
                     <div className="form-group">
                      <label>Low Stock Threshold</label>
                      <input
                        type="number"
                        className="form-control mb-2"
                        name="lowStockThreshold"
                        value={formData.lowStockThreshold}
                        onChange={(e) =>
                          setFormData({ ...formData, lowStockThreshold: e.target.value })
                        }
                        min="0"
                      />
                    </div>
                  </div>
                </div>
          </Modal>
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
                                    suggestion.buyingPrice ? suggestion.buyingPrice.toString() : (suggestion.lastPurchasePrice ? suggestion.lastPurchasePrice.toString() : "0") // Use buyingPrice or lastPurchasePrice as default for purchase
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
                                  - SP: ₹{suggestion.sellingPrice.toFixed(2)}, BP: ₹{(suggestion.buyingPrice || 0).toFixed(2)}
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
