// App-level wrapper over the SDK's raw `wallet_*` C-FFI exports.
//
// The SDK ships two surfaces in ../pkg/:
//   1. `rust_wallet_sdk_bg.js` — camelCase wbindgen JS bindings (ptr+len ABI,
//      throws on error).
//   2. `rust_wallet_sdk_bg.wasm` — raw exports with the `wallet_*` names that
//      take null-terminated C-strings (single pointer per string) and return
//      a single pointer to a JSON envelope.
//
// This file wraps (2) for the iOS/Android-parity FFI naming. Param order for
// methods marked INFERRED is guessed from the C-FFI arity and analogous
// wrappers — verify against the SDK reference before relying on them.

import '../pkg/rust_wallet_sdk.js';
// vite-plugin-wasm resolves the runtime; TS picks up the type surface from
// rust_wallet_sdk_bg.wasm.d.ts that lives alongside the .wasm file. We
// re-cast to a minimal interface so we don't have to enumerate every
// wallet_* export name here.
import * as wasmRaw from '../pkg/rust_wallet_sdk_bg.wasm';

type FFIFn = (...args: (number | bigint)[]) => number;

type WasmExports = {
  memory: WebAssembly.Memory;
  __wbindgen_malloc: (size: number, align: number) => number;
  __wbindgen_realloc: (ptr: number, oldSize: number, newSize: number, align: number) => number;
  __wbindgen_free: (ptr: number, size: number, align: number) => void;
  wallet_free_string: (ptr: number) => void;
  wallet_free_global_session: () => void;
  [k: string]: unknown;
};

const wasm = wasmRaw as unknown as WasmExports;

const ffi = (name: string): FFIFn => {
  const fn = wasm[name];
  if (typeof fn !== 'function') {
    throw new Error(`wasm export "${name}" is missing — does the current pkg/ build expose it?`);
  }
  return fn as FFIFn;
};

type CString = { ptr: number; len: number };

const NULL_CSTRING: CString = { ptr: 0, len: 0 };
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

const memoryBytes = (): Uint8Array => new Uint8Array(wasm.memory.buffer);

const nonEmpty = (value: string | null | undefined): value is string => typeof value === 'string' && value.length > 0;

const passCString = (value: string | null | undefined): CString => {
  if (value === null || value === undefined) return NULL_CSTRING;
  const encoded = encoder.encode(value);
  const totalLen = encoded.byteLength + 1;
  const ptr = wasm.__wbindgen_malloc(totalLen, 1) >>> 0;
  const mem = memoryBytes();
  mem.set(encoded, ptr);
  mem[ptr + encoded.byteLength] = 0;
  return { ptr, len: totalLen };
};

const freeCString = (cstr: CString): void => {
  if (cstr.ptr === 0) return;
  wasm.__wbindgen_free(cstr.ptr, cstr.len, 1);
};

const consumeCString = (label: string, ptr: number): string => {
  if (ptr === 0) {
    throw new Error(`${label}: wasm returned null pointer`);
  }
  const mem = memoryBytes();
  let end = ptr;
  while (mem[end] !== 0) end++;
  const result = decoder.decode(mem.subarray(ptr, end));
  wasm.wallet_free_string(ptr);
  return result;
};

