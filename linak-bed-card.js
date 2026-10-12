/*
 * LINAK Bed Card - custom Home Assistant Lovelace card
 * for the ESPHome LINAK bed configs (linak-jacob-seng / linak-helene-seng).
 *
 * Install:
 *   1. Copy this file to /config/www/linak-bed-card.js
 *   2. Settings -> Dashboards -> (⋮) Resources -> Add resource
 *        URL: /local/linak-bed-card.js   Type: JavaScript module
 *   3. Add the card from the card picker ("LINAK Bed Card") and choose the bed
 *      in the visual editor. Entities are found automatically from the device.
 *
 * YAML is still supported:
 *   type: custom:linak-bed-card
 *   name: Jacob
 *   device: <device_id>        # picked in the editor (recommended)
 *   prefix: jacob_seng         # alternative to device
 *   language: en               # optional: da | en (default: HA user language)
 *   entities:                  # optional per-entity overrides
 *     light: switch.my_light
 *
 * Two beds in one card (additive; single-bed config is unchanged):
 *   type: custom:linak-bed-card
 *   entity_a: cover.jacob_seng_head   # any entity of bed A
 *   entity_b: cover.helene_seng_head  # any entity of bed B
 *   name_a: Jacob                     # optional
 *   name_b: Helene                    # optional
 *   control_mode: single              # optional: single | linked
 */

const VERSION = "1.1.0";

// How to find each entity. `domain` is used by the editor's entity picker and
// by the matching; `patterns` are tried against the object id (the part after
// the dot), so long device names don't matter. `suffix` builds the `prefix`
// fallback (<domain>.<prefix>_<suffix>). Patterns cover the Danish ESPHome
// config and common English names; use `entities:` for anything else.
const MATCHERS = {
  back_cover: { domain: "cover", suffix: "head", patterns: [/_head$/, /_back$/] },
  legs_cover: { domain: "cover", suffix: "legs", patterns: [/_legs$/, /_feet$/] },
  both_cover: { domain: "cover", suffix: "hoved_fod", patterns: [/_hoved_fod$/, /_both$/, /_head_and_feet$/] },
  back_angle: { domain: "sensor", suffix: "ryg_hojde", patterns: [/ryg_h(o|_)?jde$/, /_back_(angle|height)$/, /_head_(angle|height)$/] },
  legs_angle: { domain: "sensor", suffix: "ben_hojde", patterns: [/ben_h(o|_)?jde$/, /_legs_(angle|height)$/, /_feet_(angle|height)$/] },
  light: { domain: "switch", suffix: "lys", patterns: [/_lys$/, /_(under_?bed_)?light$/] },
  connection: { domain: "binary_sensor", suffix: "forbindelse_status", patterns: [/_forbindelse_status$/, /_connection(_status)?$/, /_connected$/] },
  problem: { domain: "binary_sensor", suffix: "bluetooth_svarer_ikke", patterns: [/_bluetooth_svarer_ikke$/, /_bluetooth_(not_responding|unresponsive)$/] },
  preset: { domain: "select", suffix: "preset_mode", patterns: [/_preset_mode$/, /_preset$/] },
  stop: { domain: "button", suffix: "stop", patterns: [/_stop$/] },
};

// Validate the additive dual-bed options. Returns true for a dual config,
// false for a normal single-bed config, and throws a clear error otherwise.
const validateDual = (cfg) => {
  const hasA = cfg.entity_a !== undefined && cfg.entity_a !== null && cfg.entity_a !== "";
  const hasB = cfg.entity_b !== undefined && cfg.entity_b !== null && cfg.entity_b !== "";
  if (cfg.control_mode !== undefined && cfg.control_mode !== "single" && cfg.control_mode !== "linked") {
    throw new Error('control_mode must be "single" or "linked".');
  }
  if (!hasA && !hasB) {
    if (cfg.control_mode === "linked") throw new Error("control_mode: linked needs both entity_a and entity_b.");
    return false;
  }
  if (!hasA || !hasB) throw new Error("Dual-bed config needs both entity_a and entity_b.");
  for (const k of ["entity_a", "entity_b"]) {
    if (typeof cfg[k] !== "string" || !/^[a-z_]+\.[a-z0-9_]+$/.test(cfg[k])) {
      throw new Error(`${k} must be an entity id like cover.my_bed_head.`);
    }
  }
  if (cfg.entity_a === cfg.entity_b) throw new Error("entity_a and entity_b must be two different entities.");
  if (cfg.device || cfg.prefix || cfg.entities) {
    throw new Error("entity_a/entity_b cannot be combined with device, prefix or entities.");
  }
  return true;
};

