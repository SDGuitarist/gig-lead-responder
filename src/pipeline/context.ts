import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ContextError } from "../errors.js";
import type { Classification, VenueContext } from "../types.js";
import { formatVenueContext } from "./format-venue-context.js";

const DOCS_DIR = join(process.cwd(), "docs");

/**
 * Read a file from docs/ directory. Returns content or null if missing.
 */
async function readDoc(filename: string, required: boolean): Promise<string | null> {
  try {
    return await readFile(join(DOCS_DIR, filename), "utf-8");
  } catch {
    if (required) {
      throw new ContextError(`Required file missing: docs/${filename}`);
    }
    console.warn(`Optional file missing: docs/${filename} — skipping`);
    return null;
  }
}

/**
 * Stage 3: Select and assemble context files based on classification.
 * Required files throw on missing. Optional files skip with warning.
 */
export async function selectContext(
  classification: Classification,
  venueContext?: VenueContext | null,
): Promise<string> {
  const sections: string[] = [];

  // Always include — REQUIRED
  const responseCraft = await readDoc("RESPONSE_CRAFT.md", true);
  sections.push(`## RESPONSE FRAMEWORK\n\n${responseCraft}`);

  const pricing = await readDoc("PRICING_TABLES.md", true);
  sections.push(`## PRICING REFERENCE\n\n${pricing}`);

  // Venue intelligence from PF-Intel — placed high when it has real data
  // because lead-specific context should get more attention weight than generic docs.
  const formattedVenue = venueContext ? formatVenueContext(venueContext) : null;
  if (formattedVenue) {
    sections.push(formattedVenue
      + "\n\n**How to use this:** Venue intel is your insider edge. If there are past events, reference the venue's track record in your cinematic opening or differentiator (e.g., \"I've played this room before\" or \"events at [venue] tend to...\"). If there are vendor policies (curfew, dB limits, setup rules), preempt logistics concerns by naming them before the client asks. If there are contacts, mention coordination will be smooth.");
  }

  // Always include — optional
  const principles = await readDoc("PRINCIPLES.md", false);
  if (principles) {
    sections.push(`## CORE PRINCIPLES\n\n${principles}`);
  }

  // Conditional: cultural context
  if (classification.cultural_context_active && classification.cultural_tradition === "spanish_latin") {
    const cultural = await readDoc("CULTURAL_SPANISH_LATIN.md", false);
    if (cultural) {
      sections.push(`## CULTURAL CONTEXT: SPANISH/LATIN\n\n${cultural}`);
    }
    const culturalCore = await readDoc("CULTURAL_CORE.md", false);
    if (culturalCore) {
      sections.push(`## CULTURAL CORE FRAMEWORK\n\n${culturalCore}`);
    }
  }

  // No venue data — omit the section entirely (no need to tell the LLM about absent data)

  const quickRef = await readDoc("QUICK_REFERENCE.md", false);
  if (quickRef) {
    sections.push(`## QUICK REFERENCE\n\n${quickRef}`);
  }

  return sections.join("\n\n---\n\n");
}