export const CryptoSDK = {
  // ---------------------------------------------------------------------------
  // No-arg helpers
  // ---------------------------------------------------------------------------
  generateMnemonic(): string {
    return consumeCString('wallet_generate_mnemonic', ffi('wallet_generate_mnemonic')());
  },

  freeGlobalSession(): void {
    wasm.wallet_free_global_session();
  },

  // ---------------------------------------------------------------------------
  // Single-string helpers
  // ---------------------------------------------------------------------------
  verifyMnemonic(mnemonic: string): string {
    const m = passCString(mnemonic);
    try {
      return consumeCString('wallet_verify_mnemonic', ffi('wallet_verify_mnemonic')(m.ptr));
    } finally {
      freeCString(m);
    }
  },

  hashTypedDataV4(typedDataJson: string): string {
    const d = passCString(typedDataJson);
    try {
      return consumeCString('wallet_hash_typed_data_v4', ffi('wallet_hash_typed_data_v4')(d.ptr));
    } finally {
      freeCString(d);
    }
  },

  migrateVaultAddresses(vaultJson: string): string {
    const v = passCString(vaultJson);
    try {
      return consumeCString('wallet_migrate_vault_addresses', ffi('wallet_migrate_vault_addresses')(v.ptr));
    } finally {
      freeCString(v);
    }
  },

  // ---------------------------------------------------------------------------
  // Verify family
  // ---------------------------------------------------------------------------
  verifyAddress(args: { chain: string; address: string }): string {
    const c = passCString(args.chain);
    const a = passCString(args.address);
    try {
      return consumeCString('wallet_verify_address', ffi('wallet_verify_address')(c.ptr, a.ptr));
    } finally {
      freeCString(c);
      freeCString(a);
    }
  },

  // INFERRED param order — (chain, privateKey).
  verifyPrivateKey(args: { chain: string; privateKey: string }): string {
    const c = passCString(args.chain);
    const p = passCString(args.privateKey);
    try {
      return consumeCString('wallet_verify_private_key', ffi('wallet_verify_private_key')(c.ptr, p.ptr));
    } finally {
      freeCString(c);
      freeCString(p);
    }
  },

  verifyAuth(args: { vaultJson: string; authInput: string; authType: string }): string {
    const v = passCString(args.vaultJson);
    const i = passCString(args.authInput);
    const t = passCString(args.authType);
    try {
      return consumeCString('wallet_verify_auth', ffi('wallet_verify_auth')(v.ptr, i.ptr, t.ptr));
    } finally {
      freeCString(v);
      freeCString(i);
      freeCString(t);
    }
  },

  // ---------------------------------------------------------------------------
  // Reveal family (unified password/biometric via auth_type)
  // ---------------------------------------------------------------------------
  revealMnemonic(args: { vaultJson: string; authInput: string; authType: string }): string {
    const v = passCString(args.vaultJson);
    const i = passCString(args.authInput);
    const t = passCString(args.authType);
    try {
      return consumeCString('wallet_reveal_mnemonic', ffi('wallet_reveal_mnemonic')(v.ptr, i.ptr, t.ptr));
    } finally {
      freeCString(v);
      freeCString(i);
      freeCString(t);
    }
  },

  revealPrivateKey(args: { vaultJson: string; authInput: string; authType: string }): string {
    const v = passCString(args.vaultJson);
    const i = passCString(args.authInput);
    const t = passCString(args.authType);
    try {
      return consumeCString('wallet_reveal_private_key', ffi('wallet_reveal_private_key')(v.ptr, i.ptr, t.ptr));
    } finally {
      freeCString(v);
      freeCString(i);
      freeCString(t);
    }
  },

  // ---------------------------------------------------------------------------
  // Vault lifecycle
  // ---------------------------------------------------------------------------
  createWalletFromMnemonic(args: {
    mnemonic: string;
    password: string;
    biometricKey?: string | null;
    biometricId?: string | null;
    biometricLabel?: string | null;
  }): string {
    const { mnemonic, password, biometricKey, biometricId, biometricLabel } = args;
    const includeBio = nonEmpty(biometricKey) && nonEmpty(biometricId) && nonEmpty(biometricLabel);
    const m = passCString(mnemonic);
    const p = passCString(password);
    const bk = passCString(includeBio ? biometricKey : null);
    const bi = passCString(includeBio ? biometricId : null);
    const bl = passCString(includeBio ? biometricLabel : null);
    try {
      return consumeCString(
        'wallet_create_wallet_from_mnemonic',
        ffi('wallet_create_wallet_from_mnemonic')(m.ptr, 0, bk.ptr, bi.ptr, bl.ptr, p.ptr),
      );
    } finally {
      freeCString(m);
      freeCString(p);
      freeCString(bk);
      freeCString(bi);
      freeCString(bl);
    }
  },

  // INFERRED — mirrors wallet_create_wallet_from_mnemonic with chain as a
  // string ("eth" | "tron" | "btc") in slot b. Passing a numeric chain id
  // here causes the SDK to read the integer as a pointer and report
  // "Unsupported chain: <garbage>".
  createVaultFromPrivateKey(args: {
    chain: string;
    privateKey: string;
    password: string;
    biometricKey?: string | null;
    biometricId?: string | null;
    biometricLabel?: string | null;
  }): string {
    const { chain, privateKey, password, biometricKey, biometricId, biometricLabel } = args;
    const includeBio = nonEmpty(biometricKey) && nonEmpty(biometricId) && nonEmpty(biometricLabel);
    const pk = passCString(privateKey);
    const c = passCString(chain);
    const p = passCString(password);
    const bk = passCString(includeBio ? biometricKey : null);
    const bi = passCString(includeBio ? biometricId : null);
    const bl = passCString(includeBio ? biometricLabel : null);
    try {
      return consumeCString(
        'wallet_create_vault_from_private_key',
        ffi('wallet_create_vault_from_private_key')(pk.ptr, c.ptr, bk.ptr, bi.ptr, bl.ptr, p.ptr),
      );
    } finally {
      freeCString(pk);
      freeCString(c);
      freeCString(p);
      freeCString(bk);
      freeCString(bi);
      freeCString(bl);
    }
  },

  // INFERRED — 3 args, app-keystore session variant.
  createVaultFromPrivateKeyWithSession(args: {
    appKeystoreJson: string;
    password: string;
    privateKey: string;
  }): string {
    const a = passCString(args.appKeystoreJson);
    const p = passCString(args.password);
    const pk = passCString(args.privateKey);
    try {
      return consumeCString(
        'wallet_create_vault_from_private_key_with_session',
        ffi('wallet_create_vault_from_private_key_with_session')(a.ptr, p.ptr, pk.ptr),
      );
    } finally {
      freeCString(a);
      freeCString(p);
      freeCString(pk);
    }
  },

  // INFERRED — 2 args, session add-vault helper.
  addVaultWithSession(args: { vaultJson: string; appKeystoreJson: string }): string {
    const v = passCString(args.vaultJson);
    const a = passCString(args.appKeystoreJson);
    try {
      return consumeCString('wallet_add_vault_with_session', ffi('wallet_add_vault_with_session')(v.ptr, a.ptr));
    } finally {
      freeCString(v);
      freeCString(a);
    }
  },

  changeVaultPassword(args: { vaultJson: string; oldPassword: string; newPassword: string }): string {
    const v = passCString(args.vaultJson);
    const o = passCString(args.oldPassword);
    const n = passCString(args.newPassword);
    try {
      return consumeCString(
        'wallet_change_vault_password',
        ffi('wallet_change_vault_password')(v.ptr, o.ptr, n.ptr),
      );
    } finally {
      freeCString(v);
      freeCString(o);
      freeCString(n);
    }
  },

  // INFERRED — first arg legacy envelope JSON, biometric tail mirrors create.
  migrateLegacyVault(args: {
    legacyEnvelope: string;
    password: string;
    biometricKey?: string | null;
    biometricId?: string | null;
    biometricLabel?: string | null;
    extraField?: string | null;
  }): string {
    const { legacyEnvelope, password, biometricKey, biometricId, biometricLabel, extraField } = args;
    const e = passCString(legacyEnvelope);
    const p = passCString(password);
    const bk = passCString(biometricKey ?? null);
    const bi = passCString(biometricId ?? null);
    const bl = passCString(biometricLabel ?? null);
    const ex = passCString(extraField ?? null);
    try {
      return consumeCString(
        'wallet_migrate_legacy_vault',
        ffi('wallet_migrate_legacy_vault')(e.ptr, p.ptr, bk.ptr, bi.ptr, bl.ptr, ex.ptr),
      );
    } finally {
      freeCString(e);
      freeCString(p);
      freeCString(bk);
      freeCString(bi);
      freeCString(bl);
      freeCString(ex);
    }
  },

  // ---------------------------------------------------------------------------
  // Biometric access
  // ---------------------------------------------------------------------------
  addBiometricAccessToVaultWithGlobalSession(args: {
    vaultJson: string;
    encKekApp: string;
    bioId: string;
    bioLabel: string;
  }): string {
    const v = passCString(args.vaultJson);
    const k = passCString(args.encKekApp);
    const bi = passCString(args.bioId);
    const bl = passCString(args.bioLabel);
    try {
      return consumeCString(
        'wallet_add_biometric_access_to_vault_with_global_session',
        ffi('wallet_add_biometric_access_to_vault_with_global_session')(v.ptr, k.ptr, bi.ptr, bl.ptr),
      );
    } finally {
      freeCString(v);
      freeCString(k);
      freeCString(bi);
      freeCString(bl);
    }
  },

  // ---------------------------------------------------------------------------
  // Address derivation
  // ---------------------------------------------------------------------------
  generateAddressFromXpub(args: {
    xpubEth: string;
    xpubTron: string;
    xpubBtc: string;
    mnemonic?: string | null;
    index: number;
    chainId?: bigint;
  }): string {
    const { xpubEth, xpubTron, xpubBtc, mnemonic = null, index, chainId = 0n } = args;
    const e = passCString(xpubEth);
    const t = passCString(xpubTron);
    const b = passCString(xpubBtc);
    const m = passCString(mnemonic);
    try {
      const fn = ffi('wallet_generate_address_from_xpub') as (
        a: number,
        b: number,
        c: number,
        d: number,
        e: number,
        f: bigint,
      ) => number;
      return consumeCString('wallet_generate_address_from_xpub', fn(e.ptr, t.ptr, b.ptr, m.ptr, index, chainId));
    } finally {
      freeCString(e);
      freeCString(t);
      freeCString(b);
      freeCString(m);
    }
  },

  // INFERRED — pairs (startIndex, count) follow the mnemonic per the
  // bulk-derive pattern; last arg is chainId (bigint).
  generateAddressesFromXpubBulk(args: {
    xpubEth: string;
    xpubTron: string;
    xpubBtc: string;
    mnemonic?: string | null;
    startIndex: number;
    count: number;
    chainId?: bigint;
  }): string {
    const { xpubEth, xpubTron, xpubBtc, mnemonic = null, startIndex, count, chainId = 0n } = args;
    const e = passCString(xpubEth);
    const t = passCString(xpubTron);
    const b = passCString(xpubBtc);
    const m = passCString(mnemonic);
    try {
      const fn = ffi('wallet_generate_addresses_from_xpub_bulk') as (
        a: number,
        b: number,
        c: number,
        d: number,
        e: number,
        f: number,
        g: bigint,
      ) => number;
      return consumeCString(
        'wallet_generate_addresses_from_xpub_bulk',
        fn(e.ptr, t.ptr, b.ptr, m.ptr, startIndex, count, chainId),
      );
    } finally {
      freeCString(e);
      freeCString(t);
      freeCString(b);
      freeCString(m);
    }
  },

  // ---------------------------------------------------------------------------
  // Secure signing
  // ---------------------------------------------------------------------------
  signTxSecure(args: {
    chain: string;
    txData: string;
    vaultJson: string;
    authInput: string;
    authType: string;
    indexN: number;
    txFields?: string | null;
  }): string {
    const { chain, txData, vaultJson, authInput, authType, indexN, txFields = null } = args;
    const c = passCString(chain);
    const td = passCString(txData);
    const v = passCString(vaultJson);
    const ai = passCString(authInput);
    const at = passCString(authType);
    const tf = passCString(txFields);
    try {
      return consumeCString(
        'wallet_sign_tx_secure',
        ffi('wallet_sign_tx_secure')(c.ptr, td.ptr, v.ptr, ai.ptr, at.ptr, indexN, tf.ptr),
      );
    } finally {
      freeCString(c);
      freeCString(td);
      freeCString(v);
      freeCString(ai);
      freeCString(at);
      freeCString(tf);
    }
  },

  signMessageSecure(args: {
    chain: string;
    msgData: string;
    msgType: string;
    vaultJson: string;
    authInput: string;
    authType: string;
    indexN: number;
  }): string {
    const { chain, msgData, msgType, vaultJson, authInput, authType, indexN } = args;
    const c = passCString(chain);
    const md = passCString(msgData);
    const mt = passCString(msgType);
    const v = passCString(vaultJson);
    const ai = passCString(authInput);
    const at = passCString(authType);
    try {
      return consumeCString(
        'wallet_sign_message_secure',
        ffi('wallet_sign_message_secure')(c.ptr, md.ptr, mt.ptr, v.ptr, ai.ptr, at.ptr, indexN),
      );
    } finally {
      freeCString(c);
      freeCString(md);
      freeCString(mt);
      freeCString(v);
      freeCString(ai);
      freeCString(at);
    }
  },
};

export type CryptoSDKType = typeof CryptoSDK;
