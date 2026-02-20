import "dotenv/config";

// Validate API key on startup
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("Error: ANTHROPIC_API_KEY not set in .env file");
  process.exit(1);
}

async function main() {
  // Read lead from stdin
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  const rawText = Buffer.concat(chunks).toString("utf-8").trim();

  if (!rawText) {
    console.error("Error: No lead text provided. Pipe text via stdin:");
    console.error("  echo 'lead text...' | npx tsx src/index.ts");
    process.exit(1);
  }

  console.log("Pipeline not yet implemented.");
  console.log(`Received lead: ${rawText.length} characters`);
}

main().catch((err) => {
  console.error("Pipeline error:", err.message);
  process.exit(1);
});
