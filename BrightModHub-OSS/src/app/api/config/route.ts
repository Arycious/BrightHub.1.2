import { NextResponse } from 'next/server';
import { getChannelConfig, updateChannelConfig } from '@/lib/channel-config';
import { getCurrentChannel } from '@/lib/db';

export const dynamic = 'force-dynamic';

const GLOBAL_KEY = '__brightmod';

interface ServerState {
  reloadEngine?: (channel: string) => void;
}

function getServerState(): ServerState | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any)[GLOBAL_KEY] as ServerState | undefined;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel') || getCurrentChannel();

    const config = getChannelConfig(channel);

    return NextResponse.json({ channel, config });
  } catch (error) {
    console.error('[API] Error fetching channel config:', error);
    return NextResponse.json({ error: 'Failed to fetch channel config' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const channel = searchParams.get('channel') || getCurrentChannel();

    const body = await request.json();
    const updated = updateChannelConfig(channel, body.config || body);

    // If the server has a live detection engine for this channel, reload its config
    const serverState = getServerState();
    if (serverState?.reloadEngine) {
      serverState.reloadEngine(channel);
    }

    return NextResponse.json({ channel, config: updated });
  } catch (error) {
    console.error('[API] Error updating channel config:', error);
    return NextResponse.json({ error: 'Failed to update channel config' }, { status: 500 });
  }
}
