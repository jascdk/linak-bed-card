# LINAK Bed Card

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/)

A Home Assistant dashboard card for LINAK adjustable beds controlled over Bluetooth with ESPHome.

![LINAK Bed Card](images/preview.png)

## Features

- **Live drawing of the bed.** The back and legs tilt to the real angles reported by the bed.
- **Under-bed light** with a warm glow when it is on.
- **Connection status**, with a red warning when the bed's Bluetooth stops responding.
- **Up / stop / down** for back, legs and both.
- **Preset buttons**, with the active preset highlighted.
- **Big stop button.**
- Follows your Home Assistant theme (light and dark).

## Installation

### HACS (recommended)

1. In HACS, open the menu (⋮) and choose **Custom repositories**.
2. Add this repository's URL and choose the category **Dashboard**.
3. Find **LINAK Bed Card** in HACS and download it.
4. Refresh your browser.

### Manual

1. Copy `linak-bed-card.js` to `/config/www/`.
2. Go to **Settings → Dashboards → ⋮ → Resources → Add resource**:
   - URL: `/local/linak-bed-card.js`
   - Type: **JavaScript module**

## Usage

1. Edit your dashboard and click **Add card**.
2. Search for **LINAK Bed Card**.
3. In the editor, choose the bed under **Seng (enhed)**.

That's it. The card finds the bed's entities on the device by itself, whatever the entity IDs are called, and reads the preset names from the bed's preset select.

Under **Avanceret: vælg entiteter manuelt** you can pick any entity by hand, if one isn't found automatically.

### YAML

The editor writes YAML like this:

```yaml
type: custom:linak-bed-card
name: Jacob
device: 0123456789abcdef0123456789abcdef
```

| Option     | Description                                                                 |
| ---------- | --------------------------------------------------------------------------- |
| `device`   | The bed's device ID. Entities are found on it automatically (recommended).  |
| `name`     | Title shown on the card. Defaults to the device name.                       |
| `entities` | Override individual entities (see below).                                   |
| `presets`  | Preset names. Default: the options of the bed's preset select.              |
| `prefix`   | Older alternative to `device`: entity ID prefix, e.g. `jacob_seng`.         |

Keys for `entities`: `back_cover`, `legs_cover`, `both_cover`, `back_angle`, `legs_angle`, `light`, `connection`, `problem`, `preset`, `stop`.

## ESPHome

The card is made for the ESPHome configuration in [`esphome/linak-bed.yaml`](esphome/linak-bed.yaml). Set your bed's Bluetooth MAC address and Wi-Fi secrets before installing it.

The configuration is based on the LINAK protocol documentation in [kristofferR/ha-adjustable-bed](https://github.com/kristofferR/ha-adjustable-bed/blob/main/docs/beds/linak.md). It sends every movement with a proper `FF 00` release, queues light commands, and waits for the bed to be ready after connecting.

## License

MIT
