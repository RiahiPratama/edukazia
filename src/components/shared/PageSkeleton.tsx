export function SkeletonPulse({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-[#E5E3FF]/40 dark:bg-white/5 rounded-lg ${className}`} />
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white dark:bg-white/5 border border-[#E5E3FF] dark:border-white/10 rounded-xl p-5 ${className}`}>
      <SkeletonPulse className="h-3 w-24 mb-3" />
      <SkeletonPulse className="h-7 w-16" />
    </div>
  )
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-5 py-4 border-b border-[#E5E3FF]/50 dark:border-white/5">
      <SkeletonPulse className="h-9 w-9 rounded-full flex-shrink-0" />
      <div className="flex-1">
        <SkeletonPulse className="h-3.5 w-40 mb-2" />
        <SkeletonPulse className="h-2.5 w-28" />
      </div>
      <SkeletonPulse className="h-6 w-16 rounded-full" />
    </div>
  )
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white dark:bg-white/5 border border-[#E5E3FF] dark:border-white/10 rounded-xl overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  )
}

export function SkeletonTabs() {
  return (
    <div className="flex gap-2 mb-5">
      <SkeletonPulse className="h-10 w-24 rounded-xl" />
      <SkeletonPulse className="h-10 w-28 rounded-xl" />
      <SkeletonPulse className="h-10 w-24 rounded-xl" />
    </div>
  )
}

/** Full page skeleton — use inside loading.tsx */
export default function PageSkeleton({ 
  cards = 3, 
  rows = 5,
  showTabs = false,
}: { 
  cards?: number
  rows?: number 
  showTabs?: boolean
}) {
  return (
    <div className="space-y-5">
      {/* Title */}
      <div>
        <SkeletonPulse className="h-7 w-48 mb-2" />
        <SkeletonPulse className="h-4 w-72" />
      </div>

      {/* Stat cards */}
      {cards > 0 && (
        <div className={`grid gap-4 ${
          cards === 2 ? 'grid-cols-2' : 
          cards === 4 ? 'grid-cols-2 lg:grid-cols-4' : 
          'grid-cols-1 sm:grid-cols-3'
        }`}>
          {Array.from({ length: cards }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Tabs */}
      {showTabs && <SkeletonTabs />}

      {/* Table / List */}
      <SkeletonTable rows={rows} />
    </div>
  )
}
