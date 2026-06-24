import { NextRequest, NextResponse } from 'next/server';
import categoriesFallback from './categories-fallback.json';
import statsFallback from './stats-fallback.json';

const GOV_API_URL = process.env.GOV_API_URL || 'https://api.posokanei.gov.gr';

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
  const url = `${GOV_API_URL}/${targetPath}${searchParams ? `?${searchParams}` : ''}`;

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

      // Check if we can serve static fallback data
      if (targetPath === 'meta/categories/tree') {
        console.warn(`Gov API returned ${response.status} for categories tree. Serving local static fallback.`);
        return NextResponse.json(categoriesFallback);
      }
      if (targetPath === 'meta/stats') {
        console.warn(`Gov API returned ${response.status} for stats. Serving local static fallback.`);
        return NextResponse.json(statsFallback);
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

    // Check if we can serve static fallback data on error
    if (targetPath === 'meta/categories/tree') {
      console.warn(`Failed to fetch categories tree from Gov API. Serving local static fallback.`);
      return NextResponse.json(categoriesFallback);
    }
    if (targetPath === 'meta/stats') {
      console.warn(`Failed to fetch stats from Gov API. Serving local static fallback.`);
      return NextResponse.json(statsFallback);
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
  const url = `${GOV_API_URL}/${targetPath}`;

  try {
    const body = await req.json();
    console.log(`[Proxy POST] Request to URL: ${url} with body:`, JSON.stringify(body));
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
    console.log(`[Proxy POST] Response status: ${response.status}`);
    if (!response.ok) {
      return NextResponse.json({ error: `Gov API returned ${response.status}` }, { status: response.status });
    }
    const data = await response.json();
    console.log(`[Proxy POST] Returned products count: ${data.products?.length || 0}, total matching: ${data.total || 0}`);
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy POST error", error);
    return NextResponse.json({ error: 'Failed to post to Gov API' }, { status: 500 });
  }
}
