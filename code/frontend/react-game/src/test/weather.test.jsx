import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { apiClient } from '../api/client'
import { getMatchWeather } from '../api/matches'

vi.mock('../api/client', () => ({ apiClient: vi.fn() }))

// ── getMatchWeather ───────────────────────────────────────────────────────────

describe('getMatchWeather', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null in mock mode (no backend)', async () => {
    apiClient.mockReturnValue(null)
    expect(await getMatchWeather('m1')).toBeNull()
  })

  it('gets /api/matches/{uuid}/weather and returns the payload', async () => {
    const get = vi.fn().mockResolvedValue({ data: { idWeather: 2, deltaEnergy: -2 } })
    apiClient.mockReturnValue({ get })
    const res = await getMatchWeather('m1', 'tok')
    expect(get).toHaveBeenCalledWith('/api/matches/m1/weather', expect.any(Object))
    expect(res.idWeather).toBe(2)
  })

  it('maps a 404 to null', async () => {
    const get = vi.fn().mockRejectedValue({ response: { status: 404 } })
    apiClient.mockReturnValue({ get })
    expect(await getMatchWeather('m1', 'tok')).toBeNull()
  })

  it('rethrows non-404 errors', async () => {
    const get = vi.fn().mockRejectedValue({ response: { status: 500 } })
    apiClient.mockReturnValue({ get })
    await expect(getMatchWeather('m1', 'tok')).rejects.toBeTruthy()
  })
})

// ── WeatherCard ───────────────────────────────────────────────────────────────

vi.mock('@/i18n/context', () => ({ useTranslation: () => ({ t: (k) => k }) }))
vi.mock('@/utils/loadoutCards', () => ({
  buildWeatherCard: () => ({ title: 'Weather', description: 'Sunny' }),
}))
let capturedOnPreview = null
let capturedCard = null
vi.mock('@/components/layout/Card', () => ({
  default: ({ card, onPreview, entityType }) => {
    capturedOnPreview = onPreview
    capturedCard = card
    return (
      <div data-testid="weather-card" data-entity={entityType}>
        <span data-testid="title">{card?.title}</span>
        {onPreview && <button data-testid="preview" onClick={onPreview}>preview</button>}
      </div>
    )
  },
}))

import WeatherCard from '../features/gameplay/cards/WeatherCard'

describe('WeatherCard', () => {
  beforeEach(() => { capturedOnPreview = null })

  it('renders nothing when no weather is set', () => {
    const { container } = render(<WeatherCard weather={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the weather card when weather is present', () => {
    render(<WeatherCard weather={{ idWeather: 2, deltaEnergy: -2 }} story={{}} />)
    expect(screen.getByTestId('weather-card')).toBeInTheDocument()
    expect(screen.getByTestId('weather-card').dataset.entity).toBe('weather')
  })

  it('uses the resolved card from the backend when present', () => {
    const resolved = { uuid: 'card-storm', urlImage: 'http://img', awesomeIcon: 'fa-bolt', title: 'Storm' }
    render(<WeatherCard weather={{ idWeather: 2, deltaEnergy: -2, card: resolved }} story={{}} />)
    expect(capturedCard.title).toBe('Storm')
    expect(capturedCard.urlImage).toBe('http://img')
  })

  it('invokes onPreview with the weather type', () => {
    const onPreview = vi.fn()
    render(<WeatherCard weather={{ idWeather: 2, deltaEnergy: -2 }} onPreview={onPreview} />)
    fireEvent.click(screen.getByTestId('preview'))
    expect(onPreview).toHaveBeenCalledWith(
      expect.any(Object), 'weather', null, expect.any(Array), true)
  })
})
