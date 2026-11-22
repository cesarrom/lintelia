import OpenAI from 'openai';
import { env, NotConfiguredError } from '../constants';

/**
 * Lazily constructed vendor clients. Constructing them at import time made the whole API fail to boot without
 * credentials; now only the features that need them fail, with a clear "not configured" error.
 */
let openai: OpenAI | undefined;
export const openaiClient = () => {
  if (!env.OPENAI_API_KEY) throw new NotConfiguredError('AI generation/extraction (OpenAI)', ['OPENAI_API_KEY']);
  return (openai ??= new OpenAI({ apiKey: env.OPENAI_API_KEY }));
};