// Dual config: build the entity map of one bed from any one of its entities.
// Siblings come from the same device, else from the object id prefix.
const resolveBedFromEntity = (id, reg) => {
  const dev = reg && reg[id] && reg[id].device_id;
  const onDevice = dev ? Object.keys(reg).filter((e) => reg[e].device_id === dev) : [];
  const objectId = id.split(/\.(.+)/)[1];
  const known = Object.values(MATCHERS).map((m) => `_${m.suffix}`).find((x) => objectId.endsWith(x));
  const prefix = known ? objectId.slice(0, -known.length) : null;
  const ent = {};
  for (const key of Object.keys(MATCHERS)) {
    const m = MATCHERS[key];
    ent[key] = (matchEntity(key, id) && id) || onDevice.find((e) => matchEntity(key, e)) ||
      (prefix ? `${m.domain}.${prefix}_${m.suffix}` : "");
  }
  return ent;
};

const matchEntity = (key, entityId) => {
  const m = MATCHERS[key];
  const [domain, objectId] = String(entityId).split(/\.(.+)/);
  return !!m && domain === m.domain && !!objectId && m.patterns.some((re) => re.test(objectId));
};

// All user-facing text lives here (card and editor). Add a language by adding
// an object with the same keys; the language comes from `language:` in the
// card config or the Home Assistant user language (falls back to English).
const STRINGS = {
  da: {
    bed: "Seng", single: "Enkelt", linked: "Sammen", bedA: "Seng A", bedB: "Seng B", controlMode: "Styring", activeBed: "Aktiv seng",
    back: "Ryg", legs: "Ben", both: "Begge", up: "op", down: "ned",
    stop: "Stop", light: "Lys", lightOn: "Lys tændt", lightOff: "Lys slukket",
    connected: "Forbundet", notConnected: "Ikke forbundet", noResponse: "Svarer ikke",
    btNoResponse: "Bluetooth svarer ikke", flat: "Flad",
    posLine: "Ryg {back}% · Ben {legs}%", presetLabel: "Preset {name}",
    presets: "Presets", loading: "Henter data fra Home Assistant…",
    incomplete: "Vælg sengen i kortets editor (blyant-ikonet), så findes alle entiteter automatisk.",
    notFound: "Ingen entiteter blev fundet for denne seng. Tjek enheden, eller vælg entiteterne manuelt i editoren.",
    missing: "Mangler: {list}", unavailable: "Utilgængelig: {list}",
    allUnavailable: "Sengen er utilgængelig i Home Assistant.",
    deviceLabel: "Seng (enhed)", nameLabel: "Navn på kortet",
    deviceHelper: "Vælg sengens ESPHome-enhed. Alle entiteter findes automatisk.",
    advanced: "Avanceret: vælg entiteter manuelt",
    entities: {
      back_cover: "Ryg (cover)", legs_cover: "Ben (cover)", both_cover: "Begge (cover)",
      back_angle: "Ryg vinkel (sensor)", legs_angle: "Ben vinkel (sensor)", light: "Lys (switch)",
      connection: "Forbindelse (binary_sensor)", problem: "Bluetooth svarer ikke (binary_sensor)",
      preset: "Preset (select)", stop: "Stop (button)",
    },
  },
  en: {
    bed: "Bed", single: "Single", linked: "Linked", bedA: "Bed A", bedB: "Bed B", controlMode: "Control mode", activeBed: "Active bed",
    back: "Back", legs: "Legs", both: "Both", up: "up", down: "down",
    stop: "Stop", light: "Light", lightOn: "Light on", lightOff: "Light off",
    connected: "Connected", notConnected: "Not connected", noResponse: "Not responding",
    btNoResponse: "Bluetooth not responding", flat: "Flat",
    posLine: "Back {back}% · Legs {legs}%", presetLabel: "Preset {name}",
    presets: "Presets", loading: "Waiting for Home Assistant…",
    incomplete: "Pick the bed in the card editor (pencil icon) and all entities are found automatically.",
    notFound: "No entities were found for this bed. Check the device, or pick the entities manually in the editor.",
    missing: "Missing: {list}", unavailable: "Unavailable: {list}",
    allUnavailable: "The bed is unavailable in Home Assistant.",
    deviceLabel: "Bed (device)", nameLabel: "Card name",
    deviceHelper: "Pick the bed's ESPHome device. All entities are found automatically.",
    advanced: "Advanced: pick entities manually",
    entities: {
      back_cover: "Back (cover)", legs_cover: "Legs (cover)", both_cover: "Both (cover)",
      back_angle: "Back angle (sensor)", legs_angle: "Legs angle (sensor)", light: "Light (switch)",
      connection: "Connection (binary_sensor)", problem: "Bluetooth not responding (binary_sensor)",
      preset: "Preset (select)", stop: "Stop (button)",
    },
  },
};

