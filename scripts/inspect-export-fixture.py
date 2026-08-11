from docx import Document
from pypdf import PdfReader
from zipfile import ZipFile

docx_path = 'tmp/export-qa/minerva-export-qa.docx'
pdf_path = 'tmp/export-qa/minerva-export-qa.pdf'

document = Document(docx_path)
paragraphs = [((p.style.name if p.style else ''), p.text) for p in document.paragraphs if p.text]
with ZipFile(docx_path) as archive:
    xml = archive.read('word/document.xml').decode('utf-8')

pdf = PdfReader(pdf_path)
page_two = pdf.pages[1].extract_text() or ''

assert len(pdf.pages) == 2
assert '2. Apply it through a capstone project' in page_two
assert xml.count('w:type="page"') >= 1
assert '<w:numPr>' in xml
assert '<w:highlight' in xml
assert any(style == 'Heading 2' and text == 'Why I am applying' for style, text in paragraphs)

print({
    'docxParagraphs': paragraphs,
    'docxPageBreaks': xml.count('w:type="page"'),
    'pdfPages': len(pdf.pages),
})
