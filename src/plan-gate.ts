import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";

// --- Types ---

type Status = "eligible" | "manual_only" | "invalid";

export interface PlanGateResult {
  status: Status;
  reasons: string[];
  contract: AutomationContract | null;
}

export interface LinkedExpectation {
  files: string[];
  reason: string;
}

export interface AutomationContract {
  auto_work_candidate: boolean;
  human_signoff_required: boolean;
  risk_level: string;
  allowed_paths: string[];
  forbidden_paths: string[];
  source_of_truth: string[];
  required_checks: string[];
  stop_conditions: string[];
  linked_expectations: LinkedExpectation[];
}

const REQUIRED_KEYS: (keyof AutomationContract)[] = [
  "auto_work_candidate",
  "human_signoff_required",
  "risk_level",
  "allowed_paths",
  "forbidden_paths",
  "source_of_truth",
  "required_checks",
  "stop_conditions",
  "linked_expectations",
];

const VALID_RISK_LEVELS = ["low", "medium", "high"];

// --- Contract extraction ---

function extractContractJson(markdown: string): string | null {
  // Find the ## Automation Contract section
  const sectionMatch = markdown.match(
    /^## Automation Contract\s*$/m
  );
  if (!sectionMatch || sectionMatch.index === undefined) return null;

  // Get content after the heading until the next ## heading or end of file
  const afterHeading = markdown.slice(
    sectionMatch.index + sectionMatch[0].length
  );
  const nextHeading = afterHeading.search(/^## /m);
  const sectionContent =
    nextHeading === -1 ? afterHeading : afterHeading.slice(0, nextHeading);

  // Extract the first fenced json block
  const jsonMatch = sectionContent.match(/```json\s*\n([\s\S]*?)```/);
  if (!jsonMatch) return null;

  return jsonMatch[1].trim();
}

// --- Validation ---

function validateContract(
  raw: unknown,
  planDir: string
): { contract: AutomationContract | null; errors: string[] } {
  const errors: string[] = [];

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return {
      contract: null,
      errors: ["Contract must be a JSON object."],
    };
  }

  const obj = raw as Record<string, unknown>;

  // Check required keys
  for (const key of REQUIRED_KEYS) {
    if (!(key in obj)) {
      errors.push(`Missing required field: "${key}".`);
    }
  }

  if (errors.length > 0) {
    return { contract: null, errors };
  }

  // Type checks
  if (typeof obj.auto_work_candidate !== "boolean") {
    errors.push(`"auto_work_candidate" must be a boolean.`);
  }
  if (typeof obj.human_signoff_required !== "boolean") {
    errors.push(`"human_signoff_required" must be a boolean.`);
  }
  if (
    typeof obj.risk_level !== "string" ||
    !VALID_RISK_LEVELS.includes(obj.risk_level)
  ) {
    errors.push(
      `"risk_level" must be one of: ${VALID_RISK_LEVELS.join(", ")}. Got: "${obj.risk_level}".`
    );
  }

  // Array checks
  const arrayFields: (keyof AutomationContract)[] = [
    "allowed_paths",
    "forbidden_paths",
    "source_of_truth",
    "required_checks",
    "stop_conditions",
    "linked_expectations",
  ];

  for (const field of arrayFields) {
    if (!Array.isArray(obj[field])) {
      errors.push(`"${field}" must be an array.`);
    }
  }

  // Non-empty array checks (linked_expectations can be empty)
  const nonEmptyArrays: (keyof AutomationContract)[] = [
    "allowed_paths",
    "forbidden_paths",
    "source_of_truth",
    "required_checks",
    "stop_conditions",
  ];

  for (const field of nonEmptyArrays) {
    if (Array.isArray(obj[field]) && (obj[field] as unknown[]).length === 0) {
      errors.push(`"${field}" must not be empty.`);
    }
  }

  // Shape validation for linked_expectations entries
  if (Array.isArray(obj.linked_expectations)) {
    const linkedExp = obj.linked_expectations as unknown[];
    for (let i = 0; i < linkedExp.length; i++) {
      const entry = linkedExp[i];
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        errors.push(
          `"linked_expectations[${i}]" must be an object with "files" and "reason".`
        );
        continue;
      }
      const e = entry as Record<string, unknown>;
      if (!Array.isArray(e.files) || e.files.length < 2) {
        errors.push(
          `"linked_expectations[${i}].files" must be an array of at least 2 file paths.`
        );
      } else if (e.files.some((f: unknown) => typeof f !== "string" || f === "")) {
        errors.push(
          `"linked_expectations[${i}].files" entries must be non-empty strings.`
        );
      }
      if (typeof e.reason !== "string" || e.reason.trim() === "") {
        errors.push(
          `"linked_expectations[${i}].reason" must be a non-empty string.`
        );
      }
    }
  }

  if (errors.length > 0) {
    return { contract: null, errors };
  }

  const contract = obj as unknown as AutomationContract;

  // Overlap check: allowed_paths vs forbidden_paths
  for (const allowed of contract.allowed_paths) {
    for (const forbidden of contract.forbidden_paths) {
      if (allowed === forbidden || allowed.startsWith(forbidden + "/")) {
        errors.push(
          `Path overlap: "${allowed}" is in both allowed_paths and forbidden_paths.`
        );
      }
    }
  }

  // Source-of-truth files must exist
  for (const sot of contract.source_of_truth) {
    const fullPath = resolve(planDir, sot);
    if (!existsSync(fullPath)) {
      errors.push(`Source-of-truth file not found: "${sot}".`);
    }
  }

  // Linked expectations enforcement
  for (const linked of contract.linked_expectations) {
    const covered: string[] = [];
    const missing: string[] = [];
    for (const f of linked.files) {
      const isCovered = contract.allowed_paths.some(
        (a) => a === f || f.startsWith(a + "/")
      );
      if (isCovered) {
        covered.push(f);
      } else {
        missing.push(f);
      }
    }
    if (covered.length > 0 && missing.length > 0) {
      for (const m of missing) {
        errors.push(
          `Linked pair violated: "${covered[0]}" is in allowed_paths but ` +
          `"${m}" is not. Reason: ${linked.reason}.`
        );
      }
    }
  }

  return { contract, errors };
}

