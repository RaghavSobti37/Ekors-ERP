import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom"; // Import useNavigate
import apiClient from "../utils/apiClient"; // Import apiClient
import "../css/Style.css";
import Navbar from "../components/Navbar.jsx";
import Pagination from "../components/Pagination.jsx"; // Added .jsx
import { saveAs } from "file-saver"; // For downloading files
import { useAuth } from "../context/AuthContext.jsx";

import { showToast, handleApiError } from "../utils/helpers"; // Utility functions for toast and error handling
import SearchBar from "../components/Searchbar.jsx";
import ActionButtons from "../components/ActionButtons.jsx";

import Footer from "../components/Footer";
import {
  Eye, // View
  Trash, // Delete
  FileEarmarkArrowDown, // For Excel Export
  FileEarmarkArrowUp, // For Excel Upload
  PlusCircle, // For Add Item button icon
  ClockHistory, // For Item History
  CheckCircleFill,
  ShieldFillCheck,
  PencilSquare,
} from "react-bootstrap-icons";
import ReusableModal from "../components/ReusableModal.jsx"; // Added Alert, Card, Badge
import { Spinner, Alert, Card, Badge, Button } from "react-bootstrap";
import "../css/Style.css";

const DEFAULT_LOW_QUANTITY_THRESHOLD_ITEMS_PAGE = 5;
const LOCAL_STORAGE_LOW_QUANTITY_KEY_ITEMS_PAGE = "globalLowStockThresholdSetting";

