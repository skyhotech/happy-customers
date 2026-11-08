#!/usr/bin/env node
/**
 * Asset audit for SKY Happy Customers.
 *
 * - Recursively scans "HAPPY CUSTOMERS/" (jpg/jpeg/png/webp/avif).
 * - Reads real pixel dimensions from the file headers (no external deps).
 * - Computes MD5 + byte size, flags exact and near duplicates.
 * - Merges the manual visual transcriptions in scripts/footer-transcriptions.json
 *   (addresses are NEVER guessed — an image without a transcription becomes
 *   "Unverified Location" and its template is not production-ready).
 * - Copies template images into public/assets/templates (never touches originals).
 * - Writes src/data/{branches,templates,asset-audit}.json
 *
 * Usage: node scripts/audit-assets.mjs
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { join, relative, extname, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'HAPPY CUSTOMERS');
const OUT_TEMPLATES = join(ROOT, 'public/assets/templates');
const DATA_DIR = join(ROOT, 'src/data');
const EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

/**
 * Default photo region for the "Dream Diwali" design (identical layout in every poster).
 *
 * Measured from pixels, not guessed: the inner edge of the gold arch frame was traced
 * row by row in headless Chromium (gold = r>170, r−b>90, g−b>35) on 36.jpg at half
 * resolution. Inner edge: apex y≈0.2445, straight sides x≈0.0722…0.9272 from y≈0.43,
 * lamp tiles start at y≈0.651. The region is inset ~20 px so the gold line stays visible.
 * The arch outline is an SVG path in region-unit coordinates (0–1 inside the region box).
 */
const DREAM_DIWALI_PLACEMENT = {
  x: 0.078,
  y: 0.2485,
  width: 0.844,
  height: 0.4065,
  rotation: 0,
  shape: 'path',
  cornerRadius: 0,
  path:
    'M0,1 L0,0.45 L0.0017,0.4372 L0.0077,0.4121 L0.0178,0.387 L0.036,0.368 L0.0468,0.3616 L0.0609,0.3555 L0.0953,0.3491 ' +
    'L0.0974,0.3112 L0.1068,0.2797 L0.1168,0.2546 L0.1371,0.2357 L0.1539,0.2231 L0.1667,0.2167 L0.1984,0.2106 L0.2153,0.2042 ' +
    'L0.22,0.1791 L0.2281,0.1538 L0.2402,0.1287 L0.2571,0.1036 L0.2737,0.0846 L0.295,0.0657 L0.3164,0.0532 L0.3495,0.0406 ' +
    'L0.4017,0.0342 L0.4242,0.0278 L0.4585,0.0153 L0.5,0 L0.5415,0.0153 L0.5758,0.0278 L0.5983,0.0342 L0.6505,0.0406 ' +
    'L0.6836,0.0532 L0.705,0.0657 L0.7263,0.0846 L0.7429,0.1036 L0.7598,0.1287 L0.7719,0.1538 L0.78,0.1791 L0.7847,0.2042 ' +
    'L0.8016,0.2106 L0.8333,0.2167 L0.8461,0.2231 L0.8629,0.2357 L0.8832,0.2546 L0.8932,0.2797 L0.9026,0.3112 L0.9047,0.3491 ' +
    'L0.9391,0.3555 L0.9532,0.3616 L0.964,0.368 L0.9822,0.387 L0.9923,0.4121 L0.9983,0.4372 L1,0.45 L1,1 Z',
  featherBottom: 0.14,
  cropMode: 'cover',
  scale: 1,
  photoOffsetX: 0,
  photoOffsetY: 0,
  mirror: false,
};

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

/** Minimal header readers: JPEG (SOFn), PNG (IHDR), WEBP (VP8/VP8L/VP8X). */
function readDimensions(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5), format: 'jpeg' };
      }
      i += 2 + len;
    }
  }
  if (buf.toString('ascii', 1, 4) === 'PNG') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), format: 'png' };
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buf.toString('ascii', 12, 16);
    if (chunk === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3), format: 'webp' };
    if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff, format: 'webp' };
    if (chunk === 'VP8L') {
      const b = buf.readUInt32LE(21);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1, format: 'webp' };
    }
  }
  return { width: 0, height: 0, format: 'unknown' };
}

