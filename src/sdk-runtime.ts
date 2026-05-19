// Runtime SDK source loader.
//
// At startup we use the bundled pkg/ exactly like before. The header bar can
// swap in an uploaded build: we instantiate the uploaded .wasm against the
// uploaded bg.js (loaded via a blob URL), then point the proxies in
// CryptoSDK.ts / functions.ts at the new module. No persistence — reloading
// the page drops back to bundled.

import '../pkg/rust_wallet_sdk.js'; // side-effect: __wbg_set_wasm + __wbindgen_start on the bundled module
// rust_wallet_sdk_bg.js has no .d.ts (it's the wbindgen-generated internals);
// we only consume it as an opaque module namespace, so an untyped import is fine.
// @ts-expect-error -- no declaration file
import * as bundledBindings from '../pkg/rust_wallet_sdk_bg.js';
import * as bundledWasmRaw from '../pkg/rust_wallet_sdk_bg.wasm';

export type SdkBindings = Record<string, unknown>;
export type SdkWasm = Record<string, unknown> & { memory: WebAssembly.Memory };

export type SdkModule = {
  wasm: SdkWasm;
  bindings: SdkBindings;
};

export type SdkSource =
  | { origin: 'bundled'; loadedAt: Date }
  | {
      origin: 'uploaded';
      filenames: string[];
      wasmFilename: string;
      bgJsFilename: string;
      wasmSize: number;
      wasmHash: string;
      loadedAt: Date;
    };

const bundled: SdkModule = {
  wasm: bundledWasmRaw as unknown as SdkWasm,
  bindings: bundledBindings as unknown as SdkBindings,
};

let current: SdkModule = bundled;
let source: SdkSource = { origin: 'bundled', loadedAt: new Date() };
let activeBlobUrl: string | null = null;

const listeners = new Set<() => void>();

export const getCurrent = (): SdkModule => current;
export const getSource = (): SdkSource => source;

export const subscribe = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

const notify = () => {
  for (const l of listeners) l();
};

const sha256Short = async (bytes: ArrayBuffer): Promise<string> => {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash).slice(0, 8))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
};

const findFile = (files: File[], predicate: (f: File) => boolean, label: string): File => {
  const matches = files.filter(predicate);
  if (matches.length === 0) throw new Error(`upload missing ${label}`);
  if (matches.length > 1) {
    throw new Error(
      `upload contains ${matches.length} files matching ${label} — pick a single pkg/ folder, not nested copies`,
    );
  }
  return matches[0];
};

const buildImportsForWasm = async (
  wasmModule: WebAssembly.Module,
  bindings: Record<string, unknown>,
): Promise<WebAssembly.Imports> => {
  const imports: WebAssembly.Imports = {};
  const missing: string[] = [];
  for (const { module, name } of WebAssembly.Module.imports(wasmModule)) {
    const bucket = (imports[module] ??= {}) as Record<string, unknown>;
    const direct = bindings[name];
    const prefixed = bindings[`__wbg_${name}`];
    const fn = typeof direct === 'function' ? direct : typeof prefixed === 'function' ? prefixed : undefined;
    if (!fn) {
      missing.push(`${module}.${name}`);
      continue;
    }
    bucket[name] = fn;
  }
  if (missing.length > 0) {
    throw new Error(
      `uploaded bg.js does not export wbg imports the .wasm requires: ${missing.slice(0, 6).join(', ')}${
        missing.length > 6 ? ` …(+${missing.length - 6} more)` : ''
      }`,
    );
  }
  return imports;
};

export const loadFromFiles = async (rawFiles: File[]): Promise<void> => {
  const files = rawFiles.filter(f => /\.(wasm|js)$/.test(f.name));
  if (files.length === 0) throw new Error('no .wasm or .js files in upload');

  const wasmFile = findFile(files, f => f.name.endsWith('.wasm'), 'a .wasm file');
  const bgJsFile = findFile(
    files,
    f => /(^|\/)rust_wallet_sdk_bg\.js$/.test(f.name) || f.name === 'rust_wallet_sdk_bg.js',
    'rust_wallet_sdk_bg.js',
  );

  const [wasmBytes, bgJsText] = await Promise.all([wasmFile.arrayBuffer(), bgJsFile.text()]);

  const blob = new Blob([bgJsText], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);
  let bindings: Record<string, unknown>;
  try {
    bindings = (await import(/* @vite-ignore */ url)) as Record<string, unknown>;
  } catch (err) {
    URL.revokeObjectURL(url);
    throw new Error(
      `failed to evaluate uploaded rust_wallet_sdk_bg.js as an ES module: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  if (typeof bindings.__wbg_set_wasm !== 'function') {
    URL.revokeObjectURL(url);
    throw new Error('uploaded rust_wallet_sdk_bg.js does not export __wbg_set_wasm — is this a wbindgen build?');
  }

  let wasmModule: WebAssembly.Module;
  try {
    wasmModule = await WebAssembly.compile(wasmBytes);
  } catch (err) {
    URL.revokeObjectURL(url);
    throw new Error(`failed to compile uploaded .wasm: ${err instanceof Error ? err.message : String(err)}`);
  }

  const imports = await buildImportsForWasm(wasmModule, bindings);

  let instance: WebAssembly.Instance;
  try {
    instance = await WebAssembly.instantiate(wasmModule, imports);
  } catch (err) {
    URL.revokeObjectURL(url);
    throw new Error(
      `failed to instantiate uploaded .wasm against the uploaded bg.js: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  (bindings.__wbg_set_wasm as (v: unknown) => void)(instance.exports);
  const start = (instance.exports as Record<string, unknown>).__wbindgen_start;
  if (typeof start === 'function') {
    try {
      (start as () => void)();
    } catch (err) {
      URL.revokeObjectURL(url);
      throw new Error(
        `__wbindgen_start panicked on uploaded build: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl);
  activeBlobUrl = url;

  current = {
    wasm: instance.exports as unknown as SdkWasm,
    bindings,
  };
  source = {
    origin: 'uploaded',
    filenames: files.map(f => f.name),
    wasmFilename: wasmFile.name,
    bgJsFilename: bgJsFile.name,
    wasmSize: wasmBytes.byteLength,
    wasmHash: await sha256Short(wasmBytes),
    loadedAt: new Date(),
  };
  notify();
};

export const resetToBundled = (): void => {
  if (source.origin === 'bundled') return;
  if (activeBlobUrl) {
    URL.revokeObjectURL(activeBlobUrl);
    activeBlobUrl = null;
  }
  current = bundled;
  source = { origin: 'bundled', loadedAt: new Date() };
  notify();
};

// React hook helpers — usable with React 18+ useSyncExternalStore.
export const subscribeSource = (cb: () => void) => subscribe(cb);
export const getSourceSnapshot = () => source;
