import type { ReactNode } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';

type Props = {
  id: string; index: number; label: string; preview: string; open: boolean; busy: boolean;
  onToggle: () => void; onRemove: () => void; canRemove: boolean; children: ReactNode;
};

export function EditorSection({ id, index, label, preview, open, busy, onToggle, onRemove, canRemove, children }: Props) {
  return <section className="tg-editor-section" data-editor-index={index} id={id}>
    <div className="tg-editor-section-head">
      <button type="button" className="tg-editor-section-toggle" disabled={busy} aria-label={preview ? `${label}: ${preview}` : label} aria-expanded={open} aria-controls={`${id}-fields`} onClick={onToggle}>
        <span className="tg-editor-number" aria-hidden="true">{index + 1}</span><span><strong>{label}</strong><span className="tg-editor-preview">{preview || 'Добавь содержание'}</span></span><ChevronDown size={16} aria-hidden="true" />
      </button>
      <button type="button" className="tg-icon-button" disabled={!canRemove || busy} aria-label={`Удалить ${label.toLocaleLowerCase()}`} onClick={onRemove}><Trash2 size={16} aria-hidden="true" /></button>
    </div>
    <div className="tg-editor-section-body" id={`${id}-fields`} hidden={!open}>{children}</div>
  </section>;
}