const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const normalizeSearch = (s) => s.toLowerCase().normalize('NFC').replace(/[.,()\-–:&/]+/g, ' ').replace(/\s+/g, ' ').trim();
const gcd = (a, b) => (b ? gcd(b, a % b) : a);

const transcriptions = JSON.parse(readFileSync(join(ROOT, 'scripts/footer-transcriptions.json'), 'utf8')).files;
const files = walk(SRC_DIR).filter((f) => EXTS.has(extname(f).toLowerCase()));
files.sort((a, b) => parseInt(basename(a)) - parseInt(basename(b)) || a.localeCompare(b));

mkdirSync(OUT_TEMPLATES, { recursive: true });
mkdirSync(DATA_DIR, { recursive: true });

const audit = [];
const branchesById = new Map();
const templates = [];
const hashes = new Map();
const sizes = new Map();

for (const file of files) {
  const rel = relative(SRC_DIR, file);
  const buf = readFileSync(file);
  const { width, height, format } = readDimensions(buf);
  const md5 = createHash('md5').update(buf).digest('hex');
  const g = gcd(width, height) || 1;
  const t = transcriptions[rel];
  const stem = basename(rel, extname(rel));
  const templateId = `tpl-dream-diwali-${slug(stem)}`;
  const publicName = `poster-${slug(stem)}${extname(rel).toLowerCase()}`;

  const entry = {
    file: rel,
    format,
    width,
    height,
    aspectRatio: `${width / g}:${height / g}`,
    aspectRatioDecimal: +(width / height).toFixed(4),
    bytes: buf.length,
    md5,
    classification: t ? 'poster-template' : 'unclassified',
    design: t ? 'Dream Diwali (flat JPEG, arch photo window, no transparency)' : null,
    hasTransparentWindow: false,
    compositingMode: 'flat',
    printedAddressLines: t?.lines ?? [],
    printedPhone: t?.phone ?? null,
    extraction: t
      ? { method: 'manual-visual-transcription', ocrCrossCheck: 'tesseract eng – phone digits only (no Tamil language pack installed)', confidence: 'high' }
      : { method: 'none', confidence: 'none' },
    duplicateOf: t?.duplicateOf ?? null,
    exactDuplicateOf: hashes.get(md5) ?? null,
    sameByteSizeAs: sizes.get(buf.length) ?? null,
    notes: t?.notes ?? null,
    templateId,
    publicPath: `/assets/templates/${publicName}`,
    thumbnailPath: `/assets/thumbs/${publicName}`,
    artworkAbovePhoto: 'None required: the photo is clipped to the arch window and bottom-feathered so lamp tiles, tagline, logo and footer stay untouched.',
  };
  hashes.set(md5, rel);
  sizes.set(buf.length, rel);
  audit.push(entry);

  const dest = join(OUT_TEMPLATES, publicName);
  if (!existsSync(dest)) copyFileSync(file, dest);

  if (!t) {
    templates.push({
      id: templateId, name: `Unverified Location – ${rel}`, branchId: 'unverified-location', imagePath: entry.publicPath,
      thumbnailPath: entry.thumbnailPath, width, height, aspectRatio: entry.aspectRatioDecimal, sourceFile: rel, mode: 'flat',
      photoPlacement: { ...DREAM_DIWALI_PLACEMENT }, overlayConfiguration: { foregroundImagePath: null, backgroundImagePath: null },
      verified: false, status: 'needs-manual-placement', duplicateOf: null,
    });
    continue;
  }

  const branchId = `br-${slug(t.branch)}`;
  const isDuplicate = Boolean(t.duplicateOf);

  if (!branchesById.has(branchId)) {
    const displayAddress = t.lines.join(' ').replace(/\s+/g, ' ').trim();
    branchesById.set(branchId, {
      id: branchId,
      branchName: t.branch,
      locality: t.locality,
      displayAddress,
      displayAddressLines: t.lines,
      phone: t.phone,
      searchAddress: normalizeSearch(`${t.branch} ${t.locality} ${displayAddress} ${t.phone} ${(t.aliases || []).join(' ')}`),
      aliases: t.aliases || [],
      templateIds: [],
      sourceFiles: [],
      verificationStatus: 'verified',
      verificationMethod: 'Manual visual reading of printed footer; phone digits cross-checked with OCR.',
      notes: t.notes ?? null,
    });
  }
  const br = branchesById.get(branchId);
  br.sourceFiles.push(rel);

  templates.push({
    id: templateId,
    name: `Dream Diwali – ${t.branch}${isDuplicate ? ' (duplicate export)' : ''}`,
    branchId,
    imagePath: entry.publicPath,
    thumbnailPath: entry.thumbnailPath,
    width,
    height,
    aspectRatio: entry.aspectRatioDecimal,
    sourceFile: rel,
    mode: 'flat',
    photoPlacement: { ...DREAM_DIWALI_PLACEMENT },
    overlayConfiguration: { foregroundImagePath: null, backgroundImagePath: null },
    verified: !isDuplicate,
    status: isDuplicate ? 'duplicate' : 'ready',
    duplicateOf: isDuplicate ? `tpl-dream-diwali-${slug(basename(t.duplicateOf, extname(t.duplicateOf)))}` : null,
  });
  if (!isDuplicate) br.templateIds.push(templateId);
}

