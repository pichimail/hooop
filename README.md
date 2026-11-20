<p align="left"><img src="web/assets/icon-192.png" alt="Hooop app mark" width="108"></p>

# Hooop

**A thoughtful embroidery studio for macOS, Windows, and the browser.**

Hooop combines a native, Rust-powered embroidery editor with a new mobile-friendly SVG composition studio. Create and refine SVG artwork on the web, then finish precision machine digitization with the macOS or Windows application.

- **Browser / mobile:** [Open Hooop Web Studio](https://hooop.vercel.app/studio/) · [Start here](https://hooop.vercel.app/guide/)
- **Mac and Windows downloads:** [GitHub releases](https://github.com/pichimail/hooop/releases) (only when Hooop packages have actually been published)
- **Source:** [pichimail/hooop](https://github.com/pichimail/hooop)

## What works where

| Capability | Web / mobile PWA | macOS / Windows |
|---|:---:|:---:|
| Responsive design canvas | ✓ | ✓ |
| Basic shapes, lettering and SVG editing | ✓ | ✓ |
| Import SVG | Basic shapes and paths | Full native importer |
| Export SVG | ✓ | ✓ |
| Export PNG | ✓ | ✓ (native export workflow) |
| Undo, redo, layers, properties | ✓ | ✓ |
| Offline/local design state | Browser local storage | Native files/settings |
| Visual stitch texture | Approximation, not a machine file | Actual stitch planner |
| PES / DST / EXP / JEF / VP3 | — | ✓ |
| Brother Skitch PP1 Bluetooth control | — | ✓ (when configured) |
| Agent MCP bridge and CLI | — | ✓ |
| Comprehensive digitization features | — | ✓ |

**Compatibility note:** Browser Hooop is a newly added SVG design companion, not a WebAssembly port of the Rust embroidery engine. It **cannot** create production embroidery files or connect to a Bluetooth embroidery machine. SVG import in the web client intentionally supports a restricted set of primitive shapes and paths; complex transforms, groups, font outlines and other arbitrary SVG features are not preserved. The original native features remain in the desktop source.

## Quick start — browser

1. Open `/studio/` on desktop or mobile. No sign-in is required.
2. Draw an ellipse, rectangle, line, freehand path or text; tap or click any layer to edit.
3. Change color, stroke and position in Properties. Use **Stitch view** for a non-production visual texture.
4. Export **SVG** or **PNG**. Open the SVG in native Hooop for real machine output.

Use the Quick Start tour at `/guide/` in the deployed website. On mobile, use **Add to Home Screen / Install app** to create a full-screen PWA shortcut. Local autosave is device- and browser-specific; exporting your work is recommended.

## Native macOS build

Requires macOS, Rust **1.95 or newer**, Xcode Command Line Tools, and platform dependencies.

```bash
bash packaging/macos/make-app.sh --dmg
# Outputs dist/Hooop.app and dist/Hooop-<version>.dmg
```

For universal Apple Silicon + Intel:

```bash
bash packaging/macos/make-app.sh --universal --dmg
```

To distribute outside your own Mac without Gatekeeper warnings, configure your own Apple Developer ID and notarization credentials, then use `bash packaging/macos/make-app.sh --release`. Do not describe unsigned/self-signed packages as notarized.

## Native Windows build

Requires Rust 1.95+, the Windows MSVC build tools and a Windows host.

```powershell
cargo build --locked --release --features gui,ble --bin zigzag-studio --bin zigzag --bin zigzag-mcp
copy target\release\zigzag-studio.exe Hooop.exe
```

The Windows package uses the new Hooop icon and product metadata from `build.rs`. Original Rust CLI/MCP binary names remain unchanged to preserve integration compatibility. See `.github/workflows/hooop-desktop-build.yml` for hosted build artifacts. Microsoft SmartScreen may warn for unsigned builds.

## Run the web studio locally

The web workspace is dependency-free, static and deployable to Vercel.

```bash
cd web
python3 -m http.server 3000
# http://localhost:3000
# http://localhost:3000/studio/
# http://localhost:3000/guide/
```

To deploy on Vercel, import this GitHub repo and choose **Root Directory: `web`**. It uses static HTML/CSS/JS, a PWA manifest and service worker. No keys, databases, backend secrets or external services are needed for the web edition.

## Source architecture and safety

The original Rust code remains intact in `src/document`, `src/stitch`, `src/formats`, `src/machine`, `src/svg.rs`, `src/design.rs`, `src/route.rs`, and the CLI implementation. The native rebrand modifies only product-facing UI text, visual design tokens, icons, packaging metadata, and distribution links. Internal `zigzag` Rust crate, CLI commands, MCP protocol and environment variables intentionally remain compatible, avoiding changes to the original engine and integrations. See [BRAND.md](BRAND.md).

Desktop updates now target this Hooop repository. Auto-update requires a legitimately signed Hooop release and appropriate published assets; an empty release feed cannot supply updates.

## Licensing and attribution

This project is an adaptation of the Apache 2.0-licensed **ZigZag** embroidery studio. Original source attribution, copyright, `LICENSE`, `NOTICE`, and `THIRD-PARTY-NOTICES.md` are retained. Hooop is the new product-facing name; the rebrand does not imply original authorship of upstream code. Historical changelogs and notices are kept for provenance and legal compliance.

## Release status

**Web:** publishable static PWA. **Desktop:** source rebranded, build scripts and GitHub Actions included. A downloadable `.dmg` or `.exe` must be successfully built and uploaded to a Hooop release before announcing it as available. macOS notarization requires the owner's Apple signing credentials.
