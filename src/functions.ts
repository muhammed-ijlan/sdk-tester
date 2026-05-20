import { getCurrent } from './sdk-runtime';

// Proxy so the active build (bundled or hot-swapped via the header bar)
// is always what we call.
const sdk = new Proxy({} as Record<string, (...args: unknown[]) => unknown>, {
  get(_target, prop) {
    return (getCurrent().bindings as Record<string | symbol, unknown>)[prop];
  },
});

export type FieldType = 'text' | 'textarea' | 'password' | 'number';

export type FieldSpec = {
  name: string;
  type: FieldType;
  optional?: boolean;
  placeholder?: string;
  defaultValue?: string;
};

export type SdkFn = {
  name: string;
  description: string;
  signature: string;
  fields: FieldSpec[];
  call: (values: Record<string, string>) => unknown;
};

export type SdkSection = {
  title: string;
  blurb: string;
  fns: SdkFn[];
};

const opt = (v: string): string | null => (v.trim() === '' ? null : v);
const num = (v: string): number => Number(v);
const bigintOpt = (v: string): bigint | null => (v.trim() === '' ? null : BigInt(v));

const FNS: SdkFn[] = [
  // Mnemonic / vault creation
  {
    name: 'generateMnemonic',
    description: 'Generate a fresh BIP-39 mnemonic.',
    signature: 'generateMnemonic(): string',
    fields: [],
    call: () => sdk.generateMnemonic(),
  },
  {
    name: 'createNewVault',
    description:
      'Create NEW Vault (random mnemonic). Optionally accepts biometric information — provide biometric_key, biometric_id, and biometric_label together to add biometric access.',
    signature: 'createNewVault(password, biometric_key?, biometric_id?, biometric_label?): string',
    fields: [
      { name: 'password', type: 'password' },
      { name: 'biometric_key', type: 'text', optional: true },
      { name: 'biometric_id', type: 'text', optional: true },
      { name: 'biometric_label', type: 'text', optional: true },
    ],
    call: v =>
      sdk.createNewVault(v.password, opt(v.biometric_key), opt(v.biometric_id), opt(v.biometric_label)),
  },
  {
    name: 'createNewVaultWithSession',
    description: 'Create a new vault using a session (unlocked with password).',
    signature: 'createNewVaultWithSession(app_keystore_json, password): string',
    fields: [
      { name: 'app_keystore_json', type: 'textarea' },
      { name: 'password', type: 'password' },
    ],
    call: v => sdk.createNewVaultWithSession(v.app_keystore_json, v.password),
  },
  {
    name: 'createWalletFromMnemonic',
    description:
      'Import vault from mnemonic. Optionally accepts biometric information — provide biometric_key, biometric_id, and biometric_label together to add biometric access.',
    signature:
      'createWalletFromMnemonic(mnemonic, password, biometric_key?, biometric_id?, biometric_label?): string',
    fields: [
      { name: 'mnemonic', type: 'textarea' },
      { name: 'password', type: 'password' },
      { name: 'biometric_key', type: 'text', optional: true },
      { name: 'biometric_id', type: 'text', optional: true },
      { name: 'biometric_label', type: 'text', optional: true },
    ],
    call: v =>
      sdk.createWalletFromMnemonic(
        v.mnemonic,
        v.password,
        opt(v.biometric_key),
        opt(v.biometric_id),
        opt(v.biometric_label),
      ),
  },
  {
    name: 'createAppKeystore',
    description: 'Create an app keystore for session management.',
    signature: 'createAppKeystore(password): string',
    fields: [{ name: 'password', type: 'password' }],
    call: v => sdk.createAppKeystore(v.password),
  },
  {
    name: 'createDeterministicWalletId',
    description: 'Derive a deterministic wallet id from input data.',
    signature: 'createDeterministicWalletId(input_data): string',
    fields: [{ name: 'input_data', type: 'textarea' }],
    call: v => sdk.createDeterministicWalletId(v.input_data),
  },

  // Encryption / password
  {
    name: 'encrypt',
    description: 'Encrypt: turns text (mnemonic) → vault JSON.',
    signature: 'encrypt(normal_text, password): string',
    fields: [
      { name: 'normal_text', type: 'textarea' },
      { name: 'password', type: 'password' },
    ],
    call: v => sdk.encrypt(v.normal_text, v.password),
  },
  {
    name: 'decrypt',
    description: 'Decrypt: turns vault JSON → text (mnemonic).',
    signature: 'decrypt(enc_envelope, password): string',
    fields: [
      { name: 'enc_envelope', type: 'textarea' },
      { name: 'password', type: 'password' },
    ],
    call: v => sdk.decrypt(v.enc_envelope, v.password),
  },
  {
    name: 'utilEncryptString',
    description: 'Generic packed-data string encryption.',
    signature: 'utilEncryptString(text, password): string',
    fields: [
      { name: 'text', type: 'textarea' },
      { name: 'password', type: 'password' },
    ],
    call: v => sdk.utilEncryptString(v.text, v.password),
  },
  {
    name: 'utilDecryptString',
    description: 'Inverse of utilEncryptString.',
    signature: 'utilDecryptString(packed_data, password): string',
    fields: [
      { name: 'packed_data', type: 'textarea' },
      { name: 'password', type: 'password' },
    ],
    call: v => sdk.utilDecryptString(v.packed_data, v.password),
  },
  {
    name: 'changePassword',
    description: 'Change password: re-encrypts master key with a new password.',
    signature: 'changePassword(enc_envelope, old_password, new_password): string',
    fields: [
      { name: 'enc_envelope', type: 'textarea' },
      { name: 'old_password', type: 'password' },
      { name: 'new_password', type: 'password' },
    ],
    call: v => sdk.changePassword(v.enc_envelope, v.old_password, v.new_password),
  },

  // Verify
  {
    name: 'verifyPassword',
    description: 'Validate a password against a vault.',
    signature: 'verifyPassword(vault_json, password): string',
    fields: [
      { name: 'vault_json', type: 'textarea' },
      { name: 'password', type: 'password' },
    ],
    call: v => sdk.verifyPassword(v.vault_json, v.password),
  },
  {
    name: 'verifyAddress',
    description: 'Validate that an address is well-formed for the given chain.',
    signature: 'verifyAddress(chain, address): string',
    fields: [
      { name: 'chain', type: 'text', defaultValue: 'eth', placeholder: 'eth | tron | btc' },
      { name: 'address', type: 'text' },
    ],
    call: v => sdk.verifyAddress(v.chain, v.address),
  },

  // Address derivation
  {
    name: 'generateAddressFromXpub',
    description: 'Derive a single address from any combination of ETH/TRON/BTC xpubs.',
    signature:
      'generateAddressFromXpub(xpub_eth, xpub_tron, xpub_btc, mnemonic?, index, chain_id?): string',
    fields: [
      { name: 'xpub_eth', type: 'text' },
      { name: 'xpub_tron', type: 'text' },
      { name: 'xpub_btc', type: 'text' },
      { name: 'mnemonic', type: 'textarea', optional: true },
      { name: 'index', type: 'number', defaultValue: '0' },
      { name: 'chain_id', type: 'number', optional: true },
    ],
    call: v =>
      sdk.generateAddressFromXpub(
        v.xpub_eth,
        v.xpub_tron,
        v.xpub_btc,
        opt(v.mnemonic),
        num(v.index),
        bigintOpt(v.chain_id),
      ),
  },
  {
    name: 'migrateVaultAddresses',
    description:
      'Derive all supported chain addresses from an existing vault (migration helper). auth_type accepts "password" or a biometric method id; auth_input is the corresponding secret.',
    signature: 'migrateVaultAddresses(vault_json, auth_input, auth_type): string',
    fields: [
      { name: 'vault_json', type: 'textarea' },
      { name: 'auth_input', type: 'password' },
      { name: 'auth_type', type: 'text', defaultValue: 'password' },
    ],
    call: v => sdk.migrateVaultAddresses(v.vault_json, v.auth_input, v.auth_type),
  },

  // Biometric
  {
    name: 'addBiometricAccessWithSession',
    description: 'Add biometric access to the app keystore.',
    signature: 'addBiometricAccessWithSession(app_keystore_json, enc_kek_app, bio_id, bio_label): string',
    fields: [
      { name: 'app_keystore_json', type: 'textarea' },
      { name: 'enc_kek_app', type: 'textarea' },
      { name: 'bio_id', type: 'text' },
      { name: 'bio_label', type: 'text' },
    ],
    call: v => sdk.addBiometricAccessWithSession(v.app_keystore_json, v.enc_kek_app, v.bio_id, v.bio_label),
  },

  // Signing
  {
    name: 'signTxSecure',
    description: 'Secure sign transaction (unified). auth_type is "password" or a biometric method id.',
    signature:
      'signTxSecure(chain, tx_data, vault_json, auth_input, auth_type, index_n, tx_fields?): string',
    fields: [
      { name: 'chain', type: 'text', defaultValue: 'eth' },
      { name: 'tx_data', type: 'textarea' },
      { name: 'vault_json', type: 'textarea' },
      { name: 'auth_input', type: 'password' },
      { name: 'auth_type', type: 'text', defaultValue: 'password' },
      { name: 'index_n', type: 'number', defaultValue: '0' },
      { name: 'tx_fields', type: 'textarea', optional: true },
    ],
    call: v =>
      sdk.signTxSecure(
        v.chain,
        v.tx_data,
        v.vault_json,
        v.auth_input,
        v.auth_type,
        num(v.index_n),
        opt(v.tx_fields),
      ),
  },
  {
    name: 'signTxWithSession',
    description: 'Sign a transaction using a session (unlocked with password).',
    signature:
      'signTxWithSession(app_keystore_json, password, chain, tx_data, vault_json, index_n, tx_fields?): string',
    fields: [
      { name: 'app_keystore_json', type: 'textarea' },
      { name: 'password', type: 'password' },
      { name: 'chain', type: 'text', defaultValue: 'eth' },
      { name: 'tx_data', type: 'textarea' },
      { name: 'vault_json', type: 'textarea' },
      { name: 'index_n', type: 'number', defaultValue: '0' },
      { name: 'tx_fields', type: 'textarea', optional: true },
    ],
    call: v =>
      sdk.signTxWithSession(
        v.app_keystore_json,
        v.password,
        v.chain,
        v.tx_data,
        v.vault_json,
        num(v.index_n),
        opt(v.tx_fields),
      ),
  },
  {
    name: 'signMessageSecure',
    description: 'Secure sign message (personal / typed data).',
    signature:
      'signMessageSecure(chain, msg_data, msg_type, vault_json, auth_input, auth_type, index_n): string',
    fields: [
      { name: 'chain', type: 'text', defaultValue: 'eth' },
      { name: 'msg_data', type: 'textarea' },
      { name: 'msg_type', type: 'text', defaultValue: 'personal', placeholder: 'personal | typed_data' },
      { name: 'vault_json', type: 'textarea' },
      { name: 'auth_input', type: 'password' },
      { name: 'auth_type', type: 'text', defaultValue: 'password' },
      { name: 'index_n', type: 'number', defaultValue: '0' },
    ],
    call: v =>
      sdk.signMessageSecure(
        v.chain,
        v.msg_data,
        v.msg_type,
        v.vault_json,
        v.auth_input,
        v.auth_type,
        num(v.index_n),
      ),
  },
];

export const SECTIONS: SdkSection[] = [
  {
    title: 'rust_wallet_sdk',
    blurb: `${FNS.length} functions exported by the current pkg/ build.`,
    fns: FNS,
  },
];
