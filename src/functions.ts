import { CryptoSDK } from './CryptoSDK';
import { getCurrent } from './sdk-runtime';

// Proxy through sdk-runtime so the camelCase bindings panel tracks the
// currently-loaded build (bundled or uploaded).
const sdk = new Proxy({} as Record<string, (...args: unknown[]) => unknown>, {
  get(_target, prop) {
    return (getCurrent().bindings as Record<string | symbol, unknown>)[prop];
  },
}) as Record<string, (...args: unknown[]) => unknown> & {
  utilEncryptString: (text: string, password: string) => string;
  utilDecryptString: (packed: string, password: string) => string;
  encrypt: (text: string, password: string) => string;
  decrypt: (env: string, password: string) => string;
  changePassword: (env: string, oldP: string, newP: string) => string;
  generateAddressFromXpub: (
    xpubEth: string,
    xpubTron: string,
    xpubBtc: string,
    mnemonic: string | null,
    index: number,
    chainId: bigint | null,
  ) => string;
  generateMnemonic: () => string;
  createNewVault: (
    password: string,
    biometricKey: string | null,
    biometricId: string | null,
    biometricLabel: string | null,
  ) => string;
  verifyPassword: (vaultJson: string, password: string) => string;
  createDeterministicWalletId: (input: string) => string;
  createAppKeystore: (password: string) => string;
};

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

const opt = (v: string) => (v.trim() === '' ? null : v);
const num = (v: string) => Number(v);
const bigintOpt = (v: string): bigint | undefined => (v.trim() === '' ? undefined : BigInt(v));

