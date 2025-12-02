// src/components/ClientProfile.jsx
import React, { useState } from "react";

const defaultBodySystems = [
  "Respiratory",
  "Cardiovascular / Circulation",
  "Gastrointestinal",
  "Musculoskeletal & mobility",
  "Neurological / cognition",
  "Skin / integumentary",
  "Mental health / behaviour",
];

const moodOptions = ["Calm", "Flat", "Anxious", "Agitated", "Happy"];

export default function ClientProfile({ client, onBack }) {
  const [checkedSystems, setCheckedSystems] = useState([]);
  const [todayMood, setTodayMood] = useState("");
  const [progressNote, setProgressNote] = useState("");
  const [hasMedicationAlert, setHasMedicationAlert] = useState(false);

  const toggleSystem = (system) => {
    setCheckedSystems((prev) =>
      prev.includes(system)
        ? prev.filter((s) => s !== system)
        : [...prev, system]
    );
  };

  const handleSaveNote = (e) => {
    e.preventDefault();
    // later: send to backend – for now we just clear the box
    if (progressNote.trim()) {
      alert("Progress note saved (demo only).");
      setProgressNote("");
    }
  };

  if (!client) return null;

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={onBack}
        className="self-start text-xs px-3 py-1 rounded-full border mb-1"
      >
        ← Back to clients
      </button>

      {/* Header */}
      <div className="border rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">
            {client.name}{" "}
            <span className="text-sm font-normal text-gray-500">
              ({client.age})
            </span>
          </h2>
          <p className="text-xs text-gray-500">
            Primary zone: {client.primaryZone.toUpperCase()}
          </p>
          <p className="text-sm mt-1 text-gray-600">
            {client.moodSummary || "No mood summary recorded yet."}
          </p>
        </div>
        <div className="text-sm">
          <p className="text-xs text-gray-500 mb-1">Key risks</p>
          <ul className="text-xs text-gray-700 list-disc pl-4">
            {(client.keyRisks || []).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Grid: body systems + mood + medication alert + notes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Body systems checklist */}
        <div className="border rounded-xl p-4">
          <h3 className="font-medium mb-2">Body systems check (SUCQ)</h3>
          <p className="text-xs text-gray-500 mb-2">
            Tick what you observed this shift. Use this for your{" "}
            <strong>Recognise healthy body systems</strong> evidence.
          </p>
          <div className="flex flex-col gap-1 text-sm">
            {defaultBodySystems.map((system) => (
              <label key={system} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checkedSystems.includes(system)}
                  onChange={() => toggleSystem(system)}
                />
                <span>{system}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Mood + medication alerts */}
        <div className="flex flex-col gap-4">
          <div className="border rounded-xl p-4">
            <h3 className="font-medium mb-2">Today’s mood</h3>
            <p className="text-xs text-gray-500 mb-2">
              Quick mood snapshot after today&apos;s contact.
            </p>
            <div className="flex flex-wrap gap-2">
              {moodOptions.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTodayMood(m)}
                  className={`px-3 py-1 rounded-full text-xs border ${
                    todayMood === m ? "bg-black text-white" : ""
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            {todayMood && (
              <p className="mt-2 text-xs text-gray-600">
                Recorded mood for today:{" "}
                <span className="font-medium">{todayMood}</span>
              </p>
            )}
          </div>

          <div className="border rounded-xl p-4">
            <h3 className="font-medium mb-2">Medication alerts</h3>
            <p className="text-xs text-gray-500 mb-2">
              Simple flag for now – later we can plug in real med schedules.
            </p>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={hasMedicationAlert}
                onChange={() => setHasMedicationAlert((v) => !v)}
              />
              <span>Flag medication issue for follow-up</span>
            </label>
            {hasMedicationAlert && (
              <p className="mt-2 text-xs text-red-600">
                ⚠️ Marked for medication follow-up in handover.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Progress notes */}
      <form onSubmit={handleSaveNote} className="border rounded-xl p-4">
        <h3 className="font-medium mb-2">Progress note (today)</h3>
        <p className="text-xs text-gray-500 mb-2">
          Short, objective note – what you saw, what you did, and how they
          responded.
        </p>
        <textarea
          value={progressNote}
          onChange={(e) => setProgressNote(e.target.value)}
          rows={4}
          className="w-full border rounded-lg p-2 text-sm"
          placeholder="E.g. 'Visited for 30 minutes. Walked to garden with 4WW, supervised. Balanced steady, no shortness of breath. Mood improved after music and conversation.'"
        />
        <div className="mt-2 flex justify-end">
          <button
            type="submit"
            className="px-4 py-1.5 rounded-full bg-black text-white text-xs"
          >
            Save note (demo)
          </button>
        </div>
      </form>
    </div>
  );
}
