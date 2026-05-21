// Node test harness that loads pkg/ wasm and exercises every function
// listed in src/functions.ts (CryptoSDK + raw camelCase bindings).

import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// node 20+ exposes webcrypto on globalThis but wbindgen probes window/self too
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const here = dirname(fileURLToPath(import.meta.url));
const pkgDir = join(here, 'pkg');

const bindings = await import(join(pkgDir, 'rust_wallet_sdk_bg.js'));
const wasmBytes = await readFile(join(pkgDir, 'rust_wallet_sdk_bg.wasm'));
const { instance } = await WebAssembly.instantiate(wasmBytes, {
  './rust_wallet_sdk_bg.js': bindings,
});
bindings.__wbg_set_wasm(instance.exports);
instance.exports.__wbindgen_start();

const wasm = instance.exports;

// ---------- CryptoSDK reimplementation against this wasm instance ----------
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');
const memoryBytes = () => new Uint8Array(wasm.memory.buffer);

const passCString = (value) => {
  if (value === null || value === undefined) return { ptr: 0, len: 0 };
  const encoded = encoder.encode(value);
  const totalLen = encoded.byteLength + 1;
  const ptr = wasm.__wbindgen_malloc(totalLen, 1) >>> 0;
  const mem = memoryBytes();
  mem.set(encoded, ptr);
  mem[ptr + encoded.byteLength] = 0;
  return { ptr, len: totalLen };
};
const freeCString = (c) => { if (c.ptr) wasm.__wbindgen_free(c.ptr, c.len, 1); };
const consume = (ptr) => {
  if (ptr === 0) throw new Error('wasm returned null pointer');
  const mem = memoryBytes();
  let end = ptr;
  while (mem[end] !== 0) end++;
  const out = decoder.decode(mem.subarray(ptr, end));
  wasm.wallet_free_string(ptr);
  return out;
};
const callFfi = (name, args) => {
  const fn = wasm[name];
  if (typeof fn !== 'function') throw new Error(`wasm export "${name}" is missing`);
  return fn(...args);
};

