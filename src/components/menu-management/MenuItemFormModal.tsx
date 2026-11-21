import { AlertCircle } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { ApiError } from '../../api/http'
import {
  createMenuItem,
  updateMenuItem,
  uploadMenuItemImage,
  type MenuItemInput,
} from '../../api/menu'
import type {
  ServerMenuCategorySummary,
  ServerMenuItem,
} from '../../api/types'
import { resolveMenuImage } from '../../lib/menu-image'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { MenuImageField } from './MenuImageField'

export interface MenuItemFormModalProps {
  open: boolean
  categories: ServerMenuCategorySummary[]
  item?: ServerMenuItem
  onClose: () => void
  onSaved: () => void
}

const IGNORED_CATEGORIES = new Set(['all', 'popular'])

const inputClass =
  'h-10 w-full rounded-xl border border-line bg-bg/40 px-3 text-xs font-medium text-ink placeholder:text-faint focus:border-primary-ring focus:bg-surface focus:outline-none'

export function MenuItemFormModal({
  open,
  categories,
  item,
  onClose,
  onSaved,
}: MenuItemFormModalProps) {
  const formId = useId()
  const nameId = useId()
  const priceId = useId()
  const categoryId = useId()
  const descriptionId = useId()

  const visibleCategories = categories.filter(
    (category) => !IGNORED_CATEGORIES.has(category.name),
  )

  const [name, setName] = useState(item?.name ?? '')
  const [price, setPrice] = useState(item ? String(item.price) : '')
  const [selectedCategory, setSelectedCategory] = useState(
    item?.categoryId ?? visibleCategories[0]?.id ?? '',
  )
  const [description, setDescription] = useState(item?.description ?? '')
  const [popular, setPopular] = useState(item?.popular ?? false)
  const [available, setAvailable] = useState(item?.available ?? true)
  const [savedId, setSavedId] = useState(item?.id ?? null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  if (!open) return null

  const handleImage = (next: File) => {
    setFile(next)
    setPreviewUrl(URL.createObjectURL(next))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const numericPrice = Number(price)
    if (!name.trim()) {
      setError('Vui lòng nhập tên món')
      return
    }
    if (!selectedCategory) {
      setError('Vui lòng chọn nhóm món')
      return
    }
    if (
      price.trim() === '' ||
      !Number.isInteger(numericPrice) ||
      numericPrice < 0
    ) {
      setError('Giá bán phải là số nguyên không âm')
      return
    }

    const payload: MenuItemInput = {
      categoryId: selectedCategory,
      name: name.trim(),
      description: description.trim(),
      price: numericPrice,
      available,
      popular,
    }

    setSaving(true)
    try {
      const saved = savedId
        ? await updateMenuItem(savedId, payload)
        : await createMenuItem(payload)
      setSavedId(saved.id)

      if (file) {
        await uploadMenuItemImage(saved.id, file)
      }

      onSaved()
      onClose()
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : 'Không lưu được món.',
      )
    } finally {
      setSaving(false)
    }
  }

  const originalImage = item
    ? resolveMenuImage(item.imageUrl, item.imageKey)
    : null

  return (
    <Modal
      open
      title={item ? 'Sửa món' : 'Thêm món'}
      description={
        item
          ? 'Cập nhật thông tin món và ảnh hiển thị trong thực đơn.'
          : 'Tạo món mới để bán tại quầy.'
      }
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={saving}
          >
            Huỷ
          </Button>
          <Button type="submit" form={formId} disabled={saving}>
            {saving ? 'Đang lưu…' : 'Lưu món'}
          </Button>
        </div>
      }
    >
      <form
        id={formId}
        noValidate
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-4"
      >
        {error ? (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-negative-soft px-3 py-2 text-[11px] font-medium text-negative"
          >
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {error}
          </p>
        ) : null}

        <div>
          <label
            htmlFor={nameId}
            className="mb-1 block text-[11px] font-semibold text-muted"
          >
            Tên món
          </label>
          <input
            id={nameId}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ví dụ: Phở bò"
            className={inputClass}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor={priceId}
              className="mb-1 block text-[11px] font-semibold text-muted"
            >
              Giá bán
            </label>
            <input
              id={priceId}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="89000"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor={categoryId}
              className="mb-1 block text-[11px] font-semibold text-muted"
            >
              Nhóm món
            </label>
            <select
              id={categoryId}
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className={inputClass}
            >
              {visibleCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor={descriptionId}
            className="mb-1 block text-[11px] font-semibold text-muted"
          >
            Mô tả
          </label>
          <textarea
            id={descriptionId}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Mô tả ngắn về món (không bắt buộc)"
            className={`${inputClass} h-auto min-h-20 resize-y py-2`}
          />
        </div>

        <MenuImageField
          value={file}
          previewUrl={previewUrl ?? originalImage}
          onChange={handleImage}
        />

        <div className="flex flex-wrap items-center gap-5">
          <label className="flex items-center gap-2 text-[11px] font-semibold text-ink">
            <input
              type="checkbox"
              checked={available}
              onChange={(event) => setAvailable(event.target.checked)}
              className="size-4 accent-primary"
            />
            Đang phục vụ
          </label>

          <label className="flex items-center gap-2 text-[11px] font-semibold text-ink">
            <input
              type="checkbox"
              checked={popular}
              onChange={(event) => setPopular(event.target.checked)}
              className="size-4 accent-primary"
            />
            Bán chạy
          </label>
        </div>
      </form>
    </Modal>
  )
}
