import { generateText, Output } from 'ai';
import { aiModel } from './client.js';
import { TicketCategory } from '../generated/prisma/enums.js';

const categories = Object.values(TicketCategory) as TicketCategory[];

export async function classifyTicket(subject: string, body: string): Promise<TicketCategory> {
  const { output } = await generateText({
    model: aiModel,
    output: Output.choice({ options: categories }),
    system:
      'You classify a customer support ticket into exactly one category based on its subject and first message. ' +
      'generalQuestion: a general question about the product/service, including "how do I..." questions and ' +
      'routine account/settings help (e.g. changing a password, updating a profile, finding a feature) — ' +
      'anything the customer can be walked through, where nothing is actually broken. ' +
      'technicalQuestion: the customer is reporting something that is actually broken or misbehaving — an ' +
      'error message, a crash, a feature not working as expected — not merely asking how to do something. ' +
      'refundRequest: the customer is asking for a refund, a cancellation, or their money back.',
    prompt: `Subject: ${subject}\n\nMessage:\n${body}`,
  });

  return output;
}
