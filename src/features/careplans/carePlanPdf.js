// src/features/careplans/carePlanPdf.js
import jsPDF from "jspdf";

export function generateCarePlanPdf({ client, planVersion }) {
  const doc = new jsPDF();

  let y = 15;

  const line = (text) => {
    doc.text(text, 14, y);
    y += 8;
  };

  doc.setFontSize(16);
  line("Theraa Nurse – Care Plan");

  doc.setFontSize(11);
  y += 4;

  line(`Client: ${client.name}`);
  line(`Age: ${client.age}`);
  line(`Client ID: ${client.id}`);
  line(`Plan status: ${planVersion.status}`);
  line(`Created: ${new Date(planVersion.createdAt).toLocaleString()}`);
  line(`Evidence items used: ${planVersion.evidenceCount || 0}`);

  y += 6;
  doc.setFontSize(13);
  line("Short-term goals");
  doc.setFontSize(11);
  line(planVersion.plan.goalsShort || "—");

  y += 4;
  doc.setFontSize(13);
  line("Long-term goals");
  doc.setFontSize(11);
  line(planVersion.plan.goalsLong || "—");

  y += 4;
  doc.setFontSize(13);
  line("Risks & safety considerations");
  doc.setFontSize(11);
  line(planVersion.plan.risks || "—");

  y += 4;
  doc.setFontSize(13);
  line("Communication strategies");
  doc.setFontSize(11);
  line(planVersion.plan.communication || "—");

  y += 4;
  doc.setFontSize(13);
  line("Supports");
  doc.setFontSize(11);
  line(planVersion.plan.supports || "—");

  y += 4;
  doc.setFontSize(13);
  line("Legal & ethical notes");
  doc.setFontSize(11);
  line(planVersion.plan.legalEthical || "—");

  doc.save(
    `TheraaNurse-CarePlan-${client.name.replace(/\s+/g, "_")}.pdf`
  );
}
