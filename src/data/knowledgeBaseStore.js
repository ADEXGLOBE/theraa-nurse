const STORAGE_KEY = "theraa_nurse_knowledge_library_v1";

function uid() {
  return `kb-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveAll(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items || []));
}

export function loadKnowledgeItems() {
  return loadAll();
}

export function saveKnowledgeItem(item) {
  const now = new Date().toISOString();

  const newItem = {
    id: uid(),
    title: item.title || "Untitled Knowledge Document",
    category: item.category || "General",
    source: item.source || "",
    fileName: item.fileName || "",
    fileType: item.fileType || "",
    content: item.content || "",
    tags: item.tags || [],
    createdAt: now,
    updatedAt: now,
  };

  saveAll([newItem, ...loadAll()]);
  return newItem.id;
}

export function deleteKnowledgeItem(id) {
  saveAll(loadAll().filter((item) => item.id !== id));
}

export function searchKnowledgeItems(query = "") {
  const q = String(query).toLowerCase().trim();
  if (!q) return loadAll();

  return loadAll().filter((item) =>
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
  const items = query ? searchKnowledgeItems(query) : loadAll();

  return items
    .slice(0, 8)
    .map(
      (item) => `
Title: ${item.title}
Category: ${item.category}
Source: ${item.source || item.fileName || "Unknown"}
Content:
${item.content}
`
    )
    .join("\n\n---\n\n");
}

/* Backward-compatible exports for older KnowledgeEngine.jsx */
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