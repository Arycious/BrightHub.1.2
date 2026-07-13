import { NextResponse } from 'next/server';
import { getRecentEvents } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const events = getRecentEvents(limit);

    return NextResponse.json({ events });
  } catch (error) {
    console.error('[API] Error fetching events:', error);
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 });
  }
}
