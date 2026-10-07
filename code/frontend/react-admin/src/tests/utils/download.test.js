import { describe, it, expect, vi } from 'vitest'
import { downloadJson } from '../../utils/download'

describe('downloadJson', () => {
  it('clicks a temporary link to a JSON blob and releases it', () => {
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    downloadJson('{"a":1}', 'match.json')
    const blob = URL.createObjectURL.mock.calls[0][0]
    expect(blob.type).toBe('application/json')
    expect(click).toHaveBeenCalledTimes(1)
    expect(click.mock.contexts[0].download).toBe('match.json')
    expect(document.querySelector('a[download]')).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:x')
    click.mockRestore()
  })
})
