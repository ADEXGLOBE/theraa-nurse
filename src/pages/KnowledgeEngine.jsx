import { useMemo, useState } from "react";
import {
  deleteKnowledgeArticle,
  getKnowledgeContext,
  loadKnowledgeArticles,
  saveKnowledgeArticle,
  searchKnowledge,
} from "../data/knowledgeBaseStore";

const emptyForm = {
  title: "",
  category: "NDIS Practice",
  source: "",
  content: "",
};

export default function KnowledgeEngine() {
  const [form, setForm] = useState(emptyForm);
  const [refreshKey, setRefreshKey] = useState(0);
  const [query, setQuery] = useState("");
  const [testEvidence, setTestEvidence] = useState("");
  const [preview, setPreview] = useState("");

  const articles = useMemo(() => {
    refreshKey;
    return query ? searchKnowledge(query) : loadKnowledgeArticles();
  }, [query, refreshKey]);

  const allArticles = useMemo(() => {
    refreshKey;
    return loadKnowledgeArticles();
  }, [refreshKey]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFileUpload(file) {
    if (!file) return;

    const text = await file.text();

    setForm((prev) => ({
      ...prev,
      title: prev.title || file.name,
      source: prev.source || file.name,
      content: text,
    }));
  }

  function handleSave() {
    if (!form.title.trim()) {
      alert("Please enter a title.");
      return;
    }

    if (!form.content.trim()) {
      alert("Please paste or upload knowledge content.");
      return;
    }

    saveKnowledgeArticle(form);
    setForm(emptyForm);
    setRefreshKey((k) => k + 1);
    alert("Knowledge document saved.");
  }

  function handleDelete(id) {
    if (!window.confirm("Delete this knowledge document?")) return;
    deleteKnowledgeArticle(id);
    setRefreshKey((k) => k + 1);
  }

  function buildLocalPreview() {
    const knowledge = getKnowledgeContext();

    setPreview(`Theraa Nurse Knowledge Engine Preview

Participant Evidence:
${testEvidence || "No participant evidence entered."}

Relevant Knowledge Available:
${knowledge ? knowledge.slice(0, 2500) : "No knowledge documents saved yet."}

Suggested Output:
- Use saved knowledge documents to strengthen care plans.
- Match participant evidence against NDIS, disability, aged care and WHS principles.
- Improve purpose-centred goals, risks, support actions and review summaries.
- Escalate clinical, legal or safety concerns to qualified professionals.

Note: This is local preview mode. Full LLM reasoning will activate after OPENAI_API_KEY is added to Vercel.`);
  }

  return (
    <div className="zone-page knowledge-page">
      <div className="knowledge-hero">
        <div>
          <div className="eyebrow">Theraa Nurse Intelligence</div>
          <h1>Knowledge Engine</h1>
          <p>
            Upload class PDFs, NDIS guidance, aged care notes and care frameworks.
            This global knowledge base will support all participants and strengthen
            care plans, reports and purpose-centred recommendations.
          </p>
        </div>

        <div className="knowledge-stat-card">
          <div className="knowledge-stat-number">{allArticles.length}</div>
          <div className="knowledge-stat-label">Knowledge Documents</div>
          <small>Available across all participants</small>
        </div>
      </div>

      <div className="two-column">
        <div className="card premium-card">
          <div className="card-title">Add Knowledge Document</div>
          <div className="card-subtitle">
            Upload or paste training content, class notes, NDIS practice guidance or care frameworks.
          </div>

          <div className="knowledge-form-grid">
            <label>
              <span>Title</span>
              <input
                className="input"
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="e.g. CHCDIS012 Social Inclusion Notes"
              />
            </label>

            <label>
              <span>Category</span>
              <select
                className="input"
                value={form.category}
                onChange={(e) => updateField("category", e.target.value)}
              >
                <option>NDIS Practice</option>
                <option>Disability Support</option>
                <option>Aged Care</option>
                <option>WHS / Manual Handling</option>
                <option>Infection Control</option>
                <option>Palliative Care</option>
                <option>Dementia Support</option>
                <option>Psychosocial Recovery</option>
                <option>Restrictive Practices</option>
                <option>Documentation Standards</option>
                <option>General</option>
              </select>
            </label>

            <label className="form-wide">
              <span>Source</span>
              <input
                className="input"
                value={form.source}
                onChange={(e) => updateField("source", e.target.value)}
                placeholder="e.g. PTA class PDF, NDIS guide, internal training"
              />
            </label>

            <label className="form-wide">
              <span>Upload text-based file</span>
              <input
                className="input"
                type="file"
                accept=".txt,.md,.csv,.json,.html"
                onChange={(e) => handleFileUpload(e.target.files?.[0])}
              />
              <small>
                For now, upload text-based files or paste PDF content below. PDF extraction comes next.
              </small>
            </label>

            <label className="form-wide">
              <span>Knowledge Content</span>
              <textarea
                className="textarea knowledge-textarea"
                value={form.content}
                onChange={(e) => updateField("content", e.target.value)}
                placeholder="Paste knowledge content here..."
              />
            </label>
          </div>

          <button className="btn-primary btn-wide" onClick={handleSave}>
            Save to Knowledge Engine
          </button>
        </div>

        <div className="card premium-card">
          <div className="card-title">Knowledge Library</div>
          <div className="card-subtitle">
            These documents are available to support all participants.
          </div>

          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search knowledge..."
            style={{ margin: "12px 0" }}
          />

          {articles.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🧠</div>
              <div>No knowledge documents found.</div>
              <small>Add your first training document.</small>
            </div>
          ) : (
            <div className="knowledge-list">
              {articles.map((item) => (
                <div key={item.id} className="knowledge-card">
                  <div>
                    <div className="knowledge-card-title">{item.title}</div>
                    <div className="knowledge-card-meta">
                      {item.category} · {item.source || "No source"}
                    </div>
                    <p>{String(item.content || "").slice(0, 180)}...</p>
                  </div>

                  <button
                    type="button"
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

      <div className="card premium-card" style={{ marginTop: 16 }}>
        <div className="card-title">Test Knowledge Engine Context</div>
        <div className="card-subtitle">
          Paste participant evidence here to preview how the Knowledge Engine will support future LLM reasoning.
        </div>

        <textarea
          className="textarea knowledge-textarea"
          value={testEvidence}
          onChange={(e) => setTestEvidence(e.target.value)}
          placeholder="Paste participant evidence, session notes, incident notes or care plan draft..."
        />

        <button className="btn-primary knowledge-run" onClick={buildLocalPreview}>
          Preview Knowledge Context
        </button>

        {preview ? (
          <pre className="knowledge-preview-output">{preview}</pre>
        ) : null}
      </div>
    </div>
  );
}