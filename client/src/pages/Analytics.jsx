import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from "../components/Navbar";
import '../css/Analytics.css';

const AnalystPage = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([
    { id: 1, user: 'John Doe', role: 'user' },
    { id: 2, user: 'Jane Smith', role: 'admin' },
  ]);

  const handleRoleChange = (id, newRole) => {
    setRows(prev =>
      prev.map(row =>
        row.id === id ? { ...row, role: newRole } : row
      )
    );
  };

  const handleDelete = (id) => {
    setRows(prev => prev.filter(row => row.id !== id));
  };

  return (
    <div>
      <Navbar />

      <div className="analyst-container">
        <h2>Analyst Page</h2>
        <table className="analyst-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Log Time</th>
              <th>Role</th>
              <th>Edit</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td>{row.user}</td>
                <td>
                  <button className="action-btn" onClick={() => navigate(`/history/${row.id}`)}>History</button>
                </td>
                <td>
                  <select
                    className="dropdown"
                    value={row.role}
                    onChange={(e) => handleRoleChange(row.id, e.target.value)}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                </td>
                <td>
                  <button className="action-btn">Edit</button>
                </td>
                <td>
                  <button className="delete-btn" onClick={() => handleDelete(row.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AnalystPage;
