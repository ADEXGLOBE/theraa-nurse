import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { loadClients } from "../data/clientsStore";

export default function KnowledgeEngine() {
  const { user } = useAuth();
  const clients = useMemo(() => loadClients(user?.id), [user?.id]);

  const [selectedClientId, setSelectedClientId] = useState("");
  const [evidence, setEvidence] = useState("");
  const [knowledge, setKnowledge] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const participant =
    clients.find((c) => c.id === selectedClientId) || clients[0] || null;

  async function runKnowledgeEngine() {
    if (!participant) {
      alert("Please select or add a participant first.");
      return;
    }

    setLoading(true);
    setResult("");

    try {
      const res = await fetch("/api/knowledge-engine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant, evidence, knowledge }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Request failed");

      setResult(data.result || "");
    } catch (error) {
      console.error(error);
      alert("Knowledge Engine failed. Check console.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="zone-page knowledge-page">
      <div className="knowledge-hero">
        <div>
          <div className="eyebrow">Theraa Nurse AI</div>
          <h1>Knowledge Engine</h1>
          <p>
            Combine participant evidence, structured care knowledge and LLM reasoning
            to generate purpose-centred support recommendations.
          </p>
        </div>
      </div>

      <div className="card premium-card">
        <div className="card-title">Select Participant</div>
        <select
          className="input"
          value={participant?.id || ""}
          onChange={(e) => setSelectedClientId(e.target.value)}
        >
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} {c.age ? `(${c.age})` : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="two-column">
        <div className="card premium-card">
          <div className="card-title">Participant Evidence</div>
          <div className="card-subtitle">
            Paste progress notes, care plans, incident notes, assessments or document extracts.
          </div>
          <textarea
            className="textarea knowledge-textarea"
            value={evidence}
            onChange={(e) => setEvidence(e.target.value)}
            placeholder="Paste participant evidence here..."
          />
        </div>

        <div className="card premium-card">
          <div className="card-title">Structured Care Knowledge</div>
          <div className="card-subtitle">
            Paste class PDF content, NDIS guidance, aged care principles or care frameworks.
          </div>
          <textarea
            className="textarea knowledge-textarea"
            value={knowledge}
            onChange={(e) => setKnowledge(e.target.value)}
            placeholder="Paste care knowledge here..."
          />
        </div>
      </div>

      <button
        className="btn-primary knowledge-run"
        onClick={runKnowledgeEngine}
        disabled={loading}
      >
        {loading ? "Running Knowledge Engine..." : "Generate Purpose-Centred Intelligence"}
      </button>

      {result && (
        <div className="card premium-card knowledge-result">
          <div className="card-title">Knowledge Engine Output</div>
          <pre>{result}</pre>
        </div>
      )}
    </div>
  );
}