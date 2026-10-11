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
 *   entities:                  # optional per-entity overrides
 *     light: switch.my_light
 */

const VERSION = "1.1.0";

// Entity ID patterns used to find each entity on the chosen device.
// They only look at the END of the entity ID, so long device names don't matter.
const MATCHERS = {
  back_cover: /^cover\..*_head$/,
  legs_cover: /^cover\..*_legs$/,
  both_cover: /^cover\..*_hoved_fod$/,
  back_angle: /^sensor\..*ryg_h(o|_)?jde$/,
  legs_angle: /^sensor\..*ben_h(o|_)?jde$/,
  light: /^switch\..*_lys$/,
  connection: /^binary_sensor\..*_forbindelse_status$/,
  problem: /^binary_sensor\..*_bluetooth_svarer_ikke$/,
  preset: /^select\..*_preset_mode$/,
  stop: /^button\..*_stop$/,
};

const ENTITY_LABELS = {
  back_cover: "Ryg (cover)",
  legs_cover: "Ben (cover)",
  both_cover: "Begge (cover)",
  back_angle: "Ryg vinkel (sensor)",
  legs_angle: "Ben vinkel (sensor)",
  light: "Lys (switch)",
  connection: "Forbindelse (binary_sensor)",
  problem: "Bluetooth svarer ikke (binary_sensor)",
  preset: "Preset (select)",
  stop: "Stop (button)",
};

const DEFAULT_PRESETS = ["Flad", "Sove", "TV", "Helt Oppe"];

