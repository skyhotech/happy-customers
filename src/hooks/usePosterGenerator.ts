import { useCallback, useState } from 'react';
import { db, saveRecord } from '@/db/database';
import { deliverPoster } from '@/services/downloadService';
import { makeThumbnail, type DecodedImage } from '@/services/imageProcessor';
import { generatePoster } from '@/services/posterRenderer';
import { useSession } from '@/store/sessionStore';
import { useSettings } from '@/store/settingsStore';
import type { Branch, CustomerRecord, OutputSettings, PhotoAdjust, PhotoPlacement, PosterTemplate } from '@/types';
import { buildPosterFilename } from '@/utils/filenameUtils';

export type GenerationStage = 'idle' | 'validating' | 'rendering' | 'encoding' | 'saving' | 'downloading' | 'done' | 'error';

export const STAGE_LABEL: Record<GenerationStage, string> = {
  idle: '',
  validating: 'Checking photo & template…',
  rendering: 'Compositing at full resolution…',
  encoding: 'Creating thumbnail…',
  saving: 'Saving to history…',
  downloading: 'Starting download…',
  done: 'Done',
  error: 'Failed',
};

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => setTimeout(r, 0)));

export interface GenerateArgs {
  template: PosterTemplate;
  templateImage: HTMLImageElement;
  branch: Branch;
  photo: DecodedImage;
  photoBlob: Blob;
  photoSize: { width: number; height: number };
  placement: PhotoPlacement;
  adjust: PhotoAdjust;
  output: OutputSettings;
}

/** Validate → render → Blob → IndexedDB → download → result. Every stage reflects real work. */
export function usePosterGenerator() {
  const [stage, setStage] = useState<GenerationStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const setResult = useSession((s) => s.setResult);

  const generate = useCallback(
    async (a: GenerateArgs) => {
      const settings = useSettings.getState();
      const session = useSession.getState();
      setError(null);
      try {
        setStage('validating');
        if (!a.template.verified) throw new Error('This template is not verified for production use.');
        if (a.template.branchId !== a.branch.id) throw new Error('Template does not belong to the selected branch.');
        if (!a.templateImage.naturalWidth) throw new Error('Template image is not loaded.');

        setStage('rendering');
        await nextFrame();
        const { blob: posterBlob, width, height } = await generatePoster(
          { layers: { template: a.templateImage }, photo: a.photo, placement: a.placement, adjust: a.adjust, mode: a.template.mode },
          a.output,
        );

        setStage('encoding');
        await nextFrame();
        const thumbnailBlob = await makeThumbnail(posterBlob, 480);

        setStage('saving');
        const now = Date.now();
        const existing = session.sourceRecordId ? await db.sessions.get(session.sourceRecordId) : undefined;
        const ext = a.output.format === 'png' ? 'png' : 'jpg';
        const fileName = buildPosterFilename(a.branch.branchName, new Date(now), ext);
        const record: CustomerRecord = {
          id: existing?.id ?? crypto.randomUUID(),
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
          branchId: a.branch.id,
          branchNameSnapshot: a.branch.branchName,
          branchAddressSnapshot: a.branch.displayAddress,
          templateId: a.template.id,
          originalPhotoBlob: settings.saveOriginalPhoto ? a.photoBlob : new Blob([], { type: 'image/jpeg' }),
          generatedPosterBlob: posterBlob,
          thumbnailBlob,
          fileName,
          imageWidth: width,
          imageHeight: height,
          mirrorEnabled: (session.photo?.capturedMirrored ?? false) !== a.adjust.mirror,
          cropSettings: a.adjust,
          placementSettings: a.placement,
          outputSettings: a.output,
          downloadStatus: settings.autoDownload ? 'pending' : 'not-requested',
          customerLabel: existing?.customerLabel,
        };
        await saveRecord(record);

        let deliveryStatus: 'downloaded' | 'saved-to-folder' | 'failed' | 'not-requested' = 'not-requested';
        let deliveryMessage: string | undefined;
        let finalName = fileName;
        if (settings.autoDownload) {
          setStage('downloading');
          const r = await deliverPoster(posterBlob, fileName, { preferFolder: settings.preferFolder });
          deliveryStatus = r.status;
          finalName = r.fileName;
          if (r.status === 'failed') deliveryMessage = r.error;
          if (r.status === 'saved-to-folder') deliveryMessage = `Saved to folder “${r.folderName}”`;
          await db.sessions.update(record.id, { downloadStatus: r.status, fileName: finalName });
        }

        setResult({ recordId: record.id, fileName: finalName, posterBlob, deliveryStatus, deliveryMessage });
        setStage('done');
        return { recordId: record.id, deliveryStatus };
      } catch (e) {
        setStage('error');
        setError(e instanceof Error ? e.message : 'Poster generation failed.');
        return null;
      }
    },
    [setResult],
  );

  return { stage, error, generate, reset: () => setStage('idle') };
}