const langOf = (hass, config) => {
  const l = String((config && config.language) || (hass && hass.language) || "en").toLowerCase();
  return STRINGS[l] ? l : STRINGS[l.split("-")[0]] ? l.split("-")[0] : "en";
};
const tr = (lang, key, vars = {}) =>
  String(STRINGS[lang][key] ?? STRINGS.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");

const DEFAULT_PRESETS = ["Flad", "Sove", "TV", "Helt Oppe"];

const BACK_MAX = 68;
const LEGS_MAX = 45;

const ICONS = {
  up: "M7 14l5-5 5 5z",
  down: "M7 10l5 5 5-5z",
  stop: "M7 7h10v10H7z",
  bulb: "M12 2a7 7 0 0 0-4 12.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26A7 7 0 0 0 12 2zm-3 19a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1H9v1z",
  bt: "M14.88 16.29 13 18.17v-3.76l1.88 1.88zM13 5.83l1.88 1.88L13 9.59V5.83zm4.71 1.88L12 2h-1v7.59L6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 11 14.41V22h1l5.71-5.71-4.3-4.29 4.3-4.29z",
};

class LinakBedCard extends HTMLElement {
  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    const dual = validateDual(config);
    // Home Assistant may call setConfig again with the same config;
    // only rebuild when it actually changed (avoids flicker).
    const cfgKey = JSON.stringify(config);
    if (this._cfgKey === cfgKey && this._built) return;
    this._cfgKey = cfgKey;
    this._config = config;
    this._dual = dual;
    this._linked = dual && config.control_mode === "linked";
    this._active = 0;
    this._entKey = null;
    this._regRef = null;
    this._last = null;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._built = false;
    if (this._hass) this.hass = this._hass;
    else this._build();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    this._resolve();
    this._update();
  }

  getCardSize() {
    return 6;
  }

  static getConfigElement() {
    return document.createElement("linak-bed-card-editor");
  }

  static getStubConfig(hass) {
    // Pre-select the first device that looks like a LINAK bed.
    const reg = (hass && hass.entities) || {};
    const lang = langOf(hass);
    for (const [id, e] of Object.entries(reg)) {
      if (matchEntity("legs_cover", id) && e.device_id) {
        const dev = hass.devices && hass.devices[e.device_id];
        return { name: (dev && (dev.name_by_user || dev.name)) || tr(lang, "bed"), device: e.device_id };
      }
    }
    return { name: tr(lang, "bed") };
  }

  // Work out which entity to use for each role:
  // explicit `entities` override > entity on the chosen device > `prefix` guess.
  _resolve() {
    const cfg = this._config;
    const reg = this._hass.entities;
    if (reg === this._regRef && this._ent) return;
    this._regRef = reg;

    if (this._dual) {
      const beds = [cfg.entity_a, cfg.entity_b].map((id) => resolveBedFromEntity(id, reg));
      const k = JSON.stringify(beds);
      if (k !== this._entKey) {
        this._entKey = k;
        this._beds = beds;
        this._last = null;
      }
      this._ent = beds[this._active];
      return;
    }

    const ent = {};
    const onDevice = cfg.device && reg
      ? Object.keys(reg).filter((id) => reg[id].device_id === cfg.device)
      : [];
    for (const key of Object.keys(MATCHERS)) {
      const m = MATCHERS[key];
      const override = cfg.entities && cfg.entities[key];
      const fromDevice = onDevice.find((id) => matchEntity(key, id));
      const fromPrefix = cfg.prefix ? `${m.domain}.${cfg.prefix}_${m.suffix}` : null;
      ent[key] = override || fromDevice || fromPrefix || "";
    }
    const key = JSON.stringify(ent);
    if (key !== this._entKey) {
      this._entKey = key;
      this._ent = ent;
      this._beds = [ent];
      this._last = null;
    }
  }

  _configured() {
    return (this._beds || [this._ent || {}]).some((b) => Object.values(b).some((id) => id && this._hass.states[id]));
  }

  // loading -> HA not ready; incomplete -> nothing chosen yet;
  // notfound -> chosen but nothing exists; full -> normal card
  _mode() {
    const h = this._hass;
    if (!h || !h.states || !Object.keys(h.states).length) return "loading";
    const c = this._config || {};
    if (!this._dual && !c.device && !c.prefix && !(c.entities && Object.values(c.entities).some(Boolean))) return "incomplete";
    return this._configured() ? "full" : "notfound";
  }

  // ---------------------------------------------------------------- helpers
  _t(key, vars) {
    return tr(this._lang, key, vars);
  }
  _st(key) {
    return this._hass && this._ent && this._ent[key] ? this._hass.states[this._ent[key]] : undefined;
  }
  // "ok" | "unavailable" | "missing"
  _avail(key) {
    const s = this._st(key);
    if (!s) return "missing";
    return s.state === "unavailable" ? "unavailable" : "ok";
  }
  _presetList() {
    if (this._config.presets) return this._config.presets;
    const sel = this._st("preset");
    const opts = sel && sel.attributes && sel.attributes.options;
    return Array.isArray(opts) && opts.length ? opts : DEFAULT_PRESETS;
  }
  _esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  _num(key) {
    const s = this._st(key);
    const v = s ? parseFloat(s.state) : NaN;
    return isNaN(v) ? 0 : v;
  }
  // Beds a command goes to: the active bed (single mode) or both (linked mode).
  _targets() {
    const beds = this._beds || [this._ent];
    return this._linked ? beds : [beds[this._active] || beds[0]];
  }
  _bedOk(bed, key) {
    const s = bed[key] && this._hass.states[bed[key]];
    return !!s && s.state !== "unavailable";
  }
  // Controls are usable only if every targeted bed can handle them
  _ctrlOk(key) {
    return this._targets().every((b) => this._bedOk(b, key));
  }
  // Send one command to every targeted bed at once (no awaiting between them).
  // Stop is always sent to all targets, even if the entity looks unavailable.
  _call(domain, service, key, extra = {}) {
    if (!this._hass) return;
    const isStop = key === "stop" || service === "stop_cover";
    const ids = this._targets()
      .filter((b) => b[key] && (isStop || this._bedOk(b, key)))
      .map((b) => b[key]);
    if (!ids.length) return;
    ids.forEach((id) => {
      const r = this._hass.callService(domain, service, { entity_id: id, ...extra });
      if (r && r.catch) r.catch((err) => console.warn(`linak-bed-card: ${service} failed for ${id}`, err));
    });
    if (navigator.vibrate) navigator.vibrate(15);
  }
  _setControl(linked, active) {
    this._linked = linked;
    this._active = active;
    this._ent = this._beds[active];
    this._last = null;
    this._update();
  }
  _icon(d) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  }

  // ------------------------------------------------------------------ build
  _build() {
    this._lang = langOf(this._hass, this._config);
    const mode = this._mode();
    const name = this._esc(this._config.name || this._t("bed"));
    if (mode !== "full") {
      this.shadowRoot.innerHTML = `
        <style>${LinakBedCard.styles}</style>
        <ha-card><div class="wrap empty" role="status">
          <div class="name">${name}</div>
          <div class="sub">${this._esc(this._t(mode === "notfound" ? "notFound" : mode))}</div>
        </div></ha-card>`;
      this._built = mode;
      return;
    }
    this.shadowRoot.innerHTML = `
      <style>${LinakBedCard.styles}</style>
      <ha-card>
        <div class="wrap">
          <header>
            <div class="title">
              <span class="name">${name}</span>
              <span class="sub" id="sub">—</span>
            </div>
            <div class="chip" id="conn" role="status">${this._icon(ICONS.bt)}<span id="connTxt">…</span></div>
          </header>

          <div class="notice" id="notice" role="status" hidden></div>

          ${this._dual ? `<div class="modes">
            <div class="seg2" role="group" aria-label="${this._esc(this._t("controlMode"))}">
              <button data-mode="single">${this._esc(this._t("single"))}</button>
              <button data-mode="linked">${this._esc(this._t("linked"))}</button>
            </div>
            <div class="seg2" id="beds" role="group" aria-label="${this._esc(this._t("activeBed"))}">
              <button data-bed="0">${this._esc(this._config.name_a || this._t("bedA"))}</button>
              <button data-bed="1">${this._esc(this._config.name_b || this._t("bedB"))}</button>
            </div>
          </div>` : ""}

          <div class="stage">
            <div class="glow" id="glowEl"></div>
            <svg class="bed" viewBox="0 0 340 170" aria-hidden="true">
              <!-- frame -->
              <rect class="frame" x="40" y="118" width="260" height="8" rx="4"/>
              <rect class="leg" x="52" y="126" width="8" height="26" rx="3"/>
              <rect class="leg" x="280" y="126" width="8" height="26" rx="3"/>

              <!-- seat (fixed) -->
              <rect class="matt" x="146" y="98" width="68" height="18" rx="6"/>

              <!-- back section, hinge at (150,116) -->
              <g id="back" class="seg" style="transform-origin:150px 116px">
                <rect class="matt" x="40" y="98" width="112" height="18" rx="7"/>
                <rect class="pillow" x="48" y="88" width="34" height="12" rx="6"/>
              </g>

              <!-- legs section, hinge at (210,116) -->
              <g id="thigh" class="seg" style="transform-origin:210px 116px">
                <rect class="matt" x="208" y="98" width="52" height="18" rx="6"/>
                <g id="calf" class="seg" style="transform-origin:258px 116px">
                  <rect class="matt" x="256" y="98" width="46" height="18" rx="7"/>
                </g>
              </g>
            </svg>

            <div class="angle a-back"><span id="backDeg">0°</span><small>${this._esc(this._t("back"))}</small></div>
            <div class="angle a-legs"><span id="legsDeg">0°</span><small>${this._esc(this._t("legs"))}</small></div>
            <div class="warn" id="warn" role="alert">${this._esc(this._t("btNoResponse"))}</div>
          </div>

          <div class="controls">
            ${this._ctrlGroup("back", this._t("back"))}
            ${this._ctrlGroup("both", this._t("both"))}
            ${this._ctrlGroup("legs", this._t("legs"))}
          </div>

          <div class="presets" id="presets" role="group" aria-label="${this._esc(this._t("presets"))}"></div>

          <div class="bottom" id="bottom">
            <button class="light" id="light" aria-pressed="false">${this._icon(ICONS.bulb)}<span id="lightTxt">${this._esc(this._t("light"))}</span></button>
            <button class="stopall" id="stopall" aria-label="${this._esc(this._t("stop"))}">${this._icon(ICONS.stop)}<span>${this._esc(this._t("stop"))}</span></button>
          </div>
        </div>
      </ha-card>`;

    const $ = (s) => this.shadowRoot.querySelector(s);
    this._el = {
      sub: $("#sub"), conn: $("#conn"), connTxt: $("#connTxt"), warn: $("#warn"), notice: $("#notice"),
      back: $("#back"), thigh: $("#thigh"), calf: $("#calf"), glow: $("#glowEl"),
      backDeg: $("#backDeg"), legsDeg: $("#legsDeg"),
      light: $("#light"), lightTxt: $("#lightTxt"), presets: $("#presets"), stopall: $("#stopall"),
      bottom: $("#bottom"), card: $("ha-card"),
    };

    this.shadowRoot.querySelectorAll("[data-mode]").forEach((b) =>
      b.addEventListener("click", () => this._setControl(b.dataset.mode === "linked", this._active))
    );
    this.shadowRoot.querySelectorAll("[data-bed]").forEach((b) =>
      b.addEventListener("click", () => this._setControl(false, Number(b.dataset.bed)))
    );
    this.shadowRoot.querySelectorAll("[data-act]").forEach((b) =>
      b.addEventListener("click", () => {
        const [sec, act] = b.dataset.act.split(":");
        const key = `${sec}_cover`;
        const svc = act === "up" ? "open_cover" : act === "down" ? "close_cover" : "stop_cover";
        this._call("cover", svc, key);
      })
    );
    // One listener for all preset buttons (the list can change at runtime)
    this._el.presets.addEventListener("click", (ev) => {
      const b = ev.target.closest(".preset");
      if (b) this._call("select", "select_option", "preset", { option: b.dataset.p });
    });
    // Arrow keys / Home / End move between preset buttons
    this._el.presets.addEventListener("keydown", (ev) => {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      const btns = [...this._el.presets.querySelectorAll(".preset:not([disabled])")];
      const i = btns.indexOf(this.shadowRoot.activeElement);
      if (i < 0 || !btns.length) return;
      let n;
      if (ev.key in keys) n = (i + keys[ev.key] + btns.length) % btns.length;
      else if (ev.key === "Home") n = 0;
      else if (ev.key === "End") n = btns.length - 1;
      else return;
      ev.preventDefault();
      btns[n].focus();
    });
    this._presetKey = null;
    this._el.light.addEventListener("click", () => this._call("switch", "toggle", "light"));
    this._el.stopall.addEventListener("click", () => this._call("button", "press", "stop"));

    this._built = "full";
  }

  _ctrlGroup(sec, label) {
    const l = this._esc(label);
    const up = this._esc(`${label} ${this._t("up")}`);
    const stop = this._esc(`${label} ${this._t("stop").toLowerCase()}`);
    const down = this._esc(`${label} ${this._t("down")}`);
    return `
      <div class="grp" role="group" aria-label="${l}">
        <span class="glabel" aria-hidden="true">${l}</span>
        <button class="btn" data-act="${sec}:up" aria-label="${up}" title="${up}">${this._icon(ICONS.up)}</button>
        <button class="btn small" data-act="${sec}:stop" aria-label="${stop}" title="${stop}">${this._icon(ICONS.stop)}</button>
        <button class="btn" data-act="${sec}:down" aria-label="${down}" title="${down}">${this._icon(ICONS.down)}</button>
      </div>`;
  }

  // ----------------------------------------------------------------- update
  _update() {
    if (!this._hass) return;
    // Language, entities or HA readiness changed: switch between placeholder and full card
    if (!this._built || this._built !== this._mode() || this._lang !== langOf(this._hass, this._config)) {
      this._build();
      this._last = null;
    }
    if (this._built !== "full") return; // placeholder shown, nothing to update
    const e = this._el;

    // Home Assistant calls `hass` on every state change in the whole system.
    // Skip the redraw unless one of this card's entities actually changed.
    const sel = this._st("preset");
    const sig = (this._linked ? "L" : "S") + this._active + "|" + this._beds.flatMap((b) => Object.values(b))
      .map((id) => {
        const s = id && this._hass.states[id];
        return s ? s.state : "";
      })
      .join("|") + "|" + JSON.stringify((sel && sel.attributes && sel.attributes.options) || []);
    if (sig === this._last) return;
    this._last = sig;

    const back = Math.max(0, Math.min(BACK_MAX, this._num("back_angle")));
    const legs = Math.max(0, Math.min(LEGS_MAX, this._num("legs_angle")));
    e.back.style.transform = `rotate(${back}deg)`;
    e.thigh.style.transform = `rotate(${-legs}deg)`;
    e.calf.style.transform = `rotate(${legs * 1.45}deg)`;
    e.backDeg.textContent = `${back.toFixed(0)}°`;
    e.legsDeg.textContent = `${legs.toFixed(0)}°`;

    const conn = this._st("connection");
    const problem = this._st("problem");
    const online = conn && conn.state === "on";
    const bad = problem && problem.state === "on";
    e.conn.className = "chip " + (bad ? "bad" : online ? "ok" : "off");
    e.connTxt.textContent = this._t(bad ? "noResponse" : online ? "connected" : "notConnected");
    e.warn.classList.toggle("show", !!bad);
    e.card.classList.toggle("offline", !online);

    // Partial failures: list missing/unavailable entities, and disable or hide their controls
    const keys = Object.keys(MATCHERS);
    const label = (k) => STRINGS[this._lang].entities[k];
    const missing = keys.filter((k) => this._avail(k) === "missing");
    const unavail = keys.filter((k) => this._avail(k) === "unavailable");
    const notes = [];
    if (unavail.length === keys.length) notes.push(this._t("allUnavailable"));
    else if (unavail.length) notes.push(this._t("unavailable", { list: unavail.map(label).join(", ") }));
    if (missing.length) notes.push(this._t("missing", { list: missing.map(label).join(", ") }));
    e.notice.textContent = notes.join(" ");
    e.notice.hidden = !notes.length;

    this.shadowRoot.querySelectorAll("[data-mode]").forEach((b) =>
      b.classList.toggle("on", (b.dataset.mode === "linked") === this._linked));
    this.shadowRoot.querySelectorAll("[data-bed]").forEach((b) => {
      b.classList.toggle("on", !this._linked && Number(b.dataset.bed) === this._active);
    });
    this.shadowRoot.querySelectorAll("[data-act]").forEach((b) => {
      b.disabled = !this._ctrlOk(`${b.dataset.act.split(":")[0]}_cover`);
    });
    e.stopall.disabled = !this._targets().some((b) => b.stop && this._hass.states[b.stop]);

    const light = this._st("light");
    const lightOn = !!light && light.state === "on";
    e.light.hidden = this._avail("light") === "missing";
    e.light.disabled = !this._ctrlOk("light");
    e.bottom.classList.toggle("nolight", e.light.hidden);
    e.glow.classList.toggle("on", lightOn);
    e.light.classList.toggle("on", lightOn);
    e.light.setAttribute("aria-pressed", String(lightOn));
    e.lightTxt.textContent = this._t(lightOn ? "lightOn" : "lightOff");

    const presets = this._presetList();
    const pKey = presets.join("|");
    if (pKey !== this._presetKey) {
      this._presetKey = pKey;
      e.presets.innerHTML = presets
        .map((p) => `<button class="preset" data-p="${this._esc(p)}" aria-pressed="false" aria-label="${this._esc(this._t("presetLabel", { name: p }))}">${this._esc(p)}</button>`)
        .join("");
    }

    e.presets.hidden = this._avail("preset") === "missing" && !this._config.presets;
    const presetOk = this._ctrlOk("preset");
    const cur = sel && sel.state !== "unavailable" && sel.state !== "unknown" ? sel.state : null;
    e.presets.querySelectorAll(".preset").forEach((b) => {
      const active = b.dataset.p === cur;
      b.disabled = !presetOk;
      b.classList.toggle("active", active);
      b.setAttribute("aria-pressed", String(active));
    });

    const pos = back < 1 && legs < 1
      ? this._t("flat")
      : this._t("posLine", { back: Math.round((back / BACK_MAX) * 100), legs: Math.round((legs / LEGS_MAX) * 100) });
    e.sub.textContent = cur ? `${cur} · ${pos}` : pos;
  }
}

