import Anthropic from "@anthropic-ai/sdk";

type ClaudeMessageRequest = Parameters<Anthropic["messages"]["create"]>[0];
type ClaudeMessageResponse = Awaited<ReturnType<Anthropic["messages"]["create"]>>;
type ClaudeRequester = (request: ClaudeMessageRequest) => Promise<ClaudeMessageResponse>;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}

const defaultClaudeRequester: ClaudeRequester = (request) => getClient().messages.create(request);
let requestClaudeMessage: ClaudeRequester = defaultClaudeRequester;

export function setClaudeRequesterForTests(requester?: ClaudeRequester): void {
  requestClaudeMessage = requester ?? defaultClaudeRequester;
}

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
 * @param validate - Optional runtime validator. If provided, parsed JSON is
 *   passed through it before returning. Throw on invalid shape.
 */
export async function callClaude<T>(
  systemPrompt: string,
  userMessage: string,
  model: string = "claude-sonnet-4-6",
  validate?: (raw: unknown) => T,
): Promise<T> {
  const makeRequest = async (extraInstruction?: string): Promise<string> => {
    const finalUser = extraInstruction
      ? `${userMessage}\n\n${extraInstruction}`
      : userMessage;

    const response = await requestClaudeMessage({
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

  const parseAndValidate = (text: string): T => {
    const parsed = JSON.parse(text);
    return validate ? validate(parsed) : parsed as T;
  };

  try {
    return parseAndValidate(cleaned);
  } catch {
    // Retry with reinforcement
    console.warn("JSON parse/validation failed on first attempt, retrying...");
    const retryResponse = await makeRequest(
      "IMPORTANT: Return ONLY valid JSON. No markdown code fences, no explanation, no prose. Just the raw JSON object."
    );
    const retryCleaned = stripCodeFences(retryResponse);

    try {
      return parseAndValidate(retryCleaned);
    } catch {
      throw new Error("Failed to parse Claude JSON response after retry.");
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
  model: string = "claude-sonnet-4-6",
  maxTokens: number = 4096,
): Promise<string> {
  const response = await requestClaudeMessage({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = response.content[0];
  if (block.type !== "text") {
    throw new Error(`Unexpected response type: ${block.type}`);
  }
  return block.text;
}
