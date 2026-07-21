import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import WeatherCard from '../../components/match/detail/WeatherCard'
import PlayersCard from '../../components/match/detail/PlayersCard'
import {
  UuidCopy, StateBadges, findByUuid, resolveEntityName, name20, TERMINAL, STATUS_COLOR,
} from '../../components/match/detail/matchDetailShared'

const TEXTS = [
  { idText: 1, lang: 'en', shortText: 'Sunny weather rule with a very long label' },
  { idText: 2, lang: 'it', shortText: 'Sole' },
]

describe('matchDetailShared helpers', () => {
  it('exposes the terminal statuses and their colours', () => {
    expect(TERMINAL.has('ENDED')).toBe(true)
    expect(TERMINAL.has('RUNNING')).toBe(false)
    expect(STATUS_COLOR.GAMEOVER.border).toBe('#7f1d1d')
  })

  it('findByUuid tolerates a missing list and a missing match', () => {
    expect(findByUuid(null, 'x')).toBeNull()
    expect(findByUuid([{ uuid: 'a' }], 'b')).toBeNull()
    expect(findByUuid([{ uuid: 'a' }], 'a')).toEqual({ uuid: 'a' })
  })

  it('resolveEntityName falls back to #id and null', () => {
    expect(resolveEntityName(TEXTS, null)).toBeNull()
    expect(resolveEntityName(TEXTS, {})).toBeNull()
    expect(resolveEntityName(TEXTS, { idTextName: 1 })).toMatch(/^Sunny/)
    expect(resolveEntityName(TEXTS, { idTextName: 99 })).toBe('#99')
    expect(resolveEntityName(null, { idTextName: 99 })).toBe('#99')
  })

  it('name20 truncates and handles empties', () => {
    expect(name20('')).toBe('—')
    expect(name20(undefined)).toBe('—')
    expect(name20('abcdefghijklmnopqrstuvwxyz')).toBe('abcdefghijklmnopqrst')
  })
})