LinakBedCard.styles = `
  :host {
    --bed-accent: var(--linak-accent, var(--primary-color, #7aa7ff));
    --bed-warm: var(--linak-warm, var(--warning-color, #ffae42));
    --bed-ok: var(--success-color, #2fbf71);
    --bed-bad: var(--error-color, #ff5c5c);
    --bed-on-accent: var(--text-primary-color, #fff);
    --bed-matt-top: var(--linak-mattress, #e9edf5);
    --bed-matt-bot: var(--divider-color, #c3cad8);
    --bed-frame: var(--secondary-text-color, #8b93a5);
    --bed-surface: rgba(127,127,127,.10);
    --bed-surface-2: rgba(127,127,127,.18);
  }
  [hidden] { display: none !important; }
  ha-card { overflow: hidden; transition: opacity .3s; }
  ha-card.offline .controls, ha-card.offline .presets { opacity: .45; }
  .wrap { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
  .wrap.empty { gap: 6px; }
  .wrap.empty .name { font-size: 1.15rem; font-weight: 600; color: var(--primary-text-color); }
  .wrap.empty .sub { font-size: .9rem; color: var(--secondary-text-color); }

  header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .title { display: flex; flex-direction: column; min-width: 0; }
  .name { font-size: 1.25rem; font-weight: 600; color: var(--primary-text-color); letter-spacing: .2px; }
  .sub { font-size: .82rem; color: var(--secondary-text-color); margin-top: 2px; }

  .chip { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px 4px 6px;
          border-radius: 999px; font-size: .75rem; font-weight: 600; white-space: nowrap;
          background: var(--bed-surface); color: var(--secondary-text-color); }
  .chip svg { width: 16px; height: 16px; fill: currentColor; }
  .chip.ok  { color: var(--bed-ok); background: color-mix(in srgb, var(--bed-ok) 14%, transparent); }
  .chip.bad { color: var(--bed-bad); background: color-mix(in srgb, var(--bed-bad) 16%, transparent); animation: pulse 1.6s infinite; }
  .notice { font-size: .8rem; color: var(--secondary-text-color); padding: 8px 12px; border-radius: 12px;
            background: color-mix(in srgb, var(--bed-warm) 14%, transparent);
            border-left: 3px solid var(--bed-warm); }
  @keyframes pulse { 50% { opacity: .55; } }

  .stage { position: relative; border-radius: 16px; padding: 6px 4px 0;
           background: radial-gradient(120% 90% at 50% 0%, var(--bed-surface-2), transparent 70%); }
  .bed { width: 100%; height: auto; display: block; }
  .frame, .leg { fill: var(--bed-frame); opacity: .55; }
  .matt { fill: var(--bed-matt-top); stroke: var(--bed-matt-bot); stroke-width: 1.5; }
  .pillow { fill: #ffffff; opacity: .9; }
  .seg { transform-box: view-box; transition: transform 1.2s cubic-bezier(.3,.7,.2,1); }
  /* Under-bed glow: plain CSS (no SVG gradient) so it never flickers while the bed redraws */
  .glow { position: absolute; left: 6%; right: 6%; bottom: 2%; height: 30%; border-radius: 50%;
          background: radial-gradient(closest-side, color-mix(in srgb, var(--bed-warm) 95%, transparent), color-mix(in srgb, var(--bed-warm) 45%, transparent) 45%, transparent);
          opacity: 0; transition: opacity .8s ease; pointer-events: none;
          transform: translateZ(0); will-change: opacity; }
  .glow.on { opacity: 1; }
  .bed { position: relative; }

  .angle { position: absolute; top: 8px; display: flex; flex-direction: column; align-items: center;
           line-height: 1.05; color: var(--primary-text-color); }
  .angle span { font-size: 1.15rem; font-weight: 700; font-variant-numeric: tabular-nums; }
  .angle small { font-size: .68rem; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: .8px; }
  .a-back { left: 14px; } .a-legs { right: 14px; }

  .warn { position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%);
          font-size: .72rem; font-weight: 600; color: var(--bed-on-accent); background: var(--bed-bad);
          padding: 3px 10px; border-radius: 999px; opacity: 0; pointer-events: none; transition: opacity .3s; }
  .warn.show { opacity: 1; }

  button { font: inherit; cursor: pointer; border: none; -webkit-tap-highlight-color: transparent; }
  button:focus-visible { outline: 2px solid var(--bed-accent); outline-offset: 2px; }
  button:disabled { opacity: .4; cursor: not-allowed; }
  button svg { width: 22px; height: 22px; fill: currentColor; }

  .controls { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .grp { display: flex; flex-direction: column; align-items: center; gap: 6px;
         padding: 10px 6px; border-radius: 16px; background: var(--bed-surface); }
  .glabel { font-size: .72rem; font-weight: 600; text-transform: uppercase; letter-spacing: .8px;
            color: var(--secondary-text-color); }
  .btn { width: 100%; max-width: 72px; height: 40px; border-radius: 12px; display: grid; place-items: center;
         background: var(--bed-surface-2); color: var(--primary-text-color);
         transition: transform .12s, background .2s, color .2s; }
  .btn.small { height: 30px; color: var(--secondary-text-color); }
  .btn.small svg { width: 16px; height: 16px; }
  .btn:hover:not(:disabled) { background: color-mix(in srgb, var(--bed-accent) 22%, transparent); color: var(--bed-accent); }
  button:active:not(:disabled) { transform: scale(.94); }

  .modes { display: flex; flex-wrap: wrap; gap: 8px; }
  .seg2 { display: inline-flex; border-radius: 999px; background: var(--bed-surface); padding: 2px; }
  .seg2 button { padding: 5px 12px; border-radius: 999px; font-size: .8rem; font-weight: 600;
                 background: transparent; color: var(--secondary-text-color); }
  .seg2 button.on { background: var(--bed-accent); color: var(--bed-on-accent); }
  .presets { display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 8px; }
  .preset { padding: 9px 6px; border-radius: 12px; font-size: .85rem; font-weight: 600;
            background: var(--bed-surface); color: var(--primary-text-color); transition: all .2s; }
  .preset.active { background: var(--bed-accent); color: var(--bed-on-accent);
                   box-shadow: 0 4px 14px color-mix(in srgb, var(--bed-accent) 45%, transparent); }

  .bottom { display: grid; grid-template-columns: 1fr auto; gap: 10px; }
  .bottom.nolight { grid-template-columns: 1fr; }
  .light, .stopall { display: flex; align-items: center; justify-content: center; gap: 8px;
                     padding: 11px 14px; border-radius: 14px; font-weight: 600; font-size: .9rem;
                     background: var(--bed-surface); color: var(--primary-text-color); transition: all .25s; }
  .light.on { background: linear-gradient(135deg, color-mix(in srgb, var(--bed-warm) 65%, white), var(--bed-warm)); color: #3a2400;
              box-shadow: 0 6px 22px color-mix(in srgb, var(--bed-warm) 45%, transparent); }
  .stopall { background: color-mix(in srgb, var(--bed-bad) 14%, transparent); color: var(--bed-bad); }
  .stopall svg { width: 18px; height: 18px; }
`;

