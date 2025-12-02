// src/pages/TherapyZone.jsx
import React, { useState } from "react";
import ClientList from "../components/ClientList";

export default function TherapyZone() {
  const [view, setView] = useState("overview");

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Therapy Zone</h1>
        <p className="text-sm text-gray-500">
          Sessions, engagement & mood for Theraa Nurse clients.
        </p>
      </div>

      {/* 🔹 Tabs INSIDE the Therapy Zone */}
      <div className="flex gap-2 border-b pb-2">
        <button
          onClick={() => setView("overview")}
          className={`px-3 py-1 rounded-full text-sm ${
            view === "overview" ? "bg-black text-white" : "bg-gray-100"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setView("clients")}
          className={`px-3 py-1 rounded-full text-sm ${
            view === "clients" ? "bg-black text-white" : "bg-gray-100"
          }`}
        >
          Clients
        </button>
      </div>

      {/* 👉 Overview = what you already have now */}
      {view === "overview" && (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-xl p-4">
              <p className="text-xs text-gray-500">Active clients</p>
              <p className="text-2xl font-semibold">8</p>
            </div>
            <div className="border rounded-xl p-4">
              <p className="text-xs text-gray-500">
                Open progress notes (today)
              </p>
              <p className="text-2xl font-semibold">12</p>
            </div>
            <div className="border rounded-xl p-4">
              <p className="text-xs text-gray-500">Alerts</p>
              <p className="text-2xl font-semibold text-red-500">3</p>
            </div>
          </section>

          <section className="border rounded-xl p-4">
            <h2 className="font-medium mb-1">Zone details</h2>
            <p className="text-sm text-gray-600">
              We’ll later plug in events, uploads (FileVault), and client
              experience analytics here.
              <br />
              The Therapy Zone is where clients connect with support workers,
              counsellors or remote therapists. It will show session history,
              engagement level, and basic mood indicators.
              <br />
              We can later add a list of today&apos;s therapy sessions and a
              quick button to add a progress note after each interaction.
            </p>
          </section>
        </>
      )}

      {/* 👉 Clients tab */}
      {view === "clients" && <ClientList />}
    </div>
  );
}
