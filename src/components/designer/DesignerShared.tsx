import { useRef, useState } from 'react';
import { ExternalLink, FileImage, FileVideo, Link2, Trash2, UploadCloud } from 'lucide-react';
import { DeliveredFile } from '../../types';
import { formatSubmittedAt } from '../../dateTime';
import { ago } from '../../marketingDept';
import { fileSize } from './designerContext';

let seq = 0;
const isImage = (name: string) => /\.(png|jpe?g|gif|webp|svg)$/i.test(name);
const isVideo = (name: string) => /\.(mp4|mov|webm|m4v)$/i.test(name);

/** "Upload Final Design" — drag & drop or browse, or paste a shared link. */
export function UploadZone({ files, onChange, me, accept, kind, readOnly }: {
  files: DeliveredFile[];
  onChange: (files: DeliveredFile[]) => void;
  me: string;
  accept: string;
  kind: 'design' | 'video' | 'material' | 'media';
  readOnly?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [link, setLink] = useState('');
  const linkOk = /^https?:\/\/\S+\.\S+/.test(link.trim());

  const add = (list: FileList | null) => {
    if (!list?.length) return;
    const now = formatSubmittedAt(new Date());
    onChange([...files, ...Array.from(list).map((f) => ({
      id: `up-${Date.now()}-${seq++}`, name: f.name, size: f.size, uploadedAt: now, by: me,
      // Session preview only — a shared link is the permanent copy.
      url: URL.createObjectURL(f),
    }))]);
  };
  const addLink = () => {
    if (!linkOk) return;
    const url = link.trim();
    onChange([...files, { id: `ln-${Date.now()}-${seq++}`, name: url.replace(/^https?:\/\//, '').slice(0, 60), url, uploadedAt: formatSubmittedAt(new Date()), by: me }]);
    setLink('');
  };

  return (
    <div className="space-y-2">
      {!readOnly && (
        <>
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setOver(true); }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
            className={`flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${over ? 'border-navy bg-navy/5' : 'border-grey-border hover:border-navy-light'}`}
          >
            <UploadCloud size={22} className={over ? 'text-navy' : 'text-gray-400'} />
            <span className="text-sm font-medium text-navy">{kind === 'video' ? 'Upload final edited video' : kind === 'material' ? 'Upload your videos, photos or documents' : kind === 'media' ? 'Upload photos or videos' : 'Upload Final Design'}</span>
            <span className="text-xs text-gray-400">Drag files here or click to browse · {kind === 'video' ? 'MP4, MOV' : kind === 'material' ? 'MP4, MOV, JPG, PNG, PDF, DOCX' : kind === 'media' ? 'JPG, PNG, HEIC, MP4, MOV' : 'PNG, JPG, PDF, PSD, AI'}</span>
          </button>
          <input ref={input} type="file" multiple accept={accept} className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink(); } }}
                placeholder="…or paste a Drive / Dropbox link" className="w-full rounded-lg border border-grey-border py-2 pl-8 pr-3 text-sm focus:border-navy-light focus:outline-none" />
            </div>
            <button type="button" disabled={!linkOk} onClick={addLink} className="rounded-lg border border-grey-border px-3 text-sm font-medium text-navy transition-colors hover:border-navy-light disabled:opacity-40">Add link</button>
          </div>
        </>
      )}
      {files.length > 0 ? (
        <ul className="divide-y divide-grey-border rounded-lg border border-grey-border">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-3 py-2">
              {f.url?.startsWith('blob:') && isImage(f.name)
                ? <img src={f.url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
                : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-grey-bg text-gray-400">{isVideo(f.name) ? <FileVideo size={18} /> : f.size === undefined ? <Link2 size={18} /> : <FileImage size={18} />}</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-navy" title={f.name}>{f.name}</p>
                <p className="text-[11px] text-gray-400">{fileSize(f.size)} · {f.by} · {ago(f.uploadedAt)}</p>
              </div>
              {f.url && <a href={f.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${f.name}`} className="rounded p-1 text-gray-400 transition-colors hover:text-navy-light"><ExternalLink size={14} /></a>}
              {!readOnly && <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onChange(files.filter((x) => x.id !== f.id))} className="rounded p-1 text-gray-400 transition-colors hover:text-red-600"><Trash2 size={14} /></button>}
            </li>
          ))}
        </ul>
      ) : readOnly && <p className="text-xs text-gray-400">No files delivered.</p>}
      {!readOnly && <p className="text-[11px] text-gray-400">Browser uploads are attached for this session — add a shared link for the permanent copy.</p>}
    </div>
  );
}

/** A labelled block inside a task brief. */
export function BriefBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{title}</h4>
      {children}
    </section>
  );
}
