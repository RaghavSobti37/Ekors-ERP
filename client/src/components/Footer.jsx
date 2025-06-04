import React from 'react';
import { FaQuestionCircle } from 'react-icons/fa';
import '../css/Footer.css';

const HelpFooter = () => {
  const openGoogleSheet = () => {
    window.open('https://docs.google.com/document/d/19hmO2d7km1HerCYDSW_G8FBr79GqxbjWDLUNj4xflA0/edit?tab=t.0', '_blank');
  };

  return (
    <div className="help-footer">
      <div className="help-content">
        <span className="help-text">Help</span>
        <button 
          className="help-icon" 
          onClick={openGoogleSheet}
          aria-label="Open help documentation"
        >
          <FaQuestionCircle size={24} />
        </button>
      </div>
    </div>
  );
};

export default HelpFooter;