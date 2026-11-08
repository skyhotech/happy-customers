import branchesJson from '@/data/branches.json';
import templatesJson from '@/data/templates.json';
import type { Branch, BranchOverride, PhotoPlacement, PosterTemplate, TemplateOverride } from '@/types';

export const BASE_BRANCHES = branchesJson as Branch[];
export const BASE_TEMPLATES = templatesJson as PosterTemplate[];
export const UNVERIFIED_LOCATION = 'Unverified Location';

/** Normalizes text for search only (display text is never modified). */
export function normalizeForSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFC')
    .replace(/[.,()\-–—:&/#'"!]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Merges admin overrides from IndexedDB into the shipped manifest. */
export function applyTemplateOverrides(templates: PosterTemplate[], overrides: TemplateOverride[]): PosterTemplate[] {
  const map = new Map(overrides.map((o) => [o.templateId, o]));
  return templates.map((t) => {
    const o = map.get(t.id);
    if (!o) return t;
    return {
      ...t,
      branchId: o.branchId ?? t.branchId,
      photoPlacement: o.photoPlacement ? { ...t.photoPlacement, ...o.photoPlacement } : t.photoPlacement,
      verified: t.status === 'duplicate' && o.verified === undefined ? false : (o.verified ?? t.verified),
    };
  });
}

export function applyBranchOverrides(branches: Branch[], overrides: BranchOverride[]): Branch[] {
  const map = new Map(overrides.map((o) => [o.branchId, o]));
  return branches.map((b) => (map.has(b.id) ? { ...b, verificationStatus: map.get(b.id)!.verificationStatus } : b));
}

/** A template is production-ready only when verified AND explicitly linked to a verified branch. */
export function isTemplateReady(t: PosterTemplate, branches: Branch[]): boolean {
  if (!t.verified || t.status === 'duplicate') return false;
  const b = branches.find((x) => x.id === t.branchId);
  return Boolean(b && b.verificationStatus === 'verified');
}

/**
 * Resolves templates for a branch strictly by explicit branchId association.
 * Never falls back to filename fuzzy matching or random templates.
 */
export function resolveTemplatesForBranch(branchId: string, templates: PosterTemplate[], branches: Branch[]): PosterTemplate[] {
  const branch = branches.find((b) => b.id === branchId);
  if (!branch || branch.verificationStatus !== 'verified') return [];
  return templates.filter((t) => t.branchId === branchId && isTemplateReady(t, branches));
}

/** Branches that appear in the production selector. */
export function selectableBranches(branches: Branch[], templates: PosterTemplate[]): Branch[] {
  return branches.filter((b) => b.verificationStatus === 'verified' && templates.some((t) => t.branchId === b.id && isTemplateReady(t, branches)));
}

/** Search across branch name, locality, printed address fragments, phone and aliases. Ranked. */
export function searchBranches(query: string, branches: Branch[]): Branch[] {
  const q = normalizeForSearch(query);
  if (!q) return branches;
  const tokens = q.split(' ');
  const scored: { b: Branch; score: number }[] = [];
  for (const b of branches) {
    const name = normalizeForSearch(b.branchName);
    const locality = normalizeForSearch(b.locality);
    const aliases = b.aliases.map(normalizeForSearch);
    const haystack = `${name} ${locality} ${normalizeForSearch(b.displayAddress)} ${b.searchAddress} ${b.phone.replace(/\D/g, '')} ${aliases.join(' ')}`;
    if (!tokens.every((t) => haystack.includes(t))) continue;
    let score = 0;
    if (name.startsWith(q)) score += 100;
    if (locality === q) score += 80;
    else if (locality.startsWith(q)) score += 60;
    if (aliases.some((a) => a === q)) score += 50;
    if (name.includes(q)) score += 20;
    score += tokens.filter((t) => name.includes(t)).length * 5;
    scored.push({ b, score });
  }
  return scored.sort((a, c) => c.score - a.score || a.b.branchName.localeCompare(c.b.branchName)).map((s) => s.b);
}

export function validatePlacement(p: unknown): p is PhotoPlacement {
  if (!p || typeof p !== 'object') return false;
  const o = p as Record<string, unknown>;
  const num = (k: string, min: number, max: number) => typeof o[k] === 'number' && Number.isFinite(o[k]) && (o[k] as number) >= min && (o[k] as number) <= max;
  return (
    num('x', -0.5, 1.5) &&
    num('y', -0.5, 1.5) &&
    num('width', 0.01, 2) &&
    num('height', 0.01, 2) &&
    num('rotation', -360, 360) &&
    ['rect', 'rounded', 'ellipse', 'path'].includes(o.shape as string) &&
    ['cover', 'contain'].includes(o.cropMode as string) &&
    (o.path === undefined || typeof o.path === 'string')
  );
}

export interface PlacementExport {
  kind: 'sky-template-placements';
  version: 1;
  exportedAt: string;
  placements: { templateId: string; branchId: string; verified: boolean; photoPlacement: PhotoPlacement }[];
}

export function buildPlacementExport(templates: PosterTemplate[]): PlacementExport {
  return {
    kind: 'sky-template-placements',
    version: 1,
    exportedAt: new Date().toISOString(),
    placements: templates.map((t) => ({ templateId: t.id, branchId: t.branchId, verified: t.verified, photoPlacement: t.photoPlacement })),
  };
}

/** Parses an import file into overrides; invalid entries are rejected with reasons. */
export function parsePlacementImport(json: unknown, knownTemplateIds: Set<string>, knownBranchIds: Set<string>) {
  const errors: string[] = [];
  const overrides: TemplateOverride[] = [];
  const data = json as Partial<PlacementExport>;
  if (!data || data.kind !== 'sky-template-placements' || !Array.isArray(data.placements)) {
    return { overrides, errors: ['Not a SKY template placement file.'] };
  }
  for (const p of data.placements) {
    if (!knownTemplateIds.has(p.templateId)) { errors.push(`Unknown template ${p.templateId}`); continue; }
    if (!knownBranchIds.has(p.branchId)) { errors.push(`Unknown branch ${p.branchId} for ${p.templateId}`); continue; }
    if (!validatePlacement(p.photoPlacement)) { errors.push(`Invalid placement for ${p.templateId}`); continue; }
    overrides.push({ templateId: p.templateId, branchId: p.branchId, verified: Boolean(p.verified), photoPlacement: p.photoPlacement, updatedAt: Date.now() });
  }
  return { overrides, errors };
}