describe('UuidCopy', () => {
  beforeEach(() => {
    vi.useRealTimers()
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('renders a dash when there is no uuid', () => {
    render(<UuidCopy uuid={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('copies on click and shows the confirmation tick', async () => {
    render(<UuidCopy uuid="abcdef12-3456-7890-abcd-ef1234567890" />)
    await userEvent.click(screen.getByRole('button'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('abcdef12-3456-7890-abcd-ef1234567890')
    expect(await screen.findByText('✓')).toBeInTheDocument()
  })

  it('copies on Enter and on Space, and ignores other keys', async () => {
    render(<UuidCopy uuid="uuid-1">child</UuidCopy>)
    const chip = screen.getByRole('button')

    fireEvent.keyDown(chip, { key: 'Enter' })
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1))

    fireEvent.keyDown(chip, { key: ' ' })
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2))

    fireEvent.keyDown(chip, { key: 'a' })
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(2)
  })

  it('does nothing when clipboard support is missing', () => {
    Object.assign(navigator, { clipboard: undefined })
    render(<UuidCopy uuid="uuid-2">child</UuidCopy>)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('✓')).not.toBeInTheDocument()
  })
})

describe('StateBadges', () => {
  it('renders sleeping, coma and active', () => {
    const { rerender } = render(<StateBadges player={{ isSleeping: true, isComa: true }} />)
    expect(screen.getByText('sleeping')).toBeInTheDocument()
    rerender(<StateBadges player={{ isComa: true }} />)
    expect(screen.getByText('coma')).toBeInTheDocument()
    rerender(<StateBadges player={{}} />)
    expect(screen.getByText('active')).toBeInTheDocument()
  })
})

describe('WeatherCard', () => {
  it('renders nothing when the weather view is unavailable', () => {
    const { container } = render(<WeatherCard weather={null} match={{}} texts={TEXTS} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('falls back to the match rngSeed and reports no rules', () => {
    render(<WeatherCard weather={{ rules: [], log: [] }} match={{ rngSeed: 7 }} texts={TEXTS} />)
    expect(screen.getByTestId('weather-panel')).toBeInTheDocument()
    expect(screen.getByText(/seed 7/)).toBeInTheDocument()
    expect(screen.getByText(/No weather rules defined/i)).toBeInTheDocument()
  })

  it('shows a dash when neither the view nor the match carries a seed', () => {
    render(<WeatherCard weather={{}} match={{}} texts={TEXTS} />)
    expect(screen.getByText(/seed —/)).toBeInTheDocument()
  })

  it('renders the rules table, flagging the current one, plus the log history', () => {
    const weather = {
      rngSeed: 42,
      rules: [
        {
          uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          idTextName: 1,
          probability: 30,
          deltaEnergy: -2,
          costMoveSafeLocation: 1,
          costMoveNotSafeLocation: 3,
          active: true,
          current: true,
        },
        // No uuid, no name, no numbers: exercises every fallback branch.
        { id: 9, active: false, current: false },
      ],
      log: [
        { id: 1, clock: 5, weatherUuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', timestampStart: '2026-01-01T10:00:00Z' },
        { id: 2, clock: 6, idWeather: 9 },
        { clock: 7 },
      ],
    }
    render(<WeatherCard weather={weather} match={{ rngSeed: 1 }} texts={TEXTS} />)

    expect(screen.getByText(/seed 42/)).toBeInTheDocument()
    // Rule 1 — resolved name, truncated to 20 chars.
    expect(screen.getByText('Sunny weather rule w')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('-2')).toBeInTheDocument()
    expect(screen.getByText('current')).toBeInTheDocument()
    expect(screen.getByText('yes')).toBeInTheDocument()
    // Rule 2 — every fallback.
    expect(screen.getByText('no')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    // Log table rendered.
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('prefers an explicit rule name over the resolved text', () => {
    render(
      <WeatherCard
        weather={{ rngSeed: 0, rules: [{ id: 1, name: 'Storm', active: true }], log: [] }}
        match={{}}
        texts={TEXTS}
      />
    )
    expect(screen.getByText('Storm')).toBeInTheDocument()
  })
})

describe('PlayersCard', () => {
  const noop = () => '—'

  it('renders the empty-state row', () => {
    render(
      <PlayersCard
        players={[]}
        templateName={noop}
        className={noop}
        traitName={noop}
        locationName20={noop}
        onEditStats={vi.fn()}
      />
    )
    expect(screen.getByText(/No characters have joined/i)).toBeInTheDocument()
    expect(screen.getByText(/Players & characters \(0\)/)).toBeInTheDocument()
  })

  it('renders the fully-populated branch of every optional cell', async () => {
    const onEditStats = vi.fn()
    const players = [{
      uuid: 'p1',
      characterTemplateUuid: 'tpl-1',
      userUuid: 'user-1',
      classUuid: 'cls-1',
      traitUuids: ['tr-1', 'tr-2'],
      dexterity: 1, intelligence: 2, constitution: 3,
      energy: 4, energyMax: 10,
      life: 5, lifeMax: 20,
      sad: 6, sadMax: 30,
      weight: 7, weightMax: 40,
      items: [{ uuid: 'i1', itemUuid: 'item-1', name: 'Sword', amount: 2 }],
      idLocation: 3,
      isSleeping: true,
    }]
    render(
      <PlayersCard
        players={players}
        templateName={() => 'Hero'}
        className={() => 'Wizard'}
        traitName={(t) => `Trait ${t}`}
        locationName20={() => 'Cave'}
        onEditStats={onEditStats}
      />
    )
    expect(screen.getByText('Hero')).toBeInTheDocument()
    expect(screen.getByText('Wizard')).toBeInTheDocument()
    expect(screen.getByText('Trait tr-1')).toBeInTheDocument()
    expect(screen.getByText('Trait tr-2')).toBeInTheDocument()
    expect(screen.getByText('4/10')).toBeInTheDocument()
    expect(screen.getByText('5/20')).toBeInTheDocument()
    expect(screen.getByText('6/30')).toBeInTheDocument()
    expect(screen.getByText('7/40')).toBeInTheDocument()
    expect(screen.getByText('Sword ×2')).toBeInTheDocument()
    expect(screen.getByText('Cave')).toBeInTheDocument()
    expect(screen.getByText('sleeping')).toBeInTheDocument()

    await userEvent.click(screen.getByTitle('Edit statistics'))
    expect(onEditStats).toHaveBeenCalledWith(players[0])
  })

  it('renders every fallback branch when the optional data is missing', () => {
    const players = [{
      uuid: 'p2',
      characterTemplateUuid: 'tpl-2',
      userUuid: 'user-2',
      classUuid: null,
      traitUuids: [],
      dexterity: 0, intelligence: 0, constitution: 0,
      energy: 1, life: 2, sad: 3,
      items: [{ uuid: 'i2', itemUuid: 'item-xyz-9999-0000' }],
      idLocation: null,
    }]
    render(
      <PlayersCard
        players={players}
        templateName={() => 'Hero2'}
        className={() => 'never'}
        traitName={() => 'never'}
        locationName20={undefined}
        onEditStats={vi.fn()}
      />
    )
    const row = screen.getByText('Hero2').closest('tr')
    // class, traits, weight, position all fall back to the em dash.
    expect(within(row).getAllByText('—').length).toBeGreaterThanOrEqual(4)
    expect(within(row).getByText(/×1$/)).toBeInTheDocument()
    expect(within(row).getByText('active')).toBeInTheDocument()
  })

  it('formats a numeric location with the #id fallback', () => {
    render(
      <PlayersCard
        players={[{ uuid: 'p3', characterTemplateUuid: 't', userUuid: 'u', idLocation: 12, items: [] }]}
        templateName={() => 'H3'}
        className={noop}
        traitName={noop}
        locationName20={() => null}
        onEditStats={vi.fn()}
      />
    )
    expect(screen.getByText('#12')).toBeInTheDocument()
  })
})
