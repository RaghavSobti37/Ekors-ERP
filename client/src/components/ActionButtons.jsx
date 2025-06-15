import React from 'react';
import { Button } from 'react-bootstrap';
import {
  Eye, // View
  PencilSquare, // Edit
  Trash, // Delete
  PlusSquare, // Create Ticket
  ArrowLeftRight, // Transfer
  BarChart, // Generate Report
    CloudDownload, // For PDF Download
  FileEarmarkWord, // For Word Download
  FileEarmarkExcel, // For Generic Excel Report
} from 'react-bootstrap-icons';
import { PDFDownloadLink } from '@react-pdf/renderer';

/**
 * Reusable component for rendering a set of common action buttons.
 * Buttons are rendered based on the presence of their corresponding handler props.
 *
 * @param {object} props - The component props.
 * @param {object} props.item - The data item associated with the row/buttons. Passed to handlers.
 * @param {function} [props.onView] - Handler for the View action. If provided, the View button is shown.
 * @param {function} [props.onEdit] - Handler for the Edit action. If provided, the Edit button is shown.
 * @param {function} [props.onDelete] - Handler for the Delete action. If provided, the Delete button is shown.
 * @param {function} [props.onCreateTicket] - Handler for the Create Ticket action (Quotations).
 * @param {function} [props.onTransfer] - Handler for the Transfer action (Tickets).
 * @param {function} [props.onGenerateReport] - Handler for the Generate Report action (Users).
  * @param {object} [props.pdfProps] - Object containing `document` (React PDF component) and `fileName` for PDFDownloadLink. If provided, PDF button is shown.
 * @param {function} [props.onDownloadWord] - Handler for Word download. If provided, Word button is shown.
 * @param {function} [props.onGenerateExcelReport] - Handler for the generic Excel report action. If provided, Excel button is shown.
 * @param {boolean} [props.isLoading=false] - If true, all buttons are disabled.
 * @param {object|boolean} [props.disabled={}] - Allows specific buttons to be disabled. Can be a boolean to disable all, or an object like `{ edit: true, delete: false }`. Keys match action types ('view', 'edit', 'delete', etc.).
 * @param {string} [props.size='sm'] - Bootstrap button size ('sm', 'lg'). Defaults to 'sm'.
 */
const ActionButtons = ({
  item,
  onView,
  onEdit,
  onDelete,
  onCreateTicket,
  onTransfer,
  onGenerateReport,
    pdfProps,
  onDownloadWord,
  onGenerateExcelReport,
  isLoading = false,
  disabled = {},
  size = 'sm',
}) => {

  // Determine if a specific action is disabled
  const isActionDisabled = (actionType) => {
    if (isLoading) return true; // Disable all if general loading is true
    if (typeof disabled === 'boolean') return disabled; // Apply general boolean disabled prop
    if (typeof disabled === 'object' && disabled !== null) {
      return !!disabled[actionType]; // Check specific action key
    }
    return false; // Default to not disabled
  };

  return (
    <div className="d-flex gap-2 justify-content-center">
      {onView && (
        <Button
          variant="info"
          size={size}
          onClick={() => onView(item)}
          disabled={isActionDisabled('view')}
          title="View"
        >
          <Eye /> 
        </Button>
      )}
      {onEdit && (
        <Button
          variant="warning"
          size={size}
          onClick={() => onEdit(item)}
          disabled={isActionDisabled('edit')}
          title="Edit"
        >
          <PencilSquare /> 
        </Button>
      )}
      {onDelete && (
        <Button
          variant="danger"
          size={size}
          onClick={() => onDelete(item)}
          disabled={isActionDisabled('delete')}
          title="Delete"
        >
          <Trash /> 
        </Button>
      )}
      {onCreateTicket && (
        <Button
          variant="success"
          size={size}
          onClick={() => onCreateTicket(item)}
          disabled={isActionDisabled('createTicket')}
          title="Create Ticket"
        >
          <PlusSquare /> 
        </Button>
      )}
      {onTransfer && (
        <Button
          variant="info"
          size={size}
          onClick={() => onTransfer(item)}
          disabled={isActionDisabled('transfer')}
          title="Transfer Ticket"
        >
          <ArrowLeftRight /> 
        </Button>
      )}
       {onGenerateReport && (
        <Button
          variant="secondary"
          size={size}
          onClick={() => onGenerateReport(item)}
          disabled={isActionDisabled('generateReport')}
          title="Generate Report"
        >
                   <BarChart /> 
        </Button>
      )}
      {pdfProps && pdfProps.document && pdfProps.fileName && (
        <PDFDownloadLink document={pdfProps.document} fileName={pdfProps.fileName}>
          {({ loading: pdfLoading }) => (
            <Button
              variant="primary"
              size={size}
              disabled={isLoading || pdfLoading || isActionDisabled('downloadPdf')}
              title="Download PDF"
            >
              <CloudDownload /> {pdfLoading ? '...' : 'PDF'}
            </Button>
          )}
        </PDFDownloadLink> 
      )}
      {onDownloadWord && (
        <Button
          variant="success"
          size={size}
          onClick={() => onDownloadWord(item)}
          disabled={isLoading || isActionDisabled('downloadWord')}
          title="Download Word"
        >
          <FileEarmarkWord /> Word
        </Button>
      )}
      {onGenerateExcelReport && (
        <Button
          variant="outline-success" // Or another appropriate variant
          size={size}
          onClick={() => onGenerateExcelReport(item)} // item might not be needed if it's a general report
          disabled={isActionDisabled('generateExcelReport')}
          title="Generate Excel Report"
        >
          <FileEarmarkExcel /> EXCEL
        </Button>
      )}
    </div>
  );
};

export default ActionButtons;