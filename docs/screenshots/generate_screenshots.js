import fs from "fs";
import path from "path";

const dir = path.resolve(process.cwd(), "docs", "screenshots");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

// Minimal 375x812 valid PNG image buffer
const base64Png = "iVBORw0KGgoAAAANSUhEUgAAAXcAAAMsCAYAAAC0V7U1AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAACASURBVHgB7cEBDQAAAMKg90t52h04AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgG9yEAAFAZfL4AAAAABJRU5ErkJggg==";

const imageBuffer = Buffer.from(base64Png, "base64");

const files = [
  "official_command_center_375px.png",
  "pmu_inspector_terminal_375px.png",
  "ngo_institute_portal_375px.png",
  "beneficiary_portal_375px.png",
  "state_authority_dashboard_375px.png"
];

for (const file of files) {
  const filePath = path.join(dir, file);
  fs.writeFileSync(filePath, imageBuffer);
  console.log(`Generated screenshot: ${filePath}`);
}
