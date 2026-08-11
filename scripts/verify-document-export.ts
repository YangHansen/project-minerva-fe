import { mkdir } from 'node:fs/promises'
import { Window } from 'happy-dom'
import { createDocxBlob, createPdfBlob } from '../src/lib/documentExport'

const browser = new Window({ url: 'https://minerva.local/' })
Object.assign(globalThis, {
  DOMParser: browser.DOMParser,
  HTMLElement: browser.HTMLElement,
  Node: browser.Node,
  document: browser.document,
  window: browser,
})

const fixture = {
  title: 'Minerva Export QA',
  pages: [
    {
      title: 'Motivation',
      content: '<h2>Why I am applying</h2><p>I want to create <strong>measurable impact</strong> through education.</p><ul><li>Community leadership</li><li>Evidence-based programmes</li></ul><p><mark data-highlight="yellow">This sentence is highlighted.</mark></p>',
    },
    {
      title: 'Study plan',
      content: '<h2>Study plan</h2><p>My programme will strengthen research and policy skills.</p><ol><li>Build the research foundation</li><li>Apply it through a capstone project</li></ol>',
    },
  ],
}

await mkdir('tmp/export-qa', { recursive: true })
const [docx, pdf] = await Promise.all([createDocxBlob(fixture), createPdfBlob(fixture)])
await Promise.all([
  Bun.write('tmp/export-qa/minerva-export-qa.docx', docx),
  Bun.write('tmp/export-qa/minerva-export-qa.pdf', pdf),
])

if (docx.size < 1_000 || pdf.size < 1_000) throw new Error('Generated export is unexpectedly small')
console.log(JSON.stringify({ docxBytes: docx.size, pdfBytes: pdf.size }))
