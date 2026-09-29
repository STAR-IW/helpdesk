import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateText } from 'ai';
import { isAcknowledgementOnly } from './is-acknowledgement.js';

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

describe('isAcknowledgementOnly', () => {
  it('returns true when the model classifies the reply as an acknowledgement', async () => {
    mockedGenerateText.mockResolvedValue({ output: 'acknowledgement' } as never);

    expect(await isAcknowledgementOnly('Thanks!')).toBe(true);
  });

  it('returns false when the model says the reply needs a response', async () => {
    mockedGenerateText.mockResolvedValue({ output: 'needsResponse' } as never);

    expect(await isAcknowledgementOnly('Still not working')).toBe(false);
  });

  it('passes the model, a choice output spec, and the reply body as the prompt', async () => {
    mockedGenerateText.mockResolvedValue({ output: 'acknowledgement' } as never);

    await isAcknowledgementOnly('Thanks, that worked');

    const call = mockedGenerateText.mock.calls[0][0] as unknown as {
      model: string;
      output: { type: string; options: string[] };
      prompt: string;
    };
    expect(call.model).toBe('mock-model');
    expect(call.output).toEqual({ type: 'choice', options: ['acknowledgement', 'needsResponse'] });
    expect(call.prompt).toBe('Thanks, that worked');
  });

  it('propagates errors from the model call', async () => {
    mockedGenerateText.mockRejectedValue(new Error('upstream failure'));

    await expect(isAcknowledgementOnly('Thanks!')).rejects.toThrow('upstream failure');
  });
});
