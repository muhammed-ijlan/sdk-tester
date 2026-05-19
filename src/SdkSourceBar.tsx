import { useRef, useState, useSyncExternalStore } from 'react';
import { getSourceSnapshot, loadFromFiles, resetToBundled, subscribeSource } from './sdk-runtime';

const formatBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

const formatTime = (d: Date): string =>
  d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const collectFilesFromDataTransfer = async (dt: DataTransfer): Promise<File[]> => {
  // Folder DnD: walk entries via webkitGetAsEntry.
  const items = dt.items;
  if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
    const out: File[] = [];
    const walk = async (entry: FileSystemEntry): Promise<void> => {
      if (entry.isFile) {
        const file = await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej));
        out.push(file);
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        const readBatch = (): Promise<FileSystemEntry[]> =>
          new Promise((res, rej) => reader.readEntries(res, rej));
        // readEntries returns in batches; loop until empty.
        for (;;) {
          const batch = await readBatch();
          if (batch.length === 0) break;
          for (const e of batch) await walk(e);
        }
      }
    };
    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const e = items[i].webkitGetAsEntry?.();
      if (e) entries.push(e);
    }
    if (entries.length > 0) {
      for (const e of entries) await walk(e);
      if (out.length > 0) return out;
    }
  }
  // Fallback: plain file list.
  return Array.from(dt.files);
};

export const SdkSourceBar = () => {
  const source = useSyncExternalStore(subscribeSource, getSourceSnapshot);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = async (files: File[]) => {
    setBusy(true);
    setError(null);
    try {
      await loadFromFiles(files);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      console.error('[sdk-source] upload failed:', err);
    } finally {
      setBusy(false);
    }
  };

  const onPickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files;
    if (!list) return;
    void handleFiles(Array.from(list));
    e.target.value = '';
  };

  const onDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const files = await collectFilesFromDataTransfer(e.dataTransfer);
    if (files.length > 0) void handleFiles(files);
  };

  return (
    <div
      className={`sdk-bar ${dragOver ? 'drag-over' : ''} ${busy ? 'busy' : ''}`}
      onDragOver={e => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <div className="sdk-bar-row">
        <div className="sdk-bar-left">
          <span className={`sdk-badge ${source.origin}`}>{source.origin}</span>
          {source.origin === 'bundled' ? (
            <span className="sdk-info">using <code>pkg/</code> shipped with this build · drop a pkg/ folder here to swap</span>
          ) : (
            <span className="sdk-info">
              <code>{source.wasmFilename}</code> · {formatBytes(source.wasmSize)} · sha256 <code>{source.wasmHash}</code>
              <span className="sdk-info-sep">·</span>
              <code>{source.bgJsFilename}</code>
              <span className="sdk-info-sep">·</span>
              loaded {formatTime(source.loadedAt)}
            </span>
          )}
        </div>
        <div className="sdk-bar-right">
          <button
            className="secondary"
            disabled={busy}
            onClick={() => folderInputRef.current?.click()}
            title="Pick the whole pkg/ folder"
          >
            {busy ? 'Loading…' : 'Upload pkg/ folder'}
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            title="Pick the .wasm and bg.js files individually"
          >
            Pick files…
          </button>
          {source.origin === 'uploaded' && (
            <button className="secondary" disabled={busy} onClick={resetToBundled}>
              Reset to bundled
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="sdk-bar-error">
          <span className="sdk-bar-error-label">upload failed</span>
          <span>{error}</span>
          <button className="sdk-bar-error-dismiss" onClick={() => setError(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      <input
        ref={folderInputRef}
        type="file"
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore — webkitdirectory is a non-standard but widely-supported attribute
        webkitdirectory=""
        directory=""
        multiple
        style={{ display: 'none' }}
        onChange={onPickFiles}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".wasm,.js"
        style={{ display: 'none' }}
        onChange={onPickFiles}
      />
    </div>
  );
};
