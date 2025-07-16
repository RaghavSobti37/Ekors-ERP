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
  backgroundColor: "#f8f9fa", // A light background for the page
  minHeight: "calc(100vh - 120px)", // Default minimum height
};

const headerStyle = {
  backgroundColor: "#34495E",
  color: "white",
  padding: "1rem 1.5rem", // Added more padding
  flexShrink: 0, // Prevent shrinking
  position: "sticky", // Make header sticky
  top: 0, // Stick to top
  zIndex: 1000, // Ensure it's above other content
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
  flex: 1, // Take remaining space
  overflowY: "auto", // Enable scrolling within content area
  padding: "20px",
  backgroundColor: "white",
  margin: "15px", // Margin around the content area
  borderRadius: "8px", // Rounded corners for content
  boxShadow: "0 0 10px rgba(0,0,0,0.05)", // Subtle shadow for content
};

const footerStyle = {
  borderTop: "1px solid #dee2e6",
  padding: "15px",
  flexShrink: 0, // Prevent shrinking
  position: "sticky", // Make footer sticky
  bottom: 0, // Stick to bottom
  zIndex: 1000, // Ensure it's above other content
  backgroundColor: "#f8f9fa", // Match page background
  display: "flex",
  justifyContent: "flex-end",
  gap: "10px",
  boxShadow: "0 -2px 4px rgba(0,0,0,0.1)", // Subtle shadow above footer
};

const ReusablePageStructureComponent = ({
  title,
  children,
  // headerActions, // This can be used for additional right-side actions if needed
  footerContent,
  showBackButton = true, // Prop to control back button visibility, defaults to true
  onBack, // New prop for custom back button behavior
  fullHeight = false, // New prop to control whether to use full viewport height
}) => {
  const navigate = useNavigate();

  const handleGoBack = useCallback(() => {
    if (onBack) {
      onBack(); // Use the custom handler if provided
    } else {
      navigate(-1); // Default behavior: go to the previous page in history
    }
  }, [navigate, onBack]);

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
  }, [handleGoBack]); // Corrected dependency array

  // Dynamic styles based on fullHeight prop
  const dynamicPageStyle = fullHeight ? {
    ...pageContainerStyle,
    height: "100vh",
    overflow: "hidden"
  } : {
    ...pageContainerStyle,
    height: "auto",
    minHeight: "calc(100vh - 120px)",
    overflow: "visible"
  };

  const dynamicContentStyle = fullHeight ? {
    ...contentStyle,
    maxHeight: "calc(100vh - 200px)"
  } : {
    ...contentStyle,
    maxHeight: "none"
  };

  return (
    <div style={dynamicPageStyle}>
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
      <div style={dynamicContentStyle}>
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