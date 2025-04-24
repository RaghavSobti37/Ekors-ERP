import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from "../components/Navbar";
import Pagination from '../components/Pagination';
import '../css/Analytics.css';

const AnalystPage = () => {
  const navigate = useNavigate();

  const [rows, setRows] = useState([
    { id: 1, user: 'John Doe', role: 'user' },
    { id: 2, user: 'Jane Smith', role: 'admin' },
    { id: 3, user: 'Alex Johnson', role: 'superadmin' },
    { id: 4, user: 'Emma Wilson', role: 'user' },
    { id: 5, user: 'Olivia Brown', role: 'admin' },
    { id: 6, user: 'William King', role: 'user' },
    { id: 7, user: 'Sophia Lee', role: 'superadmin' },
    { id: 8, user: 'Liam Green', role: 'user' },
    { id: 9, user: 'Noah White', role: 'admin' },
    { id: 10, user: 'Mason Taylor', role: 'user' },
    { id: 11, user: 'Lucas Hall', role: 'user' },
    { id: 12, user: 'Ella Walker', role: 'admin' },
  ]);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 5;

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

  const totalPages = Math.ceil(rows.length / rowsPerPage);
  const displayedRows = rows.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

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
            {displayedRows.map(row => (
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
                <td><button className="action-btn">Edit</button></td>
                <td><button className="delete-btn" onClick={() => handleDelete(row.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>

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
