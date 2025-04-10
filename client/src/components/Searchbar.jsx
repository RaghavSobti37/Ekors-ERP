import React, { useState } from "react";
import "./SearchBar.css";
import { FaSearch } from "react-icons/fa";

export default function SearchBar() {
    const [searchTerm, setSearchTerm] = useState("");
    const companies = ["Tesla", "Apple", "Microsoft", "Amazon", "Google"];

    const filtered = companies.filter((company) =>
        company.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="top-search-bar">
            <div className="search-container">
                <input
                    type="text"
                    placeholder="Search by Company Name"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <FaSearch className="search-icon" />
                {searchTerm && filtered.length > 0 && (
                    <ul className="search-results">
                        {filtered.map((company, index) => (
                            <li key={index}>{company}</li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
