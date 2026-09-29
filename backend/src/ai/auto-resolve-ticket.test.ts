import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile } from 'node:fs/promises';
import { generateText } from 'ai';
import { TicketCategory } from '../generated/prisma/enums.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

vi.mock('ai', () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn((spec: { schema: unknown }) => ({ type: 'object', schema: spec.schema })) },
}));

vi.mock('./client.js', () => ({
  aiModel: 'mock-model',
}));

const mockedReadFile = vi.mocked(readFile);
const mockedGenerateText = vi.mocked(generateText);

// The knowledge base is cached at module level, so load a fresh module per test.
async function loadAutoResolveTicket() {
  vi.resetModules();
  return (await import('./auto-resolve-ticket.js')).autoResolveTicket;
}

beforeEach(() => {
  mockedReadFile.mockReset().mockResolvedValue('## How do I reset my password?\nClick Forgot password.' as never);
  mockedGenerateText.mockReset();
});

describe('autoResolveTicket', () => {
  it('returns the trimmed reply when the model can resolve the ticket', async () => {
    mockedGenerateText.mockResolvedValue({ output: { canResolve: true, reply: '  Hi Jane, click Forgot password.  ' } } as never);
    const autoResolveTicket = await loadAutoResolveTicket();

    const result = await autoResolveTicket('Reset', 'I forgot my password', TicketCategory.technicalQuestion, 'Jane');

    expect(result).toBe('Hi Jane, click Forgot password.');
  });

  it('returns null when the model cannot resolve the ticket', async () => {
    mockedGenerateText.mockResolvedValue({ output: { canResolve: false, reply: '' } } as never);
    const autoResolveTicket = await loadAutoResolveTicket();

    expect(await autoResolveTicket('Refund', 'Refund me', TicketCategory.refundRequest, null)).toBeNull();
  });

  it('returns null when the model claims it can resolve but gives an empty reply', async () => {
    mockedGenerateText.mockResolvedValue({ output: { canResolve: true, reply: '   ' } } as never);
    const autoResolveTicket = await loadAutoResolveTicket();

    expect(await autoResolveTicket('Reset', 'I forgot my password', null, null)).toBeNull();
  });

  it('includes the knowledge base in the system prompt and the ticket details in the prompt', async () => {
    mockedGenerateText.mockResolvedValue({ output: { canResolve: false, reply: '' } } as never);
    const autoResolveTicket = await loadAutoResolveTicket();

    await autoResolveTicket('Reset', 'I forgot my password', TicketCategory.technicalQuestion, 'Jane');

    const call = mockedGenerateText.mock.calls[0][0] as unknown as {
      model: string;
      output: { type: string };
      system: string;
      prompt: string;
    };
    expect(call.model).toBe('mock-model');
    expect(call.output.type).toBe('object');
    expect(call.system).toContain('Click Forgot password.');
    expect(call.prompt).toContain('Customer first name: Jane');
    expect(call.prompt).toContain(`Category: ${TicketCategory.technicalQuestion}`);
    expect(call.prompt).toContain('Subject: Reset');
    expect(call.prompt).toContain('I forgot my password');
  });

  it('returns null without calling the model when the knowledge base file is missing', async () => {
    mockedReadFile.mockRejectedValue(Object.assign(new Error('not found'), { code: 'ENOENT' }));
    const autoResolveTicket = await loadAutoResolveTicket();

    expect(await autoResolveTicket('Reset', 'I forgot my password', null, null)).toBeNull();
    expect(mockedGenerateText).not.toHaveBeenCalled();
  });

  it('reads the knowledge base file only once across calls', async () => {
    mockedGenerateText.mockResolvedValue({ output: { canResolve: false, reply: '' } } as never);
    const autoResolveTicket = await loadAutoResolveTicket();

    await autoResolveTicket('A', 'a', null, null);
    await autoResolveTicket('B', 'b', null, null);

    expect(mockedReadFile).toHaveBeenCalledTimes(1);
  });

  it('propagates errors from the model call', async () => {
    mockedGenerateText.mockRejectedValue(new Error('upstream failure'));
    const autoResolveTicket = await loadAutoResolveTicket();

    await expect(autoResolveTicket('Reset', 'I forgot my password', null, null)).rejects.toThrow('upstream failure');
  });
});
