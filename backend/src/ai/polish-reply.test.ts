import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText } from 'ai';
import { polishReply } from './polish-reply.js';

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

describe('polishReply', () => {
  it('returns the trimmed text from the model', async () => {
    mockedGenerateText.mockResolvedValue({ text: '  Hi Rae, we are on it. — Alice  ' } as never);

    const result = await polishReply('we on it', 'Refund request', 'Alice', 'Rae');

    expect(result).toBe('Hi Rae, we are on it. — Alice');
  });

  it('passes the draft, ticket subject, agent name, and customer first name to the model', async () => {
    mockedGenerateText.mockResolvedValue({ text: 'polished' } as never);

    await polishReply('we on it', 'Refund request', 'Alice', 'Rae');

    const call = mockedGenerateText.mock.calls[0][0];
    expect(call.model).toBe('mock-model');
    expect(call.prompt).toContain('Agent name: Alice');
    expect(call.prompt).toContain('Customer first name: Rae');
    expect(call.prompt).toContain('Ticket subject: Refund request');
    expect(call.prompt).toContain('we on it');
  });

  it('tells the model the customer name is unknown when none is given', async () => {
    mockedGenerateText.mockResolvedValue({ text: 'polished' } as never);

    await polishReply('we on it', 'Refund request', 'Alice', null);

    const call = mockedGenerateText.mock.calls[0][0];
    expect(call.prompt).toContain('Customer first name: (unknown)');
  });

  it('propagates errors from the model call', async () => {
    mockedGenerateText.mockRejectedValue(new Error('upstream failure'));

    await expect(polishReply('we on it', 'Refund request', 'Alice', 'Rae')).rejects.toThrow(
      'upstream failure'
    );
  });
});
