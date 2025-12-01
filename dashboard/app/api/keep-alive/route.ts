// Cron job endpoint to keep Render backend alive
// This runs every 14 minutes to prevent cold starts

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'https://supply-bot.onrender.com';
  
  try {
    const response = await fetch(`${backendUrl}/health`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Supply-Bot-KeepAlive/1.0',
      },
    });
    
    const data = await response.json();
    
    return Response.json({
      success: true,
      backend: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: 'Failed to ping backend',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
