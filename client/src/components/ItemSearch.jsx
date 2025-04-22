import React, { useState, useEffect } from "react";
import axios from "axios";
import "../css/ItemSearchComponent.css"; // We'll create this CSS file later

const getAuthToken = () => {
    try {
      const userData = JSON.parse(localStorage.getItem("erp-user"));
      if (!userData || typeof userData !== "object") {
        return null;
      }
      return userData.token;
    } catch (e) {
      console.error("Failed to parse user data:", e);
      return null;
    }
  };

const ItemSearchComponent = ({ 
  onItemSelect, 
  placeholder = "Search item by name or HSN...",
  className = "",
  disabled = false,
  authToken
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch items on component mount
  useEffect(() => {
    fetchItems();
  }, []);

  // Filter items when search term changes
  useEffect(() => {
    if (searchTerm.trim() !== "") {
      const filtered = items.filter(
        (item) =>
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (item.hsnCode &&
            item.hsnCode.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredItems(filtered);
      setShowDropdown(true);
    } else {
      setFilteredItems([]);
      setShowDropdown(false);
    }
  }, [searchTerm, items]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = getAuthToken();
      if (!token) {
        throw new Error("Authentication token not found");
      }
      
      const response = await axios.get("http://localhost:3000/api/items", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setItems(response.data);
    } catch (err) {
      console.error("Error fetching items:", err);
      setError("Failed to load items. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item) => {
    onItemSelect(item);
    setSearchTerm("");
    setShowDropdown(false);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleBlur = () => {
    // Delay hiding dropdown to allow click events to register
    setTimeout(() => setShowDropdown(false), 200);
  };

  return (
    <div className={`item-search-component ${className}`}>
      {error && <div className="search-error">{error}</div>}
      
      <div className="search-input-container">
        <input
          type="text"
          className="form-control"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleSearchChange}
          onFocus={() => setShowDropdown(true)}
          onBlur={handleBlur}
          disabled={disabled || loading}
        />
        {loading && <div className="search-loading">Loading...</div>}
      </div>

      {showDropdown && filteredItems.length > 0 && (
        <div className="search-suggestions-dropdown">
          {filteredItems.map((item) => (
            <div
              key={item._id}
              className="search-suggestion-item"
              onClick={() => handleItemClick(item)}
            >
              <strong>{item.name}</strong>
              <span className="text-muted"> - ₹{item.price.toFixed(2)}</span>
              <br />
              <small>
                HSN: {item.hsnCode || "N/A"}, GST: {item.gstRate || 0}%
              </small>
            </div>
          ))}
        </div>
      )}

      {showDropdown && searchTerm && filteredItems.length === 0 && (
        <div className="search-no-results">No items found</div>
      )}
    </div>
  );
};

export default ItemSearchComponent;