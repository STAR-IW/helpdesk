import { generateText } from 'ai';
import { aiModel } from './client.js';

export async function polishReply(
  draft: string,
  ticketSubject: string,
  agentName: string,
  customerFirstName: string | null
): Promise<string> {
  const { text } = await generateText({
    model: aiModel,
    system:
      'You rewrite customer support agent replies to be clearer, more professional, and more empathetic, ' +
      'while preserving the original meaning and any facts, links, or instructions. ' +
      'Keep roughly the same length. Open the reply by addressing the customer by the given first name ' +
      "(if none is given, use a generic greeting like \"Hi there\" instead of inventing a name), " +
      'replacing any existing greeting in the draft rather than adding a second one. ' +
      'End the reply with a brief sign-off signed with the given agent name ' +
      '(replace any existing sign-off in the draft rather than adding a second one). ' +
      'Reply with only the rewritten message text, no preamble or quotes.',
    prompt:
      `Agent name: ${agentName}\nCustomer first name: ${customerFirstName ?? '(unknown)'}\n` +
      `Ticket subject: ${ticketSubject}\n\nAgent draft reply:\n${draft}`,
  });

  return text.trim();
}
