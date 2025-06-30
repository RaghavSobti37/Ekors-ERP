import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import apiClient from "../utils/apiClient";
import "../css/Style.css";
import Navbar from "../components/Navbar.jsx";
import Pagination from "../components/Pagination.jsx";
import { saveAs } from "file-saver";
import { useAuth } from "../context/AuthContext.jsx";
import { showToast, handleApiError } from "../utils/helpers";
import SearchBar from "../components/Searchbar.jsx";
import ActionButtons from "../components/ActionButtons.jsx";
import Footer from "../components/Footer";
import {
  Trash,
  PlusCircle,
  ClockHistory,
  CheckCircleFill,
  ShieldFillCheck,
  PencilSquare,
} from "react-bootstrap-icons";
import ReusableModal from "../components/ReusableModal.jsx";
import { Spinner, Alert, Card, Badge, Button } from "react-bootstrap";

const DEFAULT_LOW_QUANTITY_THRESHOLD_ITEMS_PAGE = 5;
const LOCAL_STORAGE_LOW_QUANTITY_KEY_ITEMS_PAGE = "globalLowStockThresholdSetting";

const STANDARD_UNITS = [
  "nos", "pkt", "pcs", "kgs", "mtr", "sets", "kwp", "ltr", "bottle", "each", "bag" , "set"
];

