// src/components/CarePlanDiffView.jsx
function normalize(s) {
  return String(s || "").replace(/\r/g, "").trim();
}

function splitLines(s) {
  const t = normalize(s);
  if (!t) return [];
  return t.split("\n").map((x) => x.trim()).filter(Boolean);
}

function simpleLineDiff(prev, next) {
  const a = new Set(splitLines(prev));
  const b = new Set(splitLines(next));
  const added = [];
  const removed = [];

  for (const line of b) if (!a.has(line)) added.push(line);
  for (const line of a) if (!b.has(line)) removed.push(line);

  return { added, removed };
}

function SectionDiff({ title, prevText, nextText }) {
  const { added, removed } = simpleLineDiff(prevText, nextText);
  const changed = added.length > 0 || removed.length > 0;

  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        background: changed ? "#fff" : "#f9fafb",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div style={{ fontSize: 12, color: "#6b7280" }}>
          {changed ? "Changed" : "No change"}
        </div>
      </div>

      {!changed ? (
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>
          No detectable line changes.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 10 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#065f46" }}>Added</div>
            {added.length === 0 ? (
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>None</div>
            ) : (
              <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                {added.map((x, i) => (
                  <li key={i} style={{ fontSize: 13 }}>{x}</li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>Removed</div>
            {removed.length === 0 ? (
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6 }}>None</div>
            ) : (
              <ul style={{ marginTop: 6, paddingLeft: 18 }}>
                {removed.map((x, i) => (
                  <li key={i} style={{ fontSize: 13 }}>{x}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CarePlanDiffView({ previousVersion, currentVersion }) {
  if (!currentVersion) return null;

  const prevPlan = previousVersion?.plan || {};
  const curPlan = currentVersion?.plan || {};

  return (
    <div className="card" style={{ marginTop: 12 }}>
      <div className="card-title">What changed since last version</div>
      <div className="card-subtitle">
        Compares the selected version to the previous snapshot for audit and review.
      </div>

      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
        Previous: {previousVersion ? (previousVersion.status || "draft").toUpperCase() : "None"} ·
        Current: {(currentVersion.status || "draft").toUpperCase()}
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        <SectionDiff title="Short-term goals" prevText={prevPlan.goalsShort} nextText={curPlan.goalsShort} />
        <SectionDiff title="Long-term goals" prevText={prevPlan.goalsLong} nextText={curPlan.goalsLong} />
        <SectionDiff title="Risks & safety" prevText={prevPlan.risks} nextText={curPlan.risks} />
        <SectionDiff title="Communication strategies" prevText={prevPlan.communication} nextText={curPlan.communication} />
        <SectionDiff title="Supports & actions" prevText={prevPlan.supports} nextText={curPlan.supports} />
        <SectionDiff title="Legal / ethical" prevText={prevPlan.legalEthical} nextText={curPlan.legalEthical} />
      </div>
    </div>
  );
}
