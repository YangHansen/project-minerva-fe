export interface UserProfile {
  name: string
  age: number | null
  country: string
  destinationCountry: string
  currentEducationLevel: string
  targetEducationLevel: string
  fieldOfStudy: string
  scholarshipType: string
  fundingPreference: string
  englishLevel: string
  ieltsScore: string
  availableDocuments: string[]
  enrollmentYear: string
}

export interface Scholarship {
  id: string; name: string; provider: string; country: string; university: string
  program: string; educationLevel: string; fieldOfStudy: string; fundingType: string
  scholarshipType: string; eligibilitySummary: string; deadline: string
  applicationUrl: string; requiredDocuments: string[]; matchPercentage: number; featured: boolean
}

export interface ChecklistItem { id: string; title: string; category: string; required: boolean; completed: boolean; notes: string }
export interface DocumentReview { type: 'cv' | 'essay'; score: number; summary: string; suggestions: string[] }
export interface PracticeResult { type: string; score: number; completedAt: string; explanation: string }
export interface Mentor { id: string; name: string; initials: string; expertise: string; scholarshipExperience: string; services: string[]; sessionPrice: string; availableTimes: string[]; rating: number; biography: string }
export interface MentorBooking { mentorId: string; mentorName: string; service: string; date: string; time: string; notes: string }
export interface Notification { id: string; title: string; read: boolean; createdAt: string }
export interface PricingPlan { name: string; status: string; features: string[]; highlighted?: boolean }
export interface MockSession { name: string; email: string }