const CRYPTO_SDK_FNS: SdkFn[] = [
  {
    name: 'CryptoSDK.generateMnemonic',
    description: 'Generate a fresh BIP-39 mnemonic via wallet_generate_mnemonic.',
    signature: 'CryptoSDK.generateMnemonic(): string',
    fields: [],
    call: () => CryptoSDK.generateMnemonic(),
  },
  {
    name: 'CryptoSDK.verifyMnemonic',
    description: 'Validate that a mnemonic is well-formed.',
    signature: 'CryptoSDK.verifyMnemonic(mnemonic): string',
    fields: [{ name: 'mnemonic', type: 'textarea' }],
    call: v => CryptoSDK.verifyMnemonic(v.mnemonic),
  },
  {
    name: 'CryptoSDK.createWalletFromMnemonic',
    description:
      'Create a new vault from an existing mnemonic. Pass all three biometric fields together to enable biometric access, or leave them blank.',
    signature:
      'CryptoSDK.createWalletFromMnemonic({ mnemonic, password, biometricKey?, biometricId?, biometricLabel? })',
    fields: [
      { name: 'mnemonic', type: 'textarea' },
      { name: 'password', type: 'password' },
      { name: 'biometricKey', type: 'text', optional: true },
      { name: 'biometricId', type: 'text', optional: true },
      { name: 'biometricLabel', type: 'text', optional: true },
    ],
    call: v =>
      CryptoSDK.createWalletFromMnemonic({
        mnemonic: v.mnemonic,
        password: v.password,
        biometricKey: opt(v.biometricKey),
        biometricId: opt(v.biometricId),
        biometricLabel: opt(v.biometricLabel),
      }),
  },
  {
    name: 'CryptoSDK.createVaultFromPrivateKey',
    description:
      'INFERRED — create a vault from a raw private key. `chain` is a chain-name string ("eth" / "tron" / "btc") — passing a numeric id here will fail.',
    signature: 'CryptoSDK.createVaultFromPrivateKey({ chain, privateKey, password, biometric* })',
    fields: [
      { name: 'chain', type: 'text', defaultValue: 'eth', placeholder: 'eth | tron | btc' },
      { name: 'privateKey', type: 'textarea' },
      { name: 'password', type: 'password' },
      { name: 'biometricKey', type: 'text', optional: true },
      { name: 'biometricId', type: 'text', optional: true },
      { name: 'biometricLabel', type: 'text', optional: true },
    ],
    call: v =>
      CryptoSDK.createVaultFromPrivateKey({
        chain: v.chain,
        privateKey: v.privateKey,
        password: v.password,
        biometricKey: opt(v.biometricKey),
        biometricId: opt(v.biometricId),
        biometricLabel: opt(v.biometricLabel),
      }),
  },
  {
    name: 'CryptoSDK.createVaultFromPrivateKeyWithSession',
    description: 'INFERRED — create a vault from a private key reusing an unlocked app-keystore session.',
    signature: 'CryptoSDK.createVaultFromPrivateKeyWithSession({ appKeystoreJson, password, privateKey })',
    fields: [
      { name: 'appKeystoreJson', type: 'textarea' },
      { name: 'password', type: 'password' },
      { name: 'privateKey', type: 'textarea' },
    ],
    call: v =>
      CryptoSDK.createVaultFromPrivateKeyWithSession({
        appKeystoreJson: v.appKeystoreJson,
        password: v.password,
        privateKey: v.privateKey,
      }),
  },
  {
    name: 'CryptoSDK.addVaultWithSession',
    description: 'INFERRED — attach an existing vault JSON onto an active app-keystore session.',
    signature: 'CryptoSDK.addVaultWithSession({ vaultJson, appKeystoreJson })',
    fields: [
      { name: 'vaultJson', type: 'textarea' },
      { name: 'appKeystoreJson', type: 'textarea' },
    ],
    call: v => CryptoSDK.addVaultWithSession({ vaultJson: v.vaultJson, appKeystoreJson: v.appKeystoreJson }),
  },
  {
    name: 'CryptoSDK.changeVaultPassword',
    description: 'Re-encrypt the vault master key under a new password.',
    signature: 'CryptoSDK.changeVaultPassword({ vaultJson, oldPassword, newPassword })',
    fields: [
      { name: 'vaultJson', type: 'textarea' },
      { name: 'oldPassword', type: 'password' },
      { name: 'newPassword', type: 'password' },
    ],
    call: v =>
      CryptoSDK.changeVaultPassword({
        vaultJson: v.vaultJson,
        oldPassword: v.oldPassword,
        newPassword: v.newPassword,
      }),
  },
  {
    name: 'CryptoSDK.migrateLegacyVault',
    description: 'INFERRED — migrate a legacy vault envelope into the new vault format.',
    signature: 'CryptoSDK.migrateLegacyVault({ legacyEnvelope, password, biometric*, extraField? })',
    fields: [
      { name: 'legacyEnvelope', type: 'textarea' },
      { name: 'password', type: 'password' },
      { name: 'biometricKey', type: 'text', optional: true },
      { name: 'biometricId', type: 'text', optional: true },
      { name: 'biometricLabel', type: 'text', optional: true },
      { name: 'extraField', type: 'text', optional: true },
    ],
    call: v =>
      CryptoSDK.migrateLegacyVault({
        legacyEnvelope: v.legacyEnvelope,
        password: v.password,
        biometricKey: opt(v.biometricKey),
        biometricId: opt(v.biometricId),
        biometricLabel: opt(v.biometricLabel),
        extraField: opt(v.extraField),
      }),
  },
  {
    name: 'CryptoSDK.migrateVaultAddresses',
    description: 'Re-derive all supported chain addresses from an existing vault.',
    signature: 'CryptoSDK.migrateVaultAddresses(vaultJson)',
    fields: [{ name: 'vaultJson', type: 'textarea' }],
    call: v => CryptoSDK.migrateVaultAddresses(v.vaultJson),
  },
  {
    name: 'CryptoSDK.verifyAddress',
    description: 'Validate that an address is well-formed for the given chain.',
    signature: 'CryptoSDK.verifyAddress({ chain, address })',
    fields: [
      { name: 'chain', type: 'text', defaultValue: 'eth', placeholder: 'eth | tron | btc' },
      { name: 'address', type: 'text' },
    ],
    call: v => CryptoSDK.verifyAddress({ chain: v.chain, address: v.address }),
  },
  {
    name: 'CryptoSDK.verifyPrivateKey',
    description: 'INFERRED — validate a private key for the given chain.',
    signature: 'CryptoSDK.verifyPrivateKey({ chain, privateKey })',
    fields: [
      { name: 'chain', type: 'text', defaultValue: 'eth' },
      { name: 'privateKey', type: 'textarea' },
    ],
    call: v => CryptoSDK.verifyPrivateKey({ chain: v.chain, privateKey: v.privateKey }),
  },
  {
    name: 'CryptoSDK.verifyAuth',
    description: 'Validate auth credentials (password or biometric) against a vault.',
    signature: 'CryptoSDK.verifyAuth({ vaultJson, authInput, authType })',
    fields: [
      { name: 'vaultJson', type: 'textarea' },
      { name: 'authInput', type: 'password' },
      { name: 'authType', type: 'text', defaultValue: 'password' },
    ],
    call: v => CryptoSDK.verifyAuth({ vaultJson: v.vaultJson, authInput: v.authInput, authType: v.authType }),
  },
  {
    name: 'CryptoSDK.revealMnemonic',
    description: 'Decrypt and return the vault mnemonic. authType is "password" or a biometric method id.',
    signature: 'CryptoSDK.revealMnemonic({ vaultJson, authInput, authType })',
    fields: [
      { name: 'vaultJson', type: 'textarea' },
      { name: 'authInput', type: 'password' },
      { name: 'authType', type: 'text', defaultValue: 'password' },
    ],
    call: v =>
      CryptoSDK.revealMnemonic({ vaultJson: v.vaultJson, authInput: v.authInput, authType: v.authType }),
  },
  {
    name: 'CryptoSDK.revealPrivateKey',
    description: 'Decrypt and return the vault private key.',
    signature: 'CryptoSDK.revealPrivateKey({ vaultJson, authInput, authType })',
    fields: [
      { name: 'vaultJson', type: 'textarea' },
      { name: 'authInput', type: 'password' },
      { name: 'authType', type: 'text', defaultValue: 'password' },
    ],
    call: v =>
      CryptoSDK.revealPrivateKey({ vaultJson: v.vaultJson, authInput: v.authInput, authType: v.authType }),
  },
  {
    name: 'CryptoSDK.addBiometricAccessToVaultWithGlobalSession',
    description: 'Attach biometric (WebAuthn PRF) access to an existing vault using the global session.',
    signature: 'CryptoSDK.addBiometricAccessToVaultWithGlobalSession({ vaultJson, encKekApp, bioId, bioLabel })',
    fields: [
      { name: 'vaultJson', type: 'textarea' },
      { name: 'encKekApp', type: 'textarea' },
      { name: 'bioId', type: 'text' },
      { name: 'bioLabel', type: 'text' },
    ],
    call: v =>
      CryptoSDK.addBiometricAccessToVaultWithGlobalSession({
        vaultJson: v.vaultJson,
        encKekApp: v.encKekApp,
        bioId: v.bioId,
        bioLabel: v.bioLabel,
      }),
  },
  {
    name: 'CryptoSDK.generateAddressFromXpub',
    description: 'Derive a single address from any combination of ETH/TRON/BTC xpubs.',
    signature: 'CryptoSDK.generateAddressFromXpub({ xpubEth, xpubTron, xpubBtc, mnemonic?, index, chainId? })',
    fields: [
      { name: 'xpubEth', type: 'text' },
      { name: 'xpubTron', type: 'text' },
      { name: 'xpubBtc', type: 'text' },
      { name: 'mnemonic', type: 'textarea', optional: true },
      { name: 'index', type: 'number', defaultValue: '0' },
      { name: 'chainId', type: 'number', optional: true, defaultValue: '0' },
    ],
    call: v =>
      CryptoSDK.generateAddressFromXpub({
        xpubEth: v.xpubEth,
        xpubTron: v.xpubTron,
        xpubBtc: v.xpubBtc,
        mnemonic: opt(v.mnemonic),
        index: num(v.index),
        chainId: bigintOpt(v.chainId),
      }),
  },
  {
    name: 'CryptoSDK.generateAddressesFromXpubBulk',
    description: 'INFERRED — derive a range of addresses [startIndex, startIndex+count).',
    signature:
      'CryptoSDK.generateAddressesFromXpubBulk({ xpubEth, xpubTron, xpubBtc, mnemonic?, startIndex, count, chainId? })',
    fields: [
      { name: 'xpubEth', type: 'text' },
      { name: 'xpubTron', type: 'text' },
      { name: 'xpubBtc', type: 'text' },
      { name: 'mnemonic', type: 'textarea', optional: true },
      { name: 'startIndex', type: 'number', defaultValue: '0' },
      { name: 'count', type: 'number', defaultValue: '1' },
      { name: 'chainId', type: 'number', optional: true, defaultValue: '0' },
    ],
    call: v =>
      CryptoSDK.generateAddressesFromXpubBulk({
        xpubEth: v.xpubEth,
        xpubTron: v.xpubTron,
        xpubBtc: v.xpubBtc,
        mnemonic: opt(v.mnemonic),
        startIndex: num(v.startIndex),
        count: num(v.count),
        chainId: bigintOpt(v.chainId),
      }),
  },
  {
    name: 'CryptoSDK.signTxSecure',
    description: 'Unified secure transaction signing. authType is "password" or a biometric method id.',
    signature: 'CryptoSDK.signTxSecure({ chain, txData, vaultJson, authInput, authType, indexN, txFields? })',
    fields: [
      { name: 'chain', type: 'text', defaultValue: 'eth' },
      { name: 'txData', type: 'textarea' },
      { name: 'vaultJson', type: 'textarea' },
      { name: 'authInput', type: 'password' },
      { name: 'authType', type: 'text', defaultValue: 'password' },
      { name: 'indexN', type: 'number', defaultValue: '0' },
      { name: 'txFields', type: 'textarea', optional: true },
    ],
    call: v =>
      CryptoSDK.signTxSecure({
        chain: v.chain,
        txData: v.txData,
        vaultJson: v.vaultJson,
        authInput: v.authInput,
        authType: v.authType,
        indexN: num(v.indexN),
        txFields: opt(v.txFields),
      }),
  },
  {
    name: 'CryptoSDK.signMessageSecure',
    description: 'Sign a personal or typed-data message via the unified secure path.',
    signature: 'CryptoSDK.signMessageSecure({ chain, msgData, msgType, vaultJson, authInput, authType, indexN })',
    fields: [
      { name: 'chain', type: 'text', defaultValue: 'eth' },
      { name: 'msgData', type: 'textarea' },
      { name: 'msgType', type: 'text', defaultValue: 'personal', placeholder: 'personal | typed_data' },
      { name: 'vaultJson', type: 'textarea' },
      { name: 'authInput', type: 'password' },
      { name: 'authType', type: 'text', defaultValue: 'password' },
      { name: 'indexN', type: 'number', defaultValue: '0' },
    ],
    call: v =>
      CryptoSDK.signMessageSecure({
        chain: v.chain,
        msgData: v.msgData,
        msgType: v.msgType,
        vaultJson: v.vaultJson,
        authInput: v.authInput,
        authType: v.authType,
        indexN: num(v.indexN),
      }),
  },
  {
    name: 'CryptoSDK.hashTypedDataV4',
    description: 'Compute EIP-712 typed-data v4 hash.',
    signature: 'CryptoSDK.hashTypedDataV4(typedDataJson)',
    fields: [{ name: 'typedDataJson', type: 'textarea' }],
    call: v => CryptoSDK.hashTypedDataV4(v.typedDataJson),
  },
  {
    name: 'CryptoSDK.freeGlobalSession',
    description: 'Tear down the global wasm session. Returns void.',
    signature: 'CryptoSDK.freeGlobalSession(): void',
    fields: [],
    call: () => {
      CryptoSDK.freeGlobalSession();
      return '(void)';
    },
  },
];

