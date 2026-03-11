export function generateMonthlyReport({
  client,
  sessions,
  incidents,
  adlScores
}) {

  return {
    clientName: client.name,
    period: "Monthly",
    sessionsCompleted: sessions.length,
    incidentsReported: incidents.length,
    adlProgress: adlScores,
    generatedAt: new Date().toISOString(),
    compliance:
      "NDIS Practice Standards - Documentation and Reporting"
  };

}