const byPhone = new Map();
for (const b of branchesById.values()) {
  const k = b.phone.replace(/\D/g, '');
  byPhone.set(k, [...(byPhone.get(k) || []), b.id]);
}
const phoneConflicts = [...byPhone.entries()].filter(([, ids]) => ids.length > 1).map(([phone, branchIds]) => ({ phone, branchIds }));
const branches = [...branchesById.values()].sort((a, b) => a.branchName.localeCompare(b.branchName));

writeFileSync(join(DATA_DIR, 'branches.json'), JSON.stringify(branches, null, 2) + '\n');
writeFileSync(join(DATA_DIR, 'templates.json'), JSON.stringify(templates, null, 2) + '\n');
writeFileSync(
  join(DATA_DIR, 'asset-audit.json'),
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceDirectory: 'HAPPY CUSTOMERS',
      totals: {
        images: audit.length,
        posterTemplates: audit.filter((a) => a.classification === 'poster-template').length,
        unclassified: audit.filter((a) => a.classification !== 'poster-template').length,
        uniqueBranches: branches.length,
        productionTemplates: templates.filter((t) => t.verified).length,
        duplicates: audit.filter((a) => a.duplicateOf || a.exactDuplicateOf).length,
      },
      phoneConflicts,
      logos: [{ file: 'public/assets/logos/sky-logo.jpg', derivedFrom: '9.jpg', note: 'Cropped from the poster header (no standalone logo file was supplied).' }],
      images: audit,
    },
    null,
    2,
  ) + '\n',
);

// docs/BRANCH_MAPPING.md is generated from the same data so it can never drift.
const md = [
  '# Branch → template mapping',
  '',
  '_Generated by `npm run audit:assets` — do not edit by hand._',
  '',
  'Addresses are reproduced exactly as printed on each poster footer (Tamil). The English branch name is a label used only for search and display.',
  '',
  '| # | Branch (label) | Printed address | Phone | Source file | Template id | Status |',
  '|---|---|---|---|---|---|---|',
  ...templates.map((t, i) => {
    const b = branchesById.get(t.branchId);
    return `| ${i + 1} | ${b?.branchName ?? 'Unverified Location'} | ${(b?.displayAddressLines ?? []).join('<br>')} | ${b?.phone ?? ''} | ${t.sourceFile} | \`${t.id}\` | ${t.status}${t.duplicateOf ? ` (of \`${t.duplicateOf}\`)` : ''}${b?.notes ? ` ⚠ ${b.notes}` : ''} |`;
  }),
  '',
].join('\n');
mkdirSync(join(ROOT, 'docs'), { recursive: true });
writeFileSync(join(ROOT, 'docs/BRANCH_MAPPING.md'), md);

console.log(`Audited ${audit.length} images → ${branches.length} branches, ${templates.filter((t) => t.verified).length} production templates.`);
if (phoneConflicts.length) console.log('Phone conflicts:', JSON.stringify(phoneConflicts));
