export function generateIncidentReport({
  client,
  worker,
  description,
  detectedSignals
}) {

  return {
    incidentId: Date.now(),
    clientId: client.id,
    clientName: client.name,
    reportedBy: worker,
    description,
    abuseSignals: detectedSignals,
    severity: detectedSignals.length ? "High" : "Medium",
    date: new Date().toISOString(),
    compliance: "NDIS Incident Management Rules 2018"
  };

}