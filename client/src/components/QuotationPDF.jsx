import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

// Styles
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 11,
    fontFamily: "Helvetica",
    lineHeight: 1.5,
  },
  document: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100%",
  },
  pageContent: {
    maxWidth: "100%",
    width: "100%",
  },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 5,
  },
  headerTextContainer: {
    flex: 1,
  },
  logoContainer: {
    width: 100,
    alignItems: "flex-end",
  },
  logo: {
    width: 80,
    height: 60,
    objectFit: "contain",
  },
  refText: {
    color: "red",
    fontWeight: "bold",
    marginBottom: 5,
  },
  heading: {
    marginVertical: 10,
    fontSize: 13,
    textDecoration: "underline",
    fontWeight: "bold",
    textAlign: "center",
  },
  section: {
    marginBottom: 10,
  },
  bodyText: {
    marginBottom: 5,
    textAlign: "justify",
  },
  table: {
    display: "table",
    width: "100%",
    borderWidth: 1,
    borderColor: "#000",
    marginVertical: 10,
  },
  tableRow: {
    flexDirection: "row",
  },
  tableCol: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
    padding: 4,
    textAlign: "center",
  },
  col1: { width: "8%" },
  col2: { width: "42%", textAlign: "left", paddingLeft: 5 },
  col3: { width: "10%" },
  col4: { width: "10%" },
  col5: { width: "15%" },
  col6: { width: "15%", borderRightWidth: 0 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    fontWeight: "bold",
    marginTop: 5,
  },
  terms: {
    marginTop: 15,
    fontSize: 10,
  },
  footer: {
    marginTop: 25,
    fontSize: 10,
    textAlign: "center",
    color: "red",
    fontWeight: "bold",
  },
  footerContact: {
    textAlign: "center",
    fontSize: 9,
    marginTop: 5,
  },
  subtextItem: {
    fontSize: 9,
    fontFamily: "Helvetica-Oblique", // Italic
    color: "#555", // Greyish color for subtext
    marginLeft: 10, // Indent subtext
    // paddingVertical: 1, // Small padding
  },
});

// Component
const QuotationPDF = ({ quotation }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.document}>
        <View style={styles.pageContent}>
          <Text style={styles.refText}>CIN NO.: U40106UP2020PTC127954</Text>

          <View style={styles.headerContainer}>
            <View style={styles.headerTextContainer}>
              {/* <Text>Ref: {quotation.referenceNumber}</Text> */}
              <Text>Date: {new Date(quotation.date).toLocaleDateString()}</Text>
            </View>
            <View style={styles.logoContainer}>
              <Image style={styles.logo} src="/logo.png" />
            </View>
          </View>

          <View style={styles.section}>
            <Text>To,</Text>
            <Text>{quotation.client.companyName}</Text>
            <Text>Site: {quotation.client.siteLocation}</Text>
          </View>

          <Text style={styles.heading}>
            Sub: Quotation for Earthing Material and Installation
          </Text>

          <Text style={styles.bodyText}>Dear Sir,</Text>
          <Text style={styles.bodyText}>
            Thanks for your enquiry of{" "}
            <Text style={{ fontStyle: "italic" }}>Earthing Items</Text>. As per
            your requirement here we are giving you, our prices. Kindly view it.
          </Text>

          <Text style={styles.heading}>Supply & Installation</Text>

          {/* Table Header */}
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCol, styles.col1]}>S.No</Text>
              <Text style={[styles.tableCol, styles.col2]}>
                Item description
              </Text>
              <Text style={[styles.tableCol, styles.col3]}>Unit</Text>
              <Text style={[styles.tableCol, styles.col4]}>Qty</Text>
              <Text style={[styles.tableCol, styles.col5]}>Rate</Text>
              <Text style={[styles.tableCol, styles.col6]}>Amount</Text>
            </View>

            {/* Table Rows */}
            {quotation.goods.map((item, index) => (
              <View style={styles.tableRow} key={index}>
                <Text style={[styles.tableCol, styles.col1]}>{index + 1}</Text>
                 <View style={[styles.tableCol, styles.col2]}>
                  <Text>{item.description}</Text>
                  {item.subtexts && item.subtexts.map((sub, subIndex) => (
                    <Text key={subIndex} style={styles.subtextItem}>
                      - {sub}
                    </Text>
                  ))}
                </View>
                <Text style={[styles.tableCol, styles.col3]}>{item.unit}</Text>
                <Text style={[styles.tableCol, styles.col4]}>
                  {item.quantity}
                </Text>
                <Text style={[styles.tableCol, styles.col5]}>
                  ₹{item.price.toFixed(2)}
                </Text>
                <Text style={[styles.tableCol, styles.col6]}>
                  ₹{item.amount.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.totalRow}>
            <Text>Total: ₹{quotation.totalAmount.toFixed(2)}</Text>
          </View>

          {/* Terms & Conditions */}
          <View style={styles.terms}>
            <Text>Terms & Conditions:</Text>
            <Text>- Material Ex-Factory Noida</Text>
            <Text>- GST: 18% is applicable</Text>
            <Text>- Freight: Extra as applicable</Text>
            <Text>- Packing: Extra if applicable</Text>
            <Text>
              - Payment: 100% in advance after receiving Formal PO and Advance
            </Text>
            <Text>
              - Dispatch: Within {quotation.dispatchDays} days after receiving
              payment
            </Text>
            <Text>
              - Validity: This quotation is valid till{" "}
              {new Date(quotation.validityDate).toLocaleDateString()}
            </Text>
            <Text>
              - Order: Order to be placed in the name of "E-KORS PVT LTD"
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text>Hoping for your valuable order in the earliest.</Text>
            <Text>E-KORS PRIVATE LIMITED</Text>
          </View>

          <View style={styles.footerContact}>
            <Text>Com Add: Pole No. 02, Sector 115 Noida - 201307</Text>
            <Text>Ph. No. 9711725989 / 9897022545</Text>
            <Text>Email: sales@ekors.in</Text>
          </View>
        </View>
      </View>
    </Page>
  </Document>
);

export default QuotationPDF;
