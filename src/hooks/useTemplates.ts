import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '@/db/database';
import {
  BASE_BRANCHES,
  BASE_TEMPLATES,
  applyBranchOverrides,
  applyTemplateOverrides,
  isTemplateReady,
  selectableBranches,
} from '@/services/templateResolver';

/** Shipped manifests merged with admin overrides from IndexedDB (live). */
export function useTemplates() {
  const tOverrides = useLiveQuery(() => db.templateOverrides.toArray(), [], undefined);
  const bOverrides = useLiveQuery(() => db.branchOverrides.toArray(), [], undefined);
  return useMemo(() => {
    const loading = tOverrides === undefined || bOverrides === undefined;
    const branches = applyBranchOverrides(BASE_BRANCHES, bOverrides ?? []);
    const templates = applyTemplateOverrides(BASE_TEMPLATES, tOverrides ?? []);
    return {
      loading,
      branches,
      templates,
      selectable: selectableBranches(branches, templates),
      readyTemplates: templates.filter((t) => isTemplateReady(t, branches)),
    };
  }, [tOverrides, bOverrides]);
}
