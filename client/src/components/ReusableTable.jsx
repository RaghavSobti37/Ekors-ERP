import React from "react";
import { Table as BootstrapTable, Alert } from "react-bootstrap";
import SortIndicator from "./SortIndicator"; // Assuming SortIndicator.jsx is in the same components folder

/**
 * A reusable table component.
 *
 * @param {object} props - The component props.
 * @param {Array<object>} props.columns - Array of column definitions.
 *   Each column object: { key: string, header: string, sortable?: boolean, renderCell?: (item) => JSX, headerClassName?: string, cellClassName?: string, tooltip?: string }
 * @param {Array<object>} props.data - Array of data items to display.
 * @param {string} props.keyField - The unique key field in data items (e.g., '_id').
 * @param {boolean} [props.isLoading=false] - Whether data is currently loading.
 * @param {string|null} [props.error=null] - Error message to display.
 * @param {function} [props.onSort] - Callback function for sorting (receives column key).
 * @param {object} [props.sortConfig] - Current sort configuration { key: string, direction: 'ascending'|'descending' }.
 * @param {function} [props.renderActions] - Function to render action buttons for an item: (item) => JSX.
 * @param {string} [props.noDataMessage='No data found.'] - Message to display when data is empty.
 * @param {string} [props.tableClassName='mt-3'] - CSS classes for the table.
 * @param {string} [props.theadClassName='table-dark'] - CSS classes for the table head.
 * @param {string} [props.tbodyClassName=''] - CSS classes for the table body.
 * @param {function} [props.onRowClick] - Callback function for row click: (item) => void.
 * @param {string} [props.rowClassName] - CSS class or function (item) => string for table rows.
 */
const ReusableTableComponent = ({
  columns,
  data,
  keyField,
  isLoading = false,
  error = null,
  onSort,
  sortConfig,
  renderActions,
  noDataMessage = "No data found.",
  tableClassName = "mt-3",
  theadClassName = "table-dark",
  tbodyClassName = "",
  onRowClick,
  rowClassName,
}) => {
  const colSpan = columns.length + (renderActions ? 1 : 0);

  if (error) {
    return (
      <Alert variant="danger" className="mt-3">
        {error}
      </Alert>
    );
  }

  return (
    <BootstrapTable
      striped
      bordered
      hover
      responsive
      className={tableClassName}
    >
      <thead className={theadClassName}>
        <tr>
          {columns.map((col) => (
            <th
              key={col.key}
              onClick={() =>
                col.sortable !== false && onSort && onSort(col.key)
              }
              style={
                onSort && col.sortable !== false ? { cursor: "pointer" } : {}
              }
              className={`${col.headerClassName || ""} ${
                col.tooltip ? "has-tooltip" : ""
              }`}
              title={col.tooltip} // Native browser tooltip
            >
              {col.header}
              {col.tooltip && (
                <span className="ms-1" style={{ cursor: "help" }}>
                  ❓
                </span>
              )}
              {onSort && sortConfig && (
                <SortIndicator columnKey={col.key} sortConfig={sortConfig} />
              )}
            </th>
          ))}
          {renderActions && <th>Actions</th>}
        </tr>
      </thead>
      <tbody className={tbodyClassName}>
        {isLoading ? (
          <tr>
            <td colSpan={colSpan} className="text-center">
              Loading...
            </td>
          </tr>
        ) : data.length > 0 ? (
          data.map((item) => (
            <tr
              key={item[keyField]}
              onClick={() => onRowClick && onRowClick(item)}
              className={
                typeof rowClassName === "function"
                  ? rowClassName(item)
                  : rowClassName
              }
              style={onRowClick ? { cursor: "pointer" } : {}}
            >
              {columns.map((col) => (
                <td
                  key={`${item[keyField]}-${col.key}`}
                  className={col.cellClassName}
                >
                  {col.renderCell ? col.renderCell(item) : item[col.key]}
                </td>
              ))}
              {renderActions && (
                <td className="text-center">{renderActions(item)}</td>
              )}
            </tr>
          ))
        ) : (
          <tr>
            <td colSpan={colSpan} className="text-center">
              {noDataMessage}
            </td>
          </tr>
        )}
      </tbody>
    </BootstrapTable>
  );
};

export default React.memo(ReusableTableComponent);
