import { test } from "node:test";
import assert from "node:assert/strict";
import { createLaw, reportCrime, tickLaw } from "../src/law.js";
test("only witnessed offences escalate wanted level, with a five-star cap", () => {
  let s = createLaw();
  assert.equal(reportCrime(s, "assault", { witnessed: false }).stars, 0);
  s = reportCrime(s, "vehicleTheft");
  assert.equal(s.stars, 1);
  for (let i = 0; i < 20; i++) s = reportCrime(s, "assault");
  assert.equal(s.stars, 5);
});
test("losing police sight clears search, while sight holds it active", () => {
  let s = reportCrime(createLaw(), "assault");
  for (let i = 0; i < 100; i++) s = tickLaw(s, 1, { seen: true });
  assert.equal(s.stars, 1);
  for (let i = 0; i < 100; i++) s = tickLaw(s, 1);
  assert.equal(s.stars, 0);
});
test("surrender requires staying near an officer for three seconds", () => {
  let s = reportCrime(createLaw(), "assault");
  s = tickLaw(s, 1, { nearOfficer: false, surrendering: true });
  assert.equal(s.surrender, 0);
  for (let i = 0; i < 3; i++)
    s = tickLaw(s, 1, { nearOfficer: true, surrendering: true });
  assert.equal(s.arrested, true);
  assert.equal(s.stars, 0);
});
