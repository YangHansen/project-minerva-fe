import { describe, expect, it } from 'bun:test'
import { decideHighlightAction, preferEditorSelection } from '../src/lib/documentHighlight'

describe('decideHighlightAction', () => {
  it('applies a highlight to plain selected text', () => {
    expect(decideHighlightAction([], 'yellow')).toBe('apply')
  })

  it('removes a highlight when the selected color is clicked again', () => {
    expect(decideHighlightAction(['yellow'], 'yellow')).toBe('remove')
  })

  it('changes an existing highlight when a different color is selected', () => {
    expect(decideHighlightAction(['yellow'], 'blue')).toBe('recolor')
    expect(decideHighlightAction(['blue', 'pink'], 'purple')).toBe('recolor')
  })

  it('prefers the latest live editor selection and falls back to the saved range', () => {
    expect(preferEditorSelection('latest', 'stale')).toBe('latest')
    expect(preferEditorSelection(null, 'saved')).toBe('saved')
  })
})
