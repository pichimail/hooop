# Hooop visual identity

Brand: **Hooop** (three consecutive o’s), a minimal embroidery studio.
Swiss/editorial presentation, compact typography, quiet separators, charcoal + ivory, muted blue-grey accents.

**Preservation guard:** Original Rust core (`src/document`, `src/stitch`, `src/formats`, `src/machine`, `src/svg.rs`, `src/design.rs`, `src/route.rs`, and CLI) is unchanged. Native `zigzag` crate/binary identifiers remain for compatibility. The Hooop branding applies to desktop product-facing UI, bundles and download names; provenance and license notices remain untouched.

Native updater release endpoint is now `pichimail/hooop`. It requires Hooop releases and Apple signing/notarization before production use.

The web client in `web/` is a standalone, responsive SVG editing PWA. It does **not** run the Rust stitch planner in the browser. Use the desktop studio for machine-grade stitch exports, Bluetooth, and full native functionality.
