import { GoogleGenAI } from "@google/genai";
import type { LlmProvider, LlmRequest } from "./types";

export function geminiProvider(apiKey: string, model: string): LlmProvider {
  const ai = new GoogleGenAI({ apiKey });
  return {
    name: "gemini",
    model,
    async complete({ system, user, signal }: LlmRequest) {
      const res = await ai.models.generateContent({
        model,
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          temperature: 0,
          // Thinking off keeps both calls well inside the 60s budget.
          thinkingConfig: { thinkingBudget: 0 },
          abortSignal: signal,
        },
      });
      return {
        text: res.text ?? "",
        usage: {
          inputTokens: res.usageMetadata?.promptTokenCount ?? 0,
          outputTokens: res.usageMetadata?.candidatesTokenCount ?? 0,
        },
      };
    },
  };
}
