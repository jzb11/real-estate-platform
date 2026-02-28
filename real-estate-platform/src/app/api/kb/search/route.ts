import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';

  if (q.length < 2) {
    return NextResponse.json(
      { error: 'Search query must be at least 2 characters' },
      { status: 400 }
    );
  }

  const results = await prisma.kbArticle.findMany({
    where: {
      isPublished: true,
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      title: true,
      slug: true,
      category: true,
      viewCount: true,
    },
    orderBy: [{ viewCount: 'desc' }, { title: 'asc' }],
    take: 20,
  });

  return NextResponse.json({ results, query: q, total: results.length });
}
