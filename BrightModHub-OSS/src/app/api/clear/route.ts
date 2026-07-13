import { NextResponse } from 'next/server';
import { clearAllData } from '@/lib/db';

export async function DELETE() {
  try {
    clearAllData();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to clear data:', error);
    return NextResponse.json({ success: false, error: 'Failed to clear data' }, { status: 500 });
  }
}
