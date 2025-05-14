import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import "../css/Items.css";
import Navbar from "../components/Navbar.jsx";

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
    discountAvailable: false,
    dynamicPricing: false,
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

  const showSuccess = (message) => {
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
      const response = await axios.get("http://localhost:3000/api/items");
      debug("Items fetched successfully", response.data);
      setItems(response.data);
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
      const response = await axios.get(
        "http://localhost:3000/api/items/categories",
        {
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 5000, // 5 second timeout
        }
      );

      if (!response.data) {
        throw new Error("Received empty response from server");
      }

      debug("Categories data received", response.data);
      setCategories(response.data);
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
  }, [itemSearchTerm, items]);

  const fetchPurchaseHistory = useCallback(async (itemId) => {
    try {
      // Set loading state for this specific item
      setPurchaseHistoryLoading(prev => ({ ...prev, [itemId]: true }));
      // Clear any previous errors
      setError(null);

      const response = await axios.get(
        `http://localhost:3000/api/items/${itemId}/purchases`,
        {
          timeout: 5000,
          headers: {
            'Cache-Control': 'no-cache'
          }
        }
      );

      setPurchaseHistory(prev => ({
        ...prev,
        [itemId]: response.data || []
      }));
    } catch (err) {
      console.error("Fetch purchase history error:", err);
      setError(`Failed to load history: ${err.response?.data?.message || err.message}`);
      setPurchaseHistory(prev => ({
        ...prev,
        [itemId]: []
      }));
    } finally {
      // Clear loading state for this specific item
      setPurchaseHistoryLoading(prev => ({ ...prev, [itemId]: false }));
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
      discountAvailable: item.discountAvailable || false,
      dynamicPricing: item.dynamicPricing || false,
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
        discountAvailable: formData.discountAvailable,
        dynamicPricing: formData.dynamicPricing,
      };

      await axios.put(
        `http://localhost:3000/api/items/${editingItem}`,
        updatedItem
      );
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
    let sortableItems = [...items];
    sortableItems.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
    return sortableItems;
  }, [items, sortConfig]);

  const filteredItems = useMemo(() => {
    return sortedItems.filter((item) => {
      const matchesCategory =
        selectedCategory === "All" || item.category === selectedCategory;
      const matchesSubcategory =
        selectedSubcategory === "All" || item.subcategory === selectedSubcategory;
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

  const totalPages = useMemo(() => Math.ceil(filteredItems.length / itemsPerPage), [filteredItems, itemsPerPage]);

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
        discountAvailable: formData.discountAvailable,
        dynamicPricing: formData.dynamicPricing,
      };

      await axios.post("http://localhost:3000/api/items", newItem);
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
        discountAvailable: false,
        dynamicPricing: false,
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
        await axios.delete(`http://localhost:3000/api/items/${id}`);
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

      await axios.post(
        `http://localhost:3000/api/items/purchase`,
        purchaseDataToSend
      );

      await fetchItems();
      setShowPurchaseModal(false);
      resetPurchaseForm();
      showSuccess("Purchase added successfully!");
      return true;
    } catch (err) {
      console.error("Error adding purchase entry:", err);
      setError(
        `Failed to add purchase entry: ${err.response?.data?.message || err.message}`
      );
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="items-container">
      <Navbar showPurchaseModal={openPurchaseModal} />
      <div className="container mt-4">
        <h2 style={{ color: "black" }}>Items List</h2>

        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}

        <div className="top-controls-container">
          <div className="controls-row">
            <button
              onClick={() => setShowModal(true)}
              className="btn btn-success px-4"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Processing..." : "Add Item"}
            </button>

            <select
              className="form-select"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedSubcategory("All");
                setCurrentPage(1);
              }}
              disabled={isSubmitting}
            >
              <option value="All">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.category} value={cat.category}>
                  {cat.category}
                </option>
              ))}
            </select>

            <select
              className="form-select"
              value={selectedSubcategory}
              onChange={(e) => {
                setSelectedSubcategory(e.target.value);
                setCurrentPage(1);
              }}
              disabled={selectedCategory === "All" || isSubmitting}
            >
              <option value="All">All Subcategories</option>
              {selectedCategory !== "All" &&
                categories
                  .find((c) => c.category === selectedCategory)
                  ?.subcategories.map((subcat) => (
                    <option key={subcat} value={subcat}>
                      {subcat}
                    </option>
                  ))}
            </select>

            <input
              type="text"
              placeholder="Search items or HSN codes..."
              value={searchTerm}
              onChange={handleSearchChange}
              className="form-control search-input"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="table-responsive">
          <table className="table table-striped table-bordered">
            <thead className="table-dark">
              <tr>
                {[
                  "name",
                  "category",
                  "subcategory",
                  "quantity",
                  "price",
                  "unit",
                  "gstRate",
                  "image"  // Added image column
                ].map((key) => (
                  <th
                    key={key}
                    onClick={() => !isSubmitting && requestSort(key)}
                    style={{ cursor: isSubmitting ? "not-allowed" : "pointer" }}
                  >
                    {key.charAt(0).toUpperCase() +
                      key.slice(1).replace(/([A-Z])/g, " $1")}
                    {sortConfig.key === key &&
                      (sortConfig.direction === "asc" ? " ↑" : " ↓")}
                  </th>
                ))}
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
                            disabled={isSubmitting}
                          />
                        ) : (
                          item.name
                        )}
                      </td>
                      <td>{item.category || "-"}</td>
                      <td>{item.subcategory || "-"}</td>
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
                            disabled={isSubmitting}
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
                            disabled={isSubmitting}
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
                            disabled={isSubmitting}
                          />
                        ) : (
                          `${item.gstRate}%`
                        )}
                      </td>
                      <td>
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="item-image"
                            onClick={() => window.open(item.image, '_blank')}
                          />
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
                                disabled={isSubmitting}
                              >
                                {isSubmitting ? "Saving..." : "Save"}
                              </button>
                              <button
                                onClick={handleCancel}
                                className="btn btn-secondary btn-sm"
                                disabled={isSubmitting}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEdit(item)}
                                className="btn btn-primary btn-sm"
                                disabled={isSubmitting}
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => handleDelete(item._id)}
                                className="btn btn-danger btn-sm"
                                disabled={isSubmitting}
                              >
                                🗑️
                              </button>
                              <button
                                onClick={() => toggleDetails(item._id)}
                                className="btn btn-info btn-sm"
                                disabled={isSubmitting}
                              >
                                👁️
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
                                <p><strong>Name:</strong> {item.name}</p>
                                <p><strong>Category:</strong> {item.category || "-"}</p>
                                <p><strong>Subcategory:</strong> {item.subcategory || "-"}</p>
                                <p><strong>Quantity:</strong> {item.quantity}</p>
                              </div>
                              <div className="col-md-6">
                                <p><strong>Price:</strong> ₹{item.price.toFixed(2)}</p>
                                <p><strong>Unit:</strong> {item.unit || "Nos"}</p>
                                <p><strong>GST Rate:</strong> {item.gstRate}%</p>
                                <p><strong>HSN Code:</strong> {item.hsnCode || "-"}</p>
                              </div>
                            </div>

                            <div className="d-flex justify-content-between align-items-center mb-3 mt-3">
                              <h6>Purchase History</h6>
                            </div>
                            {purchaseHistory[item._id]?.length > 0 ? (
                              <table className="table table-sm table-striped table-bordered">
                                <thead>
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
          {/* </table> */}

          {filteredItems.length > 0 && (
            <div className="d-flex justify-content-center gap-3 mt-2">
              <button
                className="btn btn-sm btn-outline-dark"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1 || isSubmitting}
              >
                ← Prev
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                className="btn btn-sm btn-outline-dark"
                onClick={() =>
                  setCurrentPage((p) => Math.min(p + 1, totalPages))
                }
                disabled={currentPage === totalPages || isSubmitting}
              >
                Next →
              </button>
            </div>
          )}
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
                      discountAvailable: false,
                      dynamicPricing: false,
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
                        {categories.map((cat) => (
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
                          setFormData({ ...formData, subcategory: e.target.value })
                        }
                        disabled={!formData.category}
                      >
                        <option value="General">General</option>
                        {formData.category &&
                          categories
                            .find(c => c.category === formData.category)?.subcategories
                            .map((subcat) => (
                              <option key={subcat} value={subcat}>
                                {subcat}
                              </option>
                            ))}
                      </select>
                    </div>

                    <div className="form-check mb-2">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="discountAvailable"
                        checked={formData.discountAvailable}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            discountAvailable: e.target.checked,
                          })
                        }
                      />
                      <label className="form-check-label" htmlFor="discountAvailable">
                        Discount Available
                      </label>
                    </div>

                    <div className="form-check mb-2">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="dynamicPricing"
                        checked={formData.dynamicPricing}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            dynamicPricing: e.target.checked,
                          })
                        }
                      />
                      <label className="form-check-label" htmlFor="dynamicPricing">
                        Dynamic Pricing
                      </label>
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
                      discountAvailable: false,
                      dynamicPricing: false,
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
                  disabled={!formData.name || !formData.price || !formData.category}
                >
                  Add Item
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
