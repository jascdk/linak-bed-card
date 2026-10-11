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

```yaml
type: custom:linak-bed-card
name: Jacob
prefix: jacob_seng
```

`prefix` is the start of the bed's entity IDs. With `prefix: jacob_seng`, the card uses:

| Key          | Default entity                              |
| ------------ | ------------------------------------------- |
| `back_cover` | `cover.jacob_seng_head`                     |
| `legs_cover` | `cover.jacob_seng_legs`                     |
| `both_cover` | `cover.jacob_seng_hoved_fod`                |
| `back_angle` | `sensor.jacob_seng_ryg_hojde`               |
| `legs_angle` | `sensor.jacob_seng_ben_hojde`               |
| `light`      | `switch.jacob_seng_lys`                     |
| `connection` | `binary_sensor.jacob_seng_forbindelse_status` |
| `problem`    | `binary_sensor.jacob_seng_bluetooth_svarer_ikke` |
| `preset`     | `select.jacob_seng_preset_mode`             |
| `stop`       | `button.jacob_seng_stop`                    |

If any of your entity IDs differ, override them:

```yaml
type: custom:linak-bed-card
name: Jacob
prefix: jacob_seng
entities:
  back_angle: sensor.my_back_angle
  light: switch.my_bed_light
```

### Options

| Option     | Required | Description                                                      |
| ---------- | -------- | ---------------------------------------------------------------- |
| `prefix`   | Yes*     | Entity ID prefix. *Not needed if all entities are set.           |
| `name`     | No       | Title shown on the card. Default: `Seng`.                        |
| `entities` | No       | Override individual entity IDs (see table above).                |
| `presets`  | No       | List of preset names. Default: `[Flad, Sove, TV, Helt Oppe]`.    |

The preset names must match the options of the preset select entity.

## ESPHome

The card is made for the ESPHome configuration in [`esphome/linak-bed.yaml`](esphome/linak-bed.yaml). Set your bed's Bluetooth MAC address and Wi-Fi secrets before installing it.

The configuration is based on the LINAK protocol documentation in [kristofferR/ha-adjustable-bed](https://github.com/kristofferR/ha-adjustable-bed/blob/main/docs/beds/linak.md). It sends every movement with a proper `FF 00` release, queues light commands, and waits for the bed to be ready after connecting.

## License

MIT
