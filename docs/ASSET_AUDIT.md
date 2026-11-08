# Asset audit – HAPPY CUSTOMERS

Audit date: 2026-11-08 · Source: `HAPPY CUSTOMERS/` (originals are never modified).
Machine-readable result: [`src/data/asset-audit.json`](../src/data/asset-audit.json) · Mapping: [BRANCH_MAPPING.md](BRANCH_MAPPING.md) · Placement: [TEMPLATE_PLACEMENT.md](TEMPLATE_PLACEMENT.md)

## Summary

| Item | Result |
|---|---|
| Files scanned (recursive, jpg/jpeg/png/webp/avif) | **32** (`9.jpg` … `40.jpg`, no sub-folders, no other formats) |
| Dimensions | All **3516 × 6250 px** (≈ 9:16, 0.5626), JPEG, ~10 MB each |
| Classification | 32 × poster template · 0 logos · 0 completed customer posters · 0 unrelated |
| Design | One design, “Dream Diwali”: SKY logo, title, ornate **arch-shaped photo window**, lamp tiles, Tamil tagline, red footer with branch address + phone |
| Transparency | None: every file is a **flat JPEG** → compositing mode `flat` |
| Unique branches | **31** |
| Production-ready templates | **31** |
| Duplicates | `17.jpg` is a re-export of `13.jpg` (same address, same phone, identical byte size 9,948,284, different MD5) → kept, marked `duplicate`, not offered |
| Unverified locations | **0** |
| Logo asset | None supplied; `public/assets/logos/sky-logo.jpg` was cropped from `9.jpg` for app UI/PWA icons |

## Extraction method

1. **Metadata**: pixel size read from JPEG headers, MD5 and byte size recorded (`scripts/audit-assets.mjs`).
2. **OCR as an aid**: `tesseract` (English only; no Tamil language pack installed) on the footer band. It reliably extracted the **phone digits** for 29/32 posters; it can't read Tamil.
3. **Visual verification (source of truth)**: every footer was read visually at high resolution and transcribed **exactly as printed**, line by line, into `scripts/footer-transcriptions.json`, including original spellings and punctuation (e.g. `சாலை ,` with the space, `என்:126`, `NO.6/1B.`).
4. OCR phone digits were compared with the visual reading: all matched. The three posters where OCR returned nothing (12, 16, 25) were read visually: `6383-941914`, `9080349183`, `9344799353`.
5. Normalized forms (lower-case, punctuation removed, English locality + aliases) exist **only** in `searchAddress`/`aliases` for search. `displayAddress` is never altered.

## Items requiring manual confirmation

| Item | Detail |
|---|---|
| Shared phone number | `32.jpg` **Tiruttani** (MPS Road) and `33.jpg` **Uthiramerur** (Periya Narasam Pettai St) both print `90434 51343`. The addresses are distinct and legible, so both stay verified, but please confirm the phone number with store management. |
| Duplicate export | `17.jpg` = `13.jpg` (Avalurpet). Delete one at the source if it is unintended. |
| Spelling as printed | `24.jpg` prints `என்:126` (not `எண்`) and repeats “முத்துக்கடை”; `27.jpg` prints “கார் செயின்ட்” (Car Street). Preserved verbatim. |
| English labels | Branch labels such as “Vellore – Thorapadi (Periya Allapuram)” are translations for staff convenience. Correct them in `scripts/footer-transcriptions.json` and re-run `npm run audit:assets` if a store uses a different official name. |

## Per-file results

See `src/data/asset-audit.json → images[]` for: file, format, width, height, aspect ratio, bytes, md5, classification, printed address lines, printed phone, extraction method/confidence, duplicate flags, template id and public paths.
