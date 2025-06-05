import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontFamily: "Helvetica",
    fontSize: 11,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  logo: {
    width: 80,
    height: "auto",
    marginBottom: 10,
  },
  header: {
    fontSize: 12,
    textAlign: "center",
    marginBottom: 4,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  subHeader: {
    fontSize: 10,
    textAlign: "center",
    marginBottom: 10,
  },
  invoiceTitle: {
    textAlign: "center",
    textDecoration: "underline",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 6,
  },
  col: {
    width: "48%",
  },
  bold: {
    fontWeight: "bold",
  },
  tableHeader: {
    flexDirection: "row",
    borderBottom: "1px solid #000",
    paddingBottom: 5,
    marginTop: 15,
    width: "100%",
  },
  cell: {
    borderRight: "1px solid #000",
    padding: 3,
    textAlign: "center",
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1px solid #eee",
    paddingVertical: 5,
    width: "100%",
  },
  bankDetails: {
    marginTop: 15,
    borderTop: "1px solid #000",
    paddingTop: 10,
    width: "100%",
    alignItems: "center",
  },
  fullWidthText: {
    textAlign: "center",
    width: "100%",
    marginTop: 6,
  },
  termsSection: {
    marginTop: 15,
    paddingTop: 10,
    width: "100%",
  },
});

const toWords = (num) => {
  if (num === 0) return "Zero";

  const a = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const g = ["", "Thousand", "Lakh", "Crore"];

  const floatPart = Math.round((num - Math.floor(num)) * 100);
  num = Math.floor(num);

  let str = "";
  let i = 0;

  const convertChunk = (n) => {
    let s = "";
    if (n > 99) {
      s += a[Math.floor(n / 100)] + " Hundred ";
      n %= 100;
    }
    if (n > 19) {
      s += b[Math.floor(n / 10)] + " " + a[n % 10];
    } else {
      s += a[n];
    }
    return s.trim();
  };

  while (num > 0) {
    const chunk = i === 0 ? num % 1000 : num % 100;
    if (chunk !== 0) {
      str = convertChunk(chunk) + (g[i] ? " " + g[i] : "") + " " + str;
    }
    num = i === 0 ? Math.floor(num / 1000) : Math.floor(num / 100);
    i++;
  }

  return (
    str.trim() +
    (floatPart > 0 ? " and " + convertChunk(floatPart) + " Paise" : "") +
    " Only"
  );
};

const getAddressPart = (address, part) => {
  if (!address) return part === "address2" ? "" : "N/A";
  if (Array.isArray(address)) {
    switch (part) {
      case "address1":
        return address[0] || "N/A";
      case "address2":
        return address[1] || "";
      case "city":
        return address[3] || "N/A";
      case "state":
        return address[2] || "N/A";
      case "pincode":
        return address[4] || "N/A";
      default:
        return "N/A";
    }
  } else if (typeof address === "object") {
    switch (part) {
      case "address1":
        return address.address1 || "N/A";
      case "address2":
        return address.address2 || "";
      case "city":
        return address.city || "N/A";
      case "state":
        return address.state || "N/A";
      case "pincode":
        return address.pincode || "N/A";
      default:
        return "N/A";
    }
  }
  return part === "address2" ? "" : "N/A";
};

