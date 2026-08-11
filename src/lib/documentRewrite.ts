export interface RewriteCandidate<T> {
  pageId: string
  value: T
}

/**
 * Prefer one unambiguous match on the page the user selected. If the active
 * page has no match, a single match elsewhere is still safe. Multiple matches
 * inside the selected page remain ambiguous and are rejected.
 */
export function chooseRewriteCandidate<T>(candidates: RewriteCandidate<T>[], activePageId: string) {
  const activeCandidates = candidates.filter((candidate) => candidate.pageId === activePageId)
  if (activeCandidates.length === 1) return activeCandidates[0]?.value
  if (activeCandidates.length > 1) return undefined
  return candidates.length === 1 ? candidates[0]?.value : undefined
}