customElements.define("linak-bed-card", LinakBedCard);

// ====================================================================== editor
class LinakBedCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = { ...config };
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  // ha-form is only loaded once the user has opened a built-in card editor.
  // Loading an entities card's editor makes sure it is available.
  _ensureForm() {
    if (customElements.get("ha-form")) return Promise.resolve();
    if (!this._loading) {
      this._loading = (async () => {
        try {
          const helpers = await window.loadCardHelpers();
          const card = await helpers.createCardElement({ type: "entities", entities: [] });
          if (card && card.constructor.getConfigElement) await card.constructor.getConfigElement();
        } catch (e) {
          /* ignore */
        }
        await customElements.whenDefined("ha-form");
      })();
    }
    return this._loading;
  }

  _schema() {
    return [
      { name: "device", selector: { device: { filter: { integration: "esphome" } } } },
      { name: "name", selector: { text: {} } },
      {
        type: "expandable",
        name: "entities",
        title: this._t("advanced"),
        schema: Object.keys(MATCHERS).map((k) => ({
          name: k,
          selector: { entity: { domain: MATCHERS[k].domain } },
        })),
      },
    ];
  }

  _t(key) {
    return tr(langOf(this._hass, this._config), key);
  }

  _label = (s) =>
    ({ device: this._t("deviceLabel"), name: this._t("nameLabel") }[s.name] ||
      STRINGS[langOf(this._hass, this._config)].entities[s.name] || s.name);

  _helper = (s) => (s.name === "device" ? this._t("deviceHelper") : undefined);

  async _update() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      await this._ensureForm();
      if (this._form) return this._update();
      this._form = document.createElement("ha-form");
      this._form.computeLabel = this._label;
      this._form.computeHelper = this._helper;
      this._form.addEventListener("value-changed", (ev) => this._changed(ev));
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.schema = this._schema();
    this._form.data = { ...this._config, entities: { ...(this._config.entities || {}) } };
  }

  _changed(ev) {
    ev.stopPropagation();
    const v = ev.detail.value || {};
    const cfg = { ...this._config, ...v };

    // When a new bed is picked and the name is empty or still the old bed's name, use the device name.
    if (v.device && v.device !== this._config.device) {
      const dev = this._hass.devices && this._hass.devices[v.device];
      const devName = dev && (dev.name_by_user || dev.name);
      const oldDev = this._config.device && this._hass.devices && this._hass.devices[this._config.device];
      const oldName = oldDev && (oldDev.name_by_user || oldDev.name);
      if (devName && (!cfg.name || Object.values(STRINGS).some((l) => l.bed === cfg.name) || cfg.name === oldName)) cfg.name = devName;
      delete cfg.prefix; // device lookup replaces the old prefix guess
    }

    // Drop empty overrides so the config stays tidy
    const ents = {};
    for (const [k, id] of Object.entries(cfg.entities || {})) if (id) ents[k] = id;
    if (Object.keys(ents).length) cfg.entities = ents;
    else delete cfg.entities;
    if (!cfg.device) delete cfg.device;

    this._config = cfg;
    this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: cfg }, bubbles: true, composed: true }));
  }
}

customElements.define("linak-bed-card-editor", LinakBedCardEditor);


window.customCards = window.customCards || [];
window.customCards.push({
  type: "linak-bed-card",
  name: "LINAK Bed Card",
  description: "Live bed drawing, motor controls, presets and light for ESPHome LINAK beds.",
  preview: true,
});

console.info(`%c LINAK-BED-CARD %c v${VERSION} `, "background:#7aa7ff;color:#fff;border-radius:3px 0 0 3px", "background:#333;color:#fff;border-radius:0 3px 3px 0");
