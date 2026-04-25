export function IskamPanelSkeleton() {
    return (
        <div className="flex flex-col gap-3 p-4">
            <div className="skeleton h-6 w-40 rounded" />
            <div className="skeleton h-20 w-full rounded-2xl" />
            <div className="skeleton h-20 w-full rounded-2xl" />
            <div className="skeleton h-6 w-40 rounded mt-4" />
            <div className="skeleton h-24 w-full rounded-2xl" />
        </div>
    );
}
