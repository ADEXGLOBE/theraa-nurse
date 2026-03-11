export const ADL_FIELDS = [
  "bathing",
  "dressing",
  "toileting",
  "mobility",
  "feeding",
  "continence"
];

export function calculateADLScore(adlData) {
  let total = 0;

  ADL_FIELDS.forEach(field => {
    total += Number(adlData[field] || 0);
  });

  return {
    total,
    independenceLevel:
      total >= 18
        ? "Independent"
        : total >= 12
        ? "Moderate Support"
        : "High Support"
  };
}