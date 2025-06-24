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
  overflow: "hidden", // Changed to hidden to contain everything
  backgroundColor: "white",
  border: "1px solid #dee2e6",
  borderRadius: "0.3rem",
  boxShadow: "0 0.5rem 1rem rgba(0, 0, 0, 0.15)",
  zIndex: 1050,
  display: "flex",          // Added
  flexDirection: "column",  // Added
};

const ReusableModalComponent = ({
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
        {/* Header remains fixed at top */}
        <Modal.Header
          closeButton
          onHide={onHide}
          style={{
            backgroundColor: "maroon",
            padding: "1rem",
            flexShrink: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Modal.Title
            style={{ fontWeight: "bold", textAlign: "center", flexGrow: 1 }}
          >
            {title}
          </Modal.Title>
        </Modal.Header>

        {/* Scrollable content area */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "20px",
          }}
        >
          {children}
        </div>

        {/* Sticky footer */}
        <Modal.Footer
          style={{
            borderTop: "1px solid #dee2e6",
            padding: "15px",
            flexShrink: 0,
            backgroundColor: "white", // Ensure background covers content
            position: "sticky",
            bottom: 0,
          }}
        >
          {footerContent || (
            <Button variant="secondary" onClick={onHide} disabled={isLoading}>
              Close
            </Button>
          )}
        </Modal.Footer>
      </div>
    </Modal>
  );
};

export default React.memo(ReusableModalComponent);