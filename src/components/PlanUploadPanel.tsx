import { Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { uploadSheet } from '../lib/supabase';
import type { PlanSheet } from '../lib/supabase';

const SHEET_TYPES = ['Site Plan', 'Grading Plan', 'Utility Plan', 'Landscape Plan', 'Civil Details', 'Survey', 'Other'];
const ACCEPTED = '.png,.jpg,.jpeg,.webp';

type Props = {
  projectId: string;
  existingSheetCount: number;
  onUploaded: (sheet: PlanSheet) => void;
  onClose: () => void;
};

type FileEntry = {
  file: File;
  name: string;
  sheetType: string;
  preview: string;
};

export function PlanUploadPanel({ projectId, existingSheetCount, onUploaded, onClose }: Props) {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const next: FileEntry[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      const preview = URL.createObjectURL(file);
      const name = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      next.push({ file, name, sheetType: 'Site Plan', preview });
    }
    setEntries((prev) => [...prev, ...next]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  };

  const removeEntry = (i: number) => {
    setEntries((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const updateEntry = (i: number, patch: Partial<FileEntry>) => {
    setEntries((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  };

  const handleUpload = async () => {
    if (entries.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        setProgress(`Uploading ${i + 1} of ${entries.length}: ${entry.name}…`);
        const sheet = await uploadSheet(
          projectId,
          entry.file,
          entry.name,
          entry.sheetType,
          existingSheetCount + i,
        );
        onUploaded(sheet);
      }
      setProgress(null);
      setEntries([]);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
      setProgress(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">
            <Upload size={16} /> Upload Plan Sheets
          </h2>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <p className="modal__subtitle">PNG and JPG images accepted. PDF → export each page as a PNG first.</p>

        {/* Drop zone */}
        <div
          className="upload-dropzone"
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={28} />
          <span>Drop images here or tap to pick files</span>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            multiple
            className="sr-only"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {/* File list */}
        {entries.length > 0 && (
          <div className="upload-list">
            {entries.map((entry, i) => (
              <div key={entry.preview} className="upload-item">
                <img src={entry.preview} alt="preview" className="upload-item__thumb" />
                <div className="upload-item__fields">
                  <input
                    type="text"
                    className="form-input form-input--sm"
                    value={entry.name}
                    onChange={(e) => updateEntry(i, { name: e.target.value })}
                    placeholder="Sheet name"
                  />
                  <select
                    className="form-input form-input--sm"
                    value={entry.sheetType}
                    onChange={(e) => updateEntry(i, { sheetType: e.target.value })}
                  >
                    {SHEET_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <button type="button" className="upload-item__remove" onClick={() => removeEntry(i)} aria-label="Remove">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="form-error">{error}</p>}
        {progress && <p className="upload-progress">{progress}</p>}

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn--primary"
            onClick={handleUpload}
            disabled={uploading || entries.length === 0}
          >
            {uploading ? 'Uploading…' : `Upload ${entries.length > 0 ? entries.length : ''} Sheet${entries.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
