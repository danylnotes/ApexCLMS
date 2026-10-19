import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FilePurpose } from "@prisma/client";
import { prisma } from "./db";
import { invalid } from "./errors";

/**
 * Private file storage. Files live outside the web root and are only ever streamed through
 * /api/v1/files/[id], which authorises each request against the record that references the file.
 * The storage key is random and never exposed as a public URL.
 */

const ALLOWED: Record<string, { ext: string[]; magic?: number[] }> = {
  "application/pdf": { ext: [".pdf"], magic: [0x25, 0x50, 0x44, 0x46] },
  "image/png": { ext: [".png"], magic: [0x89, 0x50, 0x4e, 0x47] },
  "image/jpeg": { ext: [".jpg", ".jpeg"], magic: [0xff, 0xd8, 0xff] },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { ext: [".docx"], magic: [0x50, 0x4b] },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { ext: [".xlsx"], magic: [0x50, 0x4b] },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { ext: [".pptx"], magic: [0x50, 0x4b] },
  "text/plain": { ext: [".txt"] },
  "text/csv": { ext: [".csv"] },
};

export const ALLOWED_UPLOAD_TYPES = Object.keys(ALLOWED);

const root = () => path.resolve(process.env.STORAGE_LOCAL_DIR ?? "./storage");
const maxBytes = () => Number(process.env.MAX_UPLOAD_MB ?? 10) * 1024 * 1024;

export function validateUpload(name: string, mime: string, buf: Buffer) {
  const rule = ALLOWED[mime];
  if (!rule) throw invalid("This file type is not permitted. Upload PDF, image, Office or text documents.");
  const ext = path.extname(name).toLowerCase();
  if (!rule.ext.includes(ext)) throw invalid("The file extension does not match its type.");
  if (buf.length === 0) throw invalid("The file is empty.");
  if (buf.length > maxBytes()) throw invalid(`Files must be smaller than ${process.env.MAX_UPLOAD_MB ?? 10} MB.`);
  if (rule.magic && !rule.magic.every((b, i) => buf[i] === b)) throw invalid("The file content does not match its declared type.");
}

export async function saveFile(file: File, purpose: FilePurpose, uploadedById: string) {
  const buf = Buffer.from(await file.arrayBuffer());
  const safeName = path.basename(file.name).replace(/[^\w.\- ()]/g, "_").slice(0, 160);
  validateUpload(safeName, file.type, buf);
  const now = new Date();
  const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(18).toString("hex")}`;
  const abs = path.join(root(), key);
  await mkdir(path.dirname(abs), { recursive: true });
  await writeFile(abs, buf, { mode: 0o600 });
  return prisma.storedFile.create({
    data: {
      storageKey: key,
      originalName: safeName,
      mimeType: file.type,
      sizeBytes: buf.length,
      sha256: createHash("sha256").update(buf).digest("hex"),
      purpose,
      uploadedById,
    },
  });
}

export async function readStoredFile(storageKey: string): Promise<Buffer> {
  const abs = path.join(root(), storageKey);
  if (!abs.startsWith(root() + path.sep)) throw invalid("Invalid storage key.");
  return readFile(abs);
}

/** Returns the uploaded File from FormData, or null when no file was chosen. */
export function formFile(fd: FormData, field: string): File | null {
  const f = fd.get(field);
  return f instanceof File && f.size > 0 ? f : null;
}
