import React from 'react';
import { FaQuestionCircle } from 'react-icons/fa';
import '../css/Footer.css';

const HelpFooter = () => {
  const openGoogleSheet = () => {
    window.open('https://docs.google.com/spreadsheets/d/1Pgl_otIevtC7tEBE5lcSIstMoK9g-S4E46uXWQaUitM/edit?gid=0#gid=0', '_blank');
  };

  return (
    <div className="help-footer">
      <div className="help-content">
        <span className="help-text">Report A Bug</span>
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