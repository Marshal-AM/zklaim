import nacl from "tweetnacl";
import { decodeBase64, encodeBase64 } from "tweetnacl-util";

function u8(data: Uint8Array | Buffer): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

/** Insurer selective-disclosure envelope (NaCl box). */
export interface InsurerViewEnvelope {
  ephemeralPublicKey: string;
  nonce: string;
  ciphertext: string;
}

/** Encrypt claim JSON for insurer view-key recovery (MVP selective disclosure). */
export function encryptForInsurerView(
  plaintextJson: string,
  insurerViewPublicKeyBase64: string,
): InsurerViewEnvelope {
  const insurerPub = u8(decodeBase64(insurerViewPublicKeyBase64));
  if (insurerPub.length !== nacl.box.publicKeyLength) {
    throw new Error("Invalid insurer view public key length");
  }
  const ephemeral = nacl.box.keyPair();
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const message = u8(new TextEncoder().encode(plaintextJson));
  const ciphertext = nacl.box(message, nonce, insurerPub, ephemeral.secretKey);
  return {
    ephemeralPublicKey: encodeBase64(ephemeral.publicKey),
    nonce: encodeBase64(nonce),
    ciphertext: encodeBase64(ciphertext),
  };
}

/** Decrypt insurer view envelope (demo / audit tooling). */
export function decryptInsurerView(
  envelope: InsurerViewEnvelope,
  insurerViewSecretKeyBase64: string,
): string {
  const secretKey = u8(decodeBase64(insurerViewSecretKeyBase64));
  const keyPair = nacl.box.keyPair.fromSecretKey(secretKey);
  const opened = nacl.box.open(
    u8(decodeBase64(envelope.ciphertext)),
    u8(decodeBase64(envelope.nonce)),
    u8(decodeBase64(envelope.ephemeralPublicKey)),
    keyPair.secretKey,
  );
  if (!opened) {
    throw new Error("Failed to decrypt insurer view envelope");
  }
  return new TextDecoder().decode(opened);
}
