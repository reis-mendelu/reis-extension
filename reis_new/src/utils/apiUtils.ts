import type { FileObject, StoredSubject } from "../types/calendarTypes";

// Mock implementation for now as the original file had complex logic and imports
// We will implement the core fetching logic needed for the popup

export async function getStoredSubject(courseCode: string): Promise<StoredSubject | null> {
    // TODO: Implement actual storage retrieval or API call
    // For now, return a mock or null
    console.log(`Fetching stored subject for ${courseCode}`);
    // This would typically fetch from chrome.storage.local or similar
    return {
        fullName: "Mock Subject Name",
        folderUrl: "https://is.mendelu.cz/auth/dok_server/slozka.pl?id=12345"
    };
}

export async function getFilesFromId(folderId: string | null): Promise<FileObject[] | null> {
    if (!folderId) return null;

    // TODO: Implement actual API call to fetch files
    console.log(`Fetching files for folder ID: ${folderId}`);

    // Return mock data for demonstration
    return [
        {
            "subfolder": "",
            "file_name": "Průvodce studiem předmětu",
            "file_comment": "",
            "author": "P. Haluza",
            "date": "19. 9. 2025",
            "files": [
                {
                    "name": "Průvodce studiem předmětu",
                    "type": "pdf",
                    "link": "slozka.pl?id=152411;download=342005;z=1"
                }
            ]
        }
    ];
}
