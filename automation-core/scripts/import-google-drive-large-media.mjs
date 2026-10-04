#!/usr/bin/env node

import { createHash, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const MIB = 1024 * 1024;
const MAX_PARTS = 10000;
const DEFAULT_PART_BYTES = 64 * MIB;

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function safeFileName(value) {
  return basename(value || "media.bin")
    .normalize("NFKC")
    .replace(/[\\/]/g, "_")
    .replace(/[^\p{L}\p{N}._ -]+/gu, "_")
    .replace(/\s+/g, "_")
    .slice(0, 180);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key, value) {
  return createHmac("sha256", key).update(value).digest();
}

function encodeKey(key) {
  if (!key || key.startsWith("/") || key.includes("..")) {
    throw new Error("Unsafe object key");
  }
  return key.split("/").map(encodeURIComponent).join("/");
}

function encodeQuery(value) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

class PrivateObjectStorage {
  constructor() {
    this.bucket = requiredEnv("SMILE_AI_AUTOMATION_BUCKET");
    this.region = requiredEnv("SMILE_AI_AUTOMATION_REGION");
    this.accessKeyId = requiredEnv("SMILE_AI_AUTOMATION_ACCESS_KEY_ID");
    this.secretAccessKey = requiredEnv("SMILE_AI_AUTOMATION_SECRET_ACCESS_KEY");
    const endpoint = process.env.SMILE_AI_AUTOMATION_S3_ENDPOINT?.trim();
    this.endpoint = endpoint ? new URL(endpoint) : null;
    if (this.endpoint && this.endpoint.protocol !== "https:") {
      throw new Error("SMILE_AI_AUTOMATION_S3_ENDPOINT must use HTTPS");
    }
  }

  resolveTarget(key) {
    const encodedKey = encodeKey(key);
    if (!this.endpoint) {
      const host = `${this.bucket}.s3.${this.region}.amazonaws.com`;
      return {
        host,
        canonicalUri: `/${encodedKey}`,
        requestUrl: `https://${host}/${encodedKey}`,
      };
    }
    const basePath = this.endpoint.pathname.replace(/\/+$/, "");
    const canonicalUri = `${basePath}/${encodeURIComponent(this.bucket)}/${encodedKey}`;
    return {
      host: this.endpoint.host,
      canonicalUri,
      requestUrl: `${this.endpoint.origin}${canonicalUri}`,
    };
  }

  sign(date, stringToSign) {
    const dateKey = hmac(`AWS4${this.secretAccessKey}`, date);
    const regionKey = hmac(dateKey, this.region);
    const serviceKey = hmac(regionKey, "s3");
    const signingKey = hmac(serviceKey, "aws4_request");
    return createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  }

  async request(method, key, query = {}, body = Buffer.alloc(0), contentType) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const date = amzDate.slice(0, 8);
    const target = this.resolveTarget(key);
    const payloadHash = sha256(body);
    const headers = new Headers({
      host: target.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    });
    if (contentType) headers.set("content-type", contentType);

    const signedHeaderNames = [...headers.keys()].sort();
    const canonicalHeaders = signedHeaderNames
      .map((name) => `${name}:${headers.get(name)?.trim()}\n`)
      .join("");
    const signedHeaders = signedHeaderNames.join(";");
    const canonicalQuery = Object.entries(query)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => `${encodeQuery(name)}=${encodeQuery(String(value))}`)
      .join("&");

    const canonicalRequest = [
      method,
      target.canonicalUri,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const scope = `${date}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      sha256(canonicalRequest),
    ].join("\n");
    headers.set(
      "authorization",
      `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${this.sign(date, stringToSign)}`,
    );

    const url = canonicalQuery
      ? `${target.requestUrl}?${canonicalQuery}`
      : target.requestUrl;

    const response = await fetch(url, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : body,
    });

    if (response.status === 404) return response;
    if (!response.ok) {
      throw new Error(
        `Object storage request failed: ${method} ${response.status} ${(await response.text()).slice(0, 500)}`,
      );
    }
    return response;
  }

  async exists(key) {
    return (await this.request("HEAD", key)).status !== 404;
  }

  async getJson(key) {
    const response = await this.request("GET", key);
    if (response.status === 404) return null;
    return JSON.parse(await response.text());
  }

  async putJson(key, value) {
    await this.request(
      "PUT",
      key,
      {},
      Buffer.from(JSON.stringify(value, null, 2)),
      "application/json",
    );
  }

  async initiate(key, contentType) {
    const response = await this.request(
      "POST",
      key,
      { uploads: "" },
      Buffer.alloc(0),
      contentType,
    );
    const xml = await response.text();
    const match = xml.match(/<UploadId>([\s\S]*?)<\/UploadId>/u);
    if (!match) throw new Error("Multipart init did not return UploadId");
    return match[1].trim()
      .replaceAll("&amp;", "&")
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">");
  }

  async uploadPart(key, uploadId, partNumber, bytes) {
    const response = await this.request(
      "PUT",
      key,
      { partNumber: String(partNumber), uploadId },
      bytes,
    );
    const etag = response.headers.get("etag")?.replace(/^"|"$/g, "");
    if (!etag) throw new Error(`Part ${partNumber} missing ETag`);
    return etag;
  }

  async complete(key, uploadId, parts) {
    const xml = Buffer.from(
      "<CompleteMultipartUpload>" +
        [...parts]
          .sort((a, b) => a.partNumber - b.partNumber)
          .map(
            (part) =>
              `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>"${part.etag}"</ETag></Part>`,
          )
          .join("") +
        "</CompleteMultipartUpload>",
    );
    await this.request(
      "POST",
      key,
      { uploadId },
      xml,
      "application/xml",
    );
  }
}

async function driveMetadata(fileId, token) {
  const fields = "id,name,size,mimeType,md5Checksum,modifiedTime";
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}&supportsAllDrives=true`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    throw new Error(`Drive metadata failed: ${response.status}`);
  }
  const metadata = await response.json();
  const sizeBytes = Number(metadata.size);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes <= 0) {
    throw new Error("Drive file size is invalid");
  }
  return { ...metadata, sizeBytes };
}

