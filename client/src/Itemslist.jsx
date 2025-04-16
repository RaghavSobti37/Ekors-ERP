import React, { useState, useEffect } from "react";
import axios from "axios";
import "./css/Items.css";
import Navbar from "./components/Navbar.jsx";

export default function Items() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedSubcategory, setSelectedSubcategory] = useState("All");
  const [purchaseData, setPurchaseData] = useState({
    companyName: "",
    gstNumber: "",
    address: "",
    stateName: "",
    invoiceNumber: "",
    date: new Date().toISOString().split('T')[0],
    quantity: "",
    price: "",
    gstRate: "0",
    description: ""
  });
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);

  useEffect(() => {
    fetchItems();
    fetchCategories();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await axios.get("http://localhost:3000/api/items");
      setItems(response.data);
    } catch (error) {
      console.error("Error fetching items:", error);
      alert("Failed to load items. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await axios.get("http://localhost:3000/api/items/categories");
      setCategories(response.data);
    } catch (error) {
      console.error("Error fetching categories:", error);
      alert("Failed to load categories.");
    }
  };

  const fetchPurchaseHistory = async (itemId) => {
    try {
      const response = await axios.get(`http://localhost:3000/api/items/${itemId}`);
      setPurchaseHistory((prev) => ({
        ...prev,
        [itemId]: response.data.purchaseHistory || [],
      }));
    } catch (error) {
      console.error("Error fetching purchase history:", error);
      alert("Failed to load purchase history.");
    }
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
      alert("Item name is required");
      return;
    }
  
    if (!editingItem) {
      alert("No item selected for editing.");
      return;
    }
  
    try {
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
      
      await axios.put(`http://localhost:3000/api/items/${editingItem}`, updatedItem);
      await fetchItems();
      setEditingItem(null);
    } catch (error) {
      console.error("Error updating item:", error);
      alert(`Failed to update item: ${error.response?.data?.message || error.message}`);
    }
  };

  const requestSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const sortedItems = React.useMemo(() => {
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

  const filteredItems = sortedItems.filter((item) => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const matchesSubcategory = selectedSubcategory === "All" || item.subcategory === selectedSubcategory;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.hsnCode && item.hsnCode.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesCategory && matchesSubcategory && matchesSearch;
  });

  const indexOfLast = currentPage * itemsPerPage;
  const indexOfFirst = indexOfLast - itemsPerPage;
  const currentItems = filteredItems.slice(indexOfFirst, indexOfLast);
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

  const handleAddItem = async () => {
    if (!formData.name) {
      alert("Item name is required");
      return;
    }

    try {
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
    } catch (error) {
      console.error("Error adding item:", error);
      alert("Failed to add item. Please try again.");
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
        await axios.delete(`http://localhost:3000/api/items/${id}`);
        await fetchItems();
      } catch (error) {
        console.error("Error deleting item:", error);
        alert("Failed to delete item.");
      }
    }
  };

  const addPurchaseEntry = async () => {
    try {
      const purchaseDataToSend = {
        ...purchaseData,
        quantity: parseFloat(purchaseData.quantity),
        price: parseFloat(purchaseData.price),
        gstRate: parseFloat(purchaseData.gstRate),
        date: new Date(purchaseData.date)
      };

      await axios.post(
        `http://localhost:3000/api/items/purchase`,
        purchaseDataToSend
      );

      await fetchItems();
      setShowPurchaseModal(false);
      setPurchaseData({
        companyName: "",
        gstNumber: "",
        address: "",
        stateName: "",
        invoiceNumber: "",
        date: new Date().toISOString().split('T')[0],
        quantity: "",
        price: "",
        gstRate: "0",
        description: ""
      });
      return true;
    } catch (error) {
      console.error("Error adding purchase entry:", error);
      alert(`Failed to add purchase entry: ${error.response?.data?.message || error.message}`);
      return false;
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="items-container">
      <Navbar showPurchaseModal={() => setShowPurchaseModal(true)} />
      <div className="container mt-4">
        <h2 style={{ color: "black" }}>Items List</h2>

        <div className="top-controls-container">
          <div className="controls-row">
            <button
              onClick={() => setShowModal(true)}
              className="btn btn-success px-4"
            >
              Add Item
            </button>

            {/* <select
              className="form-select"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedSubcategory("All");
                setCurrentPage(1);
              }}
            >
              <option value="All">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.category} value={cat.category}>
                  {cat.category}
                </option>
              ))}
            </select> */}

            <select
              className="form-select"
              value={selectedSubcategory}
              onChange={(e) => {
                setSelectedSubcategory(e.target.value);
                setCurrentPage(1);
              }}
              disabled={selectedCategory === "All"}
            >
              <option value="All">All Subcategories</option>
              {selectedCategory !== "All" &&
                categories
                  .find(c => c.category === selectedCategory)?.subcategories
                  .map((subcat) => (
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
                  "hsnCode",
                ].map((key) => (
                  <th
                    key={key}
                    onClick={() => requestSort(key)}
                    style={{ cursor: "pointer" }}
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
                          />
                        ) : (
                          `${item.gstRate}%`
                        )}
                      </td>
                      <td>
                        {editingItem === item._id ? (
                          <input
                            className="form-control"
                            name="hsnCode"
                            value={formData.hsnCode}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                hsnCode: e.target.value,
                              })
                            }
                          />
                        ) : (
                          item.hsnCode || "-"
                        )}
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          {editingItem === item._id ? (
                            <>
                              <button
                                onClick={handleSave}
                                className="btn btn-success btn-sm"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancel}
                                className="btn btn-secondary btn-sm"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleEdit(item)}
                                className="btn btn-primary btn-sm"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(item._id)}
                                className="btn btn-danger btn-sm"
                              >
                                Delete
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => toggleDetails(item._id)}
                            className="btn btn-info btn-sm"
                          >
                            {expandedRow === item._id ? "Hide" : "Show"} Details
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedRow === item._id && (
                      <tr>
                        <td colSpan="9" className="expanded-row">
                          <div className="expanded-container">
                            <div className="d-flex justify-content-between align-items-center mb-3">
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
                                  {purchaseHistory[item._id].map((purchase, idx) => (
                                    <tr key={idx}>
                                      <td>{new Date(purchase.date).toLocaleDateString()}</td>
                                      <td>{purchase.companyName}</td>
                                      <td>{purchase.gstNumber || '-'}</td>
                                      <td>{purchase.invoiceNumber}</td>
                                      <td>{purchase.quantity}</td>
                                      <td>₹{parseFloat(purchase.price).toFixed(2)}</td>
                                      <td>₹{(purchase.price * purchase.quantity * (purchase.gstRate / 100)).toFixed(2)}</td>
                                      <td>₹{(purchase.price * purchase.quantity * (1 + purchase.gstRate / 100)).toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <p>No purchase history found for this item.</p>
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

          {filteredItems.length > 0 && (
            <div className="d-flex justify-content-center gap-3 mt-2">
              <button
                className="btn btn-sm btn-outline-dark"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
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
                disabled={currentPage === totalPages}
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
                  }}
                  className="btn btn-secondary"
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

        {/* Purchase Modal */}
        {showPurchaseModal && (
          <div className="modal-backdrop full-screen-modal">
            <div className="modal-content full-screen-content">
              <div className="modal-header">
                <h5 className="modal-title">Add Purchase Entry</h5>
                <button
                  type="button"
                  className="close"
                  onClick={() => {
                    setShowPurchaseModal(false);
                    setPurchaseData({
                      companyName: "",
                      gstNumber: "",
                      address: "",
                      stateName: "",
                      invoiceNumber: "",
                      date: new Date().toISOString().split('T')[0],
                      quantity: "",
                      price: "",
                      gstRate: "0",
                      description: ""
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
                      <label>Company Name*</label>
                      <input
                        className="form-control mb-2"
                        placeholder="Company Name"
                        name="companyName"
                        value={purchaseData.companyName}
                        onChange={handlePurchaseChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>GST Number</label>
                      <input
                        className="form-control mb-2"
                        placeholder="GST Number"
                        name="gstNumber"
                        value={purchaseData.gstNumber}
                        onChange={handlePurchaseChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>Address</label>
                      <input
                        className="form-control mb-2"
                        placeholder="Address"
                        name="address"
                        value={purchaseData.address}
                        onChange={handlePurchaseChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>State</label>
                      <input
                        className="form-control mb-2"
                        placeholder="State Name"
                        name="stateName"
                        value={purchaseData.stateName}
                        onChange={handlePurchaseChange}
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
                      />
                    </div>
                    <div className="form-group">
                      <label>Invoice Date*</label>
                      <input
                        type="date"
                        className="form-control mb-2"
                        name="date"
                        value={purchaseData.date}
                        onChange={handlePurchaseChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Quantity*</label>
                      <input
                        type="number"
                        className="form-control mb-2"
                        placeholder="Quantity"
                        name="quantity"
                        value={purchaseData.quantity}
                        onChange={handlePurchaseChange}
                        required
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
                        value={purchaseData.price}
                        onChange={handlePurchaseChange}
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
                        value={purchaseData.gstRate}
                        onChange={handlePurchaseChange}
                      />
                    </div>
                  </div>
                </div>
                <div className="row">
                  <div className="col-12">
                    <div className="form-group">
                      <label>Description</label>
                      <textarea
                        className="form-control mb-2"
                        placeholder="Description"
                        name="description"
                        value={purchaseData.description}
                        onChange={handlePurchaseChange}
                        rows="3"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  onClick={() => {
                    setShowPurchaseModal(false);
                    setPurchaseData({
                      companyName: "",
                      gstNumber: "",
                      address: "",
                      stateName: "",
                      invoiceNumber: "",
                      date: new Date().toISOString().split('T')[0],
                      quantity: "",
                      price: "",
                      gstRate: "0",
                      description: ""
                    });
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={addPurchaseEntry}
                  className="btn btn-success"
                  disabled={!purchaseData.companyName || !purchaseData.invoiceNumber || !purchaseData.quantity || !purchaseData.price}
                >
                  Add Purchase
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}