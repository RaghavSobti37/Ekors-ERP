import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 11,
    position: 'relative' // Needed for absolute positioning of logo
  },
  header: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 10
  },
  companyName: {
    fontSize: 16,
    textAlign: "center",
    fontWeight: "bold",
    marginBottom: 5
  },
  subHeader: {
    fontSize: 10,
    textAlign: "center",
    marginBottom: 15
  },
  invoiceTitle: {
    textAlign: "center",
    textDecoration: "underline",
    marginBottom: 15
  },
  row: {
    flexDirection: "row",
    marginBottom: 8
  },
  col: {
    width: "50%"
  },
  bold: {
    fontWeight: "bold"
  },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1px solid #000",
    paddingBottom: 5,
    marginTop: 15
  },
  cell: {
    borderRight: "1px solid #000",
    padding: 3
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1px solid #eee",
    paddingVertical: 5
  },
  bankDetails: {
    marginTop: 15,
    borderTop: "1px solid #000",
    paddingTop: 10
  },
  centerText: {
    textAlign: "center"
  },
  logo: {
    position: 'absolute',
    right: 30,
    top: 30,
    width: 80,
    height: 'auto'
  },
  gstRow: { // Style for the old GST summary rows, can be reused or adapted
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 2,
  },
  gstCell: { // Style for cells in the old GST summary, can be reused or adapted
    width: "64%", // Adjusted to align with other text, or make specific widths
    textAlign: "left",
    paddingLeft: 5, // Add some padding
  },
  grandTotal: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    borderTop: "1px solid #000",
    paddingTop: 5,
  },
  grandTotalText: {
    fontWeight: "bold",
    marginRight: 5,
  },
  taxBreakdownTable: { // New style for the detailed GST breakdown table
    width: "100%",
    marginTop: 10,
    border: "1px solid #000",
  },
  taxBreakdownRow: {
    flexDirection: "row",
    borderBottom: "1px solid #000",
  },
  taxBreakdownCell: {
    padding: 5,
    borderRight: "1px solid #000",
    textAlign: "center",
  },
});

// Helper function to get parts of an address, handling both object and array formats
const getAddressPart = (address, part) => {
  if (!address) return part === 'address2' ? "" : "N/A"; // address2 can be empty, others N/A

  if (Array.isArray(address)) {
    // Array format: [address1, address2, state, city, pincode]
    switch (part) {
      case 'address1': return address[0] || "N/A";
      case 'address2': return address[1] || "";
      case 'city':     return address[3] || "N/A"; // City is at index 3
      case 'state':    return address[2] || "N/A"; // State is at index 2
      case 'pincode':  return address[4] || "N/A"; // Pincode is at index 4
      default: return "N/A";
    }
  } else if (typeof address === 'object' && address !== null) {
    // Object format
    switch (part) {
      case 'address1': return address.address1 || "N/A";
      case 'address2': return address.address2 || "";
      case 'city':     return address.city || "N/A";
      case 'state':    return address.state || "N/A";
      case 'pincode':  return address.pincode || "N/A";
      default: return "N/A";
    }
  }
  // Fallback if address is not in expected format
  return part === 'address2' ? "" : "N/A";
};

const toWords = (num) => {
  const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
  const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

  if ((num = num.toString()).length > 9) return 'overflow';
  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return; var str = '';
  str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'crore ' : '';
  str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'lakh ' : '';
  str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'thousand ' : '';
  str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'hundred ' : '';
  str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) : '';
  return str.trim() + ' only';
};


