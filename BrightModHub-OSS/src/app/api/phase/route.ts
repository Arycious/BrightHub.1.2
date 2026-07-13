import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface BrightModGlobal {
  toggleSpamMode: () => boolean;
  engine: { getStats: () => Record<string, unknown> };
}

function getGlobal(): BrightModGlobal | null {
  return (global as Record<string, unknown>).__brightmod as BrightModGlobal | null;
}

export async function POST() {
  try {
    const brightmod = getGlobal();
    if (!brightmod) {
      return NextResponse.json({ error: 'Server not ready' }, { status: 503 });
    }

    const newState = brightmod.toggleSpamMode();
    return NextResponse.json({ spamMode: newState });
  } catch (error) {
    console.error('[API] Phase toggle error:', error);
    return NextResponse.json({ error: 'Failed to toggle phase' }, { status: 500 });
  }
}
