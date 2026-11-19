import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlaceholderPage } from './PlaceholderPage'

describe('PlaceholderPage', () => {
  it('names the section and offers a way back to POS', async () => {
    const user = userEvent.setup()
    const onBackToPos = vi.fn()

    render(<PlaceholderPage pageId="reports" onBackToPos={onBackToPos} />)

    expect(
      screen.getByRole('heading', { name: /Báo cáo/ }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Quay lại POS/ }))
    expect(onBackToPos).toHaveBeenCalledTimes(1)
  })
})