const CryptoSDK = {
  generateMnemonic: () => consume(callFfi('wallet_generate_mnemonic', [])),
  verifyMnemonic: (m) => { const a = passCString(m); try { return consume(callFfi('wallet_verify_mnemonic', [a.ptr])); } finally { freeCString(a); } },
  hashTypedDataV4: (d) => { const a = passCString(d); try { return consume(callFfi('wallet_hash_typed_data_v4', [a.ptr])); } finally { freeCString(a); } },
  migrateVaultAddresses: (v) => { const a = passCString(v); try { return consume(callFfi('wallet_migrate_vault_addresses', [a.ptr])); } finally { freeCString(a); } },
  verifyAddress: ({ chain, address }) => { const c = passCString(chain), a = passCString(address); try { return consume(callFfi('wallet_verify_address', [c.ptr, a.ptr])); } finally { freeCString(c); freeCString(a); } },
  verifyPrivateKey: ({ chain, privateKey }) => { const c = passCString(chain), p = passCString(privateKey); try { return consume(callFfi('wallet_verify_private_key', [c.ptr, p.ptr])); } finally { freeCString(c); freeCString(p); } },
  verifyAuth: ({ vaultJson, authInput, authType }) => { const v = passCString(vaultJson), i = passCString(authInput), t = passCString(authType); try { return consume(callFfi('wallet_verify_auth', [v.ptr, i.ptr, t.ptr])); } finally { freeCString(v); freeCString(i); freeCString(t); } },
  revealMnemonic: ({ vaultJson, authInput, authType }) => { const v = passCString(vaultJson), i = passCString(authInput), t = passCString(authType); try { return consume(callFfi('wallet_reveal_mnemonic', [v.ptr, i.ptr, t.ptr])); } finally { freeCString(v); freeCString(i); freeCString(t); } },
  revealPrivateKey: ({ vaultJson, authInput, authType }) => { const v = passCString(vaultJson), i = passCString(authInput), t = passCString(authType); try { return consume(callFfi('wallet_reveal_private_key', [v.ptr, i.ptr, t.ptr])); } finally { freeCString(v); freeCString(i); freeCString(t); } },
  createWalletFromMnemonic: ({ mnemonic, password }) => {
    const m = passCString(mnemonic), p = passCString(password), nk = passCString(null);
    try { return consume(callFfi('wallet_create_wallet_from_mnemonic', [m.ptr, p.ptr, nk.ptr, 0])); }
    finally { freeCString(m); freeCString(p); freeCString(nk); }
  },
  createVaultFromPrivateKey: ({ chain, privateKey, password }) => {
    const pk = passCString(privateKey), c = passCString(chain), p = passCString(password), nk = passCString(null);
    try { return consume(callFfi('wallet_create_vault_from_private_key', [pk.ptr, c.ptr, p.ptr, nk.ptr])); }
    finally { freeCString(pk); freeCString(c); freeCString(p); freeCString(nk); }
  },
  createVaultFromPrivateKeyWithSession: ({ appKeystoreJson, password, privateKey }) => {
    const a = passCString(appKeystoreJson), p = passCString(password), pk = passCString(privateKey);
    try { return consume(callFfi('wallet_create_vault_from_private_key_with_session', [a.ptr, p.ptr, pk.ptr])); }
    finally { freeCString(a); freeCString(p); freeCString(pk); }
  },
  addVaultWithSession: ({ vaultJson, appKeystoreJson }) => {
    const v = passCString(vaultJson), a = passCString(appKeystoreJson);
    try { return consume(callFfi('wallet_add_vault_with_session', [v.ptr, a.ptr])); }
    finally { freeCString(v); freeCString(a); }
  },
  changeVaultPassword: ({ vaultJson, oldPassword, newPassword }) => {
    const v = passCString(vaultJson), o = passCString(oldPassword), n = passCString(newPassword);
    try { return consume(callFfi('wallet_change_vault_password', [v.ptr, o.ptr, n.ptr])); }
    finally { freeCString(v); freeCString(o); freeCString(n); }
  },
  migrateLegacyVault: ({ legacyEnvelope, password }) => {
    const e = passCString(legacyEnvelope), p = passCString(password), nk = passCString(null), ni = passCString(null), nl = passCString(null), nx = passCString(null);
    try { return consume(callFfi('wallet_migrate_legacy_vault', [e.ptr, p.ptr, nk.ptr, ni.ptr, nl.ptr, nx.ptr])); }
    finally { freeCString(e); freeCString(p); }
  },
  addBiometricAccessToVaultWithGlobalSession: ({ vaultJson, biometricKey }) => {
    const v = passCString(vaultJson), bk = passCString(biometricKey);
    try { return consume(callFfi('wallet_add_biometric_access_to_vault_with_global_session', [v.ptr, bk.ptr])); }
    finally { freeCString(v); freeCString(bk); }
  },
  generateAddressFromXpub: ({ xpubEth, xpubTron, xpubBtc, mnemonic, index, chainId = 0n }) => {
    const e = passCString(xpubEth), t = passCString(xpubTron), b = passCString(xpubBtc), m = passCString(mnemonic ?? null);
    try { return consume(callFfi('wallet_generate_address_from_xpub', [e.ptr, t.ptr, b.ptr, m.ptr, index, chainId])); }
    finally { freeCString(e); freeCString(t); freeCString(b); freeCString(m); }
  },
  generateAddressesFromXpubBulk: ({ xpubEth, xpubTron, xpubBtc, mnemonic, startIndex, count, chainId = 0n }) => {
    const e = passCString(xpubEth), t = passCString(xpubTron), b = passCString(xpubBtc), m = passCString(mnemonic ?? null);
    try { return consume(callFfi('wallet_generate_addresses_from_xpub_bulk', [e.ptr, t.ptr, b.ptr, m.ptr, startIndex, count, chainId])); }
    finally { freeCString(e); freeCString(t); freeCString(b); freeCString(m); }
  },
  signTxSecure: ({ chain, txData, vaultJson, authInput, authType, indexN, txFields }) => {
    const c = passCString(chain), td = passCString(txData), v = passCString(vaultJson), ai = passCString(authInput), at = passCString(authType), tf = passCString(txFields ?? null);
    try { return consume(callFfi('wallet_sign_tx_secure', [c.ptr, td.ptr, v.ptr, ai.ptr, at.ptr, indexN, tf.ptr])); }
    finally { freeCString(c); freeCString(td); freeCString(v); freeCString(ai); freeCString(at); freeCString(tf); }
  },
  signMessageSecure: ({ chain, msgData, msgType, vaultJson, authInput, authType, indexN }) => {
    const c = passCString(chain), md = passCString(msgData), mt = passCString(msgType), v = passCString(vaultJson), ai = passCString(authInput), at = passCString(authType);
    try { return consume(callFfi('wallet_sign_message_secure', [c.ptr, md.ptr, mt.ptr, v.ptr, ai.ptr, at.ptr, indexN])); }
    finally { freeCString(c); freeCString(md); freeCString(mt); freeCString(v); freeCString(ai); freeCString(at); }
  },
  freeGlobalSession: () => { wasm.wallet_free_global_session(); return '(void)'; },
};

