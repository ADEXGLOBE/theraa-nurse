// src/features/documents/pdfExtraction.js
import * as pdfjsLib from "pdfjs-dist";

// Vite bundles the PDF.js worker through this URL import.
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const DEFAULT_MAX_PAGES = 150;
const DEFAULT_MAX_CHARACTERS = 250000;

/**
 * Extract readable text from a text-based PDF.
 *
 * Important:
 * - This works for PDFs containing selectable text.
 * - Scanned/image-only PDFs will require OCR in a later upgrade.
 */
export async function extractTextFromPdf(
  file,
  {
    maxPages = DEFAULT_MAX_PAGES,
    maxCharacters = DEFAULT_MAX_CHARACTERS,
  } = {}
) {
  if (!file) {
    throw new Error("No PDF file was provided.");
  }

  const isPdf =
    file.type === "application/pdf" ||
    String(file.name || "").toLowerCase().endsWith(".pdf");

  if (!isPdf) {
    throw new Error("The selected file is not a PDF.");
  }

  const arrayBuffer = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
  });

  const pdf = await loadingTask.promise;
  const pagesToRead = Math.min(pdf.numPages, maxPages);

  const pageTexts = [];
  let totalCharacters = 0;

  for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText) {
      const labelledText = `--- Page ${pageNumber} ---\n${pageText}`;
      pageTexts.push(labelledText);
      totalCharacters += labelledText.length;
    }

    page.cleanup();

    if (totalCharacters >= maxCharacters) {
      break;
    }
  }

  await pdf.destroy();

  let extractedText = pageTexts.join("\n\n").trim();

  if (extractedText.length > maxCharacters) {
    extractedText = extractedText.slice(0, maxCharacters);
  }

  return {
    text: extractedText,
    pageCount: pdf.numPages,
    pagesProcessed: pagesToRead,
    characterCount: extractedText.length,
    extractionStatus: extractedText
      ? "completed"
      : "no-readable-text",
    wasTruncated:
      pdf.numPages > pagesToRead ||
      totalCharacters >= maxCharacters,
  };
}