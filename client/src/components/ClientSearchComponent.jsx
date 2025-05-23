import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { Form, ListGroup, Spinner } from 'react-bootstrap';

const ClientSearchComponent = ({ onClientSelect, placeholder, currentClientId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResults, setShowResults] = useState(false);

  const getAuthToken = () => {
    try {
      const userData = JSON.parse(localStorage.getItem("erp-user"));
      return userData?.token;
    } catch (e) {
      return null;
    }
  };

  const fetchClients = useCallback(async (term) => {
    if (!term || term.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const token = getAuthToken();
      if (!token) throw new Error("Authentication token not found.");
      
      const response = await axios.get(`http://localhost:3000/api/clients/search?q=${term}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setResults(response.data);
      setShowResults(true);
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError(err.response?.data?.message || err.message || 'Failed to search clients.');
      setResults([]);
      setShowResults(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    fetchClients(term);
  };

  const handleSelectClient = (client) => {
    onClientSelect(client);
    setSearchTerm(''); 
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
        onFocus={() => searchTerm && results.length > 0 && setShowResults(true)}
        // onBlur={() => setTimeout(() => setShowResults(false), 150)} // Delay to allow click on list item
      />
      {isLoading && <Spinner animation="border" size="sm" className="mt-2" />}
      {error && <p className="text-danger small mt-1">{error}</p>}
      {showResults && results.length > 0 && (
        <ListGroup className="position-absolute w-100" style={{ zIndex: 1051 /* Higher than modal */ }}>
          {results.map((client) => (
            <ListGroup.Item
              key={client._id}
              action
              onClick={() => handleSelectClient(client)}
              disabled={currentClientId === client._id}
            >
              {client.companyName} ({client.email})
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
       {showResults && results.length === 0 && searchTerm.length >=2 && !isLoading && <p className="small mt-1">No clients found.</p>}
    </div>
  );
};

export default ClientSearchComponent;