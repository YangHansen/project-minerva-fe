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
}

export interface IeltsSubmissionHistoryItem {
  id: string
  exerciseId: string
  section: IeltsSection
  score: number
  totalQuestions: number
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
  return path ? (path.startsWith('http') ? path : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`) : null
}

export async function getIeltsSet(setNumber: number): Promise<IeltsExercise[]> {
  const result = await apiRequest<{ set: { setNumber: number; exercises: IeltsExercise[] } }>(`/api/ielts/sets/${setNumber}`)
  return result.set.exercises
}

export async function submitIeltsSet(
  setNumber: number,
  exercises: Array<{ exerciseId: string; answers: Array<string | number> }>,
): Promise<IeltsSubmissionResult[]> {
  const result = await apiRequest<{ submissions: IeltsSubmissionResult[] }>(
    `/api/ielts/sets/${setNumber}/submissions`,
    { method: 'POST', body: { exercises } },
  )
  return result.submissions
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