export default function Items() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate(); // Initialize useNavigate

  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [pendingReviewItems, setPendingReviewItems] = useState([]);
  const [totalPendingReviewItems, setTotalPendingReviewItems] = useState(0);

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
    quantity: "0", // in base units
    pricing: {
      baseUnit: "Nos",
      sellingPrice: "",
      buyingPrice: "",
    },
    units: [{ name: 'Nos', isBaseUnit: true, conversionFactor: 1 }],
    gstRate: "0",
    hsnCode: "",
    category: "",
    maxDiscountPercentage: "",
    lowStockThreshold: "5", // Added for consistency with item schema
    image: "",
  });
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false); // Renamed from showModal for clarity
  const [expandedRow, setExpandedRow] = useState(null); // Keep for view details
  const [purchaseHistory, setPurchaseHistory] = useState({}); // This is for the expanded row, not the modal
  const [purchaseHistoryLoading, setPurchaseHistoryLoading] = useState({}); // Track loading state per item for expanded row
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [selectedCategory, setSelectedCategory] = useState("All");

  const [purchaseData, setPurchaseData] = useState({
    companyName: "",
    gstNumber: "",
    address: "",
    stateName: "",
    invoiceNumber: "",
    date: new Date().toISOString().split("T")[0],
    items: [],
  });
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState("");
  const [filteredItemsList, setFilteredItemsList] = useState([]);
  const [showItemSearch, setShowItemSearch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // General submission state (add item, add purchase)
  const [isProcessingExcel, setIsProcessingExcel] = useState(false); // For upload/export
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [excelUpdateStatus, setExcelUpdateStatus] = useState({
    error: null, // For Excel specific errors
    success: null,
    details: [],
  });

  // State for adding new category/subcategory inline
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);

  const location = useLocation();
  const [currentPagePending, setCurrentPagePending] = useState(1); // Pagination for pending items

  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );
  const stockAlertFilterActive = useMemo(
    () => queryParams.get("filter") === "stock_alerts",
    [queryParams]
  );

  const lowStockWarningQueryThreshold = parseInt(
    queryParams.get("lowThreshold"),
    10
  );

  const [effectiveLowStockThreshold, setEffectiveLowStockThreshold] = useState(
    DEFAULT_LOW_QUANTITY_THRESHOLD_ITEMS_PAGE
  );

  // State for the quantity filter input on the main items page
  const [quantityFilterInputValue, setQuantityFilterInputValue] = useState("");
  const [stockAlertsPageFilterThreshold, setStockAlertsPageFilterThreshold] =
    useState("");

  useEffect(() => {
    const storedThreshold = localStorage.getItem(
      LOCAL_STORAGE_LOW_QUANTITY_KEY_ITEMS_PAGE
    );
    setEffectiveLowStockThreshold(
      storedThreshold
        ? parseInt(storedThreshold, 10)
        : DEFAULT_LOW_QUANTITY_THRESHOLD_ITEMS_PAGE
    );
  }, []);

  useEffect(() => {
    if (stockAlertFilterActive) {
      // Initialize with URL param if present, else global default
      const initialThreshold = Number.isFinite(lowStockWarningQueryThreshold)
        ? lowStockWarningQueryThreshold
        : effectiveLowStockThreshold;
      setStockAlertsPageFilterThreshold(initialThreshold.toString());
      setSearchTerm("");
    } else {
      setStockAlertsPageFilterThreshold(""); // Clear when not on stock alerts page
    }
  }, [
    stockAlertFilterActive,
    effectiveLowStockThreshold,
    lowStockWarningQueryThreshold,
  ]);

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const showSuccess = (message) => {
    showToast(message, true);
  };

  const fetchItems = useCallback(
    async (page, limit = itemsPerPage) => {
      try {
        setLoading(true);
        setError(null);
        const params = {
          page,
          limit,
          sortKey: sortConfig.key,
          sortDirection: sortConfig.direction,
          status: "approved",
        };
        if (selectedCategory !== "All") params.category = selectedCategory;
        if (searchTerm) params.searchTerm = searchTerm.toLowerCase();

        if (stockAlertFilterActive) {
          params.filter = "stock_alerts";
          const thresholdToUse = parseInt(stockAlertsPageFilterThreshold, 10);
          params.lowThreshold =
            Number.isFinite(thresholdToUse) && thresholdToUse >= 0
              ? thresholdToUse
              : effectiveLowStockThreshold;
        } else {
          // Apply quantity filter for main page if a value is set
          const qtyFilterVal = parseInt(quantityFilterInputValue, 10);
          if (
            Number.isFinite(qtyFilterVal) &&
            quantityFilterInputValue.trim() !== ""
          ) {
            params.quantityThreshold = qtyFilterVal;
          }
        }

        const response = await apiClient("/items", { params });
        setItems(response.data || []);
        setTotalItems(response.totalItems || 0);
        setError(null);
      } catch (err) {
        const errorMessage = handleApiError(
          err,
          "Failed to load items. Please try again.",
          user
        );
        setError(errorMessage);
        setItems([]);
        setTotalItems(0);
      } finally {
        setLoading(false);
      }
    },
    [
      itemsPerPage,
      sortConfig,
      searchTerm,
      selectedCategory,
      quantityFilterInputValue,
      stockAlertFilterActive,
      effectiveLowStockThreshold,
      user,
      stockAlertsPageFilterThreshold,
    ]
  );

  const fetchPendingReviewItems = useCallback(
    async (page = currentPagePending, limit = itemsPerPage) => {
      if (!user || (user.role !== "admin" && user.role !== "super-admin")) {
        setPendingReviewItems([]);
        setTotalPendingReviewItems(0);
        return;
      }
      try {
        setLoading(true);
        const params = {
          page,
          limit,
          status: "pending_review",
          sortKey: "createdAt",
          sortDirection: "desc",
          populate: "createdBy",
        };
        const response = await apiClient("/items", { params });
        setPendingReviewItems(response.data || []);
        setTotalPendingReviewItems(response.totalItems || 0);
      } catch (err) {
        handleApiError(err, "Failed to load pending review items.", user);
        setPendingReviewItems([]);
        setTotalPendingReviewItems(0);
      } finally {
        setLoading(false);
      }
    },
    [user, itemsPerPage, currentPagePending]
  );

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const categoriesData = await apiClient("/items/categories", {
        timeout: 5000,
      });

      if (Array.isArray(categoriesData)) {
        setCategories(categoriesData);
      } else if (categoriesData === null || categoriesData === undefined) {
        setCategories([]);
      } else {
        throw new Error(
          `Expected an array of categories, but received type: ${typeof categoriesData}`
        );
      }
    } catch (err) {
      const errorMessage = handleApiError(
        err,
        "Failed to load categories.",
        user
      );
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [user]); // Added user dependency

  useEffect(() => {
    fetchPendingReviewItems();
    fetchCategories();
    return () => {
      setPendingReviewItems([]);
      setCategories([]);
    };
  }, [fetchPendingReviewItems, fetchCategories]);


  // Effect for search, category, quantity filter, and sort changes
  useEffect(() => {
    const timerId = setTimeout(() => {
      if (!authLoading && user) {
        // Use `user` from useAuth() and ensure authLoading is checked
        fetchItems(1, itemsPerPage); // Reset to page 1 on any filter/search/sort change
      }
    }, 500); return () => clearTimeout(timerId);
  }, [
    authLoading,
    user,
    searchTerm,
    selectedCategory,
    quantityFilterInputValue,
    stockAlertFilterActive,
    stockAlertsPageFilterThreshold,
    sortConfig.key,
    sortConfig.direction,
    fetchItems,
  ]);

  // Effect for pagination changes (when filters/search/sort are stable)
  useEffect(() => {
    if (!authLoading && user) {
      // Ensure authLoading and user (from useAuth) are used
      fetchItems(currentPage, itemsPerPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, currentPage, itemsPerPage]);

  // This useEffect is specifically for the itemSearchTerm used in the purchase modal,
  // it should remain as is if that's its sole purpose.
  useEffect(() => {
    if (itemSearchTerm.trim() !== "") {
      if (Array.isArray(items) && items.length > 0) {
        // Should this be a different list of items for the modal?
        const filtered = items.filter(
          (item) =>
            item.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
            (item.hsnCode &&
              item.hsnCode.toLowerCase().includes(itemSearchTerm.toLowerCase()))
        );
        setFilteredItemsList(filtered);
      } else {
        setFilteredItemsList([]);
      }
    } else {
      setFilteredItemsList([]);
    }
  }, [itemSearchTerm, items]); // `items` dependency here might be problematic if it's the main page's items list.

  const fetchPurchaseHistoryForExpandedRow = useCallback(
    async (itemId) => {
      // Renamed for clarity
      try {
        setPurchaseHistoryLoading((prev) => ({ ...prev, [itemId]: true }));
        setError(null);

        const response = await apiClient(`/items/${itemId}/purchases`, {
          timeout: 5000,
        });

        setPurchaseHistory((prev) => ({
          ...prev,
          [itemId]: response || [],
        }));
        setError(null);
      } catch (err) {
        handleApiError(err, "Failed to load history.", user);
        console.error("Fetch purchase history error:", err);
        setPurchaseHistory((prev) => ({
          ...prev,
          [itemId]: [],
        }));
      } finally {
        setPurchaseHistoryLoading((prev) => ({ ...prev, [itemId]: false }));
      }
    },
    [user]
  );

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
    setCurrentPage(1);
  };

  const handleEditItem = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      quantity: item.quantity?.toFixed(2) || "0.00", // This is quantity in base unit
      pricing: {
        baseUnit: item.pricing?.baseUnit || 'Nos',
        sellingPrice: item.pricing?.sellingPrice?.toString() || '0',
        buyingPrice: item.pricing?.buyingPrice?.toString() || '0',
      },
      units: item.units?.length > 0 ? item.units : [{ name: 'Nos', isBaseUnit: true, conversionFactor: 1 }],
      gstRate: item.gstRate?.toString() || "0",
      hsnCode: item.hsnCode || "",
      category: item.category || "",
      lowStockThreshold: item.lowStockThreshold?.toString() || "5",
      maxDiscountPercentage: item.maxDiscountPercentage?.toString() || "",
      image: item.image || "", // Load existing image
    });
    setShowEditItemModal(true);
  };

  const handleSaveEditedItem = async () => {
    if (!editingItem || !formData.name) {
      setError("Item name is required.");
      return;
    }
    const sellingPrice = parseFloat(formData.pricing.sellingPrice) || 0;
    const buyingPrice = parseFloat(formData.pricing.buyingPrice) || 0;
    if (buyingPrice > sellingPrice) {
      setError("Buying price cannot be greater than selling price.");
      return;
    }
    if (!formData.pricing.baseUnit || !formData.units.some(u => u.isBaseUnit)) {
      setError("A base unit must be selected.");
      return;
    }
    try {
      setIsSubmitting(true);
      const updatedItemPayload = { ...formData }; // formData has string values from form

      // Ensure numeric fields that should be numbers are parsed
      updatedItemPayload.quantity = parseFloat(formData.quantity) || 0;
      updatedItemPayload.pricing.sellingPrice = sellingPrice;
      updatedItemPayload.pricing.buyingPrice = buyingPrice;
      updatedItemPayload.gstRate = parseFloat(formData.gstRate) || 0;
      updatedItemPayload.maxDiscountPercentage =
        parseFloat(formData.maxDiscountPercentage) || 0;
      // lowStockThreshold will be sent as a string from formData, backend will parse robustly

      if (formData.image !== undefined) {
        updatedItemPayload.image = formData.image;
      }

      await apiClient(`/items/${editingItem._id}`, {
        method: "PUT",
        body: updatedItemPayload,
      });
      await fetchItems();
      setShowEditItemModal(false);
      setEditingItem(null);
      showSuccess("Item updated successfully!");
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to update item.", user);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveItem = async (itemId) => {
    if (!window.confirm("Are you sure you want to approve this item?")) return;
    setIsSubmitting(true);
    try {
      await apiClient(`/items/${itemId}/approve`, { method: "PATCH" });
      showSuccess("Item approved successfully!");
      await fetchItems();
      await fetchPendingReviewItems();
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to approve item.", user);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewAndEditItem = (item) => {
    handleEditItem(item);
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
    const sellingPrice = parseFloat(formData.pricing.sellingPrice) || 0;
    const buyingPrice = parseFloat(formData.pricing.buyingPrice) || 0;
    if (buyingPrice > sellingPrice) {
      setError("Buying price cannot be greater than selling price.");
      return;
    }
    if (!formData.pricing.baseUnit || !formData.units.some(u => u.isBaseUnit)) {
      setError("A base unit must be selected.");
      return;
    }
    try {
      setIsSubmitting(true);
      const newItemPayload = {
        name: formData.name,
        quantity: parseFloat(formData.quantity) || 0,
        pricing: {
          ...formData.pricing,
          sellingPrice: sellingPrice,
          buyingPrice: buyingPrice,
        },
        units: formData.units,
        gstRate: parseFloat(formData.gstRate) || 0,
        hsnCode: formData.hsnCode || "",
        category: formData.category,
        maxDiscountPercentage: parseFloat(formData.maxDiscountPercentage) || 0,
        lowStockThreshold: parseFloat(formData.lowStockThreshold) || 5,
        image: formData.image || "",
      };
      await apiClient("/items", { method: "POST", body: newItemPayload });
      await fetchItems();
      setShowAddItemModal(false);
      setFormData({
        name: "", // Reset to empty string for new item
        quantity: "0.00", // Reset to 0.00 for new item
        pricing: { baseUnit: 'Nos', sellingPrice: '', buyingPrice: '' },
        units: [{ name: 'Nos', isBaseUnit: true, conversionFactor: 1 }],
        gstRate: "0",
        hsnCode: "",
        category: "",
        maxDiscountPercentage: "",
        lowStockThreshold: "5",
      });
      setError(null);
      showSuccess("Item added successfully!");
    } catch (err) {
      const errorMessage = handleApiError(
        err,
        "Failed to add item. Please try again.",
        user
      );
      setError(errorMessage);
      console.error("Error adding item:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      setIsSubmitting(true);
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, image: reader.result }));
        setIsSubmitting(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePurchaseChange = (e) => {
    setPurchaseData({ ...purchaseData, [e.target.name]: e.target.value });
  };

  const toggleExpandedRow = async (id) => {
    if (expandedRow !== id) {
      await fetchPurchaseHistoryForExpandedRow(id); // Use renamed function
    }
    setExpandedRow(expandedRow === id ? null : id);
  };

  // Navigate to the new Item History Page
  const handleShowItemHistoryPage = (item) => {
    navigate(`/items/history/${item._id}`);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        setIsSubmitting(true);
        await apiClient(`/items/${id}`, { method: "DELETE" });
        await fetchItems();
        await fetchPendingReviewItems();
        showSuccess("Item Deleted Successfully");
      } catch (err) {
        const errorMessage = handleApiError(
          err,
          "Failed to delete item.",
          user
        );
        setError(errorMessage);
        console.error("Error deleting item:", err);
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
        setError(
          "Please fill all required fields and ensure each item has a description, quantity, and price"
        );
        setIsSubmitting(false);
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
      console.error("Error adding purchase entry:", err);
      let detailedErrorMessage = "Failed to add purchase entry.";
      if (err.response && err.response.data) {
        detailedErrorMessage += ` ${err.response.data.message || ""}`;
        if (err.response.data.errors) {
          const validationErrors = Object.values(err.response.data.errors)
            .map((e) => e.message)
            .join("; ");
          detailedErrorMessage += ` Details: ${validationErrors}`;
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

  const addNewPurchaseItem = () => {
    setPurchaseData((prevData) => ({
      ...prevData,
      items: [
        ...(prevData.items || []),
        {
          itemId: null,
          description: "",
          quantity: "1",
          price: "",
          gstRate: "0",
        },
      ],
    }));
  };

  const handleExportToExcel = async () => {
    setIsExportingExcel(true);
    setExcelUpdateStatus({ error: null, success: null, details: [] });
    if (
      !window.confirm(
        "This will download an Excel file of the current item list. Continue?"
      )
    ) {
      setIsExportingExcel(false);
      return;
    }
    try {
      const blob = await apiClient("items/export-excel", {
        method: "GET",
        responseType: "blob",
      });

      if (!blob) {
        throw new Error("Failed to export Excel: No data received.");
      }

      saveAs(blob, "items_export.xlsx");
      setExcelUpdateStatus({
        error: null,
        success: "Items exported to Excel successfully!",
        details: [],
      });
      showSuccess("Items exported to Excel successfully!");
    } catch (err) {
      console.error("Error exporting to Excel:", err);
      const message =
        err.data?.message || err.message || "Failed to export items to Excel.";
      setExcelUpdateStatus({ error: message, success: null, details: [] });
      setError(message);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleFileSelectedForUploadAndProcess = async (event) => {
    const file = event.target.files[0];
    setExcelUpdateStatus({ error: null, success: null, details: [] });
    if (!file) return;

    if (
      !window.confirm(
        "WARNING: This will synchronize the database with the selected Excel file.\n\n" +
        "- Items in Excel will be CREATED or UPDATED in the database.\n" +
        "- Items in the database BUT NOT IN THIS EXCEL FILE will be DELETED.\n\n" +
        "Are you absolutely sure you want to proceed?"
      )
    ) {
      event.target.value = null;
      return;
    }
    setIsProcessingExcel(true);
    const formData = new FormData();
    formData.append("excelFile", file);
    try {
      const responseData = await apiClient("items/import-uploaded-excel", {
        method: "POST",
        body: formData,
      });

      let successMessage = `Excel sync complete: ${responseData.itemsCreated || 0
        } created, ${responseData.itemsUpdated || 0} updated, ${responseData.itemsDeleted || 0
        } deleted.`;

      if (responseData.parsingErrors && responseData.parsingErrors.length > 0) {
        successMessage += ` Encountered ${responseData.parsingErrors.length} parsing issues. Check console for details.`;
        console.warn("Excel Parsing Issues:", responseData.parsingErrors);
      }
      if (
        responseData.databaseProcessingErrors &&
        responseData.databaseProcessingErrors.length > 0
      ) {
        successMessage += ` Encountered ${responseData.databaseProcessingErrors.length} database processing errors. Check console for details.`;
        console.warn(
          "Database Processing Errors:",
          responseData.databaseProcessingErrors
        );
      }
      setExcelUpdateStatus({
        error: null,
        success: successMessage,
        details: responseData.databaseProcessingDetails || [],
      });
      showSuccess(successMessage);
      fetchItems();
    } catch (err) {
      console.error("Error updating from Excel:", err);
      const message =
        err.data?.message ||
        err.message ||
        "Failed to update items from Excel.";
      setExcelUpdateStatus({ error: message, success: null, details: [] });
      setError(message);
    } finally {
      setIsProcessingExcel(false);
      event.target.value = null;
    }
  };

  const handleAddNewCategory = async () => {
    if (!newCategoryName.trim()) {
      showToast("Category name cannot be empty.", false);
      return;
    }
    setIsSubmittingCategory(true);
    try {
      await apiClient("/items/categories", {
        method: "POST",
        body: { categoryName: newCategoryName.trim() },
      });
      await fetchCategories();
      setFormData((prevFormData) => ({
        ...prevFormData,
        category: newCategoryName.trim(),
      }));
      setIsAddingNewCategory(false);
      setNewCategoryName("");
      showToast(
        `Category "${newCategoryName.trim()}" added successfully.`,
        true
      );
    } catch (err) {
      handleApiError(err, "Failed to add new category.", user);
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const handleUpdateGlobalLowStockThreshold = (newThresholdValue) => {
    const newNumThreshold = parseInt(newThresholdValue, 10);
    if (Number.isFinite(newNumThreshold) && newNumThreshold >= 0) {
      setEffectiveLowStockThreshold(newNumThreshold);
      localStorage.setItem(
        LOCAL_STORAGE_LOW_QUANTITY_KEY_ITEMS_PAGE,
        newNumThreshold.toString()
      );
      showToast(
        `Global low stock threshold updated to ${newNumThreshold}.`,
        true
      );
    } else {
      showToast("Invalid threshold value.", false);
    }
  };

  const applyStockAlertFilter = () => {
    setCurrentPage(1);
    fetchItems();
  };

  const anyLoading =
    isSubmitting ||
    isProcessingExcel ||
    isExportingExcel ||
    loading

  return (
    <div className="items-container">
      <Navbar showPurchaseModal={openPurchaseModal} />
      <div className="container mt-4">
        {error &&
          !showAddItemModal &&
          !showEditItemModal &&
          !showPurchaseModal && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
        {excelUpdateStatus.error && (
          <div className="alert alert-danger" role="alert">
            Excel Update Error: {excelUpdateStatus.error}
          </div>
        )}

        {user &&
          (user.role === "admin" || user.role === "super-admin") &&
          totalPendingReviewItems > 0 && (
            <Card className="mb-4 border-warning">
              <Card.Header className="bg-warning text-dark">
                <ShieldFillCheck size={20} className="me-2" /> Items Pending
                Review ({pendingReviewItems.length})
              </Card.Header>
              <Card.Body>
                <div className="table-responsive">
                  <table className="table table-sm table-hover">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Created By</th>
                        <th>Created At</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingReviewItems.map((item) => (
                        <tr key={item._id}>
                          <td>{item.name}</td>
                          <td>{item.category}</td>
                          <td>
                            {item.createdBy?.firstname || "N/A"}{" "}
                            {item.createdBy?.lastname || ""}
                          </td>
                          <td>
                            {new Date(item.createdAt).toLocaleDateString()}
                          </td>
                          <td>
                            <Button
                              variant="success"
                              size="sm"
                              className="me-1"
                              onClick={() => handleApproveItem(item._id)}
                              disabled={isSubmitting}
                              title="Approve Item"
                            >
                              <CheckCircleFill /> Approve
                            </Button>
                            <Button
                              variant="info"
                              size="sm"
                              className="me-1"
                              onClick={() => handleReviewAndEditItem(item)}
                              disabled={isSubmitting}
                              title="Review and Edit Item"
                            >
                              <PencilSquare /> Edit
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleDelete(item._id)}
                              disabled={isSubmitting}
                              title="Delete Item"
                            >
                              <Trash /> Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card.Body>
              <Card.Footer className="text-muted small">
                These items were created by users and require your approval
                before being widely available or used in reports. Approving an
                item will make it part of the main item list. Editing an item
                will also automatically approve it.
              </Card.Footer>
              {totalPendingReviewItems > itemsPerPage && (
                <Pagination
                  currentPage={currentPagePending}
                  totalItems={totalPendingReviewItems}
                  itemsPerPage={itemsPerPage}
                  onPageChange={(page) => setCurrentPagePending(page)}
                />
              )}
            </Card>
          )}

        <div className="mb-3">
          {/* Controls Area - Single Line */}
          <div className="d-flex align-items-center justify-content-between mb-3" style={{ width: "100%", minWidth: "100%" }}>
            {/* Left side - Title */}
            <div style={{ flexShrink: 0, minWidth: "200px" }}>
              <h2 style={{ color: "black", margin: 0, whiteSpace: "nowrap" }}>
                {stockAlertFilterActive
                  ? `Stock Alerts (Qty < ${parseInt(stockAlertsPageFilterThreshold, 10) || effectiveLowStockThreshold})`
                  : user && (user.role === "admin" || user.role === "super-admin")
                    ? "Items List (Approved)"
                    : "All Items List"}
              </h2>
            </div>

            {/* Middle - Search Bar with constrained growth */}
            <div style={{
              flexGrow: 1,
              flexShrink: 1,
              minWidth: "200px",
              maxWidth: "400px",
              margin: "0 10px"
            }}>
              <SearchBar
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                placeholder={
                  stockAlertFilterActive
                    ? "Search alerts..."
                    : "Search items/HSN..."
                }
                showButton={false}
                disabled={anyLoading}
              />
            </div>

            {/* Right side - Controls with fixed width */}
            <div style={{
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              whiteSpace: "nowrap"
            }}>
              {stockAlertFilterActive ? (
                <>
                  <label htmlFor="stockAlertThresholdInput" className="mb-0 me-1">
                    Alert Qty &lt;
                  </label>
                  <input
                    type="number"
                    id="stockAlertThresholdInput"
                    className="form-control form-control-sm"
                    value={stockAlertsPageFilterThreshold}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || parseInt(val, 10) >= 0) {
                        setStockAlertsPageFilterThreshold(val);
                      } else if (parseInt(val, 10) < 0) {
                        setStockAlertsPageFilterThreshold("0");
                      }
                    }}
                    onBlur={applyStockAlertFilter}
                    onKeyPress={(e) => e.key === "Enter" && applyStockAlertFilter()}
                    style={{ width: "70px" }}
                    min="0"
                    disabled={anyLoading}
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={applyStockAlertFilter}
                    disabled={anyLoading}
                  >
                    Apply
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-secondary"
                    onClick={() => handleUpdateGlobalLowStockThreshold(stockAlertsPageFilterThreshold)}
                    disabled={anyLoading}
                    title="Set as global default"
                  >
                    Set Default
                  </Button>
                </>
              ) : (
                <>
                  <select
                    className="form-select form-select-sm"
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setCurrentPage(1);
                    }}
                    disabled={anyLoading}
                    style={{ width: "130px" }}
                  >
                    <option value="All">All Categories</option>
                    {Array.isArray(categories) &&
                      categories.map((cat) => (
                        <option key={cat.category} value={cat.category}>
                          {cat.category}
                        </option>
                      ))}
                  </select>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    placeholder="Qty ≤"
                    value={quantityFilterInputValue}
                    onChange={(e) => setQuantityFilterInputValue(e.target.value)}
                    style={{ width: "70px" }}
                    min="0"
                    disabled={anyLoading}
                  />
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => setShowAddItemModal(true)}
                    disabled={anyLoading}
                    title="Add New Item"
                    className="d-flex align-items-center"
                    style={{ gap: "0.25rem" }}
                  >
                    <PlusCircle size={16} /> Add Item
                  </Button>
                  {user && (user.role === "admin" || user.role === "super-admin") && (<></>)}
                </>
              )}
            </div>
          </div>
          {excelUpdateStatus.success && !stockAlertFilterActive && (
            <Alert variant="success" className="mt-2 py-1 px-2 small">
              {excelUpdateStatus.success}
            </Alert>
          )}
        </div>

        <input
          type="file"
          id="excel-upload-input"
          style={{ display: "none" }}
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
                  "quantity",
                  "sellingPrice",
                  "buyingPrice",
                  "unit",
                  "gstRate",
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
                  Disc. %
                  {sortConfig.key === "maxDiscountPercentage" &&
                    (sortConfig.direction === "asc" ? " ↑" : " ↓")}
                </th>
                <th>Image</th>

                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? (
                items.map((item) => (
                  <React.Fragment key={item._id}>
                    <tr>
                      <td>{item.name}</td> {/* Item Name */}
                      <td>
                        <> {parseFloat(item.quantity || 0).toFixed(2)} {item.pricing?.baseUnit || ''}{" "}
                          {item.quantity <= 0 ? (
                            <span
                              className="badge bg-danger ms-2"
                              title={`Out of Stock (Qty: ${item.quantity}). Needs immediate restock.`}
                            >
                              ⚠️ Restock
                            </span>
                          ) : item.quantity > 0 &&
                            item.quantity <= item.lowStockThreshold ? (
                            <span
                              className="badge bg-warning text-dark ms-2"
                              title={`Low Stock (Qty: ${item.quantity}). Item's threshold: ${item.lowStockThreshold}.`}
                            >
                              🔥 Low Stock
                            </span>
                          ) : null}
                        </>
                      </td>
                      <td>{`₹${parseFloat(item.pricing?.sellingPrice || 0).toFixed(2)}`}</td> {/* Selling Price */}
                      <td>{`₹${parseFloat(item.pricing?.buyingPrice || 0).toFixed(2)}`}</td> {/* Buying Price */}
                      <td>{item.pricing?.baseUnit || "N/A"}</td>
                      <td>{`${item.gstRate || 0}%`}</td>
                      <td>
                        {item.maxDiscountPercentage > 0
                          ? `${item.maxDiscountPercentage}%`
                          : "-"}
                      </td>
                      <td className="text-center">
                        {item.image ? (
                          <a
                            href={item.image}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={item.image}
                              alt={item.name}
                              style={{
                                width: "50px",
                                height: "50px",
                                objectFit: "cover",
                                borderRadius: "4px",
                                cursor: "pointer",
                              }}
                            />
                          </a>
                        ) : (
                          <span className="text-muted small">No Image</span>
                        )}
                      </td>

                      <td>
                        <div className="d-flex gap-1 justify-content-center">
                          <ActionButtons
                            item={item}
                            onView={(currentItem) =>
                              toggleExpandedRow(currentItem._id)
                            }
                            onEdit={handleEditItem}
                            onDelete={(currentItem) =>
                              handleDelete(currentItem._id)
                            }
                            isLoading={anyLoading}
                            size="sm"
                          />
                          <button
                            onClick={() => handleShowItemHistoryPage(item)} // Changed to navigate to page
                            className="btn btn-secondary btn-sm"
                            disabled={anyLoading}
                            title="View Item History"
                          >
                            <ClockHistory />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRow === item._id && (
                      <tr>
                        <td
                          colSpan="9
                        "
                          className="expanded-row"
                        >
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
                            <table className="table table-sm table-bordered item-details-table">
                              <tbody>
                                <tr>
                                  <td>
                                    <strong>Name</strong>
                                  </td>
                                  <td>{item.name}</td>
                                </tr>
                                <tr>
                                  <td>
                                    <strong>Category</strong>
                                  </td>
                                  <td>{item.category || "-"}</td>
                                </tr>
                                <tr></tr>
                                <tr>
                                  <td>
                                    <strong>Quantity</strong>
                                  </td>
                                  <td>
                                    {parseFloat(item.quantity || 0).toFixed(2)}

                                    {item.quantity <= 0 || item.needsRestock
                                      ? item.quantity <= 0
                                        ? " (Out of stock! Needs immediate restock.)"
                                        : ` (Below item's restock threshold: ${item.lowStockThreshold || "Not Set"
                                        })`
                                      : item.quantity > 0 &&
                                      item.quantity <=
                                      item.lowStockThreshold &&
                                      ` (Low stock based on item's threshold: ${item.lowStockThreshold})`}
                                  </td>
                                </tr>
                                <tr>
                                  <td>
                                    <strong>Selling Price</strong>
                                  </td>
                                  <td> {`₹${parseFloat(item.pricing?.sellingPrice || 0).toFixed(2)} per ${item.pricing?.baseUnit || ''}`}
                                  </td>
                                </tr>
                                <tr>
                                  <td>
                                    <strong>Buying Price</strong>
                                  </td>
                                  <td> {`₹${parseFloat(item.pricing?.buyingPrice || 0).toFixed(2)} per ${item.pricing?.baseUnit || ''}`}
                                  </td>
                                </tr>
                                <tr>
                                  <td>
                                    <strong>Unit</strong>
                                  </td>
                                  <td>{item.pricing?.baseUnit || "N/A"}</td>
                                  <td>{item.units?.map(u => `${u.name} (${u.conversionFactor} to ${item.pricing?.baseUnit})`).join('; ') || 'N/A'}</td>
                                </tr>
                                <tr>
                                  <td>
                                    <strong>GST Rate</strong>
                                  </td>
                                  <td>{item.gstRate}%</td>
                                </tr>
                                <tr>
                                  <td>
                                    <strong>HSN Code</strong>
                                  </td>
                                  <td>{item.hsnCode || "-"}</td>
                                </tr>
                                <tr>
                                  <td>
                                    <strong>Max Discount</strong>
                                  </td>
                                  <td>
                                    {item.maxDiscountPercentage > 0
                                      ? `${item.maxDiscountPercentage}%`
                                      : "N/A"}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                            <div className="d-flex justify-content-between align-items-center mb-3 mt-3">
                              <h6>Purchase History (Expanded Row)</h6>
                            </div>
                            {purchaseHistoryLoading[item._id] ? (
                              <div className="text-center">
                                <Spinner animation="border" size="sm" /> Loading
                                history...
                              </div>
                            ) : purchaseHistory[item._id]?.length > 0 ? (
                              <table className="table table-sm table-striped table-bordered">
                                <thead className="table-secondary">
                                  <tr>
                                    <th>Date</th>
                                    <th>Supplier</th>
                                    <th>Added By</th>
                                    <th>Invoice No</th> {/* Invoice Number */}
                                    <th>Qty</th>
                                    <th>Price (₹)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {purchaseHistory[item._id].map(
                                    (purchase, idx) => (
                                      <tr key={purchase._id || idx}>
                                        <td>
                                          {new Date(
                                            purchase.date
                                          ).toLocaleDateString()}
                                        </td>
                                        <td>{purchase.companyName}</td>
                                        <td>
                                          {purchase.createdByName || "N/A"}
                                        </td>
                                        <td>{purchase.invoiceNumber}</td> {/* Invoice Number */}
                                        <td>{purchase.quantity}</td>
                                        <td>₹{purchase.price.toFixed(2)}</td>
                                      </tr>
                                    )
                                  )}
                                </tbody>
                              </table>
                            ) : (
                              <div className="alert alert-info">
                                {error && expandedRow === item._id
                                  ? `Error loading history: ${error}`
                                  : "No purchase history found for this item."}
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
                  <td colSpan="8" className="text-center">
                    No items found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {totalItems > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={totalItems}
              itemsPerPage={itemsPerPage}
              onPageChange={(page) => {
                const totalPages = Math.ceil(totalItems / itemsPerPage);
                if (page >= 1 && page <= totalPages) {
                  setCurrentPage(page);
                }
              }}
              onItemsPerPageChange={handleItemsPerPageChange}
              // Pass export/import handlers
              onExportExcel={
                !stockAlertFilterActive ? handleExportToExcel : undefined
              }
              onImportExcel={
                !stockAlertFilterActive
                  ? () => document.getElementById("excel-upload-input")?.click()
                  : undefined
              }
              isExporting={isExportingExcel}
              isImporting={isProcessingExcel}
            />
          )}
        </div>

        {showAddItemModal && (
          <ReusableModal
            show={showAddItemModal}
            onHide={() => {
              setShowAddItemModal(false);
              setFormData({
                name: "", // Reset to empty string for new item
                quantity: "0.00", // Reset to 0.00 for new item
                pricing: {
                  baseUnit: "Nos",
                  sellingPrice: "",
                  buyingPrice: "",
                },
                units: [{ name: 'Nos', isBaseUnit: true, conversionFactor: 1 }],
                image: "",
                gstRate: "0",
                hsnCode: "",
                category: "",
                maxDiscountPercentage: "",
                lowStockThreshold: "5", // Default threshold
              });
              setError(null);
            }}
            title="Add New Item"
            footerContent={
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowAddItemModal(false);
                    setFormData({
                      name: "", // Reset to empty string for new item
                      quantity: "0.00", // Reset to 0.00 for new item
                      pricing: { baseUnit: 'Nos', sellingPrice: '', buyingPrice: '' },
                      units: [{ name: 'Nos', isBaseUnit: true, conversionFactor: 1 }],
                      gstRate: "0",
                      hsnCode: "",
                      category: "",
                      maxDiscountPercentage: "",
                      lowStockThreshold: "5",
                      image: "",
                    });
                    setError(null);
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddItem}
                  className="btn btn-success"
                  disabled={
                    !formData.name ||
                    !formData.pricing.sellingPrice ||
                    !formData.category ||
                    isSubmitting ||
                    isAddingNewCategory
                  }
                >
                  {isSubmitting ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                      />{" "}
                      Adding...
                    </>
                  ) : (
                    "Add New Item"
                  )}
                </button>
              </>
            }
            isLoading={isSubmitting}
          >
            <>
              {error && <div className="alert alert-danger">{error}</div>}
              <div className="row">
                <div className="col-md-6">
                  <div className="form-group">
                    <label>
                      Name <span className="text-danger">*</span>
                    </label>
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
                      name="quantity" // Quantity input
                      value={formData.quantity}
                      onChange={(e) => {
     const val = e.target.value;
                        if (val === "" || !isNaN(val)) {
                          if (Number(val) < 0) {
                            setFormData({ ...formData, quantity: "0" });
                          } else {
                            setFormData({ ...formData, quantity: val });
                          }                        }
                      }}
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
                    <label>Category</label>
                    <div className="input-group mb-2">
                      {isAddingNewCategory ? (
                        <>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Enter new category name"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            disabled={isSubmittingCategory}
                          />
                          <button
                            className="btn btn-success"
                            type="button"
                            onClick={handleAddNewCategory}
                            disabled={
                              isSubmittingCategory || !newCategoryName.trim()
                            }
                          >
                            {isSubmittingCategory ? (
                              <Spinner
                                as="span"
                                animation="border"
                                size="sm"
                                role="status"
                                aria-hidden="true"
                              />
                            ) : (
                              "Save"
                            )}
                          </button>
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={() => {
                              setIsAddingNewCategory(false);
                              setNewCategoryName("");
                            }}
                            disabled={isSubmittingCategory}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <select
                            className="form-control"
                            name="category"
                            value={formData.category}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                category: e.target.value,
                              })
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
                          <button
                            className="btn btn-outline-primary"
                            type="button"
                            onClick={() => setIsAddingNewCategory(true)}
                            title="Add new category"
                          >
                            <PlusCircle size={18} />
                          </button>
                        </>
                      )}
                    </div>
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
                  <div className="form-group">
                    <label htmlFor="lowStockThresholdModalItemForm">
                      Low Stock Threshold
                    </label>
                    <input
                      type="number"
                      className="form-control mb-2"
                      id="lowStockThresholdModalItemForm"
                      placeholder="Default: 5"
                      name="lowStockThreshold"
                      value={formData.lowStockThreshold}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          lowStockThreshold: e.target.value,
                        })
                      }
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Image</label>
                    <input
                      type="file"
                      className="form-control mb-2"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                    {formData.image && (
                      <div className="mt-2 text-center">
                        <img
                          src={formData.image}
                          alt="Preview"
                          style={{
                            width: "100px",
                            height: "100px",
                            objectFit: "cover",
                            borderRadius: "4px",
                            border: "1px solid #ddd",
                          }}
                        />
                        <button
                          className="btn btn-sm btn-outline-danger ms-2"
                          onClick={() =>
                            setFormData((prev) => ({ ...prev, image: "" }))
                          }
                          title="Remove Image"
                        >
                          X
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {/* Unit Management Section */}
                <div className="col-12 mt-3 pt-3 border-top">
                  <h5>Pricing & Units</h5>
                  <div className="row">
                    <div className="col-md-6">
                      <label>Buying Price (per Base Unit)</label>
                      <input
                        type="number" step="0.01" className="form-control mb-2"
                        placeholder="Buying Price" name="buyingPrice"
                        value={formData.pricing.buyingPrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, pricing: { ...prev.pricing, buyingPrice: e.target.value } }))}
                      />
                    </div>
                    <div className="col-md-6">
                      <label>Selling Price (per Base Unit) <span className="text-danger">*</span></label>
                      <input
                        type="number" step="0.01" className="form-control mb-2"
                        placeholder="Selling Price" name="sellingPrice"
                        value={formData.pricing.sellingPrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, pricing: { ...prev.pricing, sellingPrice: e.target.value } }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Unit Name</th>
                          <th>Conversion Factor (to Base)</th>
                          <th>Is Base Unit?</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.units.map((unit, index) => (
                          <tr key={index}>
                            <td>
                              <input
                                type="text" className="form-control form-control-sm"
                                value={unit.name}
                                onChange={(e) => {
                                  const newUnits = [...formData.units];
                                  newUnits[index].name = e.target.value;
                                  // If this was the base unit, update the pricing object too
                                  if (unit.isBaseUnit) {
                                    setFormData(prev => ({ ...prev, units: newUnits, pricing: { ...prev.pricing, baseUnit: e.target.value } }));
                                  } else {
                                    setFormData(prev => ({ ...prev, units: newUnits }));
                                  }
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number" step="any" className="form-control form-control-sm"
                                value={unit.conversionFactor}
                                disabled={unit.isBaseUnit}
                                onChange={(e) => {
                                  const newUnits = [...formData.units];
                                  newUnits[index].conversionFactor = parseFloat(e.target.value) || 0;
                                  setFormData(prev => ({ ...prev, units: newUnits }));
                                }}
                              />
                            </td>
                            <td className="text-center align-middle">
                              <input
                                type="radio" className="form-check-input"
                                name="isBaseUnit"
                                checked={unit.isBaseUnit}
                                onChange={() => {
                                  const newUnits = formData.units.map((u, i) => {
                                    const isThisOne = i === index;
                                    return {
                                      ...u,
                                      isBaseUnit: isThisOne,
                                      conversionFactor: isThisOne ? 1 : u.conversionFactor,
                                    };
                                  });
                                  const newBaseUnitName = newUnits[index].name;
                                  setFormData(prev => ({
                                    ...prev,
                                    units: newUnits,
                                    pricing: { ...prev.pricing, baseUnit: newBaseUnitName }
                                  }));
                                }}
                              />
                            </td>
                            <td>
                              <Button
                                variant="danger" size="sm"
                                onClick={() => {
                                  if (formData.units.length > 1) {
                                    const newUnits = formData.units.filter((_, i) => i !== index);
                                    // If the deleted unit was the base unit, make the first one the new base
                                    if (unit.isBaseUnit) {
                                      newUnits[0].isBaseUnit = true;
                                      newUnits[0].conversionFactor = 1;
                                      const newBaseUnitName = newUnits[0].name;
                                      setFormData(prev => ({ ...prev, units: newUnits, pricing: { ...prev.pricing, baseUnit: newBaseUnitName } }));
                                    } else {
                                      setFormData(prev => ({ ...prev, units: newUnits }));
                                    }
                                  }
                                }}
                                disabled={formData.units.length <= 1}
                              >
                                <Trash />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button
                    variant="outline-primary" size="sm"
                    onClick={() => {
                      const newUnits = [...formData.units, { name: '', conversionFactor: 1, isBaseUnit: false }];
                      setFormData(prev => ({ ...prev, units: newUnits }));
                    }}
                  >
                    + Add Unit
                  </Button>
                </div>
              </div>
            </>
          </ReusableModal>
        )}

        {showEditItemModal && editingItem && (
          <ReusableModal
            show={showEditItemModal}
            onHide={() => {
              setShowEditItemModal(false);
              setEditingItem(null);
              setError(null);
            }}
            title={`Edit Item: ${editingItem.name}`}
            footerContent={
              <>
                <button
                  onClick={() => {
                    setShowEditItemModal(false);
                    setEditingItem(null);
                    setError(null);
                  }}
                  className="btn btn-secondary"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEditedItem}
                  className="btn btn-success"
                  disabled={
                    !formData.name ||
                    !formData.pricing.sellingPrice ||
                    !formData.category ||
                    isSubmitting
                  }
                >
                  {parseFloat(formData.pricing.buyingPrice) >
                    parseFloat(formData.pricing.sellingPrice) && (
                      <Alert variant="warning" className="p-2 small mb-0 me-2">
                        Buying price cannot be greater than Selling price!
                      </Alert>
                    )}

                  {isSubmitting ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                      />{" "}
                      Updating...
                    </>
                  ) : (
                    "Update Item"
                  )}
                </button>
              </>
            }
            isLoading={isSubmitting}
          >
            <>
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
                      value={formData.quantity} // Quantity input
                      onChange={(e) => {
         const val = e.target.value;
                        if (val === "" || !isNaN(val)) {
                          if (Number(val) < 0) {
                            setFormData({ ...formData, quantity: "0" });
                          } else {
                            setFormData({ ...formData, quantity: val });
                          }
                        }
                      }}
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
                        setFormData({
                          ...formData,
                          lowStockThreshold: e.target.value,
                        })
                      }
                      min="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Image</label>
                    <input
                      type="file"
                      className="form-control mb-2"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                    {formData.image && (
                      <div className="mt-2 text-center">
                        <img
                          src={formData.image}
                          alt="Preview"
                          style={{
                            width: "100px",
                            height: "100px",
                            objectFit: "cover",
                            borderRadius: "4px",
                            border: "1px solid #ddd",
                          }}
                        />
                        <button
                          className="btn btn-sm btn-outline-danger ms-2"
                          onClick={() =>
                            setFormData((prev) => ({ ...prev, image: "" }))
                          }
                          title="Remove Image"
                        >
                          X
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                 {/* Unit Management Section */}
                 <div className="col-12 mt-3 pt-3 border-top">
                  <h5>Pricing & Units</h5>
                  <div className="row">
                    <div className="col-md-6">
                      <label>Buying Price (per Base Unit)</label>
                      <input
                        type="number" step="0.01" className="form-control mb-2"
                        placeholder="Buying Price" name="buyingPrice"
                        value={formData.pricing.buyingPrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, pricing: { ...prev.pricing, buyingPrice: e.target.value } }))}
                      />
                    </div>
                    <div className="col-md-6">
                      <label>Selling Price (per Base Unit) <span className="text-danger">*</span></label>
                      <input
                        type="number" step="0.01" className="form-control mb-2"
                        placeholder="Selling Price" name="sellingPrice"
                        value={formData.pricing.sellingPrice}
                        onChange={(e) => setFormData(prev => ({ ...prev, pricing: { ...prev.pricing, sellingPrice: e.target.value } }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="table-responsive">
                    <table className="table table-sm">
                      <thead>
                        <tr>
                          <th>Unit Name</th>
                          <th>Conversion Factor (to Base)</th>
                          <th>Is Base Unit?</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {formData.units.map((unit, index) => (
                          <tr key={index}>
                            <td>
                              <input
                                type="text" className="form-control form-control-sm"
                                value={unit.name}
                                onChange={(e) => {
                                  const newUnits = [...formData.units];
                                  newUnits[index].name = e.target.value;
                                  // If this was the base unit, update the pricing object too
                                  if (unit.isBaseUnit) {
                                    setFormData(prev => ({ ...prev, units: newUnits, pricing: { ...prev.pricing, baseUnit: e.target.value } }));
                                  } else {
                                    setFormData(prev => ({ ...prev, units: newUnits }));
                                  }
                                }}
                              />
                            </td>
                            <td>
                              <input
                                type="number" step="any" className="form-control form-control-sm"
                                value={unit.conversionFactor}
                                disabled={unit.isBaseUnit}
                                onChange={(e) => {
                                  const newUnits = [...formData.units];
                                  newUnits[index].conversionFactor = parseFloat(e.target.value) || 0;
                                  setFormData(prev => ({ ...prev, units: newUnits }));
                                }}
                              />
                            </td>
                            <td className="text-center align-middle">
                              <input
                                type="radio" className="form-check-input"
                                name="isBaseUnit"
                                checked={unit.isBaseUnit}
                                onChange={() => {
                                  const newUnits = formData.units.map((u, i) => {
                                    const isThisOne = i === index;
                                    return {
                                      ...u,
                                      isBaseUnit: isThisOne,
                                      conversionFactor: isThisOne ? 1 : u.conversionFactor,
                                    };
                                  });
                                  const newBaseUnitName = newUnits[index].name;
                                  setFormData(prev => ({
                                    ...prev,
                                    units: newUnits,
                                    pricing: { ...prev.pricing, baseUnit: newBaseUnitName }
                                  }));
                                }}
                              />
                            </td>
                            <td>
                              <Button
                                variant="danger" size="sm"
                                onClick={() => {
                                  if (formData.units.length > 1) {
                                    const newUnits = formData.units.filter((_, i) => i !== index);
                                    // If the deleted unit was the base unit, make the first one the new base
                                    if (unit.isBaseUnit) {
                                      newUnits[0].isBaseUnit = true;
                                      newUnits[0].conversionFactor = 1;
                                      const newBaseUnitName = newUnits[0].name;
                                      setFormData(prev => ({ ...prev, units: newUnits, pricing: { ...prev.pricing, baseUnit: newBaseUnitName } }));
                                    } else {
                                      setFormData(prev => ({ ...prev, units: newUnits }));
                                    }
                                  }
                                }}
                                disabled={formData.units.length <= 1}
                              >
                                <Trash />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Button
                    variant="outline-primary" size="sm"
                    onClick={() => {
                      const newUnits = [...formData.units, { name: '', conversionFactor: 1, isBaseUnit: false }];
                      setFormData(prev => ({ ...prev, units: newUnits }));
                    }}
                  >
                    + Add Unit
                  </Button>
                </div>
              </div>
            </>
          </ReusableModal>
        )}

        {showPurchaseModal && (
          <ReusableModal
            show={showPurchaseModal}
            onHide={() => {
              setShowPurchaseModal(false);
              resetPurchaseForm();
              setError(null);
            }}
            title="Purchase Tracking"
            footerContent={
              <>
                <button
                  onClick={() => {
                    setShowPurchaseModal(false);
                    resetPurchaseForm();
                    setError(null);
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
                  {isSubmitting ? (
                    <>
                      <Spinner
                        as="span"
                        animation="border"
                        size="sm"
                        role="status"
                        aria-hidden="true"
                      />{" "}
                      Submitting...
                    </>
                  ) : (
                    "Submit Purchase"
                  )}
                </button>
              </>
            }
            isLoading={isSubmitting}
          >
            <>
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
                      value={itemSearchTerm} // Use a single itemSearchTerm for the active input
                      onChange={(e) => {
                        setItemSearchTerm(e.target.value);
                        setShowItemSearch(true);
                      }}
                      onFocus={() => {
                        setShowItemSearch(true);
                      }}
                      disabled={isSubmitting}
                    />
                    {filteredItemsList.length > 0 &&
                      showItemSearch && ( // Simpler condition for showing dropdown
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
                                  suggestion.buyingPrice
                                    ? suggestion.buyingPrice.toString()
                                    : suggestion.lastPurchasePrice
                                      ? suggestion.lastPurchasePrice.toString()
                                      : "0"
                                );
                                handleItemChange(
                                  idx,
                                  "gstRate",
                                  suggestion.gstRate.toString()
                                );
                                setItemSearchTerm(""); // Clear search term after selection
                                setShowItemSearch(false);
                              }}
                            >
                              <strong>{suggestion.name}</strong>
                              <span className="text-muted">
                                {" "}
                                - SP: ₹{suggestion.sellingPrice.toFixed(2)}, BP:
                                ₹{(suggestion.buyingPrice || 0).toFixed(2)}
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
                            handleItemChange(idx, "description", e.target.value)
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
            </>
          </ReusableModal>
        )}
      </div>
      <Footer />
    </div>
  );
}
