// src/data/knowledgeBaseStore.js
const STORAGE_KEY = "theraa_nurse_knowledge_library_v1";

function uid() {
  return `kb-${Date.now().toString(36)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function loadAll() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to load Knowledge Library:", error);
    return [];
  }
}

function saveAll(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items || []));
  } catch (error) {
    console.error("Failed to save Knowledge Library:", error);

    throw new Error(
      "The knowledge document could not be saved. Browser storage may be full."
    );
  }
}

export function loadKnowledgeItems() {
  return loadAll().sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime()
  );
}

export function saveKnowledgeItem(item) {
  const now = new Date().toISOString();

  const newItem = {
    id: item?.id || uid(),

    title:
      String(item?.title || "").trim() ||
      "Untitled Knowledge Document",

    category: item?.category || "General",
    source: String(item?.source || "").trim(),

    fileName: item?.fileName || "",
    fileType: item?.fileType || "",
    fileExtension: item?.fileExtension || "",
    size: Number(item?.size || 0),

    content: String(item?.content || "").trim(),

    tags: Array.isArray(item?.tags)
      ? item.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [],

    extractionStatus: item?.extractionStatus || "manual-entry",
    extractionMessage: item?.extractionMessage || "",
    pageCount: item?.pageCount || null,
    pagesProcessed: item?.pagesProcessed || null,
    characterCount:
      item?.characterCount ||
      String(item?.content || "").length,

    wasTruncated: Boolean(item?.wasTruncated),

    /*
     * Current V2 prototype stores extracted text and metadata.
     * Original file storage will later move to Supabase Storage.
     */
    originalFileStored: false,

    createdAt: item?.createdAt || now,
    updatedAt: now,
  };

  const existing = loadAll();

  const withoutDuplicate = existing.filter(
    (savedItem) => savedItem.id !== newItem.id
  );

  saveAll([newItem, ...withoutDuplicate]);

  return newItem;
}

export function deleteKnowledgeItem(id) {
  saveAll(loadAll().filter((item) => item.id !== id));
}

export function searchKnowledgeItems(query = "") {
  const q = String(query).toLowerCase().trim();

  if (!q) {
    return loadKnowledgeItems();
  }

  return loadKnowledgeItems().filter((item) =>
    [
      item.title,
      item.category,
      item.source,
      item.fileName,
      item.content,
      ...(item.tags || []),
    ]
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
}

export function getKnowledgeContext(query = "") {
  const items = query
    ? searchKnowledgeItems(query)
    : loadKnowledgeItems();

  return items
    .filter((item) => String(item.content || "").trim())
    .slice(0, 8)
    .map(
      (item) => `
KNOWLEDGE DOCUMENT: ${item.title}
CATEGORY: ${item.category}
SOURCE: ${item.source || item.fileName || "Unknown"}
FILE: ${item.fileName || "Manual entry"}

CONTENT:
${item.content}
`.trim()
    )
    .join("\n\n================================\n\n");
}

/*
 * Backward-compatible exports used by KnowledgeEngine.jsx.
 */

export function loadKnowledgeArticles() {
  return loadKnowledgeItems();
}

export function saveKnowledgeArticle(article) {
  return saveKnowledgeItem(article);
}

export function searchKnowledge(query = "") {
  return searchKnowledgeItems(query);
}

export function deleteKnowledgeArticle(id) {
  return deleteKnowledgeItem(id);
}