import { NextResponse } from 'next/server';
import { getTopUsers, getUserCount, getUsersByCategory } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const filter = searchParams.get('filter') as 'all' | 'bot' | 'no_lifer' | 'command_spammer' | 'communicative' | null;

    let users;
    if (filter && filter !== 'all') {
      users = getUsersByCategory(filter, limit);
    } else {
      users = getTopUsers(limit, offset);
    }

    const total = getUserCount();

    return NextResponse.json({
      users,
      total,
      limit,
      offset,
      filter: filter || 'all',
    });
  } catch (error) {
    console.error('[API] Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
