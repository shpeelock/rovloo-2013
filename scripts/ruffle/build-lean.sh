#!/usr/bin/env bash
# Build a lean Ruffle for the Christmas nav banner, pinned to an upstream tag.
#
#   bash scripts/ruffle/build-lean.sh [nightly-YYYY-MM-DD]
#
# This is a BUILD RECIPE, not a fork: we compile stock upstream Ruffle with a reduced feature set
# and an aggressive release profile, so upgrading is a tag bump rather than a rebase.
#
# ---------------------------------------------------------------------------------------------
# WHY THESE FLAGS (all verified against the pinned tag's manifests, not assumed)
#
# web/Cargo.toml default = ["canvas","console_error_panic_hook","webgl","wgpu-webgl","webgpu"]
#   -> the stock bundle compiles THREE renderer backends. wgpu (webgpu + wgpu-webgl) drags in the
#      whole WebGPU/naga shader-translation stack and is by far the largest single component we
#      can remove with a flag. Our banner is a 1840x36 strip of shapes and JPEGs, so the canvas
#      backend alone renders it; webgl is kept as a cheap, much smaller accelerated path.
#   -> console_error_panic_hook LOOKS droppable (it is a debugging aid) but MUST be kept: at this
#      tag web/src/lib.rs:1344 calls console_error_panic_hook::hook(info) with no #[cfg] guard, so
#      building without the feature fails to compile. It is a tiny crate; the real win is wgpu.
#
# core/Cargo.toml default = []  -> audio (audio/mp3/aac/nellymoser), jpegxr, lzma, default_font,
#   egui and known_stubs are already OPT-IN and therefore already absent. Nothing to strip there.
#   This matches the SWFs: `python` tag scan of both banners found 0 audio, 0 video, 0 fonts.
#
# The web build does NOT use [profile.release]: build_wasm.ts runs
#   cargo build --locked --target wasm32-unknown-unknown --profile web-wasm-extensions ...
# and the root Cargo.toml declares [profile.web-wasm-extensions] as `inherits = "release"` with
# NOTHING else — so upstream applies no size optimisation whatsoever. We set opt-level="z", fat
# LTO, codegen-units=1 and symbol stripping on that profile via CARGO_PROFILE_WEB_WASM_EXTENSIONS_*
# env vars (no source edits, so the checkout stays pristine).
#
# NOT POSSIBLE WITH FLAGS: dropping AVM2 (ActionScript 3). It is not feature-gated anywhere in
#   Ruffle's manifests (verified: zero `avm2` features in core/ or web/ Cargo.toml), even though
#   both our SWFs are AVM1-only (0 DoABC tags). Removing it means patching source = a real fork
#   with per-upgrade rebase cost. Deliberately out of scope here; revisit only if the flag-level
#   build is not lean enough.
# ---------------------------------------------------------------------------------------------
set -euo pipefail

TAG="${1:-nightly-2026-01-12}"          # matches the currently vendored 0.2.0-nightly.2026.1.12
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK="${RUFFLE_BUILD_DIR:-$HOME/.cache/ruffle-lean}"
FEATURES="canvas,webgl,console_error_panic_hook"

echo "==> Ruffle lean build   tag=$TAG   features=$FEATURES"

command -v cargo >/dev/null || { echo "cargo not found — install Rust (rustup.rs)"; exit 1; }
# Ruffle builds for wasm32-unknown-unknown; without the target's std/core the whole dep graph
# fails with "can't find crate for `core`". Idempotent.
echo "==> ensuring wasm32-unknown-unknown target"
rustup target add wasm32-unknown-unknown
command -v wasm-pack >/dev/null || { echo "==> installing wasm-pack"; cargo install wasm-pack; }
if ! command -v wasm-opt >/dev/null; then
  echo "==> wasm-opt not found; installing binaryen via npm (local)"
  npm i -g binaryen || echo "    (npm install failed — wasm-opt pass will be skipped)"
fi

