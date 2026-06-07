import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./env.js";

export type TestFile = {
  absolutePath: string;
  relativePath: string;
  packageRoot: string;
};

const IGNORED_DIRS = new Set(["node_modules", "dist", "build", "__pycache__"]);
const TEST_FILE_PATTERN = /\.test\.tsx?$/;

function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}

function findPackageRoot(filePath: string): string {
  let current = path.dirname(filePath);

  while (current.startsWith(repoRoot)) {
    if (statExists(path.join(current, "package.json"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return repoRoot;
}

function statExists(filePath: string): boolean {
  try {
    statSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function walk(directory: string, files: string[]): void {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        walk(path.join(directory, entry.name), files);
      }
      continue;
    }

    if (entry.isFile() && TEST_FILE_PATTERN.test(entry.name)) {
      files.push(path.join(directory, entry.name));
    }
  }
}

export function discoverTestFiles(root = repoRoot): TestFile[] {
  const absoluteFiles: string[] = [];
  for (const workspaceDir of ["scripts", "artifacts", "lib"]) {
    const fullPath = path.join(root, workspaceDir);
    if (statExists(fullPath)) {
      walk(fullPath, absoluteFiles);
    }
  }

  return absoluteFiles
    .sort((left, right) => left.localeCompare(right))
    .map((absolutePath) => ({
      absolutePath,
      relativePath: toPosixPath(path.relative(root, absolutePath)),
      packageRoot: findPackageRoot(absolutePath),
    }));
}
