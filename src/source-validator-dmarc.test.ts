import { test } from "node:test";
import assert from "node:assert/strict";
import { validateSource } from "./automation/source-validator.js";

// Real Gmail Authentication-Results headers, copied 2026-10-03 from
// alex.guillen.music@gmail.com (bounce addresses shortened). Each also carries
// a dkim=pass for the platform's email vendor, which is why "any dkim=pass"
// proved nothing. Yelp mail comes from messaging.yelp.com but DMARC reports
// the parent domain yelp.com.
const REAL = {
  gigsalad:
    "mx.google.com; dkim=pass header.i=@gigsalad.com header.s=api header.b=Bi297lTc; dkim=pass header.i=@elasticemail.com header.s=api header.b=Pfvb6KA6; spf=pass (google.com: domain of gigs@gigsalad.com designates 192.99.26.10 as permitted sender) smtp.mailfrom=gigs@gigsalad.com; dmarc=pass (p=QUARANTINE sp=QUARANTINE dis=NONE) header.from=gigsalad.com",
  yelp:
    "mx.google.com; dkim=pass header.i=@yelp.com header.s=s1 header.b=b4XKqLl5; dkim=pass header.i=@sendgrid.info header.s=smtpapi header.b=CYDR0he2; spf=pass (google.com: domain of bounces@em.yelp.com designates 168.245.63.216 as permitted sender) smtp.mailfrom=\"bounces@em.yelp.com\"; dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=yelp.com",
  squarespace:
    "mx.google.com; dkim=pass header.i=@squarespace.info header.s=commsplat-prod header.b=U7OLVwDD; dkim=pass header.i=@email-od.com header.s=dkim header.b=\"kq3C/bYX\"; spf=pass (google.com: domain of bounce@commsplat-prod-bounce.squarespace.info designates 142.0.181.1 as permitted sender) smtp.mailfrom=bounce@commsplat-prod-bounce.squarespace.info; dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=squarespace.info",
};

const YELP_FROM = "Yelp Inbox <reply+eb3daa65e19f4c508d834ee00362ae89@messaging.yelp.com>";

test("real platform auth headers are accepted (overshoot control)", () => {
  assert.equal(validateSource("GigSalad <leads@gigsalad.com>", REAL.gigsalad).valid, true);
  assert.equal(validateSource(YELP_FROM, REAL.yelp).valid, true);
  assert.equal(validateSource("Squarespace <form-submission@squarespace.info>", REAL.squarespace).valid, true);
});

test("forged sender rejected: dkim and spf pass for another domain, no dmarc", () => {
  const forged =
    "mx.google.com; dkim=pass header.i=@evil.example header.s=s1; spf=pass smtp.mailfrom=x@evil.example";
  assert.equal(validateSource("GigSalad <leads@gigsalad.com>", forged).valid, false);
});

test("forged sender rejected: dmarc passes for a different domain", () => {
  const forged = "mx.google.com; dkim=pass header.i=@evil.example; spf=pass; dmarc=pass (p=NONE) header.from=evil.example";
  assert.equal(validateSource("GigSalad <leads@gigsalad.com>", forged).valid, false);
});

test("forged sender rejected: another platform's dmarc result", () => {
  // A real Yelp pass must not authenticate mail claiming to be GigSalad.
  assert.equal(validateSource("GigSalad <leads@gigsalad.com>", REAL.yelp).valid, false);
});

test("forged sender rejected: header not written by mx.google.com", () => {
  const forged = REAL.gigsalad.replace(/^mx\.google\.com;/, "attacker.example;");
  assert.equal(validateSource("GigSalad <leads@gigsalad.com>", forged).valid, false);
});

test("forged sender rejected: dmarc=fail even with dkim and spf pass", () => {
  const failed = REAL.gigsalad.replace("dmarc=pass", "dmarc=fail");
  assert.equal(validateSource("GigSalad <leads@gigsalad.com>", failed).valid, false);
});

test("forged sender rejected: dmarc=pass appearing only inside a comment", () => {
  const sneaky =
    "mx.google.com; dkim=pass header.i=@evil.example; spf=pass (google.com: dmarc=pass header.from=gigsalad.com) smtp.mailfrom=x@evil.example; dmarc=none header.from=gigsalad.com";
  assert.equal(validateSource("GigSalad <leads@gigsalad.com>", sneaky).valid, false);
});
