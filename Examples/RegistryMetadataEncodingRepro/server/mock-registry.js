#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");

const host = process.env.REGISTRY_HOST || "127.0.0.1";
const port = Number(process.env.REGISTRY_PORT || "8123");
const mode = process.env.REGISTRY_MODE || "passthrough";
const rootDir = process.env.REGISTRY_ROOT_DIR || path.join(process.cwd(), ".tmp");
const storeDir = path.join(rootDir, "registry-store");
const captureDir = path.join(rootDir, "captures");

fs.mkdirSync(storeDir, { recursive: true });
fs.mkdirSync(captureDir, { recursive: true });

function send(res, statusCode, headers, body) {
  res.writeHead(statusCode, headers);
  res.end(body);
}

function headers(contentType) {
  return { "Content-Version": "1", "Content-Type": contentType };
}

function packageDir(scope, name, version) {
  return path.join(storeDir, scope, name, version);
}

function parseBoundary(contentType) {
  const match = /boundary="?([^";]+)"?/i.exec(contentType || "");
  return match ? match[1] : null;
}

function parseHeaders(headerText) {
  const result = {};
  for (const line of headerText.split("\r\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    result[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return result;
}

function getFormName(disposition) {
  const match = /name="([^"]+)"/i.exec(disposition || "");
  return match ? match[1] : null;
}

function splitMultipart(buffer, boundary) {
  const marker = Buffer.from(`--${boundary}`);
  const parts = [];
  let cursor = 0;
  while (true) {
    const start = buffer.indexOf(marker, cursor);
    if (start === -1) break;
    let bodyStart = start + marker.length;
    if (buffer.slice(bodyStart, bodyStart + 2).equals(Buffer.from("--"))) break;
    if (buffer.slice(bodyStart, bodyStart + 2).equals(Buffer.from("\r\n"))) bodyStart += 2;
    const next = buffer.indexOf(marker, bodyStart);
    if (next === -1) break;
    let part = buffer.slice(bodyStart, next);
    if (part.slice(-2).equals(Buffer.from("\r\n"))) part = part.slice(0, -2);
    parts.push(part);
    cursor = next;
  }
  return parts;
}

function parseMultipart(buffer, boundary) {
  return splitMultipart(buffer, boundary).map((part) => {
    const headerSep = Buffer.from("\r\n\r\n");
    const headerEnd = part.indexOf(headerSep);
    const headersText = part.slice(0, headerEnd).toString("utf8");
    const body = part.slice(headerEnd + headerSep.length);
    const parsedHeaders = parseHeaders(headersText);
    return { headers: parsedHeaders, name: getFormName(parsedHeaders["content-disposition"]), body };
  });
}

function maybeCorruptMetadata(buffer, parsedHeaders) {
  const encoding = (parsedHeaders["content-transfer-encoding"] || "").toLowerCase();
  if (mode !== "truncate-non-ascii-when-quoted-printable" || encoding !== "quoted-printable") {
    return buffer;
  }
  for (let index = 0; index < buffer.length; index += 1) {
    if (buffer[index] > 0x7f) return buffer.slice(0, index);
  }
  return buffer;
}

function extractManifest(zipPath, destinationDir) {
  fs.mkdirSync(destinationDir, { recursive: true });
  childProcess.execFileSync("unzip", ["-q", zipPath, "-d", destinationDir]);
  const topLevel = fs.readdirSync(destinationDir);
  const packageRoot = path.join(destinationDir, topLevel[0]);
  return fs.readFileSync(path.join(packageRoot, "Package.swift"));
}

function handlePublish(req, res, scope, name, version, body) {
  const boundary = parseBoundary(req.headers["content-type"]);
  const parts = parseMultipart(body, boundary);
  const byName = Object.fromEntries(parts.map((part) => [part.name, part]));

  const versionDir = packageDir(scope, name, version);
  fs.mkdirSync(versionDir, { recursive: true });

  const zipPath = path.join(versionDir, "source.zip");
  const metadataPath = path.join(versionDir, "metadata.json.raw");
  const extractDir = path.join(versionDir, "extract");
  const capturePath = path.join(captureDir, `${scope}.${name}-${version}.json`);

  fs.writeFileSync(zipPath, byName["source-archive"].body);
  if (byName["metadata"]) {
    const metadataBody = maybeCorruptMetadata(byName["metadata"].body, byName["metadata"].headers);
    fs.writeFileSync(metadataPath, metadataBody);
    fs.writeFileSync(capturePath, JSON.stringify({
      mode,
      requestHeaders: req.headers,
      metadataHeaders: byName["metadata"].headers,
      metadataUtf8: metadataBody.toString("utf8"),
      metadataHex: metadataBody.toString("hex"),
    }, null, 2));
  }

  fs.writeFileSync(path.join(versionDir, "Package.swift"), extractManifest(zipPath, extractDir));
  send(res, 201, { "Content-Version": "1", Location: `http://${host}:${port}/${scope}/${name}/${version}` });
}