// --- Main gate function ---

export function checkPlanGate(planPath: string): PlanGateResult {
  const resolvedPath = resolve(planPath);

  // Read the plan file
  let markdown: string;
  try {
    markdown = readFileSync(resolvedPath, "utf-8");
  } catch {
    return {
      status: "invalid",
      reasons: [`Cannot read plan file: "${planPath}".`],
      contract: null,
    };
  }

  // Extract contract JSON
  const jsonStr = extractContractJson(markdown);
  if (jsonStr === null) {
    return {
      status: "manual_only",
      reasons: [
        "No ## Automation Contract section found. This plan uses the manual workflow.",
      ],
      contract: null,
    };
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: "invalid",
      reasons: [`Malformed JSON in Automation Contract: ${msg}`],
      contract: null,
    };
  }

  // Resolve paths relative to the project root (plan's parent directory
  // structure varies, so use cwd which is the project root)
  const planDir = process.cwd();
  const { contract, errors } = validateContract(parsed, planDir);

  if (errors.length > 0) {
    return { status: "invalid", reasons: errors, contract: null };
  }

  // Determine status
  if (!contract.auto_work_candidate) {
    return {
      status: "manual_only",
      reasons: [
        `Contract present but auto_work_candidate is false. This plan requires manual implementation.`,
      ],
      contract,
    };
  }

  return {
    status: "eligible",
    reasons: ["Contract is valid and auto_work_candidate is true."],
    contract,
  };
}

// --- CLI entry point ---

if (
  process.argv[1] &&
  (process.argv[1].endsWith("plan-gate.ts") ||
    process.argv[1].endsWith("plan-gate.js"))
) {
  const args = process.argv.slice(2);
  const jsonFlag = args.includes("--json");
  const planPath = args.find((a) => !a.startsWith("--"));
  if (!planPath) {
    console.error("Usage: tsx src/plan-gate.ts [--json] <path-to-plan.md>");
    process.exit(1);
  }

  const result = checkPlanGate(planPath);

  if (jsonFlag) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Status: ${result.status}`);
    for (const reason of result.reasons) {
      console.log(`  - ${reason}`);
    }
  }

  if (result.status === "eligible") {
    process.exit(0);
  } else if (result.status === "manual_only") {
    process.exit(2);
  } else {
    process.exit(1);
  }
}
