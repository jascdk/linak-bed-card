/*
 * LINAK Bed Card - custom Home Assistant Lovelace card
 * for the ESPHome LINAK bed configs (linak-jacob-seng / linak-helene-seng).
 *
 * Install:
 *   1. Copy this file to /config/www/linak-bed-card.js
 *   2. Settings -> Dashboards -> (⋮) Resources -> Add resource
 *        URL: /local/linak-bed-card.js   Type: JavaScript module
 *   3. Add a card (Manual):
 *        type: custom:linak-bed-card
 *        name: Jacob
 *        prefix: jacob_seng
 *
 * All entity IDs are derived from `prefix`, but each can be overridden:
 *   entities:
 *     back_cover: cover.jacob_seng_head
 *     ...
 */

const VERSION = "1.0.2";

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
    if (!config.prefix && !config.entities) {
      throw new Error("Set `prefix` (e.g. jacob_seng) or an `entities` map");
    }
    // Home Assistant may call setConfig again with the same config;
    // only rebuild when it actually changed (avoids flicker).
    const cfgKey = JSON.stringify(config);
    if (this._cfgKey === cfgKey && this._built) return;
    this._cfgKey = cfgKey;
    this._last = null;
    this._config = config;
    const p = config.prefix || "";
    this._ent = {};
    for (const [k, v] of Object.entries(DEFAULT_ENTITIES)) {
      this._ent[k] = (config.entities && config.entities[k]) || v.replace("{p}", p);
    }
    this._presets = config.presets || ["Flad", "Sove", "TV", "Helt Oppe"];
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._built = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._build();
    this._update();
  }

  getCardSize() {
    return 6;
  }

  static getStubConfig() {
    return { name: "Seng", prefix: "jacob_seng" };
  }

  // ---------------------------------------------------------------- helpers
  _st(key) {
    return this._hass && this._hass.states[this._ent[key]];
  }
  _num(key) {
    const s = this._st(key);
    const v = s ? parseFloat(s.state) : NaN;
    return isNaN(v) ? 0 : v;
  }
  _call(domain, service, key, extra = {}) {
    if (!this._hass) return;
    this._hass.callService(domain, service, { entity_id: this._ent[key], ...extra });
    if (navigator.vibrate) navigator.vibrate(15);
  }
  _icon(d) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
  }

  // ------------------------------------------------------------------ build
  _build() {
    const name = this._config.name || "Seng";
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

          <div class="presets" id="presets">
            ${this._presets.map((p) => `<button class="preset" data-p="${p}">${p}</button>`).join("")}
          </div>

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
    this.shadowRoot.querySelectorAll(".preset").forEach((b) =>
      b.addEventListener("click", () => this._call("select", "select_option", "preset", { option: b.dataset.p }))
    );
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
    const e = this._el;

    // Home Assistant calls `hass` on every state change in the whole system.
    // Skip the redraw unless one of this card's entities actually changed.
    const sig = Object.values(this._ent)
      .map((id) => {
        const s = this._hass.states[id];
        return s ? s.state : "";
      })
      .join("|");
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

window.customCards = window.customCards || [];
window.customCards.push({
  type: "linak-bed-card",
  name: "LINAK Bed Card",
  description: "Live bed drawing, motor controls, presets and light for ESPHome LINAK beds.",
  preview: false,
});

console.info(`%c LINAK-BED-CARD %c v${VERSION} `, "background:#7aa7ff;color:#fff;border-radius:3px 0 0 3px", "background:#333;color:#fff;border-radius:0 3px 3px 0");
