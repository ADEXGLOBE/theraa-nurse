export function generateIncidentReport(note){

return {

date: new Date().toISOString(),

summary: note,

riskLevel: detectRisk(note),

status: "pending-review"

}

}

function detectRisk(text){

const lower = text.toLowerCase()

if(lower.includes("fall") || lower.includes("injury"))
return "high"

if(lower.includes("agitated") || lower.includes("distress"))
return "medium"

return "low"

}