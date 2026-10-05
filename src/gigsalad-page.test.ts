import { test } from "node:test";
import assert from "node:assert/strict";
import { parseGigSaladLeadPage } from "./automation/parsers/gigsalad-page.js";

// GigSalad lead page parser (docs/research/2026-10-04-gigsalad-lead-page.md). Real lead
// emails carry almost nothing; the details live on the lead page. These fixtures copy the
// real page's SHAPE (both accounts) with invented content: no real lead's words.

// Music account: competition counts shown, phone unmasked.
const MUSIC = `Event info
Testa Q.
(555) 010-0199
5 members responded
1 member sent a quote
0 have active quotes
Thu, June 17, 2027 View calendar
10:00 PM – 10:45 PM (45 minutes)
Springfield, CA 90001, US
Springfield, CA 90001, US
Event type: Personal Occasion
Requested: World Music
Number of guests: 100 guests
Age range of audience: Unknown
Equipment needed: Backline (instruments)
Block communication?
If you would no longer like to receive messages from Testa Q., you can block them from contacting and booking you.
Block communication`;

// Business account: no competition counts, phone masked, more optional labels,
// and labels on their own line (the parser must accept both layouts).
const BUSINESS = `Event info
Sample R.
(555) ***-****
Phone number revealed after booking
Upgrade to see it now
Sat, November 21, 2026 View calendar
6:00 PM – 9:00 PM (3 hours)
Example Hall, 12 Any Street, Springfield, CA 90002, US
Event type:
Birthday Party
Requested:
Latin Band
Planning stage:
Sample is planning to book soon
Number of guests:
75 guests
Details:
Living room, 3 players max, call me at 555-010-0123 or test@example.com
Group size preferred:
3 person
Budget range:
$500 – $1,000
Song requests:
nothing yet
Block communication?`;

test("gigsalad page: music account fields, competition from the displayed count", () => {
  const lead = parseGigSaladLeadPage({ title: "Gig Lead from Testa Q. | GigSalad", text: MUSIC });
  assert.equal(lead.clientFirstName, "Testa");
  assert.equal(lead.eventDate, "2027-06-17");
  assert.equal(lead.durationMinutes, 45);
  assert.equal(lead.zip, "90001");
  assert.equal(lead.location, "Springfield, CA 90001, US");
  assert.equal(lead.fields["Event type"], "Personal Occasion");
  assert.equal(lead.fields["Number of guests"], "100 guests");
  assert.equal(lead.quotesSent, 1);
  assert.equal(lead.membersResponded, 5);
  assert.match(lead.rawText, /^Competition: 1 quotes sent by other members \(5 members responded\)$/m);
  assert.match(lead.rawText, /^Date: 2027-06-17 \(Thu, June 17, 2027\)$/m);
  assert.match(lead.rawText, /^Time: 10:00 PM – 10:45 PM \(45 minutes\)$/m);
  assert.equal(lead.warnings.length, 0);
});

test("gigsalad page: business account, no count is unknown (never 0), labels on their own line", () => {
  const lead = parseGigSaladLeadPage({ title: "Gig Lead from Sample R. | GigSalad", text: BUSINESS });
  assert.equal(lead.quotesSent, null);
  assert.equal(lead.membersResponded, null);
  assert.match(lead.rawText, /^Competition: not shown on this GigSalad page \(unknown\)$/m);
  assert.doesNotMatch(lead.rawText, /Competition: 0/);
  assert.equal(lead.eventDate, "2026-11-21");
  assert.equal(lead.durationMinutes, 180);
  assert.equal(lead.zip, "90002");
  assert.equal(lead.location, "Example Hall, 12 Any Street, Springfield, CA 90002, US");
  assert.equal(lead.fields["Requested"], "Latin Band");
  assert.equal(lead.fields["Group size preferred"], "3 person");
  assert.equal(lead.fields["Budget range"], "$500 – $1,000");
  assert.equal(lead.fields["Song requests"], "nothing yet");
});

