// components/ReusableModal.jsx
import React from "react";
import { Modal, Button } from "react-bootstrap";

const fullScreenModalStyle = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "95vw",
  height: "95vh",
  maxWidth: "none",
  margin: 0,
  padding: 0,
  overflow: "auto",
  backgroundColor: "white",
  border: "1px solid #dee2e6",
  borderRadius: "0.3rem",
  boxShadow: "0 0.5rem 1rem rgba(0, 0, 0, 0.15)",
  zIndex: 1050,
};

const ReusableModal = ({
  show,
  onHide,
  title,
  children,
  footerContent,
  isLoading = false,
  size = "lg",
}) => {
  return (
    <Modal
      show={show}
      onHide={onHide}
      dialogClassName="custom-modal"
      centered
      size={size}
    >
      <div style={fullScreenModalStyle}>
        <Modal.Header
          closeButton
          onHide={onHide}
          style={{
            backgroundColor: "darkblue", // A light grey, adjust as needed
            borderBottom: "1px solid #dee2e6",
            padding: "1rem",
            flexShrink: 0,
            display: "flex", // For centering title
            justifyContent: "center", // For centering title
            alignItems: "center", // For centering title
          }}
        >
          <Modal.Title
            style={{ fontWeight: "bold", textAlign: "center", flexGrow: 1 }}
          >
            {title}
          </Modal.Title>
        </Modal.Header>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexGrow: 1,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              flexGrow: 1,
              overflowY: "auto",
              padding: "20px",
            }}
          >
            {children}
          </div>
          <Modal.Footer
            style={{
              borderTop: "1px solid #dee2e6",
              padding: "15px",
              flexShrink: 0,
            }}
          >
            {footerContent || (
              <Button variant="secondary" onClick={onHide} disabled={isLoading}>
                Close
              </Button>
            )}
          </Modal.Footer>
        </div>
      </div>
    </Modal>
  );
};

export default ReusableModal;