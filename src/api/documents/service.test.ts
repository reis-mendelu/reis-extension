import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchFilesFromFolder } from './service';
import { fetchWithAuth } from '../client';
import { parseServerFiles } from './parser';
import type { ParsedFile } from '../../types/documents';

// Mock dependencies
vi.mock('../client');
vi.mock('./parser');
vi.mock('../../utils/validation/index', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../utils/validation/index')>();
    return {
        ...actual,
        sanitizeString: vi.fn(s => s),
        validateFileName: vi.fn(s => s),
        validateUrl: vi.fn(s => s)
    };
});
vi.mock('../../utils/requestQueue', () => ({
    requestQueue: { add: vi.fn(fn => fn()) },
    processWithDelay: vi.fn((items, processor) => Promise.all(items.map(processor)))
}));

describe('fetchFilesFromFolder', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default mocks
        vi.mocked(fetchWithAuth).mockResolvedValue({
            text: async () => '<html></html>',
            ok: true,
            status: 200,
        } as Response);
    });

    it('should fetch files from a single folder', async () => {
        vi.mocked(parseServerFiles).mockReturnValue({
            files: [{ file_name: 'test.pdf', link: 'http://test.com/test.pdf', files: [{ name: 'test.pdf', link: 'http://test.com/test.pdf', type: 'pdf' }] } as unknown as ParsedFile],
            paginationLinks: []
        });

        const result = await fetchFilesFromFolder('http://test.com');
        
        expect(result).toHaveLength(1);
        expect(result[0].file_name).toBe('test.pdf');
    });

    it('should throw error when root fetch fails', async () => {
        const error = new Error('Network error');
        vi.mocked(fetchWithAuth).mockRejectedValue(error);

        await expect(fetchFilesFromFolder('http://test.com')).rejects.toThrow('Network error');
    });

    it('should handle sub-folder fetch failure gracefully (resilience)', async () => {
        // First fetch (root) succeeds and returns a subfolder
        vi.mocked(fetchWithAuth).mockResolvedValueOnce({
            text: async () => 'root',
        } as Response);

        vi.mocked(parseServerFiles).mockReturnValueOnce({
            files: [{ 
                file_name: 'Subfolder', 
                files: [{ link: 'slozka.pl?id=123', name: 'Subfolder' }] 
            } as unknown as ParsedFile],
            paginationLinks: []
        });

        // Second fetch (subfolder) fails
        const subError = new Error('Subfolder failed');
        vi.mocked(fetchWithAuth).mockRejectedValueOnce(subError);

        const result = await fetchFilesFromFolder('http://test.com');
        
        // Root had one "folder" entry. Folders are filtered out unless they have download links.
        expect(result).toEqual([]);
    });

    it('should fetch multiple pages and deduplicate', async () => {
         // Page 1
        vi.mocked(fetchWithAuth).mockResolvedValueOnce({
            text: async () => 'page1',
        } as Response);

        vi.mocked(parseServerFiles).mockReturnValueOnce({
            files: [{ file_name: 'File 1', files: [{ name: 'File 1', type: 'pdf', link: 'download?id=1' }] } as unknown as ParsedFile],
            paginationLinks: ['on=1']
        });

        // Page 2
        vi.mocked(fetchWithAuth).mockResolvedValueOnce({
            text: async () => 'page2',
        } as Response);

        vi.mocked(parseServerFiles).mockReturnValueOnce({
            files: [{ file_name: 'File 2', files: [{ name: 'File 2', type: 'pdf', link: 'download?id=2' }] } as unknown as ParsedFile],
            paginationLinks: []
        });

        const result = await fetchFilesFromFolder('http://test.com');
        
        expect(result).toHaveLength(2);
        expect(result.map(f => f.file_name)).toContain('File 1');
        expect(result.map(f => f.file_name)).toContain('File 2');
    });


    it('should not recurse into the same subfolder more than once when it appears on multiple pages', async () => {
        const subfolderEntry = {
            file_name: 'Shared Subfolder',
            files: [{ link: 'https://is.mendelu.cz/auth/dok_server/slozka.pl?id=999', name: 'Shared Subfolder' }]
        } as unknown as ParsedFile;

        // Page 1: one real file + one subfolder entry
        vi.mocked(fetchWithAuth).mockResolvedValueOnce({ text: async () => 'page1' } as Response);
        vi.mocked(parseServerFiles).mockReturnValueOnce({
            files: [
                { file_name: 'File 1', files: [{ name: 'File 1', type: 'pdf', link: 'download?id=1' }] } as unknown as ParsedFile,
                subfolderEntry,
            ],
            paginationLinks: ['on=1']
        });

        // Page 2: same subfolder entry repeated (IS behaviour)
        vi.mocked(fetchWithAuth).mockResolvedValueOnce({ text: async () => 'page2' } as Response);
        vi.mocked(parseServerFiles).mockReturnValueOnce({
            files: [
                { file_name: 'File 2', files: [{ name: 'File 2', type: 'pdf', link: 'download?id=2' }] } as unknown as ParsedFile,
                subfolderEntry,
            ],
            paginationLinks: []
        });

        // Subfolder fetch (should only be called ONCE)
        vi.mocked(fetchWithAuth).mockResolvedValueOnce({ text: async () => 'subfolder' } as Response);
        vi.mocked(parseServerFiles).mockReturnValueOnce({
            files: [{ file_name: 'Sub File', files: [{ name: 'Sub File', type: 'pdf', link: 'download?id=sub' }] } as unknown as ParsedFile],
            paginationLinks: []
        });

        const result = await fetchFilesFromFolder('http://test.com');

        // fetchWithAuth: page1 + page2 + subfolder(x1) = 3 calls
        expect(fetchWithAuth).toHaveBeenCalledTimes(3);
        expect(result).toHaveLength(3); // File 1, File 2, Sub File
    });

    it('should call onChunk callback with initial files', async () => {
        vi.mocked(parseServerFiles).mockReturnValueOnce({
            files: [{ file_name: 'File 1', files: [{ name: 'File 1', type: 'pdf', link: 'download?id=1' }] } as unknown as ParsedFile],
            paginationLinks: []
        });

        const onChunk = vi.fn();
        await fetchFilesFromFolder('http://test.com', 'cz', true, 0, 2, onChunk);

        expect(onChunk).toHaveBeenCalledWith(expect.arrayContaining([
            expect.objectContaining({ file_name: 'File 1' })
        ]));
    });
});

