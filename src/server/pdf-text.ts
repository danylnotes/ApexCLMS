import type { PDFFont } from "pdf-lib";

/* Characters the standard PDF fonts (WinAnsi encoding) can draw beyond Latin-1. */
const WIN_ANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");
const encodable = (ch: string) => {
  const c = ch.codePointAt(0)!;
  return (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || c === 0x0a || WIN_ANSI_EXTRA.has(ch);
};

/**
 * Makes text drawable with the standard PDF fonts: compatibility forms are decomposed (e.g. "H₂S" → "H2S")
 * and anything still unsupported (such as Arabic script) becomes "?" instead of failing the whole document.
 */
export function pdfText(s: string): string {
  let out = "";
  for (const ch of s) {
    if (encodable(ch)) out += ch;
    else {
      const parts = [...ch.normalize("NFKD")].filter(encodable).join("");
      out += parts || "?";
    }
  }
  return out;
}

/** Wraps a standard font so every string it measures or encodes is made drawable first. */
export function safeStandardFont(font: PDFFont): PDFFont {
  const encode = font.encodeText.bind(font);
  const width = font.widthOfTextAtSize.bind(font);
  font.encodeText = (text: string) => encode(pdfText(text));
  font.widthOfTextAtSize = (text: string, size: number) => width(pdfText(text), size);
  return font;
}
