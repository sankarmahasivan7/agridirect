import { NextRequest } from 'next/server';
import { handleOptions, jsonResponse, errorResponse } from '@/lib/cors';
import { getAuthUser } from '@/lib/auth';
import { processAiVoiceInteraction } from '@/lib/ai';

export async function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser(req);
    const body = await req.json();
    const { user_prompt, language } = body;

    const result = processAiVoiceInteraction(
      user_prompt || '',
      language || 'en',
      authUser?.role || 'buyer'
    );

    return jsonResponse(result);
  } catch (err: any) {
    console.error('AI voice interaction error:', err);
    return errorResponse(err.message || 'Internal server error', 500);
  }
}

