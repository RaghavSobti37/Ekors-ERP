import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaTimes,
  FaUserShield,
  FaChartBar,
} from "react-icons/fa";
import axios from "axios";
import Navbar from "../components/Navbar";
import { Table, Button as BsButton, Alert, Form } from "react-bootstrap"; // Renamed Button to BsButton to avoid conflict
import Pagination from "../components/Pagination";
import ReusableTable from "../components/ReusableTable";
import SortIndicator from "../components/SortIndicator";
import UserReportModal from "../components/UserReportModal";
import "../css/Users.css";
import Unauthorized from "../components/Unauthorized"; // Import Unauthorized component
import "../css/Style.css";
import ActionButtons from "../components/ActionButtons";
import { getAuthToken } from "../utils/authUtils";
import {
  Eye, // View
  PencilSquare, // Edit
  Trash, // Delete
  BarChart, // Generate Report
} from 'react-bootstrap-icons';

const Users = () => {
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportUser, setReportUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false); // State for 403 error
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    email: "",
    phone: "",
    role: "user",
    password: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4; // Hardcoded to 4
  const navigate = useNavigate();

  const handleGenerateReport = (user) => {
    console.log("[Users.jsx] handleGenerateReport: Generating report for user:", user);
    setReportUser(user);
    setShowReportModal(true);
  };

  //   const getAuthToken = () => {
  //   try {
  //     const token = localStorage.getItem("erp-user");
  //   console.log("[DEBUG Client Users.jsx] getAuthToken retrieved:", token ? "Token present" : "No token");
  //   return token || null;
  //   } catch (e) {
  //     console.error("Failed to parse user data:", e);
  //     return null;
  //   }
  // };
  

  // Axios instance with base URL and auth header
  const api = axios.create({
    baseURL: "http://localhost:3000",
    headers: { "Content-Type": "application/json" },
  });

  // Fetch users from backend
  const fetchUsers = async () => {
    try {
      console.log("[Users.jsx] fetchUsers: Attempting to fetch users.");      
      const authTokenString = getAuthToken();
      if (!authTokenString) {
        console.error(
          "[Users.jsx] fetchUsers: No token found. Aborting fetch."
        );
        setError("Authentication token not found. Please log in again.");
        setLoading(false);
        // navigate("/login"); // Optional: redirect to login
        return;
      }
      setLoading(true);
      setError(""); // Clear previous errors
      setIsUnauthorized(false); // Reset unauthorized state

      api.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${authTokenString}`;
      console.log(
        "[Users.jsx] fetchUsers: Axios instance headers:",
        JSON.stringify(api.defaults.headers.common)
      );
      const response = await api.get("/api/users");
      console.log(
        "[Users.jsx] fetchUsers: Raw response from /api/users:",
        response.data
      );
      if (response.data && Array.isArray(response.data.data)) {
        setUsers(response.data.data);
      } else {
        console.warn("[Users.jsx] fetchUsers: response.data.data is not an array or is missing. Setting users to [].", response.data);
        setUsers([]); // Ensure users is an array
        setError("Received unexpected data format from server.");
      }
      setLoading(false);
    } catch (err) {
      console.error(
        "[Users.jsx] fetchUsers: Error fetching users:",
        err.response || err
      );
      setError(err.response?.data?.error || "Failed to fetch users");
      if (err.response?.status === 403) {
        console.error(
          "[Users.jsx] fetchUsers: Received 403 Forbidden. User is not authorized."
        );
        setError("You are not authorized to view this page. Only super-admins can access this.");
        setIsUnauthorized(true);
      } else if (err.response?.status === 401) {
        console.error(
          "[Users.jsx] fetchUsers: Received 401 Unauthorized. Token might be invalid or expired."
        );
        setError("Authentication failed. Please log in again.");
        // localStorage.removeItem("erp-user"); // Consider if you want to auto-logout
        // navigate("/login");
      }
      setUsers([]); // Ensure users is an empty array on error
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log("[Users.jsx] useEffect: Component mounted, calling fetchUsers.");
    fetchUsers();
  }, []);

  const handleView = (user) => {
    setSelectedUser(user);
    console.log("[Users.jsx] handleView: Selected user for view:", user);
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
      password: "",
      isActive: true,
    });
    console.log("[Users.jsx] handleEdit: Selected user for edit:", user, "FormData initialized:", formData);
    setShowEditModal(true);
  };

  const handleDelete = async (userId) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      console.log(
        `[Users.jsx] handleDelete: Attempting to delete user ${userId}`
      );
      const authTokenString = getAuthToken();
      if (!authTokenString) {
        console.error(
          "[Users.jsx] handleDelete: No token found. Aborting delete."
        );
        alert("Authentication token not found. Please log in again.");
        return;
      }
      try {
        api.defaults.headers.common[
          "Authorization"
        ] = `Bearer ${authTokenString}`;
        await api.delete(`/api/users/${userId}`);
        console.log(
          `[Users.jsx] handleDelete: Successfully deleted user ${userId}`
        );
        setUsers(users.filter((user) => user._id !== userId));
      } catch (err) {
        console.error(
          "[Users.jsx] handleDelete: Error deleting user:",
          err.response || err
        );
        alert(err.response?.data?.error || "Failed to delete user");
        if (err.response?.status === 401) {
        }
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      const action = selectedUser ? "Updating" : "Adding new";
      console.log(
        "[Users.jsx] handleSave: Attempting to save user. SelectedUser:",
        selectedUser,
        "FormData:",
        formData
      );
      const authTokenString = getAuthToken();

      if (!authTokenString) {
        console.error("[Users.jsx] handleSave: No token found. Aborting save.");
        alert("Authentication token not found. Please log in again.");
        return;
      }

      if (!formData.firstname || !formData.lastname || !formData.email) {
        throw new Error("First name, last name and email are required");
      }

      if (!selectedUser && !formData.password) {
        throw new Error("Password is required for new users");
      }

      api.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${authTokenString}`;

      if (selectedUser) {
        // Update existing user
        const response = await api.put(
          `/api/users/${selectedUser._id}`,
          formData
        );
        setUsers(
          users.map((user) =>
            user._id === selectedUser._id ? response.data : user
          )
        );
      } else {
        // Add new user - ensure password is included
        const userData = {
          ...formData,
          isActive: true, // Ensure new users are active
        };

        const response = await api.post("/api/users", userData);
        setUsers([...users, response.data]);
      }
      console.log(`[Users.jsx] handleSave: Successfully ${action} user.`);

      // Reset form and close modal
      setFormData({
        firstname: "",
        lastname: "",
        email: "",
        phone: "",
        role: "user",
        password: "",
      });
      setShowEditModal(false);
      setSelectedUser(null);

      // Refresh the list
      fetchUsers();
    } catch (err) {
      console.error("[Users.jsx] handleSave: Error saving user:", err.response || err);
      alert(err.response?.data?.error || err.message || "Failed to save user");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // console.log("[Users.jsx] Rendering. Current searchTerm:", searchTerm, "currentPage:", currentPage);
  const filteredUsers = users.filter(
    (user) =>
      user.firstname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // console.log("[Users.jsx] Filtered users count:", filteredUsers.length);
  // Pagination calculations
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  // if (error && !showViewModal && !showEditModal) return <div className="container mt-4"><Alert variant="danger">{error}</Alert></div>;
  // console.log("[Users.jsx] Current items for page:", currentItems.length, "Total pages:", totalPages);

  return (
    <>
      {isUnauthorized ? (
        <Unauthorized />
      ) : (
    <div>
      <Navbar />

      <div className="container mt-4">
        {" "}
        {/* Changed from users-page to container mt-4 */}
        {error && !showViewModal && !showEditModal && (
          <Alert variant="danger" onClose={() => setError("")} dismissible>
            {error}
          </Alert>
        )}
        <div className="d-flex justify-content-between align-items-center mb-4">
          {" "}
          {/* Standard header */}
          <h2 style={{ color: "black" }}>User Management</h2>
          <div className="d-flex align-items-center">
            <Form.Control // Using Form.Control for search
              type="text"
              placeholder="🔍 Search Users..."
              value={searchTerm}
              onChange={(e) => {
                console.log("[Users.jsx] Search term changed:", e.target.value);
                setSearchTerm(e.target.value);
              }}
              className="me-2" // search-input class can be used for further styling if needed
            />
            <BsButton variant="primary" onClick={() => handleEdit(null)}>
              + Add New User
            </BsButton>
          </div>
        </div>
        {/* users-table-container can be removed or kept if it adds specific styling not covered by Bootstrap */}
        <ReusableTable
          columns={[
            {
              key: 'name',
              header: 'Name',
              renderCell: (user) => (
                <div className="user-avatar">
                  <span>{user.firstname?.charAt(0).toUpperCase()}</span>
                  {user.firstname} {user.lastname}
                  {user.role === "super-admin" && (
                    <FaUserShield
                      className="super-admin-icon"
                      title="Super Admin"
                    />
                  )}
                </div>
              ),
            },
            { key: 'email', header: 'Email' },
            { key: 'phone', header: 'Phone', renderCell: (user) => user.phone || "-" },
            {
              key: 'role',
              header: 'Role',
              renderCell: (user) => (
                <span className={`role-badge ${user.role.toLowerCase()}`}>
                  {user.role}
                </span>
              ),
            },
            { key: 'createdAt', header: 'Created At', renderCell: (user) => formatDate(user.createdAt) },
          ]}
          data={currentItems}
          keyField="_id"
          isLoading={loading && currentItems.length === 0}
          error={error && currentItems.length === 0 ? error : null}
          // onSort={requestSort} // Add if sorting is needed for Users page
          // sortConfig={sortConfig} // Add if sorting is needed
          renderActions={(user) => (
            <ActionButtons
              item={user}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onGenerateReport={handleGenerateReport}
              isLoading={loading}
              disabled={{ delete: user.role === "super-admin" }}
            />
          )}
          noDataMessage="No users found"
          tableClassName="mt-3"
          theadClassName="table-dark"
          tbodyClassName="text-center"
        />
        {filteredUsers.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={(page) => {
              if (page >= 1 && page <= totalPages) setCurrentPage(page);
              console.log("[Users.jsx] Page changed to:", page);
            }}
            onGoToFirst={() => {setCurrentPage(1); console.log("[Users.jsx] Go to first page.");}}
            onGoToLast={() => {setCurrentPage(totalPages); console.log("[Users.jsx] Go to last page.");
            }}
          />
        )}
        {/* View Modal */}
        {showViewModal && selectedUser && (
          <div
            className="popup-overlay"
            onClick={() => setShowViewModal(false)}
          >
            <div
              className="popup-form ninety-five-percent"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="popup-header">
                <h2>User Details</h2>
                <button
                  className="close-btn"
                  onClick={() => setShowViewModal(false)}
                >
                  {" "}
                  {/* Using existing close-btn class for '✖' */}
                  <FaTimes />
                </button>
              </div>
              <div className="form-content">
                {" "}
                {/* Use form-content for padding */}
                <div className="user-profile">
                  <div className="avatar-large">
                    {selectedUser.firstname?.charAt(0).toUpperCase()}
                    {selectedUser.role === "super-admin" && (
                      <FaUserShield
                        className="super-admin-badge"
                        title="Super Admin"
                      />
                    )}
                  </div>
                  <h3>
                    {selectedUser.firstname} {selectedUser.lastname}
                  </h3>
                  <p className="user-email">{selectedUser.email}</p>
                </div>
                <div className="user-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Phone:</span>
                    <span className="detail-value">
                      {selectedUser.phone || "-"}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Role:</span>
                    <span
                      className={`detail-value role-badge ${selectedUser.role.toLowerCase()}`}
                    >
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

              <div className="form-actions">
                {" "}
                {/* Use form-actions for consistency */}
                <BsButton
                  variant="secondary"
                  onClick={() => setShowViewModal(false)}
                >
                  Close
                </BsButton>
              </div>
            </div>
          </div>
        )}
        {/* Edit Modal */}
        {showEditModal && (
          <div
            className="popup-overlay"
            onClick={() => {
              setShowEditModal(false);
              setSelectedUser(null);
            }}
          >
            <div
              className="popup-form ninety-five-percent"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="popup-header">
                <h2>{selectedUser ? "Edit User" : "Add New User"}</h2>
                <button
                  className="close-btn"
                  onClick={() => {
                    /* Using existing close-btn class for '✖' */
                    setShowEditModal(false);
                    setSelectedUser(null);
                  }}
                >
                  <FaTimes />
                </button>
              </div>
              <div className="form-content">
                {" "}
                {/* Use form-content for padding */}
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
              <div className="form-actions">
                {" "}
                {/* Use form-actions for consistency */}
                <BsButton
                  variant="secondary"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedUser(null);
                  }}
                >
                  Cancel
                </BsButton>
                <BsButton variant="success" onClick={handleSave}>
                  {selectedUser ? "Update User" : "Create User"}
                </BsButton>
              </div>
            </div>
          </div>
        )}

        <UserReportModal
                  show={showReportModal}
                  onHide={() => setShowReportModal(false)}
                  user={reportUser} // This should be the full user object
                />
      </div>
    </div>
      )}
    </>
  );
};

export default Users;
