import React, { useState, useEffect } from "react";

import {
  Document, Page, Text, View, StyleSheet, Image,
} from "@react-pdf/renderer";

// import apiClient from "../utils/apiClient"; // No longer needed for fetching
// import LoadingSpinner from "./LoadingSpinner"; // No longer needed for fetching

// Styles
// ... (styles remain the same)
const styles = StyleSheet.create({
  page: {
    paddingTop: 35,
    paddingBottom: 65,
    paddingHorizontal: 35,
    fontFamily: "Helvetica",
    fontSize: 9, // Adjusted base font size for more content
  },
  headerSection: {
    textAlign: "center",
    marginBottom: 15,
  },
  gstinHeader: {
    fontSize: 10,
    marginBottom: 2,
  },
  companyNameHeader: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  companyAddressHeader: {
    fontSize: 8,
    marginBottom: 10,
  },
  invoiceTitle: {
    fontSize: 12,
    fontWeight: "bold",
    textDecoration: "underline",
    textAlign: "center",
    marginBottom: 15,
  },
  metaInfoContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    fontSize: 9,
  },
  addressTable: {
    display: "table",
    width: "100%",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#333", // Darker border
    marginBottom: 15,
  },
  addressRow: {
    flexDirection: "row",
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  addressCellHeaderLabel: {
    // For "Details" column labels like "Party Name:"
    width: "20%", // Adjusted width
    borderRightStyle: "solid",
    borderRightWidth: 1,
    borderRightColor: "#333",
    padding: 4,
    fontWeight: "bold",
    backgroundColor: "#f0f0f0", // Light grey background for labels
  },
  addressCellData: {
    // For Billing and Shipping data columns
    width: "40%", // Adjusted width
    borderRightStyle: "solid",
    borderRightWidth: 1,
    borderRightColor: "#333",
    padding: 4,
    wordBreak: "break-all",
  },
  addressCellDataLast: {
    // For the last data cell in a row (no right border)
    width: "40%",
    padding: 4,
    wordBreak: "break-all",
  },
  addressTableHeader: {
    // For "Details", "Billing Address", "Shipping Address"
    width: "20%",
    borderRightStyle: "solid",
    borderRightWidth: 1,
    borderRightColor: "#333",
    padding: 4,
    fontWeight: "bold",
    textAlign: "center",
    backgroundColor: "#e0e0e0", // Slightly darker grey for main headers
  },
  addressTableHeaderData: {
    width: "40%",
    borderRightStyle: "solid",
    borderRightWidth: 1,
    borderRightColor: "#333",
    padding: 4,
    fontWeight: "bold",
    textAlign: "center",
    backgroundColor: "#e0e0e0",
  },
  goodsTable: {
    display: "table",
    width: "auto",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#333",
    marginBottom: 10,
  },
  goodsTableHeader: {
    flexDirection: "row",
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    backgroundColor: "#f0f0f0",
    fontWeight: "bold",
    textAlign: "center",
  },
  goodsTableRow: {
    flexDirection: "row",
    borderBottomStyle: "solid",
    borderBottomWidth: 0.5, // Lighter border for rows
    borderBottomColor: "#ccc",
  },
  goodsCell: {
    padding: 4,
    borderRightStyle: "solid",
    borderRightWidth: 0.5,
    borderRightColor: "#ccc",
    textAlign: "center", // Center align by default
  },
  goodsCellDescription: {
    textAlign: "left",
    paddingLeft: 5,
  },
  colSrNo: { width: "5%" },
  colDescription: { width: "35%" },
  colHSN: { width: "15%" },
  colQty: { width: "10%" },
  colUnit: { width: "10%" },
  colRate: { width: "10%" },
  colAmount: { width: "15%", borderRightWidth: 0 },

  summarySection: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  summaryContainer: {
    width: "50%", // Adjust as needed
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 2,
    fontSize: 9,
  },
  summaryLabel: {
    fontWeight: "normal",
  },
  summaryValue: {
    fontWeight: "bold",
  },
  grandTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderTopWidth: 1,
    borderTopColor: "#333",
    marginTop: 5,
    fontWeight: "bold",
    fontSize: 10,
  },
  amountInWords: {
    marginTop: 8,
    fontSize: 8,
    textTransform: "capitalize",
  },
  taxBreakdownTable: {
    display: "table",
    width: "100%",
    borderStyle: "solid",
    borderWidth: 1,
    borderColor: "#333",
    marginTop: 10,
    marginBottom: 10,
  },
  taxBreakdownHeader: {
    flexDirection: "row",
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    backgroundColor: "#f0f0f0",
    fontWeight: "bold",
    textAlign: "center",
  },
  taxBreakdownRow: {
    flexDirection: "row",
    borderBottomStyle: "solid",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
  },
  taxBreakdownCell: {
    padding: 4,
    borderRightStyle: "solid",
    borderRightWidth: 0.5,
    borderRightColor: "#ccc",
    textAlign: "right", // Default to right for amounts
  },
  taxColDescription: { width: "28%", textAlign: "left" },
  taxColTaxableValue: { width: "18%" },
  taxColCGSTRate: { width: "8%", textAlign: "center" },
  taxColCGSTAmount: { width: "12%" },
  taxColSGSTRate: { width: "8%", textAlign: "center" },
  taxColSGSTAmount: { width: "12%" },
  taxColIGSTRate: { width: "10%", textAlign: "center" },
  taxColIGSTAmount: { width: "16%" },
  taxColTotalTax: { width: "14%", borderRightWidth: 0 },

  bankDetails: {
    marginTop: 15,
    paddingTop: 5,
    borderTopWidth: 1,
    borderTopColor: "#333",
    fontSize: 8,
  },
  termsConditions: {
    marginTop: 10,
    fontSize: 8,
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 35,
    right: 35,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    fontSize: 8,
  },
  authSignatory: {
    textAlign: "right",
  },
  logo: {
    position: "absolute",
    right: 35,
    top: 35,
    width: 70, // Adjusted size
    height: "auto",
  },
  bold: {
    fontWeight: "bold",
  },
});

