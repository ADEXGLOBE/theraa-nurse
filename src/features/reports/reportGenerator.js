import {
  generateMonthlyReportObject,
  downloadReportTextFile,
} from "../../engines/reportingEngine";

export function generateMonthlyNdisReport(args) {
  return generateMonthlyReportObject(args);
}

export function downloadMonthlySummary(report) {
  return downloadReportTextFile(report);
}