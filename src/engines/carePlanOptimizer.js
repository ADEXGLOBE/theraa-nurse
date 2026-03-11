export function optimiseCarePlan(plan, sessions) {

  const suggestions = [];

  sessions.forEach(session => {

    if (session.notes?.includes("fall")) {
      suggestions.push({
        type: "risk",
        suggestion: "Introduce fall prevention strategy"
      });
    }

    if (session.notes?.includes("anxious")) {
      suggestions.push({
        type: "mental health",
        suggestion: "Consider behavioural support strategies"
      });
    }

  });

  return suggestions;

}