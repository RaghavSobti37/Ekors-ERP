import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye, FaEdit, FaTrash, FaTimes, FaUserShield } from "react-icons/fa";
import axios from "axios";
import Navbar from "../components/Navbar";
import "../css/Users.css";

const Users = () => {
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [formData, setFormData] = useState({
        firstname: "",
        lastname: "",
        email: "",
        phone: "",
        role: "user",
        password: ""
    });
    const [searchTerm, setSearchTerm] = useState("");
    const navigate = useNavigate();

    // Axios instance with base URL and auth header
    const api = axios.create({
        baseURL: "http://localhost:3000",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
        }
    });

    // Fetch users from backend
    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await api.get("/api/users");
            setUsers(response.data);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching users:", err);
            setError(err.response?.data?.error || "Failed to fetch users");
            
            if (err.response?.status === 401) {
                // Token expired or invalid
                localStorage.removeItem("token");
                navigate("/login");
            } else {
                setLoading(false);
            }
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleView = (user) => {
        setSelectedUser(user);
        setShowViewModal(true);
    };

    const handleEdit = (user) => {
        setSelectedUser(user);
        setFormData({
            firstname: user?.firstname || "",
            lastname: user?.lastname || "",
            email: user?.email || "",
            phone: user?.phone || "",
            role: user?.role || "user",
            password: ""
        });
        setShowEditModal(true);
    };

    const handleDelete = async (userId) => {
        if (window.confirm("Are you sure you want to delete this user?")) {
            try {
                await api.delete(`/api/users/${userId}`);
                setUsers(users.filter(user => user._id !== userId));
            } catch (err) {
                console.error("Error deleting user:", err);
                alert(err.response?.data?.error || "Failed to delete user");
                
                if (err.response?.status === 401) {
                    navigate("/login");
                }
            }
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({...prev, [name]: value}));
    };

    const handleSave = async () => {
        try {
            if (!formData.firstname || !formData.lastname || !formData.email) {
                throw new Error("Required fields are missing");
            }

            if (!selectedUser && !formData.password) {
                throw new Error("Password is required for new users");
            }

            let response;
            
            if (selectedUser) {
                // Update existing user
                response = await api.put(
                    `/api/users/${selectedUser._id}`,
                    formData
                );
                setUsers(users.map(user => 
                    user._id === selectedUser._id ? response.data : user
                ));
            } else {
                // Add new user
                response = await api.post(
                    "/api/users/register",
                    formData
                );
                setUsers([...users, response.data]);
            }

            setFormData({
                firstname: "",
                lastname: "",
                email: "",
                phone: "",
                role: "user",
                password: ""
            });
            setShowEditModal(false);
            setSelectedUser(null);
            
            // Refresh the list
            fetchUsers();
        } catch (err) {
            console.error("Error saving user:", err);
            alert(err.response?.data?.error || err.message || "Failed to save user");
            
            if (err.response?.status === 401) {
                navigate("/login");
            }
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return "Never";
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    const filteredUsers = users.filter(user => 
        user.firstname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.lastname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <div className="loading">Loading users...</div>;
    if (error) return <div className="error">{error}</div>;

    return (
        <div>
            <Navbar />

            <div className="users-page">
                <div className="users-header">
                    <h1>User Management</h1>
                    <div className="users-actions">
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                        <button className="add-user-btn" onClick={() => handleEdit(null)}>
                            + Add New User
                        </button>
                    </div>
                </div>

                <div className="users-table-container">
                    <table className="users-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th>Role</th>
                                <th>Created At</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length > 0 ? (
                                filteredUsers.map((user) => (
                                    <tr key={user._id}>
                                        <td>
                                            <div className="user-avatar">
                                                <span>{user.firstname?.charAt(0).toUpperCase()}</span>
                                                {user.firstname} {user.lastname}
                                                {user.role === "super-admin" && (
                                                    <FaUserShield className="super-admin-icon" title="Super Admin" />
                                                )}
                                            </div>
                                        </td>
                                        <td>{user.email}</td>
                                        <td>{user.phone || "-"}</td>
                                        <td>
                                            <span className={`role-badge ${user.role.toLowerCase()}`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td>{formatDate(user.createdAt)}</td>
                                        <td>
                                            <div className="action-buttons">
                                                <button 
                                                    className="view-btn" 
                                                    onClick={() => handleView(user)}
                                                    title="View"
                                                >
                                                    👁️
                                                </button>
                                                <button 
                                                    className="edit-btn" 
                                                    onClick={() => handleEdit(user)}
                                                    title="Edit"
                                                >
                                                    ✏️
                                                </button>
                                                <button 
                                                    className="delete-btn" 
                                                    onClick={() => handleDelete(user._id)}
                                                    title="Delete"
                                                    disabled={user.role === "super-admin"}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="6" className="no-users">
                                        No users found
                                    </td>
                                </tr>
                            )}
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
                                        {selectedUser.firstname?.charAt(0).toUpperCase()}
                                        {selectedUser.role === "super-admin" && (
                                            <FaUserShield className="super-admin-badge" title="Super Admin" />
                                        )}
                                    </div>
                                    <h3>{selectedUser.firstname} {selectedUser.lastname}</h3>
                                    <p className="user-email">{selectedUser.email}</p>
                                </div>

                                <div className="user-details-grid">
                                    <div className="detail-item">
                                        <span className="detail-label">Phone:</span>
                                        <span className="detail-value">{selectedUser.phone || "-"}</span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Role:</span>
                                        <span className={`detail-value role-badge ${selectedUser.role.toLowerCase()}`}>
                                            {selectedUser.role}
                                        </span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Created At:</span>
                                        <span className="detail-value">
                                            {formatDate(selectedUser.createdAt)}
                                        </span>
                                    </div>
                                    <div className="detail-item">
                                        <span className="detail-label">Last Updated:</span>
                                        <span className="detail-value">
                                            {formatDate(selectedUser.updatedAt)}
                                        </span>
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
                                <button className="close-btn" onClick={() => {
                                    setShowEditModal(false);
                                    setSelectedUser(null);
                                }}>
                                    <FaTimes />
                                </button>
                            </div>

                            <div className="modal-content">
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>First Name *</label>
                                        <input
                                            type="text"
                                            name="firstname"
                                            value={formData.firstname}
                                            onChange={handleInputChange}
                                            placeholder="Enter First Name"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Last Name *</label>
                                        <input
                                            type="text"
                                            name="lastname"
                                            value={formData.lastname}
                                            onChange={handleInputChange}
                                            placeholder="Enter Last Name"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Email *</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            placeholder="Enter email"
                                            required
                                            disabled={!!selectedUser}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Phone</label>
                                        <input
                                            type="text"
                                            name="phone"
                                            value={formData.phone}
                                            onChange={handleInputChange}
                                            placeholder="Enter phone number"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Role *</label>
                                        <select
                                            name="role"
                                            value={formData.role}
                                            onChange={handleInputChange}
                                            disabled={selectedUser?.role === "super-admin"}
                                        >
                                            <option value="user">User</option>
                                            <option value="admin">Admin</option>
                                            {!selectedUser && (
                                                <option value="super-admin">Super Admin</option>
                                            )}
                                        </select>
                                    </div>
                                    {!selectedUser && (
                                        <div className="form-group">
                                            <label>Password *</label>
                                            <input
                                                type="password"
                                                name="password"
                                                value={formData.password}
                                                onChange={handleInputChange}
                                                placeholder="Enter password"
                                                required
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button 
                                    className="cancel-btn" 
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setSelectedUser(null);
                                    }}
                                >
                                    Cancel
                                </button>
                                <button className="save-btn" onClick={handleSave}>
                                    {selectedUser ? "Update User" : "Create User"}
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