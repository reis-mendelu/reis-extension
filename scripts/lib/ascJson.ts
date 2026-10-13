// The slice of App Store Connect's JSON:API shape that scripts/lib/iosSubmit.ts reads.

/** A JSON:API resource, as far as this sequence reads one. */
export interface AscResource {
  id: string;
  attributes?: Record<string, string | undefined>;
  relationships?: Record<string, { data?: { id: string } | null }>;
}
/** A JSON:API document: one resource or a list, depending on the endpoint. */
export interface AscBody {
  data?: AscResource | AscResource[];
  links?: { next?: string };
}

export type AscHttp = (
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: unknown
) => Promise<{ status: number; data: AscBody | null }>;

export const listOf = (b: AscBody | null): AscResource[] => (Array.isArray(b?.data) ? b.data : []);
export const oneOf = (b: AscBody | null): AscResource | undefined =>
  b?.data && !Array.isArray(b.data) ? b.data : undefined;
