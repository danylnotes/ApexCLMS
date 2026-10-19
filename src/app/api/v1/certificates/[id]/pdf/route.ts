import { apiRoute, pdfResponse } from "@/server/api";
import { renderCertificatePdf } from "@/server/services/certificates";

export const GET = apiRoute<{ id: string }>(async (_req, actor, { id }) => {
  const { bytes, filename } = await renderCertificatePdf(actor, id);
  return pdfResponse(filename, bytes);
});
