import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 11,
  },
  header: {
    fontSize: 24,
    marginBottom: 20,
    textAlign: "center",
    fontWeight: "bold",
    textTransform: "uppercase",
  },
  section: {
    marginBottom: 15,
  },
  table: {
    display: "table",
    width: "auto",
    marginTop: 20,
    borderWidth: 1,
    borderColor: "#000",
  },
  tableRow: {
    flexDirection: "row",
  },
  tableColHeader: {
    width: "25%",
    fontWeight: "bold",
    border: "1px solid #000",
    padding: 5,
  },
  tableCol: {
    width: "25%",
    border: "1px solid #000",
    padding: 5,
    textAlign: "center",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingTop: 5,
    fontWeight: "bold",
  },
  footer: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 10,
    color: "red",
  },
});

const QuotationPDF = ({ quotation }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.header}>Quotation</Text>

      <View style={styles.section}>
        <Text>Quotation Number: {quotation.referenceNumber}</Text>
        <Text>Date: {new Date(quotation.date).toLocaleDateString()}</Text>
        <Text>
          Validity Date: {new Date(quotation.validityDate).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.section}>
        <Text>To:</Text>
        <Text>{quotation.client.companyName}</Text>
        <Text>GST: {quotation.client.gstNumber}</Text>
      </View>

      <View style={styles.table}>
        <View style={[styles.tableRow, { backgroundColor: "#f0f0f0" }]}>
          <Text style={[styles.tableCol, { width: "10%" }]}>S.No</Text>
          <Text style={[styles.tableCol, { width: "40%" }]}>Description</Text>
          <Text style={[styles.tableCol, { width: "15%" }]}>HSN/SAC</Text>
          <Text style={[styles.tableCol, { width: "10%" }]}>Qty</Text>
          <Text style={[styles.tableCol, { width: "15%" }]}>Rate</Text>
          <Text style={[styles.tableCol, { width: "10%" }]}>Amount</Text>
        </View>

        {quotation.goods.map((item, index) => (
          <View style={styles.tableRow} key={index}>
            <Text style={[styles.tableCol, { width: "10%" }]}>{index + 1}</Text>
            <Text style={[styles.tableCol, { width: "40%" }]}>
              {item.description}
            </Text>
            <Text style={[styles.tableCol, { width: "15%" }]}>
              {item.hsnSacCode}
            </Text>
            <Text style={[styles.tableCol, { width: "10%" }]}>
              {item.quantity}
            </Text>
            <Text style={[styles.tableCol, { width: "15%" }]}>
              ₹{item.price.toFixed(2)}
            </Text>
            <Text style={[styles.tableCol, { width: "10%" }]}>
              ₹{item.amount.toFixed(2)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.totalRow}>
        <Text>Sub Total: ₹{quotation.totalAmount.toFixed(2)}</Text>
      </View>
      <View style={styles.totalRow}>
        <Text>GST (18%): ₹{quotation.gstAmount.toFixed(2)}</Text>
      </View>
      <View style={styles.totalRow}>
        <Text>Grand Total: ₹{quotation.grandTotal.toFixed(2)}</Text>
      </View>

      <View style={styles.section}>
        <Text>Terms & Conditions:</Text>
        <Text>- Payment: 100% advance</Text>
        <Text>- Delivery: Within {quotation.dispatchDays} days</Text>
        <Text>
          - Validity: {new Date(quotation.validityDate).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.footer}>
        <Text>For {quotation.client.companyName}</Text>
        <Text>Authorized Signatory</Text>
      </View>
    </Page>
  </Document>
);

export default QuotationPDF;