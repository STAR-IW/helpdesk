import { readFile } from 'node:fs/promises';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { aiModel } from './client.js';
import type { TicketCategory } from '../generated/prisma/enums.js';

// Resolves to backend/knowledge-base.md from both src/ai (tsx) and dist/ai (compiled).
const KNOWLEDGE_BASE_URL = new URL('../../knowledge-base.md', import.meta.url);

let knowledgeBase: Promise<string | null> | undefined;

// The knowledge base file is optional: without it, nothing can be auto-resolved.
function loadKnowledgeBase(): Promise<string | null> {
  knowledgeBase ??= readFile(KNOWLEDGE_BASE_URL, 'utf8').catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') return null;
    knowledgeBase = undefined;
    throw err;
  });
  return knowledgeBase;
}

const autoResolveSchema = z.object({
  canResolve: z.boolean(),
  reply: z.string(),
});

// Drafts a reply to a new ticket from the knowledge base. Returns null when the
// knowledge base doesn't fully answer the ticket, so it should go to an agent instead.
export async function autoResolveTicket(
  subject: string,
  body: string,
  category: TicketCategory | null,
  customerFirstName: string | null
): Promise<string | null> {
  const kb = await loadKnowledgeBase();
  if (!kb?.trim()) return null;

  const { output } = await generateText({
    model: aiModel,
    output: Output.object({ schema: autoResolveSchema }),
    system:
      'You are a customer support assistant deciding whether a new support ticket can be answered ' +
      'entirely from the knowledge base below, without a human agent.\n' +
      'Set canResolve to true only if a knowledge base entry fully answers everything the customer asked. ' +
      'Set canResolve to false (and reply to an empty string) if any part of the ticket is not covered, ' +
      'if the customer reports a problem they have already tried the documented steps for, ' +
      'if the customer is upset or asking to speak to a person, or if the request needs someone to look up ' +
      'or change their account, order, or payment.\n' +
      'When canResolve is true, write the reply using only facts from the knowledge base — never invent ' +
      'policies, links, or timelines.\n' +
      'Tone: professional, warm, and customer-friendly. Acknowledge the customer\'s issue in one short ' +
      'sentence, then get straight to the answer. Be concise and clear; avoid jargon, over-apologizing, ' +
      'and filler.\n' +
      'Format the reply as plain text (no Markdown symbols like ** or #) with real line breaks:\n' +
      '- A greeting line on its own, addressing the customer by the given first name (if none is given, ' +
      'use "Hi there," instead of inventing a name), followed by a blank line.\n' +
      '- Short paragraphs separated by blank lines.\n' +
      '- Steps as a numbered list, one step per line ("1. ...", "2. ..."); non-sequential points as a ' +
      'bulleted list, one per line ("- ...").\n' +
      '- A closing line offering further help, then a blank line, then the sign-off on two lines: ' +
      '"Best regards," and "The Support Team".\n' +
      'Output only the reply text, with no preamble or quotes.\n\n' +
      `Knowledge base:\n${kb}`,
    prompt:
      `Customer first name: ${customerFirstName ?? '(unknown)'}\n` +
      `Category: ${category ?? '(unclassified)'}\n` +
      `Subject: ${subject}\n\nMessage:\n${body}`,
  });

  const reply = output.reply.trim();
  return output.canResolve && reply ? reply : null;
}
