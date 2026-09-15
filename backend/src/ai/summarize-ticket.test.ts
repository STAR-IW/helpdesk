import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText } from 'ai';
import { summarizeTicket } from './summarize-ticket.js';

vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('./client.js', () => ({
  aiModel: 'mock-model',
}));

const mockedGenerateText = vi.mocked(generateText);

beforeEach(() => {
  mockedGenerateText.mockReset();
});

describe('summarizeTicket', () => {
  it('returns the trimmed text from the model', async () => {
    mockedGenerateText.mockResolvedValue({ text: '  Customer wants a refund.  ' } as never);

    const result = await summarizeTicket('Refund request', [
      { from: 'Rae Requester', body: 'I want a refund', createdAt: new Date('2026-01-10T00:00:00.000Z') },
    ]);

    expect(result).toBe('Customer wants a refund.');
  });

  it('passes the model, ticket subject, and the ordered conversation transcript', async () => {
    mockedGenerateText.mockResolvedValue({ text: 'summary' } as never);

    await summarizeTicket('Refund request', [
      { from: 'Rae Requester', body: 'I want a refund', createdAt: new Date('2026-01-10T00:00:00.000Z') },
      { from: 'Alice Agent', body: 'Sure, processing it now', createdAt: new Date('2026-01-11T00:00:00.000Z') },
    ]);

    const call = mockedGenerateText.mock.calls[0][0];
    expect(call.model).toBe('mock-model');
    expect(call.prompt).toContain('Ticket subject: Refund request');
    expect(call.prompt).toContain('Rae Requester');
    expect(call.prompt).toContain('I want a refund');
    expect(call.prompt).toContain('Alice Agent');
    expect(call.prompt).toContain('Sure, processing it now');
    expect(call.prompt.indexOf('I want a refund')).toBeLessThan(
      call.prompt.indexOf('Sure, processing it now')
    );
  });

  it('propagates errors from the model call', async () => {
    mockedGenerateText.mockRejectedValue(new Error('upstream failure'));

    await expect(
      summarizeTicket('Refund request', [
        { from: 'Rae Requester', body: 'I want a refund', createdAt: new Date() },
      ])
    ).rejects.toThrow('upstream failure');
  });
});