// ---------- Test runner ----------
const results = [];
const run = (label, fn) => {
  try {
    const out = fn();
    const preview = typeof out === 'string' ? (out.length > 120 ? out.slice(0, 120) + '…' : out) : String(out);
    results.push({ label, ok: true, info: preview });
  } catch (e) {
    results.push({ label, ok: false, info: e?.message ?? String(e) });
  }
};

// Seed: real mnemonic from the SDK so downstream calls have realistic input
let seedMnemonic = '';
let seedVault = '';
let seedAppKeystore = '';
const PASSWORD = 'TestPassword123!';
try { seedMnemonic = CryptoSDK.generateMnemonic(); } catch {}
// CryptoSDK.createWalletFromMnemonic panics — use the camelCase binding to seed the vault
try { seedVault = bindings.createWalletFromMnemonic(seedMnemonic, PASSWORD, null); } catch (e) { console.error('seed createWalletFromMnemonic failed:', e?.message); }
// createAppKeystore was removed from the wbindgen surface in the new pkg/
// build; session-dependent tests below will report a missing-export error.
seedAppKeystore = '';

// CryptoSDK panel
run('CryptoSDK.generateMnemonic',          () => CryptoSDK.generateMnemonic());
run('CryptoSDK.verifyMnemonic',            () => CryptoSDK.verifyMnemonic(seedMnemonic || 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'));
run('CryptoSDK.createWalletFromMnemonic',  () => CryptoSDK.createWalletFromMnemonic({ mnemonic: seedMnemonic, password: PASSWORD }));
run('CryptoSDK.createVaultFromPrivateKey', () => CryptoSDK.createVaultFromPrivateKey({ chain: 'eth', privateKey: '0x' + 'aa'.repeat(32), password: PASSWORD }));
run('CryptoSDK.createVaultFromPrivateKeyWithSession', () => CryptoSDK.createVaultFromPrivateKeyWithSession({ appKeystoreJson: seedAppKeystore, password: PASSWORD, privateKey: '0x' + 'aa'.repeat(32) }));
run('CryptoSDK.addVaultWithSession',       () => CryptoSDK.addVaultWithSession({ vaultJson: seedVault, appKeystoreJson: seedAppKeystore }));
run('CryptoSDK.changeVaultPassword',       () => CryptoSDK.changeVaultPassword({ vaultJson: seedVault, oldPassword: PASSWORD, newPassword: 'NewPass!' }));
run('CryptoSDK.migrateLegacyVault',        () => CryptoSDK.migrateLegacyVault({ legacyEnvelope: seedVault, password: PASSWORD }));
run('CryptoSDK.migrateVaultAddresses',     () => CryptoSDK.migrateVaultAddresses(seedVault));
run('CryptoSDK.verifyAddress',             () => CryptoSDK.verifyAddress({ chain: 'eth', address: '0x0000000000000000000000000000000000000000' }));
run('CryptoSDK.verifyPrivateKey',          () => CryptoSDK.verifyPrivateKey({ chain: 'eth', privateKey: '0x' + 'aa'.repeat(32) }));
run('CryptoSDK.verifyAuth',                () => CryptoSDK.verifyAuth({ vaultJson: seedVault, authInput: PASSWORD, authType: 'password' }));
run('CryptoSDK.revealMnemonic',            () => CryptoSDK.revealMnemonic({ vaultJson: seedVault, authInput: PASSWORD, authType: 'password' }));
run('CryptoSDK.revealPrivateKey',          () => CryptoSDK.revealPrivateKey({ vaultJson: seedVault, authInput: PASSWORD, authType: 'password' }));
run('CryptoSDK.addBiometricAccessToVaultWithGlobalSession', () => CryptoSDK.addBiometricAccessToVaultWithGlobalSession({ vaultJson: seedVault, biometricKey: 'aa' }));
run('CryptoSDK.generateAddressFromXpub',   () => CryptoSDK.generateAddressFromXpub({ xpubEth: '', xpubTron: '', xpubBtc: '', mnemonic: seedMnemonic, index: 0 }));
run('CryptoSDK.generateAddressesFromXpubBulk', () => CryptoSDK.generateAddressesFromXpubBulk({ xpubEth: '', xpubTron: '', xpubBtc: '', mnemonic: seedMnemonic, startIndex: 0, count: 2 }));
run('CryptoSDK.signTxSecure',              () => CryptoSDK.signTxSecure({ chain: 'eth', txData: '{}', vaultJson: seedVault, authInput: PASSWORD, authType: 'password', indexN: 0, txFields: null }));
run('CryptoSDK.signMessageSecure',         () => CryptoSDK.signMessageSecure({ chain: 'eth', msgData: 'hello', msgType: 'personal', vaultJson: seedVault, authInput: PASSWORD, authType: 'password', indexN: 0 }));
run('CryptoSDK.hashTypedDataV4',           () => CryptoSDK.hashTypedDataV4('{}'));
run('CryptoSDK.freeGlobalSession',         () => CryptoSDK.freeGlobalSession());

// Raw camelCase bindings panel
run('raw.utilEncryptString',  () => bindings.utilEncryptString('hello', PASSWORD));
let packed = '';
try { packed = bindings.utilEncryptString('hello', PASSWORD); } catch {}
run('raw.utilDecryptString',  () => bindings.utilDecryptString(packed, PASSWORD));
run('raw.encrypt',            () => bindings.encrypt(seedMnemonic, PASSWORD));
let env = '';
try { env = bindings.encrypt(seedMnemonic, PASSWORD); } catch {}
run('raw.decrypt',            () => bindings.decrypt(env, PASSWORD, 'password'));
run('raw.changePassword',     () => bindings.changePassword(env, PASSWORD, 'Other!'));
run('raw.generateAddressFromXpub', () => bindings.generateAddressFromXpub('', '', '', seedMnemonic, 0, null));
run('raw.generateMnemonic',   () => bindings.generateMnemonic());
run('raw.createNewVault',     () => bindings.createNewVault(PASSWORD, null));
run('raw.verifyPassword',     () => bindings.verifyPassword(seedVault, PASSWORD));
run('raw.createDeterministicWalletId', () => bindings.createDeterministicWalletId('seed'));

// ---------- Print report ----------
const ok = results.filter(r => r.ok);
const bad = results.filter(r => !r.ok);
console.log('\n=== WORKING (' + ok.length + ') ===');
for (const r of ok) console.log('  ✓ ' + r.label + '  →  ' + r.info);
console.log('\n=== FAILING (' + bad.length + ') ===');
for (const r of bad) console.log('  ✗ ' + r.label + '  →  ' + r.info);
