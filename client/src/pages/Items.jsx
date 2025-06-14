import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import apiClient from "../utils/apiClient"; // Import apiClient
import "../css/Style.css";
import Navbar from "../components/Navbar.jsx";
import Pagination from "../components/Pagination.jsx"; // Added .jsx
import { saveAs } from "file-saver"; // For downloading files

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
} from "react-bootstrap-icons";
import ReusableModal from "../components/ReusableModal.jsx";
import { Spinner } from "react-bootstrap"; // Added for loading indicators on new category/subcategory save
import "../css/Style.css"; // General styles

const DEFAULT_LOW_QUANTITY_THRESHOLD_ITEMS_PAGE = 3;
const LOCAL_STORAGE_LOW_QUANTITY_KEY_ITEMS_PAGE =
  "globalLowStockThresholdSetting";

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
  const [itemHistory, setItemHistory] = useState([]);
  const [itemHistoryLoading, setItemHistoryLoading] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    quantity: "",
    sellingPrice: "", // Changed from price
    buyingPrice: "", // Added buyingPrice
    gstRate: "0",
    hsnCode: "",
    unit: "Nos",
    category: "",
    subcategory: "General",
    maxDiscountPercentage: "",
    lowStockThreshold: "5", // Added for consistency with item schema
  });
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false); // Renamed from showModal for clarity
  const [expandedRow, setExpandedRow] = useState(null); // Keep for view details
  const [purchaseHistory, setPurchaseHistory] = useState({});
  const [purchaseHistoryLoading, setPurchaseHistoryLoading] = useState({}); // Track loading state per item
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
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
  const [isSubmitting, setIsSubmitting] = useState(false); // General submission state (add item, add purchase)
  const [isProcessingExcel, setIsProcessingExcel] = useState(false); // For upload/export
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [excelUpdateStatus, setExcelUpdateStatus] = useState({
    error: null,
    success: null,
    details: [],
  });
  const [showItemHistoryModal, setShowItemHistoryModal] = useState(false); // Corrected from showViewItemModal
  // State for adding new category/subcategory inline
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingNewSubcategory, setIsAddingNewSubcategory] = useState(false);
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);
  const [isSubmittingSubcategory, setIsSubmittingSubcategory] = useState(false);

  const location = useLocation();
  const queryParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );
  const stockAlertFilterActive = queryParams.get("filter") === "stock_alerts";
  const lowStockWarningQueryThreshold = parseInt(
    queryParams.get("lowThreshold"),
    10
  );
  const [quantityFilterThreshold, setQuantityFilterThreshold] = useState(null); // null means 'All'

  const [effectiveLowStockThreshold, setEffectiveLowStockThreshold] = useState(
    DEFAULT_LOW_QUANTITY_THRESHOLD_ITEMS_PAGE
  );

  useEffect(() => {
    const storedThreshold = localStorage.getItem(
      LOCAL_STORAGE_LOW_QUANTITY_KEY_ITEMS_PAGE
    );
    setEffectiveLowStockThreshold(
      storedThreshold
        ? parseInt(storedThreshold, 10)
        : DEFAULT_LOW_QUANTITY_THRESHOLD_ITEMS_PAGE
    );
  }, []); // Runs once on mount to get the threshold

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to the first page
  };

  // const handleGlobalThresholdChange = (e) => { // This function seems unused, can be removed if not needed
  //   const newThreshold =
  //     parseInt(e.target.value, 10) || DEFAULT_LOW_QUANTITY_THRESHOLD_ITEMS_PAGE;
  //   setEffectiveLowStockThreshold(newThreshold);
  //   localStorage.setItem(
  //     LOCAL_STORAGE_LOW_QUANTITY_KEY_ITEMS_PAGE,
  //     newThreshold.toString()
  //   );
  // };

  const showSuccess = (message) => {
    showToast(message, true);
  };

  // useEffect(() => {}, [items, categories]); // This useEffect is empty, can be removed

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient("/items"); // Use apiClient
      setItems(response);
      setError(null);
      showSuccess("Items Fetched Successfully");
    } catch (err) {
      const errorMessage = handleApiError(
        err,
        "Failed to load items. Please try again."
      );
      setError(errorMessage);
    } finally {
      setLoading(false); // Ensure loading is set to false in finally
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true); // Should be setLoading(true) at the start
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
      // const errorDetails = { // This variable seems unused
      //   message: err.message,
      //   status: err.response?.status,
      //   data: err.response?.data,
      //   config: err.config,
      // };

      let errorMessage = handleApiError(err, "Failed to load categories.");
      if (err.response) {
        errorMessage += ` (${err.response.status})`;
        if (err.response.data?.message) {
          errorMessage += `: ${err.response.data.message}`;
        }
      } else if (err.request) {
        errorMessage += ": No response from server";
      } else {
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
      if (Array.isArray(items) && items.length > 0) {
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
  }, [itemSearchTerm, items]);

  const fetchPurchaseHistory = useCallback(async (itemId) => {
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
      const errorMessage = handleApiError(err, "Failed to load history.");
      // setError(errorMessage); // Already set by handleApiError
      console.error("Fetch purchase history error:", err);
      // setError(errorMessage); // Duplicate setError
      setPurchaseHistory((prev) => ({
        ...prev,
        [itemId]: [],
      }));
    } finally {
      setPurchaseHistoryLoading((prev) => ({ ...prev, [itemId]: false }));
    }
  }, []);

  // const handleSearchChange = (e) => { // This function seems unused, SearchBar component handles its own state
  //   setSearchTerm(e.target.value.toLowerCase());
  //   setCurrentPage(1);
  // };

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const itemsToDisplay = useMemo(() => {
    if (!Array.isArray(items)) {
      return [];
    }

    let processedItems = [...items];

    const currentLowThreshold =
      stockAlertFilterActive && Number.isFinite(lowStockWarningQueryThreshold)
        ? lowStockWarningQueryThreshold
        : effectiveLowStockThreshold;

    if (stockAlertFilterActive) {
      processedItems = processedItems.filter(
        (item) => item.needsRestock || item.quantity < currentLowThreshold
      );
    } else {
      processedItems = processedItems.filter((item) => {
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

      if (
        quantityFilterThreshold !== null &&
        Number.isFinite(quantityFilterThreshold)
      ) {
        processedItems = processedItems.filter(
          (item) => item.quantity <= quantityFilterThreshold
        );
      }
    }

    processedItems.sort((a, b) => {
      if (stockAlertFilterActive) {
        if (a.quantity < b.quantity) return -1;
        if (a.quantity > b.quantity) return 1;
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
    lowStockWarningQueryThreshold,
    effectiveLowStockThreshold,
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

  // const addExistingItemToPurchase = (item) => { // This function seems unused
  //   setPurchaseData({
  //     ...purchaseData,
  //     items: [
  //       ...(purchaseData.items || []),
  //       {
  //         itemId: item._id,
  //         description: item.name,
  //         quantity: "1",
  //         price: item.buyingPrice
  //           ? item.buyingPrice.toString()
  //           : item.lastPurchasePrice
  //           ? item.lastPurchasePrice.toString()
  //           : "0",
  //         gstRate: item.gstRate.toString(),
  //       },
  //     ],
  //   });
  //   setItemSearchTerm("");
  //   setShowItemSearch(false);
  // };

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
      const updatedItemPayload = { ...formData };
      updatedItemPayload.quantity =
        parseFloat(updatedItemPayload.quantity) || 0;
      updatedItemPayload.sellingPrice =
        parseFloat(updatedItemPayload.sellingPrice) || 0;
      updatedItemPayload.buyingPrice =
        parseFloat(updatedItemPayload.buyingPrice) || 0;
      updatedItemPayload.gstRate = parseFloat(updatedItemPayload.gstRate) || 0;
      updatedItemPayload.lowStockThreshold =
        parseFloat(updatedItemPayload.lowStockThreshold) || 0;
      updatedItemPayload.maxDiscountPercentage =
        parseFloat(updatedItemPayload.maxDiscountPercentage) || 0;

      await apiClient(`/items/${editingItem._id}`, {
        method: "PUT",
        body: updatedItemPayload,
      });
      await fetchItems();
      setShowEditItemModal(false);
      setEditingItem(null);
      showSuccess("Item updated successfully!");
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to update item.");
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
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
      setShowAddItemModal(false); // Use renamed state
      setFormData({
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
      });
      setError(null);
      showSuccess("Item added successfully!");
    } catch (err) {
      const errorMessage = handleApiError(
        err,
        "Failed to add item. Please try again."
      );
      setError(errorMessage);
      console.error("Error adding item:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePurchaseChange = (e) => {
    setPurchaseData({ ...purchaseData, [e.target.name]: e.target.value });
  };

  const toggleExpandedRow = async (id) => {
    if (expandedRow !== id) {
      await fetchPurchaseHistory(id);
    }
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleShowItemHistoryModal = async (item) => {
    setEditingItem(item);
    setShowItemHistoryModal(true);
    setItemHistoryLoading(true);
    setError(null);
    let combinedHistory = [];

    if (item.excelImportHistory && item.excelImportHistory.length > 0) {
      item.excelImportHistory.forEach((entry) => {
        let quantityChange = 0;
        let details = `File: ${entry.fileName || "N/A"}. `;
        let oldQtyText = "";
        let newQtyText = "";
        if (entry.action === "created") {
          const createdQty = entry.snapshot?.quantity;
          quantityChange = parseFloat(createdQty) || 0;
          newQtyText = ` (New Qty: ${quantityChange})`;
          details += `Item created.`;
        } else if (entry.action === "updated") {
          const qtyChangeInfo = entry.changes?.find(
            (c) => c.field === "quantity"
          );
          if (qtyChangeInfo) {
            const oldQty = parseFloat(qtyChangeInfo.oldValue);
            const newQty = parseFloat(qtyChangeInfo.newValue);
            quantityChange = newQty - oldQty;
            oldQtyText = ` (Old: ${oldQty} -> New: ${newQty})`;
          }
          details += `Item fields updated.`;
        }
        combinedHistory.push({
          date: new Date(entry.importedAt),
          type: `Excel Import (${entry.action})`,
          user: entry.importedBy?.firstname || "System",
          details: details.trim() + oldQtyText + newQtyText,
          quantityChange: quantityChange,
        });
      });
    }

    const existingPurchaseHistory = purchaseHistory[item._id];
    if (existingPurchaseHistory && existingPurchaseHistory.length > 0) {
      existingPurchaseHistory.forEach((purchase) => {
        combinedHistory.push({
          date: new Date(purchase.date),
          type: "Purchase Entry",
          user: purchase.createdByName || "System",
          details: `Purchased from ${purchase.companyName} (Inv: ${
            purchase.invoiceNumber
          }). Price: ₹${purchase.price?.toFixed(2)}/unit.`,
          quantityChange: parseFloat(purchase.quantity) || 0,
        });
      });
    }
    combinedHistory.sort((a, b) => b.date - a.date);
    setItemHistory(combinedHistory);
    setItemHistoryLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        setIsSubmitting(true);
        await apiClient(`/items/${id}`, { method: "DELETE" });
        await fetchItems();
        showSuccess("Item Deleted Successfully");
      } catch (err) {
        const errorMessage = handleApiError(err, "Failed to delete item.");
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
        setIsSubmitting(false); // Reset submitting state
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
      // Use apiClient for blob response
      const blob = await apiClient("items/export-excel", { // Endpoint relative to API_BASE_URL
        method: "GET",
        responseType: 'blob' // Tell apiClient to expect a blob
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
      const message = err.data?.message || err.message || "Failed to export items to Excel.";
      setExcelUpdateStatus({ error: message, success: null, details: [] });
      setError(message); // Show error in the main error display
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
      event.target.value = null; // Reset file input if user cancels
      return;
    }
    setIsProcessingExcel(true);
    const formData = new FormData();
    formData.append("excelFile", file);
    try {
      // Use apiClient for FormData upload
      const responseData = await apiClient("items/import-uploaded-excel", { // Endpoint relative to API_BASE_URL
        method: "POST",
        body: formData,
        // apiClient handles Content-Type for FormData
      });

      // responseData is already the parsed JSON from apiClient
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
      const message = err.data?.message || // apiClient error structure
        err.message ||
        "Failed to update items from Excel.";
      setExcelUpdateStatus({ error: message, success: null, details: [] });
      setError(message); // Show error in the main error display
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
        subcategory: "General",
      }));
      setIsAddingNewCategory(false);
      setNewCategoryName("");
      showToast(
        `Category "${newCategoryName.trim()}" added successfully.`,
        true
      );
    } catch (err) {
      handleApiError(err, "Failed to add new category.");
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const handleAddNewSubcategory = async () => {
    if (!newSubcategoryName.trim()) {
      showToast("Subcategory name cannot be empty.", false);
      return;
    }
    if (!formData.category) {
      showToast("Please select a category first.", false);
      return;
    }
    setIsSubmittingSubcategory(true);
    try {
      await apiClient(`/items/categories/subcategory`, {
        method: "POST",
        body: {
          categoryName: formData.category,
          subcategoryName: newSubcategoryName.trim(),
        },
      });
      await fetchCategories();
      setFormData((prevFormData) => ({
        ...prevFormData,
        subcategory: newSubcategoryName.trim(),
      }));
      setIsAddingNewSubcategory(false);
      setNewSubcategoryName("");
      showToast(
        `Subcategory "${newSubcategoryName.trim()}" added to "${
          formData.category
        }".`,
        true
      );
    } catch (err) {
      handleApiError(err, "Failed to add new subcategory.");
    } finally {
      setIsSubmittingSubcategory(false);
    }
  };

  const anyLoading = isSubmitting || isProcessingExcel || isExportingExcel;

  return (
    <div className="items-container">
      <Navbar showPurchaseModal={openPurchaseModal} />
      <div className="container mt-4">
        {error && !showAddItemModal && !showEditItemModal && !showPurchaseModal && !showItemHistoryModal && ( // Only show page-level error if no modal is active
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
                  <span
                    className="spinner-border spinner-border-sm"
                    role="status"
                    aria-hidden="true"
                  ></span>
                ) : (
                  <FileEarmarkArrowDown />
                )}
              </button>
              <button
                onClick={() =>
                  document.getElementById("excel-upload-input")?.click()
                }
                className="btn btn-info"
                disabled={anyLoading}
                title="Upload & Update from Excel"
              >
                Upload Excel
                {isProcessingExcel ? (
                  <span
                    className="spinner-border spinner-border-sm"
                    role="status"
                    aria-hidden="true"
                  ></span>
                ) : (
                  <FileEarmarkArrowUp />
                )}
              </button>
              <button
                onClick={() => setShowAddItemModal(true)} // Changed from setShowModal
                className="btn btn-success d-flex align-items-center"
                disabled={anyLoading}
                title="Add New Item"
                style={{ gap: "0.35rem" }}
              >
                {isSubmitting ? (
                  "Processing..."
                ) : (
                  <>
                    <PlusCircle size={18} />
                    Add New Item
                  </>
                )}
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
                disabled={
                  selectedCategory === "All" ||
                  anyLoading ||
                  stockAlertFilterActive
                }
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
                value={
                  quantityFilterThreshold === null
                    ? "All"
                    : quantityFilterThreshold
                }
                onChange={(e) => {
                  const value = e.target.value;
                  setQuantityFilterThreshold(
                    value === "All" ? null : parseInt(value, 10)
                  );
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
                      <td>{item.name}</td>
                      <td>
                        <>
                          {item.quantity}{" "}
                          {item.quantity <= 0 || item.needsRestock ? (
                            <span
                              className="badge bg-danger ms-2"
                              title={
                                item.quantity <= 0
                                  ? "Out of stock! Needs immediate restock."
                                  : `Below item specific threshold (${
                                      item.lowStockThreshold || "Not Set"
                                    }). Needs restock.`
                              }
                            >
                              ⚠️ Restock
                            </span>
                          ) : (
                            item.quantity <
                              (stockAlertFilterActive
                                ? lowStockWarningQueryThreshold
                                : effectiveLowStockThreshold) && (
                              <span
                                className="badge bg-warning text-dark ms-2"
                                title={`Below page display threshold (< ${
                                  stockAlertFilterActive
                                    ? lowStockWarningQueryThreshold
                                    : effectiveLowStockThreshold
                                }`}
                              >
                                🔥 Low Stock
                              </span>
                            )
                          )}
                        </>
                      </td>
                      <td>{`₹${parseFloat(item.sellingPrice).toFixed(2)}`}</td>
                      <td>{`₹${parseFloat(item.buyingPrice || 0).toFixed(
                        2
                      )}`}</td>
                      <td>{item.unit || "Nos"}</td>
                      <td>{`${item.gstRate || 0}%`}</td>
                      <td>
                        {item.maxDiscountPercentage > 0
                          ? `${item.maxDiscountPercentage}%`
                          : "-"}
                      </td>
                      <td>
                        <div className="d-flex gap-1 justify-content-center">
                          <ActionButtons
                            item={item}
                            onView={(currentItem) => toggleExpandedRow(currentItem._id)}
                            onEdit={handleEditItem}
                            onDelete={(currentItem) => handleDelete(currentItem._id)}
                            isLoading={anyLoading}
                            size="sm"
                          />
                          <button
                            onClick={() => handleShowItemHistoryModal(item)}
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
                        <td colSpan="8" className="expanded-row">
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
                                  <td><strong>Name</strong></td>
                                  <td>{item.name}</td>
                                </tr>
                                <tr>
                                  <td><strong>Category</strong></td>
                                  <td>{item.category || "-"}</td>
                                </tr>
                                <tr>
                                  <td><strong>Subcategory</strong></td>
                                  <td>{item.subcategory || "-"}</td>
                                </tr>
                                <tr>
                                  <td><strong>Quantity</strong></td>
                                  <td>
                                    {item.quantity}
                                    {item.quantity <= 0 || item.needsRestock
                                      ? item.quantity <= 0
                                        ? " (Out of stock! Needs immediate restock.)"
                                        : ` (Item specific restock threshold: ${
                                            item.lowStockThreshold || "Not Set"
                                          })`
                                      : item.quantity <
                                          (stockAlertFilterActive
                                            ? lowStockWarningQueryThreshold
                                            : effectiveLowStockThreshold) &&
                                        ` (Page display low stock threshold: < ${
                                          stockAlertFilterActive
                                            ? lowStockWarningQueryThreshold
                                            : effectiveLowStockThreshold
                                        })`}
                                  </td>
                                </tr>
                                <tr>
                                  <td><strong>Selling Price</strong></td>
                                  <td>₹{parseFloat(item.sellingPrice).toFixed(2)}</td>
                                </tr>
                                <tr>
                                  <td><strong>Buying Price</strong></td>
                                  <td>₹{parseFloat(item.buyingPrice || 0).toFixed(2)}</td>
                                </tr>
                                <tr>
                                  <td><strong>Unit</strong></td>
                                  <td>{item.unit || "Nos"}</td>
                                </tr>
                                <tr>
                                  <td><strong>GST Rate</strong></td>
                                  <td>{item.gstRate}%</td>
                                </tr>
                                <tr>
                                  <td><strong>HSN Code</strong></td>
                                  <td>{item.hsnCode || "-"}</td>
                                </tr>
                                <tr>
                                  <td><strong>Max Discount</strong></td>
                                  <td>
                                    {item.maxDiscountPercentage > 0
                                      ? `${item.maxDiscountPercentage}%`
                                      : "N/A"}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                            <div className="d-flex justify-content-between align-items-center mb-3 mt-3">
                              <h6>Purchase History</h6>
                            </div>
                            {purchaseHistoryLoading[item._id] ? (
                               <div className="text-center"><Spinner animation="border" size="sm" /> Loading history...</div>
                            ) : purchaseHistory[item._id]?.length > 0 ? (
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
                                  {purchaseHistory[item._id].map(
                                    (purchase, idx) => (
                                      <tr key={purchase._id || idx}>
                                        <td>{new Date(purchase.date).toLocaleDateString()}</td>
                                        <td>{purchase.companyName}</td>
                                        <td>{purchase.createdByName || "N/A"}</td>
                                        <td>{purchase.invoiceNumber}</td>
                                        <td>{purchase.quantity}</td>
                                        <td>₹{purchase.price.toFixed(2)}</td>
                                      </tr>
                                    )
                                  )}
                                </tbody>
                              </table>
                            ) : (
                              <div className="alert alert-info">
                                {error && expandedRow === item._id // Show error only for the current expanded row
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
                  <td colSpan="8" className="text-center">
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
                const totalPages = Math.ceil(
                  itemsToDisplay.length / itemsPerPage
                );
                if (page >= 1 && page <= totalPages) setCurrentPage(page);
              }}
              onItemsPerPageChange={handleItemsPerPageChange}
            />
          )}
        </div>

        {showAddItemModal && (
          <ReusableModal
            show={showAddItemModal}
            onHide={() => {
              setShowAddItemModal(false);
              setFormData({ // Reset form on hide
                name: "", quantity: "", sellingPrice: "", buyingPrice: "",
                gstRate: "0", hsnCode: "", unit: "Nos", category: "",
                subcategory: "General", maxDiscountPercentage: "", lowStockThreshold: "5",
              });
              setError(null); // Clear modal-specific errors
            }}
            title="Add New Item"
            footerContent={
              <>
                <button
                  type="button"
                  className="btn btn-secondary" // Changed from "close" to "btn btn-secondary"
                  onClick={() => {
                    setShowAddItemModal(false);
                    setFormData({
                      name: "", quantity: "", sellingPrice: "", buyingPrice: "",
                      gstRate: "0", hsnCode: "", unit: "Nos", category: "",
                      subcategory: "General", maxDiscountPercentage: "", lowStockThreshold: "5",
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
                    !formData.sellingPrice ||
                    !formData.category ||
                    isSubmitting ||
                    isAddingNewCategory || isAddingNewSubcategory
                  }
                >
                  {isSubmitting ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Adding...
                    </>
                  ) : "Add New Item"}
                </button>
              </>
            }
            isLoading={isSubmitting}
          >
            <>
              {error && <div className="alert alert-danger">{error}</div>} {/* Show error inside modal */}
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
                    <label>Selling Price*</label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control mb-2"
                      placeholder="Selling Price"
                      name="sellingPrice"
                      value={formData.sellingPrice}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sellingPrice: e.target.value,
                        })
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
                      placeholder="Buying Price"
                      name="buyingPrice"
                      value={formData.buyingPrice}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          buyingPrice: e.target.value,
                        })
                      }
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
                    <div className="input-group mb-2">
                      {isAddingNewCategory ? (
                        <>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Enter new category name"
                            value={newCategoryName}
                            onChange={(e) =>
                              setNewCategoryName(e.target.value)
                            }
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
                                subcategory: "General",
                              })
                            }
                          >
                            <option value="">Select Category</option>
                            {Array.isArray(categories) &&
                              categories.map((cat) => (
                                <option
                                  key={cat.category}
                                  value={cat.category}
                                >
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
                    <label>Subcategory</label>
                    <div className="input-group mb-2">
                      {isAddingNewSubcategory ? (
                        <>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Enter new subcategory name"
                            value={newSubcategoryName}
                            onChange={(e) =>
                              setNewSubcategoryName(e.target.value)
                            }
                            disabled={
                              isSubmittingSubcategory || !formData.category
                            }
                          />
                          <button
                            className="btn btn-success"
                            type="button"
                            onClick={handleAddNewSubcategory}
                            disabled={
                              isSubmittingSubcategory ||
                              !newSubcategoryName.trim() ||
                              !formData.category
                            }
                          >
                            {isSubmittingSubcategory ? (
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
                              setIsAddingNewSubcategory(false);
                              setNewSubcategoryName("");
                            }}
                            disabled={isSubmittingSubcategory}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <select
                            className="form-control"
                            name="subcategory"
                            value={formData.subcategory}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                subcategory: e.target.value,
                              })
                            }
                            disabled={
                              !formData.category || isAddingNewCategory
                            }
                          >
                            <option value="General">General</option>
                            {formData.category &&
                              !isAddingNewCategory &&
                              Array.isArray(categories) &&
                              categories
                                .find((c) => c.category === formData.category)
                                ?.subcategories.map((subcat) => (
                                  <option key={subcat} value={subcat}>
                                    {subcat}
                                  </option>
                                ))}
                          </select>
                          <button
                            className="btn btn-outline-primary"
                            type="button"
                            onClick={() => setIsAddingNewSubcategory(true)}
                            title="Add new subcategory"
                            disabled={
                              !formData.category ||
                              isAddingNewCategory ||
                              isAddingNewSubcategory
                            }
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
                </div>
              </div>
            </>
          </ReusableModal>
        )}

        {showItemHistoryModal && editingItem && (
          <ReusableModal
            show={showItemHistoryModal}
            onHide={() => {
              setShowItemHistoryModal(false);
              setEditingItem(null);
              setItemHistory([]);
              setError(null); // Clear error on close
            }}
            title={`Item History: ${editingItem.name}`}
            footerContent={
              <button
                onClick={() => {
                  setShowItemHistoryModal(false);
                  setEditingItem(null);
                  setItemHistory([]);
                  setError(null);
                }}
                className="btn btn-secondary"
              >
                Close
              </button>
            }
          >
            <>
              {itemHistoryLoading ? (
                <div className="text-center">
                  <Spinner animation="border" role="status">
                    <span className="visually-hidden">Loading history...</span>
                  </Spinner>
                </div>
              ) : error ? (
                <div className="alert alert-danger">{error}</div>
              ) : itemHistory.length > 0 ? (
                <div className="table-responsive">
                  <table className="table table-sm table-striped table-bordered">
                    <thead className="table-light">
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>User/Source</th>
                        <th>Details</th>
                        <th>Qty Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemHistory.map((entry, index) => (
                        <tr key={index}>
                          <td>{new Date(entry.date).toLocaleString()}</td>
                          <td>{entry.type}</td>
                          <td>{entry.user}</td>
                          <td>{entry.details}</td>
                          <td className={entry.quantityChange >= 0 ? 'text-success' : 'text-danger'}>
                            {entry.quantityChange > 0 ? `+${entry.quantityChange}` : entry.quantityChange}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="alert alert-info">No history found for this item.</div>
              )}
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
                    !formData.sellingPrice ||
                    !formData.category ||
                    isSubmitting
                  }
                >
                  {isSubmitting ? (
                    <>
                      <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Updating...
                    </>
                  ) : "Update Item"}
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
                        setFormData({
                          ...formData,
                          sellingPrice: e.target.value,
                        })
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
                        setFormData({
                          ...formData,
                          buyingPrice: e.target.value,
                        })
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
                        setFormData({ ...formData, category: e.target.value, subcategory: "General" }) // Reset subcategory
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
                        setFormData({
                          ...formData,
                          lowStockThreshold: e.target.value,
                        })
                      }
                      min="0"
                    />
                  </div>
                </div>
              </div>
            </>
          </ReusableModal>
        )}

        {showPurchaseModal && (
          <ReusableModal
            show={showPurchaseModal}
            onHide={() => { setShowPurchaseModal(false); resetPurchaseForm(); setError(null); }}
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
                      <Spinner as="span" animation="border" size="sm" role="status" aria-hidden="true" /> Submitting...
                    </>
                  ) : "Submit Purchase"}
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
                                handleItemChange(idx, "description", suggestion.name);
                                handleItemChange(idx, "price", suggestion.buyingPrice ? suggestion.buyingPrice.toString() : (suggestion.lastPurchasePrice ? suggestion.lastPurchasePrice.toString() : "0"));
                                handleItemChange(idx, "gstRate", suggestion.gstRate.toString());
                                setItemSearchTerm("");
                                setShowItemSearch(false);
                              }}
                            >
                              <strong>{suggestion.name}</strong>
                              <span className="text-muted">
                                {" "}- SP: ₹{suggestion.sellingPrice.toFixed(2)}, BP: ₹{(suggestion.buyingPrice || 0).toFixed(2)}
                              </span>
                              <br />
                              <small>HSN: {suggestion.hsnCode || "N/A"}, GST: {suggestion.gstRate || 0}%</small>
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                  {item.description && (
                    <div className="selected-item-details mb-2 p-2 bg-light border rounded">
                      <strong>{item.description}</strong>
                      {item.price && (
                        <small className="d-block">Price: ₹{item.price}, GST: {item.gstRate || 0}%</small>
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
                          onChange={(e) => handleItemChange(idx, "description", e.target.value)}
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
                          onChange={(e) => handleItemChange(idx, "price", e.target.value)}
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
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
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
                          onChange={(e) => handleItemChange(idx, "gstRate", e.target.value)}
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
                  <strong>Total Amount: ₹{calculateTotalAmount().toFixed(2)}</strong>
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