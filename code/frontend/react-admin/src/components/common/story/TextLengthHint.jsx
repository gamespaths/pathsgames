import { TEXT_MAX_LENGTH, textLengthLabel } from '../../../constants/story/textLimits'

/**
 * Counter under a capped text field. Turns gold at 90% so the author sees the
 * ceiling coming instead of hitting a silently truncating maxLength.
 */
export default function TextLengthHint({ value, max = TEXT_MAX_LENGTH }) {
  const length = (value ?? '').length
  const near = length >= max * 0.9
  return (
    <div
      data-testid="text-length-hint"
      style={{
        fontSize: '0.68rem',
        textAlign: 'right',
        color: near ? 'var(--color-gold-light)' : 'var(--color-ash)',
      }}
    >
      {textLengthLabel(value, max)}
    </div>
  )
}
