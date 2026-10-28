import type { Metadata } from 'next'
import { requireAuth } from '@/actions/auth.actions'
import { PageHeader } from '@/components/layout/PageHeader'
import { LocatorPanel } from '@/features/locator/components/LocatorPanel'

export const metadata: Metadata = {
  title: 'Locator',
}

export default async function LocatorPage() {
  await requireAuth()

  return (
    <div className="space-y-6">
      <PageHeader
        title="Locator"
        description="Find the nearest locations on the map and log your visits."
      />
      <LocatorPanel />
    </div>
  )
}
