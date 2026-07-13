import { NextResponse } from 'next/server';
import { getUser, getMessageHistory, getRelationships, getEventsByUser } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: { username: string } }
) {
  try {
    const { username } = params;
    const user = getUser(username);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const history = getMessageHistory(username, 50);
    const relationships = getRelationships(username);
    const events = getEventsByUser(username, 50);

    return NextResponse.json({
      user,
      history,
      relationships,
      events,
    });
  } catch (error) {
    console.error('[API] Error fetching user details:', error);
    return NextResponse.json({ error: 'Failed to fetch user details' }, { status: 500 });
  }
}
