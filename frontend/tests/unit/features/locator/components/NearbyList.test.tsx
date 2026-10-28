import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NearbyList } from '@/features/locator/components/NearbyList'
import type { LocatorStatus, NearbyResult, SearchOrigin } from '@/features/locator/types'

const ORIGIN: SearchOrigin = { lat: -37.8136, lng: 144.9631, label: 'Your location' }

const CARLTON: NearbyResult = {
  id: 'carlton-pickup-point',
  name: 'Carlton Pickup Point',
  category: 'pickup',
  address: '214 Elgin St, Carlton',
  lat: -37.8,
  lng: 144.967,
  distanceMeters: 956,
}

const SOUTHBANK: NearbyResult = {
  id: 'southbank-depot',
  name: 'Southbank Depot',
  category: 'depot',
  address: '60 City Rd, Southbank',
  lat: -37.825,
  lng: 144.965,
  distanceMeters: 2935,
}

type ListProps = Parameters<typeof NearbyList>[0]

function renderList(overrides: Partial<ListProps> = {}) {
  const props: ListProps = {
    origin: ORIGIN,
    status: 'success' as LocatorStatus,
    error: null,
    results: [CARLTON, SOUTHBANK],
    radiusKm: 5,
    category: undefined,
    savingLocationId: null,
    nextRadiusKm: 10,
    onSaveVisit: vi.fn(),
    onRetry: vi.fn(),
    onIncreaseRadius: vi.fn(),
    onClearCategory: vi.fn(),
    ...overrides,
  }

  render(<NearbyList {...props} />)
  return props
}

describe('NearbyList', () => {
  it('asks for a starting point before any search', () => {
    renderList({ origin: null, status: 'idle', results: [] })

    expect(screen.getByText('Choose a starting point')).toBeInTheDocument()
  })

  it('shows the locating state while geolocation runs', () => {
    renderList({ status: 'locating', results: [] })

    expect(screen.getByText('Getting your location…')).toBeInTheDocument()
  })

  it('shows a loading skeleton while the API is in flight', () => {
    renderList({ status: 'loading', results: [] })

    expect(screen.getByRole('status', { name: 'Loading nearby locations' })).toBeInTheDocument()
  })

  it('surfaces the error message with a retry action', async () => {
    const user = userEvent.setup()
    const props = renderList({
      status: 'error',
      results: [],
      error: 'Could not reach the Locator API — check your connection and try again.',
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not reach the Locator API — check your connection and try again.'
    )

    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(props.onRetry).toHaveBeenCalledTimes(1)
  })

  it('explains an empty search and offers a wider radius', async () => {
    const user = userEvent.setup()
    const props = renderList({ results: [] })

    expect(screen.getByText('No locations within 5 km')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Search 10 km instead' }))
    expect(props.onIncreaseRadius).toHaveBeenCalledTimes(1)
  })

  it('offers to clear the category filter from the empty state', async () => {
    const user = userEvent.setup()
    const props = renderList({ results: [], category: 'depot' })

    await user.click(screen.getByRole('button', { name: 'Clear category filter' }))
    expect(props.onClearCategory).toHaveBeenCalledTimes(1)
  })

  it('renders ranked results with distance, category and a save action', async () => {
    const user = userEvent.setup()
    const props = renderList()

    expect(screen.getByText('2 locations within 5 km')).toBeInTheDocument()
    expect(screen.getByText('Carlton Pickup Point')).toBeInTheDocument()
    expect(screen.getByText('Southbank Depot')).toBeInTheDocument()
    expect(screen.getByText('956 m')).toBeInTheDocument()
    expect(screen.getByText('2.9 km')).toBeInTheDocument()
    expect(screen.getByText('Pickup point')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Log visit' })[0]!)
    expect(props.onSaveVisit).toHaveBeenCalledWith(CARLTON)
  })

  it('disables every save button while a save is in flight', () => {
    renderList({ savingLocationId: CARLTON.id })

    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled()
    const idleButtons = screen.getAllByRole('button', { name: 'Log visit' })
    expect(idleButtons).toHaveLength(1)
    expect(idleButtons[0]).toBeDisabled()
  })

  it('shows the category filter in the result header', () => {
    renderList({ category: 'pickup' })

    expect(screen.getByText('2 locations within 5 km · Pickup point')).toBeInTheDocument()
  })
})
