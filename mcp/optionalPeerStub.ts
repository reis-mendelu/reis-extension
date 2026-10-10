// Stand-in for officeparser's optional parts: pdf-lib and puppeteer (PDF
// generation and rendering) and tesseract.js (OCR, opt-in and never enabled).
// reIS for Claude only reads text. Without this alias Vite inlines a module that throws at load,
// because the bundle evaluates officeparser's lazy imports eagerly.
export default {};
