import type { LeadRecord, LeadApiResponse } from "../types.js";

function safeJsonParse(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function shapeLead(lead: LeadRecord): LeadApiResponse {

  const cl = safeJsonParse(lead.classification_json);
  const pr = safeJsonParse(lead.pricing_json);
  const gt = safeJsonParse(lead.gate_json);

  const gutChecks = gt?.gut_checks as Record<string, boolean> | undefined;
  let gutCheckPassed: number | null = null;
  let gutCheckTotal: number | null = null;
  const failedChecks: string[] = [];
  if (gutChecks) {
    const entries = Object.entries(gutChecks);
    gutCheckTotal = entries.length;
    gutCheckPassed = entries.filter(([, v]) => v).length;
    for (const [name, passed] of entries) {
      if (!passed) failedChecks.push(name);
    }
  }

  return {
    id: lead.id,
    status: lead.status,
    event_type: lead.event_type,
    event_date: lead.event_date,
    venue: lead.venue,
    client_name: lead.client_name,
    confidence_score: lead.confidence_score,
    edit_round: lead.edit_round,
    created_at: lead.created_at,
    updated_at: lead.updated_at,
    full_draft: lead.full_draft,
    compressed_draft: lead.compressed_draft,
    error_message: lead.error_message,
    // classification (parsed from JSON — cast to match LeadApiResponse)
    format_recommended: (cl?.format_recommended as string) ?? null,
    duration_hours: (cl?.duration_hours as number) ?? null,
    tier: (cl?.tier as string) ?? null,
    competition_level: (cl?.competition_level as string) ?? null,
    // pricing (parsed from JSON)
    quote_price: (pr?.quote_price as number) ?? null,
    anchor: (pr?.anchor as number) ?? null,
    floor: (pr?.floor as number) ?? null,
    // gate
    gate_passed: lead.gate_passed,
    gut_check_passed: gutCheckPassed,
    gut_check_total: gutCheckTotal,
    fail_reasons: (gt?.fail_reasons as string[]) ?? null,
    failed_checks: failedChecks,
    // outcome tracking
    outcome: lead.outcome,
    outcome_reason: lead.outcome_reason,
    actual_price: lead.actual_price,
    outcome_at: lead.outcome_at,
    // follow-up
    follow_up_status: lead.follow_up_status,
    follow_up_count: lead.follow_up_count,
    follow_up_due_at: lead.follow_up_due_at,
    follow_up_draft: lead.follow_up_draft,
    snoozed_until: lead.snoozed_until,
  };
}
