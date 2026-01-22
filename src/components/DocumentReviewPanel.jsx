// src/components/DocumentReviewPanel.jsx
export default function DocumentReviewPanel({ document }) {
  if (!document) return null;

  const {
    docCategory,
    sectionMap = {},
    extractionMethod,
    ocrConfidence,
    extractedText,
  } = document;

  function renderSection(title, items) {
    if (!items || items.length === 0) return null;
    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        <ul style={{ marginTop: 4, paddingLeft: 18 }}>
          {items.map((i, idx) => (
            <li key={idx} style={{ fontSize: 13 }}>
              {i}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: 12,
        padding: 12,
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: "#f9fafb",
      }}
    >
      <div style={{ fontSize: 12, color: "#374151" }}>
        <b>Document category:</b> {docCategory}
        {extractionMethod ? ` · Method: ${extractionMethod}` : ""}
        {typeof ocrConfidence === "number"
          ? ` · OCR confidence: ${ocrConfidence}%`
          : ""}
      </div>

      {renderSection("Diagnoses", sectionMap.diagnoses)}
      {renderSection("Risks", sectionMap.risks)}
      {renderSection("Goals", sectionMap.goals)}
      {renderSection("Triggers", sectionMap.triggers)}
      {renderSection("Communication / Engagement", sectionMap.communication)}
      {renderSection("Supports", sectionMap.supports)}
      {renderSection("Recommendations", sectionMap.recommendations)}

      {extractedText ? (
        <details style={{ marginTop: 10 }}>
          <summary style={{ cursor: "pointer", fontSize: 12 }}>
            View raw extracted text (evidence)
          </summary>
          <pre
            style={{
              fontSize: 12,
              whiteSpace: "pre-wrap",
              marginTop: 6,
              background: "#fff",
              padding: 8,
              borderRadius: 6,
              border: "1px solid #e5e7eb",
            }}
          >
            {extractedText}
          </pre>
        </details>
      ) : null}
    </div>
  );
}
