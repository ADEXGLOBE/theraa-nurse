// src/features/safety/incidentReportGenerator.js
// Generates an NDIS/Aged Care style incident report object (exportable to PDF later).

const safe = (v) => (v == null ? "" : String(v));

export function generateIncidentReport({
  client,
  incidentType,          // "physical" | "psychological" | "financial" | "neglect" | "other"
  incidentSummary,       // what happened
  dateTime,              // ISO or string
  location,              // where
  immediateActions,      // what you did
  risks,                 // risks identified
  suspectedAbuseType,    // if relevant
  escalation,            // who it was reported to
  witnesses,             // array strings
  attachments,           // array strings
  reporterName,          // you
  organisationName,      // optional
}) {
  return {
    id: `inc-${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`,
    createdAt: new Date().toISOString(),

    organisationName: safe(organisationName),
    reporterName: safe(reporterName),

    client: {
      id: safe(client?.id),
      name: safe(client?.name),
      age: safe(client?.age),
    },

    incident: {
      type: safe(incidentType),
      dateTime: safe(dateTime || new Date().toLocaleString()),
      location: safe(location),
      summary: safe(incidentSummary),
      immediateActions: safe(immediateActions),
      risks: safe(risks),
      suspectedAbuseType: safe(suspectedAbuseType),
      escalation: safe(escalation),
      witnesses: Array.isArray(witnesses) ? witnesses.filter(Boolean) : [],
      attachments: Array.isArray(attachments) ? attachments.filter(Boolean) : [],
    },

    complianceNote:
      "Note: This report is generated to support documentation. It does not replace organisational policies, professional judgement, or mandatory reporting duties.",
  };
}