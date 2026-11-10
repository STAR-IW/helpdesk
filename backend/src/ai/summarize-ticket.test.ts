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
    expect(typeof call.prompt).toBe('string');
    const prompt = call.prompt as string;
    expect(call.model).toBe('mock-model');
    expect(prompt).toContain('Ticket subject: Refund request');
    expect(prompt).toContain('Rae Requester');
    expect(prompt).toContain('I want a refund');
    expect(prompt).toContain('Alice Agent');
    expect(prompt).toContain('Sure, processing it now');
    expect(prompt.indexOf('I want a refund')).toBeLessThan(
        prompt.indexOf('Sure, processing it now')
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
