import fs from "node:fs";
import path from "node:path";

// The Admin page is being split into components/admin/*. Static source checks
// that used to grep src/pages/Admin.tsx should read the whole feature, so they
// stay valid wherever a page now lives. Resolved from the package root.
const PAGE = "src/pages/Admin.tsx";
const DIR = "src/components/admin";

export function readAdminFeatureSource(): string {
  const files = [PAGE];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        files.push(full);
      }
    }
  };
  if (fs.existsSync(DIR)) walk(DIR);
  return files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
}
