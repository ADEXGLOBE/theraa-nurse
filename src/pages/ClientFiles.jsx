import { useEffect, useMemo, useState } from "react";
import UploadButton from "../components/UploadButton";
import {
  DOC_TYPES,
  addDocument,
  deleteDocument,
  listAllDocuments,
  listDocumentsForClient,
  attachExtractedText,
} from "../features/documents/documentService";
import { extractTextFromFile, guessFileKind } from "../features/extraction/textExtractors";
import { ocrFileToText } from "../features/extraction/ocrService";
import { ensureSeedClients, loadClients } from "../data/clientsStore";
import mockClients from "../data/mockClients";
import DocumentReviewPanel from "../components/DocumentReviewPanel";


function formatDate(iso) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "document";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default function ClientFiles() {
  const [clients, setClients] = useState([]);
  const [mode, setMode] = useState("worker");
  const [selectedClientId, setSelectedClientId] = useState("");

  const [authorName, setAuthorName] = useState("");
  const [docType, setDocType] = useState("session_note");
  const [title, setTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [file, setFile] = useState(null);

  const [docsForClient, setDocsForClient] = useState([]);
  const [allDocs, setAllDocs] = useState([]);
  const [status, setStatus] = useState({ kind: "idle", msg: "" });

  useEffect(() => {
    ensureSeedClients(mockClients);
    const loaded = loadClients();
    setClients(loaded);
    if (loaded.length > 0) setSelectedClientId(loaded[0].id);
  }, []);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  async function refresh() {
    if (selectedClientId) setDocsForClient(await listDocumentsForClient(selectedClientId));
    setAllDocs(await listAllDocuments());
  }

  useEffect(() => {
    if (!selectedClientId) return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  async function onSubmit() {
    if (!selectedClientId) {
      setStatus({ kind: "error", msg: "Select a client first." });
      return;
    }

    if (!textContent.trim() && !file) {
      setStatus({ kind: "error", msg: "Add text notes or attach a file (or both)." });
      return;
    }

    setStatus({ kind: "saving", msg: "Saving..." });

    const saved = await addDocument({
      clientId: selectedClientId,
      authorRole: mode,
      authorName: authorName.trim(),
      docType,
      title: title.trim(),
      textContent: textContent.trim(),
      fileBlob: file || null,
      fileName: file?.name || "",
      fileType: file?.type || "",
      fileSize: file?.size || 0,
    });

    setTitle("");
    setTextContent("");
    setFile(null);

    // Phase 2 extraction attempt
    if (saved?.fileBlob) {
      try {
        setStatus({ kind: "saving", msg: "Extracting text from file..." });

        const extracted = await extractTextFromFile(saved.fileBlob, saved.fileType, saved.fileName);

        if (extracted && extracted.length > 0) {
          await attachExtractedText(saved.id, extracted, {
            extractionMethod: guessFileKind(saved.fileType, saved.fileName) === "pdf" ? "pdf-text" : "docx/txt",
          });

          setStatus({ kind: "ok", msg: "Saved + extracted text ready for care planning." });
        } else {
          setStatus({
            kind: "ok",
            msg: "Saved. No extractable text found (likely scanned). Use OCR on the document row.",
          });
        }
      } catch (err) {
        console.error(err);
        setStatus({ kind: "ok", msg: "Saved. Text extraction failed. You can try OCR on the document row." });
      }
    } else {
      setStatus({ kind: "ok", msg: "Saved. Added to inbox." });
    }

    await refresh();
  }

  async function onDelete(id) {
    await deleteDocument(id);
    await refresh();
  }

  async function runOcrForDoc(doc) {
    if (!doc?.fileBlob) return;

    try {
      setStatus({ kind: "saving", msg: "OCR starting..." });

      const res = await ocrFileToText(doc.fileBlob, doc.fileType, doc.fileName, {
        maxPdfPages: 3,
        onProgress: (msg) => setStatus({ kind: "saving", msg }),
      });

      if (res.text && res.text.length > 0) {
        await attachExtractedText(doc.id, res.text, {
          extractionMethod: res.method,
          ocrConfidence: typeof res.confidence === "number" ? res.confidence : null,
        });

        setStatus({
          kind: "ok",
          msg: `OCR complete. Text attached. Confidence: ${res.confidence ?? "n/a"}`,
        });
      } else {
        setStatus({ kind: "ok", msg: "OCR completed but returned no text. Try a clearer scan." });
      }

      await refresh();
    } catch (err) {
      console.error(err);
      setStatus({ kind: "error", msg: "OCR failed. Check console for details." });
    }
  }

  function showOcrButton(d) {
    if (!d.fileBlob) return false;
    if (d.extractedText) return false;
    const kind = guessFileKind(d.fileType, d.fileName);
    return kind === "pdf" || kind === "image";
  }

  if (!clients || clients.length === 0) {
    return (
      <div className="card">
        <div className="card-title">Client Files</div>
        <div className="card-subtitle">
          No clients found. Go to the Clients page and add your first client.
        </div>
      </div>
    );
  }

  return (
    <div className="zone-page">
      <div className="zone-header">
        <h2 style={{ margin: 0 }}>Client Files & Notes</h2>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          Phase 2 extracts DOCX/text-PDF/TXT. Phase 2.5 OCR supports scanned PDFs/images (first 3 pages).
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className={"pill" + (mode === "worker" ? " pill-active" : "")} onClick={() => setMode("worker")}>
            Worker mode
          </button>
          <button
            className={"pill" + (mode === "coordinator" ? " pill-active" : "")}
            onClick={() => setMode("coordinator")}
          >
            Care coordinator mode
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280" }}>
          Worker mode = shift/session submissions. Coordinator mode = upload plans and review inbox.
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>{mode === "worker" ? "Submit a note" : "Upload / add a document"}</h3>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            <div className="label">Client</div>
            <select value={selectedClientId} onChange={(e) => setSelectedClientId(e.target.value)}>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.age})
                </option>
              ))}
            </select>
          </label>

          <label>
            <div className="label">{mode === "worker" ? "Worker name" : "Coordinator name"}</div>
            <input
              value={authorName}
              placeholder={mode === "worker" ? "e.g., Ben" : "e.g., Care Coordinator"}
              onChange={(e) => setAuthorName(e.target.value)}
            />
          </label>

          <label>
            <div className="label">Document type</div>
            <select value={docType} onChange={(e) => setDocType(e.target.value)}>
              {DOC_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            <div className="label">Title (optional)</div>
            <input value={title} placeholder="e.g., Morning shift notes" onChange={(e) => setTitle(e.target.value)} />
          </label>
        </div>

        <label style={{ marginTop: 12, display: "block" }}>
          <div className="label">Paste notes (recommended)</div>
          <textarea
            rows={7}
            value={textContent}
            placeholder="Paste shift/session notes here. Files are extracted/OCR’d into text for care plan generation."
            onChange={(e) => setTextContent(e.target.value)}
          />
        </label>

        <div style={{ marginTop: 10 }}>
          <div className="label">Attach a file (optional)</div>
          <UploadButton
            file={file}
            onFileSelected={(f) => setFile(f)}
            accept=".pdf,.docx,.txt,.png,.jpg,.jpeg,.webp"
            hint="Text PDFs/DOCX auto-extract. Scanned PDFs/images → OCR button after saving."
          />
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center" }}>
          <button className="primary" onClick={onSubmit}>
            Save submission
          </button>
          {status.kind !== "idle" && (
            <div style={{ fontSize: 12, color: status.kind === "error" ? "#b91c1c" : "#065f46" }}>{status.msg}</div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Documents for {selectedClient?.name || "client"}</h3>

        {docsForClient.length === 0 ? (
          <div style={{ fontSize: 13, color: "#6b7280" }}>No documents yet for this client.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {docsForClient.map((d) => (
              <div key={d.id} className="doc-row">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{d.title || "Untitled"}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {(DOC_TYPES.find((x) => x.id === d.docType)?.label || d.docType) +
                        " · " +
                        (d.authorRole === "worker" ? "Worker" : "Coordinator") +
                        (d.authorName ? `: ${d.authorName}` : "") +
                        " · " +
                        formatDate(d.createdAt)}
                      {d.extractedAt ? ` · Extracted: ${formatDate(d.extractedAt)}` : ""}
                      {d.extractionMethod ? ` · Method: ${d.extractionMethod}` : ""}
                      {typeof d.ocrConfidence === "number" ? ` · OCR conf: ${d.ocrConfidence}` : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {d.fileBlob ? (
                      <button onClick={() => downloadBlob(d.fileBlob, d.fileName || "document")}>
                        Download file
                      </button>
                    ) : null}

                    {showOcrButton(d) ? <button onClick={() => runOcrForDoc(d)}>Run OCR</button> : null}

                    <button onClick={() => onDelete(d.id)}>Delete</button>
                  </div>
                </div>

                {d.textContent ? (
                  <div style={{ marginTop: 8, fontSize: 13, whiteSpace: "pre-wrap" }}>
                    {d.textContent.length > 500 ? d.textContent.slice(0, 500) + "…" : d.textContent}
                  </div>
                ) : (
                  <div style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>No pasted text (file-only submission).</div>
                )}

                {d.extractedText ? (
                  <div
                    style={{
                      marginTop: 10,
                      fontSize: 13,
                      whiteSpace: "pre-wrap",
                      background: "#f9fafb",
                      border: "1px solid #e5e7eb",
                      borderRadius: 10,
                      padding: 10,
                    }}
                  >
                    <b>Extracted text:</b>{" "}
                    {d.extractedText.length > 500 ? d.extractedText.slice(0, 500) + "…" : d.extractedText}
                  </div>
                ) : null}
                <DocumentReviewPanel document={d} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3 style={{ marginTop: 0 }}>Coordinator Inbox (all submissions)</h3>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>Everything submitted across all clients.</div>

        {allDocs.length === 0 ? (
          <div style={{ fontSize: 13, color: "#6b7280" }}>Inbox is empty.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {allDocs.slice(0, 30).map((d) => (
              <div key={d.id} className="doc-row">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{d.title || "Untitled"}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      Client: {d.clientId}
                      {" · "}
                      {DOC_TYPES.find((x) => x.id === d.docType)?.label || d.docType}
                      {" · "}
                      {d.authorRole === "worker" ? "Worker" : "Coordinator"}
                      {d.authorName ? `: ${d.authorName}` : ""}
                      {" · "}
                      {formatDate(d.createdAt)}
                      {d.extractedAt ? ` · Extracted: ${formatDate(d.extractedAt)}` : ""}
                      {d.extractionMethod ? ` · Method: ${d.extractionMethod}` : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {d.fileBlob ? (
                      <button onClick={() => downloadBlob(d.fileBlob, d.fileName || "document")}>
                        Download file
                      </button>
                    ) : null}
                    {showOcrButton(d) ? <button onClick={() => runOcrForDoc(d)}>Run OCR</button> : null}
                    <button onClick={() => onDelete(d.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: "#6b7280" }}>
        Next: insights auto-refresh on document save + optimisation actions for workers.
      </div>
    </div>
  );
}
