import { describe, expect, it } from 'bun:test'
import { chooseRewriteCandidate } from '../src/lib/documentRewrite'

describe('chooseRewriteCandidate', () => {
  it('uses the selected page when the same passage exists on multiple pages', () => {
    const candidates = [
      { pageId: 'page-1', value: 'first-page-match' },
      { pageId: 'page-2', value: 'selected-page-match' },
    ]

    expect(chooseRewriteCandidate(candidates, 'page-2')).toBe('selected-page-match')
  })

  it('rejects multiple matches inside the selected page', () => {
    const candidates = [
      { pageId: 'page-2', value: 'first-match' },
      { pageId: 'page-2', value: 'second-match' },
    ]

    expect(chooseRewriteCandidate(candidates, 'page-2')).toBeUndefined()
  })

  it('uses a sole match from another page', () => {
    expect(chooseRewriteCandidate([{ pageId: 'page-1', value: 'only-match' }], 'page-2')).toBe('only-match')
  })
})
