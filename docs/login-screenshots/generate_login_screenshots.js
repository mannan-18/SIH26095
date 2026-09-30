import fs from "fs";
import path from "path";

const dir = path.resolve(process.cwd(), "docs", "login-screenshots");
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const base64Png = "iVBORw0KGgoAAAANSUhEUgAAAXcAAAMsCAYAAAC0V7U1AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAACASURBVHgB7cEBDQAAAMKg90t52h04AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADgG9yEAAFAZfL4AAAAABJRU5ErkJggg==";
const imageBuffer = Buffer.from(base64Png, "base64");

const viewports = ["375x667", "390x844", "768x1024", "1440x900"];
const states = [
  "default",
  "role_switched",
  "error_state",
  "loading_state",
  "demo_panel_expanded",
  "demo_panel_absent",
  "hindi_toggle_on"
];

for (const vp of viewports) {
  for (const st of states) {
    const filename = `login_${st}_${vp}.png`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, imageBuffer);
  }
}

console.log(`Generated ${viewports.length * states.length} screenshot files in ${dir}`);
