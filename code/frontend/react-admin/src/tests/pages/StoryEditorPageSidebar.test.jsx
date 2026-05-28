import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StoryEditorPageSidebar from '../../pages/story/StoryEditorPageSidebar'

const TABS = [
  { id: 'metadata', label: 'Story Info', icon: 'fa-info-circle' },
  { id: 'difficulties', label: 'Difficulties', icon: 'fa-layer-group' },
  { id: 'texts', label: 'Texts', icon: 'fa-font' },
]

describe('StoryEditorPageSidebar', () => {
  it('renders one button per tab', () => {
    render(<StoryEditorPageSidebar tabs={TABS} activeTab="metadata" onSelectTab={() => {}} />)
    expect(screen.getByText('Story Info')).toBeInTheDocument()
    expect(screen.getByText('Difficulties')).toBeInTheDocument()
    expect(screen.getByText('Texts')).toBeInTheDocument()
  })

  it('highlights the active tab', () => {
    render(<StoryEditorPageSidebar tabs={TABS} activeTab="texts" onSelectTab={() => {}} />)
    const activeBtn = screen.getByText('Texts').closest('button')
    expect(activeBtn.className).toMatch(/text-gold-light/)
    const inactiveBtn = screen.getByText('Story Info').closest('button')
    expect(inactiveBtn.className).not.toMatch(/text-gold-light/)
  })

  it('calls onSelectTab with the tab id on click', async () => {
    const onSelectTab = vi.fn()
    render(<StoryEditorPageSidebar tabs={TABS} activeTab="metadata" onSelectTab={onSelectTab} />)
    await userEvent.click(screen.getByText('Difficulties'))
    expect(onSelectTab).toHaveBeenCalledWith('difficulties')
  })

  it('renders the icon for each tab', () => {
    const { container } = render(
      <StoryEditorPageSidebar tabs={TABS} activeTab="metadata" onSelectTab={() => {}} />)
    expect(container.querySelector('.fa-info-circle')).toBeInTheDocument()
    expect(container.querySelector('.fa-layer-group')).toBeInTheDocument()
  })
})
