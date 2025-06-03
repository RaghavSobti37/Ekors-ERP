import React from 'react';
import '../css/Pagination.css'

// Helper function to generate a range of numbers
const range = (start, end) => {
  let length = end - start + 1;
  if (length < 0) length = 0; // Ensure length is not negative, e.g., range(1,0)
  return Array.from({ length }, (_, idx) => idx + start);
};

const DOTS = '...';

// siblingCount is the number of page numbers to show on each side of the current page
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
  // This case should ideally not be reached if totalPages > totalPageNumbersToDisplay
  // and one of the DOTS conditions isn't met.
  // However, to be safe, if totalPages is small enough that no dots are needed,
  // but not small enough for the first condition, we return the full range.
  // This can happen if siblingCount is large relative to totalPages.
  return range(1, totalPages); 
};

const Pagination = ({ 
  currentPage, 
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  itemsPerPageOptions = [5, 10, 20, 50, 100],
  siblingCount = 1, // Added siblingCount as a prop
}) => {
  const totalPages = totalItems > 0 ? Math.ceil(totalItems / itemsPerPage) : 0;

  const pageItems = React.useMemo(() => {
    if (totalPages === 0) return []; // No pages to show if totalPages is 0
    return getPaginationItems(currentPage, totalPages, siblingCount);
  }, [currentPage, totalPages, siblingCount]);

  return (
    <div className="pagination-wrapper">
      <div className="pagination-controls">
        <div className="pagination-left-slot">
          {itemsPerPageOptions && itemsPerPageOptions.length > 0 && totalItems > 0 && (
            <div className="items-per-page-selector">
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  const newItemsPerPage = Number(e.target.value);
                  onItemsPerPageChange(newItemsPerPage);
                }}
                className="form-select form-select-sm" // Using Bootstrap classes
                style={{ width: 'auto' }}
                aria-label="Items per page"
              >
                {itemsPerPageOptions.map(option => (
                  <option key={option} value={option}>
                    {option} per page
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="pagination-right-slot">
          {totalPages > 0 && (
            <div className="pagination-container"> {/* This is the group of prev/next/numbers */}
              <button
                className="pagination-arrow"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1 || totalPages === 0}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default Pagination;