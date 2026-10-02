import { readFileSync } from "fs";
import path from "path";
import { createHash } from "crypto";
import { geminiProvider } from "./gemini";
import { mockProvider } from "./mock";
import type { LlmProvider } from "./types";

export function getProvider(): LlmProvider {
  const provider = process.env.LLM_PROVIDER ?? "mock";
  if (provider === "mock") return mockProvider;
  if (provider === "gemini") {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not set");
    return geminiProvider(key, process.env.LLM_MODEL || "gemini-2.5-flash");
  }
  throw new Error(`Unknown LLM_PROVIDER "${provider}"`);
}

export const PROMPT_VERSION = "analysis.v1+summaries.v1";

/** Prompts live in /prompts so they are versioned and reviewable as plain files. */
export function loadPrompts() {
  const read = (f: string) => readFileSync(path.join(process.cwd(), "prompts", f), "utf8");
  const analysis = read("analysis.v1.md");
  const summaries = read("summaries.v1.md");
  const hash = createHash("sha256").update(analysis).update("\0").update(summaries).digest("hex");
  return { analysis, summaries, version: PROMPT_VERSION, hash };
}
