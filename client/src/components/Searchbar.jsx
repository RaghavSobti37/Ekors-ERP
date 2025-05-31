import React from "react";
import { Form, Button } from "react-bootstrap";
import { Search as SearchIconBs } from 'react-bootstrap-icons';
import '../css/Searchbar.css';

const SearchBar = ({
 searchTerm,
 setSearchTerm,
 onSearch, // Callback for when search term changes or search is explicitly triggered
 placeholder = "Search here...",
 showButton = false,
 onAddNew,
 buttonText = "Add New",
 buttonVariant = "primary",
 buttonIcon, // Optional: ReactNode for an icon in the button
 className = "", // Custom class for the main container
 inputClassName = "", // Custom class for the input field
 buttonClassName = "", // Custom class for the button
 showSearchIcon = true, // Control visibility of the search icon in the input
 inputStyle = {}, // Custom styles for the input
 buttonStyle = {}, // Custom styles for the button
 containerStyle = {}, // Custom styles for the container
  disabled = false, // Added prop to disable the input
}) => {
 const handleInputChange = (e) => {
   setSearchTerm(e.target.value);
   if (onSearch && typeof onSearch === 'function') {
     onSearch(e.target.value); // Trigger search on every change
   }
 };

 return (
   <div className={`search-bar-container ${className}`} style={containerStyle}>
     <div className="search-input-wrapper">
       {showSearchIcon && <SearchIconBs className="search-icon-prefix" />}
       <Form.Control
         type="search"
         placeholder={placeholder}
         value={searchTerm}
         onChange={handleInputChange}
         className={`search-input ${showSearchIcon ? 'has-icon' : ''} ${inputClassName}`}
         style={inputStyle}
         disabled={disabled} // Use the disabled prop here
       />
     </div>
     {showButton && onAddNew && (
       <Button
         variant={buttonVariant}
         onClick={onAddNew}
         className={`search-add-button ${buttonClassName}`}
         style={buttonStyle}
       >
         {buttonIcon && <span className="button-icon-prefix">{buttonIcon}</span>}
         {buttonText}
       </Button>
     )}
   </div>
 );
};

export default SearchBar;