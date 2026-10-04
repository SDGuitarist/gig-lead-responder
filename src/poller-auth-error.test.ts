import { test } from "node:test";
import assert from "node:assert/strict";
import { isAuthError } from "./automation/poller.js";

// Alex 2026-10-04: the poller stopped for good on ANY error whose text contained
// "401" (a timeout of 401 ms, a message id, a lead number), and nothing alerts him
// yet, so leads could go unanswered. Auth failure is now read from the error's
// HTTP status or Google's OAuth error code, never from free text.
const gaxios = (status: number, data?: unknown, message = "Request failed") =>
  Object.assign(new Error(message), { status, response: { status, data } });

test("poller auth error: text that merely contains 401 is not an auth failure", () => {
  for (const e of [new Error("socket hang up after 401 ms"), new Error("Lead #401 failed to parse"),
    new Error("Gmail list page invalid: messages[401] has no valid id"), gaxios(500, undefined, "upstream 401 retry"),
    gaxios(404, undefined, "message 18f2a9c4b7d1e401 not found")]) {
    assert.equal(isAuthError(e), false, e.message);
  }
});

test("poller auth error: a real 401 or invalid_grant is an auth failure", () => {
  assert.equal(isAuthError(gaxios(401, { error: { code: 401 } }, "Request had invalid authentication credentials.")), true);
  assert.equal(isAuthError(gaxios(400, { error: "invalid_grant", error_description: "Token has been expired or revoked." }, "invalid_grant")), true);
  assert.equal(isAuthError(new Error("invalid_grant: Token has been expired or revoked.")), true, "the OAuth code in the message");
  assert.equal(isAuthError(Object.assign(new Error("x"), { response: { status: 401 } })), true, "status only on the response");
});
