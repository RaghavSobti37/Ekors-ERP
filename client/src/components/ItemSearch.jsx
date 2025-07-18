import React, { useState, useEffect, useRef, useCallback } from "react";
import "../css/ItemSearchComponent.css";
import apiClient from "../utils/apiClient"; // Utility for making API requests
import { handleApiError } from "../utils/helpers";
import ReactDOM from "react-dom";

const ItemSearchComponent = ({
  onItemSelect,
  placeholder = "Search item by name or HSN...",
  className = "",
  disabled = false,
  onDropdownToggle,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
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

  // Search items immediately on searchTerm change (no debounce)
  const searchItems = useCallback(
    async (termToSearch) => {
      const trimmedTerm = termToSearch.trim();
      if (!trimmedTerm || trimmedTerm.length < 1) {
        setSearchResults([]);
        setShowDropdown(false);
        setError(null);
        return;
      }
      setError(null);
      try {
        const response = await apiClient(
          `/items?search=${encodeURIComponent(trimmedTerm)}&status=approved`
        );
        setSearchResults(response.data || []);
        setShowDropdown(true);
        updateDropdownPosition();
      } catch (err) {
        setError(handleApiError(err, "Failed to search items."));
        setSearchResults([]);
        setShowDropdown(false);
      }
    },
    []
  );

  useEffect(() => {
    searchItems(searchTerm);
    // eslint-disable-next-line
  }, [searchTerm]);

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

  const handleItemClick = (item) => {
    onItemSelect(item);
    setSearchTerm("");
    setSearchResults([]);
    setShowDropdown(false);
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  return (
    <div className={`item-search-component ${className}`}>
      {error && <div className="search-error text-danger small">{error}</div>}
      <div className="search-input-container">
        <input
          ref={inputRef}
          type="text"
          className="form-control"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleSearchChange}
          onFocus={() => {
            updateDropdownPosition();
            if (searchTerm.trim().length > 0 || searchResults.length > 0)
              setShowDropdown(true);
          }}
          disabled={disabled}
        />
        {/* Portal for suggestions dropdown */}
        {showDropdown &&
          searchResults.length > 0 &&
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
              {searchResults.map((item) => (
                <div
                  key={item._id}
                  className="search-suggestion-item"
                  onClick={() => handleItemClick(item)}
                >
                  <strong>{item.name}</strong>
                  <br />
                  <small className="text-muted">
                    SP: ₹{(item.sellingPrice || 0).toFixed(2)} per{" "}
                    {item.baseUnit || "unit"}
                  </small>
                  {item.buyingPrice > 0 && (
                    <small className="text-muted ms-2">
                      BP: ₹{(item.buyingPrice || 0).toFixed(2)}
                    </small>
                  )}
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
          searchResults.length === 0 &&
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
          )}
      </div>
    </div>
  );
};

export default ItemSearchComponent;