const PIPDF = ({ ticket }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Logo in top right corner */}
      <Image
        style={styles.logo}
        src="/src/assets/logo.png" // Update this path to your actual logo path
      />

      <Text style={styles.header}>GSTIN : 09AAFCE8706R1ZV</Text>
      <Text style={styles.companyName}>E-KORS PRIVATE LIMITED</Text>
      <Text style={styles.subHeader}>
        PLOT NO.-02, Sector-115, NOIDA{"\n"}Gautam Buddha Nagar, Uttar Pradesh, 201307
      </Text>
      <Text style={styles.invoiceTitle}>PERFORMA INVOICE</Text>

      <View style={styles.row}>
        <Text>Quotation No. : {ticket.quotationNumber}</Text>
        <Text>Date : {new Date(ticket.createdAt).toLocaleDateString()}</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.col}>
          <Text style={styles.bold}>Quotation to :</Text>
          <Text> {ticket.companyName}</Text>
          <Text> {getAddressPart(ticket.billingAddress, 'address1')}</Text>
          <Text> {getAddressPart(ticket.billingAddress, 'address2')}</Text>
          <Text> {`${getAddressPart(ticket.billingAddress, 'city')}, ${getAddressPart(ticket.billingAddress, 'state')} - ${getAddressPart(ticket.billingAddress, 'pincode')}`}</Text>
          <Text> Party Mobile No : {ticket.client?.phone || "N/A"}</Text>
          <Text> State : {getAddressPart(ticket.billingAddress, 'state')}</Text>
          <Text> GSTIN / UIN : {ticket.client?.gstNumber || "N/A"}</Text>
        </View>
        <View style={styles.col}>
          <Text style={styles.bold}>Shipped to :</Text>
          <Text> {ticket.companyName}</Text>
          <Text> {getAddressPart(ticket.shippingAddressObj || ticket.shippingAddress, 'address1')}</Text>
          <Text> {getAddressPart(ticket.shippingAddressObj || ticket.shippingAddress, 'address2')}</Text>
          <Text> {`${getAddressPart(ticket.shippingAddressObj || ticket.shippingAddress, 'city')}, ${getAddressPart(ticket.shippingAddressObj || ticket.shippingAddress, 'state')} - ${getAddressPart(ticket.shippingAddressObj || ticket.shippingAddress, 'pincode')}`}</Text>
          <Text> Party Mobile No : {ticket.client?.phone || "N/A"}</Text>
          <Text> State : {getAddressPart(ticket.shippingAddressObj || ticket.shippingAddress, 'state')}</Text>
          <Text> GSTIN / UIN : {ticket.client?.gstNumber || "N/A"}</Text>
        </View>
      </View>

      <View style={styles.tableHeader}>
        <Text style={[styles.cell, { width: "5%" }]}>S.N.</Text>
        <Text style={[styles.cell, { width: "35%" }]}>Description of Goods</Text>
        <Text style={[styles.cell, { width: "15%" }]}>HSN/SAC Code</Text>
        <Text style={[styles.cell, { width: "10%" }]}>Qty.</Text>
        <Text style={[styles.cell, { width: "10%" }]}>Unit</Text>
        <Text style={[styles.cell, { width: "10%" }]}>Price</Text>
        <Text style={[styles.cell, { width: "15%", borderRight: 0 }]}>Amount(*)</Text>
      </View>

      {ticket.goods.map((item, i) => (
        <View style={styles.tableRow} key={i}>
          <Text style={[styles.cell, { width: "5%" }]}>{i + 1}</Text>
          <Text style={[styles.cell, { width: "35%" }]}>{item.description}</Text>
          <Text style={[styles.cell, { width: "15%" }]}>{item.hsnSacCode}</Text>
          <Text style={[styles.cell, { width: "10%" }]}>{item.quantity}</Text>
          <Text style={[styles.cell, { width: "10%" }]}>PCS</Text>
          <Text style={[styles.cell, { width: "10%" }]}>{item.price.toFixed(2)}</Text>
          <Text style={[styles.cell, { width: "15%", borderRight: 0 }]}>{item.amount.toFixed(2)}</Text>
        </View>
      ))}

      {/* GST Calculation - Old summary, can be removed or kept if desired alongside new table */}
      {/* This section can be simplified or removed if the new tax table is sufficient */}
      {ticket.isBillingStateSameAsCompany ? (
        <>
          {(ticket.gstBreakdown || []).filter(g => g.cgstAmount > 0 || g.sgstAmount > 0).map((gstGroup, index) => (
            <React.Fragment key={`summary-cgst-sgst-${index}`}>
              <View style={styles.gstRow}>
                <Text style={styles.gstCell}>Add: CGST</Text>
                <Text style={[styles.gstCell, { width: "8%" }]}>@</Text>
                <Text style={[styles.gstCell, { width: "8%" }]}>{gstGroup.cgstRate.toFixed(2)}%</Text>
                <Text style={[styles.gstCell, { width: "12%" }]}>{gstGroup.cgstAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.gstRow}>
                <Text style={styles.gstCell}>Add: SGST</Text>
                <Text style={[styles.gstCell, { width: "8%" }]}>@</Text>
                <Text style={[styles.gstCell, { width: "8%" }]}>{gstGroup.sgstRate.toFixed(2)}%</Text>
                <Text style={[styles.gstCell, { width: "12%" }]}>{gstGroup.sgstAmount.toFixed(2)}</Text>
              </View>
            </React.Fragment>
          ))}
        </>
      ) : (
        <>
          {(ticket.gstBreakdown || []).filter(g => g.igstAmount > 0).map((gstGroup, index) => (
            <React.Fragment key={`summary-igst-${index}`}>
              <View style={styles.gstRow}>
                <Text style={styles.gstCell}>Add: IGST</Text>
                <Text style={[styles.gstCell, { width: "8%" }]}>@</Text>
                <Text style={[styles.gstCell, { width: "8%" }]}>{gstGroup.igstRate.toFixed(2)}%</Text>
                <Text style={[styles.gstCell, { width: "12%" }]}>{gstGroup.igstAmount.toFixed(2)}</Text>
              </View>
            </React.Fragment>
          ))}
        </>
      )}

      {/* Total GST (optional if detailed table shows it) */}
      <View style={styles.gstRow}>
        <Text style={[styles.gstCell, styles.bold]}>Total GST</Text>
        <Text style={[styles.gstCell, { width: "8%" }]}></Text>
        <Text style={[styles.gstCell, { width: "8%" }]}></Text>
        <Text style={[styles.gstCell, { width: "12%", fontWeight: "bold" }]}>
          {(ticket.finalGstAmount || 0).toFixed(2)}
        </Text>
      </View>

      {/* Grand Total */}
      <View style={styles.grandTotal}>
        <Text style={styles.grandTotalText}>Grand Total :</Text>
        <Text style={styles.bold}>
          ₹{(ticket.grandTotal || 0).toFixed(2)}
        </Text>
      </View>

      {/* New Tax Breakdown Table */}
      <View style={styles.taxBreakdownTable}>
        {/* Header Row */}
        <View style={[styles.taxBreakdownRow, styles.tableHeader, {backgroundColor: '#f0f0f0'}]}>
          <Text style={[styles.taxBreakdownCell, styles.bold, { width: "20%"}]}>HSN/SAC (Rate)</Text>
          <Text style={[styles.taxBreakdownCell, styles.bold, { width: "20%"}]}>Taxable Value</Text>
          {ticket.isBillingStateSameAsCompany ? (
            <>
              <Text style={[styles.taxBreakdownCell, styles.bold, { width: "15%"}]}>CGST Amount</Text>
              <Text style={[styles.taxBreakdownCell, styles.bold, { width: "15%"}]}>SGST Amount</Text>
            </>
          ) : (
            <Text style={[styles.taxBreakdownCell, styles.bold, { width: "30%"}]}>IGST Amount</Text>
          )}
          <Text style={[styles.taxBreakdownCell, styles.bold, { width: "20%", borderRight: 0 }]}>Total Tax</Text>
        </View>

        {/* Data Rows */}
        {(ticket.gstBreakdown || []).map((gstGroup, index) => (
          <View style={styles.taxBreakdownRow} key={`breakdown-${index}`}>
            <Text style={[styles.taxBreakdownCell, { width: "20%"}]}>{`Goods @ ${gstGroup.itemGstRate}%`}</Text>
            <Text style={[styles.taxBreakdownCell, { width: "20%"}]}>{gstGroup.taxableAmount.toFixed(2)}</Text>
            {ticket.isBillingStateSameAsCompany ? (
              <>
                <Text style={[styles.taxBreakdownCell, { width: "15%"}]}>{gstGroup.cgstAmount.toFixed(2)}</Text>
                <Text style={[styles.taxBreakdownCell, { width: "15%"}]}>{gstGroup.sgstAmount.toFixed(2)}</Text>
              </>
            ) : (
              <Text style={[styles.taxBreakdownCell, { width: "30%"}]}>{gstGroup.igstAmount.toFixed(2)}</Text>
            )}
            <Text style={[styles.taxBreakdownCell, { width: "20%", borderRight: 0 }]}>
              {(gstGroup.cgstAmount + gstGroup.sgstAmount + gstGroup.igstAmount).toFixed(2)}
            </Text>
          </View>
        ))}
        {/* Total Row for Tax Breakdown Table */}
        <View style={[styles.taxBreakdownRow, styles.bold, {backgroundColor: '#f0f0f0'}]}>
          <Text style={[styles.taxBreakdownCell, { width: "20%"}]}>Total</Text>
          <Text style={[styles.taxBreakdownCell, { width: "20%"}]}>{(ticket.totalAmount || 0).toFixed(2)}</Text>
          {ticket.isBillingStateSameAsCompany ? (
            <>
              <Text style={[styles.taxBreakdownCell, { width: "15%"}]}>{(ticket.totalCgstAmount || 0).toFixed(2)}</Text>
              <Text style={[styles.taxBreakdownCell, { width: "15%"}]}>{(ticket.totalSgstAmount || 0).toFixed(2)}</Text>
            </>
          ) : (
            <Text style={[styles.taxBreakdownCell, { width: "30%"}]}>{(ticket.totalIgstAmount || 0).toFixed(2)}</Text>
          )}
          <Text style={[styles.taxBreakdownCell, { width: "20%", borderRight: 0 }]}>
            {(ticket.finalGstAmount || 0).toFixed(2)}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 10 }}>
        <Text style={{ marginTop: 5, fontSize: 9, textTransform: 'capitalize' }}>
          Amount in Words: {toWords(Math.round(ticket.grandTotal || 0))}
        </Text>
      </View>

      <View style={styles.bankDetails}>
        <Text style={{ fontWeight: "bold" }}>Bank Details :</Text>
        <Text>
          Bank : ICICI Bank{"\n"}Bank Account No:: 628906029990, IFSC CODE No.:
          ICIC0006284
        </Text>
      </View>

      <View style={{ marginTop: 20, position: 'absolute', bottom: 30, right: 30, textAlign: 'right' }}>
        <Text>for E-KORS PRIVATE LIMITED</Text>
        <Text style={{marginTop: 30}}>Authorized Signatory</Text>
      </View>
    </Page>
  </Document>
);

export default PIPDF;
