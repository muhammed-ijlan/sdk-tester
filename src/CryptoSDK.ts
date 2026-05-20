// App-level wrapper over the SDK's raw `wallet_*` C-FFI exports.
// This is the same surface the production wallet (Chrome extension) uses,
// so panic-hook output matches what you'd see in the wallet.

// We delegate to sdk-runtime so the header bar can swap in an uploaded build
// at runtime. Reads always go through the proxy → getCurrent().wasm, so
// existing call-sites (`wasm.foo(...)`, `wasm.memory.buffer`) keep working.
import { getCurrent } from './sdk-runtime';

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

const wasm = new Proxy({} as WasmExports, {
  get(_target, prop) {
    return (getCurrent().wasm as unknown as Record<string | symbol, unknown>)[prop];
  },
}) as WasmExports;

const ffi = (name: string): FFIFn => {
  const fn = wasm[name];
  if (typeof fn !== 'function') {
    throw new Error(`wasm export "${name}" is missing — does the current pkg/ build expose it?`);
  }
  return fn as FFIFn;
};

export type WasmCallArg = {
  slot: string;
  value: number | string;
  hex?: string;
};

// Raised when a wasm export throws. Captures function name, slot-labelled
// args, and whether the underlying cause was a WASM `unreachable` trap
// (which is what JS sees for *every* uncaught Rust panic, since this
// pkg/ build doesn't install console_error_panic_hook).
export class WasmCallError extends Error {
  readonly wasmName: string;
  readonly args: WasmCallArg[];
  readonly rawCause: unknown;
  readonly causeMessage: string;
  readonly causeStack?: string;
  readonly isUnreachable: boolean;

  constructor(
    wasmName: string,
    rawArgs: Array<number | bigint>,
    argLabels: string[] | undefined,
    cause: unknown,
  ) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    const isUnreachable = /unreachable/i.test(causeMessage);
    const args: WasmCallArg[] = rawArgs.map((v, i) => ({
      slot: argLabels?.[i] ?? String.fromCharCode(97 + i),
      value: typeof v === 'bigint' ? v.toString() : v,
      hex: typeof v === 'number' ? '0x' + (v >>> 0).toString(16) : undefined,
    }));
    const header = isUnreachable
      ? `${wasmName} → WASM unreachable trap (Rust panicked — pkg/ has no panic_hook so the Rust message is lost)`
      : `${wasmName} threw: ${causeMessage}`;
    super(header);
    this.name = 'WasmCallError';
    this.wasmName = wasmName;
    this.args = args;
    this.rawCause = cause;
    this.causeMessage = causeMessage;
    this.causeStack = cause instanceof Error ? cause.stack : undefined;
    this.isUnreachable = isUnreachable;
  }
}

