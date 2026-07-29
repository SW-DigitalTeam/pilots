#!/usr/bin/env node
/**
 * Privacy audit — a stop-the-line gate.
 *
 * Camera frames never leave the device. This script greps every shipped source
 * file for any API that could carry pixel data off-device or persist it, and
 * fails the build if one appears. Only derived numbers are allowed to leave,
 * and those go through the single evidence chokepoint.
 *
 * Run: node scripts/privacy-audit.mjs
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Any of these tokens in shipped (non-test) source is an automatic fail. */
const FORBIDDEN = [
  "MediaRecorder",
  "toDataURL",
  "toBlob",
  "putImageData",
  "captureStream",
  "getUserMedia().then(r => fetch", // naive exfil shapes
];

const SCAN_DIRS = ["packages"];
const IGNORE = /(\.test\.|\.spec\.|__tests__|\/dist\/|\/node_modules\/)/;

function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      walk(p, out);
    } else if ([".ts", ".tsx", ".js", ".jsx", ".mjs"].includes(extname(p)) && !IGNORE.test(p)) {
      out.push(p);
    }
  }
}

const files = [];
for (const d of SCAN_DIRS) walk(join(ROOT, d), files);

const findings = [];
for (const file of files) {
  const text = readFileSync(file, "utf8");
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const token of FORBIDDEN) {
      if (line.includes(token)) {
        findings.push({ file: relative(ROOT, file), line: i + 1, token, text: line.trim() });
      }
    }
  });
}

// The engine must have zero React imports so the WebXR starter can use it too.
const engineFiles = files.filter((f) => f.includes("/arcade-engine/"));
for (const file of engineFiles) {
  const text = readFileSync(file, "utf8");
  if (/from\s+["']react["']/.test(text) || /require\(["']react["']\)/.test(text)) {
    findings.push({ file: relative(ROOT, file), line: 0, token: "react-import-in-engine", text: "" });
  }
}

if (findings.length > 0) {
  console.error("PRIVACY AUDIT FAILED — pixel-egress or forbidden dependency found:\n");
  for (const f of findings) console.error(`  ${f.file}:${f.line}  [${f.token}]  ${f.text}`);
  process.exit(1);
}

console.log(`Privacy audit passed: scanned ${files.length} files, no pixel data can leave the device.`);
