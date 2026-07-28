import { generateProductionReportPDF } from './backend/renderer.js';

async function test() {
  try {
    console.log("Starting PDF generation test...");
    const pdfBuffer = await generateProductionReportPDF(
      "گزارش تست",
      "1402/01/01",
      "1402/01/01",
      [],
      { qty_61: 10, qty_67: 0, qty_79: 0, qty_73: 0, grandTotal: 10 },
      { waste_61: 1, waste_67: 0, waste_79: 0, waste_73: 0, totalWaste: 1, pct_61: 10, pct_67: 0, pct_79: 0, pct_73: 0, totalPct: 10, details: "تست" }
    );
    console.log("PDF generated successfully! Size:", pdfBuffer.length, "bytes");
  } catch(e) {
    console.error("PDF generation error:", e);
  }
}
test();
