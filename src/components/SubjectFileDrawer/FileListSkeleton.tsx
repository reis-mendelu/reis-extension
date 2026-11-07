/** The file list's loading skeleton, split out of FileList.tsx to keep it under 200 lines. */
export function FileListSkeleton() {
  return (
    <div className="p-6 space-y-8">
      {[1, 2].map((i) => (
        <div key={i} className="space-y-3">
          {/* Folder Header Skeleton */}
          <div className="flex items-center gap-2 px-2">
            <div className="skeleton w-4 h-4 rounded-full bg-base-300"></div>
            <div className="skeleton h-4 w-32 rounded bg-base-300"></div>
          </div>
          {/* Files Grid Skeleton */}
          <div className="grid grid-cols-1 gap-1">
            {[1, 2, 3].map((j) => (
              <div
                key={j}
                className="flex items-center gap-3 p-3 rounded-lg border border-transparent bg-base-100"
              >
                <div className="skeleton w-5 h-5 rounded bg-base-300"></div>
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-3/4 rounded bg-base-300"></div>
                  <div className="skeleton h-3 w-1/2 rounded bg-base-300"></div>
                </div>
                <div className="skeleton w-4 h-4 rounded bg-base-300"></div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
