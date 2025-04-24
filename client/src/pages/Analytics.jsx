import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from "../components/Navbar";
import Pagination from '../components/Pagination';
import '../css/Analytics.css';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const AnalystPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(null);
  const [editData, setEditData] = useState({});
  const [ticketTotals, setTicketTotals] = useState({});

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch('/api/users');
        const data = await response.json();
        setUsers(data);
        
        // Fetch ticket totals for each user
        const totalsResponse = await fetch('/api/users/ticket-totals');
        const totalsData = await totalsResponse.json();
        setTicketTotals(totalsData);
      } catch (error) {
        console.error('Error fetching users:', error);
        toast.error('Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleRoleChange = async (id, newRole) => {
    try {
      const response = await fetch(`/api/users/${id}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ role: newRole })
      });

      if (response.ok) {
        setUsers(users.map(user => 
          user._id === id ? { ...user, role: newRole } : user
        ));
        toast.success('Role updated successfully');
      } else {
        throw new Error('Failed to update role');
      }
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        setUsers(users.filter(user => user._id !== id));
        toast.success('User deleted successfully');
      } else {
        throw new Error('Failed to delete user');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const handleEdit = (user) => {
    setEditMode(user._id);
    setEditData({
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      phone: user.phone
    });
  };

  const handleEditChange = (e) => {
    setEditData({
      ...editData,
      [e.target.name]: e.target.value
    });
  };

  const saveEdit = async (id) => {
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(editData)
      });

      if (response.ok) {
        const updatedUser = await response.json();
        setUsers(users.map(user => 
          user._id === id ? { ...user, ...updatedUser } : user
        ));
        setEditMode(null);
        toast.success('User updated successfully');
      } else {
        throw new Error('Failed to update user');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Failed to update user');
    }
  };

  const cancelEdit = () => {
    setEditMode(null);
    setEditData({});
  };

  const totalPages = Math.ceil(users.length / rowsPerPage);
  const displayedUsers = users.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="analyst-page">
      <Navbar />
      
      <div className="analyst-container">
        <div className="analyst-header">
          <h2>User Management</h2>
          <div className="analyst-actions">
            
          </div>
        </div>

        <div className="table-responsive">
          <table className="analyst-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Total Ticket Value</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedUsers.map(user => (
                <tr key={user._id}>
                  <td>
                    {editMode === user._id ? (
                      <div className="edit-fields">
                        <input
                          type="text"
                          name="firstname"
                          value={editData.firstname}
                          onChange={handleEditChange}
                        />
                        <input
                          type="text"
                          name="lastname"
                          value={editData.lastname}
                          onChange={handleEditChange}
                        />
                      </div>
                    ) : (
                      `${user.firstname} ${user.lastname}`
                    )}
                  </td>
                  <td>
                    {editMode === user._id ? (
                      <input
                        type="email"
                        name="email"
                        value={editData.email}
                        onChange={handleEditChange}
                      />
                    ) : (
                      user.email
                    )}
                  </td>
                  <td>
                    {editMode === user._id ? (
                      <input
                        type="text"
                        name="phone"
                        value={editData.phone}
                        onChange={handleEditChange}
                      />
                    ) : (
                      user.phone
                    )}
                  </td>
                  <td>
                    ₹{ticketTotals[user._id]?.total || 0}
                  </td>
                  <td>
                    <select
                      className="role-dropdown"
                      value={user.role}
                      onChange={(e) => handleRoleChange(user._id, e.target.value)}
                      disabled={user.role === 'super-admin'}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="super-admin">Super Admin</option>
                    </select>
                  </td>
                  <td className="actions-cell">
                    {editMode === user._id ? (
                      <>
                        <button 
                          className="btn-save"
                          onClick={() => saveEdit(user._id)}
                        >
                          Save
                        </button>
                        <button 
                          className="btn-cancel"
                          onClick={cancelEdit}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          className="btn-edit"
                          onClick={() => handleEdit(user)}
                          disabled={user.role === 'super-admin'}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn-history"
                          onClick={() => navigate(`/history/${user._id}`)}
                        >
                          History
                        </button>
                        <button 
                          className="btn-delete"
                          onClick={() => handleDelete(user._id)}
                          disabled={user.role === 'super-admin'}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={(page) => {
            if (page >= 1 && page <= totalPages) setCurrentPage(page);
          }}
        />
      </div>
    </div>
  );
};

export default AnalystPage;