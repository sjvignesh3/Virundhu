export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-6 h-24 rounded-lg bg-muted animate-pulse" />
      <div className="mb-4 flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 w-24 rounded-full bg-muted animate-pulse" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}