const Quotation = ({ quotation }) => {
  const [config, setConfig] = useState({
    officeAddress: "",
    gstin: "",
    companyName: "",
    companyAddress: "",
    contactNumbers: "",
    email: ""
  });

  // Load config from public file
  useEffect(() => {
    fetch('/appconfig.json')
      .then(response => response.json())
      .then(data => setConfig(data))
      .catch(error => {
        console.error("Error loading config:", error);
        // Fallback values if config fails to load
        setConfig({
          officeAddress: "A-1, Sector-59, Noida-201301",
          gstin: "09AAICE2056P1Z5",
          companyName: "E-KORS PRIVATE LIMITED",
          companyAddress: "PLOT NO.-02, Sector-115, NOIDA, Gautam Buddha Nagar, Uttar Pradesh, 201307",
          contactNumbers: "9711725989 / 9897022545",
          email: "sales@ekors.in"
        });
      });
  }, []);
};

// Helper function to get parts of an address
const getAddressPart = (address, part) => {
  if (!address) return " " ;
  if (Array.isArray(address)) {
    switch (part) {
      case "address1":
        return address[0] || " ";
      case "address2":
        return address[1] || " " ;
      case "city":
        return address[3] || " ";
      case "state":
        return address[2] || " ";
      case "pincode":
        return address[4] || " ";
      default:
        return " ";
    }
  } else if (typeof address === "object" && address !== null) {
    switch (part) {
      case "address1":
        return address.address1 || " ";
      case "address2":
        return address.address2 || " " ;
      case "city":
        return address.city || " ";
      case "state":
        return address.state || " ";
      case "pincode":
        return address.pincode || " ";
      default:
        return " ";
    }
  }
  return part === "address2" ? " "  : " ";
};

const toWords = (num) => {
  const a = [
    " " ,
    "one ",
    "two ",
    "three ",
    "four ",
    "five ",
    "six ",
    "seven ",
    "eight ",
    "nine ",
    "ten ",
    "eleven ",
    "twelve ",
    "thirteen ",
    "fourteen ",
    "fifteen ",
    "sixteen ",
    "seventeen ",
    "eighteen ",
    "nineteen ",
  ];
  const b = [
    " " ,
    " " ,
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
  ];
  const s = num.toString();
  if (s.length > 9) return "overflow";
  const n = ("000000000" + s)
    .substring(-9)
    .match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return " " ;
  let str = " " ;
  str +=
    n[1] != 0
      ? (a[Number(n[1])] || b[n[1][0]] + " " + a[n[1][1]]) + "crore "
      : " " ;
  str +=
    n[2] != 0
      ? (a[Number(n[2])] || b[n[2][0]] + " " + a[n[2][1]]) + "lakh "
      : " " ;
  str +=
    n[3] != 0
      ? (a[Number(n[3])] || b[n[3][0]] + " " + a[n[3][1]]) + "thousand "
      : " " ;
  str +=
    n[4] != 0
      ? (a[Number(n[4])] || b[n[4][0]] + " " + a[n[4][1]]) + "hundred "
      : " " ;
  str +=
    n[5] != 0
      ? (str != " "  ? "and " : " " ) +
        (a[Number(n[5])] || b[n[5][0]] + " " + a[n[5][1]])
      : " " ;
  return str.trim() === " "  ? "zero" : str.trim() + " only";
};

