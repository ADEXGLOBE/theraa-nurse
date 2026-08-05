// src/features/documents/documentService.js
import { extractTextFromPdf } from "./pdfExtraction";

const STORAGE_KEY = "theraa_nurse_documents_v1";

const SUPPORTED_TEXT_EXTENSIONS = [
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".html",
  ".htm",
];

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

function uid() {
  return `doc-${Date.now().toString(36)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function loadAllDocuments() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Unable to load participant documents:", error);
    return [];
  }
}

function saveAllDocuments(docs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs || []));
  } catch (error) {
    console.error("Unable to save participant documents:", error);

    throw new Error(
      "The document could not be stored. Browser storage may be full."
    );
  }
}

function getExtension(fileName = "") {
  const normalised = String(fileName).toLowerCase();
  const dotIndex = normalised.lastIndexOf(".");
  return dotIndex >= 0 ? normalised.slice(dotIndex) : "";
}

function isPdfFile(file) {
  return (
    file?.type === "application/pdf" ||
    getExtension(file?.name) === ".pdf"
  );
}

function isSupportedTextFile(file) {
  const extension = getExtension(file?.name);

  return (
    String(file?.type || "").startsWith("text/") ||
    SUPPORTED_TEXT_EXTENSIONS.includes(extension)
  );
}

async function extractTextFromFile(file) {
  if (!file) {
    return {
      text: "",
      pageCount: null,
      pagesProcessed: null,
      characterCount: 0,
      extractionStatus: "manual-entry",
      extractionMessage: "",
      wasTruncated: false,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      "This file is larger than 15 MB. Please upload a smaller file."
    );
  }

  if (isPdfFile(file)) {
    const pdfResult = await extractTextFromPdf(file);

    return {
      ...pdfResult,
      extractionMessage:
        pdfResult.extractionStatus === "completed"
          ? `Extracted text from ${pdfResult.pagesProcessed} PDF page(s).`
          : "No readable text was found. The PDF may contain scanned images and require OCR.",
    };
  }

  if (isSupportedTextFile(file)) {
    const text = await file.text();

    return {
      text,
      pageCount: null,
      pagesProcessed: null,
      characterCount: text.length,
      extractionStatus: text ? "completed" : "no-readable-text",
      extractionMessage: text
        ? "Text file extracted successfully."
        : "No readable text was found in the file.",
      wasTruncated: false,
    };
  }

  throw new Error(
    "This file type is not supported yet. Upload a PDF, TXT, MD, CSV, JSON or HTML file."
  );
}

export async function saveDocumentForClient({
  clientId,
  ownerId,
  title,
  category,
  file,
  textContent,
}) {
  if (!clientId) {
    throw new Error("clientId is required.");
  }

  if (!ownerId) {
    throw new Error("ownerId is required.");
  }

  const manualText = String(textContent || "").trim();

  let extractionResult = {
    text: manualText,
    pageCount: null,
    pagesProcessed: null,
    characterCount: manualText.length,
    extractionStatus: manualText ? "manual-entry" : "pending",
    extractionMessage: manualText
      ? "Manual document text was supplied."
      : "",
    wasTruncated: false,
  };

  /*
   * If a file was selected, extract it.
   *
   * If the user also pasted text, combine the extracted file text
   * and the manually supplied content rather than discarding either.
   */
  if (file) {
    const fileResult = await extractTextFromFile(file);

    const combinedText = [
      fileResult.text,
      manualText
        ? `--- Additional Manual Notes ---\n${manualText}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();

    extractionResult = {
      ...fileResult,
      text: combinedText,
      characterCount: combinedText.length,
    };
  }

  if (!extractionResult.text) {
    throw new Error(
      extractionResult.extractionMessage ||
        "No readable document text was found."
    );
  }

  const now = new Date().toISOString();

  const doc = {
    id: uid(),
    clientId,
    ownerId,

    title:
      String(title || "").trim() ||
      file?.name ||
      "Untitled document",

    name:
      String(title || "").trim() ||
      file?.name ||
      "Untitled document",

    category: category || "General",

    fileName: file?.name || "",
    fileType: file?.type || "",
    fileExtension: getExtension(file?.name),
    size: file?.size || 0,

    /*
     * The original binary file is not stored in localStorage.
     * We store metadata and extracted text only.
     * Original-file storage will move to Supabase Storage later.
     */
    originalFileStored: false,

    text: extractionResult.text,
    extractedText: extractionResult.text,
    textContent: extractionResult.text,

    extractionStatus: extractionResult.extractionStatus,
    extractionMessage: extractionResult.extractionMessage,
    pageCount: extractionResult.pageCount,
    pagesProcessed: extractionResult.pagesProcessed,
    characterCount: extractionResult.characterCount,
    wasTruncated: extractionResult.wasTruncated,

    createdAt: now,
    updatedAt: now,
  };

  saveAllDocuments([doc, ...loadAllDocuments()]);

  return doc;
}

export async function listDocumentsForClient(
  clientId,
  ownerId = null
) {
  const all = loadAllDocuments();

  return all
    .filter((doc) => {
      if (doc.clientId !== clientId) return false;

      if (ownerId && doc.ownerId && doc.ownerId !== ownerId) {
        return false;
      }

      return true;
    })
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    );
}

export async function buildClientDocumentIntelligence(
  clientId,
  ownerId = null
) {
  const docs = await listDocumentsForClient(clientId, ownerId);

  const readableDocs = docs.filter((doc) =>
    String(
      doc.textContent ||
        doc.extractedText ||
        doc.text ||
        ""
    ).trim()
  );

  const combinedText = readableDocs
    .map((doc) => {
      const title = doc.title || doc.fileName || "Untitled document";
      const category = doc.category || "General";
      const content =
        doc.textContent ||
        doc.extractedText ||
        doc.text ||
        "";

      return [
        `DOCUMENT: ${title}`,
        `CATEGORY: ${category}`,
        `SOURCE FILE: ${doc.fileName || "Manual entry"}`,
        content,
      ].join("\n");
    })
    .join("\n\n==============================\n\n");

  return {
    documentCount: docs.length,
    readableDocumentCount: readableDocs.length,
    documents: docs,
    combinedText,
    text: combinedText,
  };
}

export function deleteDocument(
  documentId,
  ownerId = null
) {
  const all = loadAllDocuments();

  const filtered = all.filter((doc) => {
    if (doc.id !== documentId) return true;

    if (ownerId && doc.ownerId && doc.ownerId !== ownerId) {
      return true;
    }

    return false;
  });

  saveAllDocuments(filtered);
}