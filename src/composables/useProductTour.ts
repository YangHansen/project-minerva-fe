import { nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, type Router } from 'vue-router'
import { driver, type DriveStep, type Driver } from 'driver.js'

const STORAGE_PREFIX = 'minerva-tour:'
const JOURNEY_STEP_KEY = `${STORAGE_PREFIX}journey-step`
const JOURNEY_DONE_KEY = `${STORAGE_PREFIX}journey-done`

export type ProductTourId = 'interview-home' | 'interview-live'
export type JourneyPageId = 'discover' | 'documents' | 'test' | 'interview' | 'mentors' | 'tokens'

type JourneyPage = {
  id: JourneyPageId
  path: string
  title: string
  description: string
  selector: string
  nextLabel: string
}

export const SCHOLAR_JOURNEY: JourneyPage[] = [
  {
    id: 'discover',
    path: '/scholarships',
    title: 'Step 1 · Find a scholarship',
    description: 'Browse scholarships here and add one to start your preparation folder.',
    selector: '[data-tour="page-discover"]',
    nextLabel: 'Next',
  },
  {
    id: 'documents',
    path: '/documents',
    title: 'Step 2 · Write your documents',
    description: 'Create your CV, essay, or study plan for the scholarship you chose.',
    selector: '[data-tour="page-documents"]',
    nextLabel: 'Next',
  },
  {
    id: 'test',
    path: '/test-prep',
    title: 'Step 3 · Practice the test',
    description: 'Use IELTS Test Prep to practise Listening, Reading, Writing, and Speaking.',
    selector: '[data-tour="page-test"]',
    nextLabel: 'Next',
  },
  {
    id: 'interview',
    path: '/interview-prep',
    title: 'Step 4 · Practice the interview',
    description: 'Rehearse scholarship interviews with Minerva before the real one.',
    selector: '[data-tour="page-interview"]',
    nextLabel: 'Next',
  },
  {
    id: 'mentors',
    path: '/mentors',
    title: 'Step 5 · Talk to a mentor',
    description: 'Book a mentor when you want human feedback on essays, tests, or interviews.',
    selector: '[data-tour="page-mentors"]',
    nextLabel: 'Next',
  },
  {
    id: 'tokens',
    path: '/payment',
    title: 'Step 6 · Tokens',
    description: 'Optional AI feedback uses tokens. Check your balance and top up when you need more practice.',
    selector: '[data-tour="page-tokens"]',
    nextLabel: 'Finish',
  },
]

let activeTour: Driver | null = null
let showTimer: number | undefined
let waitTimer: number | undefined
let navigatingJourney = false

const readJson = <T>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

export const hasSeenTour = (id: ProductTourId) => {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${id}`) === '1'
  } catch {
    return false
  }
}

export const markTourSeen = (id: ProductTourId) => {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${id}`, '1')
  } catch {
    // Ignore private-mode storage failures.
  }
}

export const hasCompletedScholarJourney = () => {
  try {
    return localStorage.getItem(JOURNEY_DONE_KEY) === '1'
  } catch {
    return false
  }
}

export const getActiveJourneyStep = (): number | null => {
  const step = readJson<number | null>(JOURNEY_STEP_KEY, null)
  return typeof step === 'number' && step >= 0 && step < SCHOLAR_JOURNEY.length ? step : null
}

const setActiveJourneyStep = (step: number | null) => {
  try {
    if (step === null) localStorage.removeItem(JOURNEY_STEP_KEY)
    else localStorage.setItem(JOURNEY_STEP_KEY, JSON.stringify(step))
  } catch {
    // Ignore private-mode storage failures.
  }
}

export const isScholarJourneyActive = () => getActiveJourneyStep() !== null

export const destroyActiveTour = () => {
  window.clearTimeout(showTimer)
  window.clearTimeout(waitTimer)
  if (!activeTour) return
  const tour = activeTour
  activeTour = null
  try {
    tour.destroy()
  } catch {
    // Tour may already be destroyed during route changes.
  }
}

const waitForElement = (selector: string, tries = 20): Promise<HTMLElement | null> => new Promise((resolve) => {
  const attempt = (left: number) => {
    const el = document.querySelector(selector)
    if (el instanceof HTMLElement) {
      resolve(el)
      return
    }
    if (left <= 0) {
      resolve(null)
      return
    }
    waitTimer = window.setTimeout(() => attempt(left - 1), 100)
  }
  attempt(tries)
})

const finishJourney = () => {
  navigatingJourney = false
  setActiveJourneyStep(null)
  try {
    localStorage.setItem(JOURNEY_DONE_KEY, '1')
  } catch {
    // Ignore private-mode storage failures.
  }
  destroyActiveTour()
}

const goToJourneyStep = async (router: Router, step: number) => {
  if (step < 0 || step >= SCHOLAR_JOURNEY.length) {
    finishJourney()
    return
  }
  const page = SCHOLAR_JOURNEY[step]
  const alreadyThere = router.currentRoute.value.path === page.path
  navigatingJourney = true
  setActiveJourneyStep(step)
  destroyActiveTour()
  if (!alreadyThere) await router.push(page.path)
  navigatingJourney = false
  if (alreadyThere) await showJourneyPage(router, page, step)
}

export const beginScholarJourney = async (router: Router) => {
  try {
    localStorage.removeItem(JOURNEY_DONE_KEY)
  } catch {
    // Ignore private-mode storage failures.
  }
  await goToJourneyStep(router, 0)
}

