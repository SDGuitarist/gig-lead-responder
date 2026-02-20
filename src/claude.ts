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
 */
export async function callClaude<T>(
  systemPrompt: string,
  userMessage: string,
  model: string = "claude-sonnet-4-6"
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

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Retry with reinforcement
    console.warn("JSON parse failed on first attempt, retrying...");
    const retryResponse = await makeRequest(
      "IMPORTANT: Return ONLY valid JSON. No markdown code fences, no explanation, no prose. Just the raw JSON object."
    );
    const retryCleaned = stripCodeFences(retryResponse);

    try {
      return JSON.parse(retryCleaned) as T;
    } catch {
      throw new Error(
        `Failed to parse JSON after retry.\nRaw response:\n${retryResponse}`
      );
    }
  }
}

/**
 * Call Claude and return raw text (no JSON parsing).
 * Used for generation where response is prose, not structured data.
 */
export async function callClaudeText(
  systemPrompt: string,
  userMessage: string,
  model: string = "claude-sonnet-4-6"
): Promise<string> {
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error(`Unexpected response type: ${block.type}`);
  }
  return block.text;
}
