import { apiRoute } from "@/server/api";
import { authoriseFile } from "@/server/services/files";
import { readStoredFile } from "@/server/storage";

/** Streams a private file after authorising the request against the records that reference it. */
export const GET = apiRoute<{ id: string }>(async (_req, actor, { id }) => {
  const file = await authoriseFile(actor, id);
  const buf = await readStoredFile(file.storageKey);
  const inline = file.mimeType === "application/pdf" || file.mimeType.startsWith("image/");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(buf.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encodeURIComponent(file.originalName)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
});
