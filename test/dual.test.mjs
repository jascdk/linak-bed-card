// Run with: node --test test/
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

class El { attachShadow() { this.shadowRoot = { querySelectorAll: () => [], querySelector: () => null, set innerHTML(v) {} }; } }
const ctx = { HTMLElement: El, window: {}, navigator: {}, console, customElements: { define(n, c) { ctx.defs[n] = c; } }, defs: {}, document: {} };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL("../linak-bed-card.js", import.meta.url), "utf8").replace(/^const /gm, "var "), ctx);
const Card = ctx.defs["linak-bed-card"];

const calls = [];
const states = {};
for (const p of ["a", "b"]) for (const k of ["head", "legs", "hoved_fod"]) states[`cover.${p}_${k}`] = { state: "closed", attributes: {} };
for (const p of ["a", "b"]) states[`button.${p}_stop`] = { state: "unknown", attributes: {} };
const hass = { states, entities: {}, language: "en", callService: (d, s, data) => calls.push([d, s, data.entity_id]) };

const make = (cfg) => {
  const c = new Card();
  c.setConfig(cfg);
  c._hass = hass;
  c._resolve();
  return c;
};
const dual = { entity_a: "cover.a_head", entity_b: "cover.b_head" };

test("single config unchanged", () => {
  const c = make({ prefix: "a" });
  assert.equal(c._dual, false);
  c._call("cover", "open_cover", "back_cover");
  assert.deepEqual(calls.splice(0), [["cover", "open_cover", "cover.a_head"]]);
});

test("dual config validation", () => {
  const bad = (cfg, re) => assert.throws(() => new Card().setConfig(cfg), re);
  bad({ entity_a: "cover.a_head" }, /both entity_a and entity_b/);
  bad({ ...dual, entity_b: "cover.a_head" }, /different/);
  bad({ ...dual, entity_b: "nope" }, /entity id/);
  bad({ ...dual, device: "x" }, /cannot be combined/);
  bad({ ...dual, control_mode: "x" }, /control_mode/);
});

test("dual: single mode targets active bed, linked targets both", () => {
  const c = make(dual);
  c._call("cover", "open_cover", "back_cover");
  assert.deepEqual(calls.splice(0), [["cover", "open_cover", "cover.a_head"]]);
  c._active = 1; c._ent = c._beds[1];
  c._call("cover", "open_cover", "legs_cover");
  assert.deepEqual(calls.splice(0), [["cover", "open_cover", "cover.b_legs"]]);
  c._linked = true;
  c._call("cover", "close_cover", "both_cover");
  assert.deepEqual(calls.splice(0), [["cover", "close_cover", "cover.a_hoved_fod"], ["cover", "close_cover", "cover.b_hoved_fod"]]);
});

test("linked stop goes to both beds, even if unavailable", () => {
  const c = make({ ...dual, control_mode: "linked" });
  states["button.b_stop"].state = "unavailable";
  c._call("button", "press", "stop");
  c._call("cover", "stop_cover", "back_cover");
  assert.deepEqual(calls.splice(0).map((x) => x[2]), ["button.a_stop", "button.b_stop", "cover.a_head", "cover.b_head"]);
});
