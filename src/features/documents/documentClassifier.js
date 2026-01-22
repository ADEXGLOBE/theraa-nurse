// src/features/documents/documentClassifier.js

export function classifyDocument(text = "", fileName = "") {
  const t = text.toLowerCase();
  const f = fileName.toLowerCase();

  if (/psycholog|diagnostic|clinical impression|mental health/i.test(t))
    return "psychological_report";

  if (/behavio(u)?r support plan|bsp/i.test(t))
    return "bsp";

  if (/ndis plan|participant statement|funding/i.test(t))
    return "ndis_plan";

  if (/incident|fall|injury|aggression/i.test(t))
    return "incident_report";

  if (/medication|mar|dose|chart/i.test(t))
    return "med_chart";

  if (/risk assessment|hazard|safety/i.test(t))
    return "risk_assessment";

  return "session_note";
}
