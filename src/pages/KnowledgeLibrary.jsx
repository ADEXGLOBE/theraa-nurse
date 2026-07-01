import { useMemo, useState } from "react";
import {
  deleteKnowledgeItem,
  loadKnowledgeItems,
  saveKnowledgeItem,
  searchKnowledgeItems,
} from "../data/knowledgeBaseStore";

const emptyForm = {
  title: "",
  category: "NDIS Practice",
  source: "",
  content: "",
  tagsText: "",
};

const categories = [
  "NDIS Practice",
  "Aged Care",
  "Disability Support",
  "Behaviour Support",
  "Restrictive Practices",
  "Mental Health",
  "Dementia",
  "Autism",
  "Medication",
  "Manual Handling",
  "Infection Control",
  "Palliative Care",
  "Documentation",
  "Provider Policies",
  "Training Resources",
  "General",
];

export default function KnowledgeLibrary() {
  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const items = useMemo(() => {
    refreshKey;
    return query ? searchKnowledgeItems(query) : loadKnowledgeItems();
  }, [query, refreshKey]);

  const allItems = useMemo(() => {
    refreshKey;
    return loadKnowledgeItems();
  }, [refreshKey]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFile(file) {
    if (!file) return;

    let content = "";

    try {
      content = await file.text();
    } catch {
      content = "";
    }

    setForm((prev) => ({
      ...prev,
      title: prev.title || file.name,
      source: prev.source || file.name,
      content: content || prev.content,
      fileName: file.name,
      fileType: file.type,
    }));
  }

  function handleSave() {
    if (!form.title.trim()) {
      alert("Please enter a title.");
      return;
    }

    if (!form.content.trim()) {
      alert("Please paste knowledge content or upload a text-based file.");
      return;
    }

    saveKnowledgeItem({
      title: form.title,
      category: form.category,
      source: form.source,
      content: form.content,
      fileName: form.fileName || "",
      fileType: form.fileType || "",
      tags: form.tagsText
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    });

    setForm(emptyForm);
    setRefreshKey((k) => k + 1);
    alert("Knowledge document saved.");
  }

  function handleDelete(id) {
    if (!window.confirm("Delete this knowledge document?")) return;
    deleteKnowledgeItem(id);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="zone-page knowledge-library-page">
      <div className="knowledge-library-hero">
        <div>
          <div className="eyebrow">Theraa Nurse V2</div>
          <h1>Knowledge Library</h1>
          <p>
            Upload organisation-wide care knowledge, training documents, NDIS
            resources, policies and practice guidance. These resources help the
            Knowledge Engine enhance care plans for all participants.
          </p>
        </div>

        <div className="knowledge-library-stat">
          <div className="knowledge-library-number">{allItems.length}</div>
          <div className="knowledge-library-label">Knowledge Items</div>
          <small>Available to the AI engine</small>
        </div>
      </div>

      <div className="two-column">
        <div className="card premium-card">
          <div className="card-title">Add Knowledge</div>
          <div className="card-subtitle">
            Paste content from PDFs, class notes, policies or NDIS resources.
          </div>

          <div className="knowledge-form-grid">
            <label>
              <span>Title</span>
              <input
                className="input"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="e.g. NDIS Practice Standards"
              />
            </label>

            <label>
              <span>Category</span>
              <select
                className="input"
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
              >
                {categories.map((cat) => (
                  <option key={cat}>{cat}</option>
                ))}
              </select>
            </label>

            <label className="form-wide">
              <span>Source</span>
              <input
                className="input"
                value={form.source}
                onChange={(e) => updateField("source", e.target.value)}
                placeholder="e.g. PTA class PDF, provider policy, NDIS guide"
              />
            </label>

            <label className="form-wide">
              <span>Tags</span>
              <input
                className="input"
                value={form.tagsText}
                onChange={(e) => updateField("tagsText", e.target.value)}
                placeholder="e.g. autism, behaviour, community participation"
              />
            </label>

            <label className="form-wide">
              <span>Upload File</span>
              <input
                className="input"
                type="file"
                accept=".txt,.md,.csv,.json,.html"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <small>
                For now, upload text-based files or paste PDF/DOCX text below.
                PDF extraction comes next.
              </small>
            </label>

            <label className="form-wide">
              <span>Knowledge Content</span>
              <textarea
                className="textarea knowledge-content-box"
                value={form.content}
                onChange={(e) => updateField("content", e.target.value)}
                placeholder="Paste knowledge content here..."
              />
            </label>
          </div>

          <button className="btn-primary btn-wide" onClick={handleSave}>
            Save to Knowledge Library
          </button>
        </div>

        <div className="card premium-card">
          <div className="card-title">Knowledge Repository</div>
          <div className="card-subtitle">
            These items are searched by Theraa Nurse AI.
          </div>

          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search knowledge library..."
            style={{ marginTop: 12 }}
          />

          {items.length === 0 ? (
            <div className="empty-state" style={{ marginTop: 14 }}>
              <div className="empty-icon">🏛</div>
              <div>No knowledge items found.</div>
              <small>Add your first knowledge document.</small>
            </div>
          ) : (
            <div className="knowledge-library-list">
              {items.map((item) => (
                <div key={item.id} className="knowledge-library-card">
                  <div>
                    <div className="knowledge-library-card-title">
                      {item.title}
                    </div>
                    <div className="knowledge-library-card-meta">
                      {item.category} · {item.source || item.fileName || "No source"}
                    </div>

                    <p>
                      {String(item.content || "").slice(0, 220)}
                      {String(item.content || "").length > 220 ? "..." : ""}
                    </p>

                    {item.tags?.length ? (
                      <div className="knowledge-tags">
                        {item.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <button
                    className="btn-danger-soft"
                    onClick={() => handleDelete(item.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}