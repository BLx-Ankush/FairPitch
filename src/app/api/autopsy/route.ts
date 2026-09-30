import { NextRequest, NextResponse } from 'next/server';
import {
  AutopsyRequestPayload,
  GEMINI_MODEL,
  generateAutopsy,
} from '@/lib/autopsy';

// Top-level constant as requested
export { GEMINI_MODEL };

export async function POST(req: NextRequest) {
  try {
    const payload = (await req.json()) as AutopsyRequestPayload;

    if (!payload || !payload.teamId) {
      return NextResponse.json(
        { error: 'Invalid request payload: teamId is required' },
        { status: 400 }
      );
    }

    const result = await generateAutopsy(payload);

    return NextResponse.json({
      success: true,
      text: result.text,
      source: result.source,
      model: GEMINI_MODEL,
    });
  } catch (error) {
    console.error('API /api/autopsy error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown server error',
      },
      { status: 500 }
    );
  }
}
