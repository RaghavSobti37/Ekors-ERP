import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaTimes, FaUserShield } from "react-icons/fa";
import Navbar from "../components/Navbar";
import { Table, Button as BsButton, Alert, Form } from "react-bootstrap";
import Pagination from "../components/Pagination";
import Footer from "../components/Footer";
import ReusableTable from "../components/ReusableTable";
import SearchBar from "../components/Searchbar";
import Unauthorized from "../components/Unauthorized";
import ActionButtons from "../components/ActionButtons";
import { getAuthToken } from "../utils/authUtils";
import apiClient from "../utils/apiClient";
import { toast } from "react-toastify";
import { handleApiError } from "../utils/helpers";
import { PlusCircle } from 'react-bootstrap-icons';
import ReusableModal from "../components/ReusableModal";
import UserReportModal from "../components/UserReportModal"; // Import the report modal
import "../css/Users.css";

const Users = () => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isUnauthorized, setIsUnauthorized] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    firstname: "",
    lastname: "",
    email: "",
    phone: "",
    role: "user",
    password: "",
    confirmPassword: "",
    isActive: true
  });
  const [passwordError, setPasswordError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const navigate = useNavigate();
  const [showUserReportModal, setShowUserReportModal] = useState(false);
  const [selectedUserForReport, setSelectedUserForReport] = useState(null);

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient("/users");
      setUsers(response.data);
      setError("");
      setIsUnauthorized(false);
    } catch (err) {
      const errorMessage = handleApiError(err, "Failed to fetch users");
      setError(errorMessage);
      
      if (err.status === 403) {
        setIsUnauthorized(true);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Handle view user
  const handleView = (user) => {
    setSelectedUser(user);
    setShowViewModal(true);
  };

  // Handle edit user
  const handleEdit = (user) => {
    setSelectedUser(user);
    setFormData({
      firstname: user?.firstname || "",
      lastname: user?.lastname || "",
      email: user?.email || "",
      phone: user?.phone || "",
      role: user?.role || "user",
      password: "",
      confirmPassword: "",
      isActive: user?.isActive ?? true
    });
    setShowEditModal(true);
  };

  // Handle delete user
  const handleDelete = async (userId) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await apiClient(`/users/${userId}`, { method: "DELETE" });
        toast.success("User deleted successfully");
        fetchUsers();
      } catch (err) {
        toast.error(handleApiError(err, "Failed to delete user"));
      }
    }
  };

  // Handle toggle active status
  const handleToggleActiveStatus = async (user) => {
    const newStatus = !user.isActive;
    const confirmMessage = newStatus 
      ? `Enable user ${user.firstname} ${user.lastname}?`
      : `Disable user ${user.firstname} ${user.lastname}?`;

    if (window.confirm(confirmMessage)) {
      try {
        await apiClient(`/users/${user._id}/status`, {
          method: "PATCH",
          body: { isActive: newStatus }
        });
        toast.success(`User ${newStatus ? "enabled" : "disabled"} successfully`);
        fetchUsers();
      } catch (err) {
        toast.error(handleApiError(err, "Failed to update user status"));
      }
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === "password" || name === "confirmPassword") {
      setPasswordError("");
    }
  };

  // Validate password
  const validatePassword = () => {
    if (!selectedUser && !formData.password) {
      setPasswordError("Password is required");
      return false;
    }

    if (formData.password && formData.password.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setPasswordError("Passwords do not match");
      return false;
    }

    return true;
  };

  // Save user (create or update)
  const handleSave = async () => {
    if (!validatePassword()) return;

    try {
      let response;
      const userData = {
        firstname: formData.firstname,
        lastname: formData.lastname,
        email: formData.email,
        phone: formData.phone,
        role: formData.role,
        isActive: formData.isActive
      };

      if (formData.password) {
        userData.password = formData.password;
      }

      if (selectedUser) {
        response = await apiClient(`/users/${selectedUser._id}`, {
          method: "PUT",
          body: userData
        });
      } else {
        response = await apiClient("/users", {
          method: "POST",
          body: userData
        });
      }

      toast.success(`User ${selectedUser ? "updated" : "created"} successfully`);
      setShowEditModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(handleApiError(err, "Failed to save user"));
    }
  };

  // Handle opening the report modal
  const handleOpenReportModal = (userToReport) => {
    setSelectedUserForReport(userToReport);
    setShowUserReportModal(true);
  };

  // Filter and paginate users
  const filteredUsers = users.filter(user =>
    `${user.firstname} ${user.lastname} ${user.email} ${user.role}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);

  if (isUnauthorized) {
    return <Unauthorized />;
  }

  return (
    <>
      <Navbar />
      <div className="container mt-4">
        {error && (
          <Alert variant="danger" onClose={() => setError("")} dismissible>
            {error}
          </Alert>
        )}

        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2>User Management</h2>
          <SearchBar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            placeholder="Search users..."
            showButton={true}
            onAddNew={() => handleEdit(null)}
            buttonText="Add New User"
            buttonIcon={<PlusCircle size={18} />}
          />
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
                    <FaUserShield className="super-admin-icon" title="Super Admin" />
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
              key: 'status',
              header: 'Status',
              renderCell: (user) => (
                <Form.Check
                  type="switch"
                  checked={user.isActive}
                  onChange={() => handleToggleActiveStatus(user)}
                  disabled={user.role === 'super-admin'}
                />
              ),
            },
          ]}
          data={currentItems}
          keyField="_id"
          isLoading={loading}
          error={error}
          renderActions={(user) => (
            <ActionButtons
              item={user}
              onView={handleView}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onGenerateReport={handleOpenReportModal} // Add report generation handler
              disabled={{ delete: user.role === "super-admin" }}
            />
          )}
          noDataMessage="No users found"
        />

        {filteredUsers.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredUsers.length}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
            onItemsPerPageChange={setItemsPerPage}
          />
        )}

        {/* View Modal */}
        {showViewModal && selectedUser && (
          <ReusableModal
            show={showViewModal}
            onHide={() => setShowViewModal(false)}
            title="User Details"
            footerContent={
              <BsButton variant="secondary" onClick={() => setShowViewModal(false)}>
                Close
              </BsButton>
            }
          >
            <div className="user-profile">
              <div className="avatar-large">
                {selectedUser.firstname?.charAt(0).toUpperCase()}
              </div>
              <h3>{selectedUser.firstname} {selectedUser.lastname}</h3>
              <p className="user-email">{selectedUser.email}</p>
              
              <div className="user-details-grid">
                <div className="detail-item">
                  <span className="detail-label">Phone:</span>
                  <span className="detail-value">
                    {selectedUser.phone || "-"}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Role:</span>
                  <span className={`detail-value role-badge ${selectedUser.role.toLowerCase()}`}>
                    {selectedUser.role}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Status:</span>
                  <span className="detail-value">
                    {selectedUser.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </ReusableModal>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <ReusableModal
            show={showEditModal}
            onHide={() => setShowEditModal(false)}
            title={selectedUser ? "Edit User" : "Add New User"}
            footerContent={
              <>
                <BsButton variant="secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </BsButton>
                <BsButton variant="primary" onClick={handleSave}>
                  {selectedUser ? "Update" : "Create"}
                </BsButton>
              </>
            }
          >
            <Form>
              <Form.Group className="mb-3">
                <Form.Label>First Name *</Form.Label>
                <Form.Control
                  name="firstname"
                  value={formData.firstname}
                  onChange={handleInputChange}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Last Name *</Form.Label>
                <Form.Control
                  name="lastname"
                  value={formData.lastname}
                  onChange={handleInputChange}
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
                  required
                  disabled={!!selectedUser}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Phone</Form.Label>
                <Form.Control
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Role *</Form.Label>
                <Form.Select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
                  disabled={selectedUser?.role === "super-admin"}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="super-admin">Super Admin</option>
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Status</Form.Label>
                <Form.Check
                  type="switch"
                  name="isActive"
                  label={formData.isActive ? "Active" : "Inactive"}
                  checked={formData.isActive}
                  onChange={(e) => 
                    setFormData({...formData, isActive: e.target.checked})
                  }
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>
                  {selectedUser ? "New Password" : "Password *"}
                </Form.Label>
                <Form.Control
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required={!selectedUser}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Confirm Password *</Form.Label>
                <Form.Control
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required={!selectedUser || formData.password}
                />
                {passwordError && (
                  <Form.Text className="text-danger">{passwordError}</Form.Text>
                )}
              </Form.Group>
            </Form>
          </ReusableModal>
        )}
      </div>
      {/* User Report Modal */}
      {showUserReportModal && selectedUserForReport && (
        <UserReportModal
          show={showUserReportModal}
          onHide={() => {
            setShowUserReportModal(false);
            setSelectedUserForReport(null);
          }}
          user={selectedUserForReport}
        />
      )}
      <Footer />
    </>
  );
};

export default Users;