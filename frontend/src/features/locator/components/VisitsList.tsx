import { History } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { formatDatetime } from '@/lib/utils'
import type { LocationVisit } from '@/types/firestore'

interface VisitsListProps {
  visits: LocationVisit[]
  loading: boolean
}

/**
 * The signed-in user's visit history, newest first.
 * Sorted here rather than with a Firestore orderBy so the owner-only
 * `where('uid' …)` query needs no composite index.
 */
export function VisitsList({ visits, loading }: VisitsListProps) {
  const sorted = [...visits].sort((a, b) => b.visitedAt.toMillis() - a.visitedAt.toMillis())

  return (
    <section
      aria-label="Your visits"
      className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">Your visits</h2>
        {!loading && sorted.length > 0 && (
          <span className="text-xs text-zinc-500">{sorted.length} logged</span>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8" role="status" aria-label="Loading visits">
          <LoadingSpinner size="sm" />
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={History}
          title="No visits logged yet"
          description="Log a visit from the results list and it will show up here."
        />
      ) : (
        <ul className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
          {sorted.map((visit) => (
            <li key={visit.id} className="py-3">
              <p className="truncate text-sm font-medium">{visit.locationName}</p>
              <p className="mt-0.5 text-xs text-zinc-500">
                {formatDatetime(visit.visitedAt.toDate())}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