const RAW_SDK_FNS: SdkFn[] = [
  {
    name: 'utilEncryptString',
    description: 'Generic packed-data encryption.',
    signature: 'utilEncryptString(text, password)',
    fields: [
      { name: 'text', type: 'textarea' },
      { name: 'password', type: 'password' },
    ],
    call: v => sdk.utilEncryptString(v.text, v.password),
  },
  {
    name: 'utilDecryptString',
    description: 'Inverse of utilEncryptString.',
    signature: 'utilDecryptString(packed_data, password)',
    fields: [
      { name: 'packed_data', type: 'textarea' },
      { name: 'password', type: 'password' },
    ],
    call: v => sdk.utilDecryptString(v.packed_data, v.password),
  },
  {
    name: 'encrypt',
    description: 'Encrypt plaintext into a vault JSON envelope.',
    signature: 'encrypt(normal_text, password)',
    fields: [
      { name: 'normal_text', type: 'textarea' },
      { name: 'password', type: 'password' },
    ],
    call: v => sdk.encrypt(v.normal_text, v.password),
  },
  {
    name: 'decrypt',
    description: 'Decrypt a vault JSON envelope back to plaintext.',
    signature: 'decrypt(enc_envelope, password)',
    fields: [
      { name: 'enc_envelope', type: 'textarea' },
      { name: 'password', type: 'password' },
    ],
    call: v => sdk.decrypt(v.enc_envelope, v.password),
  },
  {
    name: 'changePassword',
    description: 'Re-encrypt a vault envelope with a new password (camelCase binding).',
    signature: 'changePassword(enc_envelope, old_password, new_password)',
    fields: [
      { name: 'enc_envelope', type: 'textarea' },
      { name: 'old_password', type: 'password' },
      { name: 'new_password', type: 'password' },
    ],
    call: v => sdk.changePassword(v.enc_envelope, v.old_password, v.new_password),
  },
  {
    name: 'generateAddressFromXpub',
    description: 'camelCase wbindgen binding.',
    signature: 'generateAddressFromXpub(xpub_eth, xpub_tron, xpub_btc, mnemonic?, index, chain_id?)',
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
        v.chain_id.trim() === '' ? null : BigInt(v.chain_id),
      ),
  },
  {
    name: 'generateMnemonic',
    description: 'camelCase binding.',
    signature: 'generateMnemonic(): string',
    fields: [],
    call: () => sdk.generateMnemonic(),
  },
  {
    name: 'createNewVault',
    description: 'Random-mnemonic vault creation (camelCase binding).',
    signature: 'createNewVault(password, biometric_key?, biometric_id?, biometric_label?)',
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
    name: 'verifyPassword',
    description: 'Validate a password against a vault.',
    signature: 'verifyPassword(vault_json, password)',
    fields: [
      { name: 'vault_json', type: 'textarea' },
      { name: 'password', type: 'password' },
    ],
    call: v => sdk.verifyPassword(v.vault_json, v.password),
  },
  {
    name: 'createDeterministicWalletId',
    description: 'Derive a deterministic wallet id.',
    signature: 'createDeterministicWalletId(input_data)',
    fields: [{ name: 'input_data', type: 'textarea' }],
    call: v => sdk.createDeterministicWalletId(v.input_data),
  },
  {
    name: 'createAppKeystore',
    description: 'Create an app keystore for session-based unlock.',
    signature: 'createAppKeystore(password)',
    fields: [{ name: 'password', type: 'password' }],
    call: v => sdk.createAppKeystore(v.password),
  },
];

export const SECTIONS: SdkSection[] = [
  {
    title: 'CryptoSDK helpers',
    blurb: 'wallet_* C-FFI exports wrapped by src/CryptoSDK.ts — the surface the production app uses.',
    fns: CRYPTO_SDK_FNS,
  },
  {
    title: 'Direct camelCase bindings',
    blurb: 'rust_wallet_sdk.js wbindgen exports for side-by-side comparison.',
    fns: RAW_SDK_FNS,
  },
];
