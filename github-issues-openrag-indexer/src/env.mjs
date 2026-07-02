import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const equalsIndex = trimmed.indexOf("=");

  if (equalsIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function loadDotEnv(path = ".env") {
  const envPath = resolve(process.cwd(), path);

  if (!existsSync(envPath)) {
    return;
  }

  const content = readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/u)) {
    const parsed = parseEnvLine(line);

    if (!parsed) {
      continue;
    }

    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  }
}

function envString(name, fallback = "") {
  return (process.env[name] ?? fallback).trim();
}

function requiredEnv(name) {
  const value = envString(name);

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function envBoolean(name, fallback = false) {
  const value = envString(name, String(fallback)).toLowerCase();

  return ["1", "true", "yes", "y", "on"].includes(value);
}

function envNumber(name, fallback) {
  const value = Number(envString(name, String(fallback)));

  if (!Number.isFinite(value)) {
    return fallback;
  }

  return value;
}

function envCsv(name) {
  return envString(name)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export {
  envBoolean,
  envCsv,
  envNumber,
  envString,
  loadDotEnv,
  requiredEnv
};