function handlePackageMetadata(res, scope, name) {
  const dir = path.join(storeDir, scope, name);
  if (!fs.existsSync(dir)) return send(res, 404, headers("application/json"), Buffer.from('{"detail":"not found"}'));
  const releases = {};
  for (const version of fs.readdirSync(dir).sort()) {
    releases[version] = { url: `http://${host}:${port}/${scope}/${name}/${version}` };
  }
  send(res, 200, headers("application/json"), Buffer.from(JSON.stringify({ releases }, null, 2)));
}

function handleVersionMetadata(res, scope, name, version) {
  const versionDir = packageDir(scope, name, version);
  const zipPath = path.join(versionDir, "source.zip");
  const metadataPath = path.join(versionDir, "metadata.json.raw");
  if (!fs.existsSync(zipPath)) return send(res, 404, headers("application/json"), Buffer.from('{"detail":"not found"}'));
  const checksum = crypto.createHash("sha256").update(fs.readFileSync(zipPath)).digest("hex");
  const pieces = [];
  pieces.push(Buffer.from("{\n"));
  pieces.push(Buffer.from(`  "id": "${scope}.${name}",\n`));
  pieces.push(Buffer.from(`  "version": "${version}",\n`));
  pieces.push(Buffer.from(`  "resources": [\n    {\n      "name": "source-archive",\n      "type": "application/zip",\n      "checksum": "${checksum}"\n    }\n  ],\n`));
  pieces.push(Buffer.from('  "publishedAt": "2026-01-01T00:00:00Z"'));
  if (fs.existsSync(metadataPath)) {
    pieces.push(Buffer.from(',\n  "metadata": '));
    pieces.push(fs.readFileSync(metadataPath));
  } else {
    pieces.push(Buffer.from(',\n  "metadata": null'));
  }
  pieces.push(Buffer.from("\n}\n"));
  send(res, 200, headers("application/json"), Buffer.concat(pieces));
}

function handleManifest(res, scope, name, version) {
  const manifestPath = path.join(packageDir(scope, name, version), "Package.swift");
  if (!fs.existsSync(manifestPath)) return send(res, 404, headers("application/json"), Buffer.from('{"detail":"not found"}'));
  send(res, 200, headers("text/x-swift"), fs.readFileSync(manifestPath));
}

function handleZip(res, scope, name, version) {
  const zipPath = path.join(packageDir(scope, name, version), "source.zip");
  if (!fs.existsSync(zipPath)) return send(res, 404, headers("application/json"), Buffer.from('{"detail":"not found"}'));
  send(res, 200, headers("application/zip"), fs.readFileSync(zipPath));
}

http.createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(chunks);
    const url = new URL(req.url, `http://${req.headers.host}`);
    const parts = url.pathname.split("/").filter(Boolean);
    try {
      if (req.method === "GET" && parts.length === 1 && parts[0] === "availability") return send(res, 200, headers("application/json"), Buffer.from("{}\n"));
      if (req.method === "PUT" && parts.length === 3) return handlePublish(req, res, parts[0], parts[1], parts[2], body);
      if (req.method === "GET" && parts.length === 2) return handlePackageMetadata(res, parts[0], parts[1]);
      if (req.method === "GET" && parts.length === 4 && parts[3] === "Package.swift") return handleManifest(res, parts[0], parts[1], parts[2]);
      if (req.method === "GET" && parts.length === 3 && parts[2].endsWith(".zip")) return handleZip(res, parts[0], parts[1], parts[2].slice(0, -4));
      if (req.method === "GET" && parts.length === 3) return handleVersionMetadata(res, parts[0], parts[1], parts[2]);
      send(res, 404, headers("application/json"), Buffer.from('{"detail":"unknown route"}'));
    } catch (error) {
      send(res, 500, headers("application/json"), Buffer.from(JSON.stringify({ detail: String(error.stack || error) }, null, 2)));
    }
  });
}).listen(port, host);

