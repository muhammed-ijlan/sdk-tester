/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const wallet_add_biometric_access_to_vault_with_global_session: (
  a: number,
  b: number,
) => number;
export const wallet_add_vault_with_session: (a: number, b: number) => number;
export const wallet_change_vault_password: (
  a: number,
  b: number,
  c: number,
) => number;
export const wallet_create_vault_from_private_key: (
  a: number,
  b: number,
  c: number,
  d: number,
) => number;
export const wallet_create_vault_from_private_key_with_session: (
  a: number,
  b: number,
  c: number,
) => number;
export const wallet_create_wallet_from_mnemonic: (
  a: number,
  b: number,
  c: number,
  d: number,
) => number;
export const wallet_free_global_session: () => void;
export const wallet_free_string: (a: number) => void;
export const wallet_generate_address_from_xpub: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: bigint,
) => number;
export const wallet_generate_addresses_from_xpub_bulk: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  g: bigint,
) => number;
export const wallet_generate_mnemonic: () => number;
export const wallet_hash_typed_data_v4: (a: number) => number;
export const wallet_migrate_legacy_vault: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
) => number;
export const wallet_migrate_vault_addresses: (a: number) => number;
export const wallet_reveal_mnemonic: (
  a: number,
  b: number,
  c: number,
) => number;
export const wallet_reveal_private_key: (
  a: number,
  b: number,
  c: number,
) => number;
export const wallet_sign_message_secure: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  g: number,
) => number;
export const wallet_sign_tx_secure: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  g: number,
) => number;
export const wallet_verify_address: (a: number, b: number) => number;
export const wallet_verify_auth: (a: number, b: number, c: number) => number;
export const wallet_verify_mnemonic: (a: number) => number;
export const wallet_verify_private_key: (a: number, b: number) => number;

export const changePassword: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
) => [number, number, number, number];
export const createDeterministicWalletId: (
  a: number,
  b: number,
) => [number, number, number, number];
export const createNewVault: (
  a: number,
  b: number,
  c: number,
  d: number,
) => [number, number, number, number];
export const createWalletFromMnemonic: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
) => [number, number, number, number];
export const decrypt: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
) => [number, number, number, number];
export const encrypt: (
  a: number,
  b: number,
  c: number,
  d: number,
) => [number, number, number, number];
export const generateAddressFromXpub: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  g: number,
  h: number,
  i: number,
  j: number,
  k: bigint,
) => [number, number, number, number];
export const generateMnemonic: () => [number, number, number, number];
export const migrateVaultAddresses: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
) => [number, number, number, number];
export const signMessageSecure: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  g: number,
  h: number,
  i: number,
  j: number,
  k: number,
  l: number,
  m: number,
) => [number, number, number, number];
export const signTxSecure: (
  a: number,
  b: number,
  c: number,
  d: number,
  e: number,
  f: number,
  g: number,
  h: number,
  i: number,
  j: number,
  k: number,
  l: number,
  m: number,
) => [number, number, number, number];
export const utilDecryptString: (
  a: number,
  b: number,
  c: number,
  d: number,
) => [number, number, number, number];
export const utilEncryptString: (
  a: number,
  b: number,
  c: number,
  d: number,
) => [number, number, number, number];
export const verifyAddress: (
  a: number,
  b: number,
  c: number,
  d: number,
) => [number, number, number, number];
export const verifyPassword: (
  a: number,
  b: number,
  c: number,
  d: number,
) => [number, number, number, number];
export const rustsecp256k1_v0_9_2_default_error_callback_fn: (
  a: number,
  b: number,
) => void;
export const rustsecp256k1_v0_9_2_default_illegal_callback_fn: (
  a: number,
  b: number,
) => void;
export const rustsecp256k1_v0_9_2_context_destroy: (a: number) => void;
export const rustsecp256k1_v0_9_2_context_create: (a: number) => number;
export const rustsecp256k1_v0_10_0_default_error_callback_fn: (
  a: number,
  b: number,
) => void;
export const rustsecp256k1_v0_10_0_default_illegal_callback_fn: (
  a: number,
  b: number,
) => void;
export const rustsecp256k1_v0_10_0_context_destroy: (a: number) => void;
export const rustsecp256k1_v0_10_0_context_create: (a: number) => number;
export const __wbindgen_exn_store: (a: number) => void;
export const __externref_table_alloc: () => number;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (
  a: number,
  b: number,
  c: number,
  d: number,
) => number;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_start: () => void;
