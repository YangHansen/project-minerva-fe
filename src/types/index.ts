export interface LanguageCertificate { type: string; score: string }

export interface UserProfile {
  name: string
  age: number | null
  country: string
  destinationCountry: string
  currentEducationLevel: string
  targetEducationLevel: string
  gpa: string
  fieldOfStudy: string
  scholarshipType: string
  fundingPreference: string
  englishLevel: string
  ieltsScore: string
  languageCertificate: string
  languageScore: string
  languageCertificates: LanguageCertificate[]
  availableDocuments: string[]
  enrollmentYear: string
}

export interface Scholarship {
  id: string; name: string; provider: string; country: string; university: string
  program: string; educationLevel: string; fieldOfStudy: string; fundingType: string
  scholarshipType: string; eligibilitySummary: string; deadline: string
  applicationUrl: string; requiredDocuments: string[]; matchPercentage: number; featured: boolean
}

export type ChecklistStatus = 'pending' | 'in_progress' | 'done'
export interface ChecklistItem {
  id: string
  title: string
  description: string
  category: string
  required: boolean
  status: ChecklistStatus
  notes: string
}

export type DocumentKind = 'cv' | 'essay' | 'personal' | 'purpose' | 'study' | 'research' | 'transcript' | 'custom'
export type DocumentStatus = 'missing' | 'draft' | 'ready'
export interface DocumentVersion { id: string; label: string; content: string; createdAt: string }
export interface DocumentSuggestion {
  id: string
  title: string
  detail: string
  replacement: string
  tone: 'purple' | 'yellow' | 'blue' | 'green'
  originalText?: string
  category?: string
  priority?: 'high' | 'medium' | 'low'
  dismissed?: boolean
  accepted?: boolean
}
export interface DocumentReview {
  id?: string
  overall: number
  clarity: number
  grammar: number
  structure: number
  impact: number
  scholarshipAlignment?: number
  summary: string
  strengths?: string[]
  suggestions: DocumentSuggestion[]
  reviewedAt: string
  sourceFingerprint?: string
}
export interface ScholarshipDocument {
  id: string
  kind: DocumentKind
  title: string
  description: string
  category: string
  prompt: string
  content: string
  uploadName: string
  status: DocumentStatus
  updatedAt: string
  versions: DocumentVersion[]
  review?: DocumentReview
}
export interface PracticeResult { type: string; score: number; completedAt: string; explanation: string }
export interface Mentor { id: string; name: string; initials: string; photo: string; expertise: string; scholarshipExperience: string; highlight: string; services: string[]; sessionPrice: string; availableTimes: string[]; rating: number; biography: string }
export interface MentorBooking { mentorId: string; mentorName: string; service: string; date: string; time: string; notes: string }
export interface Notification { id: string; title: string; read: boolean; createdAt: string }
export interface PricingPlan { name: string; status: string; features: string[]; highlighted?: boolean }
export interface MockSession { id?: string; name: string; email: string; role?: string }
