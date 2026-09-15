import { google } from '@ai-sdk/google';

// Single point of provider/model selection. AI features use the Vercel ai-sdk's
// unified provider interface so swapping to another provider (Anthropic, OpenAI, ...)
//  changing this line.
export const aiModel = google('gemini-3.1-flash-lite');
