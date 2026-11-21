import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMenuItem,
  updateMenuItem,
  uploadMenuItemImage,
} from '../../api/menu'
import type {
  ServerMenuCategorySummary,
  ServerMenuItem,
} from '../../api/types'
import { MenuItemFormModal } from './MenuItemFormModal'

// Ruling: this file lives in src/components/menu-management/, so the API
// module is two levels up. The plan's `../api/menu` path is a defect.
vi.mock('../../api/menu', () => ({
  createMenuItem: vi.fn(),
  updateMenuItem: vi.fn(),
  uploadMenuItemImage: vi.fn(),
}))

const CATEGORIES: ServerMenuCategorySummary[] = [
  { id: 'all', name: 'all', sortOrder: 0 },
  { id: 'popular', name: 'popular', sortOrder: 1 },
  { id: 'c1', name: 'Món chính', sortOrder: 2 },
  { id: 'c2', name: 'Đồ uống', sortOrder: 3 },
]

const ITEM: ServerMenuItem = {
  id: 'm1',
  categoryId: 'c1',
  legacyId: 'pho-bo',
  name: 'Phở bò',
  description: 'Nước dùng hầm xương',
  price: 89000,
  imageKey: null,
  imageUrl: null,
  available: true,
  popular: false,
  sortOrder: 0,
}

function renderModal(item?: ServerMenuItem) {
  const onClose = vi.fn()
  const onSaved = vi.fn()

  render(
    <MenuItemFormModal
      open
      categories={CATEGORIES}
      item={item}
      onClose={onClose}
      onSaved={onSaved}
    />,
  )

  return { onClose, onSaved }
}

async function fillRequiredFields(
  user: ReturnType<typeof userEvent.setup>,
  name = 'Phở bò',
  price = '89000',
) {
  await user.type(screen.getByLabelText('Tên món'), name)
  const priceInput = screen.getByLabelText('Giá bán')
  await user.clear(priceInput)
  await user.type(priceInput, price)
}

describe('MenuItemFormModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
    vi.mocked(createMenuItem).mockResolvedValue({
      ...ITEM,
      id: 'new-1',
      legacyId: null,
      sortOrder: 0,
    })
    vi.mocked(updateMenuItem).mockResolvedValue(ITEM)
    vi.mocked(uploadMenuItemImage).mockResolvedValue(ITEM)
  })

  it('creates an item with a numeric price', async () => {
    const user = userEvent.setup()
    const { onClose, onSaved } = renderModal()

    await fillRequiredFields(user)
    await user.selectOptions(screen.getByLabelText('Nhóm món'), 'c1')
    await user.click(screen.getByRole('button', { name: 'Lưu món' }))

    await waitFor(() => expect(createMenuItem).toHaveBeenCalledTimes(1))
    const payload = vi.mocked(createMenuItem).mock.calls[0][0]
    expect(payload).toMatchObject({
      categoryId: 'c1',
      name: 'Phở bò',
      price: 89000,
    })
    expect(typeof payload.price).toBe('number')
    expect(uploadMenuItemImage).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('updates an existing item', async () => {
    const user = userEvent.setup()
    const { onSaved } = renderModal(ITEM)

    expect(screen.getByLabelText('Tên món')).toHaveValue('Phở bò')
    expect(screen.getByLabelText('Nhóm món')).toHaveValue('c1')
    const priceInput = screen.getByLabelText('Giá bán')
    await user.clear(priceInput)
    await user.type(priceInput, '99000')
    await user.click(screen.getByRole('button', { name: 'Lưu món' }))

    await waitFor(() =>
      expect(updateMenuItem).toHaveBeenCalledWith(
        'm1',
        expect.objectContaining({ price: 99000 }),
      ),
    )
    expect(createMenuItem).not.toHaveBeenCalled()
    expect(uploadMenuItemImage).not.toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledTimes(1)
  })

  it('uploads a selected image after creating the item', async () => {
    const user = userEvent.setup()
    renderModal()

    await fillRequiredFields(user)
    const file = new File(['bytes'], 'pho.webp', { type: 'image/webp' })
    await user.upload(screen.getByLabelText('Ảnh món'), file)
    await user.click(screen.getByRole('button', { name: 'Lưu món' }))

    await waitFor(() =>
      expect(uploadMenuItemImage).toHaveBeenCalledWith('new-1', file),
    )
    expect(createMenuItem).toHaveBeenCalledTimes(1)
  })

  it('only lists real categories in the select', () => {
    renderModal()

    const labels = screen
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(labels).toEqual(['Món chính', 'Đồ uống'])
  })

  it('rejects a non-integer price locally', async () => {
    const user = userEvent.setup()
    renderModal()

    await fillRequiredFields(user, 'Phở bò', '12.5')
    await user.click(screen.getByRole('button', { name: 'Lưu món' }))

    expect(
      await screen.findByText('Giá bán phải là số nguyên không âm'),
    ).toBeInTheDocument()
    expect(createMenuItem).not.toHaveBeenCalled()
  })
})
