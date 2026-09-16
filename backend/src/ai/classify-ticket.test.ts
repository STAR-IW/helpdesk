import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText } from 'ai';
import { classifyTicket } from './classify-ticket.js';
import { TicketCategory } from '../generated/prisma/enums.js';

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: { choice: vi.fn((spec: { options: string[] }) => ({ type: 'choice', options: spec.options })) },
}));

vi.mock('./client.js', () => ({
  aiModel: 'mock-model',
}));

const mockedGenerateText = vi.mocked(generateText);

beforeEach(() => {
  mockedGenerateText.mockReset();
});

describe('classifyTicket', () => {
  it('returns the category from the model', async () => {
    mockedGenerateText.mockResolvedValue({ output: TicketCategory.refundRequest } as never);

    const result = await classifyTicket('Refund request', 'I want my money back');

    expect(result).toBe(TicketCategory.refundRequest);
  });

  it('passes the model, a choice output spec with the category options, and the subject/body in the prompt', async () => {
    mockedGenerateText.mockResolvedValue({ output: TicketCategory.technicalQuestion } as never);

    await classifyTicket('App crashes on login', 'The app crashes every time I try to log in');

    const call = mockedGenerateText.mock.calls[0][0] as unknown as {
      model: string;
      output: { type: string; options: string[] };
      prompt: string;
    };
    expect(call.model).toBe('mock-model');
    expect(call.output).toEqual({
      type: 'choice',
      options: [TicketCategory.generalQuestion, TicketCategory.technicalQuestion, TicketCategory.refundRequest],
    });
    expect(call.prompt).toContain('Subject: App crashes on login');
    expect(call.prompt).toContain('The app crashes every time I try to log in');
  });

  it('propagates errors from the model call', async () => {
    mockedGenerateText.mockRejectedValue(new Error('upstream failure'));

    await expect(classifyTicket('Refund request', 'I want my money back')).rejects.toThrow(
      'upstream failure'
    );
  });
});
