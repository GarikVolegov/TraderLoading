import fs from "node:fs";
import path from "node:path";

// The Settings page was split into components/settings/*. Static source checks
// that used to grep src/pages/Settings.tsx should read the whole feature, so
// they stay valid wherever a given section now lives. Paths are resolved from
// the package root (the test runner sets cwd there).
const PAGE = "src/pages/Settings.tsx";
const DIR = "src/components/settings";

export function listSettingsFeatureFiles(): string[] {
  const files = [PAGE];
  if (fs.existsSync(DIR)) {
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) files.push(full);
      }
    };
    walk(DIR);
  }
  return files;
}

export function readSettingsFeatureSource(): string {
  return listSettingsFeatureFiles()
    .map((file) => fs.readFileSync(file, "utf8"))
    .join("\n");
}
