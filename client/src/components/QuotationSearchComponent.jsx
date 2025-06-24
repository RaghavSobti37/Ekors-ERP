import React, { useState, useEffect, useRef, useCallback } from "react";
import ReactDOM from "react-dom";
import apiClient from "../utils/apiClient";
import { handleApiError } from "../utils/helpers";
import "../css/ItemSearchComponent.css"; // Reuse styling if applicable

const QuotationSearchComponent = ({
  onQuotationSelect,
  placeholder = "Search by Ref No or Client...",
  className = "",
  disabled = false,
  onDropdownToggle, // Optional: for parent to know if dropdown is open
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  const inputRef = useRef(null);
  const Z_INDEX_DROPDOWN = 1060; // Ensure it's above other elements

  useEffect(() => {
    if (onDropdownToggle) {
      onDropdownToggle(showDropdown);
    }
  }, [showDropdown, onDropdownToggle]);

  const searchQuotations = useCallback(async (termToSearch) => {
    const trimmedTerm = termToSearch.trim();
    if (!trimmedTerm || trimmedTerm.length < 2) { // Min 2 chars to search
      setSearchResults([]);
      setShowDropdown(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient(
        `/quotations?search=${encodeURIComponent(trimmedTerm)}&limit=10&sortKey=referenceNumber&sortDirection=desc`
      );
      setSearchResults(response.data || []);
      setShowDropdown(true);
      updateDropdownPosition();
    } catch (err) {
      setError(handleApiError(err, "Failed to search quotations."));
      setSearchResults([]);
      setShowDropdown(false);
    } finally {
      setLoading(false);
    }
  }, []); // handleApiError should be stable if defined outside or memoized

  useEffect(() => {
    const timerId = setTimeout(() => {
      searchQuotations(searchTerm);
    }, 300); // Debounce
    return () => clearTimeout(timerId);
  }, [searchTerm, searchQuotations]);

  const updateDropdownPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY, // Account for page scroll
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, []);

  useEffect(() => {
    if (showDropdown) updateDropdownPosition();
    window.addEventListener("resize", updateDropdownPosition);
    window.addEventListener("scroll", updateDropdownPosition, true);
    return () => {
      window.removeEventListener("resize", updateDropdownPosition);
      window.removeEventListener("scroll", updateDropdownPosition, true);
    };
  }, [showDropdown, updateDropdownPosition]);

  const handleQuotationClick = (quotation) => {
    onQuotationSelect(quotation);
    setSearchTerm("");
    setSearchResults([]);
    setShowDropdown(false);
  };

  return (
    <div className={`item-search-component ${className}`}>
      {error && <div className="search-error text-danger small mb-1">{error}</div>}
      <div className="search-input-container">
        <input
          ref={inputRef}
          type="text"
          className="form-control"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => {
            updateDropdownPosition();
            if (searchTerm.trim().length > 0 || searchResults.length > 0) setShowDropdown(true);
          }}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)} // Delay to allow click on dropdown
          disabled={disabled || loading}
        />
        {loading && <div className="search-loading spinner-border spinner-border-sm text-primary" role="status"><span className="visually-hidden">Loading...</span></div>}
      </div>

      {showDropdown && searchResults.length > 0 && ReactDOM.createPortal(
        <div
          className="search-suggestions-dropdown"
          style={{ position: "absolute", top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px`, width: `${dropdownPosition.width}px`, zIndex: Z_INDEX_DROPDOWN }}
        >
          {searchResults.map((q) => (
            <div key={q._id} className="search-suggestion-item" onClick={() => handleQuotationClick(q)} onMouseDown={(e) => e.preventDefault()}>
              <strong>{q.referenceNumber}</strong> - {q.client?.companyName || "N/A"}
              <br />
              <small>Date: {new Date(q.date).toLocaleDateString()}, Status: {q.status}</small>
            </div>
          ))}
        </div>,
        document.body
      )}

      {showDropdown && searchTerm && searchResults.length === 0 && !loading && ReactDOM.createPortal(
        <div
          className="search-no-results"
          style={{ position: "absolute", top: `${dropdownPosition.top}px`, left: `${dropdownPosition.left}px`, width: `${dropdownPosition.width}px`, zIndex: Z_INDEX_DROPDOWN }}
        >
          No quotations found
        </div>,
        document.body
      )}
    </div>
  );
};

export default QuotationSearchComponent;