const PIPDF = ({ ticketData }) => {
  // This component now expects ticketData to be provided by its parent.
  // It does not handle fetching, loading states, or errors related to fetching.
  // The parent component is responsible for fetching the data and handling its loading/error states.

  // If ticketData is not provided, render a simple message.
  // This indicates an issue in the component using PIPDF.
  if (!ticketData) {
    // You might want a more specific message or handle this in the parent
    return <Document><Page size="A4" style={styles.page}><View style={{textAlign: "center", marginTop: 50}}><Text>Loading PI data...</Text></View></Page></Document>;
  }

  const ticket = ticketData; // Use the provided data directly

  // Basic check for essential data structure within the provided ticketData
  if (!ticket || !ticket.goods || !ticket.billingAddress) {
     return <Document><Page size="A4" style={styles.page}><View style={{textAlign: "center", marginTop: 50}}><Text>Error: Incomplete ticket data provided for PI.</Text></View></Page></Document>;
  }

  const clientPhone = ticket.clientPhone || " ";
  const clientGstNumber = ticket.clientGstNumber || " ";

  const billingAddress1 = getAddressPart(ticket.billingAddress, "address1");
  const billingAddress2 = getAddressPart(ticket.billingAddress, "address2");
  const billingCity = getAddressPart(ticket.billingAddress, "city");
  const billingState = getAddressPart(ticket.billingAddress, "state");
  const billingPincode = getAddressPart(ticket.billingAddress, "pincode");

  const shippingAddress1 = getAddressPart(ticket.shippingAddress, "address1");
  const shippingAddress2 = getAddressPart(ticket.shippingAddress, "address2");
  const shippingCity = getAddressPart(ticket.shippingAddress, "city");
  const shippingState = getAddressPart(ticket.shippingAddress, "state");
  const shippingPincode = getAddressPart(ticket.shippingAddress, "pincode");

  const fullBillingAddress = `${billingAddress1}${
    billingAddress2 ? `, ${billingAddress2}` : " " 
  }`;
  const fullShippingAddress = `${shippingAddress1}${
    shippingAddress2 ? `, ${shippingAddress2}` : " " 
  }`;

  const formatCityStatePin = (city, state, pincode) => {
    let parts = [city, state].filter(Boolean); // Filter out empty strings
    let mainPart = parts.join(", ");
    if (pincode) {
      return mainPart ? `${mainPart} - ${pincode}` : pincode;
    }
    return mainPart;
  };

  const billingCityStatePin = formatCityStatePin(
    billingCity,
    billingState,
    billingPincode
  );
  const shippingCityStatePin = formatCityStatePin(
    shippingCity,
    shippingState,
    shippingPincode
  );
  const displayGrandTotal =
    ticket.finalRoundedAmount !== null &&
    ticket.finalRoundedAmount !== undefined
      ? ticket.finalRoundedAmount
      : ticket.grandTotal;
  
  const company = getCompanyInfo();    
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Image style={styles.logo} src="/logo.png" /> 

        <View style={styles.headerSection}>
          <Text style={styles.gstinHeader}>GSTIN: {config.company.gstin}</Text>
          <Text style={styles.companyNameHeader}>{config.company.companyName}</Text>
          <Text style={styles.companyAddressHeader}>
            {config.company.addresses.companyAddress}
          </Text>
        </View>

        <Text style={styles.invoiceTitle}>PERFORMA INVOICE</Text>

        <View style={styles.metaInfoContainer}>
          <Text>PI No.: {ticket.ticketNumber || ticket.quotationNumber}</Text>
          <Text>
            Date:{" "}
            {new Date(ticket.createdAt || Date.now()).toLocaleDateString(
              "en-GB"
            )}
          </Text>
        </View>
        {/* <View style={styles.metaInfoContainer}>
        <Text>PI Number: {ticket.quotationNumber}</Text>
        <Text>Validity: {ticket.validityDate ? new Date(ticket.validityDate).toLocaleDateString('en-GB') : 'N/A'}</Text>
      </View> */}
        <View style={styles.metaInfoContainer}>
          <Text>
            Dispatch Through: {ticket.dispatchThrough || "As per discussion"}
          </Text>
          <Text>
            Dispatch Days: {ticket.dispatchDays || "7-10 working days"}
          </Text>
        </View>

        <View style={styles.addressTable}>
          <View style={styles.addressRow}>
            <Text style={styles.addressTableHeader}>Details</Text>
            <Text style={styles.addressTableHeaderData}>Billing Address</Text>
            <Text
              style={[styles.addressTableHeaderData, { borderRightWidth: 0 }]}
            >
              Shipping Address
            </Text>
          </View>
          <View style={styles.addressRow}>
            <Text style={styles.addressCellHeaderLabel}>Party Name:</Text>
            <Text style={styles.addressCellData}>
              {ticket.client?.companyName || ticket.companyName || " "}
            </Text>
            <Text style={styles.addressCellDataLast}>
              {ticket.client?.companyName || ticket.companyName || " "}
            </Text>
          </View>
          <View style={styles.addressRow}>
            <Text style={styles.addressCellHeaderLabel}>Address:</Text>
            <Text style={styles.addressCellData}>{fullBillingAddress}</Text>
            <Text style={styles.addressCellDataLast}>
              {fullShippingAddress}
            </Text>
          </View>
          <View style={styles.addressRow}>
            <Text style={styles.addressCellHeaderLabel}>City/State/Pin:</Text>
            <Text style={styles.addressCellData}>{billingCityStatePin}</Text>
            <Text style={styles.addressCellDataLast}>
              {shippingCityStatePin}
            </Text>
          </View>
          <View style={styles.addressRow}>
            <Text style={styles.addressCellHeaderLabel}>State:</Text>
            <Text style={styles.addressCellData}>{billingState}</Text>
            <Text style={styles.addressCellDataLast}>{shippingState}</Text>
          </View>
          <View style={styles.addressRow}>
            <Text style={[styles.addressCellHeader, styles.bold]}>
              GSTIN / UIN:
            </Text>
            {/* <Text style={styles.addressCell}>{clientGstNumber}</Text> */}
            <Text style={[styles.addressCell, { borderRightWidth: 0 }]}>
              {clientGstNumber}
            </Text>
          </View>
          <View style={[styles.addressRow, { borderBottomWidth: 0 }]}>
            <Text style={[styles.addressCellHeader, styles.bold]}>
              Contact No.:
            </Text>
            {/* <Text style={styles.addressCell}>{clientPhone}</Text> */}
            <Text style={[styles.addressCell, { borderRightWidth: 0 }]}>
              {clientPhone}
            </Text>
          </View>
        </View>

        <View style={styles.goodsTable}>
          <View style={styles.goodsTableHeader}>
            <Text style={[styles.goodsCell, styles.colSrNo]}>S.N.</Text>
            <Text
              style={[
                styles.goodsCell,
                styles.colDescription,
                styles.goodsCellDescription,
              ]}
            >
              Description of Goods
            </Text>
            <Text style={[styles.goodsCell, styles.colHSN]}>HSN/SAC</Text>
            <Text style={[styles.goodsCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.goodsCell, styles.colUnit]}>Unit</Text>
            <Text style={[styles.goodsCell, styles.colRate]}>Rate (₹)</Text>
            <Text style={[styles.goodsCell, styles.colAmount]}>Amount (₹)</Text>
          </View>
          {(ticket.goods || []).map((item, i) => (
            <View style={styles.goodsTableRow} key={item._id || i}>
              <Text style={[styles.goodsCell, styles.colSrNo]}>
                {item.srNo || i + 1}
              </Text>
              <View
                style={[
                  styles.goodsCell,
                  styles.colDescription,
                  styles.goodsCellDescription,
                ]}
              >
                <Text>{item.description}</Text>
                {(item.subtexts || []).map((sub, subIndex) => (
                  <Text
                    key={subIndex}
                    style={{ fontSize: 7, fontStyle: "italic", marginLeft: 5 }}
                  >
                    - {sub}
                  </Text>
                ))}
              </View>
              <Text style={[styles.goodsCell, styles.colHSN]}>
                {item.hsnSacCode}
              </Text>
              <Text style={[styles.goodsCell, styles.colQty]}>
                {item.quantity}
              </Text>
              <Text style={[styles.goodsCell, styles.colUnit]}>
                {item.unit || "Nos"}
              </Text>
              <Text style={[styles.goodsCell, styles.colRate]}>
                {(item.price || 0).toFixed(2)}
              </Text>
              <Text style={[styles.goodsCell, styles.colAmount]}>
                {(item.amount || 0).toFixed(2)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.summarySection}>
          <View style={styles.summaryContainer}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal (Before Tax):</Text>
              <Text style={styles.summaryValue}>
                ₹{(ticket.totalAmount || 0).toFixed(2)}
              </Text>
            </View>
            {/* Dynamically add CGST, SGST, IGST based on breakdown */}
            {ticket.isBillingStateSameAsCompany ? (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total CGST:</Text>
                  <Text style={styles.summaryValue}>
                    ₹{(ticket.totalCgstAmount || 0).toFixed(2)}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total SGST:</Text>
                  <Text style={styles.summaryValue}>
                    ₹{(ticket.totalSgstAmount || 0).toFixed(2)}
                  </Text>
                </View>
              </>
            ) : (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total IGST:</Text>
                <Text style={styles.summaryValue}>
                  ₹{(ticket.totalIgstAmount || 0).toFixed(2)}
                </Text>
              </View>
            )}
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, styles.bold]}>
                Total Tax Amount:
              </Text>
              <Text style={styles.summaryValue}>
                ₹{(ticket.finalGstAmount || 0).toFixed(2)}
              </Text>
            </View>
            {ticket.roundOff !== undefined && ticket.roundOff !== 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Round Off:</Text>
                <Text style={styles.summaryValue}>
                  ₹{(ticket.roundOff || 0).toFixed(2)}
                </Text>
              </View>
            )}
            <View style={styles.grandTotalRow}>
              <Text>
                {ticket.roundOff !== undefined && ticket.roundOff !== 0
                  ? "Final Amount:"
                  : "Grand Total:"}
              </Text>
              <Text>₹{(displayGrandTotal || 0).toFixed(2)}</Text>{" "}
            </View>
          </View>
        </View>

        <Text style={styles.amountInWords}>
          Amount in Words: {toWords(Math.round(displayGrandTotal || 0))}
        </Text>

        {/* Tax Breakdown Table */}
        <View style={styles.taxBreakdownTable}>
          <View style={styles.taxBreakdownHeader}>
            <Text style={[styles.taxBreakdownCell, styles.taxColDescription]}>
              Description (GST @)
            </Text>
            <Text style={[styles.taxBreakdownCell, styles.taxColTaxableValue]}>
              Taxable Value (₹)
            </Text>
            {ticket.isBillingStateSameAsCompany ? (
              <>
                <Text style={[styles.taxBreakdownCell, styles.taxColCGSTRate]}>
                  CGST Rate
                </Text>
                <Text
                  style={[styles.taxBreakdownCell, styles.taxColCGSTAmount]}
                >
                  CGST Amt (₹)
                </Text>
                <Text style={[styles.taxBreakdownCell, styles.taxColSGSTRate]}>
                  SGST Rate
                </Text>
                <Text
                  style={[styles.taxBreakdownCell, styles.taxColSGSTAmount]}
                >
                  SGST Amt (₹)
                </Text>
              </>
            ) : (
              <>
                <Text style={[styles.taxBreakdownCell, styles.taxColIGSTRate]}>
                  IGST Rate
                </Text>
                <Text
                  style={[styles.taxBreakdownCell, styles.taxColIGSTAmount]}
                >
                  IGST Amt (₹)
                </Text>
              </>
            )}
            <Text style={[styles.taxBreakdownCell, styles.taxColTotalTax]}>
              Total Tax (₹)
            </Text>
          </View>
          {(ticket.gstBreakdown || []).map((group, index) => (
            <View style={styles.taxBreakdownRow} key={`tax_group_${index}`}>
              <Text
                style={[styles.taxBreakdownCell, styles.taxColDescription]}
              >{`Goods @ ${group.itemGstRate.toFixed(2)}%`}</Text>
              <Text
                style={[styles.taxBreakdownCell, styles.taxColTaxableValue]}
              >
                {(group.taxableAmount || 0).toFixed(2)}
              </Text>
              {ticket.isBillingStateSameAsCompany ? (
                <>
                  <Text
                    style={[styles.taxBreakdownCell, styles.taxColCGSTRate]}
                  >{`${(group.cgstRate || 0).toFixed(2)}%`}</Text>
                  <Text
                    style={[styles.taxBreakdownCell, styles.taxColCGSTAmount]}
                  >
                    {(group.cgstAmount || 0).toFixed(2)}
                  </Text>
                  <Text
                    style={[styles.taxBreakdownCell, styles.taxColSGSTRate]}
                  >{`${(group.sgstRate || 0).toFixed(2)}%`}</Text>
                  <Text
                    style={[styles.taxBreakdownCell, styles.taxColSGSTAmount]}
                  >
                    {(group.sgstAmount || 0).toFixed(2)}
                  </Text>
                </>
              ) : (
                <>
                  <Text
                    style={[styles.taxBreakdownCell, styles.taxColIGSTRate]}
                  >{`${(group.igstRate || 0).toFixed(2)}%`}</Text>
                  <Text
                    style={[styles.taxBreakdownCell, styles.taxColIGSTAmount]}
                  >
                    {(group.igstAmount || 0).toFixed(2)}
                  </Text>
                </>
              )}
              <Text style={[styles.taxBreakdownCell, styles.taxColTotalTax]}>
                {(
                  (group.cgstAmount || 0) +
                  (group.sgstAmount || 0) +
                  (group.igstAmount || 0)
                ).toFixed(2)}
              </Text>
            </View>
          ))}
          {/* Total Row for Tax Breakdown */}
          <View
            style={[
              styles.taxBreakdownRow,
              styles.bold,
              { backgroundColor: "#f0f0f0" },
            ]}
          >
            <Text style={[styles.taxBreakdownCell, styles.taxColDescription]}>
              Total
            </Text>
            <Text style={[styles.taxBreakdownCell, styles.taxColTaxableValue]}>
              {(ticket.totalAmount || 0).toFixed(2)}
            </Text>
            {ticket.isBillingStateSameAsCompany ? (
              <>
                <Text
                  style={[styles.taxBreakdownCell, styles.taxColCGSTRate]}
                ></Text>
                <Text
                  style={[styles.taxBreakdownCell, styles.taxColCGSTAmount]}
                >
                  {(ticket.totalCgstAmount || 0).toFixed(2)}
                </Text>
                <Text
                  style={[styles.taxBreakdownCell, styles.taxColSGSTRate]}
                ></Text>
                <Text
                  style={[styles.taxBreakdownCell, styles.taxColSGSTAmount]}
                >
                  {(ticket.totalSgstAmount || 0).toFixed(2)}
                </Text>
              </>
            ) : (
              <>
                <Text
                  style={[styles.taxBreakdownCell, styles.taxColIGSTRate]}
                ></Text>
                <Text
                  style={[styles.taxBreakdownCell, styles.taxColIGSTAmount]}
                >
                  {(ticket.totalIgstAmount || 0).toFixed(2)}
                </Text>
              </>
            )}
            <Text style={[styles.taxBreakdownCell, styles.taxColTotalTax]}>
              {(ticket.finalGstAmount || 0).toFixed(2)}
            </Text>
          </View>
        </View>

        <View style={styles.termsConditions}>
          <Text style={styles.bold}>Terms & Conditions:</Text>
          {(
            ticket.termsAndConditions ||
            "1. Goods once sold will not be taken back.\n2. Interest @18% p.a. will be charged if payment is not made within the stipulated time.\n3. Subject to Noida jurisdiction."
          )
            .split("\n")
            .map((term, i) => (
              <Text key={i}>- {term}</Text>
            ))}
        </View>

        <View style={styles.bankDetails}>
          <Text style={styles.bold}>Bank Details:</Text>
          <Text>Bank: ICICI Bank</Text>
          <Text>Account No.: 628906029990</Text>
          <Text>IFSC Code: ICIC0006284</Text>
          <Text>Branch: Sector 62, Noida</Text>
        </View>

        <View style={styles.footer}>
          {/* <Text>This is a computer-generated Performa Invoice.</Text> */}
          <View style={styles.authSignatory}>
            <Text style={styles.companyNameHeader}> For {config.company.companyName}</Text>
            <View style={{ height: 30 }} /> {/* Spacer for signature */}
            <Text>Authorized Signatory</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
// Memoize the component for performance if ticketData doesn't change frequently
export default PIPDF;
