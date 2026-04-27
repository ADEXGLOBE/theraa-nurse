export function transformMoodToChart(sessions = []) {
  const data = {
    positive: 0,
    neutral: 0,
    low: 0,
  };

  sessions.forEach(s => {
    if (s.mood === "positive") data.positive++;
    else if (s.mood === "low") data.low++;
    else data.neutral++;
  });

  return [
    { name: "Positive", value: data.positive },
    { name: "Neutral", value: data.neutral },
    { name: "Low", value: data.low },
  ];
}