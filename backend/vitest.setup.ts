import { vi } from 'vitest';
import { generateKeyPairSync } from 'crypto';

process.env.KMS_KEY_ID = 'mock-kms-key-id-for-testing';

// Generate a dummy RSA keypair once for the mock
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'der' // KMS GetPublicKey returns DER
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

vi.mock('@aws-sdk/client-kms', () => {
  return {
    KMSClient: class {
      send(command: any) {
        if (command.constructor.name === 'GetPublicKeyCommand') {
          return Promise.resolve({
            PublicKey: publicKey // Uint8Array DER
          });
        }
        if (command.constructor.name === 'SignCommand') {
          // message is a Buffer/Uint8Array digest
          const { sign } = require('crypto');
          const signature = sign("sha256", command.input.Message, {
            key: privateKey,
            padding: require('crypto').constants.RSA_PKCS1_PSS_PADDING,
            saltLength: require('crypto').constants.RSA_PSS_SALTLEN_DIGEST,
          });
          return Promise.resolve({
            Signature: signature // Buffer/Uint8Array
          });
        }
        return Promise.resolve({});
      }
    },
    GetPublicKeyCommand: class {
      constructor(public input: any) {}
    },
    SignCommand: class {
      constructor(public input: any) {}
    },
    VerifyCommand: class {
      constructor(public input: any) {}
    }
  };
});
