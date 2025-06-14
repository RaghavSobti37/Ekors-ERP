import React, { useState, useEffect, useRef } from "react";
import "../css/ItemSearchComponent.css";
import apiClient from "../utils/apiClient"; // Utility for making API requests
import { getAuthToken } from "../utils/authUtils"; // Utility for retrieving auth token
import { handleApiError } from "../utils/helpers"; // Utility for consistent API error handling
import ReactDOM from "react-dom";

const ItemSearchComponent = ({
  onItemSelect,
  placeholder = "Search item by name or HSN...",
  className = "",
  disabled = false,
  onDropdownToggle,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });

  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const Z_INDEX_DROPDOWN = 1060;

  // Effect to call onDropdownToggle when showDropdown state changes
  useEffect(() => {
    if (onDropdownToggle) {
      onDropdownToggle(showDropdown);
    }
  }, [showDropdown, onDropdownToggle]);

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
        top: rect.bottom,
        left: rect.left,

        width: rect.width,
      });
    }
  };

  // Update position on window resize
  useEffect(() => {
    const handleReposition = () => {
      if (showDropdown && inputRef.current) {
        updateDropdownPosition();
      }
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
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
          onFocus={() => {
            // Show dropdown on focus only if there's already a search term or to allow typing
            // The main logic for showing dropdown is in the searchTerm effect
            updateDropdownPosition(); // Ensure position is updated on focus
            if (searchTerm || filteredItems.length > 0) setShowDropdown(true);
          }}
          onBlur={handleBlur}
          disabled={disabled || loading}
        />
        {loading && <div className="search-loading">Loading...</div>}
        {/* Portal for suggestions dropdown */}
        {showDropdown &&
          filteredItems.length > 0 &&
          ReactDOM.createPortal(
            <div
              ref={dropdownRef}
              className="search-suggestions-dropdown"
              style={{
                position: "fixed",
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                width: `${dropdownPosition.width}px`,
                maxHeight: "300px",
                zIndex: Z_INDEX_DROPDOWN,
              }}
            >
              {filteredItems.map((item) => (
                <div
                  key={item._id}
                  className="search-suggestion-item"
                  onClick={() => handleItemClick(item)}
                  onMouseDown={(e) => e.preventDefault()} // Prevent blur event
                >
                  <strong>{item.name}</strong> - SP:{" "}
                  <span className="text-muted">
                    ₹{(item.sellingPrice || 0).toFixed(2)}
                  </span>
                  , BP:{" "}
                  <span className="text-muted">
                    ₹{(item.buyingPrice || 0).toFixed(2)}
                  </span>
                  <br />
                  <small>
                    HSN: {item.hsnCode || "N/A"}, GST: {item.gstRate || 0}%
                  </small>
                </div>
              ))}
            </div>,
            document.body // Target for the portal
          )}

        {showDropdown &&
          searchTerm &&
          filteredItems.length === 0 &&
          !loading && (
            ReactDOM.createPortal(
              <div
                className="search-no-results"
                style={{
                  position: "fixed",
                  top: `${dropdownPosition.top}px`,
                  left: `${dropdownPosition.left}px`,
                  width: `${dropdownPosition.width}px`,
                  zIndex: Z_INDEX_DROPDOWN,
                }}
              >
                No items found
              </div>,
              document.body // Target for the portal
            )
          )}
      </div>
    </div>
  );
};

export default ItemSearchComponent;
