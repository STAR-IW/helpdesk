import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { ReplyThread } from './ReplyThread'
import type { Reply } from '@/constants/reply'

const baseReply: Reply = {
  id: 'reply-1',
  senderType: 'agent',
  body: 'Thanks for reaching out, we are looking into it.',
  bodyHtml: null,
  author: { id: 'agent-1', name: 'Alice Agent' },
  createdAt: '2026-01-15T10:00:00.000Z',
}

describe('ReplyThread', () => {
  it('shows an empty state when there are no replies', () => {
    renderWithProviders(
      <ReplyThread replies={[]} requesterName="Rae Requester" requesterEmail="requester@test.com" />
    )

    expect(screen.getByText('No replies yet.')).toBeInTheDocument()
  })

  it('renders the author name, sender type, body, and timestamp for a reply', () => {
    renderWithProviders(
      <ReplyThread replies={[baseReply]} requesterName="Rae Requester" requesterEmail="requester@test.com" />
    )

    expect(screen.getByText(/Alice Agent/)).toBeInTheDocument()
    expect(screen.getByText('(Agent)')).toBeInTheDocument()
    expect(screen.getByText(baseReply.body)).toBeInTheDocument()
    expect(screen.getByText(new Date(baseReply.createdAt).toLocaleString())).toBeInTheDocument()
  })

  it('falls back to the requester name when the reply has no author', () => {
    const reply: Reply = { ...baseReply, senderType: 'customer', author: null }

    renderWithProviders(
      <ReplyThread replies={[reply]} requesterName="Rae Requester" requesterEmail="requester@test.com" />
    )

    expect(screen.getByText(/Rae Requester/)).toBeInTheDocument()
    expect(screen.getByText('(Customer)')).toBeInTheDocument()
  })

  it('falls back to the requester email when there is no author or requester name', () => {
    const reply: Reply = { ...baseReply, senderType: 'customer', author: null }

    renderWithProviders(
      <ReplyThread replies={[reply]} requesterName={null} requesterEmail="requester@test.com" />
    )

    expect(screen.getByText(/requester@test\.com/)).toBeInTheDocument()
  })

  it('renders multiple replies in order', () => {
    const secondReply: Reply = {
      id: 'reply-2',
      senderType: 'customer',
      body: 'Any update?',
      bodyHtml: null,
      author: null,
      createdAt: '2026-01-16T09:00:00.000Z',
    }

    renderWithProviders(
      <ReplyThread
        replies={[baseReply, secondReply]}
        requesterName="Rae Requester"
        requesterEmail="requester@test.com"
      />
    )

    const bodies = screen.getAllByText(/Thanks for reaching out|Any update\?/)
    expect(bodies).toHaveLength(2)
    expect(bodies[0]).toHaveTextContent(baseReply.body)
    expect(bodies[1]).toHaveTextContent(secondReply.body)
  })

  it('renders sanitized bodyHtml when present, stripping unsafe content', () => {
    const reply: Reply = {
      ...baseReply,
      bodyHtml: '<p>Hello <strong>world</strong></p><img src=x onerror="alert(1)"><script>alert(1)</script>',
    }

    renderWithProviders(
      <ReplyThread replies={[reply]} requesterName="Rae Requester" requesterEmail="requester@test.com" />
    )

    expect(screen.getByText('world').tagName).toBe('STRONG')
    expect(document.querySelector('script')).not.toBeInTheDocument()
    expect(document.querySelector('img')?.getAttribute('onerror')).toBeNull()
  })

  it('falls back to plain text body when bodyHtml is null', () => {
    renderWithProviders(
      <ReplyThread replies={[baseReply]} requesterName="Rae Requester" requesterEmail="requester@test.com" />
    )

    expect(screen.getByText(baseReply.body).tagName).toBe('P')
  })
})
