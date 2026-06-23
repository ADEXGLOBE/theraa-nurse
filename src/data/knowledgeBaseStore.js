const STORAGE_KEY = "theraa_nurse_knowledge_base_v1";

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

export function loadKnowledgeArticles() {
  return loadAll();
}

export function saveKnowledgeArticle(article) {
  const now = new Date().toISOString();

  const newArticle = {
    id: uid(),
    title: article.title || "Untitled Knowledge Document",
    category: article.category || "General",
    source: article.source || "",
    content: article.content || "",
    fileName: article.fileName || "",
    createdAt: now,
    updatedAt: now,
  };

  saveAll([newArticle, ...loadAll()]);
  return newArticle.id;
}

export function deleteKnowledgeArticle(id) {
  saveAll(loadAll().filter((item) => item.id !== id));
}

export function searchKnowledge(query = "") {
  const q = String(query).toLowerCase().trim();
  if (!q) return loadAll();

  return loadAll().filter((item) =>
    [
      item.title,
      item.category,
      item.source,
      item.content,
      item.fileName,
    ]
      .join(" ")
      .toLowerCase()
      .includes(q)
  );
}

export function getKnowledgeContext() {
  return loadAll()
    .map(
      (item) =>
        `Title: ${item.title}\nCategory: ${item.category}\nSource: ${item.source}\nContent:\n${item.content}`
    )
    .join("\n\n---\n\n");
}