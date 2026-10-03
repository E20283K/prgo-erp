import type { LucideIcon } from "lucide-react";
import { FileText, FileSpreadsheet, FileType2, FileImage, File as FileIcon } from "lucide-react";

/** Minimal attachment shape shared by Client Order & Work Order documents. */
export interface ViewableFile {
  id: string;
  name: string;
  size: string;
  type: string;
  date: string;
  isImage?: boolean;
  url?: string;
}

export type FileKind = "pdf" | "xlsx" | "docx" | "image" | "other";

const EXT_MAP: Record<string, FileKind> = {
  pdf: "pdf",
  xlsx: "xlsx",
  xlsm: "xlsx",
  docx: "docx",
  doc: "docx",
  odt: "docx",
  rtf: "docx",
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
};

export function getFileExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : "";
}

export function getFileKind(file: Pick<ViewableFile, "name" | "isImage">): FileKind {
  if (file.isImage) return "image";
  return EXT_MAP[getFileExtension(file.name)] ?? "other";
}

/** Rendering engine used for each previewable file kind. */
export const FILE_KIND_ENGINE: Record<FileKind, string | null> = {
  pdf: "PDF.js",
  xlsx: "Univer",
  docx: "ONLYOFFICE Docs",
  image: null,
  other: null,
};

export const FILE_KIND_ICON: Record<FileKind, { icon: LucideIcon; className: string }> = {
  pdf: { icon: FileText, className: "text-red-600 dark:text-red-400" },
  xlsx: { icon: FileSpreadsheet, className: "text-emerald-600 dark:text-emerald-400" },
  docx: { icon: FileType2, className: "text-blue-600 dark:text-blue-400" },
  image: { icon: FileImage, className: "text-amber-600 dark:text-amber-400" },
  other: { icon: FileIcon, className: "text-muted-foreground" },
};

export function isPreviewable(file: Pick<ViewableFile, "name" | "isImage" | "url">): boolean {
  return !!file.url && getFileKind(file) !== "other";
}

export function downloadFile(file: Pick<ViewableFile, "name" | "url">) {
  if (!file.url) return;
  const link = document.createElement("a");
  link.href = file.url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/** Builds an attachment entry (with a blob URL for previewing) from a browser File. */
export function fileToAttachment(f: File, idPrefix: string, index: number): ViewableFile {
  return {
    id: `${idPrefix}-${Date.now()}-${index}`,
    name: f.name,
    size: formatFileSize(f.size),
    type: f.type || "Document",
    date: new Date().toISOString().slice(0, 16).replace("T", " "),
    isImage: f.type.startsWith("image/"),
    url: URL.createObjectURL(f),
  };
}

export function releaseAttachment(file: Pick<ViewableFile, "url">) {
  if (file.url?.startsWith("blob:")) URL.revokeObjectURL(file.url);
}

/** Real sample files served from `public/files_example` (copied from `/files_example`). */
const EXAMPLE_BASE = "/files_example/";
const exampleUrl = (name: string) => EXAMPLE_BASE + encodeURIComponent(name);

export const EXAMPLE_ATTACHMENTS: ViewableFile[] = [
  {
    id: "att-1",
    name: "Circle Stickers_Design.pdf",
    size: "403 KB",
    type: "PDF Document",
    date: "2026-09-29 14:15",
    url: exampleUrl("Circle Stickers_Design.pdf"),
  },
  {
    id: "att-2",
    name: "ManRibHenley.xlsx",
    size: "11 KB",
    type: "Excel Spreadsheet",
    date: "2026-09-29 14:22",
    url: exampleUrl("ManRibHenley.xlsx"),
  },
  {
    id: "att-3",
    name: "Amaliy ish.docx",
    size: "395 KB",
    type: "Word Document",
    date: "2026-09-29 15:10",
    url: exampleUrl("Amaliy ish.docx"),
  },
  {
    id: "att-4",
    name: "PrintGoo CMYK Label Logo.png",
    size: "832 KB",
    type: "PNG Image",
    date: "2026-09-29 15:24",
    isImage: true,
    url: exampleUrl("PrintGoo CMYK Label Logo.png"),
  },
];
