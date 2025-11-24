/**
 * A reusable core search function that communicates with the MENDELU global search endpoint.
 * @param query The search string.
 * @param areas An array of areas to search in (e.g., ['lide', 'predmety']).
 * @returns A promise that resolves with the HTML content string.
 */
async function executeSearch(query: string, areas: string[]): Promise<string | undefined> {
  const formData = new URLSearchParams();
  formData.append('vzorek', query);
  formData.append('vyhledat', 'Vyhledat');

  // Add each search area to the form data
  areas.forEach(area => {
    formData.append('oblasti', area);
  });

  try {
    const response = await fetch('/auth/hledani/index.pl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error(`Error during search in areas [${areas.join(', ')}]:`, error);
  }
}

/**
 * Performs a general search across People, Subjects, and Documents.
 * @param query The search string.
 */
export async function searchGeneral(query: string): Promise<string | undefined> {
  return executeSearch(query, ['lide', 'predmety', 'ds']);
}

/**
 * Performs a search specifically for People.
 * @param query The person's name to search for.
 */
export async function searchPeople(query: string): Promise<string | undefined> {
  return executeSearch(query, ['lide']);
}

/**
 * Performs a search specifically for Subjects (Předměty).
 * @param query The subject name or code to search for.
 */
export async function searchSubjects(query: string): Promise<string | undefined> {
  return executeSearch(query, ['predmety']);
}

/**
 * Performs a search specifically for Documents in the Document Server.
 * @param query The document title or keyword to search for.
 */
export async function searchDocuments(query: string): Promise<string | undefined> {
  return executeSearch(query, ['ds']);
}