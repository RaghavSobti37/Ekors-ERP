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
    const [designations, setDesignations] = useState([
        "Director",
        "Manager",
        "Sales and Marketing",
        "Account",
        "Dispatch",
        "Other"
    ]);
    const [showOtherInput, setShowOtherInput] = useState(false);
    const [otherDesignation, setOtherDesignation] = useState("");
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        designation: "User",
        status: "Active",
        scope: "Read Only",
        lastLogin: ""
    });
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
        setFormData({
            firstName: user?.username.split('_')[0] || "",
            lastName: user?.username.split('_')[1] || "",
            email: user?.email || "",
            designation: user?.designation || "User",
            status: user?.status || "Active",
            scope: user?.scope || "Read Only",
            lastLogin: user?.lastLogin || ""
        });
        setShowOtherInput(user?.designation && !designations.includes(user.designation));
        setOtherDesignation(user?.designation && !designations.includes(user.designation) ? user.designation : "");
        setShowEditModal(true);
    };

    const handleDelete = (userId) => {
        if (window.confirm("Are you sure you want to delete this user?")) {
            setUsers(users.filter(user => user.id !== userId));
        }
    };

    const handleDesignationChange = (e) => {
        const value = e.target.value;
        setFormData({...formData, designation: value});
        
        if (value === "Other") {
            setShowOtherInput(true);
            setFormData({...formData, designation: ""});
        } else {
            setShowOtherInput(false);
            setOtherDesignation("");
        }
    };

    const handleOtherDesignationChange = (e) => {
        const value = e.target.value;
        setOtherDesignation(value);
        setFormData({...formData, designation: value});
    };

    const handleAddNewDesignation = () => {
        if (otherDesignation.trim() && !designations.includes(otherDesignation)) {
            setDesignations([...designations.filter(d => d !== "Other"), otherDesignation, "Other"]);
        }
        setShowOtherInput(false);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData({...formData, [name]: value});
    };

    const handleSave = () => {
        // In a real app, you would send this data to your API
        const newUser = {
            id: users.length + 1,
            username: `${formData.firstName}_${formData.lastName}`,
            email: formData.email,
            createdAt: new Date().toISOString().split('T')[0],
            designation: formData.designation,
            scope: formData.scope,
            status: formData.status,
            lastLogin: formData.lastLogin || "Never"
        };

        if (selectedUser) {
            // Update existing user
            setUsers(users.map(user => user.id === selectedUser.id ? newUser : user));
        } else {
            // Add new user
            setUsers([...users, newUser]);
        }

        // Reset form and close modal
        setFormData({
            firstName: "",
            lastName: "",
            email: "",
            designation: "User",
            status: "Active",
            scope: "Read Only",
            lastLogin: ""
        });
        setShowOtherInput(false);
        setOtherDesignation("");
        setShowEditModal(false);
        setSelectedUser(null);
    };

    return (
        <div>
            <Navbar />

            <div className="users-page">
                <div className="users-header">
                    <h1>User Management</h1>
                    <button className="add-user-btn" onClick={() => handleEdit(null)}>
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
                                        <span className={`designation-badge ${user.designation.toLowerCase().replace(/\s+/g, '-')}`}>
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
                                <button className="close-btn" onClick={() => {
                                    setShowEditModal(false);
                                    setSelectedUser(null);
                                    setShowOtherInput(false);
                                    setOtherDesignation("");
                                }}>
                                    <FaTimes />
                                </button>
                            </div>

                            <div className="modal-content">
                                <div className="form-grid">
                                    <div className="form-group">
                                        <label>First Name</label>
                                        <input
                                            type="text"
                                            name="firstName"
                                            value={formData.firstName}
                                            onChange={handleInputChange}
                                            placeholder="Enter First Name"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Last Name</label>
                                        <input
                                            type="text"
                                            name="lastName"
                                            value={formData.lastName}
                                            onChange={handleInputChange}
                                            placeholder="Enter Last Name"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Email</label>
                                        <input
                                            type="email"
                                            name="email"
                                            value={formData.email}
                                            onChange={handleInputChange}
                                            placeholder="Enter email"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Designation</label>
                                        <select 
                                            name="designation"
                                            value={formData.designation === otherDesignation ? "Other" : formData.designation}
                                            onChange={handleDesignationChange}
                                        >
                                            {designations.map((designation) => (
                                                <option key={designation} value={designation}>
                                                    {designation}
                                                </option>
                                            ))}
                                        </select>
                                        {showOtherInput && (
                                            <div className="other-designation-container">
                                                <input
                                                    type="text"
                                                    value={otherDesignation}
                                                    onChange={handleOtherDesignationChange}
                                                    placeholder="Enter your designation"
                                                    className="other-designation-input"
                                                />
                                                <button 
                                                    onClick={handleAddNewDesignation}
                                                    className="add-designation-btn"
                                                >
                                                    Add Designation
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label>Status</label>
                                        <select
                                            name="status"
                                            value={formData.status}
                                            onChange={handleInputChange}
                                        >
                                            <option value="Active">Active</option>
                                            <option value="Inactive">Inactive</option>
                                            <option value="Suspended">Suspended</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Scope (Role)</label>
                                        <select
                                            name="scope"
                                            value={formData.scope}
                                            onChange={handleInputChange}
                                        >
                                            <option value="Super-Admin">Super-Admin</option>
                                            <option value="Admin">Admin</option>
                                            <option value="User">User</option>
                                            <option value="Read Only">Read Only</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Last Login</label>
                                        <input
                                            type="text"
                                            name="lastLogin"
                                            value={formData.lastLogin}
                                            onChange={handleInputChange}
                                            placeholder="YYYY-MM-DD HH:MM"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button className="cancel-btn" onClick={() => {
                                    setShowEditModal(false);
                                    setSelectedUser(null);
                                    setShowOtherInput(false);
                                    setOtherDesignation("");
                                }}>
                                    Cancel
                                </button>
                                <button className="save-btn" onClick={handleSave}>
                                    Save
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