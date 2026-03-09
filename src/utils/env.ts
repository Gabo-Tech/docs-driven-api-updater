import dotenv from "dotenv";

/**
 * Loads .env into process env exactly once.
 */
export function loadEnv(): void {
  dotenv.config();
}

/**
 * Reads an environment variable and trims whitespace.
 */
export function env(name: string): string | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }
  return value.trim();
}

/**
 * Reads a numeric environment variable with fallback.
 */
export function envNumber(name: string, fallback: number): number {
  const value = env(name);
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