test("gigsalad page: no phone or email ever survives, masked, unmasked or typed into Details", () => {
  for (const text of [MUSIC, BUSINESS]) {
    const lead = parseGigSaladLeadPage({ title: "", text });
    const all = JSON.stringify(lead);
    assert.doesNotMatch(all, /555[) .-]*0?10[- ]*01|\*\*\*-\*\*\*\*|example\.com|revealed after booking|Upgrade to see/);
    assert.doesNotMatch(all, /Block communication|no longer like to receive/);
  }
  const lead = parseGigSaladLeadPage({ title: "", text: BUSINESS });
  assert.equal(lead.fields["Details"], "Living room, 3 players max, call me at [contact removed] or [contact removed]");
});

test("gigsalad page: missing optional labels are absent, not guessed; a page without Event info warns", () => {
  const lead = parseGigSaladLeadPage({ title: "", text: MUSIC });
  assert.equal(lead.fields["Budget range"], undefined);
  assert.equal(lead.fields["Details"], undefined);
  assert.doesNotMatch(lead.rawText, /Budget range/);
  const empty = parseGigSaladLeadPage({ title: "Log in | GigSalad", text: "Log in to GigSalad\nEmail\nPassword" });
  assert.ok(empty.warnings.some((w) => /Event info/.test(w)));
  assert.equal(empty.rawText, "");
});

test("gigsalad page: the client name comes from the title when present, first word only", () => {
  assert.equal(parseGigSaladLeadPage({ title: "Gig Lead from Andrea Vexample | GigSalad", text: MUSIC }).clientFirstName, "Andrea");
  assert.equal(parseGigSaladLeadPage({ title: "", text: MUSIC }).clientFirstName, "Testa");
});

// Mutation check (2026-10-04): the phone line was dropped by luck (it fell into the name
// slot). If the layout moves it below a field, the phone filter is all that stands between
// a masked or real number and that field's value.
test("gigsalad page: a phone line below a field is skipped, not appended to the field", () => {
  for (const phone of ["(555) 010-0199", "(555) ***-****"]) {
    const text = `Event info\nTesta Q.\nEvent type: Personal Occasion\n${phone}\nPhone number revealed after booking\nNumber of guests: 40 guests\nBlock communication`;
    const lead = parseGigSaladLeadPage({ title: "", text });
    assert.equal(lead.fields["Event type"], "Personal Occasion", phone);
    assert.doesNotMatch(JSON.stringify(lead), /\*\*\*|contact removed|555/, phone);
  }
});

// Codex round 1 (GigSalad) P1: an email in the page title reached clientFirstName, and a non-US
// phone (+44 20 7946 0958) reached fields and rawText. One fail-closed scrub covers the name and
// every value; prices, guest counts and times must survive it.
test("gigsalad page: title emails, international phones and multi-line values never survive", () => {
  const text = `Event info\nTesta Q.\nThu, June 17, 2027 View calendar\n10:00 PM – 10:45 PM (45 minutes)\nSpringfield, CA 90001, US
Event type: Personal Occasion
Details: reach me on +44 20 7946 0958 or
my cell 555.010.0123 thanks
Contact: +1 (555) 010-0177
Budget range: $500 – $1,000
Number of guests: 100 guests
Block communication`;
  const lead = parseGigSaladLeadPage({ title: "Gig Lead from alice@example.com | GigSalad", text });
  assert.equal(lead.clientFirstName, null);
  const all = JSON.stringify(lead);
  assert.doesNotMatch(all, /alice|example\.com|7946|0958|010[.\s-]?0123|010-0177/);
  assert.equal(lead.fields["Budget range"], "$500 – $1,000");
  assert.equal(lead.fields["Number of guests"], "100 guests");
  assert.match(lead.rawText, /^Time: 10:00 PM – 10:45 PM \(45 minutes\)$/m);
  assert.equal(parseGigSaladLeadPage({ title: "", text: text.replace("Testa Q.", "bob@example.com") }).clientFirstName, null);
  assert.equal(parseGigSaladLeadPage({ title: "Gig Lead from 5550100199 | GigSalad", text }).clientFirstName, null);
  assert.equal(parseGigSaladLeadPage({ title: "Gig Lead from Mary-Jo K. | GigSalad", text }).clientFirstName, "Mary-Jo");
});
