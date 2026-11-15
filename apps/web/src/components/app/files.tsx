import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Download, FileText, Loader2, ShieldAlert, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAxios } from '@/lib/services/axios';
import { apiErrorMessage } from '@/lib/services/api';

const API_BASE_URL = import.meta.env.VITE_FILES_API_BASE_URL as string;

export interface CaseFile {
  id: string;
  name: string;
  size: number;
  contentType: string;
  source?: string;
  createdAt?: string;
  scan?: string | null;
  sanitization?: string[];
}

export const formatSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Download through a short-lived signed link (the API authorises and audits every download). */
export function useDownload() {
  const { axios } = useAxios();
  return async (fileId: string) => {
    try {
      const { data } = await axios.post(`${API_BASE_URL}/case-files/${fileId}/download-url`);
      window.location.assign(data.url);
    } catch (error) {
      toast.error(apiErrorMessage(error));
    }
  };
}

export function FileLink({ file }: { file: { fileId?: string; id?: string; name: string; size?: number } }) {
  const download = useDownload();
  const id = file.fileId ?? file.id!;
  return (
    <button type="button" className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline" onClick={() => download(id)} data-testid="file-link">
      <FileText className="h-4 w-4" />{file.name}{file.size ? <span className="text-muted-foreground"> ({formatSize(file.size)})</span> : null}
    </button>
  );
}

/** Files of a case with where they came from and what intake did to them. */
export function FileList({ files }: { files: CaseFile[] }) {
  const download = useDownload();
  if (!files.length) return <p className="text-sm text-muted-foreground">No files.</p>;
  return (
    <ul className="space-y-3 text-sm" data-testid="case-files">
      {files.map((f) => (
        <li key={f.id} className="flex items-start justify-between gap-4" data-testid="case-file">
          <div>
            <p className="font-medium">{f.name}</p>
            <p className="text-xs text-muted-foreground">{formatSize(f.size)} · {f.contentType}{f.source ? ` · from ${f.source}` : ''} · scanned {f.scan ?? '—'}</p>
            {!!f.sanitization?.length && <p className="text-xs text-amber-700" data-testid="sanitization">Sanitised: {f.sanitization.join('; ')}</p>}
          </div>
          <Button size="sm" variant="outline" onClick={() => download(f.id)}><Download className="h-4 w-4 mr-1" />Download</Button>
        </li>
      ))}
    </ul>
  );
}

/** A value of a client's answer: file lists render as download links, everything else as text. */
export function AnswerValue({ value }: { value: unknown }) {
  if (Array.isArray(value) && value.every((v) => v && typeof v === 'object' && 'fileId' in v)) {
    return <span className="flex flex-wrap gap-3">{(value as Array<{ fileId: string; name: string; size?: number }>).map((f) => <FileLink key={f.fileId} file={f} />)}</span>;
  }
  if (value === null || value === undefined || value === '') return <>—</>;
  return <>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</>;
}

interface UploadState {
  key: string;
  name: string;
  status: 'uploading' | 'checking' | 'available' | 'rejected' | 'error';
  fileId?: string;
  message?: string;
}

const sha256 = async (file: File) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))).map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * Uploader for a request item (docs/plans/07): intent → bytes to the signed URL → complete → waits for the intake
 * verdict (virus scan and sanitisation). Reports the ids of files that became available.
 */
export function RequestFileUploader({ taskId, itemKey, label, onChange }: { taskId: string; itemKey: string; label: string; onChange: (fileIds: string[]) => void }) {
  const { axios } = useAxios();
  const [uploads, setUploads] = useState<UploadState[]>([]);

  const update = (key: string, changes: Partial<UploadState>) => setUploads((list) => {
    const next = list.map((u) => (u.key === key ? { ...u, ...changes } : u));
    onChange(next.filter((u) => u.status === 'available' && u.fileId).map((u) => u.fileId!));
    return next;
  });

  const send = async (file: File) => {
    const key = `${file.name}-${Date.now()}-${Math.random()}`;
    setUploads((list) => [...list, { key, name: file.name, status: 'uploading' }]);
    try {
      const { data: intent } = await axios.post(`${API_BASE_URL}/uploads`, {
        purpose: 'client_request_item', taskId, itemKey, name: file.name, size: file.size, type: file.type || 'application/octet-stream', sha256: await sha256(file),
      });
      const put = await fetch(intent.upload.url, { method: 'PUT', headers: intent.upload.headers, body: file });
      if (!put.ok) throw new Error((await put.json().catch(() => ({}))).error ?? `Upload failed (${put.status})`);
      await axios.post(`${API_BASE_URL}/uploads/${intent.id}/complete`);
      update(key, { status: 'checking' });
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const { data } = await axios.get(`${API_BASE_URL}/uploads/${intent.id}`);
        if (data.status === 'available') return update(key, { status: 'available', fileId: data.fileId, message: data.sanitization?.length ? 'checked and cleaned' : 'checked' });
        if (data.status === 'rejected') return update(key, { status: 'rejected', message: data.rejectionReason === 'processing_failed' ? 'we could not check this file, please try again' : data.rejectionReason });
      }
      update(key, { status: 'error', message: 'still being checked, try again in a minute' });
    } catch (error) {
      update(key, { status: 'error', message: apiErrorMessage(error) });
    }
  };

  return (
    <div className="space-y-2">
      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed p-3 text-sm hover:bg-muted/40">
        <Upload className="h-4 w-4" />
        <span>Choose files (PDF, JPEG, PNG, HEIC · up to 20 MB)</span>
        <input
          type="file" multiple className="sr-only" aria-label={label} accept="application/pdf,image/jpeg,image/png,image/heic,image/heif"
          onChange={(e) => { for (const file of Array.from(e.target.files ?? [])) void send(file); e.target.value = ''; }}
        />
      </label>
      <ul className="space-y-1 text-sm" data-testid="uploads">
        {uploads.map((u) => (
          <li key={u.key} className="flex items-center gap-2" data-testid="upload" data-status={u.status}>
            {u.status === 'available' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : u.status === 'rejected' || u.status === 'error' ? <ShieldAlert className="h-4 w-4 text-red-600" /> : <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{u.name}</span>
            <span className="text-xs text-muted-foreground">{u.status === 'uploading' ? 'uploading…' : u.status === 'checking' ? 'checking for viruses…' : u.message}</span>
            {(u.status === 'available' || u.status === 'rejected' || u.status === 'error') && (
              <button type="button" aria-label={`Remove ${u.name}`} className="ml-auto" onClick={() => setUploads((list) => { const next = list.filter((x) => x.key !== u.key); onChange(next.filter((x) => x.status === 'available' && x.fileId).map((x) => x.fileId!)); return next; })}><X className="h-4 w-4" /></button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
