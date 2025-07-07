import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  ImageRun,
  HeadingLevel,
} from "docx";
import fs from "fs"; // Only for Node.js environment for fetching local image, not for browser
import { Buffer } from "buffer"; // For browser environment if image is base64

// Helper function to get parts of an address, handling both object and array formats
// This should be consistent with the one in PIPDF.jsx or imported if possible
const getAddressPart = (address, part) => {
  if (!address) return part === 'address2' ? "" : "N/A";

  if (Array.isArray(address)) {
    switch (part) {
      case 'address1': return address[0] || "N/A";
      case 'address2': return address[1] || "";
      case 'city':     return address[3] || "N/A";
      case 'state':    return address[2] || "N/A";
      case 'pincode':  return address[4] || "N/A";
      default: return "N/A";
    }
  } else if (typeof address === 'object' && address !== null) {
    switch (part) {
      case 'address1': return address.address1 || "N/A";
      case 'address2': return address.address2 || "";
      case 'city':     return address.city || "N/A";
      case 'state':    return address.state || "N/A";
      case 'pincode':  return address.pincode || "N/A";
      default: return "N/A";
    }
  }
  return part === 'address2' ? "" : "N/A";
};

const toWords = (num) => {
  const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  if ((num = num.toString()).length > 9) return 'overflow';
  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return ''; var str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim() ? str.trim() + ' only' : 'zero only';
};

// Placeholder for fetching image data. In a browser, you might use fetch API for a URL or a base64 string.
// For simplicity, this example won't include actual image fetching for the DOCX in the browser.
// You would typically convert your logo to base64 or ensure it's accessible via URL.
// const getLogoBuffer = async () => {
//   // Example: Fetching from public folder if running in an environment that can resolve it
//   // const response = await fetch('/src/assets/logo.png');
//   // const arrayBuffer = await response.arrayBuffer();
//   // return Buffer.from(arrayBuffer);
//   return null; // Placeholder
// };

