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
  }
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
        <Text>Date : {new Date(ticket.createdAt).toLocaleDateString()}</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.col}>
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
          <Text> {getAddressPart(ticket.shippingAddress, 'address1')}</Text>
          <Text> {getAddressPart(ticket.shippingAddress, 'address2')}</Text>
          <Text> {`${getAddressPart(ticket.shippingAddress, 'city')}, ${getAddressPart(ticket.shippingAddress, 'state')} - ${getAddressPart(ticket.shippingAddress, 'pincode')}`}</Text>
          <Text> Party Mobile No : {ticket.client?.phone || "N/A"}</Text>
          <Text> State : {getAddressPart(ticket.shippingAddress, 'state')}</Text>
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

      <View style={{ marginTop: 10 }}>
        <Text>Add : GST @ 18.00%</Text>
        <Text style={{ fontWeight: "bold", marginTop: 5 }}>
          Grand Total : ₹{ticket.grandTotal.toFixed(2)}
        </Text>
        <Text style={{ marginTop: 5, fontSize: 9 }}>
          Taxable Rate Total = Sub Total Amt. + Total Tax.{"\n"}18%
        </Text>
        <Text style={{ marginTop: 10 }}>
          Rupees Eighteen Thousand Five Hundred Twenty Six Only
        </Text>
      </View>

      <View style={styles.bankDetails}>
        <Text style={{ fontWeight: "bold" }}>Bank Details :</Text>
        <Text>
          Bank : ICICI Bank{"\n"}Bank Account No:: 628906029990, IFSC CODE No.:
          ICIC0006284
        </Text>
      </View>

      <View style={{ marginTop: 20 }}>
        <Text style={{ textAlign: "right" }}>for E-KORS PRIVATE LIMITED</Text>
        <Text style={{ textAlign: "right" }}>Authorized Signatory</Text>
      </View>
    </Page>
  </Document>
);

export default PIPDF;