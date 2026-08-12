import { apiRequest, API_BASE_URL } from '../api'

export type IeltsSection = 'reading' | 'listening' | 'writing' | 'speaking'
export type IeltsQuestionType = 'gap-fill' | 'mcq' | 'matching'

export interface IeltsQuestion {
  questionText: string
  type: IeltsQuestionType
  options: string[]
}

export interface IeltsExercise {
  id: string
  section: IeltsSection
  title: string
  instruction: string  // Per-part instructions from backend
  content: string
  graphUrl: string | null
  audioUrl: string | null
  order: number
  questions: IeltsQuestion[]
}

export interface IeltsSubmissionResult {
  id: string
  exerciseId: string
  section: IeltsSection
  score: number
  totalQuestions: number
  estimatedBand: number
  feedback: string
  review?: Array<{ question: string; yourAnswer: string; correctAnswer: string; explanation: string; isCorrect: boolean }>
}

export interface IeltsSkillBand {
  section: 'listening' | 'reading'
  score: number
  totalQuestions: number
  estimatedBand: number
  feedback: string
}
export interface IeltsSubmissionHistoryItem {
  id: string
  exerciseId: string
  section: IeltsSection
  score: number
  totalQuestions: number
  estimatedBand: number
  feedback: string
  createdAt: string
}

export interface IeltsAiEvaluation {
  estimatedBand?: number
  summary?: string
  strengths?: string[]
  improvements?: string[]
  taskAchievement?: { score: number; feedback: string }
  coherenceAndCohesion?: { score: number; feedback: string }
  lexicalResource?: { score: number; feedback: string }
  grammaticalRangeAndAccuracy?: { score: number; feedback: string }
  fluencyAndCoherence?: { score: number; feedback: string }
}

export interface IeltsEvaluationHistoryItem {
  id: string
  kind: 'writing' | 'speaking'
  task?: string
  prompt: string
  result: IeltsAiEvaluation
  createdAt: string
}

export interface IeltsWritingEvaluateRequest {
  task: string
  prompt: string
  response: string
}

export interface IeltsWritingEvaluateResponse {
  evaluationId: string
  evaluation: IeltsAiEvaluation
  tokenBalance: number
}

export interface IeltsSpeakingEvaluateResponse {
  evaluationId: string
  transcript: { text: string; chunks: unknown[]; language: string }
  evaluation: IeltsAiEvaluation
  tokenBalance: number
}

export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null
  try {
    const url = new URL(path, API_BASE_URL)
    if (url.hostname === 'example.com') return null
    if (url.hostname === 'drive.google.com') {
      const fileId = url.pathname.match(/\/file\/d\/([^/]+)/)?.[1]
      if (fileId) return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`
    }
    return url.toString()
  } catch {
    return null
  }
}

export async function getIeltsSet(setNumber: number): Promise<IeltsExercise[]> {
  const result = await apiRequest<{ set: { setNumber: number; exercises: IeltsExercise[] } }>(`/api/ielts/sets/${setNumber}`)
  return result.set.exercises
}

export async function submitIeltsSet(
  setNumber: number,
  exercises: Array<{ exerciseId: string; answers: Array<string | number> }>,
): Promise<{ submissions: IeltsSubmissionResult[]; skillBands: IeltsSkillBand[] }> {
  const result = await apiRequest<{ submissions: IeltsSubmissionResult[]; skillBands: IeltsSkillBand[] }>(
    `/api/ielts/sets/${setNumber}/submissions`,
    { method: 'POST', body: { exercises } },
  )
  return result
}

export async function getIeltsSubmissions(): Promise<IeltsSubmissionHistoryItem[]> {
  return (await apiRequest<{ submissions: IeltsSubmissionHistoryItem[] }>('/api/ielts/submissions')).submissions
}

export async function getIeltsEvaluations(): Promise<IeltsEvaluationHistoryItem[]> {
  return (await apiRequest<{ evaluations: IeltsEvaluationHistoryItem[] }>('/api/ielts/evaluations')).evaluations
}

export async function evaluateIeltsWriting(body: IeltsWritingEvaluateRequest): Promise<IeltsWritingEvaluateResponse> {
  return apiRequest<IeltsWritingEvaluateResponse>('/api/ielts/writing/evaluate', { method: 'POST', body })
}

export async function evaluateIeltsSpeaking(form: FormData): Promise<IeltsSpeakingEvaluateResponse> {
  return apiRequest<IeltsSpeakingEvaluateResponse>('/api/ielts/speaking/evaluate', { method: 'POST', body: form })
}

export interface IeltsSpeakingTurnResponse {
  turnId: string
  transcript: { text: string; chunks: unknown[]; language?: string }
  examiner: { text: string; nextQuestion?: string; shouldContinue: boolean }
  tokenBalance: number
  voice?: { dataUrl: string; contentType: string; text?: string }
}

export async function submitIeltsSpeakingTurn(form: FormData): Promise<IeltsSpeakingTurnResponse> {
  return apiRequest<IeltsSpeakingTurnResponse>('/api/ielts/speaking/turn', { method: 'POST', body: form })
}

export async function fetchIeltsSpeakingQuestionVoice(body: {
  text: string
  introduction?: string
  part?: number
}): Promise<{ voice?: { dataUrl: string; contentType: string; text?: string } | null; reason?: string }> {
  return apiRequest('/api/ielts/speaking/question-voice', { method: 'POST', body })
}