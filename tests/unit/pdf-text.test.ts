import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { pdfText, safeStandardFont } from "@/server/pdf-text";

describe("PDF text", () => {
  it("keeps Latin-1 and typographic characters, decomposes compatibility forms and replaces the rest", () => {
    expect(pdfText("H₂S Awareness — José’s “course” €")).toBe("H2S Awareness — José’s “course” €");
    expect(pdfText("مرحبا")).toBe("?????");
  });

  it("lets a standard font draw text it could not encode before", async () => {
    const doc = await PDFDocument.create();
    const font = safeStandardFont(await doc.embedFont(StandardFonts.Helvetica));
    const page = doc.addPage();
    expect(() => page.drawText("H₂S Awareness and Respiratory Protection", { x: 10, y: 10, size: 12, font })).not.toThrow();
    expect(font.widthOfTextAtSize("H₂S", 12)).toBeGreaterThan(0);
  });
});
