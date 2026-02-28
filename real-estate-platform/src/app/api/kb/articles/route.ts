import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { KbCategory } from '@prisma/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const categoryParam = searchParams.get('category');
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);
  const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10), 1);
  const skip = (page - 1) * limit;

  // Validate category param if provided
  const validCategories = Object.values(KbCategory) as string[];
  if (categoryParam && !validCategories.includes(categoryParam)) {
    return NextResponse.json(
      { error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
      { status: 400 }
    );
  }

  const where = {
    isPublished: true,
    ...(categoryParam ? { category: categoryParam as KbCategory } : {}),
  };

  const [articles, total] = await Promise.all([
    prisma.kbArticle.findMany({
      where,
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        viewCount: true,
        createdAt: true,
      },
      orderBy: [{ viewCount: 'desc' }, { createdAt: 'desc' }],
      take: limit,
      skip,
    }),
    prisma.kbArticle.count({ where }),
  ]);

  return NextResponse.json({ articles, total, page, limit });
}
