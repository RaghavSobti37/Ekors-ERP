import React, { useState, useCallback, useEffect } from "react";
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
      // apiClient is expected to handle auth and throw if token is missing/invalid.
      // The error will be caught by the catch block below.
      const data = await apiClient(`/clients/search?q=${encodeURIComponent(trimmedTerm)}`);
      setResults(data);
      setShowResults(true); // Show results area now that we have data (or empty data)
      // If data is empty, showResults is still true, allowing "No clients found" message
      // If data has items, ListGroup will show.
    } catch (err) {
      // handleApiError should ideally also handle auth errors from apiClient
      setError(handleApiError(err, "Failed to search clients."));
      setResults([]);
      setShowResults(false); // Hide results on error
    } finally {
      setIsLoading(false);
    }
  }, [handleApiError]); // Assuming handleApiError is a stable utility function

  useEffect(() => {
    const trimmedSearchTerm = searchTerm.trim();
    const timerId = setTimeout(() => {
      fetchClients(trimmedSearchTerm); // fetchClients will handle empty/short terms
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

  return (
    <div className="mb-3 position-relative">
      <Form.Control
        type="text"
        placeholder={placeholder || "Search client by Name, Email, GST..."}
        value={searchTerm}
        onChange={handleSearchChange}
        onFocus={() => searchTerm.trim().length >= 2 && setShowResults(true)} // Show results area if term is potentially valid
        onBlur={() => setTimeout(() => setShowResults(false), 150)} // Delay to allow click on list item
      />
      {isLoading && <Spinner animation="border" size="sm" className="mt-2" />}
      {error && <p className="text-danger small mt-1">{error}</p>}
      {showResults && results.length > 0 && (
        <ListGroup
          className="position-absolute w-100"
          style={{ zIndex: 1051 /* Higher than modal */ }}
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