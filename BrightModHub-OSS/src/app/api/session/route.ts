import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface BrightModGlobal {
  startMonitoring: (channel: string) => Promise<void>;
  stopMonitoring: () => Promise<void>;
  engine: { getStats: () => Record<string, unknown> };
  getCurrentChannel: () => string;
  getChannelConfig: () => Record<string, unknown>;
}

function getGlobal(): BrightModGlobal | null {
  return (global as Record<string, unknown>).__brightmod as BrightModGlobal | null;
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const brightmod = getGlobal();

    if (!brightmod) {
      return NextResponse.json({ error: 'Server not ready' }, { status: 503 });
    }

    if (action === 'start') {
      const body = await request.json();
      const channel = body.channel;
      if (!channel) {
        return NextResponse.json({ error: 'Channel is required' }, { status: 400 });
      }
      await brightmod.startMonitoring(channel);
      return NextResponse.json({
        status: 'started',
        channel: brightmod.getCurrentChannel(),
        config: brightmod.getChannelConfig(),
      });
    }

    if (action === 'stop') {
      await brightmod.stopMonitoring();
      return NextResponse.json({
        status: 'stopped',
        channel: brightmod.getCurrentChannel(),
      });
    }

    return NextResponse.json({ error: 'Invalid action. Use ?action=start or ?action=stop' }, { status: 400 });
  } catch (error) {
    console.error('[API] Session error:', error);
    return NextResponse.json({ error: 'Failed to manage session' }, { status: 500 });
  }
}

export async function GET() {
  const brightmod = getGlobal();
  if (!brightmod) {
    return NextResponse.json({ error: 'Server not ready' }, { status: 503 });
  }

  return NextResponse.json({
    stats: brightmod.engine.getStats(),
    channel: brightmod.getCurrentChannel(),
    config: brightmod.getChannelConfig(),
  });
}
