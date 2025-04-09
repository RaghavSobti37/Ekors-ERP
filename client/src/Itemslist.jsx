import React, { useState, useEffect } from "react";
import axios from "axios";
import "./css/Items.css";
import Navbar from "./components/Navbar.jsx";

export default function Items() {
  const [items, setItems] = useState([]);
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
    gstRate: "",
    hsnCode: "",
  });
  const [showModal, setShowModal] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [purchaseHistory, setPurchaseHistory] = useState({});
  const [purchaseSearchTerm, setPurchaseSearchTerm] = useState("");
  const [purchaseSearchSuggestions, setPurchaseSearchSuggestions] = useState(
    []
  );
  const [purchaseLoading, setPurchaseLoading] = useState(false);

  const [purchaseData, setPurchaseData] = useState({
    companyName: "",
    gstNumber: "",
    address: "",
    stateName: "",
    invoiceNumber: "",
    invoiceDate: "",
    itemsPurchased: [
      {
        name: "",
        description: "",
        price: "",
        quantity: "",
        hsnCode: "",
        gstRate: "",
        itemId: null,
      },
    ],
  });

  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    fetchItems();
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

  const fetchPurchaseHistory = async (itemId) => {
    try {
      const response = await axios.get(
        `http://localhost:3000/api/items/${itemId}/purchases`
      );
      setPurchaseHistory((prev) => ({
        ...prev,
        [itemId]: response.data,
      }));
    } catch (error) {
      console.error("Error fetching purchase history:", error);
      alert("Failed to load purchase history.");
    }
  };

  const validateNumberInput = (value, fieldName) => {
    if (isNaN(value)) {
      alert(`Please enter a valid number for ${fieldName}`);
      return false;
    }
    if (value < 0) {
      alert(`Please enter a positive number for ${fieldName}`);
      return false;
    }
    return true;
  };

  const handleCancel = () => {
    setEditingItem(null);
  };

  const handleEdit = (item) => {
    setEditingItem(item._id);
    setFormData({
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      gstRate: item.gstRate,
      hsnCode: item.hsnCode || "",
    });
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value.toLowerCase());
    setCurrentPage(1); // Reset to first page when searching
  };

  const handlePurchaseSearchChange = (e, index) => {
    const term = e.target.value.toLowerCase();
    setPurchaseSearchTerm(term);
    setCurrentItemIndex(index);

    if (term.length > 1) {
      const suggestions = items
        .filter(
          (item) =>
            item.name.toLowerCase().includes(term) ||
            (item.hsnCode && item.hsnCode.toLowerCase().includes(term))
        )
        .slice(0, 5);
      setPurchaseSearchSuggestions(suggestions);
    } else {
      setPurchaseSearchSuggestions([]);
    }
  };

  const selectSuggestion = (item, index) => {
    const updatedItems = [...purchaseData.itemsPurchased];

    updatedItems[index] = {
      ...updatedItems[index],
      name: item.name,
      price: item.price,
      hsnCode: item.hsnCode || "",
      gstRate: item.gstRate || 0,
      itemId: item._id,
    };

    setPurchaseData({
      ...purchaseData,
      itemsPurchased: updatedItems,
    });
    setPurchaseSearchSuggestions([]);
    setPurchaseSearchTerm("");
  };

  const handleSave = async () => {
    if (!formData.name) {
      alert("Item name is required");
      return;
    }

    try {
      await axios.put(`http://localhost:3000/api/items/${editingItem}`, {
        ...formData,
        quantity: parseInt(formData.quantity) || 0,
        price: parseFloat(formData.price) || 0,
        gstRate: parseFloat(formData.gstRate) || 0,
      });
      await fetchItems();
      setEditingItem(null);
    } catch (error) {
      console.error("Error updating item:", error);
      alert("Failed to update item. Please try again.");
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

  const filteredItems = sortedItems.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.hsnCode &&
        item.hsnCode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
      await axios.post("http://localhost:3000/api/items", {
        ...formData,
        quantity: parseInt(formData.quantity) || 0,
        price: parseFloat(formData.price) || 0,
        gstRate: parseFloat(formData.gstRate) || 0,
      });
      await fetchItems();
      setShowModal(false);
      setFormData({
        name: "",
        quantity: "",
        price: "",
        gstRate: "",
        hsnCode: "",
      });
    } catch (error) {
      console.error("Error adding item:", error);
      alert("Failed to add item. Please try again.");
    }
  };

  const handlePurchaseChange = (e) => {
    setPurchaseData({ ...purchaseData, [e.target.name]: e.target.value });
  };

  const handleItemChange = (index, field, value) => {
    if (["price", "quantity", "gstRate"].includes(field)) {
      if (!validateNumberInput(value, field)) return;
    }

    const updatedItems = [...purchaseData.itemsPurchased];
    updatedItems[index][field] = value;
    setPurchaseData({ ...purchaseData, itemsPurchased: updatedItems });
  };

  const addPurchaseItemRow = () => {
    setPurchaseData({
      ...purchaseData,
      itemsPurchased: [
        ...purchaseData.itemsPurchased,
        {
          name: "",
          description: "",
          price: "",
          quantity: "",
          hsnCode: "",
          gstRate: "",
          itemId: null,
        },
      ],
    });
  };

  const removePurchaseItemRow = (index) => {
    if (purchaseData.itemsPurchased.length <= 1) {
      alert("At least one item is required");
      return;
    }

    const updatedItems = [...purchaseData.itemsPurchased];
    updatedItems.splice(index, 1);
    setPurchaseData({
      ...purchaseData,
      itemsPurchased: updatedItems,
    });
  };

  const toggleDetails = async (id) => {
    if (expandedRow !== id) {
      await fetchPurchaseHistory(id);
    }
    setExpandedRow(expandedRow === id ? null : id);
  };

  const validatePurchaseData = () => {
    if (!purchaseData.companyName.trim()) {
      alert("Company name is required");
      return false;
    }
    if (!purchaseData.invoiceNumber.trim()) {
      alert("Invoice number is required");
      return false;
    }
    if (!purchaseData.invoiceDate) {
      alert("Invoice date is required");
      return false;
    }

    const hasValidItems = purchaseData.itemsPurchased.some(
      (item) => item.name && item.quantity && item.price
    );

    if (!hasValidItems) {
      alert("Please add at least one item with name, quantity, and price");
      return false;
    }

    return true;
  };

  const handleSubmitPurchase = async () => {
    if (!validatePurchaseData()) return;

    setPurchaseLoading(true);

    try {
      const purchasePromises = purchaseData.itemsPurchased
        .filter((item) => item.name && item.quantity && item.price)
        .map((item) => {
          const purchaseEntry = {
            date: purchaseData.invoiceDate,
            companyName: purchaseData.companyName,
            gstNumber: purchaseData.gstNumber,
            address: purchaseData.address,
            stateName: purchaseData.stateName,
            invoiceNumber: purchaseData.invoiceNumber,
            quantity: parseInt(item.quantity),
            price: parseFloat(item.price),
            description: item.description || "",
            gstRate: parseFloat(item.gstRate) || 0,
          };

          if (item.itemId) {
            return axios.post(
              `http://localhost:3000/api/items/${item.itemId}/purchases`,
              purchaseEntry
            );
          } else {
            return axios.post("http://localhost:3000/api/items", {
              name: item.name,
              quantity: parseInt(item.quantity) || 0,
              price: parseFloat(item.price) || 0,
              gstRate: parseFloat(item.gstRate) || 0,
              hsnCode: item.hsnCode || "",
              purchaseHistory: [purchaseEntry],
            });
          }
        });

      await Promise.all(purchasePromises);

      await fetchItems();
      setShowPurchaseModal(false);
      setPurchaseData({
        companyName: "",
        gstNumber: "",
        address: "",
        stateName: "",
        invoiceNumber: "",
        invoiceDate: "",
        itemsPurchased: [
          {
            name: "",
            description: "",
            price: "",
            quantity: "",
            hsnCode: "",
            gstRate: "",
            itemId: null,
          },
        ],
      });

      setExpandedRow(null);
      alert("Purchase submitted successfully!");
    } catch (error) {
      console.error("Error submitting purchase:", error);
      alert(
        `Failed to submit purchase: ${
          error.response?.data?.message || error.message
        }`
      );
    } finally {
      setPurchaseLoading(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div className="items-container">
      <Navbar />
      <div className="container mt-4">
        <h2>Items List</h2>

        {/* <button 
  onClick={async () => {
    if(window.confirm('This will reset all items. Are you sure?')) {
      try {
        const response = await axios.post('http://localhost:3000/api/init/initialize');
        alert(response.data.message);
        fetchItems(); // Refresh your items list
      } catch (error) {
        console.error('Initialization failed:', error);
        alert('Failed to initialize database');
      }
    }
  }} 
  className="btn btn-warning mx-2"
>
  Reset Database
</button> */}

        <div className="mb-3 d-flex gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="btn btn-success px-4"
          >
            Add Item
          </button>
          <button
            onClick={() => setShowPurchaseModal(true)}
            className="btn btn-primary px-4"
          >
            Add Purchase
          </button>
          <input
            type="text"
            placeholder="Search items or HSN codes..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="form-control"
          />
        </div>

        <div className="table-responsive">
          <table className="table table-striped table-bordered">
            <thead className="table-dark">
              <tr>
                {["name", "quantity", "price", "gstRate", "hsnCode"].map(
                  (key) => (
                    <th
                      key={key}
                      onClick={() => requestSort(key)}
                      style={{ cursor: "pointer" }}
                    >
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                      {sortConfig.key === key &&
                        (sortConfig.direction === "asc" ? " ↑" : " ↓")}
                    </th>
                  )
                )}
                <th>Actions</th>
                <th>Details</th>
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
                        {editingItem === item._id ? (
                          <div className="d-flex gap-1">
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
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(item)}
                            className="btn btn-primary btn-sm"
                          >
                            Edit
                          </button>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => toggleDetails(item._id)}
                          className="btn btn-info btn-sm"
                        >
                          {expandedRow === item._id ? "Hide" : "Show"} Details
                        </button>
                      </td>
                    </tr>

                    {expandedRow === item._id && (
                      <tr>
                        <td colSpan="7" className="expanded-row">
                          <div className="expanded-container">
                            <h6>Purchase History</h6>
                            {purchaseHistory[item._id]?.length > 0 ? (
                              <table className="table table-sm table-striped table-bordered">
                                <thead>
                                  <tr>
                                    <th>Date</th>
                                    <th>Supplier</th>
                                    <th>Invoice No</th>
                                    <th>Quantity</th>
                                    <th>Price</th>
                                    <th>Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {purchaseHistory[item._id].map(
                                    (purchase, idx) => (
                                      <tr key={idx}>
                                        <td>
                                          {new Date(
                                            purchase.date
                                          ).toLocaleDateString()}
                                        </td>
                                        <td>{purchase.companyName}</td>
                                        <td>{purchase.invoiceNumber}</td>
                                        <td>{purchase.quantity}</td>
                                        <td>
                                          ₹
                                          {parseFloat(purchase.price).toFixed(
                                            2
                                          )}
                                        </td>
                                        <td>
                                          ₹
                                          {(
                                            parseFloat(purchase.price) *
                                            parseInt(purchase.quantity)
                                          ).toFixed(2)}
                                        </td>
                                      </tr>
                                    )
                                  )}
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
                  <td colSpan="7" className="text-center">
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

        {/* Add Item Modal */}
        {showModal && (
          <div className="modal-backdrop">
            <div className="modal-content">
              <h5>Add New Item</h5>
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
              <div className="d-flex justify-content-end gap-2 mt-3">
                <button
                  onClick={handleAddItem}
                  className="btn btn-success"
                  disabled={!formData.name || !formData.price}
                >
                  Add
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Purchase Modal */}
        {showPurchaseModal && (
          <div className="modal-backdrop">
            <div className="modal-content wide-modal">
              <h5>Purchase Tracking</h5>
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
                </div>
              </div>

              <div className="form-group">
                <label>Invoice Date*</label>
                <input
                  type="date"
                  className="form-control mb-3"
                  name="invoiceDate"
                  value={purchaseData.invoiceDate}
                  onChange={handlePurchaseChange}
                  required
                />
              </div>

              <h6>Items Purchased</h6>
              {purchaseData.itemsPurchased.map((item, idx) => (
                <div
                  key={idx}
                  className="purchase-item-container mb-3 p-3 border rounded"
                >
                  <div className="position-relative">
                    <label>Search Item</label>
                    <input
                      className="form-control mb-2"
                      placeholder="Search item by name or HSN..."
                      value={idx === currentItemIndex ? purchaseSearchTerm : ""}
                      onChange={(e) => handlePurchaseSearchChange(e, idx)}
                      onFocus={() => setCurrentItemIndex(idx)}
                    />

                    {purchaseSearchSuggestions.length > 0 &&
                      currentItemIndex === idx && (
                        <div className="suggestions-dropdown">
                          {purchaseSearchSuggestions.map((suggestion, i) => (
                            <div
                              key={i}
                              className="suggestion-item"
                              onClick={() => selectSuggestion(suggestion, idx)}
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

                  {item.name && (
                    <div className="selected-item-details mb-2 p-2 bg-light border rounded">
                      <strong>{item.name}</strong>
                      <small className="d-block">
                        HSN: {item.hsnCode || "N/A"}, GST: {item.gstRate || 0}%
                      </small>
                    </div>
                  )}

                  <div className="row">
                    <div className="col-md-6">
                      <div className="form-group">
                        <label>Description</label>
                        <input
                          className="form-control mb-2"
                          placeholder="Description"
                          value={item.description || ""}
                          onChange={(e) =>
                            handleItemChange(idx, "description", e.target.value)
                          }
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
                    <div className="col-md-2 d-flex align-items-end">
                      <button
                        onClick={() => removePurchaseItemRow(idx)}
                        className="btn btn-danger btn-block"
                        disabled={purchaseData.itemsPurchased.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              <div className="d-flex justify-content-between mb-3">
                <button
                  onClick={addPurchaseItemRow}
                  className="btn btn-outline-primary"
                >
                  Add Another Item
                </button>
              </div>

              <div className="d-flex justify-content-end gap-2 mt-3">
                <button
                  onClick={handleSubmitPurchase}
                  className="btn btn-success"
                  disabled={
                    purchaseLoading ||
                    !purchaseData.companyName ||
                    !purchaseData.invoiceNumber ||
                    !purchaseData.invoiceDate ||
                    !purchaseData.itemsPurchased.some(
                      (item) => item.name && item.quantity && item.price
                    )
                  }
                >
                  {purchaseLoading ? "Submitting..." : "Submit Purchase"}
                </button>
                <button
                  onClick={() => {
                    setShowPurchaseModal(false);
                    setPurchaseSearchTerm("");
                    setPurchaseSearchSuggestions([]);
                  }}
                  className="btn btn-secondary"
                  disabled={purchaseLoading}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
