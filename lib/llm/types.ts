export type LlmTask = "analysis" | "summaries";

export type LlmRequest = {
  task: LlmTask;
  system: string;
  user: string; // the release package JSON, plus validation feedback on retry
  signal: AbortSignal;
};

export type LlmUsage = { inputTokens: number; outputTokens: number };

export type LlmResponse = { text: string; usage: LlmUsage };

export interface LlmProvider {
  name: string;
  model: string;
  complete(req: LlmRequest): Promise<LlmResponse>;
}
