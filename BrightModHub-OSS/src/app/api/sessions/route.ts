import { NextResponse } from 'next/server';
import { getSessions } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sessions = getSessions();
    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('Failed to fetch sessions:', error);
    return NextResponse.json({ sessions: [] });
  }
}
