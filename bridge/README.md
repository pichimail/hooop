# Hooop Companion · local machine hub & paired phone monitor

This is a real **local Node.js 24+** companion for the original compiled Rust embroidery engine, not a cloud simulator. It does not require a hosted database or subscription for native exports. You need the **Hooop desktop CLI** (`zigzag-cli.exe` on Windows or `zigzag` on macOS) installed and discoverable via `HOOOP_CLI`.

## Get started (computer only)

```bash
# From the Hooop repository; replace with the absolute path to your built CLI.
export HOOOP_CLI=/absolute/path/to/zigzag
node bridge/server.mjs
# Then browse http://127.0.0.1:4787/devices/ on the same computer.
```

On Windows PowerShell:

```powershell
$env:HOOOP_CLI='C:\path\to\zigzag-cli.exe'
node .\bridge\server.mjs
```

The terminal prints a random six-digit code at startup. Open Machines & Phone in the local Companion, pair using that code and scan devices. The public https://hooop.vercel.app/devices/ page is a **catalog and setup surface**, not a connection to your private desktop.

## Pairing on a phone (same Wi-Fi/LAN)

The companion **intentionally binds only to loopback over HTTP**. Remote phones require trusted HTTPS with both a certificate and key. An internal/private TLS certificate must be trusted on each phone. Tailscale with HTTPS (or a LAN reverse proxy with a trusted certificate) is suitable; *do not* expose an unauthenticated HTTP port on the public Internet.

```bash
HOOOP_HOST=0.0.0.0 \
HOOOP_PORT=4787 \
HOOOP_TLS_CERT=/path/to/trusted/cert.pem \
HOOOP_TLS_KEY=/path/to/trusted/key.pem \
HOOOP_CLI=/path/to/zigzag \
node bridge/server.mjs
```

Open `https://YOUR-DESKTOP-LAN-IP:4787/devices/` on your phone, enter the code printed on desktop. Session tokens expire after eight hours. Pairing is rate-limited and origin-checked. No source images or machine records are uploaded to Hooop cloud by default. Browsers require a trusted TLS certificate; accepting a broken certificate is not a production setup.

To prepare a **local development** certificate use a tool such as `mkcert` and install its trust root on your phone. Never commit keys or certificates. For off-LAN access, prefer a private VPN (e.g. Tailscale) with HTTPS rather than router port forwarding.

## Actual support matrix

| Mechanism | Discovery | Working transfer | Remote monitoring |
|---|---|---|---|
| Brother Skitch PP1 BLE | Bluetooth LE scan via Rust CLI with `ble` | Implemented PP1 protocol, explicitly enabled only | On-demand PP1 status and stitch progress |
| Other BLE embroidery machines | Advertisements only | **Unsupported until device-specific protocol exists** | Unsupported |
| USB removable drive | Mounted directory/drive discovery | Native machine file copied to chosen mounted drive | No machine status |
| USB direct cable | Mounted volume if exposed | No device USB protocol implemented | Unsupported |
| LAN/Wi-Fi | mDNS advertisement discovery | **Only** operator-configured, compatible HTTPS HTTP PUT receivers | Only if receiver exposes a separately implemented status protocol (not currently implemented) |

Profiles include known hoop sizes and export formats. **A profile never implies protocol support or guarantees sewing compatibility.** The onboard machine software must read the generated file type and the pattern must fit its actual hoop and stitch limits. The current provider has no basis to promise universal Bluetooth direct control.

## Remote file transfer — opt in

By default, the phone may monitor and request conversion/download but **cannot transfer to a device**. Explicitly opt into transfers on the computer:

```bash
HOOOP_ALLOW_REMOTE_TRANSFER=1 node bridge/server.mjs
```

A phone must choose destination, verify the design, tick the confirmation checkbox, and submit. The bridge refuses overwriting an existing USB file. Users must not send remote machine **start sewing** commands; the operator physically starts the machine.

For a **verified HTTPS file receiver** that supports binary PUT, preconfigure an exact endpoint using `HOOOP_LAN_TARGETS_JSON` (never use arbitrary user-provided URLs):

```bash
export HOOOP_LAN_TARGETS_JSON='{"receiver-01":{"name":"Verified LAN file receiver","endpoint":"https://receiver.your-lan.example/upload","authorization":"Bearer YOUR-RECEIVER-TOKEN"}}'
```

This does **not** magically make every manufacturer's Wi-Fi protocol compatible. The receiver must explicitly implement that endpoint; otherwise no LAN transfer is supported.

For direct Brother PP1 Bluetooth upload, additionally set `HOOOP_ALLOW_BLE_SEND=1`, select the Skitch profile and `.pen` output, pair the physical PP1 locally, and confirm transfer. It **never** automatically starts sewing.

## Uploaded images and optional AI

The browser's **Image → design** panel traces logo/photo color regions on device using actual editable SVG paths. For higher-quality machine digitization, use the native Rust converter, which includes VectorCraft raster tracing and stitch generation. The optional AI vision advice endpoint is available only when `OPENROUTER_API_KEY` is supplied on the companion process, with a provider/model capable of accepting images; the image is sent to the provider **only after explicit image-sharing consent**. Cloud inference may have usage costs. No AI can guarantee pixel-identical or sew-ready reconstruction from every photo; review stitches, thread colors and underlay before sewing.

## Validation / no hardware promises

- `node --test bridge/test/*.test.mjs` tests actual pairing, auth restrictions, API responses, mock native CLI conversion job, USB output and boundary cases.
- `node --check web/app.js && node --check web/devices.js && node --check web/image-assistant.js` checks the frontend.
- Native desktop builds run on GitHub Actions. Bluetooth discovery is testable without pairing; actual PP1 and other brands need on-device testing. No unsupported transport claims should appear as "connected".
