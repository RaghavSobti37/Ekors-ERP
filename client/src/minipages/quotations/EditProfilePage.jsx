// c:/Users/Raghav Raj Sobti/Desktop/fresh/client/src/pages/EditProfilePage.jsx
import React, { useState, useEffect, useCallback } from "react";
import {
  Form,
  Button as BsButton,
  Alert,
  Row,
  Col,
  Spinner,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import ReusablePageStructure from "../../components/ReusablePageStructure.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import apiClient from "../../utils/apiClient.js";
import { showToast, handleApiError } from "../../utils/helpers.js";

const MIN_PASSWORD_LENGTH = 5;

const EditProfilePage = () => {
  const { user, updateUserContext, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [profileFormData, setProfileFormData] = useState({
    firstname: "",
    lastname: "",
    phone: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileFormData({
        firstname: user.firstname || "",
        lastname: user.lastname || "",
        phone: user.phone || "",
        newPassword: "",
        confirmPassword: "",
      });
    } else if (!authLoading) {
      // If no user and not loading, redirect to login
      navigate("/login");
    }
  }, [user, authLoading, navigate]); // navigate is stable, but explicit dependency is fine. Can be removed.

  // Optimized handleInputChange with useCallback and functional update
  const handleInputChange = useCallback(
    (e) => {
      const { name, value } = e.target;
      setProfileFormData((prevData) => ({ ...prevData, [name]: value }));
    },
    [setProfileFormData]
  );

  const handleProfileSave = async () => {
    console.log("profileFormData", profileFormData);
    setError("");
    if (
      profileFormData.newPassword &&
      profileFormData.newPassword !== profileFormData.confirmPassword
    ) {
      setError("New passwords do not match.");
      return;
    }
    if (
      profileFormData.newPassword &&
      profileFormData.newPassword.length < MIN_PASSWORD_LENGTH
    ) {
      setError(
        `New password must be at least ${MIN_PASSWORD_LENGTH} characters long.`
      );
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        firstname: profileFormData.firstname,
        lastname: profileFormData.lastname,
        phone: profileFormData.phone,
      };
      if (profileFormData.newPassword) {
        payload.password = profileFormData.newPassword;
      }
      // The backend route for profile update is PATCH /api/users/profile
      const response = await apiClient("/users/profile", {
        method: "PATCH",
        body: payload,
      });
      console.log("Profile update response:", response.data);
      updateUserContext(response.data); // Assuming API returns { data: userObject }
      showToast("Profile updated successfully!", true);
      navigate(-1); // Go back to the previous page (e.g., where Navbar was)
    } catch (err) {
      const errorMsg = handleApiError(
        err,
        "Failed to update profile.",
        user,
        "profileUpdateError"
      );
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <ReusablePageStructure showBackButton={true} title="Loading Profile...">
        <div className="text-center">
          <Spinner animation="border" />
        </div>
      </ReusablePageStructure>
    );
  }

  return (
    <ReusablePageStructure
      showBackButton={true}
      title="Edit Profile"
      footerContent={
        <>
          <BsButton
            variant="secondary"
            onClick={() => navigate(-1)}
            disabled={isLoading}
          >
            Cancel
          </BsButton>
          <BsButton
            variant="primary"
            onClick={handleProfileSave}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Spinner
                  as="span"
                  animation="border"
                  size="sm"
                  role="status"
                  aria-hidden="true"
                />{" "}
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </BsButton>
        </>
      }
    >
      {error && <Alert variant="danger">{error}</Alert>}
      <Form>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>First Name</Form.Label>
              <Form.Control
                type="text"
                name="firstname"
                value={profileFormData.firstname}
                onChange={handleInputChange}
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Last Name</Form.Label>
              <Form.Control
                type="text"
                name="lastname"
                value={profileFormData.lastname}
                onChange={handleInputChange}
              />
            </Form.Group>
          </Col>
        </Row>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                value={user?.email || ""}
                readOnly
                disabled
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Role</Form.Label>
              <Form.Control
                type="text"
                value={user?.role || ""}
                readOnly
                disabled
              />
            </Form.Group>
          </Col>
        </Row>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Phone</Form.Label>
              <Form.Control
                type="text"
                name="phone"
                value={profileFormData.phone}
                onChange={handleInputChange}
                placeholder="Enter phone number"
              />
            </Form.Group>
          </Col>
        </Row>
        <hr />
        <h5 className="mb-3">Change Password (optional)</h5>
        <Row>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>New Password</Form.Label>
              <Form.Control
                type="password"
                name="newPassword"
                value={profileFormData.newPassword}
                onChange={handleInputChange}
                placeholder="Enter new password"
              />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group className="mb-3">
              <Form.Label>Confirm New Password</Form.Label>
              <Form.Control
                type="password"
                name="confirmPassword"
                value={profileFormData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Confirm new password"
              />
            </Form.Group>
          </Col>
        </Row>
      </Form>
    </ReusablePageStructure>
  );
};

export default EditProfilePage;
