import { NextRequest, NextResponse } from 'next/server';
import { getFeedById } from '@/lib/feeds';
import { parseFeed } from '@/lib/rss';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id') || 'feed-1';
  const feed = getFeedById(id);

  try {
    const response = await fetch(feed.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PodcastRSSReader/1.0; +https://vercel.com)',
        'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
      },
      next: { revalidate: 1800 }
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `RSS 获取失败：${response.status} ${response.statusText}` },
        { status: 500 }
      );
    }

    const xml = await response.text();
    const data = parseFeed(xml, feed.url);

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 's-maxage=1800, stale-while-revalidate=3600'
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '未知错误'
      },
      { status: 500 }
    );
  }
}
