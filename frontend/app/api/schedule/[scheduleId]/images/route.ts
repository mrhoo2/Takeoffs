import { NextRequest, NextResponse } from 'next/server';
import { storage } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  const { scheduleId } = await params;

  if (!storage.scheduleImages.has(scheduleId)) {
    return NextResponse.json(
      { detail: 'Schedule images not found' },
      { status: 404 }
    );
  }

  const images = storage.scheduleImages.get(scheduleId);
  
  return NextResponse.json({ images });
}
