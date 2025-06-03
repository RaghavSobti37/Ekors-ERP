import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaTimes, FaUserShield } from "react-icons/fa"; // Icons
import Navbar from "../components/Navbar"; // Navigation bar component
import { Table, Button as BsButton, Alert, Form } from "react-bootstrap"; // Renamed Button to BsButton to avoid conflict
import Pagination from "../components/Pagination"; // Component for table pagination
import ReusableTable from "../components/ReusableTable"; // Component for displaying data in a table
import UserReportModal from "../components/UserReportModal"; // Modal for user reports
import SearchBar from "../components/Searchbar.jsx"; // Import the new SearchBar
import Unauthorized from "../components/Unauthorized"; // Import Unauthorized component
import ActionButtons from "../components/ActionButtons"; // Component for table action buttons
import { getAuthToken as getAuthTokenUtil } from "../utils/authUtils"; // Utility for retrieving auth token
import apiClient from "../utils/apiClient"; // Utility for making API requests
import { showToast, handleApiError, formatDisplayDate } from "../utils/helpers"; // Utility functions
import { PlusCircle } from 'react-bootstrap-icons'; // Icon for Add User button
import "../css/Style.css";
import "../css/Users.css"; // Specific styles for Users page
import ReusableModal from "../components/ReusableModal.jsx"; // Import ReusableModal



