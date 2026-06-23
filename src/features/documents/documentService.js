const STORAGE_KEY = "theraa_nurse_documents_v1";

function uid() {
  return `doc-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

function loadAllDocuments() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveAllDocuments(docs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(docs || []));
}

export async function saveDocumentForClient({
  clientId,
  ownerId,
  title,
  category,
  file,
  textContent,
}) {
  if (!clientId) throw new Error("clientId is required.");
  if (!ownerId) throw new Error("ownerId is required.");

  let extractedText = textContent || "";

  if (file && !extractedText) {
    try {
      extractedText = await file.text();
    } catch {
      extractedText = "";
    }
  }

  const doc = {
    id: uid(),
    clientId,
    ownerId,
    title: title || file?.name || "Untitled document",
    name: title || file?.name || "Untitled document",
    category: category || "General",
    fileName: file?.name || "",
    fileType: file?.type || "",
    size: file?.size || 0,
    text: extractedText,
    extractedText,
    textContent: extractedText,
    createdAt: new Date().toISOString(),
  };

  saveAllDocuments([doc, ...loadAllDocuments()]);
  return doc.id;
}

export async function listDocumentsForClient(clientId, ownerId = null) {
  const all = loadAllDocuments();

  return all.filter((doc) => {
    if (doc.clientId !== clientId) return false;
    if (ownerId && doc.ownerId && doc.ownerId !== ownerId) return false;
    return true;
  });
}

export async function buildClientDocumentIntelligence(clientId, ownerId = null) {
  const docs = await listDocumentsForClient(clientId, ownerId);

  const combinedText = docs
    .map((doc) => doc.textContent || doc.extractedText || doc.text || "")
    .filter(Boolean)
    .join("\n\n");

  return {
    documentCount: docs.length,
    documents: docs,
    combinedText,
    text: combinedText,
  };
}

export function deleteDocument(documentId, ownerId = null) {
  const all = loadAllDocuments();

  const filtered = all.filter((doc) => {
    if (doc.id !== documentId) return true;
    if (ownerId && doc.ownerId && doc.ownerId !== ownerId) return true;
    return false;
  });

  saveAllDocuments(filtered);
}