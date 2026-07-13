import { NextResponse } from 'next/server';
import { exportScoresToFile } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const filePath = exportScoresToFile();
    return NextResponse.json({
      success: true,
      path: filePath,
      message: `Scores exported to ${filePath}`,
    });
  } catch (error) {
    console.error('[API] Export error:', error);
    return NextResponse.json({ error: 'Failed to export scores' }, { status: 500 });
  }
}
