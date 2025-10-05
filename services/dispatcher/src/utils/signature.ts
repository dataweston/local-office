import crypto from 'crypto';

export interface HmacSignatureOptions {
  payload: string;
  secret: string;
  signature: string;
  algorithm?: string;
  encoding?: crypto.BinaryToTextEncoding;
}

export function verifyHmacSignature(options: HmacSignatureOptions): boolean {
  const digest = createHmacDigest({
    payload: options.payload,
    secret: options.secret,
    algorithm: options.algorithm,
    encoding: options.encoding
  });

  const expected = Buffer.from(digest, options.encoding ?? 'hex');
  const received = Buffer.from(options.signature, options.encoding ?? 'hex');

  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, received);
}

export function assertValidHmacSignature(options: HmacSignatureOptions): void {
  if (!verifyHmacSignature(options)) {
    throw new Error('Invalid webhook signature');
  }
}

export function createHmacDigest(options: {
  payload: string;
  secret: string;
  algorithm?: string;
  encoding?: crypto.BinaryToTextEncoding;
}): string {
  const algorithm = options.algorithm ?? 'sha256';
  const encoding = options.encoding ?? 'hex';

  return crypto.createHmac(algorithm, options.secret).update(options.payload, 'utf8').digest(encoding);
}
