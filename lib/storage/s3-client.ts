import { Client } from "minio";

import { env } from "@/lib/config/env";

declare global {
  var __s3Client: Client | undefined;
}

function parseEndpoint(url: string): { endPoint: string; port: number; useSSL: boolean } {
  const parsed = new URL(url);
  const useSSL = parsed.protocol === "https:";
  const defaultPort = useSSL ? 443 : 80;
  const port = parsed.port ? Number(parsed.port) : defaultPort;
  return { endPoint: parsed.hostname, port, useSSL };
}

export function s3(): Client {
  if (globalThis.__s3Client) return globalThis.__s3Client;
  const e = env();
  const { endPoint, port, useSSL } = parseEndpoint(e.S3_ENDPOINT);
  globalThis.__s3Client = new Client({
    endPoint,
    port,
    useSSL,
    accessKey: e.S3_ACCESS_KEY,
    secretKey: e.S3_SECRET_KEY,
  });
  return globalThis.__s3Client;
}

export function bucket(): string {
  return env().S3_BUCKET;
}

export function publicUrlFor(key: string): string {
  const e = env();
  const base = e.S3_PUBLIC_URL_BASE ?? `${e.S3_ENDPOINT.replace(/\/$/, "")}/${e.S3_BUCKET}`;
  return `${base.replace(/\/$/, "")}/${key}`;
}

export async function ensureBucket(): Promise<void> {
  const b = bucket();
  const exists = await s3().bucketExists(b).catch(() => false);
  if (!exists) {
    await s3().makeBucket(b, "us-east-1");
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
    await s3().setBucketPolicy(b, JSON.stringify(policy));
  } catch {
    // policy may already be set; ignore
  }
}

export async function putLogo(key: string, buf: Buffer): Promise<void> {
  await ensureBucket();
  await s3().putObject(bucket(), key, buf, buf.length, {
    "Content-Type": "image/png",
    "Cache-Control": "public, max-age=31536000, immutable",
  });
}

export async function deleteLogo(key: string): Promise<void> {
  await s3().removeObject(bucket(), key);
}

export function objectKeyFromUrl(url: string | null): string | null {
  if (!url) return null;
  const e = env();
  const base = e.S3_PUBLIC_URL_BASE ?? `${e.S3_ENDPOINT.replace(/\/$/, "")}/${e.S3_BUCKET}`;
  const normalized = base.replace(/\/$/, "");
  if (!url.startsWith(normalized + "/")) return null;
  return url.slice(normalized.length + 1);
}
