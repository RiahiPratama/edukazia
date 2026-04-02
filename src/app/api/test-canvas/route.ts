import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test apakah canvas bisa load di Vercel serverless
    const { createCanvas } = await import('canvas');
    const canvas = createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'red';
    ctx.fillRect(0, 0, 100, 100);
    
    return NextResponse.json({ 
      success: true, 
      message: 'Canvas berjalan dengan baik di Vercel!' 
    });
  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
