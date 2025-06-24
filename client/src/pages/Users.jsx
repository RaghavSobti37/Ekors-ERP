import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FaUserShield } from "react-icons/fa"; // Removed FaTimes as it's not used directly here
import { PlusCircle } from "react-bootstrap-icons"; // Removed BriefcaseFill, PeopleFill
import Navbar from "../components/Navbar";
import { Button as BsButton, Alert, Form, Nav, Card } from "react-bootstrap"; // Added Nav back
import Pagination from "../components/Pagination";
import Footer from "../components/Footer";
import ReusableTable from "../components/ReusableTable";
import SearchBar from "../components/Searchbar";
import Unauthorized from "../components/Unauthorized";
import ActionButtons from "../components/ActionButtons";
import apiClient from "../utils/apiClient";
import { toast } from "react-toastify";
import { handleApiError } from "../utils/helpers";
import ReusableModal from "../components/ReusableModal";
import UserReportModal from "../components/UserReportModal";
import LoadingSpinner from "../components/LoadingSpinner"; // Import LoadingSpinner
import { useAuth } from "../context/AuthContext"; // Import useAuth
import "../css/Users.css";

const Users = () => {
  // const location = useLocation(); // No longer needed for activeView from state
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [pageLoading, setPageLoading] = useState(true); // Renamed for clarity
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
  const { user: authUser, loading: authLoading } = useAuth(); // Get authUser and authLoading state

  // Client Management State and functions removed

  const fetchUsers = React.useCallback(async (token) => {
    try {
      setPageLoading(true);
      const response = await apiClient("/users");
      setUsers(response.data);
      setError("");
      setIsUnauthorized(false);
    } catch (err) {
      const errorMsg = handleApiError(err, "Failed to fetch users");
      setError(errorMsg);
      if (err.status === 403) {
        setIsUnauthorized(true);
      }
    } finally {
      setPageLoading(false);
    }
  }, []); // Dependencies like setPageLoading are stable setters from useState

  useEffect(() => {
    if (!authLoading && authUser) {
      fetchUsers(); // Pass token if your fetchUsers expects it
    } else if (!authLoading && !authUser) {
      navigate("/login", { state: { from: "/users" } });
    }
  }, [authLoading, authUser, navigate, fetchUsers]);

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

  const handleDelete = async (userToDelete) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      try {
        await apiClient(`/users/${userToDelete._id}`, { method: "DELETE" });
        toast.success("User deleted successfully");
        fetchUsers();
      } catch (err) {
        toast.error(handleApiError(err, "Failed to delete user"));
      }
    }
  };

  const handleToggleActiveStatus = async (user) => {
    const newStatus = !user.isActive;
    const confirmMessage = newStatus
      ? `Enable user ${user.firstname} ${user.lastname}?`
      : `Disable user ${user.firstname} ${user.lastname}?`;

    if (window.confirm(confirmMessage)) {
      try {
        await apiClient(`/users/${user._id}/status`, {
          method: "PATCH",
          body: { isActive: newStatus },
        });
        toast.success(
          `User ${newStatus ? "enabled" : "disabled"} successfully`
        );
        fetchUsers();
      } catch (err) {
        toast.error(handleApiError(err, "Failed to update user status"));
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "password" || name === "confirmPassword") {
      setPasswordError("");
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

  // Client action handlers removed

  const filteredUsers = users.filter((user) =>
    `${user.firstname} ${user.lastname} ${user.email} ${user.role}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  // Pagination for users
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);

  if (isUnauthorized) {
    return <Unauthorized />;
  }

  const renderUserManagement = () => (
    <>
      <div // This div was previously inside the Card.Body, now it's the main content
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
            disabled={pageLoading || authLoading}
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
                disabled={pageLoading || authLoading}
              />
            ),
          },
        ]}
        data={currentItems}
        keyField="_id"
        isLoading={pageLoading || authLoading}
        error={error && !pageLoading && !authLoading ? error : null}
        renderActions={(user) => (
          <ActionButtons
            item={user}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onGenerateReport={handleOpenReportModal}
            isLoading={pageLoading || authLoading}
          />
        )}
        noDataMessage="No users found"
      />
      {!pageLoading && !authLoading && filteredUsers.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalItems={filteredUsers.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
          onItemsPerPageChange={setItemsPerPage}
        />
      )}
    </>
  );

  return (
    <>
      <Navbar />
      <LoadingSpinner show={pageLoading || authLoading} />
      <div className="container mt-4">
        {error && ( // Keep general error display
          <Alert variant="danger" onClose={() => setError("")} dismissible>
            {error}
          </Alert>
        )}

        {/* Removed Nav tabs and Card wrapper, directly rendering user management */}
        {!pageLoading && !authLoading && !isUnauthorized && (
          <>
            {renderUserManagement()}
          </>
        )}

        {/* Modals for User Management */}
        {/* Conditional rendering for modals no longer needs activeView check,
            as this page only handles users. */}
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
                <span>{selectedUser.firstname?.charAt(0).toUpperCase()}</span>
                {selectedUser.firstname} {selectedUser.lastname}
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

              {selectedUser.roleChangeHistory &&
                selectedUser.roleChangeHistory.length > 0 && (
                  <>
                    <hr />
                    <h5 className="mt-3 mb-3 text-start w-100">
                      Role Change History
                    </h5>
                    <div className="role-history-list">
                      {selectedUser.roleChangeHistory
                        .slice()
                        .reverse() // Show most recent first
                        .map((entry, index) => (
                          <div key={index} className="history-entry">
                            <p className="history-entry-role">
                              Role set to <strong>{entry.newRole}</strong>
                            </p>
                            <p className="history-entry-meta text-muted small">
                              by {entry.changedBy ? `${entry.changedBy.firstname} ${entry.changedBy.lastname}` : "an unknown user"} on {new Date(entry.changedAt).toLocaleDateString()}
                            </p>
                          </div>
                        ))}
                    </div>
                  </>
                )}
            </div>
          </ReusableModal>
        )}

        {/* Edit User Modal */}
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
      </div>
      <Footer />
    </>
  );
};

export default Users;
