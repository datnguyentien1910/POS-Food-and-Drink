import { describe, expect, it } from 'vitest'
import { matchesQuery, normalizeText } from './search'

describe('normalizeText', () => {
  it('lowercases and strips Vietnamese diacritics', () => {
    expect(normalizeText('Cà phê sữa đá')).toBe('ca phe sua da')
    expect(normalizeText('ĐỒ UỐNG')).toBe('do uong')
  })

  it('collapses extra whitespace', () => {
    expect(normalizeText('  Gỏi   cuốn  ')).toBe('goi cuon')
  })
})

describe('matchesQuery', () => {
  it('matches unaccented queries against accented fields', () => {
    expect(matchesQuery('ca phe', 'Cà phê nóng')).toBe(true)
    expect(matchesQuery('goi cuon', 'Gỏi cuốn')).toBe(true)
  })

  it('matches đ against d', () => {
    expect(matchesQuery('do uong', 'Đồ uống')).toBe(true)
  })

  it('matches any of the provided fields', () => {
    expect(matchesQuery('HD-2026', 'Trà đào', 'HD-20261118-001')).toBe(true)
  })

  it('treats an empty query as a match', () => {
    expect(matchesQuery('   ', 'Bất kỳ')).toBe(true)
  })

  it('returns false when no field contains the query', () => {
    expect(matchesQuery('pizza', 'Cà phê nóng', 'Đồ uống')).toBe(false)
  })
})
