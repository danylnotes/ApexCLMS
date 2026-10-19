import { apiRoute, csvResponse, pdfResponse } from "@/server/api";
import { cpdStatementPdf, scopedExport, selfExport } from "@/server/services/exports";

export const GET = apiRoute<{ type: string }>(async (req, actor, { type }) => {
  const period = req.nextUrl.searchParams.get("period") ?? undefined;
  if (type === "cpd-statement") {
    const { bytes, filename } = await cpdStatementPdf(actor, period);
    return pdfResponse(filename, bytes);
  }
  const out = type.startsWith("team-") || type.startsWith("org-") ? await scopedExport(actor, type) : await selfExport(actor, type, period);
  return csvResponse(out.filename, out.rows);
});
