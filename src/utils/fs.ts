import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Ensures that a directory exists.
 */
export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

/**
 * Reads a UTF-8 file if present.
 */
export async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

/**
 * Writes UTF-8 content and creates parent directories.
 */
export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
}

/**
 * Resolves a path relative to current working directory.
 */
export function resolveFromCwd(p: string): string {
  return path.resolve(process.cwd(), p);
}
