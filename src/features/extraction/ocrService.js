// src/features/extraction/ocrService.js
import Tesseract from "tesseract.js";
import { guessFileKind, renderPdfPagesToImages } from "./textExtractors";

/**
 * OCR for:
 * - Images (png/jpg/etc)
 * - Scanned PDFs (render first N pages to images, then OCR each)
 *
 * Returns: { text, method, confidence }
 */
export async function ocrFileToText(fileBlob, fileType, fileName, opts = {}) {
  const {
    maxPdfPages = 3,
    onProgress = null, // (msg) => void
  } = opts;

  const kind = guessFileKind(fileType, fileName);

  // OCR one image dataURL
  async function ocrImage(dataUrl, label = "") {
    onProgress?.(`OCR running ${label}...`);
    const res = await Tesseract.recognize(dataUrl, "eng");
    const text = (res?.data?.text || "").trim();
    const conf = typeof res?.data?.confidence === "number" ? res.data.confidence : null;
    return { text, conf };
  }

  if (kind === "image") {
    const dataUrl = await blobToDataURL(fileBlob);
    const { text, conf } = await ocrImage(dataUrl, "(image)");
    return { text, method: "ocr-image", confidence: conf };
  }

  if (kind === "pdf") {
    onProgress?.("Rendering PDF pages for OCR...");
    const pageImages = await renderPdfPagesToImages(fileBlob, maxPdfPages);

    let combined = "";
    const confs = [];

    for (let i = 0; i < pageImages.length; i++) {
      const { text, conf } = await ocrImage(pageImages[i], `(page ${i + 1}/${pageImages.length})`);
      if (text) combined += text + "\n\n";
      if (typeof conf === "number") confs.push(conf);
    }

    const avgConf =
      confs.length > 0 ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : null;

    return { text: combined.trim(), method: "ocr-pdf", confidence: avgConf };
  }

  // Unknown type
  return { text: "", method: "ocr-unsupported", confidence: null };
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
