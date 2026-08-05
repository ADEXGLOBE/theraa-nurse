// src/pages/KnowledgeLibrary.jsx
import { useMemo, useRef, useState } from "react";

import {
  deleteKnowledgeItem,
  loadKnowledgeItems,
  saveKnowledgeItem,
  searchKnowledgeItems,
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
  tagsText: "",

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

export default function KnowledgeLibrary() {
  const fileInputRef = useRef(null);

  const [form, setForm] = useState(emptyForm);
  const [query, setQuery] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [isExtracting, setIsExtracting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const items = useMemo(() => {
    void refreshKey;

    return query
      ? searchKnowledgeItems(query)
      : loadKnowledgeItems();
  }, [query, refreshKey]);

  const allItems = useMemo(() => {
    void refreshKey;
    return loadKnowledgeItems();
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

  async function handleFile(file) {
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
          "No readable text was found. This may be a scanned PDF that requires OCR."
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
                result.pagesProcessed || result.pageCount || 0
              } PDF page(s).`
            : "Text file extracted successfully.",

        pageCount: result.pageCount,
        pagesProcessed: result.pagesProcessed,
        characterCount: result.characterCount,
        wasTruncated: result.wasTruncated,
      }));
    } catch (error) {
      console.error("Knowledge file extraction failed:", error);

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
        "Please upload a readable document or paste knowledge content."
      );
      return;
    }

    saveKnowledgeItem({
      ...form,

      tags: form.tagsText
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    });

    resetForm();
    setRefreshKey((key) => key + 1);

    alert(
      "Knowledge document saved and made available to the Knowledge Engine."
    );
  }

  function handleDelete(id) {
    if (!window.confirm("Delete this knowledge document?")) {
      return;
    }

    deleteKnowledgeItem(id);
    setRefreshKey((key) => key + 1);
  }

  function handleDragOver(event) {
    event.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);

    void handleFile(event.dataTransfer.files?.[0]);
  }

  return (
    <div className="zone-page knowledge-library-page">
      <div className="knowledge-library-hero">
        <div>
          <div className="eyebrow">Theraa Nurse V2</div>

          <h1>Knowledge Library</h1>

          <p>
            Upload organisation-wide policies, training resources,
            NDIS guidance and care frameworks. These resources
            strengthen Knowledge Engine recommendations for every
            participant.
          </p>
        </div>

        <div className="knowledge-library-stat">
          <div className="knowledge-library-number">
            {allItems.length}
          </div>

          <div className="knowledge-library-label">
            Knowledge Items
          </div>

          <small>Available to the AI engine</small>
        </div>
      </div>

      <div className="two-column">
        <div className="card premium-card">
          <div className="card-title">
            Add Organisation-Wide Knowledge
          </div>

          <div className="card-subtitle">
            Text-based PDF files are extracted automatically.
            Scanned PDFs require the upcoming OCR upgrade.
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
                placeholder="e.g. Work Legally and Ethically"
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
                {categories.map((category) => (
                  <option key={category}>
                    {category}
                  </option>
                ))}
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
                placeholder="e.g. Training PDF, NDIS guide, provider policy"
              />
            </label>

            <label className="form-wide">
              <span>Tags</span>

              <input
                className="input"
                value={form.tagsText}
                onChange={(event) =>
                  updateField("tagsText", event.target.value)
                }
                placeholder="e.g. privacy, ethics, duty of care"
              />
            </label>

            <div className="form-wide">
              <span>Upload Knowledge File</span>

              <div
                className={`evidence-dropzone ${
                  isDragging
                    ? "evidence-dropzone-active"
                    : ""
                }`}
                onClick={() =>
                  fileInputRef.current?.click()
                }
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" ||
                    event.key === " "
                  ) {
                    fileInputRef.current?.click();
                  }
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_FILE_TYPES}
                  style={{ display: "none" }}
                  disabled={isExtracting}
                  onChange={(event) =>
                    void handleFile(
                      event.target.files?.[0]
                    )
                  }
                />

                <div className="evidence-dropzone-icon">
                  {isExtracting ? "⏳" : "📚"}
                </div>

                <div className="evidence-dropzone-title">
                  {isExtracting
                    ? "Extracting document text..."
                    : form.fileName ||
                      "Drop a PDF or document here"}
                </div>

                <div className="evidence-dropzone-subtitle">
                  {form.fileName
                    ? `${formatFileSize(
                        form.size
                      )} · Click to replace`
                    : "or click to browse · Maximum 15 MB"}
                </div>
              </div>
            </div>

            {form.extractionMessage ? (
              <div className="form-wide evidence-processing">
                {form.extractionMessage}
              </div>
            ) : null}

            <label className="form-wide">
              <span>Knowledge Content</span>

              <textarea
                className="textarea knowledge-content-box"
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
            Save to Knowledge Library
          </button>
        </div>

        <div className="card premium-card">
          <div className="card-title">
            Knowledge Repository
          </div>

          <div className="card-subtitle">
            These resources are searched by Theraa Nurse AI.
          </div>

          <input
            className="input"
            value={query}
            onChange={(event) =>
              setQuery(event.target.value)
            }
            placeholder="Search knowledge library..."
            style={{ marginTop: 12 }}
          />

          {items.length === 0 ? (
            <div
              className="empty-state"
              style={{ marginTop: 14 }}
            >
              <div className="empty-icon">🏛</div>
              <div>No knowledge items found.</div>
              <small>
                Add your first knowledge document.
              </small>
            </div>
          ) : (
            <div className="knowledge-library-list">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="knowledge-library-card"
                >
                  <div>
                    <div className="knowledge-library-card-title">
                      {item.title}
                    </div>

                    <div className="knowledge-library-card-meta">
                      {item.category} ·{" "}
                      {item.source ||
                        item.fileName ||
                        "No source"}
                    </div>

                    <div className="evidence-status-row">
                      {item.fileExtension === ".pdf" ? (
                        <span className="evidence-status-pill">
                          PDF extracted
                        </span>
                      ) : null}

                      {item.pageCount ? (
                        <span>
                          {item.pageCount} page
                          {item.pageCount === 1 ? "" : "s"}
                        </span>
                      ) : null}

                      {item.size ? (
                        <span>
                          {formatFileSize(item.size)}
                        </span>
                      ) : null}
                    </div>

                    <p>
                      {String(item.content || "").slice(
                        0,
                        220
                      )}

                      {String(item.content || "").length >
                      220
                        ? "..."
                        : ""}
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
    </div>
  );
}