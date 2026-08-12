export type DocumentTemplate = {
  id: string
  name: string
  description: string
  previewTitle: string
  tone: 'violet' | 'blue' | 'emerald' | 'amber' | 'slate'
  content: string
  kind?: 'essay' | 'cv' | 'study' | 'research' | 'custom'
}

export const documentTemplates: DocumentTemplate[] = [
  {
    id: 'cv-profile',
    name: 'CV / Resume',
    description: 'A concise profile, experience, and achievements.',
    previewTitle: 'Professional profile',
    tone: 'amber',
    kind: 'cv',
    content: '<h2>Profile</h2><p>Summarise your focus, strengths, and goal in three to four sentences.</p><h2>Selected experience</h2><p>Role - Organisation - Dates</p><ul><li>Describe a measurable contribution or result.</li></ul><h2>Education and achievements</h2><p>Add the most relevant qualifications and recognition.</p>',
  },
  {
    id: 'scholarship-essay',
    name: 'Essay',
    description: 'Motivation, evidence, and future contribution.',
    previewTitle: 'My scholarship journey',
    tone: 'violet',
    kind: 'essay',
    content: '<h2>Why I am applying</h2><p>Explain your motivation and the opportunity you hope to create.</p><h2>Experience and impact</h2><p>Use one clear example with the actions you took and the result.</p><h2>Future contribution</h2><p>Connect your study plan to the community you will support.</p>',
  },
  {
    id: 'study-plan',
    name: 'Study Plan',
    description: 'Goals, learning plan, and expected outcomes.',
    previewTitle: 'Study roadmap',
    tone: 'emerald',
    kind: 'study',
    content: '<h2>Academic goal</h2><p>State the knowledge or capability you want to develop.</p><h2>Learning plan</h2><p>Describe the programme, activities, and timeline.</p><h2>Expected outcome</h2><p>Show how you will use the learning after graduation.</p>',
  },
  {
    id: 'research-plan',
    name: 'Research Plan',
    description: 'Research question, methods, and expected contribution.',
    previewTitle: 'Research outline',
    tone: 'blue',
    kind: 'research',
    content: '<h2>Research question</h2><p>State the problem or question you want to investigate.</p><h2>Method</h2><p>Describe your approach, data sources, and feasibility.</p><h2>Expected contribution</h2><p>Explain the impact of your findings for the field or community.</p>',
  },
  {
    id: 'blank',
    name: 'Empty document',
    description: 'Start a clean page from scratch.',
    previewTitle: 'Untitled document',
    tone: 'slate',
    kind: 'custom',
    content: '<p></p>',
  },
]
