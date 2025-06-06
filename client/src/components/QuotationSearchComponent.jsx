import React, { useState, useEffect, useCallback } from 'react';
import { Form, ListGroup, Spinner, Alert } from 'react-bootstrap';
import apiClient from '../utils/apiClient';
import { debounce } from 'lodash';

const QuotationSearchComponent = ({ onQuotationSelect, placeholder }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchQuotations = useCallback(
    debounce(async (term) => {
      if (!term || term.length < 2) {
        setResults([]);
        setError(null);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiClient(`/quotations?search=${encodeURIComponent(term)}`);
        setResults(response || []);
      } catch (err) {
        setError('Failed to search quotations. ' + (err.data?.message || err.message || ''));
        console.error("QuotationSearchComponent: ", err);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    []
  );

  useEffect(() => {
    fetchQuotations(searchTerm);
  }, [searchTerm, fetchQuotations]);

  const handleSelect = (quotation) => {
    onQuotationSelect(quotation);
    setSearchTerm('');
    setResults([]);
    setError(null);
  };

  return (
    <div className="mb-3">
      <Form.Control
        type="text"
        placeholder={placeholder || "Search by Quotation No. or Client..."}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-2"
      />
      {isLoading && <div className="text-center"><Spinner animation="border" size="sm" /></div>}
      {error && <Alert variant="danger" className="py-1 px-2 small">{error}</Alert>}
      {!isLoading && results.length > 0 && (
        <ListGroup style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {results.map((quotation) => (
            <ListGroup.Item key={quotation._id} action onClick={() => handleSelect(quotation)}>
              {quotation.referenceNumber} - {quotation.client?.companyName || 'N/A'} (Status: {quotation.status})
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
      {!isLoading && searchTerm && results.length === 0 && !error && (
        <p className="text-muted small mt-1">No quotations found matching "{searchTerm}".</p>
      )}
    </div>
  );
};

export default QuotationSearchComponent;