async function driveRange(fileId, token, start, end) {
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
    {
      headers: {
        authorization: `Bearer ${token}`,
        range: `bytes=${start}-${end}`,
      },
    },
  );
  if (response.status !== 206) {
    throw new Error(
      `Drive range import requires HTTP 206, received ${response.status}`,
    );
  }
  const contentRange = response.headers.get("content-range");
  if (!contentRange?.startsWith(`bytes ${start}-${end}/`)) {
    throw new Error("Drive Content-Range mismatch");
  }
  return Buffer.from(await response.arrayBuffer());
}

function planParts(sizeBytes) {
  const minimum = Math.ceil(sizeBytes / MAX_PARTS);
  const partSizeBytes = Math.max(
    DEFAULT_PART_BYTES,
    Math.ceil(minimum / MIB) * MIB,
  );
  return {
    partSizeBytes,
    partCount: Math.ceil(sizeBytes / partSizeBytes),
  };
}

async function importDriveMaster(file) {
  const token = requiredEnv("SMILE_AI_AUTOMATION_GOOGLE_DRIVE_ACCESS_TOKEN");
  const storage = new PrivateObjectStorage();
  const metadata = await driveMetadata(file.fileId, token);
  if (metadata.sizeBytes !== file.sizeBytes) {
    throw new Error(
      `Source size changed for ${file.fileId}; refusing stale manifest import`,
    );
  }

  const objectKey =
    file.objectKey ||
    `automation/master/google-drive/${file.fileId}/${safeFileName(metadata.name)}`;
  const checkpointKey =
    `automation/checkpoints/google-drive/${file.fileId}.json`;
  let checkpoint = await storage.getJson(checkpointKey);

  if (checkpoint?.state === "MASTER_STORED" && (await storage.exists(objectKey))) {
    return checkpoint;
  }

  if (!checkpoint) {
    const plan = planParts(metadata.sizeBytes);
    checkpoint = {
      contract: "SMILE_AI_GROUP_LARGE_MEDIA_INGEST_V1",
      owner: "SMILE_AI_GROUP",
      fileId: file.fileId,
      objectKey,
      originalName: metadata.name,
      sourceSizeBytes: metadata.sizeBytes,
      sourceMd5: metadata.md5Checksum || null,
      partSizeBytes: plan.partSizeBytes,
      partCount: plan.partCount,
      uploadId: await storage.initiate(
        objectKey,
        metadata.mimeType || "application/octet-stream",
      ),
      completedParts: [],
      state: "MASTER_INGESTING",
      updatedAt: new Date().toISOString(),
    };
    await storage.putJson(checkpointKey, checkpoint);
  }

  if (
    checkpoint.sourceSizeBytes !== metadata.sizeBytes ||
    checkpoint.sourceMd5 !== (metadata.md5Checksum || null)
  ) {
    throw new Error("Checkpoint/source revision mismatch");
  }

  const completed = new Set(
    checkpoint.completedParts.map((part) => part.partNumber),
  );

  for (let partNumber = 1; partNumber <= checkpoint.partCount; partNumber += 1) {
    if (completed.has(partNumber)) continue;

    const start = (partNumber - 1) * checkpoint.partSizeBytes;
    const end = Math.min(
      metadata.sizeBytes - 1,
      start + checkpoint.partSizeBytes - 1,
    );
    const bytes = await driveRange(file.fileId, token, start, end);
    if (bytes.length !== end - start + 1) {
      throw new Error(`Unexpected byte count for part ${partNumber}`);
    }

    const etag = await storage.uploadPart(
      objectKey,
      checkpoint.uploadId,
      partNumber,
      bytes,
    );
    checkpoint.completedParts.push({
      partNumber,
      start,
      end,
      sizeBytes: bytes.length,
      sha256: sha256(bytes),
      etag,
    });
    checkpoint.updatedAt = new Date().toISOString();
    await storage.putJson(checkpointKey, checkpoint);
    process.stdout.write(
      `[${file.fileId}] part ${partNumber}/${checkpoint.partCount} stored\n`,
    );
  }

  if (!(await storage.exists(objectKey))) {
    await storage.complete(
      objectKey,
      checkpoint.uploadId,
      checkpoint.completedParts,
    );
  }
  if (!(await storage.exists(objectKey))) {
    throw new Error("Completed multipart upload is not readable");
  }

  checkpoint.state = "MASTER_STORED";
  checkpoint.completedAt = new Date().toISOString();
  checkpoint.updatedAt = checkpoint.completedAt;
  await storage.putJson(checkpointKey, checkpoint);
  await storage.putJson(`${objectKey}.ingest.json`, {
    owner: "SMILE_AI_GROUP",
    sourceProvider: "GOOGLE_DRIVE",
    sourceFileId: file.fileId,
    sourceName: metadata.name,
    sourceSizeBytes: metadata.sizeBytes,
    masterObjectKey: objectKey,
    immutableMaster: true,
    customerManualSplit: false,
    completedAt: checkpoint.completedAt,
  });

  return checkpoint;
}

async function main() {
  const args = process.argv.slice(2);
  const manifestIndex = args.indexOf("--manifest");
  if (manifestIndex < 0 || !args[manifestIndex + 1]) {
    throw new Error("Use --manifest <path>");
  }
  const onlyPending = args.includes("--only-pending");
  const manifest = JSON.parse(
    await readFile(args[manifestIndex + 1], "utf8"),
  );
  if (manifest.owner !== "SMILE_AI_GROUP") {
    throw new Error("Manifest owner must be SMILE_AI_GROUP");
  }

  const files = onlyPending
    ? manifest.files.filter(
        (file) => file.goldStatus === "PENDING_GROUP_CORE_ANALYSIS",
      )
    : manifest.files;

  const results = [];
  for (const file of files) {
    results.push(await importDriveMaster(file));
  }
  process.stdout.write(
    JSON.stringify({ imported: results.length, results }, null, 2) + "\n",
  );
}

main().catch((error) => {
  process.stderr.write(
    `SMILE AI GROUP large-media ingest failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
