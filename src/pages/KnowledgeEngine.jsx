// src/pages/KnowledgeEngine.jsx
import { useMemo, useRef, useState } from "react";

import {
  deleteKnowledgeArticle,
  getKnowledgeContext,
  loadKnowledgeArticles,
  saveKnowledgeArticle,
  searchKnowledge,
} from "../data/knowledgeBaseStore";

import { extractTextFromPdf } from "../features/documents/pdfExtraction";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

const ACCEPTED_FILE_TYPES =
  ".pdf,.txt,.md,.csv,.json,.html,.htm";

const emptyForm = {
  title: "",
  category: "NDIS Practice",
  source: "",
  content: "",

  fileName: "",
  fileType: "",
  fileExtension: "",
  size: 0,

  extractionStatus: "manual-entry",
  extractionMessage: "",
  pageCount: null,
  pagesProcessed: null,
  characterCount: 0,
  wasTruncated: false,
};

function getExtension(fileName = "") {
  const normalised = String(fileName).toLowerCase();
  const dotIndex = normalised.lastIndexOf(".");

  return dotIndex >= 0 ? normalised.slice(dotIndex) : "";
}

function formatFileSize(bytes) {
  if (!bytes) return "";

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function KnowledgeEngine() {
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(emptyForm);
  const [refreshKey, setRefreshKey] = useState(0);
  const [query, setQuery] = useState("");

  const [testEvidence, setTestEvidence] = useState("");
  const [preview, setPreview] = useState("");

  const [isExtracting, setIsExtracting] =
    useState(false);

  const articles = useMemo(() => {
    void refreshKey;

    return query
      ? searchKnowledge(query)
      : loadKnowledgeArticles();
  }, [query, refreshKey]);

  const allArticles = useMemo(() => {
    void refreshKey;
    return loadKnowledgeArticles();
  }, [refreshKey]);

  function updateField(key, value) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function resetForm() {
    setForm(emptyForm);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleFileUpload(file) {
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert("Please upload a file smaller than 15 MB.");
      return;
    }

    const extension = getExtension(file.name);

    const supportedExtensions = [
      ".pdf",
      ".txt",
      ".md",
      ".csv",
      ".json",
      ".html",
      ".htm",
    ];

    if (!supportedExtensions.includes(extension)) {
      alert(
        "Unsupported file type. Upload PDF, TXT, MD, CSV, JSON or HTML."
      );
      return;
    }

    setIsExtracting(true);

    try {
      let result;

      if (
        file.type === "application/pdf" ||
        extension === ".pdf"
      ) {
        result = await extractTextFromPdf(file);
      } else {
        const text = await file.text();

        result = {
          text,
          pageCount: null,
          pagesProcessed: null,
          characterCount: text.length,
          extractionStatus: text
            ? "completed"
            : "no-readable-text",
          wasTruncated: false,
        };
      }

      if (!result.text) {
        throw new Error(
          "No readable text was found. The PDF may contain scanned images and require OCR."
        );
      }

      setForm((prev) => ({
        ...prev,

        title:
          prev.title ||
          file.name.replace(/\.[^/.]+$/, ""),

        source: prev.source || file.name,
        content: result.text,

        fileName: file.name,
        fileType: file.type,
        fileExtension: extension,
        size: file.size,

        extractionStatus: result.extractionStatus,

        extractionMessage:
          extension === ".pdf"
            ? `Extracted text from ${
                result.pagesProcessed ||
                result.pageCount ||
                0
              } PDF page(s).`
            : "Text file extracted successfully.",

        pageCount: result.pageCount,
        pagesProcessed: result.pagesProcessed,
        characterCount: result.characterCount,
        wasTruncated: result.wasTruncated,
      }));
    } catch (error) {
      console.error(
        "Knowledge Engine upload failed:",
        error
      );

      alert(
        `File extraction failed:\n\n${
          error?.message || "Unknown error"
        }`
      );
    } finally {
      setIsExtracting(false);
    }
  }

  function handleSave() {
    if (!form.title.trim()) {
      alert("Please enter a title.");
      return;
    }

    if (!form.content.trim()) {
      alert(
        "Please paste or upload readable knowledge content."
      );
      return;
    }

    saveKnowledgeArticle(form);

    resetForm();
    setRefreshKey((key) => key + 1);

    alert(
      "Knowledge document saved to the shared Knowledge Library."
    );
  }

  function handleDelete(id) {
    if (!window.confirm("Delete this knowledge document?")) {
      return;
    }

    deleteKnowledgeArticle(id);
    setRefreshKey((key) => key + 1);
  }

  function buildLocalPreview() {
    const searchContext = [
      testEvidence,
      form.category,
      form.title,
    ]
      .filter(Boolean)
      .join(" ");

    const knowledge =
      getKnowledgeContext(searchContext) ||
      getKnowledgeContext();

    setPreview(`Theraa Nurse Knowledge Engine Preview

PARTICIPANT EVIDENCE:
${testEvidence || "No participant evidence entered."}

RELEVANT KNOWLEDGE:
${
  knowledge
    ? knowledge.slice(0, 5000)
    : "No knowledge documents saved yet."
}

KNOWLEDGE ENGINE ROLE:
- Match participant evidence with relevant organisational knowledge.
- Strengthen purpose-centred goals and support actions.
- Identify risk, legal, ethical and safeguarding considerations.
- Support coordinator and support worker decision-making.
- Flag matters requiring review by an authorised professional.

This preview demonstrates local retrieval. Live care-plan enhancement uses the OpenAI API through the server-side Knowledge Engine route.`);
  }

  return (
    <div className="zone-page knowledge-page">
      <div className="knowledge-hero">
        <div>
          <div className="eyebrow">
            Theraa Nurse Intelligence
          </div>

          <h1>Knowledge Engine</h1>

          <p>
            Test how participant evidence is matched with
            organisation-wide knowledge. Documents uploaded here
            are stored in the shared Knowledge Library.
          </p>
        </div>

        <div className="knowledge-stat-card">
          <div className="knowledge-stat-number">
            {allArticles.length}
          </div>

          <div className="knowledge-stat-label">
            Knowledge Documents
          </div>

          <small>Available across all participants</small>
        </div>
      </div>

      <div className="two-column">
        <div className="card premium-card">
          <div className="card-title">
            Add Knowledge Shortcut
          </div>

          <div className="card-subtitle">
            Upload a PDF or text document. It will be stored in
            the shared Knowledge Library and made available to
            the Knowledge Engine.
          </div>

          <div className="knowledge-form-grid">
            <label>
              <span>Title</span>

              <input
                className="input"
                value={form.title}
                onChange={(event) =>
                  updateField("title", event.target.value)
                }
                placeholder="e.g. CHCLEG001 Work Legally and Ethically"
              />
            </label>

            <label>
              <span>Category</span>

              <select
                className="input"
                value={form.category}
                onChange={(event) =>
                  updateField("category", event.target.value)
                }
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
                <option>Provider Policies</option>
                <option>Training Resources</option>
                <option>General</option>
              </select>
            </label>

            <label className="form-wide">
              <span>Source</span>

              <input
                className="input"
                value={form.source}
                onChange={(event) =>
                  updateField("source", event.target.value)
                }
                placeholder="e.g. Class PDF, NDIS guide, internal policy"
              />
            </label>

            <label className="form-wide">
              <span>Upload PDF or Text File</span>

              <input
                ref={fileInputRef}
                className="input"
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                disabled={isExtracting}
                onChange={(event) =>
                  void handleFileUpload(
                    event.target.files?.[0]
                  )
                }
              />

              <small>
                Supports text-based PDFs and text documents.
                Scanned PDFs will require OCR.
              </small>
            </label>

            {isExtracting ? (
              <div className="form-wide evidence-processing">
                <span className="evidence-processing-spinner" />
                Extracting document text...
              </div>
            ) : null}

            {form.extractionMessage ? (
              <div className="form-wide evidence-status-row">
                <span className="evidence-status-pill">
                  {form.extractionMessage}
                </span>

                {form.size ? (
                  <span>{formatFileSize(form.size)}</span>
                ) : null}
              </div>
            ) : null}

            <label className="form-wide">
              <span>Knowledge Content</span>

              <textarea
                className="textarea knowledge-textarea"
                value={form.content}
                onChange={(event) =>
                  updateField("content", event.target.value)
                }
                placeholder="Extracted PDF text or manually pasted knowledge appears here..."
              />
            </label>
          </div>

          <button
            type="button"
            className="btn-primary btn-wide"
            onClick={handleSave}
            disabled={
              isExtracting || !form.content.trim()
            }
          >
            Save to Shared Knowledge Library
          </button>
        </div>

        <div className="card premium-card">
          <div className="card-title">
            Knowledge Available to the Engine
          </div>

          <div className="card-subtitle">
            This is the same repository shown in the Knowledge
            Library tab.
          </div>

          <input
            className="input"
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Search knowledge..."
            style={{ margin: "12px 0" }}
          />

          {articles.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🧠</div>
              <div>No knowledge documents found.</div>
              <small>
                Add your first knowledge document.
              </small>
            </div>
          ) : (
            <div className="knowledge-list">
              {articles.map((item) => (
                <div
                  key={item.id}
                  className="knowledge-card"
                >
                  <div>
                    <div className="knowledge-card-title">
                      {item.title}
                    </div>

                    <div className="knowledge-card-meta">
                      {item.category} ·{" "}
                      {item.source || "No source"}
                    </div>

                    {item.fileExtension === ".pdf" ? (
                      <div className="evidence-status-row">
                        <span className="evidence-status-pill">
                          PDF extracted
                        </span>

                        {item.pageCount ? (
                          <span>
                            {item.pageCount} page
                            {item.pageCount === 1
                              ? ""
                              : "s"}
                          </span>
                        ) : null}
                      </div>
                    ) : null}

                    <p>
                      {String(item.content || "").slice(
                        0,
                        180
                      )}

                      {String(item.content || "").length >
                      180
                        ? "..."
                        : ""}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn-danger-soft"
                    onClick={() =>
                      handleDelete(item.id)
                    }
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        className="card premium-card"
        style={{ marginTop: 16 }}
      >
        <div className="card-title">
          Test Knowledge Engine Context
        </div>

        <div className="card-subtitle">
          Paste participant evidence to preview which knowledge
          Theraa Nurse retrieves.
        </div>

        <textarea
          className="textarea knowledge-textarea"
          value={testEvidence}
          onChange={(event) =>
            setTestEvidence(event.target.value)
          }
          placeholder="Paste participant evidence, session notes, incident notes or care-plan draft..."
        />

        <button
          type="button"
          className="btn-primary knowledge-run"
          onClick={buildLocalPreview}
        >
          Preview Knowledge Context
        </button>

        {preview ? (
          <pre className="knowledge-preview-output">
            {preview}
          </pre>
        ) : null}
      </div>
    </div>
  );
}