// Stand-in for officeparser's optional parts: pdf-lib, @pdf-lib/fontkit and
// puppeteer (its PDF output engines) and tesseract.js (OCR, opt-in and never
// enabled). reIS for Claude only reads text. Without this alias Vite inlines a
// module that throws at load, because the bundle evaluates officeparser's lazy
// imports eagerly. mcp/__tests__/optionalPeers.test.ts fails when officeparser
// declares an optional peer that is not aliased here.
export default {};
