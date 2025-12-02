// src/components/ClientList.jsx
import React from "react";
import { clients } from "../data/clients";

export default function ClientList({ onSelectClient }) {
  // Only show clients whose main work happens in Therapy Zone
  const therapyClients = clients.filter((c) => c.primaryZone === "therapy");

  return (
    <div className="border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-medium">Therapy Zone clients</h2>
          <p className="text-xs text-gray-500">
            Demo clients from your aged care / disability scenarios.
          </p>
        </div>
        <button className="px-3 py-1 rounded-full bg-black text-white text-xs">
          + Add client
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-2 pr-4">Name</th>
              <th className="py-2 pr-4">Age</th>
              <th className="py-2 pr-4">Diagnoses</th>
              <th className="py-2 pr-4">Key risks</th>
              <th className="py-2 pr-4">Last session</th>
              <th className="py-2 pr-4"></th>
            </tr>
          </thead>
          <tbody>
            {therapyClients.map((c) => (
              <tr key={c.id} className="border-b last:border-0">
                <td className="py-2 pr-4 font-medium">{c.name}</td>
                <td className="py-2 pr-4">{c.age}</td>
                <td className="py-2 pr-4">
                  {c.diagnoses && c.diagnoses.join(", ")}
                </td>
                <td className="py-2 pr-4">
                  {c.keyRisks && c.keyRisks.join(", ")}
                </td>
                <td className="py-2 pr-4 text-gray-500">{c.lastSession}</td>
                <td className="py-2 pr-4 text-right">
                  <button
                    onClick={() => onSelectClient(c)}
                    className="px-3 py-1 rounded-full text-xs bg-gray-900 text-white"
                  >
                    Open profile
                  </button>
                </td>
              </tr>
            ))}
            {therapyClients.length === 0 && (
              <tr>
                <td className="py-3 text-sm text-gray-500" colSpan={6}>
                  No clients assigned to the Therapy Zone yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
