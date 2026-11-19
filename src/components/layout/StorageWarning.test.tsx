import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePOSStore } from '../../store/usePOSStore'
import { StorageWarning } from './StorageWarning'

describe('StorageWarning', () => {
  beforeEach(() => {
    usePOSStore.setState({ storageError: false })
  })

  it('stays hidden while persistence works', () => {
    render(<StorageWarning />)

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('warns the cashier when storage writes fail', () => {
    const setItem = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

    render(<StorageWarning />)

    act(() => {
      usePOSStore.getState().addItem('ga-nuong')
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Không lưu được dữ liệu trên trình duyệt',
    )

    setItem.mockRestore()
    act(() => {
      usePOSStore.setState({ storageError: false })
    })
  })
})
