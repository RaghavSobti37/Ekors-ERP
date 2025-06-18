import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell, WidthType } from "docx";

export const generateQuotationDocx = (quotation) => {
  // Create document
  const doc = new Document({
    sections: [{
      properties: {},
      children: [
        // Header with reference and date
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({
              text: `Ref: ${quotation.referenceNumber}`,
              bold: true,
              color: "FF0000" // Red color
            }),
            new TextRun({
              text: "\nDate: " + new Date(quotation.date).toLocaleDateString(),
              break: 1
            })
          ]
        }),

        // Company header
        new Paragraph({
          text: "To,",
          spacing: { after: 100 }
        }),
        new Paragraph({
          text: quotation.client.companyName,
          spacing: { after: 100 }
        }),
        new Paragraph({
          text: "Site: " + (quotation.client.siteLocation || ""),
          spacing: { after: 300 }
        }),

        // Title
        new Paragraph({
          text: "Sub: Quotation for Earthing Material and Installation",
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { after: 300 }
        }),

        // Salutation
        new Paragraph({
          text: "Dear Sir,",
          spacing: { after: 200 }
        }),

        // Body text
        new Paragraph({
          children: [
            new TextRun("Thanks for your enquiry of "),
            new TextRun({
              text: "Earthing Items",
              italics: true
            }),
            new TextRun(". As per your requirement here we are giving you, our prices. Kindly view it.")
          ],
          spacing: { after: 300 }
        }),

        // Table title
        new Paragraph({
          text: "Supply & Installation",
          heading: HeadingLevel.HEADING_2,
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 }
        }),

        // Create table for items
        createItemsTable(quotation.goods),

        // Total row
        new Paragraph({
          text: `Total: ₹${quotation.totalAmount.toFixed(2)}`,
          alignment: AlignmentType.RIGHT,
          spacing: { before: 200, after: 400 }
        }),

        // Terms and conditions
        new Paragraph({
          text: "Terms & Conditions:",
          spacing: { after: 100 }
        }),
        ...createTermsAndConditions(quotation),

        // Footer
        new Paragraph({
          text: "Hoping for your valuable order in the earliest.",
          alignment: AlignmentType.CENTER,
          color: "FF0000",
          bold: true,
          spacing: { before: 400, after: 100 }
        }),
        new Paragraph({
          text: "E-KORS PRIVATE LIMITED",
          alignment: AlignmentType.CENTER,
          color: "FF0000",
          bold: true,
          spacing: { after: 300 }
        }),

        // Contact info
        new Paragraph({
          text: "Com Add: Pole No. 02, Sector 115 Noida - 201307",
          alignment: AlignmentType.CENTER,
          spacing: { after: 50 }
        }),
        new Paragraph({
          text: "Ph. No. 9711725989 / 9897022545",
          alignment: AlignmentType.CENTER,
          spacing: { after: 50 }
        }),
        new Paragraph({
          text: "Email: sales@ekors.in",
          alignment: AlignmentType.CENTER
        })
      ]
    }]
  });

  return doc;
};

function createItemsTable(goods) {
  // Table header
  const headerRow = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph("S.No")], width: { size: 8, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph("Item description")], width: { size: 42, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph("Unit")], width: { size: 10, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph("Qty")], width: { size: 10, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph("Rate")], width: { size: 15, type: WidthType.PERCENTAGE } }),
      new TableCell({ children: [new Paragraph("Amount")], width: { size: 15, type: WidthType.PERCENTAGE } })
    ]
  });

  // Table rows for items
  const itemRows = goods.map((item, index) => {
    const descriptionChildren = [
      new Paragraph(item.description)
    ];
    
    // Add subtexts if they exist
    if (item.subtexts && item.subtexts.length > 0) {
      item.subtexts.forEach(subtext => {
        descriptionChildren.push(
          new Paragraph({
            text: `- ${subtext}`,
            italics: true,
            color: "555555",
            indent: { left: 200 }
          })
        );
      });
    }

    return new TableRow({
      children: [
        new TableCell({ children: [new Paragraph((index + 1).toString())] }),
        new TableCell({ children: descriptionChildren }),
        new TableCell({ children: [new Paragraph(item.unit)] }),
        new TableCell({ children: [new Paragraph(item.quantity.toString())] }),
        new TableCell({ children: [new Paragraph(`₹${item.price.toFixed(2)}`)] }),
        new TableCell({ children: [new Paragraph(`₹${item.amount.toFixed(2)}`)] })
      ]
    });
  });

  return new Table({
    rows: [headerRow, ...itemRows],
    width: { size: 100, type: WidthType.PERCENTAGE }
  });
}

function createTermsAndConditions(quotation) {
  return [
    new Paragraph("- Material Ex-Factory Noida"),
    new Paragraph("- GST: 18% is applicable"),
    new Paragraph("- Freight: Extra as applicable"),
    new Paragraph("- Packing: Extra if applicable"),
    new Paragraph("- Payment: 100% in advance after receiving Formal PO and Advance"),
    new Paragraph(`- Dispatch: Within ${quotation.dispatchDays || "X"} days after receiving payment`),
    new Paragraph(`- Validity: This quotation is valid till ${new Date(quotation.validityDate).toLocaleDateString()}`),
    new Paragraph("- Order: Order to be placed in the name of \"E-KORS PVT LTD\"")
  ];
}