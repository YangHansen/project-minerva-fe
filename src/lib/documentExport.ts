export interface ExportPage {
  title: string
  content: string
}

export interface ExportDocument {
  title: string
  pages: ExportPage[]
}

interface ExportRun {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  highlight?: string
  link?: string
  font?: string
}

interface ExportBlock {
  type: 'paragraph' | 'heading2' | 'heading3' | 'bullet' | 'number'
  runs: ExportRun[]
  listIndex?: number
}

const safeFilename = (value: string) => value
  .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/[. ]+$/g, '')
  .slice(0, 100) || 'Minerva document'

const inlineRuns = (node: Node, inherited: Omit<ExportRun, 'text'> = {}): ExportRun[] => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = (node.textContent || '').replace(/\s+/g, ' ')
    return text ? [{ ...inherited, text }] : []
  }
  if (!(node instanceof HTMLElement)) return []
  if (node.tagName === 'BR') return [{ ...inherited, text: '\n' }]

  const tag = node.tagName
  const next = {
    ...inherited,
    bold: inherited.bold || tag === 'B' || tag === 'STRONG',
    italic: inherited.italic || tag === 'I' || tag === 'EM',
    underline: inherited.underline || tag === 'U' || tag === 'A',
    strike: inherited.strike || tag === 'S' || tag === 'STRIKE',
    highlight: tag === 'MARK' ? (node.dataset.highlight || 'yellow') : inherited.highlight,
    link: tag === 'A' ? node.getAttribute('href') || undefined : inherited.link,
    font: tag === 'FONT' ? node.getAttribute('face') || undefined : inherited.font,
  }
  return [...node.childNodes].flatMap((child) => inlineRuns(child, next))
}

const parsePage = (html: string): ExportBlock[] => {
  const root = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html').body.firstElementChild
  if (!root) return []
  const blocks: ExportBlock[] = []

  const append = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent || '').trim()
      if (text) blocks.push({ type: 'paragraph', runs: [{ text }] })
      return
    }
    if (!(node instanceof HTMLElement)) return
    const tag = node.tagName
    if (tag === 'UL' || tag === 'OL') {
      for (const [index, item] of [...node.children].entries()) {
        if (item.tagName === 'LI') blocks.push({ type: tag === 'UL' ? 'bullet' : 'number', runs: inlineRuns(item), listIndex: index + 1 })
      }
      return
    }
    if (tag === 'H2' || tag === 'H3' || tag === 'P' || tag === 'DIV' || tag === 'BLOCKQUOTE') {
      const runs = inlineRuns(node)
      if (runs.some((run) => run.text.trim())) {
        blocks.push({ type: tag === 'H2' ? 'heading2' : tag === 'H3' ? 'heading3' : 'paragraph', runs })
      }
      return
    }
    for (const child of [...node.childNodes]) append(child)
  }

  for (const child of [...root.childNodes]) append(child)
  return blocks
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function createDocxBlob(source: ExportDocument) {
  const {
    AlignmentType,
    Document,
    HeadingLevel,
    HighlightColor,
    PageBreak,
    Packer,
    Paragraph,
    TextRun,
  } = await import('docx')

  const highlightMap: Record<string, (typeof HighlightColor)[keyof typeof HighlightColor]> = {
    yellow: HighlightColor.YELLOW,
    green: HighlightColor.GREEN,
    blue: HighlightColor.CYAN,
    pink: HighlightColor.MAGENTA,
    purple: HighlightColor.DARK_MAGENTA,
  }
  const children: InstanceType<typeof Paragraph>[] = []

  source.pages.forEach((page, pageIndex) => {
    if (pageIndex) children.push(new Paragraph({ children: [new PageBreak()] }))
    const blocks = parsePage(page.content)
    if (!blocks.length) children.push(new Paragraph({ children: [new TextRun('')] }))

    for (const block of blocks) {
      const runs = block.runs.map((run) => new TextRun({
        text: run.text,
        bold: run.bold,
        italics: run.italic,
        underline: run.underline ? {} : undefined,
        strike: run.strike,
        highlight: run.highlight ? highlightMap[run.highlight] || HighlightColor.YELLOW : undefined,
        color: run.link ? '5B45F5' : undefined,
        font: run.font,
      }))
      children.push(new Paragraph({
        children: runs,
        heading: block.type === 'heading2' ? HeadingLevel.HEADING_2 : block.type === 'heading3' ? HeadingLevel.HEADING_3 : undefined,
        bullet: block.type === 'bullet' ? { level: 0 } : undefined,
        numbering: block.type === 'number' ? { reference: 'minerva-numbered', level: 0 } : undefined,
        spacing: block.type.startsWith('heading') ? { before: 240, after: 100 } : { after: 160, line: 300 },
      }))
    }
  })

  const exported = new Document({
    title: source.title,
    creator: 'Minerva',
    numbering: {
      config: [{
        reference: 'minerva-numbered',
        levels: [{
          level: 0,
          format: 'decimal',
          text: '%1.',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      children,
    }],
  })
  return Packer.toBlob(exported)
}

export async function exportAsDocx(source: ExportDocument) {
  downloadBlob(await createDocxBlob(source), `${safeFilename(source.title)}.docx`)
}

export async function createPdfBlob(source: ExportDocument) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'letter', orientation: 'portrait' })
  const margin = 72
  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - margin) return
    pdf.addPage()
    y = margin
  }

  source.pages.forEach((page, pageIndex) => {
    if (pageIndex) {
      pdf.addPage()
      y = margin
    }
    const blocks = parsePage(page.content)
    for (const block of blocks) {
      const isHeading = block.type === 'heading2' || block.type === 'heading3'
      const fontSize = block.type === 'heading2' ? 16 : block.type === 'heading3' ? 13 : 11
      const lineHeight = fontSize * 1.45
const prefix = block.type === 'bullet' ? '- ' : block.type === 'number' ? `${block.listIndex || 1}. ` : ''
      const text = `${prefix}${block.runs.map((run) => run.text).join('')}`.trim()
      if (!text) continue
      const requestedFont = block.runs.find((run) => run.font)?.font?.toLowerCase() || ''
      const pdfFont = /times|georgia|garamond|cambria/.test(requestedFont) ? 'times' : /courier/.test(requestedFont) ? 'courier' : 'helvetica'
      pdf.setFont(pdfFont, isHeading ? 'bold' : 'normal')
      pdf.setFontSize(fontSize)
      pdf.setTextColor(isHeading ? 23 : 51, isHeading ? 19 : 65, isHeading ? 107 : 85)
      const indent = prefix ? 18 : 0
      const lines = pdf.splitTextToSize(text, contentWidth - indent) as string[]
      ensureSpace(lines.length * lineHeight + (isHeading ? 12 : 8))
      pdf.text(lines, margin + indent, y)
      y += lines.length * lineHeight + (isHeading ? 12 : 8)
    }
  })

  const totalPages = pdf.getNumberOfPages()
  for (let page = 1; page <= totalPages; page += 1) {
    pdf.setPage(page)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(130, 140, 160)
    pdf.text(`${page} / ${totalPages}`, pageWidth - margin, pageHeight - 36, { align: 'right' })
  }
  pdf.setProperties({ title: source.title, author: 'Minerva' })
  return pdf.output('blob')
}

export async function exportAsPdf(source: ExportDocument) {
  downloadBlob(await createPdfBlob(source), `${safeFilename(source.title)}.pdf`)
}

export { safeFilename }
