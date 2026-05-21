/* tslint:disable */
/* eslint-disable */
/**
 * Encrypt: Turns text (Mnemonic) -> Vault JSON
 */
export function encrypt(normal_text: string, password: string): string;
export function verifyPassword(vault_json: string, password: string): string;
export function generateAddressFromXpub(xpub_eth: string, xpub_tron: string, xpub_btc: string, mnemonic: string | null | undefined, index: number, chain_id?: bigint | null): string;
export function verifyAddress(chain: string, address: string): string;
export function utilEncryptString(text: string, password: string): string;
/**
 * Secure Sign Transaction (Unified)
 */
export function signTxSecure(chain: string, tx_data: string, vault_json: string, auth_input: string, auth_type: string, index_n: number, tx_fields?: string | null): string;
export function createDeterministicWalletId(input_data: string): string;
export function utilDecryptString(packed_data: string, password: string): string;
/**
 * Decrypt: Turns Vault JSON -> Text (Mnemonic)
 */
export function decrypt(enc_envelope: string, password: string, auth_type: string): string;
/**
 * Secure Sign Message (Personal / TypedData)
 */
export function signMessageSecure(chain: string, msg_data: string, msg_type: string, vault_json: string, auth_input: string, auth_type: string, index_n: number): string;
export function generateMnemonic(): string;
/**
 * Create NEW Vault (Random Mnemonic)
 *
 * Optionally accepts biometric information to add biometric access during creation.
 * If biometric_key, biometric_id, and biometric_label are all provided, biometric access will be added.
 */
export function createNewVault(password: string, biometric_key?: string | null): string;
/**
 * Change Password: Re-encrypts master key with new password
 */
export function changePassword(enc_envelope: string, old_password: string, new_password: string): string;
/**
 * Derive all supported chain addresses from an existing vault (migration helper).
 * auth_type accepts "password" or a biometric method id; auth_input is the corresponding secret.
 */
export function migrateVaultAddresses(vault_json: string, auth_input: string, auth_type: string): string;
/**
 * Import Vault from Mnemonic
 *
 * Optionally accepts biometric information to add biometric access during creation.
 * If biometric_key, biometric_id, and biometric_label are all provided, biometric access will be added.
 */
export function createWalletFromMnemonic(mnemonic: string, password: string, biometric_key?: string | null): string;
