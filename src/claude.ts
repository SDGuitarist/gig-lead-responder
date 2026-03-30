import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

/**
 * Strip markdown code fences from Claude's response.
 * Claude sometimes wraps JSON in ```json ... ``` blocks.
 */
function stripCodeFences(text: string): string {
  const fencePattern = /^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/;
  const match = text.trim().match(fencePattern);
  return match ? match[1].trim() : text.trim();
}

/**
 * Call Claude and parse the response as JSON.
 * Strips code fences, parses JSON. On failure, retries once
 * with "return only valid JSON" reinforcement.
 *
 * @param validate — optional runtime validator. Receives the parsed JSON
 *   and should throw if the shape is wrong. Returns the validated value.
 *   If omitted, the raw JSON.parse result is returned (unsafe).
 */
export async function callClaude<T>(
  systemPrompt: string,
  userMessage: string,
  model: string = "claude-sonnet-4-6",
  validate?: (raw: unknown) => T
): Promise<T> {
  const makeRequest = async (extraInstruction?: string): Promise<string> => {
    const finalUser = extraInstruction
      ? `${userMessage}\n\n${extraInstruction}`
      : userMessage;

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: finalUser }],
    });

    const block = response.content[0];
    if (block.type !== "text") {
      throw new Error(`Unexpected response type: ${block.type}`);
    }
    return block.text;
  };

  // First attempt
  const rawResponse = await makeRequest();
  const cleaned = stripCodeFences(rawResponse);

  const parseAndValidate = (raw: string): T => {
    const parsed = JSON.parse(raw);
    return validate ? validate(parsed) : parsed as T;
  };

  try {
    return parseAndValidate(cleaned);
  } catch (err) {
    // If validation failed (not JSON parse), don't retry — the LLM returned wrong shape
    if (cleaned !== rawResponse && err instanceof Error && !err.message.includes("JSON")) {
      throw new Error(`Claude response failed validation: ${err.message}`);
    }

    // Retry with reinforcement for JSON parse failures
    console.warn("JSON parse failed on first attempt, retrying...");
    const retryResponse = await makeRequest(
      "IMPORTANT: Return ONLY valid JSON. No markdown code fences, no explanation, no prose. Just the raw JSON object."
    );
    const retryCleaned = stripCodeFences(retryResponse);

    try {
      return parseAndValidate(retryCleaned);
    } catch {
      throw new Error(
        `Failed to parse/validate JSON after retry.`
      );
    }
  }
}