const callFfi = (
  name: string,
  args: Array<number | bigint>,
  argLabels?: string[],
): number => {
  try {
    return ffi(name)(...args);
  } catch (cause) {
    const err = new WasmCallError(name, args, argLabels, cause);
    // Rich console diagnostic — grouped so it's collapsible.
    const style = err.isUnreachable
      ? 'color:#ff5252; font-weight:bold'
      : 'color:#ffa726; font-weight:bold';
    console.groupCollapsed(`%c[wasm] ${name} threw${err.isUnreachable ? ' — unreachable' : ''}`, style);
    console.error('cause:', cause);
    if (err.causeStack) console.log('stack:', err.causeStack);
    console.table(err.args);
    console.groupEnd();
    throw err;
  }
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
    return consumeCString('wallet_generate_mnemonic', callFfi('wallet_generate_mnemonic', []));
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
      return consumeCString(
        'wallet_verify_mnemonic',
        callFfi('wallet_verify_mnemonic', [m.ptr], ['mnemonic']),
      );
    } finally {
      freeCString(m);
    }
  },

  hashTypedDataV4(typedDataJson: string): string {
    const d = passCString(typedDataJson);
    try {
      return consumeCString(
        'wallet_hash_typed_data_v4',
        callFfi('wallet_hash_typed_data_v4', [d.ptr], ['typedDataJson']),
      );
    } finally {
      freeCString(d);
    }
  },

  migrateVaultAddresses(vaultJson: string): string {
    const v = passCString(vaultJson);
    try {
      return consumeCString(
        'wallet_migrate_vault_addresses',
        callFfi('wallet_migrate_vault_addresses', [v.ptr], ['vaultJson']),
      );
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
      return consumeCString(
        'wallet_verify_address',
        callFfi('wallet_verify_address', [c.ptr, a.ptr], ['chain', 'address']),
      );
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
      return consumeCString(
        'wallet_verify_private_key',
        callFfi('wallet_verify_private_key', [c.ptr, p.ptr], ['chain', 'privateKey']),
      );
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
      return consumeCString(
        'wallet_verify_auth',
        callFfi('wallet_verify_auth', [v.ptr, i.ptr, t.ptr], ['vaultJson', 'authInput', 'authType']),
      );
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
      return consumeCString(
        'wallet_reveal_mnemonic',
        callFfi('wallet_reveal_mnemonic', [v.ptr, i.ptr, t.ptr], ['vaultJson', 'authInput', 'authType']),
      );
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
      return consumeCString(
        'wallet_reveal_private_key',
        callFfi('wallet_reveal_private_key', [v.ptr, i.ptr, t.ptr], ['vaultJson', 'authInput', 'authType']),
      );
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
        callFfi(
          'wallet_create_wallet_from_mnemonic',
          [m.ptr, p.ptr, bk.ptr, bi.ptr, bl.ptr, 0],
          ['mnemonic', 'password', 'biometricKey', 'biometricId', 'biometricLabel', 'reserved'],
        ),
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
        callFfi(
          'wallet_create_vault_from_private_key',
          [pk.ptr, c.ptr, bk.ptr, bi.ptr, bl.ptr, p.ptr],
          ['privateKey', 'chain', 'biometricKey', 'biometricId', 'biometricLabel', 'password'],
        ),
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
        callFfi(
          'wallet_create_vault_from_private_key_with_session',
          [a.ptr, p.ptr, pk.ptr],
          ['appKeystoreJson', 'password', 'privateKey'],
        ),
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
      return consumeCString(
        'wallet_add_vault_with_session',
        callFfi('wallet_add_vault_with_session', [v.ptr, a.ptr], ['vaultJson', 'appKeystoreJson']),
      );
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
        callFfi(
          'wallet_change_vault_password',
          [v.ptr, o.ptr, n.ptr],
          ['vaultJson', 'oldPassword', 'newPassword'],
        ),
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
        callFfi(
          'wallet_migrate_legacy_vault',
          [e.ptr, p.ptr, bk.ptr, bi.ptr, bl.ptr, ex.ptr],
          ['legacyEnvelope', 'password', 'biometricKey', 'biometricId', 'biometricLabel', 'extraField'],
        ),
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
        callFfi(
          'wallet_add_biometric_access_to_vault_with_global_session',
          [v.ptr, k.ptr, bi.ptr, bl.ptr],
          ['vaultJson', 'encKekApp', 'bioId', 'bioLabel'],
        ),
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
      return consumeCString(
        'wallet_generate_address_from_xpub',
        callFfi(
          'wallet_generate_address_from_xpub',
          [e.ptr, t.ptr, b.ptr, m.ptr, index, chainId],
          ['xpubEth', 'xpubTron', 'xpubBtc', 'mnemonic', 'index', 'chainId'],
        ),
      );
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
      return consumeCString(
        'wallet_generate_addresses_from_xpub_bulk',
        callFfi(
          'wallet_generate_addresses_from_xpub_bulk',
          [e.ptr, t.ptr, b.ptr, m.ptr, startIndex, count, chainId],
          ['xpubEth', 'xpubTron', 'xpubBtc', 'mnemonic', 'startIndex', 'count', 'chainId'],
        ),
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
        callFfi(
          'wallet_sign_tx_secure',
          [c.ptr, td.ptr, v.ptr, ai.ptr, at.ptr, indexN, tf.ptr],
          ['chain', 'txData', 'vaultJson', 'authInput', 'authType', 'indexN', 'txFields'],
        ),
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
        callFfi(
          'wallet_sign_message_secure',
          [c.ptr, md.ptr, mt.ptr, v.ptr, ai.ptr, at.ptr, indexN],
          ['chain', 'msgData', 'msgType', 'vaultJson', 'authInput', 'authType', 'indexN'],
        ),
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
