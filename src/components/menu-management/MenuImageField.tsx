import { ImagePlus } from 'lucide-react'
import { useId } from 'react'
import { assetFor } from '../../lib/catalog-assets'

export interface MenuImageFieldProps {
  value: File | null
  previewUrl: string | null
  onChange: (file: File) => void
}

export function MenuImageField({
  value,
  previewUrl,
  onChange,
}: MenuImageFieldProps) {
  const inputId = useId()

  return (
    <div className="flex items-center gap-3">
      <img
        src={previewUrl ?? assetFor(null)}
        alt=""
        className="size-20 shrink-0 rounded-xl border border-line object-cover"
      />

      <div className="min-w-0">
        <label
          htmlFor={inputId}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 text-[11px] font-semibold text-ink transition-colors hover:border-primary-ring hover:text-primary"
        >
          <ImagePlus size={13} />
          Chọn ảnh
        </label>
        <input
          id={inputId}
          aria-label="Ảnh món"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onChange(file)
          }}
        />
        <p className="mt-1.5 truncate text-[11px] text-muted">
          {value ? value.name : 'JPEG, PNG hoặc WebP · tối đa 2 MB'}
        </p>
      </div>
    </div>
  )
}
