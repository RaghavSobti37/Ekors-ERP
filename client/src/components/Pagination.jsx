import React from 'react';
import './Pagination.css';

// Helper function to generate a range of numbers
const range = (start, end) => {
  let length = end - start + 1;
  if (length < 0) length = 0; // Ensure length is not negative, e.g., range(1,0)
  return Array.from({ length }, (_, idx) => idx + start);
};

const DOTS = '...';

const getPaginationItems = (currentPage, totalPages, siblingCount = 1) => {
  const totalPageNumbersToDisplay = siblingCount + 5; // Min items: 1 ... current-1 current current+1 ... N

  if (totalPageNumbersToDisplay >= totalPages) {
    return range(1, totalPages);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

  const shouldShowLeftDots = leftSiblingIndex > 2;
  const shouldShowRightDots = rightSiblingIndex < totalPages - 2;

  const firstPageIndex = 1;
  const lastPageIndex = totalPages;

  if (!shouldShowLeftDots && shouldShowRightDots) {
    let leftItemCount = 3 + 2 * siblingCount;
    let leftRange = range(1, leftItemCount);
    return [...leftRange, DOTS, lastPageIndex];
  }

  if (shouldShowLeftDots && !shouldShowRightDots) {
    let rightItemCount = 3 + 2 * siblingCount;
    let rightRange = range(totalPages - rightItemCount + 1, totalPages);
    return [firstPageIndex, DOTS, ...rightRange];
  }

  if (shouldShowLeftDots && shouldShowRightDots) {
    let middleRange = range(leftSiblingIndex, rightSiblingIndex);
    return [firstPageIndex, DOTS, ...middleRange, DOTS, lastPageIndex];
  }
  
  // Fallback, though previous conditions should cover all scenarios with totalPages > totalPageNumbersToDisplay
  return range(1, totalPages); 
};

const Pagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  rowsPerPage, 
  onRowsPerPageChange,
  rowsPerPageOptions = [5] // Changed to only offer 5 rows per page by default
}) => {
  const pageItems = React.useMemo(() => {
    if (totalPages === 0) return []; // No pages to show if totalPages is 0
    return getPaginationItems(currentPage, totalPages, 1);
  }, [currentPage, totalPages]);

  return (
    <div className="pagination-wrapper">
      <div className="pagination-container">
        <button
          className="pagination-arrow"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          ← Prev
        </button>
        <div className="page-numbers">
          {pageItems.map((item, index) => {
            if (item === DOTS) {
              return <span key={`${item}-${index}`} className="pagination-item dots">{DOTS}</span>;
            }
            return (
              <button
                key={item}
                className={`pagination-item ${currentPage === item ? 'active' : ''}`}
                onClick={() => onPageChange(item)}
                disabled={currentPage === item}
              >
                {item}
              </button>
            );
          })}
        </div>
        <button
          className="pagination-arrow"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || totalPages === 0}
        >
          Next →
        </button>
      </div>
      
      
    </div>
  );
};

export default Pagination;