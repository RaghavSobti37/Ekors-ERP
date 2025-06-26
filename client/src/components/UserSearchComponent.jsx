import React, { useState, useEffect, useCallback } from 'react';
import { Form, ListGroup, Spinner, Alert } from 'react-bootstrap';
import apiClient from '../utils/apiClient';
import { useAuth } from '../context/AuthContext';
import { handleApiError } from '../utils/helpers';

const UserSearchComponent = ({ onUserSelect, currentAssigneeId }) => {
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { user: authUser } = useAuth();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient('/tickets/transfer-candidates');
      // Filter out the current assignee from the list of candidates
      const filteredUsers = data.filter(u => u._id !== currentAssigneeId);
      setUsers(filteredUsers);
    } catch (err) {
      setError(handleApiError(err, "Failed to load users.", authUser, "userSearch"));
    } finally {
      setLoading(false);
    }
  }, [authUser, currentAssigneeId]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = users.filter(user =>
    (user.firstname?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.lastname?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (user.email?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  return (
    <div>
      <Form.Control
        type="text"
        placeholder="Search for user to transfer to..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mb-3"
      />
      {loading && <div className="text-center"><Spinner animation="border" /></div>}
      {error && <Alert variant="danger">{error}</Alert>}
      {!loading && !error && (
        <ListGroup style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {filteredUsers.length > 0 ? (
            filteredUsers.map(user => (
              <ListGroup.Item key={user._id} action onClick={() => onUserSelect(user)}>
                {user.firstname} {user.lastname} ({user.email})
              </ListGroup.Item>
            ))
          ) : (
            <ListGroup.Item disabled>No users found.</ListGroup.Item>
          )}
        </ListGroup>
      )}
    </div>
  );
};

export default UserSearchComponent;

