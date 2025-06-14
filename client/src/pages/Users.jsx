import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
<<<<<<< HEAD
import {
  FaTimes,
  FaUserShield,
  FaChartBar,
} from "react-icons/fa"; // FaChartBar is not used, consider removing
import apiClient from "../utils/apiClient"; // Import apiClient
=======
import { FaTimes, FaUserShield } from "react-icons/fa";
>>>>>>> e24766db557916714610528af9dff9872e3a0639
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
import { PlusCircle } from "react-bootstrap-icons";
import ReusableModal from "../components/ReusableModal";
import UserReportModal from "../components/UserReportModal";
import "../css/Users.css";

//to-do add getauth token

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
    isActive: true,
  });
  const [passwordError, setPasswordError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(5);
  const navigate = useNavigate();
  const [showUserReportModal, setShowUserReportModal] = useState(false);
  const [selectedUserForReport, setSelectedUserForReport] = useState(null);

<<<<<<< HEAD
  const handleGenerateReport = (user) => {
    console.log("[Users.jsx] handleGenerateReport: Generating report for user:", user);
    setReportUser(user);
    setShowReportModal(true);
  };


  // Fetch users from backend
  const fetchUsers = async () => {
    try {
      console.log("[Users.jsx] fetchUsers: Attempting to fetch users.");      
      const authTokenString = getAuthToken();
      // apiClient handles token internally, but we can check here for early exit if needed
      // if (!authTokenString) { ... } 

      setLoading(true);
      setError(""); // Clear previous errors
      setIsUnauthorized(false); // Reset unauthorized state

      // Use apiClient - endpoint is "users" relative to API_BASE_URL (which includes /api)
      const responseData = await apiClient("users"); 

      console.log(
        "[Users.jsx] fetchUsers: Raw response from /api/users:",
        responseData
      );
      if (responseData && Array.isArray(responseData.data)) {
        setUsers(responseData.data);
      } else {
        console.warn("[Users.jsx] fetchUsers: responseData.data is not an array or is missing. Setting users to [].", responseData);
        setUsers([]); // Ensure users is an array
        setError("Received unexpected data format from server.");
      }
      setLoading(false);
    } catch (err) {
      console.error(
        "[Users.jsx] fetchUsers: Error fetching users:",
        err.data || err // apiClient error structure
      );
      setError(err.data?.error || err.data?.message || "Failed to fetch users");
      if (err.status === 403) { // apiClient error structure
        console.error(
          "[Users.jsx] fetchUsers: Received 403 Forbidden. User is not authorized."
        );
        setError("You are not authorized to view this page. Only super-admins can access this.");
        setIsUnauthorized(true);
      } else if (err.status === 401) { // apiClient error structure
        console.error(
          "[Users.jsx] fetchUsers: Received 401 Unauthorized. Token might be invalid or expired."
        );
        setError("Authentication failed. Please log in again.");
        // localStorage.removeItem("erp-user"); // Consider if you want to auto-logout
        // navigate("/login");
=======
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
>>>>>>> e24766db557916714610528af9dff9872e3a0639
      }
    } finally {
      setLoading(false);
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
      password: "",
      confirmPassword: "",
      isActive: user?.isActive ?? true,
    });
    setPasswordError("");
    setShowEditModal(true);
  };

