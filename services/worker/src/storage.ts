import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { S3 } from 'aws-sdk';

export interface ObjectStorageUpload {
  key: string;
  body: Buffer | string;
  contentType: string;
}

export interface ObjectStorageClient {
  upload(params: ObjectStorageUpload): Promise<string>;
}

class FileSystemStorage implements ObjectStorageClient {
  constructor(private readonly directory: string, private readonly publicBaseUrl: string) {}

  async upload({ key, body }: ObjectStorageUpload): Promise<string> {
    const targetPath = path.join(this.directory, key);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    const data = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
    await fs.writeFile(targetPath, data);
    return new URL(encodeURI(key), this.publicBaseUrl.endsWith('/') ? this.publicBaseUrl : `${this.publicBaseUrl}/`).toString();
  }
}

class S3ObjectStorage implements ObjectStorageClient {
  constructor(private readonly s3: S3, private readonly bucket: string, private readonly publicBaseUrl?: string) {}

  async upload({ key, body, contentType }: ObjectStorageUpload): Promise<string> {
    const result = await this.s3
      .upload({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType
      })
      .promise();

    if (this.publicBaseUrl) {
      return new URL(key, this.publicBaseUrl.endsWith('/') ? this.publicBaseUrl : `${this.publicBaseUrl}/`).toString();
    }

    if (result.Location) {
      return result.Location;
    }

    const region = this.s3.config.region ?? process.env.AWS_REGION ?? 'us-east-1';
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }
}

export function createObjectStorage(): ObjectStorageClient {
  const configuredDir = process.env.OBJECT_STORAGE_DIR;
  const publicBaseUrl = process.env.OBJECT_STORAGE_PUBLIC_URL ?? 'https://example.com/';

  if (configuredDir) {
    return new FileSystemStorage(configuredDir, publicBaseUrl);
  }

  const bucket = process.env.OBJECT_STORAGE_BUCKET;

  if (!bucket) {
    const fallbackDir = path.join(process.cwd(), '.object-storage');
    return new FileSystemStorage(fallbackDir, publicBaseUrl);
  }

  const region = process.env.AWS_REGION ?? 'us-east-1';
  const endpoint = process.env.OBJECT_STORAGE_ENDPOINT;
  const accessKeyId = process.env.OBJECT_STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.OBJECT_STORAGE_SECRET_ACCESS_KEY;

  const s3 = new S3({
    region,
    endpoint,
    s3ForcePathStyle: Boolean(endpoint),
    accessKeyId,
    secretAccessKey
  });

  return new S3ObjectStorage(s3, bucket, publicBaseUrl);
}

export function buildObjectKey(batchId: string, extension: string, now: () => Date = () => new Date()): string {
  const timestamp = now().toISOString().replace(/[:.]/g, '-');
  return path.posix.join('labels', batchId, `${timestamp}-${randomUUID()}.${extension}`);
}
