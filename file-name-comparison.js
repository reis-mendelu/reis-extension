/**
 * Example of what file UI labels look like in Czech vs English
 * Based on IS Mendelu patterns and the HTML you provided
 */

// Czech version (lang=cz):
const czechUILabels = {
  breadcrumbs: 'Přihlášení do systému',
  folderLabel: 'Složka',
  fileLabel: 'Soubor',
  nameHeader: 'Název',
  commentHeader: 'Komentář',
  authorHeader: 'Autor',
  dateHeader: 'Datum',
  sizeHeader: 'Velikost',
  helpText: 'Zobrazit nápovědu k aplikaci',
};

// English version (lang=en):
const englishUILabels = {
  breadcrumbs: 'Log in to system',
  folderLabel: 'Folder',
  fileLabel: 'File',
  nameHeader: 'Name',
  commentHeader: 'Comment',
  authorHeader: 'Author',
  dateHeader: 'Date',
  sizeHeader: 'Size',
  helpText: 'View application help',
};

/**
 * IMPORTANT: The file NAMES themselves (uploaded by teachers) don't change
 * Example: "Lecture_01.pdf" stays "Lecture_01.pdf" in both languages
 *
 * What DOES change:
 * - UI labels (headers, buttons, breadcrumbs)
 * - Folder structure labels (if any)
 * - File metadata display (dates, sizes)
 */

console.log('Czech UI:', czechUILabels);
console.log('English UI:', englishUILabels);

/**
 * Expected impact on reIS extension:
 * When user switches to English, they'll see:
 * - "Folder" instead of "Složka" in breadcrumbs
 * - "Name" instead of "Název" in table headers
 * - But actual .pdf/.docx filenames stay the same
 */
