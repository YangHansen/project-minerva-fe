export type HighlightAction = 'apply' | 'remove' | 'recolor'

export function decideHighlightAction(selectedColors: string[], chosenColor: string): HighlightAction {
  if (!selectedColors.length) return 'apply'
  return selectedColors.every((color) => color === chosenColor) ? 'remove' : 'recolor'
}
export function preferEditorSelection<T>(liveSelection: T | null, savedSelection: T | null): T | null {
  return liveSelection ?? savedSelection
}