export default function Items() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

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
  const [initialUnit] = useState({ name: "nos", isBaseUnit: true, conversionFactor: 1 }); // <-- lowercase
  const [formData, setFormData] = useState({
    name: "",
    quantity: "",
    sellingPrice: "",
    buyingPrice: "",
    profitMarginPercentage: "",
    gstRate: "0",
    hsnCode: "",
    baseUnit: "nos", // <-- lowercase
    units: [initialUnit],
    category: "",
    maxDiscountPercentage: "",
    lowStockThreshold: "5",
    image: "",
  });

  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [excelUpdateStatus, setExcelUpdateStatus] = useState({
    error: null,
    success: null,
    details: [],
  });

  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSubmittingCategory, setIsSubmittingCategory] = useState(false);

  const location = useLocation();
  const [currentPagePending, setCurrentPagePending] = useState(1);
  const [quantityFilterInputValue, setQuantityFilterInputValue] = useState("");
  const [stockAlertsPageFilterThreshold, setStockAlertsPageFilterThreshold] =
    useState("");

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
      const initialThreshold = Number.isFinite(lowStockWarningQueryThreshold)
        ? lowStockWarningQueryThreshold
        : effectiveLowStockThreshold;
      setStockAlertsPageFilterThreshold(initialThreshold.toString());
      setSearchTerm("");
    } else {
      setStockAlertsPageFilterThreshold("");
    }
  }, [
    stockAlertFilterActive,
    effectiveLowStockThreshold,
    lowStockWarningQueryThreshold,
  ]);

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
  }, [user]);

  useEffect(() => {
    fetchPendingReviewItems();
    fetchCategories();
    return () => {
      setPendingReviewItems([]);
      setCategories([]);
    };
  }, [fetchPendingReviewItems, fetchCategories]);

  useEffect(() => {
    const timerId = setTimeout(() => {
      if (!authLoading && user) {
        fetchItems(1, itemsPerPage);
      }
    }, 500);
    return () => clearTimeout(timerId);
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

  useEffect(() => {
    if (!authLoading && user) {
      fetchItems(currentPage, itemsPerPage);
    }
  }, [authLoading, user, currentPage, itemsPerPage]);

  const handleExportToExcel = async () => {
    try {
      setIsExportingExcel(true);
      const response = await apiClient("/items/export-excel", {
        responseType: "blob",
      });
      saveAs(response, "items_export.xlsx");
      showToast("Items exported successfully!", true);
    } catch (err) {
      const errorMessage = handleApiError(
        err,
        "Failed to export items to Excel.",
        user
      );
      setError(errorMessage);
      showToast(errorMessage, false);
    } finally {
      setIsExportingExcel(false);
    }
  };

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

    // Process units with validation
    const itemUnits = Array.isArray(item.units) ? [...item.units] : [];
    let processedUnits = itemUnits.length > 0
      ? itemUnits
          .filter(unit => unit && typeof unit === 'object' && STANDARD_UNITS.includes(unit.name.toLowerCase()))
          .map((unit) => ({
            name: unit.name.toLowerCase(), // <-- force lowercase
            conversionFactor: unit.isBaseUnit ? 1 : (unit.conversionFactor || 1),
            isBaseUnit: unit.isBaseUnit || false
          }))
      : [{ name: "nos", isBaseUnit: true, conversionFactor: 1 }];

    // Ensure exactly one base unit
    const baseUnits = processedUnits.filter(u => u.isBaseUnit);
    if (baseUnits.length !== 1) {
      processedUnits = processedUnits.map((u, index) => ({
        ...u,
        isBaseUnit: index === 0
      }));
    }

    const baseUnit = processedUnits.find(u => u.isBaseUnit)?.name || "nos";

    setFormData({
      name: item.name,
      quantity: item.quantity?.toFixed(2) || "0.00",
      baseUnit: baseUnit, // already lowercase
      sellingPrice: item.sellingPrice?.toFixed(2) || "0.00",
      buyingPrice: item.buyingPrice?.toFixed(2) || "0.00",
      profitMarginPercentage: item.profitMarginPercentage?.toString() || "20",
      units: processedUnits,
      gstRate: item.gstRate?.toString() || "0",
      hsnCode: item.hsnCode || "",
      category: item.category || "",
      maxDiscountPercentage: item.maxDiscountPercentage?.toString() || "",
      lowStockThreshold: item.lowStockThreshold?.toString() || "5",
      image: item.image || "",
    });
    setShowEditItemModal(true);
  };

  const validateFormData = () => {
    if (!formData.name) {
      setError("Item name is required.");
      return false;
    }

    const sellingPrice = parseFloat(formData.sellingPrice) || 0;
    const buyingPrice = parseFloat(formData.buyingPrice) || 0;

    if (buyingPrice > sellingPrice && sellingPrice !== 0) {
      setError("Buying price cannot be greater than selling price.");
      return false;
    }

    // Validate units
    const validUnits = formData.units.filter(unit => 
      unit && typeof unit === 'object' && 
      STANDARD_UNITS.includes(unit.name) &&
      (unit.isBaseUnit ? unit.conversionFactor === 1 : true)
    );

    if (validUnits.length !== formData.units.length) {
      setError("Invalid units detected. Please check all unit entries.");
      return false;
    }

    const baseUnits = validUnits.filter(u => u.isBaseUnit);
    if (baseUnits.length !== 1) {
      setError("Exactly one base unit must be specified.");
      return false;
    }

    if (formData.baseUnit !== baseUnits[0].name) {
      setError("Base unit field must match the marked base unit.");
      return false;
    }

    return true;
  };

  const handleSaveEditedItem = async () => {
    if (!validateFormData()) return;

    try {
      setIsSubmitting(true);

      // Always ensure only one base unit
      const baseUnitName = formData.baseUnit.toLowerCase();

      console.log("DEBUG: formData.units before save:", formData.units);

      const filteredUnits = (formData.units || []).filter(
        unit =>
          unit &&
          typeof unit === "object" &&
          unit.name &&
          STANDARD_UNITS.includes(unit.name.toLowerCase())
      );

      if (filteredUnits.length === 0) {
        setError("No valid units found. Please add at least one unit.");
        setIsSubmitting(false);
        return;
      }

      // Ensure only one base unit
      const unitsPayload = filteredUnits.map((unit) => ({
        name: unit.name.toLowerCase(),
        isBaseUnit: unit.name.toLowerCase() === baseUnitName,
        conversionFactor: unit.name.toLowerCase() === baseUnitName ? 1 : parseFloat(unit.conversionFactor) || 1,
      }));

      console.log("DEBUG: unitsPayload to be sent:", unitsPayload);

      const updatedItemPayload = {
        name: formData.name,
        quantity: parseFloat(formData.quantity) || 0,
        baseUnit: baseUnitName,
        sellingPrice: parseFloat(formData.sellingPrice) || 0,
        buyingPrice: parseFloat(formData.buyingPrice) || 0,
        profitMarginPercentage: parseFloat(formData.profitMarginPercentage) || 20,
        units: unitsPayload,
        gstRate: parseFloat(formData.gstRate) || 0,
        hsnCode: formData.hsnCode,
        category: formData.category,
        maxDiscountPercentage: parseFloat(formData.maxDiscountPercentage) || 0,
        lowStockThreshold: parseFloat(formData.lowStockThreshold) || 5,
        image: formData.image,
      };

      const response = await apiClient(`/items/${editingItem._id}`, {
        method: "PUT",
        body: updatedItemPayload,
      });

      setItems(prevItems =>
        prevItems.map(item => item._id === editingItem._id ? response.data : item)
      );

      setShowEditItemModal(false);
      setEditingItem(null);
      showToast("Item updated successfully!", true);
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to update item.", user);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddItem = async () => {
    if (!validateFormData()) return;

    try {
      setIsSubmitting(true);

      // Always ensure only one base unit
      const baseUnitName = formData.baseUnit.toLowerCase();

      console.log("DEBUG: formData.units before save:", formData.units);

      const filteredUnits = (formData.units || []).filter(
        unit =>
          unit &&
          typeof unit === "object" &&
          unit.name &&
          STANDARD_UNITS.includes(unit.name.toLowerCase())
      );

      if (filteredUnits.length === 0) {
        setError("No valid units found. Please add at least one unit.");
        setIsSubmitting(false);
        return;
      }

      // Ensure only one base unit
      const unitsPayload = filteredUnits.map((unit) => ({
        name: unit.name.toLowerCase(),
        isBaseUnit: unit.name.toLowerCase() === baseUnitName,
        conversionFactor: unit.name.toLowerCase() === baseUnitName ? 1 : parseFloat(unit.conversionFactor) || 1,
      }));

      console.log("DEBUG: unitsPayload to be sent:", unitsPayload);

      const newItemPayload = {
        name: formData.name,
        quantity: parseFloat(formData.quantity) || 0,
        baseUnit: baseUnitName,
        sellingPrice: parseFloat(formData.sellingPrice) || 0,
        buyingPrice: parseFloat(formData.buyingPrice) || 0,
        profitMarginPercentage: parseFloat(formData.profitMarginPercentage) || 20,
        units: unitsPayload,
        gstRate: parseFloat(formData.gstRate) || 0,
        hsnCode: formData.hsnCode || "",
        category: formData.category,
        maxDiscountPercentage: parseFloat(formData.maxDiscountPercentage) || 0,
        lowStockThreshold: parseFloat(formData.lowStockThreshold) || 5,
        image: formData.image || "",
        status: user.role === "user" ? "pending_review" : "approved"
      };

      await apiClient("/items", { method: "POST", body: newItemPayload });
      await fetchItems();
      setShowAddItemModal(false);
      setFormData({
        ...formData,
        name: "",
        quantity: "",
        sellingPrice: "",
        buyingPrice: "",
        profitMarginPercentage: "",
        gstRate: "0",
        hsnCode: "",
        baseUnit: "nos",
        units: [initialUnit],
        category: "",
        maxDiscountPercentage: "",
        lowStockThreshold: "5",
        image: "",
      });
      setError(null);
      showToast("Item added successfully!", true);
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to add item.", user);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetFormData = () => {
    setFormData({
      name: "",
      quantity: "0.00",
      baseUnit: "nos", // <-- lowercase
      sellingPrice: "",
      buyingPrice: "",
      profitMarginPercentage: "20",
      units: [{ name: "nos", isBaseUnit: true, conversionFactor: 1 }], // <-- lowercase
      gstRate: "0",
      hsnCode: "",
      category: "",
      maxDiscountPercentage: "",
      lowStockThreshold: "5",
      image: "",
    });
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
        body: { categoryName: newCategoryName },
      });
      showToast(`Category "${newCategoryName}" is now available.`, true);
      await fetchCategories();
      setFormData((prev) => ({ ...prev, category: newCategoryName }));
      setIsAddingNewCategory(false);
      setNewCategoryName("");
    } catch (err) {
      handleApiError(err, "Failed to add category.", user);
    } finally {
      setIsSubmittingCategory(false);
    }
  };

  const handleApproveItem = async (itemId) => {
    if (!window.confirm("Are you sure you want to approve this item?")) return;
    setIsSubmitting(true);
    try {
      await apiClient(`/items/${itemId}/approve`, { method: "PATCH" });
      showToast("Item approved successfully!", true);
      await fetchItems();
      await fetchPendingReviewItems();
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to approve item.", user);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        setIsSubmitting(true);
        await apiClient(`/items/${id}`, { method: "DELETE" });
        await fetchItems();
        await fetchPendingReviewItems();
        showToast("Item Deleted Successfully", true);
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

  const toggleExpandedRow = (id) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  const handleShowItemHistoryPage = (item) => {
    navigate(`/items/history/${item._id}`);
  };

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
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
    isSubmitting || isProcessingExcel || isExportingExcel || loading;

  const renderUnitManagement = () => (
    <div className="col-12 mt-3 pt-3 border-top">
      <h5>Pricing & Units</h5>
      <div className="row">
        <div className="col-md-4">
          <label>
            Buying Price (per Base Unit) <span className="text-danger">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            className="form-control mb-2"
            placeholder="Buying Price"
            name="buyingPrice"
            value={formData.buyingPrice}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                buyingPrice: e.target.value,
              }))
            }
          />
        </div>
        <div className="col-md-4">
          <label>
            Selling Price (per Base Unit) <span className="text-danger">*</span>
          </label>
          <input
            type="number"
            step="0.01"
            className="form-control mb-2"
            placeholder="Selling Price"
            name="sellingPrice"
            value={formData.sellingPrice}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                sellingPrice: e.target.value,
              }))
            }
            required
          />
        </div>
        <div className="col-md-4">
          <label>Profit Margin (%)</label>
          <input
            type="number"
            step="0.01"
            className="form-control mb-2"
            placeholder="e.g., 20"
            name="profitMarginPercentage"
            value={formData.profitMarginPercentage}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                profitMarginPercentage: e.target.value,
              }))
            }
            min="0"
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
            {(formData.units || [])
              .filter(
                unit =>
                  unit &&
                  typeof unit === "object" &&
                  unit.name &&
                  STANDARD_UNITS.includes(unit.name.toLowerCase())
              )
              .map((unit, index) => (
                <tr key={index}>
                  <td>
                    <select
                      className="form-control form-control-sm"
                      value={unit?.name || ""}
                      onChange={(e) => handleUnitNameChange(index, e.target.value)}
                      disabled={unit?.isBaseUnit}
                    >
                      {STANDARD_UNITS.map((unitName) => (
                        <option key={unitName} value={unitName}>
                          {unitName}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <input
                      type="number"
                      step="any"
                      className="form-control form-control-sm"
                      value={unit?.conversionFactor || 1}
                      disabled={unit?.isBaseUnit}
                      onChange={(e) =>
                        handleUnitConversionChange(index, e.target.value)
                      }
                    />
                  </td>
                  <td className="text-center align-middle">
                    <input
                      type="radio"
                      className="form-check-input"
                      name="isBaseUnit"
                      checked={unit?.isBaseUnit || false}
                      onChange={() => handleSetBaseUnit(index)}
                    />
                  </td>
                  <td>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleRemoveUnit(index)}
                      disabled={formData.units.length <= 1 || unit.isBaseUnit}
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
        variant="outline-primary"
        size="sm"
        onClick={handleAddUnit}
        disabled={formData.units.length >= STANDARD_UNITS.length}
      >
        + Add Unit
      </Button>
    </div>
  );

  const renderUnitsDisplay = (item) => (
    <td>
      {Array.isArray(item.units) && item.units.length > 0
        ? item.units
            .filter(unit => unit && typeof unit === 'object' && unit.name)
            .map((u, idx) => (
              <div key={u.name || idx}>
                {u.name} (
                {u.conversionFactor || 0} {u.name} = 1 {item.baseUnit})
                {u.isBaseUnit && " (Base Unit)"}
              </div>
            ))
        : "N/A"}
    </td>
  );

  // Add these helper functions before your renderUnitManagement definition:

  const handleAddUnit = () => {
    setFormData((prev) => {
      // Find first unused unit name
      const usedNames = prev.units.map((u) => u.name);
      const available = STANDARD_UNITS.find((u) => !usedNames.includes(u));
      if (!available) return prev;
      return {
        ...prev,
        units: [
          ...prev.units,
          { name: available, isBaseUnit: false, conversionFactor: 1 },
        ],
      };
    });
  };

  const handleRemoveUnit = (index) => {
    setFormData((prev) => {
      let units = [...prev.units];
      units.splice(index, 1);
      // Ensure at least one base unit remains
      if (!units.some((u) => u.isBaseUnit)) {
        units[0].isBaseUnit = true;
        units[0].conversionFactor = 1;
      }
      return { ...prev, units, baseUnit: units.find((u) => u.isBaseUnit).name };
    });
  };

  const handleUnitNameChange = (index, value) => {
    setFormData((prev) => {
      const units = [...prev.units];
      units[index].name = value.toLowerCase(); // <-- force lowercase
      // If this is the base unit, update baseUnit field
      if (units[index].isBaseUnit) {
        return { ...prev, units, baseUnit: value.toLowerCase() }; // <-- force lowercase
      }
      return { ...prev, units };
    });
  };

  const handleUnitConversionChange = (index, value) => {
    setFormData((prev) => {
      const units = [...prev.units];
      units[index].conversionFactor = units[index].isBaseUnit ? 1 : parseFloat(value) || 1;
      return { ...prev, units };
    });
  };

  const handleSetBaseUnit = (index) => {
    setFormData((prev) => {
      const units = prev.units.map((u, i) => ({
        ...u,
        isBaseUnit: i === index,
        conversionFactor: i === index ? 1 : u.conversionFactor,
      }));
      return { ...prev, units, baseUnit: units[index].name.toLowerCase() }; // <-- force lowercase
    });
  };

  return (
    <div className="items-container">
      <Navbar />
      <div className="container mt-4">
        {error && !showAddItemModal && !showEditItemModal && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        {excelUpdateStatus.error && (
          <div className="alert alert-danger" role="alert">
            Excel Update Error: {excelUpdateStatus.error}
          </div>
        )}

        {/* Pending Review Items Section */}
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
                              onClick={() => handleEditItem(item)}
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

        {/* Main Items Table Section */}
        <div className="mb-3">
          <div
            className="d-flex align-items-center justify-content-between mb-3"
            style={{ width: "100%", minWidth: "100%" }}
          >
            <div style={{ flexShrink: 0, minWidth: "200px" }}>
              <h2 style={{ color: "black", margin: 0, whiteSpace: "nowrap" }}>
                {stockAlertFilterActive
                  ? `Stock Alerts (Qty < ${
                      parseInt(stockAlertsPageFilterThreshold, 10) ||
                      effectiveLowStockThreshold
                    })`
                  : user &&
                    (user.role === "admin" || user.role === "super-admin")
                  ? "Items List (Approved)"
                  : "All Items List"}
              </h2>
            </div>

            <div
              style={{
                flexGrow: 1,
                flexShrink: 1,
                minWidth: "200px",
                maxWidth: "400px",
                margin: "0 10px",
              }}
            >
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

            <div
              style={{
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: "8px",
                whiteSpace: "nowrap",
              }}
            >
              {stockAlertFilterActive ? (
                <>
                  <label
                    htmlFor="stockAlertThresholdInput"
                    className="mb-0 me-1"
                  >
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
                    onKeyPress={(e) =>
                      e.key === "Enter" && applyStockAlertFilter()
                    }
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
                    onClick={() =>
                      handleUpdateGlobalLowStockThreshold(
                        stockAlertsPageFilterThreshold
                      )
                    }
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
                    onChange={(e) =>
                      setQuantityFilterInputValue(e.target.value)
                    }
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

        {/* Excel Upload Input (hidden) */}
        <input
          type="file"
          id="excel-upload-input"
          style={{ display: "none" }}
          accept=".xlsx, .xls"
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              setIsProcessingExcel(true);
              const formData = new FormData();
              formData.append("excelFile", file);
              apiClient("items/import-uploaded-excel", {
                method: "POST",
                body: formData,
              })
                .then((response) => {
                  showToast("Items imported successfully!", true);
                  fetchItems();
                })
                .catch((err) => {
                  handleApiError(err, "Failed to import items.", user);
                })
                .finally(() => {
                  setIsProcessingExcel(false);
                  e.target.value = null;
                });
            }
          }}
          disabled={anyLoading}
        />

        {/* Main Items Table */}
        <div className="table-responsive">
          <table className="table table-striped table-bordered">
            <thead className="table-dark">
              <tr>
                {[
                  "name",
                  "quantity",
                  "sellingPrice",
                  "buyingPrice",
                  "baseUnit",
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
                      <td>{item.name}</td>
                      <td>
                        {parseFloat(item.quantity || 0).toFixed(2)}{" "}
                        {item.baseUnit || ""}{" "}
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
                      </td>
                      <td>{`₹${parseFloat(item.sellingPrice || 0).toFixed(
                        2
                      )}`}</td>
                      <td>{`₹${parseFloat(item.buyingPrice || 0).toFixed(
                        2
                      )}`}</td>
                      <td>{item.baseUnit || "N/A"}</td>
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
                            onClick={() => handleShowItemHistoryPage(item)}
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
                                <tr>
                                  <td>
                                    <strong>Quantity</strong>
                                  </td>
                                  <td>
                                    {parseFloat(item.quantity || 0).toFixed(2)}{" "}
                                    {item.quantity <= 0 || item.needsRestock
                                      ? item.quantity <= 0
                                        ? " (Out of stock! Needs immediate restock.)"
                                        : ` (Below item's restock threshold: ${
                                            item.lowStockThreshold || "Not Set"
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
                                  <td>{`₹${parseFloat(
                                    item.sellingPrice || 0
                                  ).toFixed(2)} per ${item.baseUnit}`}</td>
                                </tr>
                                <tr>
                                  <td>
                                    <strong>Buying Price</strong>
                                  </td>
                                  <td>{`₹${parseFloat(
                                    item.buyingPrice || 0
                                  ).toFixed(2)} per ${item.baseUnit}`}</td>
                                </tr>
                                <tr>
                                  <td>
                                    <strong>Units</strong>
                                  </td>
                                  <td colSpan="100">
                                    <table className="table table-bordered table-sm mb-0">
                                      <thead>
                                        <tr>
                                          <th>Unit Name</th>
                                          <th>Conversion Factor</th>
                                          <th>Is Base Unit?</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {Array.isArray(item.units) && item.units.length > 0 ? (
                                          item.units
                                            .filter(unit => unit && typeof unit === 'object' && unit.name)
                                            .map((u, idx) => (
                                              <tr key={u.name || idx}>
                                                <td>{u.name}</td>
                                                <td>
                                                  {u.isBaseUnit
                                                    ? "1 (Base Unit)"
                                                    : `${Number(
                                                        typeof u.conversionFactor === "object"
                                                          ? Object.values(u.conversionFactor)[0]
                                                          : u.conversionFactor
                                                      ) || 0} ${u.name} = 1 ${item.baseUnit}`}
                                                </td>
                                                <td>{u.isBaseUnit ? "Yes" : ""}</td>
                                              </tr>
                                            ))
                                        ) : (
                                          <tr>
                                            <td colSpan={3}>N/A</td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </td>
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
              resetFormData();
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
                    resetFormData();
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
                      name="quantity"
                      value={formData.quantity}
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
                {renderUnitManagement()}
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
                    !formData.sellingPrice ||
                    !formData.category ||
                    isSubmitting
                  }
                >
                  {parseFloat(formData.buyingPrice) >
                    parseFloat(formData.sellingPrice) &&
                    formData.sellingPrice !== "0" && (
                      <Alert variant="warning" className="p-2 small mb-0 me-2">
                        Buying price cannot be greater than Selling price (if
                        Selling Price is not 0)!
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
                      value={formData.quantity}
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
                {renderUnitManagement()}
              </div>
            </>
          </ReusableModal>
        )}
      </div>
      <Footer />
    </div>
  );
}