const showJourneyPage = async (router: Router, page: JourneyPage, step: number) => {
  destroyActiveTour()
  const target = await waitForElement(page.selector)
  const isLast = step >= SCHOLAR_JOURNEY.length - 1

  // Driver.js treats a single-step tour as "done", so non-final pages get a
  // hidden second step to keep the primary action labeled "Next".
  const pageStep: DriveStep = {
    ...(target ? { element: page.selector } : {}),
    popover: {
      title: page.title,
      description: page.description,
      side: target ? 'bottom' : undefined,
      align: 'start',
    },
  }
  const steps: DriveStep[] = isLast
    ? [pageStep]
    : [pageStep, { popover: { title: 'Continuing', description: 'Loading the next page…' } }]

  const continueJourney = () => {
    if (isLast) {
      finishJourney()
      return
    }
    void goToJourneyStep(router, step + 1)
  }

  const tour = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    smoothScroll: true,
    overlayColor: 'rgba(23, 19, 107, 0.55)',
    stagePadding: 10,
    stageRadius: 16,
    popoverClass: 'minerva-tour-popover',
    progressText: `${step + 1} of ${SCHOLAR_JOURNEY.length}`,
    showButtons: isLast ? ['next', 'close'] : ['next', 'close'],
    nextBtnText: isLast ? 'Finish' : 'Next',
    doneBtnText: 'Finish',
    steps,
    onNextClick: (_element, _step, { state }) => {
      // On non-final pages, only the first step is real; never show the placeholder.
      if (!isLast && (state.activeIndex ?? 0) > 0) {
        continueJourney()
        return
      }
      continueJourney()
    },
    onDoneClick: () => {
      finishJourney()
    },
    onCloseClick: () => {
      finishJourney()
    },
    onPopoverRender: (popover) => {
      if (popover.nextButton) {
        popover.nextButton.textContent = isLast ? 'Finish' : 'Next'
      }
      // Keep a Finish action beside Next so users can end the path early.
      if (!isLast && popover.footerButtons && !popover.footerButtons.querySelector('[data-minerva-finish]')) {
        const finishBtn = document.createElement('button')
        finishBtn.type = 'button'
        finishBtn.dataset.minervaFinish = '1'
        finishBtn.className = 'driver-popover-prev-btn'
        finishBtn.textContent = 'Finish'
        finishBtn.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          finishJourney()
        })
        popover.footerButtons.insertBefore(finishBtn, popover.nextButton)
      }
    },
    onDestroyed: () => {
      if (activeTour === tour) activeTour = null
      if (!navigatingJourney && getActiveJourneyStep() === step) {
        setActiveJourneyStep(null)
        try {
          localStorage.setItem(JOURNEY_DONE_KEY, '1')
        } catch {
          // Ignore private-mode storage failures.
        }
      }
    },
  })

  activeTour = tour
  showTimer = window.setTimeout(() => {
    if (activeTour === tour) tour.drive()
  }, 160)
}

/** Call from each journey page so the active step opens on that page only. */
export const useScholarJourneyPage = (pageId: JourneyPageId) => {
  const router = useRouter()

  const maybeShow = async () => {
    const step = getActiveJourneyStep()
    if (step === null) return
    const page = SCHOLAR_JOURNEY[step]
    if (!page || page.id !== pageId) return
    await nextTick()
    await showJourneyPage(router, page, step)
  }

  onMounted(() => {
    void maybeShow()
  })

  onBeforeUnmount(() => {
    const step = getActiveJourneyStep()
    const page = step === null ? null : SCHOLAR_JOURNEY[step]
    if (page?.id === pageId) destroyActiveTour()
  })
}

export const startProductTour = (
  id: ProductTourId,
  steps: DriveStep[],
  options: { force?: boolean } = {},
) => {
  if (isScholarJourneyActive()) return null
  if (!options.force && hasSeenTour(id)) return null

  destroyActiveTour()
  const visible = steps.filter((step) => {
    if (!step.element) return true
    const target = typeof step.element === 'string' ? document.querySelector(step.element) : null
    return target instanceof HTMLElement
  })
  if (!visible.length) return null

  const tour = driver({
    showProgress: true,
    animate: true,
    allowClose: true,
    smoothScroll: true,
    overlayColor: 'rgba(23, 19, 107, 0.55)',
    stagePadding: 10,
    stageRadius: 16,
    popoverClass: 'minerva-tour-popover',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Got it',
    steps: visible,
    onDestroyed: () => {
      markTourSeen(id)
      if (activeTour === tour) activeTour = null
    },
  })
  activeTour = tour
  showTimer = window.setTimeout(() => {
    if (activeTour === tour) tour.drive()
  }, 120)
  return tour
}

export const interviewHomeTourSteps = (): DriveStep[] => [
  {
    element: '[data-tour="interview-start"]',
    popover: {
      title: 'Start a practice interview',
      description: 'Pick a scholarship, add optional context, and practise with Minerva.',
      side: 'bottom',
      align: 'start',
    },
  },
  {
    element: '[data-tour="interview-history"]',
    popover: {
      title: 'Review past sessions',
      description: 'Reopen saved transcripts and AI analysis anytime.',
      side: 'bottom',
      align: 'start',
    },
  },
]

export const interviewLiveTourSteps = (): DriveStep[] => [
  {
    element: '[data-tour="interview-conversation"]',
    popover: {
      title: 'Conversation',
      description: 'Your chat with Minerva stays in this scrollable panel.',
      side: 'left',
      align: 'center',
    },
  },
  {
    element: '[data-tour="interview-mic"]',
    popover: {
      title: 'Record your answer',
      description: 'Tap the mic to speak. Minerva replies and may ask a follow-up.',
      side: 'top',
      align: 'center',
    },
  },
]
