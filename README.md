# rust_wallet_sdk Tester

Standalone interactive playground for the `rust_wallet_sdk` WASM bindings. No
Chrome extension or backend required.

## Quick start

```bash
npm install     # or: pnpm install / yarn
npm run dev     # opens http://localhost:5180
```

## Updating the SDK

The whole SDK lives under `./pkg/`. To test a new build, replace these five
files with the ones the SDK team ships:

```
pkg/rust_wallet_sdk.js
pkg/rust_wallet_sdk_bg.js
pkg/rust_wallet_sdk_bg.wasm
pkg/rust_wallet_sdk.d.ts
pkg/rust_wallet_sdk_bg.wasm.d.ts
```

No reinstall needed — Vite picks them up on the next request. Just refresh the
browser tab.

## What the app exercises

Two surfaces:

1. **`CryptoSDK` helpers** (`src/CryptoSDK.ts`) — thin wrappers around the
   raw `wallet_*` C-FFI exports. This is the surface the production app
   (Chrome extension) uses.
2. **Direct camelCase bindings** from `rust_wallet_sdk.js` — `encrypt`,
   `decrypt`, `utilEncryptString`, `signTxSecure`, etc. Useful for
   side-by-side comparison.

Each function gets a card with labelled inputs, a `Run` button, and a
pretty-printed output / error pane. Outputs can be copied and pasted into
other functions' inputs (e.g. take the `vault_json` from
`createWalletFromMnemonic` and feed it into `revealMnemonic`).

## Stack

- Vite 6 + React 19 + TypeScript
- `vite-plugin-wasm` and `vite-plugin-top-level-await` to load the WASM module
- No backend, no extension APIs, no env vars — fully self-contained
