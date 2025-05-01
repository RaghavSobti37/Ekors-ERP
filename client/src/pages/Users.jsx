import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEdit, FaTrash, FaTimes } from "react-icons/fa";
import Navbar from "../components/Navbar";
import "../css/Users.css";

const Users = () => {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Mock data - replace with actual API call
        const mockUsers = [
            {
                id: 1,
                username: "john_doe",
                email: "john@example.com",
                createdAt: "2023-01-15",
                designation: "Admin",
                scope: "Full Access",
                status: "Active",
                lastLogin: "2023-06-20 14:30"
            },
            {
                id: 2,
                username: "jane_smith",
                email: "jane@example.com",
                createdAt: "2023-02-20",
                designation: "Manager",
                scope: "Limited Access",
                status: "Active",
                lastLogin: "2023-06-19 09:15"
            },
            {
                id: 3,
                username: "bob_johnson",
                email: "bob@example.com",
                createdAt: "2023-03-10",
                designation: "User",
                scope: "Read Only",
                status: "Inactive",
                lastLogin: "2023-05-28 16:45"
            }
        ];
        setUsers(mockUsers);
    }, []);

    const handleView = (user) => {
        setSelectedUser(user);
        setShowViewModal(true);
    };

    const handleEdit = (user) => {
        setSelectedUser(user);
        setShowEditModal(true);
    };

    const handleDelete = (userId) => {
        if (window.confirm("Are you sure you want to delete this user?")) {
            setUsers(users.filter(user => user.id !== userId));
        }
    };

    const handleSave = () => {
        // Add save logic here
        setShowEditModal(false);
    };

    return (
        <div>
            <Navbar />

            <div className="users-page">
                <div className="users-header">
                    <h1>User Management</h1>
                    <button className="add-user-btn" onClick={() => setShowEditModal(true)}>
                        + Add New User
                    </button>
                </div>

                <div className="users-table-container">
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Designation</th>
                                <th>Status</th>
                                <th>Last Login</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id}>
                                    <td>
                                        <div className="user-avatar">
                                            <span>{user.username.charAt(0).toUpperCase()}</span>
                                            {user.username}
                                        </div>
                                    </td>
                                    <td>{user.email}</td>
                                    <td>
                                        <span className={`designation-badge ${user.designation.toLowerCase()}`}>
                                            {user.designation}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`status-badge ${user.status.toLowerCase()}`}>
                                            {user.status}
                                        </span>
                                    </td>
                                    <td>{user.lastLogin}</td>
                                    <td>
                                        <div className="action-buttons">
                                            <button className="view-btn" onClick={() => handleView(user)}>
                                                <FaEye />
                                            </button>
                                            <button className="edit-btn" onClick={() => handleEdit(user)}>
                                                <FaEdit />
                                            </button>
                                            <button className="delete-btn" onClick={() => handleDelete(user.id)}>
                                                <FaTrash />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* View Modal */}
                {showViewModal && selectedUser && (
                    <div className="modal-overlay">
                        <div className="user-modal">
                            <div className="modal-header">
                                <h2>User Details</h2>
                                <button className="close-btn" onClick={() => setShowViewModal(false)}>
                                    <FaTimes />
                                </button>
                            </div>

                            <div className="modal-content">
                                <div className="user-profile">
                                    <div className="avatar-large">
                                        {selectedUser.username.charAt(0).toUpperCase()}
                                    </div>
                                    <h3>{selectedUser.username}</h3>
                                    <p className="user-email">{selectedUser.email}</p>
                                </div>

                                <div className="user-details-grid">
                                    <div className="detail-item">
                                        <span className="detail-label">Designation:</span>
                                        <span className="detail-value">{selectedUser.designation}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Status:</span>
                                        <span className={`detail-value status-badge ${selectedUser.status.toLowerCase()}`}>
                                            {selectedUser.status}
                                        </span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Created At:</span>
                                        <span className="detail-value">{selectedUser.createdAt}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Last Login:</span>
                                        <span className="detail-value">{selectedUser.lastLogin}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Access Scope:</span>
                                        <span className="detail-value">{selectedUser.scope}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button className="close-modal-btn" onClick={() => setShowViewModal(false)}>
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                {showEditModal && (
                    <div className="modal-overlay">
                        <div className="user-modal edit-modal">
                            <div className="modal-header">
                                <h2>{selectedUser ? "Edit User" : "Add New User"}</h2>
                                <button className="close-btn" onClick={() => setShowEditModal(false)}>
                                    <FaTimes />
                                </button>
                            </div>

                            <div className="modal-content">
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>Username</label>
                                        <input
                                            type="text"
                                            defaultValue={selectedUser?.username || ""}
                                            placeholder="Enter username"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Email</label>
                                        <input
                                            type="email"
                                            defaultValue={selectedUser?.email || ""}
                                            placeholder="Enter email"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Designation</label>
                                        <select defaultValue={selectedUser?.designation || "User"}>
                                            <option value="Admin">Admin</option>
                                            <option value="Manager">Manager</option>
                                            <option value="User">User</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Status</label>
                                        <select defaultValue={selectedUser?.status || "Active"}>
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                            <option value="Suspended">Suspended</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Access Scope</label>
                                        <select defaultValue={selectedUser?.scope || "Read Only"}>
                                            <option value="Full Access">Full Access</option>
                                            <option value="Limited Access">Limited Access</option>
                                            <option value="Read Only">Read Only</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Last Login</label>
                                        <input
                                            type="text"
                                            defaultValue={selectedUser?.lastLogin || ""}
                                            placeholder="YYYY-MM-DD HH:MM"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button className="cancel-btn" onClick={() => setShowEditModal(false)}>
                                    Cancel
                                </button>
                                <button className="save-btn" onClick={handleSave}>
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Users;