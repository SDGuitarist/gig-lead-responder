import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Classification } from "../types.js";

const DOCS_DIR = join(import.meta.dirname, "..", "..", "docs");

// Cache docs in memory — they are static reference files (~93KB total)
const docCache = new Map<string, string | null>();

/**
 * Read a file from docs/ directory. Caches after first read.
 */
async function readDoc(filename: string, required: boolean): Promise<string | null> {
  if (docCache.has(filename)) return docCache.get(filename)!;
  try {
    const content = await readFile(join(DOCS_DIR, filename), "utf-8");
    docCache.set(filename, content);
    return content;
  } catch {
    if (required) {
      throw new Error(`Required file missing: docs/${filename}`);
    }
    console.warn(`Optional file missing: docs/${filename} — skipping`);
    docCache.set(filename, null);
    return null;
  }
}

/**
 * Stage 3: Select and assemble context files based on classification.
 * Required files throw on missing. Optional files skip with warning.
 */
export async function selectContext(classification: Classification): Promise<string> {
  const sections: string[] = [];

  // Always include — REQUIRED
  const responseCraft = await readDoc("RESPONSE_CRAFT.md", true);
  sections.push(`## RESPONSE FRAMEWORK\n\n${responseCraft}`);

  const pricing = await readDoc("PRICING_TABLES.md", true);
  sections.push(`## PRICING REFERENCE\n\n${pricing}`);

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

  // Conditional: venue intelligence
  const quickRef = await readDoc("QUICK_REFERENCE.md", false);
  if (quickRef) {
    sections.push(`## QUICK REFERENCE\n\n${quickRef}`);
  }

  return sections.join("\n\n---\n\n");
}
