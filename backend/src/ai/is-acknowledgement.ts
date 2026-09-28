import { generateText, Output } from 'ai';
import { aiModel } from './client.js';

// Decides whether a customer's follow-up to a resolved ticket is only a thank-you or
// confirmation (so the ticket can stay resolved) rather than a new question or problem.
export async function isAcknowledgementOnly(body: string): Promise<boolean> {
  const { output } = await generateText({
    model: aiModel,
    output: Output.choice({ options: ['acknowledgement', 'needsResponse'] }),
    system:
      'A customer replied to a support ticket that was already marked resolved. Classify the reply. ' +
      'acknowledgement: the message only thanks the team or confirms the issue is solved, with no new ' +
      'question, complaint, or request (e.g. "Thanks!", "That worked, cheers"). ' +
      'needsResponse: anything else — the problem persists, they ask something new, they provide ' +
      'requested details, or you are unsure.',
    prompt: body,
  });

  return output === 'acknowledgement';
}
