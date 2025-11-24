export async function submitSearch(personName: string): Promise<string | undefined> {
  const formData = new URLSearchParams();
  formData.append('vzorek', personName);

  try {
    const response = await fetch('/auth/lide/index.pl', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      credentials: 'include', // Important for maintaining session/auth
    });

    const html = await response.text();
    return html;
  } catch (error) {
    console.error('Error searching for person:', error);
    return undefined;
  }
}
