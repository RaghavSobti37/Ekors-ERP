import React, { useState, useCallback, useEffect, useRef } from "react";
import { Form, ListGroup, Spinner } from "react-bootstrap";
import apiClient from "../utils/apiClient"; 
import { handleApiError } from "../utils/helpers"; // Utility for consistent API error handling

const ClientSearchComponent = ({
  onClientSelect,
  placeholder,
  currentClientId,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showResults, setShowResults] = useState(false);
  const resultsRef = useRef(null);

  const fetchClients = useCallback(async (termToSearch) => {
    const trimmedTerm = termToSearch.trim();
    if (!trimmedTerm || trimmedTerm.length < 2) {
      setResults([]);
      setShowResults(false); // Keep results hidden if term is too short
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const data = await apiClient(`/clients/search?q=${encodeURIComponent(trimmedTerm)}`);
      setResults(data);
      setShowResults(true); // Show results area now that we have data (or empty data)
    } catch (err) {
      setError(handleApiError(err, "Failed to search clients."));
      setResults([]);
      setShowResults(false); // Hide results on error
    } finally {
      setIsLoading(false);
    }
  }, [handleApiError]);

  useEffect(() => {
    const trimmedSearchTerm = searchTerm.trim();
    const timerId = setTimeout(() => {
      fetchClients(trimmedSearchTerm);
    }, 300); // 300ms debounce
    return () => clearTimeout(timerId);
  }, [searchTerm, fetchClients]);

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
  };

  const handleSelectClient = (client) => {
    onClientSelect(client);
    setSearchTerm("");
    setResults([]);
    setShowResults(false);
  };

  // Handle clicks inside the results dropdown
  const handleResultsMouseDown = (e) => {
    e.preventDefault(); // Prevent input blur when clicking on results
  };

  return (
    <div className="mb-3 position-relative">
      <Form.Control
        type="text"
        placeholder={placeholder || "Search client by Name, Email, GST..."}
        value={searchTerm}
        onChange={handleSearchChange}
        onFocus={() => searchTerm.trim().length >= 2 && setShowResults(true)}
        onBlur={() => {
          // Only hide results if focus isn't moving to the results list
          if (!resultsRef.current || !resultsRef.current.contains(document.activeElement)) {
            setTimeout(() => setShowResults(false), 200);
          }
        }}
      />
      {isLoading && <Spinner animation="border" size="sm" className="mt-2" />}
      {error && <p className="text-danger small mt-1">{error}</p>}
      {showResults && results.length > 0 && (
        <ListGroup
          ref={resultsRef}
          className="position-absolute w-100"
          style={{ zIndex: 1051 }}
          onMouseDown={handleResultsMouseDown}
        >
          {results.map((client) => (
            <ListGroup.Item
              key={client._id}
              action
              onClick={() => handleSelectClient(client)}
              disabled={currentClientId === client._id}
            >
              {client.companyName}
              {client.clientName && ` - ${client.clientName}`} ({client.email})
              {client.gstNumber && ` / ${client.gstNumber}`}
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
      {showResults &&
        results.length === 0 &&
        searchTerm.trim().length >= 2 &&
        !isLoading && <p className="small mt-1">No clients found.</p>}
    </div>
  );
};

export default ClientSearchComponent;