import { describe, expect, it } from 'vitest';
import { buildPosterFilename, sanitizeFilenamePart, withExtension } from '@/utils/filenameUtils';
import { BASE_BRANCHES, BASE_TEMPLATES, buildPlacementExport, parsePlacementImport, validatePlacement } from '@/services/templateResolver';
import { validateUpload } from '@/utils/imageUtils';
import { dateRangeFor } from '@/utils/dateUtils';

describe('filename generation', () => {
  const d = new Date(2026, 10, 8, 9, 5, 7);

  it('follows SKY_HAPPY_CUSTOMER_{BRANCH}_{YYYYMMDD}_{HHmmss}_{UNIQUEID}.jpg', () => {
    expect(buildPosterFilename('Vellore – Katpadi Road (Near CMC Out Gate)', d, 'jpg', 'ab12cd')).toBe(
      'SKY_HAPPY_CUSTOMER_VELLORE_KATPADI_ROAD_NEAR_CMC_OUT_GATE_20261108_090507_AB12CD.jpg',
    );
  });

  it('sanitizes unsafe and non-ASCII characters', () => {
    expect(sanitizeFilenamePart('../../etc/passwd')).toBe('ETC_PASSWD');
    expect(sanitizeFilenamePart('வேலூர்')).toBe('BRANCH');
    expect(sanitizeFilenamePart('A:B*C?"<>|')).toBe('A_B_C');
  });

  it('creates unique names on repeated calls', () => {
    const names = new Set(Array.from({ length: 200 }, () => buildPosterFilename('Arcot', d)));
    expect(names.size).toBe(200);
  });

  it('switches extensions', () => {
    expect(withExtension('X.jpg', 'png')).toBe('X.png');
  });
});

describe('template placement configuration', () => {
  it('validates shipped placements', () => {
    for (const t of BASE_TEMPLATES) expect(validatePlacement(t.photoPlacement)).toBe(true);
  });

  it('rejects malformed placements', () => {
    expect(validatePlacement({ x: 0, y: 0, width: 0, height: 1 })).toBe(false);
    expect(validatePlacement({ ...BASE_TEMPLATES[0].photoPlacement, shape: 'star' })).toBe(false);
    expect(validatePlacement(null)).toBe(false);
  });

  it('round-trips export → import', () => {
    const exp = buildPlacementExport(BASE_TEMPLATES);
    exp.placements[0].photoPlacement = { ...exp.placements[0].photoPlacement, x: 0.1 };
    const { overrides, errors } = parsePlacementImport(JSON.parse(JSON.stringify(exp)), new Set(BASE_TEMPLATES.map((t) => t.id)), new Set(BASE_BRANCHES.map((b) => b.id)));
    expect(errors).toEqual([]);
    expect(overrides).toHaveLength(BASE_TEMPLATES.length);
    // verification flags survive the round trip (the duplicate stays unverified)
    expect(overrides.find((o) => o.templateId === 'tpl-dream-diwali-17')!.verified).toBe(false);
    expect(overrides[0].photoPlacement!.x).toBe(0.1);
  });

  it('rejects files of the wrong kind and unknown ids', () => {
    expect(parsePlacementImport({ foo: 1 }, new Set(), new Set()).errors[0]).toMatch(/Not a SKY/);
    const r = parsePlacementImport({ kind: 'sky-template-placements', placements: [{ templateId: 'nope', branchId: 'x', verified: true, photoPlacement: {} }] }, new Set(), new Set());
    expect(r.overrides).toHaveLength(0);
    expect(r.errors[0]).toMatch(/Unknown template/);
  });
});

describe('upload validation', () => {
  it('accepts supported image types', () => {
    expect(validateUpload({ name: 'a.JPG', type: 'image/jpeg', size: 1000 }).ok).toBe(true);
    expect(validateUpload({ name: 'a.webp', type: '', size: 1000 }).ok).toBe(true);
  });
  it('rejects unsupported, empty and very large files', () => {
    expect(validateUpload({ name: 'a.gif', type: 'image/gif', size: 10 }).ok).toBe(false);
    expect(validateUpload({ name: 'a.jpg', type: 'image/jpeg', size: 0 }).ok).toBe(false);
    expect(validateUpload({ name: 'a.jpg', type: 'image/jpeg', size: 200 * 1024 * 1024 }).ok).toBe(false);
  });
});

describe('date filters', () => {
  const now = new Date(2026, 10, 8, 15, 0, 0);
  it('computes today / 7 days / month / custom ranges', () => {
    expect(dateRangeFor('today', undefined, now)[0]).toBe(new Date(2026, 10, 8).getTime());
    expect(dateRangeFor('7d', undefined, now)[0]).toBe(new Date(2026, 10, 2).getTime());
    expect(dateRangeFor('month', undefined, now)[0]).toBe(new Date(2026, 10, 1).getTime());
    const [f, t] = dateRangeFor('custom', { from: '2026-11-01', to: '2026-11-03' }, now);
    expect(f).toBe(new Date(2026, 10, 1).getTime());
    expect(t).toBe(new Date(2026, 10, 3, 23, 59, 59, 999).getTime());
  });
});
