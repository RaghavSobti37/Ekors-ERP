import React from 'react';

const SortIndicator = ({ columnKey, sortConfig }) => {
  if (!sortConfig || sortConfig.key !== columnKey) {
    return null;
  }
  return sortConfig.direction === "ascending" ? (
    <span> ↑</span>
  ) : (
    <span> ↓</span>
  );
};

export default SortIndicator;