<<<<<<< HEAD
  const handleToggleActiveStatus = async (userToToggle) => {
    const newStatus = !userToToggle.isActive;

    if (!newStatus && !window.confirm(`Are you sure you want to disable user ${userToToggle.firstname} ${userToToggle.lastname}? They will not be able to log in.`)) {
      return;
    }
    if (newStatus && !window.confirm(`Are you sure you want to enable user ${userToToggle.firstname} ${userToToggle.lastname}?`)) {
      return;
    }

    // apiClient handles token
    // const authTokenString = getAuthToken();
    // if (!authTokenString) { ... }

    try {
      const responseData = await apiClient(`users/${userToToggle._id}/status`, { // Use apiClient
        method: "PATCH",
        body: { isActive: newStatus },
      });

      setUsers(users.map(u => u._id === userToToggle._id ? responseData.data : u));
      alert(`User ${userToToggle.firstname} ${newStatus ? 'enabled' : 'disabled'} successfully.`);

    } catch (err) {
      console.error("[Users.jsx] handleToggleActiveStatus: Error toggling user status:", err.response || err);
      alert(err.response?.data?.error || err.response?.data?.message || "Failed to update user status.");
      // If the API call fails, we might want to revert the UI,
      // but for now, the user state won't be changed if an error occurs,
      // and an alert will be shown. The checkbox will remain in its original state
      // unless the page is reloaded or state is manually reset.
      // To ensure UI consistency, one might refetch the specific user or the whole list,
      // or revert the optimistic update if one was made before await.
=======
  const handleDelete = async (userToDelete) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await apiClient(`/users/${userToDelete._id}`, { method: "DELETE" });
        toast.success("User deleted successfully");
        fetchUsers();
      } catch (err) {
        toast.error(handleApiError(err, "Failed to delete user"));
      }
>>>>>>> e24766db557916714610528af9dff9872e3a0639
    }
  };

  const handleToggleActiveStatus = async (user) => {
    const newStatus = !user.isActive;
    const confirmMessage = newStatus
      ? `Enable user ${user.firstname} ${user.lastname}?`
      : `Disable user ${user.firstname} ${user.lastname}?`;

<<<<<<< HEAD
    if (!userIdToDelete) {
      console.error("[Users.jsx] handleDelete: Invalid user ID for deletion. Argument received:", userArg);
      alert("Cannot delete user: User ID is missing or invalid.");
      return;
    }

    // Improved confirmation message
    if (window.confirm(`Are you sure you want to delete user ${userArg?.firstname || 'this user'} (ID: ${userIdToDelete})?`)) {
      console.log(
        `[Users.jsx] handleDelete: Attempting to delete user ${userIdToDelete}`
      );
      // apiClient handles token
      // const authTokenString = getAuthToken();
      // if (!authTokenString) { ... }
      try {
        await apiClient(`users/${userIdToDelete}`, { method: "DELETE" }); // Use apiClient

        console.log(
          `[Users.jsx] handleDelete: Successfully deleted user ${userIdToDelete}`
=======
    if (window.confirm(confirmMessage)) {
      try {
        await apiClient(`/users/${user._id}/status`, {
          method: "PATCH",
          body: { isActive: newStatus },
        });
        toast.success(
          `User ${newStatus ? "enabled" : "disabled"} successfully`
>>>>>>> e24766db557916714610528af9dff9872e3a0639
        );
        fetchUsers();
      } catch (err) {
<<<<<<< HEAD
        console.error(
          "[Users.jsx] handleDelete: Error deleting user. Status:", // apiClient error structure
          err.status, "Message:", err.data?.message || err.message
        );
        alert(err.data?.message || err.message || "Failed to delete user");
        if (err.status === 401) { // apiClient error structure
        }
=======
        toast.error(handleApiError(err, "Failed to update user status"));
>>>>>>> e24766db557916714610528af9dff9872e3a0639
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

<<<<<<< HEAD
  const handleSave = async () => {
    try {
      const action = selectedUser ? "Updating" : "Adding new";
      console.log(
        "[Users.jsx] handleSave: Attempting to save user. SelectedUser:",
        selectedUser,
        "FormData:",
        formData
      );
      // apiClient handles token
      // const authTokenString = getAuthToken();
      // if (!authTokenString) { ... }

      if (!formData.firstname || !formData.lastname || !formData.email) {
        throw new Error("First name, last name and email are required");
      }

      if (!selectedUser && !formData.password) {
        throw new Error("Password is required for new users");
      }

      if (selectedUser) {
        // Update existing user
        const responseData = await apiClient(`users/${selectedUser._id}`, { // Use apiClient
          method: "PUT",
          body: formData,
        });
        setUsers(
          users.map((user) =>
            user._id === selectedUser._id ? responseData : user // apiClient returns data directly
          )
        );
      } else {
        // Add new user - ensure password is included
        const userData = {
          ...formData,
          isActive: true, // Ensure new users are active
        };
        const responseData = await apiClient("users", { // Use apiClient
          method: "POST",
          body: userData,
        });
        setUsers([...users, responseData]); // apiClient returns data directly
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
      console.error("[Users.jsx] handleSave: Error saving user:", err.data || err); // apiClient error structure
      alert(err.data?.error || err.data?.message || err.message || "Failed to save user");
=======
    if (name === "password" || name === "confirmPassword") {
      setPasswordError("");
>>>>>>> e24766db557916714610528af9dff9872e3a0639
    }
  };

  const validatePassword = () => {
    setPasswordError("");

    // For new users, password is required
    if (!selectedUser && !formData.password) {
      setPasswordError("Password is required");
      return false;
    }

    // If password is provided (for new or existing user)
    if (formData.password) {
      if (formData.password.length < 5) {
        setPasswordError("Password must be at least 5 characters");
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setPasswordError("Passwords do not match");
        return false;
      }
    }
    return true;
  };

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
        isActive: formData.isActive,
      };

      // Include password in the payload if it's provided
      if (formData.password) {
        userData.password = formData.password;
      }

      if (selectedUser) {
        // For existing user - update
        response = await apiClient(`/users/${selectedUser._id}`, {
          method: "PUT",
          body: userData,
        });
      } else {
        // For new user - create
        response = await apiClient("/users", {
          method: "POST",
          body: userData,
        });
      }

      toast.success(
        `User ${selectedUser ? "updated" : "created"} successfully` +
          (formData.password ? " (password changed)" : "")
      );
      setShowEditModal(false);
      fetchUsers();
    } catch (err) {
      toast.error(handleApiError(err, "Failed to save user"));
    }
  };

  const handleOpenReportModal = (userToReport) => {
    setSelectedUserForReport(userToReport);
    setShowUserReportModal(true);
  };

  const filteredUsers = users.filter((user) =>
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

        <div
          className="d-flex justify-content-between align-items-center mb-4"
          style={{ width: "100%", overflow: "hidden" }}
        >
          <h2 className="m-0" style={{ whiteSpace: "nowrap" }}>
            User Management
          </h2>
          <div
            className="d-flex align-items-center"
            style={{ width: "60%", minWidth: "300px" }}
          >
            <SearchBar
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              placeholder="Search users..."
              showButton={true}
              onAddNew={() => handleEdit(null)}
              buttonText="Add New User"
              buttonIcon={<PlusCircle size={18} />}
              style={{ width: "100%", maxWidth: "400px", marginRight: "10px" }}
            />
          </div>
        </div>

        <ReusableTable
          columns={[
            {
              key: "name",
              header: "Name",
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
            { key: "email", header: "Email" },
            {
              key: "role",
              header: "Role",
              renderCell: (user) => (
                <span className={`role-badge ${user.role.toLowerCase()}`}>
                  {user.role}
                </span>
              ),
            },
            {
              key: "status",
              header: "Status",
              renderCell: (user) => (
                <Form.Check
                  type="switch"
                  checked={user.isActive}
                  onChange={() => handleToggleActiveStatus(user)}
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
              onGenerateReport={handleOpenReportModal}
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
              <BsButton
                variant="secondary"
                onClick={() => setShowViewModal(false)}
              >
                Close
              </BsButton>
            }
          >
            <div className="user-profile">
              <div className="avatar-large">
                {selectedUser.firstname?.charAt(0).toUpperCase()}
              </div>
              <h3>
                {selectedUser.firstname} {selectedUser.lastname}
              </h3>
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
                  <span
                    className={`detail-value role-badge ${selectedUser.role.toLowerCase()}`}
                  >
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
                <BsButton
                  variant="secondary"
                  onClick={() => setShowEditModal(false)}
                >
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
                <Form.Label>First Name <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  name="firstname"
                  value={formData.firstname}
                  onChange={handleInputChange}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Last Name <span className="text-danger">*</span></Form.Label>
                <Form.Control
                  name="lastname"
                  value={formData.lastname}
                  onChange={handleInputChange}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Email <span className="text-danger">*</span></Form.Label>
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
                <Form.Label>Role <span className="text-danger">*</span></Form.Label>
                <Form.Select
                  name="role"
                  value={formData.role}
                  onChange={handleInputChange}
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
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                />
              </Form.Group>

              <hr />
              <h5>Password {selectedUser ? "Change" : ""}</h5>
              <Form.Group className="mb-3">
                <Form.Label>
                  {selectedUser ? "New Password" : "Password *"}
                </Form.Label>
                <Form.Control
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required={!selectedUser} // Required only for new users
                  placeholder={
                    selectedUser
                      ? "Enter new password to change"
                      : "Enter password"
                  }
                />
                <Form.Text className="text-muted">
                  Must be at least 5 characters.
                </Form.Text>
              </Form.Group>

              {(formData.password || !selectedUser) && (
                <Form.Group className="mb-3">
                  <Form.Label>
                    {selectedUser
                      ? "Confirm New Password"
                      : "Confirm Password *"}
                  </Form.Label>
                  <Form.Control
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    required={!selectedUser || formData.password}
                    placeholder={
                      selectedUser ? "Confirm new password" : "Confirm password"
                    }
                  />
                </Form.Group>
              )}

              {passwordError && (
                <Alert variant="danger" className="mt-2">
                  {passwordError}
                </Alert>
              )}
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
