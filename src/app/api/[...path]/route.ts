import { NextRequest, NextResponse } from 'next/server';

// In-memory cache to bypass Gov API rate-limiting (429)
const apiCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes cache time-to-live

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const searchParams = req.nextUrl.searchParams.toString();
  const targetPath = path.join('/');
  const url = `https://api.posokanei.gov.gr/${targetPath}${searchParams ? `?${searchParams}` : ''}`;

  // Check cache first
  const cached = apiCache.get(url);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return NextResponse.json(cached.data);
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'el-GR,el;q=0.9,en;q=0.8',
        'Origin': 'https://posokanei.gov.gr',
        'Referer': 'https://posokanei.gov.gr/'
      }
    });

    if (!response.ok) {
      // If Gov API is rate limiting (429) or erroring, serve stale cache if available
      if (cached) {
        console.warn(`Gov API returned ${response.status}, serving stale cache fallback for ${url}`);
        return NextResponse.json(cached.data);
      }
      return NextResponse.json({ error: `Gov API returned ${response.status}` }, { status: response.status });
    }

    const data = await response.json();
    
    // Save to cache
    apiCache.set(url, { data, timestamp: Date.now() });
    
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy GET error", error);
    if (cached) {
      return NextResponse.json(cached.data);
    }
    return NextResponse.json({ error: 'Failed to fetch from Gov API' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const targetPath = path.join('/');
  const url = `https://api.posokanei.gov.gr/${targetPath}`;

  try {
    const body = await req.json();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Origin': 'https://posokanei.gov.gr',
        'Referer': 'https://posokanei.gov.gr/'
      },
      body: JSON.stringify(body)
    });
    if (!response.ok) {
      return NextResponse.json({ error: `Gov API returned ${response.status}` }, { status: response.status });
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy POST error", error);
    return NextResponse.json({ error: 'Failed to post to Gov API' }, { status: 500 });
  }
}
