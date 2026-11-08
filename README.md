# SKY Happy Customers – Smart Mirror Selfie Photo Booth

Offline-capable React PWA for SKY Mobile & Electronics. Store staff capture a mirrored selfie of the
customer and pick the store branch. The app composites the photo into that branch's real
“Dream Diwali” poster at full resolution (3516 × 6250), saves it to on-device history and downloads it.

**Frontend only.** No server and no uploads: photos stay in the browser's IndexedDB.

## Run locally on a Mac

```bash
# Node 20+ (tested with Node 26)
cd "/Users/skyworld/happycustomers "     # note: the folder name ends with a space
npm install
npm run dev                                # http://localhost:5173
```

The camera needs a **secure context**: `http://localhost` works, and other devices need HTTPS. To test on a phone
or tablet on the same Wi-Fi, run the app over HTTPS (for example behind an HTTPS tunnel or reverse proxy),
because plain `http://<lan-ip>` blocks the camera.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Type-check + production build into `dist/` (includes the service worker) |
| `npm run preview` | Serve the production build (`http://localhost:4173`); use this to test offline / install |
| `npm test` | Unit + integration tests (Vitest, fake IndexedDB) |
| `npm run test:e2e` | End-to-end tests (Playwright, Chromium with a synthetic camera) |
| `npm run audit:assets` | Re-run the asset audit → `src/data/*.json`, `docs/BRANCH_MAPPING.md` |

First-time Playwright setup: `npx playwright install chromium`.

## Workflow

1. **Dashboard** (`/`): real statistics from IndexedDB, recent posters, camera and storage status.
2. **Camera** (`/camera`): live mirrored preview, camera/resolution picker, front/back switch, fullscreen, 0/3/5/10 s countdown, flash animation, or upload a JPG/PNG/WEBP (max 30 MB). The frame is captured at the real video resolution and the mirror is applied once, so the photo matches the preview.
3. **Review** (`/review`): retake, plus non-destructive crop, zoom, pan, rotate, mirror and reset inside the exact arch window.
4. **Branch** (`/branches`): searchable by branch, town, Tamil address fragment, alias or phone. The template resolves only through an explicit `branchId`.
5. **Poster** (`/editor`): live preview rendered by the same engine as the export. Choose JPG (0.95) or PNG and an optional 4:5 / 9:16 ratio (pad or crop, with a preview confirmation) → **GENERATE & DOWNLOAD**.
6. **History** (`/history`, `/history/:id`): search, date filters, sorting and pagination. View, re-download, re-edit, reuse the photo for another branch, or delete.
7. **Templates** (`/templates`): verify branches and templates, reassign them, edit the photo region by dragging, preview, save, and export/import JSON.
8. **Settings** (`/settings`): camera, mirror, countdown, output, default branch, auto-download, save-to-folder (Chrome/Edge), storage and persistence, offline template caching, backup/restore, clear history, and reduced motion.

## Architecture

```
src/
  app/          App, router (lazy routes), providers (MotionConfig)
  components/   common (design system, toasts, modals), layout (AppShell, session guard),
                camera, editor (PhotoAdjustCanvas, AdjustControls), branches, history, templates
  pages/        one file per route
  hooks/        useCamera, useCountdown, usePhotoCapture, usePosterGenerator, useHistory, useTemplates, useAssets
  services/     cameraService, imageProcessor, templateResolver, posterRenderer, downloadService, backupService
  db/           Dexie database + versioned migrations (v1 → v2)
  store/        sessionStore (in-memory session), settingsStore (localStorage, small prefs only)
  data/         branches.json, templates.json, asset-audit.json (generated)
  utils/        canvas geometry, filenames, dates, upload validation
  tests/        unit/, integration/ (Vitest) and e2e/ (Playwright)
```

**Compositing engine** (`services/posterRenderer.ts`): the stages are `loadImage`, `normalizeImageOrientation`,
`calculateCoverCrop`, `applyMirrorTransform`, `applyRotation`, `renderCustomerLayer`, `renderForegroundOverlay`,
`renderFinalPoster` and `exportPosterBlob`. It supports the flat, transparent-window and layered modes. The photo is
clipped to the region path and cover-fitted with one uniform scale, so faces are never stretched. iOS canvas-area
limits are respected, and canvases are released after export.

**Download**: `deliverPoster()` saves to a chosen folder when the File System Access API is available and permitted;
otherwise it uses a standard browser download. A download is only reported as started when it was actually
triggered. If the browser blocks it, the success panel shows a manual **Download poster** button. Files are named
`SKY_HAPPY_CUSTOMER_{BRANCH}_{YYYYMMDD}_{HHmmss}_{UNIQUEID}.jpg`, and saving to a folder never overwrites an existing file.

## Storage, privacy and retention

- Photos, posters and thumbnails are stored as **Blobs in IndexedDB** (`sky-happy-customers`), never as base64 and never in localStorage.
- History is **specific to this browser profile and device**. It survives refreshes and restarts, but clearing site data, private browsing or browser storage cleanup can remove it. Use **Settings → Export full backup** (a ZIP with every image plus `manifest.json`) and **Import / restore**.
- Settings → Storage shows usage and quota and can request persistent storage.
- No analytics and no external image services. Customer name/phone is never required.
- The camera is requested only on the Camera page, and all tracks stop when you leave it or after capture.
- The service worker precaches the app shell, thumbnails and icons. Full-resolution templates are cached on first use, or all at once via **Settings → Prepare templates for offline use**. Customer images never pass through the service worker.

## Assets and verification

- 32 source images audited → **31 verified branches / 31 production templates**. See [docs/ASSET_AUDIT.md](docs/ASSET_AUDIT.md),
  [docs/BRANCH_MAPPING.md](docs/BRANCH_MAPPING.md) and [docs/TEMPLATE_PLACEMENT.md](docs/TEMPLATE_PLACEMENT.md).
- Needs a human check: **Tiruttani (32.jpg) and Uthiramerur (33.jpg) print the same phone number**, and `17.jpg` is a duplicate of `13.jpg` (excluded).
- To add or replace posters: drop the files into `HAPPY CUSTOMERS/`, add their footer transcription to
  `scripts/footer-transcriptions.json`, create thumbnails (`sips -Z 640 in.jpg --out public/assets/thumbs/poster-N.jpg`)
  and run `npm run audit:assets`. Images without a transcription become **Unverified Location** and are never offered to staff.

## Browser support

Chrome/Edge desktop and Android are fully supported, including save-to-folder. Safari macOS/iOS 16.4+ is supported:
it uses standard downloads, and exports are automatically downscaled to stay within the iOS canvas limit.
Firefox is supported (standard downloads). Automated E2E runs use Chromium. Safari/iOS were not covered by automated
tests here, so check them manually on a device.