const PIPDF = ({ ticket }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Image style={styles.logo} src="/src/assets/logo.png" />
      <Text style={styles.header}>GSTIN : 09AAFCE8706R1ZV</Text>
      <Text style={styles.companyName}>E-KORS PRIVATE LIMITED</Text>
      <Text style={styles.subHeader}>
        PLOT NO.-02, Sector-115, NOIDA{"\n"}Gautam Buddha Nagar, Uttar Pradesh,
        201307
      </Text>
      <Text style={styles.invoiceTitle}>PERFORMA INVOICE</Text>

      <View style={[styles.row, { justifyContent: "center", gap: 40 }]}>
        <Text>Quotation No.: {ticket.quotationNumber}</Text>
        <Text>Date: {new Date(ticket.createdAt).toLocaleDateString()}</Text>
      </View>

      <View style={[styles.row, { gap: 20 }]}>
        <View style={styles.col}>
          <Text style={styles.bold}>Quotation to:</Text>
          <Text>{ticket.companyName}</Text>
          <Text>{getAddressPart(ticket.billingAddress, "address1")}</Text>
          <Text>{getAddressPart(ticket.billingAddress, "address2")}</Text>
          <Text>
            {getAddressPart(ticket.billingAddress, "city")},{" "}
            {getAddressPart(ticket.billingAddress, "state")} -{" "}
            {getAddressPart(ticket.billingAddress, "pincode")}
          </Text>
          <Text>
            Party Mobile No:{" "}
            {ticket.clientPhone || ticket.client?.phone || "N/A"}
          </Text>
          <Text>State: {getAddressPart(ticket.billingAddress, "state")}</Text>
          <Text>
            GSTIN / UIN:{" "}
            {ticket.clientGstNumber || ticket.client?.gstNumber || "N/A"}
          </Text>{" "}
        </View>
        <View style={styles.col}>
          <Text style={styles.bold}>Shipped to:</Text>
          <Text>{ticket.companyName}</Text>
          <Text>{getAddressPart(ticket.shippingAddress, "address1")}</Text>
          <Text>{getAddressPart(ticket.shippingAddress, "address2")}</Text>
          <Text>
            {getAddressPart(ticket.shippingAddress, "city")},{" "}
            {getAddressPart(ticket.shippingAddress, "state")} -{" "}
            {getAddressPart(ticket.shippingAddress, "pincode")}
          </Text>
          <Text>
            Party Mobile No:{" "}
            {ticket.clientPhone || ticket.client?.phone || "N/A"}
          </Text>
          <Text>State: {getAddressPart(ticket.shippingAddress, "state")}</Text>
          <Text>
            GSTIN / UIN:{" "}
            {ticket.clientGstNumber || ticket.client?.gstNumber || "N/A"}
          </Text>{" "}
        </View>
      </View>

      <View style={styles.tableHeader}>
        <Text style={[styles.cell, { width: "5%" }]}>S.N.</Text>
        <Text style={[styles.cell, { width: "35%", textAlign: "left" }]}>
          Description of Goods
        </Text>
        <Text style={[styles.cell, { width: "15%" }]}>HSN/SAC</Text>
        <Text style={[styles.cell, { width: "10%" }]}>Qty.</Text>
        <Text style={[styles.cell, { width: "8%" }]}>Unit</Text>
        <Text style={[styles.cell, { width: "7%" }]}>GST%</Text>
        <Text style={[styles.cell, { width: "10%" }]}>Rate</Text>
        <Text style={[styles.cell, { width: "15%", borderRight: 0 }]}>
          Amount
        </Text>
      </View>

      {ticket.goods.map((item, i) => (
        <View style={styles.tableRow} key={i}>
          <Text style={[styles.cell, { width: "5%" }]}>{i + 1}</Text>
          <Text style={[styles.cell, { width: "35%", textAlign: "left" }]}>
            {item.description}
          </Text>
          <Text style={[styles.cell, { width: "15%" }]}>{item.hsnSacCode}</Text>
          <Text style={[styles.cell, { width: "10%" }]}>{item.quantity}</Text>
          <Text style={[styles.cell, { width: "8%" }]}>
            {item.unit || "PCS"}
          </Text>
          <Text style={[styles.cell, { width: "7%" }]}>
            {item.gstRate ? `${item.gstRate.toFixed(1)}%` : "0%"}
          </Text>
          <Text style={[styles.cell, { width: "10%" }]}>
            {item.price.toFixed(2)}
          </Text>
          <Text style={[styles.cell, { width: "15%", borderRight: 0 }]}>
            {item.amount.toFixed(2)}
          </Text>
        </View>
      ))}

      <Text style={styles.fullWidthText}>Add : GST @ 18.00%</Text>
      <Text style={[styles.fullWidthText, { fontWeight: "bold" }]}>
        Grand Total : ₹{ticket.grandTotal.toFixed(2)}
      </Text>
      <Text style={styles.fullWidthText}>
        Taxable Rate Total = Sub Total Amt. + Total Tax.
      </Text>
      <Text style={styles.fullWidthText}>
        Amount in Words: Rupees{" "}
        {ticket.grandTotal ? toWords(ticket.grandTotal) : "Zero Only"}
      </Text>

      {ticket.termsAndConditions && (
        <View style={styles.termsSection}>
          <Text style={{ fontWeight: "bold" }}>Terms & Conditions:</Text>
          <Text style={{ fontSize: 9 }}>{ticket.termsAndConditions}</Text>
        </View>
      )}

      <View style={styles.bankDetails}>
        <Text style={{ fontWeight: "bold", textAlign: "center" }}>
          Bank Details:
        </Text>
        <Text style={{ textAlign: "center" }}>
          Bank: ICICI Bank{"\n"}Account No.: 628906029990, IFSC CODE:
          ICIC0006284
        </Text>
      </View>

      <Text style={[styles.fullWidthText, { marginTop: 20 }]}>
        for E-KORS PRIVATE LIMITED{"\n"}Authorized Signatory
      </Text>
    </Page>
  </Document>
);

export default PIPDF;