mkdir -p "$WORK"
if [ ! -d "$WORK/ruffle/.git" ]; then
  echo "==> cloning ruffle @ $TAG (shallow)"
  git clone --depth 1 --branch "$TAG" https://github.com/ruffle-rs/ruffle.git "$WORK/ruffle"
else
  echo "==> reusing clone; checking out $TAG"
  git -C "$WORK/ruffle" fetch --depth 1 origin tag "$TAG" --no-tags || true
  git -C "$WORK/ruffle" checkout -f "$TAG"
fi

# Ruffle's build invokes the `wasm-bindgen` CLI directly. Its version MUST match the wasm-bindgen
# crate version pinned in Cargo.lock or it refuses to run, so derive it rather than hardcoding.
WB_VER="$(grep -A1 '^name = "wasm-bindgen"$' "$WORK/ruffle/Cargo.lock" | grep '^version' | head -1 | cut -d'"' -f2)"
echo "==> wasm-bindgen CLI required at $WB_VER"
if ! command -v wasm-bindgen >/dev/null || [ "$(wasm-bindgen --version 2>/dev/null | awk '{print $2}')" != "$WB_VER" ]; then
  echo "==> installing wasm-bindgen-cli $WB_VER"
  cargo install wasm-bindgen-cli --version "$WB_VER" --locked
fi

cd "$WORK/ruffle/web"

echo "==> npm ci"
npm ci

# Build ONLY core + selfhosted. Upstream's `npm run build` also builds the demo and browser
# extension, which we do not ship.
#
# Env contract verified in web/packages/core/tools/build_wasm.ts at this tag:
#   CARGO_FEATURES  -> appended to `--features`
#   CARGO_FLAGS     -> extra cargo args
#   BUILD_WASM_MVP  -> opt-in second (vanilla) wasm; we leave it UNSET, so this build emits a
#                      single extensions-only wasm and the dual-build bloat never exists.
#   wasm-opt is run automatically when present.
echo "==> building core (wasm) — this is the long part"
CARGO_FEATURES="$FEATURES" CARGO_FLAGS="--no-default-features" CARGO_PROFILE_WEB_WASM_EXTENSIONS_OPT_LEVEL="z" CARGO_PROFILE_WEB_WASM_EXTENSIONS_LTO="fat" CARGO_PROFILE_WEB_WASM_EXTENSIONS_CODEGEN_UNITS="1" CARGO_PROFILE_WEB_WASM_EXTENSIONS_STRIP="symbols" CARGO_PROFILE_WEB_WASM_EXTENSIONS_PANIC="abort" npm run build --workspace=ruffle-core

echo "==> building selfhosted bundle"
npm run build --workspace=ruffle-selfhosted

DIST="$WORK/ruffle/web/packages/selfhosted/dist"

# Explicit size pass. Ruffle invokes wasm-opt itself when it is on PATH, but we run our own so the
# flags are guaranteed: -all enables every wasm feature during validation, without which binaryen
# rejects the module outright ("Fatal: error validating input") because wasm-bindgen emits
# reference-types. Measured on this build: 6.01 MB -> 5.32 MB.
if command -v wasm-opt >/dev/null; then
  for w in "$DIST"/*.wasm; do
    [ -f "$w" ] || continue
    echo "==> wasm-opt -Oz $(basename "$w")"
    if wasm-opt -Oz -all --strip-debug --strip-producers "$w" -o "$w.opt" && [ -s "$w.opt" ]; then
      mv "$w.opt" "$w"
    else
      rm -f "$w.opt"; echo "    (wasm-opt failed; keeping unoptimised module)"
    fi
  done
fi
echo
echo "==> built artifacts ($DIST):"
ls -la "$DIST"
echo
echo "==> currently vendored:"
ls -la "$HERE"/*.wasm "$HERE"/ruffle.js 2>/dev/null
echo
echo "To install:  cp -r \"$DIST\"/* \"$HERE\"/ && node \"$HERE/prune-for-electron.mjs\""
echo "Then hard-reload the app and confirm the Christmas banner still plays."
