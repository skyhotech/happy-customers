import { describe, expect, it } from 'vitest';
import audit from '@/data/asset-audit.json';
import {
  BASE_BRANCHES,
  BASE_TEMPLATES,
  applyBranchOverrides,
  applyTemplateOverrides,
  isTemplateReady,
  resolveTemplatesForBranch,
  searchBranches,
  selectableBranches,
} from '@/services/templateResolver';

describe('asset manifest integrity', () => {
  it('audits every source image', () => {
    expect(audit.totals.images).toBe(32);
    expect(audit.images.every((i) => i.width === 3516 && i.height === 6250)).toBe(true);
    expect(audit.images.every((i) => i.extraction.confidence === 'high')).toBe(true);
  });

  it('has 31 unique verified branches, each with exactly one explicit template', () => {
    expect(BASE_BRANCHES).toHaveLength(31);
    for (const b of BASE_BRANCHES) {
      expect(b.verificationStatus).toBe('verified');
      expect(b.templateIds).toHaveLength(1);
      const t = BASE_TEMPLATES.find((x) => x.id === b.templateIds[0])!;
      expect(t.branchId).toBe(b.id);
      expect(b.displayAddress.length).toBeGreaterThan(5);
    }
  });

  it('keeps the original printed Tamil address (not rewritten)', () => {
    const arcot = BASE_BRANCHES.find((b) => b.locality === 'Arcot')!;
    expect(arcot.displayAddressLines).toEqual(['எண். 86, சாண்டி பஜார், கலவை', 'ரோடு, ஆற்காடு']);
    expect(arcot.displayAddress).toBe('எண். 86, சாண்டி பஜார், கலவை ரோடு, ஆற்காடு');
  });

  it('flags the duplicate export and keeps it out of production', () => {
    const dup = BASE_TEMPLATES.find((t) => t.sourceFile === '17.jpg')!;
    expect(dup.status).toBe('duplicate');
    expect(dup.verified).toBe(false);
    expect(isTemplateReady(dup, BASE_BRANCHES)).toBe(false);
  });

  it('records the shared phone number between Tiruttani and Uthiramerur', () => {
    expect(audit.phoneConflicts).toHaveLength(1);
    expect(audit.phoneConflicts[0].branchIds).toHaveLength(2);
  });
});

describe('branch search', () => {
  it('matches by town name', () => {
    const r = searchBranches('vellore', BASE_BRANCHES);
    expect(r.length).toBe(5);
    expect(r.every((b) => b.locality === 'Vellore')).toBe(true);
  });

  it('matches Tamil address fragments', () => {
    expect(searchBranches('ஆற்காடு', BASE_BRANCHES)[0].locality).toBe('Arcot');
    expect(searchBranches('சத்துவாச்சாரி', BASE_BRANCHES)[0].branchName).toContain('Sathuvachari');
  });

  it('matches aliases and multi-token queries', () => {
    expect(searchBranches('pondy', BASE_BRANCHES)[0].locality).toBe('Puducherry');
    expect(searchBranches('polur road tiruvannamalai', BASE_BRANCHES)).toHaveLength(2);
    expect(searchBranches('CMC', BASE_BRANCHES)[0].branchName).toContain('CMC');
  });

  it('matches by phone digits', () => {
    expect(searchBranches('9150363646', BASE_BRANCHES)[0].locality).toBe('Walajapet');
  });

  it('ranks exact locality matches first', () => {
    const r = searchBranches('arani', BASE_BRANCHES);
    expect(r.slice(0, 3).every((b) => b.locality === 'Arani')).toBe(true);
    // "Arani Road" in Vellore also matches, but ranks after Arani town
    expect(r.some((b) => b.locality === 'Vellore')).toBe(true);
    expect(r[r.length - 1].locality).toBe('Vellore');
  });

  it('returns everything for an empty query and nothing for nonsense', () => {
    expect(searchBranches('  ', BASE_BRANCHES)).toHaveLength(31);
    expect(searchBranches('zzzz-no-such-place', BASE_BRANCHES)).toHaveLength(0);
  });
});

describe('template association', () => {
  const vellore = BASE_BRANCHES.find((b) => b.branchName.includes('Velapadi'))!;

  it('resolves strictly by explicit branchId', () => {
    const r = resolveTemplatesForBranch(vellore.id, BASE_TEMPLATES, BASE_BRANCHES);
    expect(r).toHaveLength(1);
    expect(r[0].sourceFile).toBe('36.jpg');
  });

  it('returns nothing for unknown branches (no random fallback)', () => {
    expect(resolveTemplatesForBranch('br-does-not-exist', BASE_TEMPLATES, BASE_BRANCHES)).toEqual([]);
  });

  it('hides templates that an admin un-verifies', () => {
    const t = applyTemplateOverrides(BASE_TEMPLATES, [{ templateId: vellore.templateIds[0], verified: false, updatedAt: 1 }]);
    expect(resolveTemplatesForBranch(vellore.id, t, BASE_BRANCHES)).toEqual([]);
    expect(selectableBranches(BASE_BRANCHES, t)).toHaveLength(30);
  });

  it('hides branches marked as needing review', () => {
    const b = applyBranchOverrides(BASE_BRANCHES, [{ branchId: vellore.id, verificationStatus: 'needs-review', updatedAt: 1 }]);
    expect(resolveTemplatesForBranch(vellore.id, BASE_TEMPLATES, b)).toEqual([]);
  });

  it('supports reassigning a template to another branch', () => {
    const other = BASE_BRANCHES.find((b) => b.locality === 'Arcot')!;
    const t = applyTemplateOverrides(BASE_TEMPLATES, [{ templateId: vellore.templateIds[0], branchId: other.id, updatedAt: 1 }]);
    expect(resolveTemplatesForBranch(other.id, t, BASE_BRANCHES)).toHaveLength(2);
  });
});