const Users = () => {
  const [currentUser, setCurrentUser] = useState(null);
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
  const [itemsPerPage, setItemsPerPage] = useState(5); // Default items per page
  const userFormId = "user-form"; // For ReusableModal footer button
  const navigate = useNavigate();

  const handleGenerateReport = (user) => {
    console.log("[Users.jsx] handleGenerateReport: Generating report for user:", user);
    setReportUser(user);
    setShowReportModal(true);
  };

  const fetchUsers = async () => {
    try {
      console.log("[Users.jsx] fetchUsers: Attempting to fetch users.");      
      const authTokenString = getAuthTokenUtil(); // Use utility
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

      // Use apiClient
      const responseData = await apiClient("/users");

      if (responseData && Array.isArray(responseData.data)) {
        setUsers(responseData.data);
      } else {
        console.warn("[Users.jsx] fetchUsers: response.data.data is not an array or is missing. Setting users to [].", response.data);
        setUsers([]); // Ensure users is an array
        setError("Received unexpected data format from server.");
        showToast("Received unexpected data format from server.", false);
      }
      setLoading(false);
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to fetch users");
      setError(errorMessage);
      showToast(errorMessage, false);

      if (err.status === 403) { // apiClient error structure
        console.error(
          "[Users.jsx] fetchUsers: Received 403 Forbidden. User is not authorized."
        );
        setError("You are not authorized to view this page. Only super-admins can access this.");
        setIsUnauthorized(true);
      } else if (err.response?.status === 401) {
        // This case might be handled by apiClient's global error handling or AuthContext
        setError("Authentication failed. Please log in again.");
        navigate("/login");
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
      isActive: user ? user.isActive : true, 
    });
    console.log("[Users.jsx] handleEdit: Selected user for edit:", user, "FormData initialized:", formData);
    setShowEditModal(true);
  };

  const handleToggleActiveStatus = async (userToToggle) => {
    const newStatus = !userToToggle.isActive;

    if (!newStatus && !window.confirm(`Are you sure you want to disable user ${userToToggle.firstname} ${userToToggle.lastname}? They will not be able to log in.`)) {
      return;
    }
    if (newStatus && !window.confirm(`Are you sure you want to enable user ${userToToggle.firstname} ${userToToggle.lastname}?`)) {
      return;
    }

    const authTokenString = getAuthTokenUtil();
    if (!authTokenString) {
      showToast("Authentication token not found. Please log in again.", false);
      return;
    }

    try {
      // Use apiClient
      const responseData = await apiClient(`/users/${userToToggle._id}/status`, {
        method: 'PATCH',
        body: { isActive: newStatus },
      });

      setUsers(users.map(u => u._id === userToToggle._id ? responseData.data : u));
      showToast(`User ${userToToggle.firstname} ${newStatus ? 'enabled' : 'disabled'} successfully.`, true);

    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to update user status.");
      showToast(errorMessage, false);
    }
  };

  const handleDelete = async (userArg) => { // userArg can be the user object or just the ID string
    const userIdToDelete = typeof userArg === 'string' ? userArg : userArg?._id;

    if (!userIdToDelete) {
      console.error("[Users.jsx] handleDelete: Invalid user ID for deletion. Argument received:", userArg);
      showToast("Cannot delete user: User ID is missing or invalid.", false);
      return;
    }

    // Improved confirmation message
    if (window.confirm(`Are you sure you want to delete user ${userArg?.firstname || 'this user'} (ID: ${userIdToDelete})?`)) {
      console.log(
        `[Users.jsx] handleDelete: Attempting to delete user ${userIdToDelete}`
      );
      const authTokenString = getAuthTokenUtil(); // Use utility
      if (!authTokenString) {
        console.error(
          "[Users.jsx] handleDelete: No token found. Aborting delete."
        );
        showToast("Authentication token not found. Please log in again.", false);
        return;
      }
      try {
        // Use apiClient
        await apiClient(`/users/${userIdToDelete}`, { method: 'DELETE' });
        console.log(
          `[Users.jsx] handleDelete: Successfully deleted user ${userIdToDelete}`
        );
        setUsers(users.filter((user) => user._id !== userIdToDelete));
        showToast(`User ${userArg?.firstname || 'ID: ' + userIdToDelete} deleted successfully.`, true);
      } catch (err) {
        const errorMessage = handleApiError(err, "Failed to delete user.");
        showToast(errorMessage, false);
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
      const authTokenString = getAuthTokenUtil(); // Use utility

      if (!authTokenString) {
        console.error("[Users.jsx] handleSave: No token found. Aborting save.");
        showToast("Authentication token not found. Please log in again.", false);
        return;
      }

      if (!formData.firstname || !formData.lastname || !formData.email) {
        throw new Error("First name, last name and email are required");
      }

      if (!selectedUser && !formData.password) {
        throw new Error("Password is required for new users");
      }

      let responseData;

      if (selectedUser) {
        responseData = await apiClient(`/users/${selectedUser._id}`, { // Use apiClient
          method: 'PUT',
          body: formData,
        });
        setUsers(
          users.map((user) =>
            user._id === selectedUser._id ? responseData : user // apiClient returns data directly
          )
        );
      } else {
        const userData = {
          ...formData,
          isActive: true, // Ensure new users are active
        };
        responseData = await apiClient("/users", { method: 'POST', body: userData }); // Use apiClient
        setUsers([...users, responseData]);
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
      showToast(`User ${action === 'Updating' ? 'updated' : 'added'} successfully.`, true);
      fetchUsers();
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to save user.");
      showToast(errorMessage, false);
      // If error has specific field details (e.g., from validation), handleApiError might return that.
      // Otherwise, a generic message is shown.
    }
  };


  // console.log("[Users.jsx] Rendering. Current searchTerm:", searchTerm, "currentPage:", currentPage);
  const filteredUsers = users.filter(
    (user) =>
      user.firstname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.lastname.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);

  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to the first page
  };
  
  return (
    <>
      {isUnauthorized ? (
        <Unauthorized />
      ) : (
    <div>
      <Navbar />

      <div className="container mt-4">

        {error && !showViewModal && !showEditModal && (
          <Alert variant="danger" onClose={() => setError("")} dismissible>
            {error}
          </Alert>
        )}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2 style={{ color: "black" }}>User Management</h2>
          <div className="d-flex align-items-center">
            <SearchBar
              searchTerm={searchTerm}
              setSearchTerm={(value) => {
                console.log("[Users.jsx] Search term changed to:", value);
                setSearchTerm(value);
                setCurrentPage(1); // Reset to first page on new search
              }}
              placeholder="Search users by name, email, role..."
              showButton={true}
              onAddNew={() => handleEdit(null)}
              buttonText="Add New User"
              buttonIcon={<PlusCircle size={18}/>}
              className="me-0"
            />
          </div>
        </div>
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
            {
              key: 'role',
              header: 'Role',
              renderCell: (user) => (
                <span className={`role-badge ${user.role.toLowerCase()}`}>
                  {user.role}
                </span>
              ),
            },
                        {
              key: 'isActive',
              header: 'Status',
              renderCell: (user) => (
                <Form.Check
                  type="switch"
                  id={`user-active-switch-${user._id}`}
                  checked={user.isActive}
                  onChange={() => handleToggleActiveStatus(user)}
                  disabled={currentUser?.id === user._id && user.role === 'super-admin'} // Super-admin cannot toggle their own status via this switch
                  title={currentUser?.id === user._id && user.role === 'super-admin' ? "Super-admins cannot change their own status here." : (user.isActive ? "User is Active (click to disable)" : "User is Inactive (click to enable)")}
                />
              ),
            },
          ]}
          data={currentItems}
          keyField="_id"
          isLoading={loading && currentItems.length === 0}
          error={error && currentItems.length === 0 ? error : null} // Show table-level error only if no items
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
            totalItems={filteredUsers.length}
            itemsPerPage={itemsPerPage}
            onPageChange={(page) => {
              const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
              if (page >= 1 && page <= totalPages) setCurrentPage(page);
              console.log("[Users.jsx] Page changed to:", page);
            }}
            onItemsPerPageChange={handleItemsPerPageChange}
          />
        )}
        {/* View Modal */}
        {showViewModal && selectedUser && (
<ReusableModal
            show={showViewModal && !!selectedUser}
            onHide={() => {
              setShowViewModal(false);
              setSelectedUser(null); // Clear selected user on close
            }}
            title="User Details"
            footerContent={
              <BsButton
                variant="secondary"
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedUser(null);
                }}
              >
                Close
              </BsButton>
            }
          >
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
                  {formatDisplayDate(selectedUser.createdAt)}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Last Updated:</span>
                <span className="detail-value">
                  {formatDisplayDate(selectedUser.updatedAt)}
                </span>

                  </div>
                </div>
          </ReusableModal>
        )}
        {/* Edit Modal */}
        {showEditModal && (
           <ReusableModal
            show={showEditModal}
            onHide={() => {              setShowEditModal(false);
              setSelectedUser(null);
            }}
                        title={selectedUser ? "Edit User" : "Add New User"}
            footerContent={
              <>
                <BsButton
                  variant="secondary"
                  onClick={() => {
                    setShowEditModal(false);
                    setSelectedUser(null);
                  }}
                >
                  Cancel
                </BsButton>
                <BsButton variant="success" type="submit" form={userFormId}>
                  {selectedUser ? "Update User" : "Create User"}
                </BsButton>
              </>
            }

          >
            <Form id={userFormId} onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
              {error && <Alert variant="danger">{error}</Alert>}
              <div className="form-grid"> {/* You can keep .form-grid and its styles from Users.css */}
                <Form.Group className="mb-3">
                  <Form.Label>First Name *</Form.Label>
                  <Form.Control
                    type="text"
                    name="firstname"
                    value={formData.firstname}
                    onChange={handleInputChange}
                    placeholder="Enter First Name"
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Last Name *</Form.Label>
                  <Form.Control
                    type="text"
                    name="lastname"
                    value={formData.lastname}
                    onChange={handleInputChange}
                    placeholder="Enter Last Name"
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Email *</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="Enter email"
                    required
                    disabled={!!selectedUser} // Email usually not editable
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Phone</Form.Label>
                  <Form.Control
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="Enter phone number"
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Role *</Form.Label>
                  <Form.Select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    disabled={selectedUser?.role === "super-admin"} // Super-admin role cannot be changed
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                    {/* Allow setting super-admin only if current user is super-admin and it's a new user or not editing self */}
                    {/* This logic might need to be more sophisticated based on who can create/edit super-admins */}
                    {(!selectedUser || selectedUser?.role !== "super-admin") && (
                      <option value="super-admin">Super Admin</option>
                    )}
                  </Form.Select>
                </Form.Group>
                {!selectedUser && ( // Password field only for new users
                  <Form.Group className="mb-3">
                    <Form.Label>Password *</Form.Label>
                    <Form.Control
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="Enter password"
                      required
                    />
                  </Form.Group>
                )}
              </div>
            </Form>
          </ReusableModal>
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
