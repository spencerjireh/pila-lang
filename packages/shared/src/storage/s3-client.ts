import {
  S3Client,
  HeadBucketCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import { env } from "../config/env";

declare global {
  var __s3Client: S3Client | undefined;
}

export function s3(): S3Client {
  if (globalThis.__s3Client) return globalThis.__s3Client;
  const e = env();
  globalThis.__s3Client = new S3Client({
    endpoint: e.S3_ENDPOINT,
    forcePathStyle: true,
    region: "us-east-1",
    credentials: {
      accessKeyId: e.S3_ACCESS_KEY,
      secretAccessKey: e.S3_SECRET_KEY,
    },
  });
  return globalThis.__s3Client;
}

export function bucket(): string {
  return env().S3_BUCKET;
}

export function publicUrlFor(key: string): string {
  const e = env();
  const base =
    e.S3_PUBLIC_URL_BASE ??
    `${e.S3_ENDPOINT.replace(/\/$/, "")}/${e.S3_BUCKET}`;
  return `${base.replace(/\/$/, "")}/${key}`;
}

function isMissingBucket(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === "NotFound" || e.$metadata?.httpStatusCode === 404;
}

export async function ensureBucket(): Promise<void> {
  const b = bucket();
  try {
    await s3().send(new HeadBucketCommand({ Bucket: b }));
  } catch (err) {
    if (!isMissingBucket(err)) throw err;
    await s3().send(new CreateBucketCommand({ Bucket: b }));
  }
  const policy = {
    Version: "2012-10-17",
    Statement: [
      {
        Effect: "Allow",
        Principal: { AWS: ["*"] },
        Action: ["s3:GetObject"],
        Resource: [`arn:aws:s3:::${b}/*`],
      },
    ],
  };
  try {
    await s3().send(
      new PutBucketPolicyCommand({
        Bucket: b,
        Policy: JSON.stringify(policy),
      }),
    );
  } catch {
    // Policy may already be set; RustFS alpha may also reject — the bucket is
    // already usable either way, so downstream GETs are served via direct URL.
  }
}

export async function putLogo(key: string, buf: Buffer): Promise<void> {
  await ensureBucket();
  await s3().send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: buf,
      ContentType: "image/png",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
}

export async function deleteLogo(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export function objectKeyFromUrl(url: string | null): string | null {
  if (!url) return null;
  const e = env();
  const base =
    e.S3_PUBLIC_URL_BASE ??
    `${e.S3_ENDPOINT.replace(/\/$/, "")}/${e.S3_BUCKET}`;
  const normalized = base.replace(/\/$/, "");
  if (!url.startsWith(normalized + "/")) return null;
  return url.slice(normalized.length + 1);
}
