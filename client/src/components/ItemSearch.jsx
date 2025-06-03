import React, { useState, useEffect, useRef } from "react";
import "../css/ItemSearchComponent.css";
import apiClient from "../utils/apiClient"; // Utility for making API requests
import { getAuthToken } from "../utils/authUtils"; // Utility for retrieving auth token
import { handleApiError } from "../utils/helpers"; // Utility for consistent API error handling

const ItemSearchComponent = ({ 
  onItemSelect, 
  placeholder = "Search item by name or HSN...",
  className = "",
  disabled = false
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchItems();
  }, []);

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
      updateDropdownPosition();
    } else {
      setFilteredItems([]);
      setShowDropdown(false);
    }
  }, [searchTerm, items]);

  // Update dropdown position when it becomes visible
  useEffect(() => {
    if (showDropdown) {
      updateDropdownPosition();
    }
  }, [showDropdown]);

  const updateDropdownPosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  // Update position on window resize
  useEffect(() => {
    const handleResize = () => {
      if (showDropdown) {
        updateDropdownPosition();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [showDropdown]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = getAuthToken();
      if (!token) {
        throw new Error("Authentication token not found");
      }
      // Use apiClient for the request
      const data = await apiClient("/items");
      setItems(data);
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
    // Increased timeout to give more time for selection
    setTimeout(() => setShowDropdown(false), 300);
  };

  return (
    <div className={`item-search-component ${className}`}>
      {error && <div className="search-error">{error}</div>}
      
      <div className="search-input-container">
        <input
          ref={inputRef}
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
        
        {showDropdown && filteredItems.length > 0 && (
          <div 
            ref={dropdownRef}
            className="search-suggestions-dropdown"
            style={{
              position: 'fixed',
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
              maxHeight: '300px'
            }}
          >
            {filteredItems.map((item) => (
              <div
                key={item._id}
                className="search-suggestion-item"
                onClick={() => handleItemClick(item)}
                onMouseDown={(e) => e.preventDefault()} // Prevent blur event
              >
                <strong>{item.name}</strong> - SP: <span className="text-muted">₹{(item.sellingPrice || 0).toFixed(2)}</span>, BP: <span className="text-muted">₹{(item.buyingPrice || 0).toFixed(2)}</span>
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
    </div>
  );
};

export default ItemSearchComponent;