import { NotebookPen, Pencil } from 'lucide-react'
import { useState } from 'react'
import { usePOSStore } from '../../store/usePOSStore'

export function NoteEditor() {
  const note = usePOSStore((state) => state.note)
  const setNote = usePOSStore((state) => state.setNote)
  const [editing, setEditing] = useState(false)

  if (!editing && !note) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-muted transition-colors hover:text-primary"
      >
        <NotebookPen size={13} />
        Thêm ghi chú
      </button>
    )
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="flex w-full items-start gap-2 rounded-xl bg-gold-soft/60 px-3 py-2 text-left text-[11px] leading-relaxed text-brown"
      >
        <NotebookPen size={13} className="mt-0.5 shrink-0" />
        <span className="min-w-0 flex-1 break-words">{note}</span>
        <Pencil size={12} className="mt-0.5 shrink-0 opacity-70" />
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-line bg-bg/40 p-2">
      <textarea
        autoFocus
        aria-label="Ghi chú đơn"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={2}
        placeholder="Ví dụ: ít đá, mang ra sau, dị ứng đậu phộng…"
        className="w-full resize-none bg-transparent px-1 text-[11px] leading-relaxed text-ink placeholder:text-faint focus:outline-none"
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-lg bg-surface px-2.5 py-1 text-[11px] font-semibold text-primary shadow-sm transition-colors hover:bg-primary-soft"
        >
          Xong
        </button>
      </div>
    </div>
  )
}
