// src/features/extraction/textExtractors.js
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";

// Vite-friendly worker setup
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export async function extractTextFromDocx(fileBlob) {
  const arrayBuffer = await fileBlob.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return (result.value || "").trim();
}

export async function extractTextFromPdf(fileBlob) {
  const arrayBuffer = await fileBlob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((it) => it.str).filter(Boolean);
    fullText += strings.join(" ") + "\n";
  }

  return fullText.trim();
}

export function guessFileKind(fileType, fileName) {
  const name = (fileName || "").toLowerCase();
  const type = (fileType || "").toLowerCase();

  if (type.includes("word") || name.endsWith(".docx")) return "docx";
  if (type.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (type.includes("text") || name.endsWith(".txt")) return "txt";
  if (type.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(name)) return "image";
  return "unknown";
}

export async function extractTextFromFile(fileBlob, fileType, fileName) {
  const kind = guessFileKind(fileType, fileName);

  if (kind === "docx") return extractTextFromDocx(fileBlob);
  if (kind === "pdf") return extractTextFromPdf(fileBlob);
  if (kind === "txt") {
    const text = await fileBlob.text();
    return (text || "").trim();
  }

  // For Phase 2: we only guarantee docx/pdf/txt here
  return "";
}

/**
 * Phase 2.5 helper:
 * Render the first N pages of a PDF to images (data URLs) for OCR.
 * Keep N small to avoid heavy CPU usage in browser.
 */
export async function renderPdfPagesToImages(fileBlob, maxPages = 3, scale = 1.6) {
  const arrayBuffer = await fileBlob.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const images = [];
  const pageCount = Math.min(pdf.numPages, maxPages);

  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    images.push(canvas.toDataURL("image/png"));
  }

  return images;
}
