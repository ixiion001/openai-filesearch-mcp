import { z } from "zod";
import fs from "node:fs"; // Need fs again
import type { AppConfig } from "./types.js";

// Define the schema for config.json
const FileConfigSchema = z.object({
  vectorStoreId: z
    .string()
    .startsWith("vs_", "vectorStoreId in config.json must start with vs_"),
});

// Define the schema for required environment variables
const EnvSchema = z.object({
  OPENAI_API_KEY: z
    .string()
    .min(1, "OPENAI_API_KEY environment variable is not set or empty"),
  DEBUG_OPENAI: z.string().optional(), // Added optional DEBUG_OPENAI flag
});

/**
 * Loads and validates the application configuration from config.json and environment variables.
 * @returns The validated AppConfig object.
 * @throws Error if configuration is missing or invalid.
 */
export function loadConfig(): AppConfig {
  // 1. Load and validate config.json
  let fileCfg: z.infer<typeof FileConfigSchema>;
  try {
    const configPath = new URL("../config.json", import.meta.url);
    const rawConfig = fs.readFileSync(configPath, "utf8");
    const parsedConfig = JSON.parse(rawConfig);
    const fileResult = FileConfigSchema.safeParse(parsedConfig);
    if (!fileResult.success) {
      const errorMessages = fileResult.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      console.error("config.json validation failed:", errorMessages);
      throw new Error(`config.json validation failed: ${errorMessages}`);
    }
    fileCfg = fileResult.data;
    console.log("config.json loaded and validated successfully.");
  } catch (error: unknown) {
    // Use unknown for safer error handling
    const message = error instanceof Error ? error.message : String(error);
    console.error("Failed to load or parse config.json:", message);
    throw new Error(`Failed to load or parse config.json: ${message}`);
  }

  // 2. Validate environment variables
  const envResult = EnvSchema.safeParse(process.env);
  if (!envResult.success) {
    const errorMessages = envResult.error.errors
      .map((e) => `${e.path.join(".")}: ${e.message}`)
      .join("; ");
    console.error("Environment variable validation failed:", errorMessages);
    throw new Error(`Environment variable validation failed: ${errorMessages}`);
  }
  const { OPENAI_API_KEY, DEBUG_OPENAI } = envResult.data;
  console.log("Environment variables validated successfully.");

  // Parse DEBUG_OPENAI flag (defaulting to false)
  const debugOpenai = ["true", "1"].includes(DEBUG_OPENAI?.toLowerCase() ?? "");
  if (DEBUG_OPENAI !== undefined) {
    console.log(`DEBUG_OPENAI flag set to: ${debugOpenai}`);
  } else {
    console.log("DEBUG_OPENAI flag not set, defaulting to false.");
  }

  // 3. Combine and return the configuration
  const appConfig: AppConfig = {
    vectorStoreId: fileCfg.vectorStoreId,
    openaiApiKey: OPENAI_API_KEY,
    debugOpenai: debugOpenai, // Added debug flag
  };

  console.log("Configuration loaded successfully.");
  return appConfig;
}