export const generatePIDocx = (ticket) => {
  // const logoBuffer = await getLogoBuffer(); // Call this if you have a way to get the logo buffer

  const children = [
    // Header
    new Paragraph({ alignment: AlignmentType.CENTER, text: "GSTIN : 09AAFCE8706R1ZV", style: "headerStyle" }),
    new Paragraph({ alignment: AlignmentType.CENTER, text: "E-KORS PRIVATE LIMITED", style: "companyNameStyle" }),
    new Paragraph({ alignment: AlignmentType.CENTER, text: "PLOT NO.-02, Sector-115, NOIDA\nGautam Buddha Nagar, Uttar Pradesh, 201307", style: "subHeaderStyle" }),
    new Paragraph({ alignment: AlignmentType.CENTER, text: "PERFORMA INVOICE", style: "invoiceTitleStyle" }),
    new Paragraph({ text: `Quotation No. : ${ticket.quotationNumber}\t\t\t\tDate : ${new Date(ticket.createdAt).toLocaleDateString()}` }),
    new Paragraph({text: " "}), // Spacer

    // Address Table
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph({ text: "Details", bold: true })], verticalAlign: AlignmentType.CENTER }),
            new TableCell({ children: [new Paragraph({ text: "Billing Address", bold: true })], verticalAlign: AlignmentType.CENTER }),
            new TableCell({ children: [new Paragraph({ text: "Shipping Address", bold: true })], verticalAlign: AlignmentType.CENTER }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph("Party Name:")], verticalAlign: AlignmentType.TOP }),
            new TableCell({ children: [new Paragraph(ticket.client?.companyName || ticket.companyName || "N/A")] }),
            new TableCell({ children: [new Paragraph(ticket.client?.companyName || ticket.companyName || "N/A")] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph("Address:")], verticalAlign: AlignmentType.TOP }),
            new TableCell({ children: [new Paragraph(`${getAddressPart(ticket.billingAddress, 'address1')}${getAddressPart(ticket.billingAddress, 'address2') ? `, ${getAddressPart(ticket.billingAddress, 'address2')}` : ""}`)] }),
            new TableCell({ children: [new Paragraph(`${getAddressPart(ticket.shippingAddressObj || ticket.shippingAddress, 'address1')}${getAddressPart(ticket.shippingAddressObj || ticket.shippingAddress, 'address2') ? `, ${getAddressPart(ticket.shippingAddressObj || ticket.shippingAddress, 'address2')}` : ""}`)] }),
          ],
        }),
         new TableRow({
          children: [
            new TableCell({ children: [new Paragraph("City/State/Pin:")], verticalAlign: AlignmentType.TOP }),
            new TableCell({ children: [new Paragraph(`${getAddressPart(ticket.billingAddress, 'city')}, ${getAddressPart(ticket.billingAddress, 'state')} - ${getAddressPart(ticket.billingAddress, 'pincode')}`)] }),
            new TableCell({ children: [new Paragraph(`${getAddressPart(ticket.shippingAddressObj || ticket.shippingAddress, 'city')}, ${getAddressPart(ticket.shippingAddressObj || ticket.shippingAddress, 'state')} - ${getAddressPart(ticket.shippingAddressObj || ticket.shippingAddress, 'pincode')}`)] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph("GSTIN / UIN:")], verticalAlign: AlignmentType.TOP }),
            new TableCell({ children: [new Paragraph(ticket.client?.gstNumber || ticket.clientGstNumber || "N/A")] }),
            new TableCell({ children: [new Paragraph(ticket.client?.gstNumber || ticket.clientGstNumber || "N/A")] }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({ children: [new Paragraph("Contact No.:")], verticalAlign: AlignmentType.TOP }),
            new TableCell({ children: [new Paragraph(ticket.client?.phone || ticket.clientPhone || "N/A")] }),
            new TableCell({ children: [new Paragraph(ticket.client?.phone || ticket.clientPhone || "N/A")] }),
          ],
        }),
      ],
    }),
    new Paragraph({text: " "}), // Spacer

    // Goods Table
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: ["S.N.", "Description of Goods", "HSN/SAC", "Qty.", "Unit", "Price", "Amount (*)"].map(headerText => new TableCell({ children: [new Paragraph({ text: headerText, bold: true, alignment: AlignmentType.CENTER })] })),
        }),
        ...ticket.goods.map((item, i) => new TableRow({
          children: [
            new TableCell({ children: [new Paragraph(String(i + 1))] }),
            new TableCell({ children: [new Paragraph(item.description)] }),
            new TableCell({ children: [new Paragraph(item?.hsnCode)] }),
            new TableCell({ children: [new Paragraph(String(item.quantity))] }),
            new TableCell({ children: [new Paragraph("PCS")] }), // Assuming unit is PCS, adjust if dynamic
            new TableCell({ children: [new Paragraph(item.price.toFixed(2))] }),
            new TableCell({ children: [new Paragraph(item.amount.toFixed(2))] }),
          ],
        })),
      ],
    }),
    new Paragraph({text: " "}),

    // GST Details (simplified for DOCX, can be expanded like PDF's tax breakdown table)
    ...(ticket.gstBreakdown || []).flatMap(gstGroup => {
        const rows = [];
        if (ticket.isBillingStateSameAsCompany) {
            if (gstGroup.cgstAmount > 0) rows.push(new Paragraph({ text: `Add: CGST @ ${gstGroup.cgstRate.toFixed(2)}% : ${gstGroup.cgstAmount.toFixed(2)}`, alignment: AlignmentType.RIGHT }));
            if (gstGroup.sgstAmount > 0) rows.push(new Paragraph({ text: `Add: SGST @ ${gstGroup.sgstRate.toFixed(2)}% : ${gstGroup.sgstAmount.toFixed(2)}`, alignment: AlignmentType.RIGHT }));
        } else {
            if (gstGroup.igstAmount > 0) rows.push(new Paragraph({ text: `Add: IGST @ ${gstGroup.igstRate.toFixed(2)}% : ${gstGroup.igstAmount.toFixed(2)}`, alignment: AlignmentType.RIGHT }));
        }
        return rows;
    }),
    new Paragraph({ text: `Total GST : ${(ticket.finalGstAmount || 0).toFixed(2)}`, bold: true, alignment: AlignmentType.RIGHT }),
    new Paragraph({ text: `Grand Total : ₹${(ticket.grandTotal || 0).toFixed(2)}`, bold: true, alignment: AlignmentType.RIGHT, style: "grandTotalStyle" }),
    new Paragraph({ text: `Amount in Words: ${toWords(Math.round(ticket.grandTotal || 0))}`, style: "amountInWordsStyle" }),
    new Paragraph({text: " "}),

    // Bank Details
    new Paragraph({ text: "Bank Details :", bold: true }),
    new Paragraph({ text: "Bank : ICICI Bank\nBank Account No:: 628906029990, IFSC CODE No.: ICIC0006284" }),
    new Paragraph({text: " "}), new Paragraph({text: " "}), new Paragraph({text: " "}),

    // Footer
    new Paragraph({ text: "for E-KORS PRIVATE LIMITED", alignment: AlignmentType.RIGHT }),
    new Paragraph({text: " "}), new Paragraph({text: " "}),
    new Paragraph({ text: "Authorized Signatory", alignment: AlignmentType.RIGHT }),
  ];

  // if (logoBuffer) {
  //   children.unshift(new Paragraph({
  //     children: [new ImageRun({ data: logoBuffer, transformation: { width: 100, height: 75 } })],
  //     alignment: AlignmentType.RIGHT,
  //   }));
  // }

  const doc = new Document({
    sections: [{ children }],
    styles: {
      paragraphStyles: [
        { id: "headerStyle", name: "Header Style", run: { size: 24 }, paragraph: { spacing: { after: 100 } } },
        { id: "companyNameStyle", name: "Company Name Style", run: { size: 32, bold: true }, paragraph: { spacing: { after: 50 } } },
        { id: "subHeaderStyle", name: "SubHeader Style", run: { size: 20 }, paragraph: { spacing: { after: 150 } } },
        { id: "invoiceTitleStyle", name: "Invoice Title Style", run: { size: 28, bold: true, underline: {} }, paragraph: { spacing: { after: 150 }, alignment: AlignmentType.CENTER } },
        { id: "grandTotalStyle", name: "Grand Total Style", run: { size: 24, bold: true }, paragraph: { spacing: { before: 100, after: 50 } } },
        { id: "amountInWordsStyle", name: "Amount in Words Style", run: { size: 22, italics: true }, paragraph: { spacing: { after: 100 } } },
      ],
    },
  });

  return doc;
};
