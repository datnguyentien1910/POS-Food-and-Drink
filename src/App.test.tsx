import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the brand name and the POS navigation item', () => {
    render(<App />)

    expect(screen.getByText('RestoDash')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'POS' })).toBeInTheDocument()
  })
})
