import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import FastTextCreatorModal from '../../../components/common/story/FastTextCreatorModal'
import FastTextSelectorModal from '../../../components/common/story/FastTextSelectorModal'
import EntityForm from '../../../components/common/story/EntityForm'
import TextLengthHint from '../../../components/common/story/TextLengthHint'
import { TEXT_MAX_LENGTH, textLengthLabel } from '../../../constants/story/textLimits'
import { STORIES_ENTITIES_FIELDS } from '../../../constants/story/storiesEntities'

// V0.35.8 — list_texts.short_text is VARCHAR(2000): every editor of a story text
// caps at the same number, or the save dies in the database instead of the form.
describe('story text limits', () => {
  it('agrees with the column width', () => {
    expect(TEXT_MAX_LENGTH).toBe(2000)
    expect(textLengthLabel('abc')).toBe('3 / 2000')
    expect(textLengthLabel(null, 10)).toBe('0 / 10')
  })

  it('caps both text columns of the texts entity', () => {
    const byKey = Object.fromEntries(STORIES_ENTITIES_FIELDS.texts.map(f => [f.key, f]))
    expect(byKey.shortText.maxLength).toBe(TEXT_MAX_LENGTH)
    expect(byKey.longText.maxLength).toBe(TEXT_MAX_LENGTH)
  })

  it('caps the four textareas of the fast text creator', () => {
    render(<FastTextCreatorModal open onClose={vi.fn()} onSave={vi.fn()} storyOptions={[]} />)
    for (const label of ['en-short', 'en-long', 'it-short', 'it-long']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('maxlength', String(TEXT_MAX_LENGTH))
    }
    expect(screen.getAllByTestId('text-length-hint')).toHaveLength(4)
  })

  it('caps the one-line generator of the text selector', () => {
    render(
      <FastTextSelectorModal open onClose={vi.fn()} onSelect={vi.fn()} texts={[]} storyUuid="s1"
        onSaveFastText={vi.fn()} startMode="input-generator" />
    )
    const generator = screen.getByPlaceholderText('Insert text value')
    expect(generator).toHaveAttribute('maxlength', String(TEXT_MAX_LENGTH))
  })

  it('caps a capped EntityForm field and leaves the others free', () => {
    render(
      <EntityForm
        entity={{ shortText: 'abc', linkCopyright: 'https://x' }}
        fields={[
          { key: 'shortText', label: 'Short Text', type: 'text', maxLength: TEXT_MAX_LENGTH },
          { key: 'longText', label: 'Long Text', type: 'textarea', maxLength: TEXT_MAX_LENGTH },
          { key: 'linkCopyright', label: 'Copyright Link', type: 'text' },
        ]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByLabelText('Short Text')).toHaveAttribute('maxlength', String(TEXT_MAX_LENGTH))
    expect(screen.getByLabelText('Long Text')).toHaveAttribute('maxlength', String(TEXT_MAX_LENGTH))
    expect(screen.getByLabelText('Copyright Link')).not.toHaveAttribute('maxlength')
    expect(screen.getAllByTestId('text-length-hint')).toHaveLength(2)
    expect(screen.getByText('3 / 2000')).toBeInTheDocument()
  })

  it('warns in gold once the field is nearly full', () => {
    const { rerender } = render(<TextLengthHint value={'x'.repeat(10)} max={100} />)
    expect(screen.getByTestId('text-length-hint')).toHaveStyle({ color: 'var(--color-ash)' })
    rerender(<TextLengthHint value={'x'.repeat(95)} max={100} />)
    expect(screen.getByTestId('text-length-hint')).toHaveStyle({ color: 'var(--color-gold-light)' })
  })
})
