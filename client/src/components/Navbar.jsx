import React, { useState, useRef, useEffect } from "react";
import "../css/Navbar.css"; // Main Navbar styles
import {
  FaUser,
  FaFileInvoice,
  FaTicketAlt,
  FaClipboardList,
  FaClock,
  FaBoxOpen,
  FaUsers,
  FaExclamationTriangle, // For restock alerts
  FaExclamationCircle, // For low quantity warnings
  FaCamera, // For profile picture upload
} from "react-icons/fa";
import {
  Navbar as BootstrapNavbar,
  Nav,
  NavDropdown,
  Button,
} from "react-bootstrap";
import { Link } from "react-router-dom";
import { useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import apiClient from "../utils/apiClient"; // Assuming you have this
import { getAuthToken } from "../utils/authUtils"; // Assuming you have this
import {
  Form,
  Button as BsButton,
  Alert,
  Row,
  Col,
  Image,
} from "react-bootstrap"; // For Edit Profile Modal
import ReusableModal from "./ReusableModal.jsx"; // Import ReusableModal
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop"; // For image cropping
import "react-image-crop/dist/ReactCrop.css"; // Styles for react-image-crop
import { showToast, handleApiError } from "../utils/helpers"; // For toasts and error handling

// import AddNewItem from '../pages/AddNewItem';

const DEFAULT_LOW_QUANTITY_THRESHOLD = 3;
const LOCAL_STORAGE_LOW_QUANTITY_KEY = "globalLowStockThresholdSetting";

function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(
    makeAspectCrop({ unit: "%", width: 90 }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  );
}

export default function Navbar({ showPurchaseModal }) {
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [showItemsDropdown, setShowItemsDropdown] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const navigate = useNavigate();
  const [restockAlertCount, setRestockAlertCount] = useState(0);
  const [lowStockWarningCount, setLowStockWarningCount] = useState(0);
  const { user, logout, updateUserContext } = useAuth(); // Added updateUserContext
  const [profileFormData, setProfileFormData] = useState({
    phone: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [imgSrc, setImgSrc] = useState(""); // For image cropper: original image selected by user
  const [crop, setCrop] = useState(); // For image cropper: current crop selection
  const [completedCrop, setCompletedCrop] = useState(null); // For image cropper: final crop
  const [aspect, setAspect] = useState(1 / 1); // Aspect ratio for cropper (1:1 for square)
  const imgRef = useRef(null); // Ref for the image element in cropper
  const previewCanvasRef = useRef(null); // Ref for the canvas to preview crop
  const [showCropModal, setShowCropModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  const timeoutRef = useRef(null);
  const dropdownTimeoutRef = useRef(null);
  const fileInputRef = useRef(null); // Ref for the hidden file input

  useEffect(() => {
    if (!user) return; // Don't fetch if not logged in

    const fetchRestockData = async () => {
      const currentThreshold =
        parseInt(localStorage.getItem(LOCAL_STORAGE_LOW_QUANTITY_KEY), 10) ||
        DEFAULT_LOW_QUANTITY_THRESHOLD;
      try {
        const token = getAuthToken();
        if (!token) return;
        const response = await apiClient(
          `/items/restock-summary?lowGlobalThreshold=${currentThreshold}`
        );
        setRestockAlertCount(response.restockNeededCount || 0);
        setLowStockWarningCount(response.lowStockWarningCount || 0);
      } catch (error) {
        console.error("Navbar: Failed to fetch restock summary:", error);
        // Don't show an error toast here, as it's a background check
      }
    };

    fetchRestockData();
    // Optional: Set an interval to refresh periodically
    const intervalId = setInterval(fetchRestockData, 300000); // every 5 minutes
    return () => clearInterval(intervalId);
  }, [user]); // Re-fetch if user logs in/out. Threshold changes will be picked up on next interval or page load.

  useEffect(() => {
    if (user) {
      setProfileFormData((prev) => ({ ...prev, phone: user.phone || "" }));
    } else {
      setProfileFormData({ phone: "", newPassword: "", confirmPassword: "" });
    }
  }, [user]);

  const handlePurchaseHistoryClick = () => {
    navigate("/purchasehistory");
  };

  const handleViewAllItems = () => {
    navigate("/itemslist");
  };

  const handleSignOut = () => {
    logout();
    navigate("/");
  };

  const handleMouseEnterProfile = () => {
    clearTimeout(timeoutRef.current);
    setShowProfilePopup(true);
  };

  const handleMouseLeaveProfile = () => {
    timeoutRef.current = setTimeout(() => {
      setShowProfilePopup(false);
    }, 300);
  };

  const handleMouseEnterDropdown = () => {
    clearTimeout(dropdownTimeoutRef.current);
    setShowItemsDropdown(true);
  };

  const handleMouseLeaveDropdown = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setShowItemsDropdown(false);
    }, 300);
  };

  const handleStockAlertClick = () => {
    const currentThreshold =
      parseInt(localStorage.getItem(LOCAL_STORAGE_LOW_QUANTITY_KEY), 10) ||
      DEFAULT_LOW_QUANTITY_THRESHOLD;
    navigate(`/itemslist?filter=stock_alerts&lowThreshold=${currentThreshold}`); // Corrected path
  };

  const handleProfileInputChange = (e) => {
    setProfileFormData({ ...profileFormData, [e.target.name]: e.target.value });
  };

  const handleProfileSave = async () => {
    setProfileError("");
    if (
      profileFormData.newPassword &&
      profileFormData.newPassword !== profileFormData.confirmPassword
    ) {
      setProfileError("New passwords do not match.");
      return;
    }
    if (profileFormData.newPassword && profileFormData.newPassword.length < 5) {
      setProfileError("New password must be at least 5 characters long.");
      return;
    }

    setProfileLoading(true);
    try {
      const payload = { phone: profileFormData.phone };
      if (profileFormData.newPassword) {
        payload.password = profileFormData.newPassword;
      }
      const updatedUser = await apiClient("/users/profile", {
        method: "PATCH",
        body: payload,
      });
      updateUserContext(updatedUser.data); // Assuming API returns { data: userObject }
      showToast("Profile updated successfully!", true);
      setShowEditModal(false);
      setProfileFormData({
        ...profileFormData,
        newPassword: "",
        confirmPassword: "",
      }); // Clear password fields
    } catch (err) {
      const errorMsg = handleApiError(err, "Failed to update profile.");
      setProfileError(errorMsg);
    } finally {
      setProfileLoading(false);
    }
  };

  const onSelectFile = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      setCrop(undefined); // Makes crop preview update between images.
      const reader = new FileReader();
      reader.addEventListener("load", () =>
        setImgSrc(reader.result?.toString() || "")
      );
      reader.readAsDataURL(e.target.files[0]);
      setShowCropModal(true); // Show cropping modal
      e.target.value = null; // Reset file input
    }
  };

  function onImageLoad(e) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, aspect));
  }

  useEffect(() => {
    if (
      completedCrop?.width &&
      completedCrop?.height &&
      imgRef.current &&
      previewCanvasRef.current
    ) {
      const image = imgRef.current;
      const canvas = previewCanvasRef.current;
      const crop = completedCrop;

      const scaleX = image.naturalWidth / image.width;
      const scaleY = image.naturalHeight / image.height;
      const ctx = canvas.getContext("2d");

      canvas.width = crop.width * scaleX;
      canvas.height = crop.height * scaleY;

      ctx.drawImage(
        image,
        crop.x * scaleX,
        crop.y * scaleY,
        crop.width * scaleX,
        crop.height * scaleY,
        0,
        0,
        crop.width * scaleX,
        crop.height * scaleY
      );
    }
  }, [completedCrop]);

  const handleUploadCroppedImage = async () => {
    if (!completedCrop || !previewCanvasRef.current || !selectedFile) {
      showToast("Please select and crop an image first.", false);
      return;
    }
    setProfileLoading(true);

    previewCanvasRef.current.toBlob(async (blob) => {
      if (!blob) {
        showToast(
          "Could not process image for upload. Please try again.",
          false
        );
        setProfileLoading(false);
        return;
      }

      const formData = new FormData();
      // Use a generic name or ensure selectedFile.name is safe
      const fileName = selectedFile.name || "avatar.png";
      formData.append("avatar", blob, fileName);

      try {
const apiResponse = await apiClient("/users/profile/avatar", {           method: "POST",
          body: formData,
        });

 // API call was successful if we've reached here.
        // Now, attempt to update context, but don't let it block modal closing.
        let contextUpdateSuccessful = false;
        try {
          if (typeof updateUserContext === 'function') {
            if (apiResponse && apiResponse.data && typeof apiResponse.data === "object" && apiResponse.data._id) {
              updateUserContext(apiResponse.data);
              contextUpdateSuccessful = true;
            } else if (apiResponse && typeof apiResponse === "object" && apiResponse._id) {
              updateUserContext(apiResponse);
              contextUpdateSuccessful = true;
            } else {
              console.warn("[Navbar.jsx] Avatar upload: API response structure not fully recognized for context update.", apiResponse);
            }
          } else {
            // This is where the TypeError originates. Log it clearly.
            console.error("[Navbar.jsx] CRITICAL: updateUserContext is not a function. AuthContext is not providing it correctly. Profile changes will require a page refresh to be visible everywhere.");
          }
        } catch (contextError) {
          console.error("[Navbar.jsx] Error occurred during updateUserContext after avatar upload:", contextError);
          // contextUpdateSuccessful remains false
        }

        if (contextUpdateSuccessful) {
          showToast(apiResponse.message || "Profile picture updated successfully!", true);
        } else {
          showToast("Profile picture uploaded. UI may need a refresh to reflect changes due to a context update issue.", true);
        }
        
        // This logic now runs if the API call was successful, regardless of context update issues.        }

        // Crucially, close modal and reset state if API call was successful (no throw)
        setShowCropModal(false);
        setImgSrc("");
        setCrop(undefined);
        setCompletedCrop(null);
        setSelectedFile(null);
     } catch (apiError) { // This catches errors from apiClient or other unexpected errors in the main try
        // handleApiError will show a toast.
        const errorMessage = handleApiError(apiError, "Failed to upload avatar."); 
        // The console.error below is for debugging and will show the TypeError if it's the cause.
        console.error("[Navbar.jsx] Avatar upload API/processing error:", apiError);
        // Do not close modal on error, let user retry or cancel.
      } finally {
        setProfileLoading(false);
      }
      showToast(response.message || "Profile picture updated!", true);
    }, selectedFile.type || "image/png"); // Provide a fallback type
  };

  return (
    <>
      <nav className="navbar">
        <div className="navbar-left">
          <div className="logo">
            <img src="/src/assets/logo.png" alt="E-KORS" className="logo-img" />
            {/* <span>E-KORS</span> */}
          </div>

          <div className="nav-links">
            <NavLink
              to="/quotations"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <FaFileInvoice /> Quotations
            </NavLink>
            <NavLink
              to="/tickets"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <FaTicketAlt /> Tickets
            </NavLink>
            <NavLink
              to="/logtime"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <FaClock /> Log Time
            </NavLink>

            <NavLink
              to="/challan"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <FaClipboardList /> Challan
            </NavLink>

            <div
              className="dropdown-wrapper"
              onMouseEnter={handleMouseEnterDropdown}
              onMouseLeave={handleMouseLeaveDropdown}
            >
              <NavLink
                to="/itemslist"
                className={({ isActive }) =>
                  isActive ? "nav-link active" : "nav-link"
                }
              >
                <FaBoxOpen /> Items List
              </NavLink>
              {showItemsDropdown && (
                <div className="dropdown-menu">
                  <div
                    onClick={handleViewAllItems}
                    style={{ cursor: "pointer", padding: "10px 15px" }}
                  >
                    View All Items
                  </div>
                  <div
                    onClick={showPurchaseModal}
                    style={{ cursor: "pointer", padding: "10px 15px" }}
                  >
                    Update Stock
                  </div>
                  <div
                    onClick={handlePurchaseHistoryClick}
                    style={{ cursor: "pointer", padding: "10px 15px" }}
                  >
                    Purchase History
                  </div>
                </div>
              )}
            </div>

            <NavLink
              to="/users"
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <FaUsers /> Users
            </NavLink>

            {/* Stock Alert Notification Area */}
            {(restockAlertCount > 0 || lowStockWarningCount > 0) && user && (
              <div
                className="stock-alert-notification nav-link" // Added nav-link for consistent styling if desired
                onClick={handleStockAlertClick}
                title={`Restock Needed: ${restockAlertCount} items. Low Stock (<${
                  localStorage.getItem(LOCAL_STORAGE_LOW_QUANTITY_KEY) ||
                  DEFAULT_LOW_QUANTITY_THRESHOLD
                }): ${lowStockWarningCount} items. Click to view.`}
              >
                <FaExclamationTriangle className="icon-low-stock" />
                <span className="alert-count">{restockAlertCount}</span>
                <FaExclamationCircle className="icon-restock" />
                <span className="alert-count">{lowStockWarningCount}</span>
              </div>
            )}
          </div>
        </div>

        <div
          className="profile-wrapper"
          onMouseEnter={handleMouseEnterProfile}
          onMouseLeave={handleMouseLeaveProfile}
        >
          <div className="profile-section">
            {user?.avatarUrl ? (
              <Image
                src={`${import.meta.env.VITE_API_BASE_URL || ""}${
                  user.avatarUrl
                }?${new Date().getTime()}`} // VITE_API_BASE_URL likely includes /api, user.avatarUrl starts with /uploads
                alt="User Avatar"
                roundedCircle
                className="navbar-avatar-img"
              />
            ) : (
              <div className="profile-icon">
                <FaUser />
              </div>
            )}
            <span className="navbar-username">{user?.firstname || "User"}</span>
          </div>

          {showProfilePopup && (
            <div className="profile-popup">
              {/* <img
                src="/src/assets/profile.jpg"
                alt="Profile"
                className="profile-pic"
              /> */}
              <div className="profile-details">
                <div className="profile-avatar-large-container">
                  {user?.avatarUrl ? (
                    <Image
                      src={`${import.meta.env.VITE_API_BASE_URL || ""}${
                        user.avatarUrl
                      }?${new Date().getTime()}`}
                      alt="Profile"
                      roundedCircle
                      className="profile-avatar-large"
                    />
                  ) : (
                    <div className="profile-avatar-large-placeholder">
                      <FaUser size={40} />
                    </div>
                  )}
                  {/* <Button variant="link" size="sm" className="upload-avatar-btn" onClick={() => fileInputRef.current?.click()} title="Change Profile Picture">
                   Edit Profile Picture
                     <FaCamera /> 
                  </Button> */}
                </div>
                <p>
                  <strong>
                    {user?.firstname} {user?.lastname}
                  </strong>
                </p>
                <p>
                  <strong>Email:</strong> {user?.email || "N/A"}
                </p>
                <p>
                  <strong>Phone:</strong> {user?.phone || "N/A"}
                </p>
                <p>
                  <strong>Role:</strong> {user?.role || "N/A"}
                </p>
              </div>
              <button
                className="edit-btn"
                onClick={() => setShowEditModal(true)}
              >
                Edit
              </button>
              <button className="logout-btn" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Hidden file input for avatar */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        onChange={onSelectFile}
      />

      {/* Edit Profile Modal */}
      <ReusableModal
        show={showEditModal}
        onHide={() => setShowEditModal(false)}
        title="Edit Profile"
        footerContent={
          <>
            <BsButton
              variant="secondary"
              onClick={() => setShowEditModal(false)}
              disabled={profileLoading}
            >
              Cancel
            </BsButton>
            <BsButton
              variant="primary"
              onClick={handleProfileSave}
              disabled={profileLoading}
            >
              {profileLoading ? "Saving..." : "Save Changes"}
            </BsButton>
          </>
        }
        // size="xl" // Or rely on ReusableModal's default fullScreenModalStyle
        isLoading={profileLoading}
      >
        {profileError && <Alert variant="danger">{profileError}</Alert>}

        {/* Profile Picture Section */}
        <Row className="mb-4 align-items-center text-center text-md-start">
          <Col xs={12} md="auto" className="mb-3 mb-md-0">
            {user?.avatarUrl ? (
              <Image
                src={`${import.meta.env.VITE_API_BASE_URL || ""}${
                  user.avatarUrl
                }?${new Date().getTime()}`}
                roundedCircle
                style={{
                  width: "100px",
                  height: "100px",
                  objectFit: "cover",
                  border: "2px solid #dee2e6",
                }}
                alt="Current Avatar"
              />
            ) : (
              <div
                className="profile-avatar-large-placeholder mx-auto mx-md-0"
                style={{
                  width: "100px",
                  height: "100px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#e9ecef",
                  borderRadius: "50%",
                }}
              >
                <FaUser size={50} />
              </div>
            )}
          </Col>
          <Col>
            <BsButton
              variant="outline-primary"
              onClick={() => fileInputRef.current?.click()}
              className="w-auto"
            >
              <FaCamera className="me-2" />
              Change Profile Picture
            </BsButton>
            <Form.Text muted className="d-block mt-1">
              Click to select a new image. You'll be able to crop it before
              uploading.
            </Form.Text>
          </Col>
        </Row>
        <hr className="mb-4" />

        <Form>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>First Name</Form.Label>
                <Form.Control
                  type="text"
                  value={user?.firstname || ""}
                  readOnly
                  disabled
                />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Last Name</Form.Label>
                <Form.Control
                  type="text"
                  value={user?.lastname || ""}
                  readOnly
                  disabled
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
                  onChange={handleProfileInputChange}
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
                  onChange={handleProfileInputChange}
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
                  onChange={handleProfileInputChange}
                  placeholder="Confirm new password"
                />
              </Form.Group>
            </Col>
          </Row>
        </Form>
      </ReusableModal>

      {/* Image Cropping Modal */}
      <ReusableModal
        show={showCropModal}
        onHide={() => setShowCropModal(false)}
        title="Crop Profile Picture"
        footerContent={
          <>
            <BsButton
              variant="secondary"
              onClick={() => setShowCropModal(false)}
              disabled={profileLoading}
            >
              Cancel
            </BsButton>
            <BsButton
              variant="primary"
              onClick={handleUploadCroppedImage}
              disabled={profileLoading || !completedCrop}
            >
              {profileLoading ? "Uploading..." : "Upload Cropped Image"}
            </BsButton>
          </>
        }
        // size="xl" // Or rely on ReusableModal's default fullScreenModalStyle
        isLoading={profileLoading}
      >
        {imgSrc && (
          <div className="d-flex flex-column align-items-center">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspect}
              minWidth={100} // Minimum crop width in pixels
              minHeight={100} // Minimum crop height in pixels
            >
              <img
                ref={imgRef}
                alt="Crop me"
                src={imgSrc}
                onLoad={onImageLoad}
                style={{ maxHeight: "70vh", maxWidth: "100%" }}
              />
            </ReactCrop>
            {completedCrop && (
              <div className="mt-3">
                <p>Preview:</p>
                <canvas
                  ref={previewCanvasRef}
                  style={{
                    border: "1px solid black",
                    objectFit: "contain",
                    width: 150,
                    height: 150,
                  }}
                />
              </div>
            )}
          </div>
        )}
      </ReusableModal>
    </>
  );
}