const DEFAULT_ENTITIES = {
  back_cover: "cover.{p}_head",
  legs_cover: "cover.{p}_legs",
  both_cover: "cover.{p}_hoved_fod",
  back_angle: "sensor.{p}_ryg_hojde",
  legs_angle: "sensor.{p}_ben_hojde",
  light: "switch.{p}_lys",
  connection: "binary_sensor.{p}_forbindelse_status",
  problem: "binary_sensor.{p}_bluetooth_svarer_ikke",
  preset: "select.{p}_preset_mode",
  stop: "button.{p}_stop",
};

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
    // Home Assistant may call setConfig again with the same config;
    // only rebuild when it actually changed (avoids flicker).
    const cfgKey = JSON.stringify(config);
    if (this._cfgKey === cfgKey && this._built) return;
    this._cfgKey = cfgKey;
    this._config = config;
    this._entKey = null;
    this._regRef = null;
    this._last = null;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._built = false;
    if (this._hass) this.hass = this._hass;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    this._resolve();
    if (!this._built) this._build();
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
    for (const [id, e] of Object.entries(reg)) {
      if (MATCHERS.legs_cover.test(id) && e.device_id) {
        const dev = hass.devices && hass.devices[e.device_id];
        return { name: (dev && (dev.name_by_user || dev.name)) || "Seng", device: e.device_id };
      }
    }
    return { name: "Seng" };
  }

  // Work out which entity to use for each role:
  // explicit `entities` override > entity on the chosen device > `prefix` guess.
  _resolve() {
    const cfg = this._config;
    const reg = this._hass.entities;
    if (reg === this._regRef && this._ent) return;
    this._regRef = reg;

    const ent = {};
    const onDevice = cfg.device && reg
      ? Object.keys(reg).filter((id) => reg[id].device_id === cfg.device)
      : [];
    for (const key of Object.keys(MATCHERS)) {
      const override = cfg.entities && cfg.entities[key];
      const fromDevice = onDevice.find((id) => MATCHERS[key].test(id));
      const fromPrefix = cfg.prefix ? DEFAULT_ENTITIES[key].replace("{p}", cfg.prefix) : null;
      ent[key] = override || fromDevice || fromPrefix || "";
    }
    const key = JSON.stringify(ent);
    if (key !== this._entKey) {
      this._entKey = key;
      this._ent = ent;
      this._last = null;
    }
  }

  _configured() {
    return Object.values(this._ent || {}).some((id) => id && this._hass.states[id]);
  }

  // ---------------------------------------------------------------- helpers
  _st(key) {
    return this._hass && this._ent && this._ent[key] ? this._hass.states[this._ent[key]] : undefined;
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
  _call(domain, service, key, extra = {}) {
    if (!this._hass || !this._ent[key]) return;
    this._hass.callService(domain, service, { entity_id: this._ent[key], ...extra });
    if (navigator.vibrate) navigator.vibrate(15);
  }
  _icon(d) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  }

  // ------------------------------------------------------------------ build
  _build() {
    const name = this._esc(this._config.name || "Seng");
    if (!this._configured()) {
      this.shadowRoot.innerHTML = `
        <style>${LinakBedCard.styles}</style>
        <ha-card><div class="wrap empty">
          <div class="name">${name}</div>
          <div class="sub">Vælg sengen i kortets editor (blyant-ikonet), så findes alle entiteter automatisk.</div>
        </div></ha-card>`;
      this._built = "empty";
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
            <div class="chip" id="conn">${this._icon(ICONS.bt)}<span id="connTxt">…</span></div>
          </header>

          <div class="stage">
            <div class="glow" id="glowEl"></div>
            <svg class="bed" viewBox="0 0 340 170">
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

            <div class="angle a-back"><span id="backDeg">0°</span><small>Ryg</small></div>
            <div class="angle a-legs"><span id="legsDeg">0°</span><small>Ben</small></div>
            <div class="warn" id="warn">Bluetooth svarer ikke</div>
          </div>

          <div class="controls">
            ${this._ctrlGroup("back", "Ryg")}
            ${this._ctrlGroup("both", "Begge")}
            ${this._ctrlGroup("legs", "Ben")}
          </div>

          <div class="presets" id="presets"></div>

          <div class="bottom">
            <button class="light" id="light">${this._icon(ICONS.bulb)}<span id="lightTxt">Lys</span></button>
            <button class="stopall" id="stopall">${this._icon(ICONS.stop)}<span>Stop</span></button>
          </div>
        </div>
      </ha-card>`;

    const $ = (s) => this.shadowRoot.querySelector(s);
    this._el = {
      sub: $("#sub"), conn: $("#conn"), connTxt: $("#connTxt"), warn: $("#warn"),
      back: $("#back"), thigh: $("#thigh"), calf: $("#calf"), glow: $("#glowEl"),
      backDeg: $("#backDeg"), legsDeg: $("#legsDeg"),
      light: $("#light"), lightTxt: $("#lightTxt"), presets: $("#presets"),
      card: $("ha-card"),
    };

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
    this._presetKey = null;
    this._el.light.addEventListener("click", () => this._call("switch", "toggle", "light"));
    $("#stopall").addEventListener("click", () => this._call("button", "press", "stop"));

    this._built = true;
  }

  _ctrlGroup(sec, label) {
    return `
      <div class="grp">
        <span class="glabel">${label}</span>
        <button class="btn" data-act="${sec}:up" aria-label="${label} op">${this._icon(ICONS.up)}</button>
        <button class="btn small" data-act="${sec}:stop" aria-label="${label} stop">${this._icon(ICONS.stop)}</button>
        <button class="btn" data-act="${sec}:down" aria-label="${label} ned">${this._icon(ICONS.down)}</button>
      </div>`;
  }

  // ----------------------------------------------------------------- update
  _update() {
    if (!this._built || !this._hass) return;
    // Entities appeared (or vanished): switch between placeholder and full card
    if ((this._built === "empty") === this._configured()) {
      this._built = false;
      this._build();
      this._last = null;
    }
    if (this._built === "empty") return; // placeholder shown, nothing to update
    const e = this._el;

    // Home Assistant calls `hass` on every state change in the whole system.
    // Skip the redraw unless one of this card's entities actually changed.
    const sel = this._st("preset");
    const sig = Object.values(this._ent)
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
    e.connTxt.textContent = bad ? "Svarer ikke" : online ? "Forbundet" : "Ikke forbundet";
    e.warn.classList.toggle("show", !!bad);
    e.card.classList.toggle("offline", !online);

    const light = this._st("light");
    const lightOn = light && light.state === "on";
    e.glow.classList.toggle("on", lightOn);
    e.light.classList.toggle("on", lightOn);
    e.lightTxt.textContent = lightOn ? "Lys tændt" : "Lys slukket";

    const presets = this._presetList();
    const pKey = presets.join("|");
    if (pKey !== this._presetKey) {
      this._presetKey = pKey;
      e.presets.innerHTML = presets
        .map((p) => `<button class="preset" data-p="${this._esc(p)}">${this._esc(p)}</button>`)
        .join("");
    }

    const preset = this._st("preset");
    const cur = preset ? preset.state : null;
    e.presets.querySelectorAll(".preset").forEach((b) => b.classList.toggle("active", b.dataset.p === cur));

    const pos = back < 1 && legs < 1 ? "Flad" : `Ryg ${Math.round((back / BACK_MAX) * 100)}% · Ben ${Math.round((legs / LEGS_MAX) * 100)}%`;
    e.sub.textContent = pos;
  }
}

LinakBedCard.styles = `
  :host {
    --bed-accent: var(--linak-accent, #7aa7ff);
    --bed-warm: #ffae42;
    --bed-matt-top: var(--linak-mattress, #e9edf5);
    --bed-matt-bot: #c3cad8;
    --bed-frame: var(--secondary-text-color, #8b93a5);
    --bed-surface: rgba(127,127,127,.10);
    --bed-surface-2: rgba(127,127,127,.18);
  }
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
  .chip.ok  { color: #2fbf71; background: rgba(47,191,113,.14); }
  .chip.bad { color: #ff5c5c; background: rgba(255,92,92,.16); animation: pulse 1.6s infinite; }
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
          background: radial-gradient(closest-side, rgba(255,179,71,.95), rgba(255,159,46,.45) 45%, rgba(255,159,46,0));
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
          font-size: .72rem; font-weight: 600; color: #fff; background: #e04848;
          padding: 3px 10px; border-radius: 999px; opacity: 0; pointer-events: none; transition: opacity .3s; }
  .warn.show { opacity: 1; }

  button { font: inherit; cursor: pointer; border: none; -webkit-tap-highlight-color: transparent; }
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
  .btn:hover { background: color-mix(in srgb, var(--bed-accent) 22%, transparent); color: var(--bed-accent); }
  .btn:active, .preset:active, .light:active, .stopall:active { transform: scale(.94); }

  .presets { display: grid; grid-template-columns: repeat(auto-fit, minmax(70px, 1fr)); gap: 8px; }
  .preset { padding: 9px 6px; border-radius: 12px; font-size: .85rem; font-weight: 600;
            background: var(--bed-surface); color: var(--primary-text-color); transition: all .2s; }
  .preset.active { background: var(--bed-accent); color: #fff;
                   box-shadow: 0 4px 14px color-mix(in srgb, var(--bed-accent) 45%, transparent); }

  .bottom { display: grid; grid-template-columns: 1fr auto; gap: 10px; }
  .light, .stopall { display: flex; align-items: center; justify-content: center; gap: 8px;
                     padding: 11px 14px; border-radius: 14px; font-weight: 600; font-size: .9rem;
                     background: var(--bed-surface); color: var(--primary-text-color); transition: all .25s; }
  .light.on { background: linear-gradient(135deg, #ffcf70, var(--bed-warm)); color: #3a2400;
              box-shadow: 0 6px 22px rgba(255,166,60,.45); }
  .stopall { background: rgba(255,92,92,.14); color: #ff5c5c; }
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
        title: "Avanceret: vælg entiteter manuelt",
        schema: Object.keys(MATCHERS).map((k) => ({
          name: k,
          selector: { entity: { domain: MATCHERS[k].source.slice(1).split("\\.")[0] } },
        })),
      },
    ];
  }

  _label = (s) =>
    ({ device: "Seng (enhed)", name: "Navn på kortet" }[s.name] || ENTITY_LABELS[s.name] || s.name);

  _helper = (s) =>
    s.name === "device"
      ? "Vælg sengens ESPHome-enhed. Alle entiteter findes automatisk."
      : undefined;

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
      if (devName && (!cfg.name || cfg.name === "Seng" || cfg.name === oldName)) cfg.name = devName;
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
