import { generateText } from 'ai';
import { aiModel } from './client.js';

export type SummarizableEntry = {
  from: string;
  body: string;
  createdAt: Date;
};

export async function summarizeTicket(
  ticketSubject: string,
  entries: SummarizableEntry[]
): Promise<string> {
  const transcript = entries
    .map((entry) => `[${entry.createdAt.toISOString()}] ${entry.from}:\n${entry.body}`)
    .join('\n\n');

  const { text } = await generateText({
    model: aiModel,
    system:
      'You summarize customer support ticket conversations for an agent who is about to read the full thread. ' +
      'Write a short, plain-language summary (2-4 sentences) covering what the customer wants, ' +
      'what has been said or offered so far, and the current state of the issue. ' +
      'Reply with only the summary text, no preamble or headings.',
    prompt: `Ticket subject: ${ticketSubject}\n\nConversation:\n${transcript}`,
  });

  return text.trim();
}
