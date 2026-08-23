// src/pages/ClientFiles.jsx
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useActiveClient } from "../context/ActiveClientContext";
import { useWorkspace } from "../context/WorkspaceContext";

import {
  saveDocumentForClient,
  listDocumentsForClient,
  deleteDocument,
} from "../features/documents/documentService";

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

const ACCEPTED_FILE_TYPES =
  ".pdf,.txt,.md,.csv,.json,.html,.htm";

function formatFileSize(bytes) {
  if (!bytes) return "Manual entry";

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExtractionLabel(doc) {
  switch (doc?.extractionStatus) {
    case "completed":
      return "Text extracted";

    case "manual-entry":
      return "Manual text";

    case "no-readable-text":
      return "No readable text";

    default:
      return "Evidence saved";
  }
}

export default function ClientFiles() {
  const { user } = useAuth();
  const {
  organisationId,
} = useWorkspace();

  const {
    clients = [],
    clientsReady,
    activeClientId,
    setActiveClientId,
  } = useActiveClient();

  const fileInputRef = useRef(null);

  const fallbackId = clients[0]?.id || "";

  const selectedClientId =
    activeClientId || fallbackId;

  const [documents, setDocuments] = useState([]);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Progress Note");
  const [textContent, setTextContent] = useState("");
  const [file, setFile] = useState(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!activeClientId && fallbackId) {
      setActiveClientId(fallbackId);
    }
  }, [
    activeClientId,
    fallbackId,
    setActiveClientId,
  ]);

  useEffect(() => {
    setDocuments([]);
    setUploadStatus("");
    setTitle("");
    setCategory("Progress Note");
    setTextContent("");
    setFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    void refreshDocuments();
  }, [selectedClientId, user?.id]);

  async function refreshDocuments() {
    if (!selectedClientId) {
      setDocuments([]);
      return;
    }

    try {
      const docs = await listDocumentsForClient(
        selectedClientId,
        user?.id
      );

      setDocuments(
        Array.isArray(docs)
          ? docs
          : []
      );
    } catch (error) {
      console.error(
        "Unable to load documents:",
        error
      );

      setDocuments([]);
    }
  }

  function clearSelectedFile() {
    setFile(null);
    setUploadStatus("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function resetForm() {
    setTitle("");
    setCategory("Progress Note");
    setTextContent("");
    clearSelectedFile();
  }

  function validateAndSelectFile(selectedFile) {
    if (!selectedFile) return;

    if (selectedFile.size > MAX_FILE_SIZE_BYTES) {
      alert("Please select a file smaller than 15 MB.");
      return;
    }

    const extension = selectedFile.name
      .toLowerCase()
      .slice(selectedFile.name.lastIndexOf("."));

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
        "Unsupported file type. Please upload PDF, TXT, MD, CSV, JSON or HTML."
      );
      return;
    }

    setFile(selectedFile);
    setUploadStatus("");

    if (!title.trim()) {
      setTitle(selectedFile.name.replace(/\.[^/.]+$/, ""));
    }
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(event) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const droppedFile = event.dataTransfer.files?.[0];
    validateAndSelectFile(droppedFile);
  }

  async function handleUpload() {
    if (!selectedClientId) {
      alert("Please select a participant.");
      return;
    }

    if (!user?.id) {
      alert("Please sign in again before uploading evidence.");
      return;
    }

    if (!file && !textContent.trim()) {
      alert("Please upload a file or paste document text.");
      return;
    }

    setIsUploading(true);
    setUploadStatus(
      file?.name.toLowerCase().endsWith(".pdf")
        ? "Reading and extracting PDF text..."
        : "Processing evidence..."
    );

    try {
     const savedDocument =
  await saveDocumentForClient({
    organisationId,

    participantId:
      selectedClientId,

    userId:
      user.id,

    title,
    category,
    file,
    textContent,
  });
      await refreshDocuments();
      resetForm();

      if (savedDocument.extractionStatus === "no-readable-text") {
        alert(
          "The PDF was saved, but no readable text was found. It may be a scanned PDF and will require OCR."
        );
      } else {
        alert(
          `Document saved successfully.\n\n${
            savedDocument.extractionMessage ||
            "Participant evidence is ready."
          }`
        );
      }
    } catch (error) {
      console.error("Document upload failed:", error);

      alert(
        `Document upload failed:\n\n${
          error?.message || "Unknown error"
        }`
      );
    } finally {
      setIsUploading(false);
      setUploadStatus("");
    }
  }

  function handleDelete(id) {
    if (!window.confirm("Delete this document?")) return;

    try {
      deleteDocument(id, user?.id);
      void refreshDocuments();
    } catch (error) {
      console.error("Document deletion failed:", error);
      alert("The document could not be deleted.");
    }
  }

  const selectedParticipant = clients.find(
    (client) => client.id === selectedClientId
  );

  if (!clientsReady) {
    return (
      <div className="card">
        <div className="card-title">
          Documents & Evidence
        </div>

        <div className="card-subtitle">
          Loading authorised participants...
        </div>
      </div>
    );
  }

  if (!clients.length) {
    return (
      <div className="card">
        <div className="card-title">
          Documents & Evidence
        </div>

        <div className="card-subtitle">
          No authorised participants are currently available.
        </div>
      </div>
    );
  }

  return (
    <div className="zone-page evidence-page">
      <div className="evidence-hero">
        <div>
          <div className="eyebrow">Participant Evidence</div>

          <h1>Documents & Evidence</h1>

          <p>
            Upload participant PDFs, progress notes, assessments and
            support evidence for care-plan generation and Knowledge
            Engine enhancement.
          </p>
        </div>

        <div className="evidence-hero-card">
          <div className="evidence-hero-number">
            {documents.length}
          </div>

          <div className="evidence-hero-label">
            Evidence Items
          </div>

          <small>
            {selectedParticipant?.name ||
              "No participant selected"}
          </small>
        </div>
      </div>

      <div className="two-column">
        <div className="card premium-card">
          <div className="card-title">
            Upload Participant Evidence
          </div>

          <div className="card-subtitle">
            Text-based PDFs are now extracted automatically. Scanned
            or image-only PDFs will require the OCR upgrade.
          </div>

          <label className="section-title-sm">
            Participant

            <select
              className="input"
              value={selectedClientId}
              onChange={(event) =>
                setActiveClientId(event.target.value)
              }
              disabled={isUploading}
            >
              {clients.length === 0 ? (
                <option value="">
                  No participants available
                </option>
              ) : (
                clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                    {client.age ? ` (${client.age})` : ""}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="section-title-sm">
            Document Title

            <input
              className="input"
              value={title}
              onChange={(event) =>
                setTitle(event.target.value)
              }
              placeholder="e.g. OT Report, NDIS Plan, Intake Assessment"
              disabled={isUploading}
            />
          </label>

          <label className="section-title-sm">
            Category

            <select
              className="input"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
              disabled={isUploading}
            >
              <option>Progress Note</option>
              <option>NDIS Plan</option>
              <option>Care Plan</option>
              <option>Risk Assessment</option>
              <option>Incident Report</option>
              <option>Allied Health Report</option>
              <option>Behaviour Support</option>
              <option>Medication</option>
              <option>Hospital Discharge</option>
              <option>Service Agreement</option>
              <option>General</option>
            </select>
          </label>

          <div className="section-title-sm">
            Upload File
          </div>

          <div
            className={`evidence-dropzone ${
              isDragging ? "evidence-dropzone-active" : ""
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
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
              onChange={(event) =>
                validateAndSelectFile(
                  event.target.files?.[0]
                )
              }
              disabled={isUploading}
            />

            <div className="evidence-dropzone-icon">
              {file ? "✅" : "📤"}
            </div>

            {file ? (
              <>
                <div className="evidence-dropzone-title">
                  {file.name}
                </div>

                <div className="evidence-dropzone-subtitle">
                  {formatFileSize(file.size)} · Click to replace
                </div>
              </>
            ) : (
              <>
                <div className="evidence-dropzone-title">
                  Drop a PDF or document here
                </div>

                <div className="evidence-dropzone-subtitle">
                  or click to browse · Maximum 15 MB
                </div>
              </>
            )}
          </div>

          {file ? (
            <button
              type="button"
              className="btn-danger-soft"
              onClick={clearSelectedFile}
              disabled={isUploading}
              style={{ marginTop: 8 }}
            >
              Remove selected file
            </button>
          ) : null}

          <label className="section-title-sm">
            Additional Document Text or Notes

            <textarea
              className="textarea"
              rows={8}
              value={textContent}
              onChange={(event) =>
                setTextContent(event.target.value)
              }
              placeholder="Optional: paste extra document content or coordinator notes here..."
              disabled={isUploading}
            />
          </label>

          {uploadStatus ? (
            <div className="evidence-processing">
              <span className="evidence-processing-spinner" />

              <span>{uploadStatus}</span>
            </div>
          ) : null}

          <button
            type="button"
            className="btn-primary btn-wide"
            onClick={handleUpload}
            disabled={
              isUploading ||
              !selectedClientId ||
              (!file && !textContent.trim())
            }
          >
            {isUploading
              ? "Processing Evidence..."
              : "Save Evidence"}
          </button>
        </div>

        <div className="card premium-card">
          <div className="card-title">
            Saved Participant Evidence
          </div>

          <div className="card-subtitle">
            Extracted document text feeds the Care Engine and
            Knowledge Engine.
          </div>

          {documents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📄</div>
              <div>No documents yet.</div>
              <small>
                Upload participant evidence to begin.
              </small>
            </div>
          ) : (
            <div className="evidence-list">
              {documents.map((doc) => {
                const documentText =
                  doc.textContent ||
                  doc.extractedText ||
                  doc.text ||
                  "";

                return (
                  <div
                    className="evidence-card"
                    key={doc.id}
                  >
                    <div className="evidence-icon">
                      {doc.fileExtension === ".pdf"
                        ? "📕"
                        : "📄"}
                    </div>

                    <div className="evidence-main">
                      <div className="evidence-title">
                        {doc.title || doc.name}
                      </div>

                      <div className="evidence-meta">
                        {doc.category} ·{" "}
                        {doc.fileName || "Manual entry"} ·{" "}
                        {formatFileSize(doc.size)}
                      </div>

                      <div className="evidence-status-row">
                        <span className="evidence-status-pill">
                          {getExtractionLabel(doc)}
                        </span>

                        {doc.pageCount ? (
                          <span>
                            {doc.pageCount} page
                            {doc.pageCount === 1 ? "" : "s"}
                          </span>
                        ) : null}

                        <span>
                          {new Date(
                            doc.createdAt
                          ).toLocaleString()}
                        </span>
                      </div>

                      {doc.wasTruncated ? (
                        <div className="evidence-warning">
                          Only part of this large document was
                          extracted.
                        </div>
                      ) : null}

                      <div className="evidence-preview">
                        {documentText.slice(0, 280)}

                        {documentText.length > 280
                          ? "..."
                          : ""}
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn-danger-soft"
                      onClick={() =>
                        handleDelete(doc.id)
                      }
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}