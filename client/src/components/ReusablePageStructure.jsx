// components/ReusableModal.jsx
// This component is now intended to be a Page Layout, not a Modal.
// Consider renaming the file to ReusablePageLayout.jsx or similar in your project.
import React, { useCallback } from "react";
// Removed Modal import from react-bootstrap
import { Button } from "react-bootstrap"; // For the back button
import { useNavigate } from "react-router-dom"; // To navigate back
// Button can still be used if needed for actions, or actions can be custom JSX

const pageContainerStyle = {
  display: "flex",
  flexDirection: "column",
  // Assuming this component is rendered within a main app layout that might have a global Navbar/Footer
  // If standalone, it might need vh units for height.
  // For now, let it be a block that fills its container.
  padding: "0", // Remove padding if Navbar/Footer are outside
  backgroundColor: "#f8f9fa", // A light background for the page
  minHeight: "calc(100vh - 120px)", // Example: if Navbar+Footer height is 120px
};

const headerStyle = {
  backgroundColor: "#34495E",
  color: "white",
  padding: "1rem 1.5rem", // Added more padding
  flexShrink: 0,
  display: "grid", // Changed to grid for easier centering with items on sides
  gridTemplateColumns: "auto 1fr auto", // Left actions, Title (takes remaining space), Right actions
  alignItems: "center",
  boxShadow: "0 2px 4px rgba(0,0,0,0.1)", // Subtle shadow
  gap: "1rem", // Gap between header items
};

const titleStyle = {
  fontWeight: "bold",
  fontSize: "1.5rem", // Larger title
  margin: 0, // Remove default margin
  textAlign: "center", // Center the title
};

const contentStyle = {
  flex: 1,
  overflowY: "auto",
  padding: "20px",
  backgroundColor: "white",
  margin: "15px", // Margin around the content area
  borderRadius: "8px", // Rounded corners for content
  boxShadow: "0 0 10px rgba(0,0,0,0.05)", // Subtle shadow for content
};

const footerStyle = {
  borderTop: "1px solid #dee2e6",
  padding: "15px",
  flexShrink: 0,
  backgroundColor: "#f8f9fa", // Match page background
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  marginTop: "auto", // Push footer to bottom if content is short
};

const ReusablePageStructureComponent = ({
  title,
  children,
  // headerActions, // This can be used for additional right-side actions if needed
  footerContent,
  showBackButton = true, // Prop to control back button visibility, defaults to true
}) => {
  const navigate = useNavigate();

  const handleGoBack = useCallback(() => {
    navigate(-1); // Go to the previous page in history
  }, [navigate]);

  React.useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') {
        handleGoBack();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [navigate]); // Add navigate to dependency array

  return (
    <div style={pageContainerStyle}>
      <div style={headerStyle}>
        {showBackButton ? (
          <Button variant="light" onClick={handleGoBack} size="sm" style={{ justifySelf: "start" }}>
            &larr; Back
          </Button>
        ) : (
          <div></div> // Empty div to maintain grid structure if no back button
        )}
        <h2 style={titleStyle}>{title}</h2>
        <div></div> {/* Empty div for the right side of the grid, for balance or future actions */}
      </div>
      <div style={contentStyle}>
        {children}
      </div>

      {footerContent && (
        <div style={footerStyle}>
          {footerContent}
        </div>
      )}
    </div>
  );
};

export default React.memo(ReusablePageStructureComponent);