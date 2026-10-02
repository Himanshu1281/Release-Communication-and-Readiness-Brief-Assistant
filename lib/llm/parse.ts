import type { z } from "zod";
import type { Logger } from "../logger";
import type { LlmProvider, LlmTask, LlmUsage } from "./types";

export type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Parse model text as JSON and validate it. Tolerates ```json fences. Unknown keys are stripped. */
export function parseOutput<S extends z.ZodTypeAny>(text: string, schema: S): ParseResult<z.infer<S>> {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let json: unknown;
  try {
    json = JSON.parse(cleaned);
  } catch (e) {
    return { ok: false, error: `Output is not valid JSON: ${(e as Error).message}` };
  }
  const r = schema.safeParse(json);
  if (!r.success) {
    const issues = r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    return { ok: false, error: issues.slice(0, 20).join("\n") };
  }
  return { ok: true, data: r.data };
}

export class LlmOutputError extends Error {
  constructor(
    message: string,
    public attempts: string[],
  ) {
    super(message);
  }
}

/**
 * One model call, validated. If validation fails, retry exactly once with the
 * validation errors appended to the prompt. A second failure throws LlmOutputError
 * carrying every raw attempt so the run can be stored as FAILED.
 */
export async function callValidated<S extends z.ZodTypeAny>(opts: {
  provider: LlmProvider;
  task: LlmTask;
  system: string;
  input: string;
  schema: S;
  signal: AbortSignal;
  log: Logger;
}): Promise<{ data: z.infer<S>; attempts: string[]; usage: LlmUsage }> {
  const attempts: string[] = [];
  const usage: LlmUsage = { inputTokens: 0, outputTokens: 0 };
  let user = opts.input;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await opts.provider.complete({ task: opts.task, system: opts.system, user, signal: opts.signal });
    attempts.push(res.text);
    usage.inputTokens += res.usage.inputTokens;
    usage.outputTokens += res.usage.outputTokens;

    const parsed = parseOutput(res.text, opts.schema);
    if (parsed.ok) return { data: parsed.data, attempts, usage };

    if (attempt === 1) {
      opts.log.warn({ task: opts.task, error: parsed.error }, "ai.validation_retry");
      user = `${opts.input}\n\nYour previous response was invalid:\n${parsed.error}\nReturn corrected JSON only.`;
    } else {
      throw new LlmOutputError(`${opts.task} output failed validation twice: ${parsed.error}`, attempts);
    }
  }
  throw new Error("unreachable");
}
