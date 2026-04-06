export function generateMonthlyReport({

client,
sessions,
adlScores,
incidents

}){

return {

clientName: client.name,

totalSessions: sessions.length,

adlTrend: calculateTrend(adlScores),

incidentCount: incidents.length,

recommendations: buildRecommendations(sessions)

}

}

function calculateTrend(scores){

if(scores.length < 2) return "stable"

const first = scores[0]
const last = scores[scores.length-1]

if(last > first) return "improving"
if(last < first) return "declining"

return "stable"

}

function buildRecommendations(sessions){

const notes = sessions.map(s => s.note).join(" ")

if(notes.includes("anxious"))
return "Review anxiety triggers"

return "Continue current support plan"

}