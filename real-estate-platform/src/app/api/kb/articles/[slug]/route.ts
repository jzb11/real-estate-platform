import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const article = await prisma.kbArticle.findFirst({
    where: {
      slug,
      isPublished: true,
    },
  });

  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 });
  }

  // Log view and increment count if authenticated
  const { userId: clerkId } = await auth();
  if (clerkId) {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      select: { id: true },
    });

    if (user) {
      // Log the view and increment count in parallel
      await Promise.all([
        prisma.kbAccessLog.create({
          data: {
            articleId: article.id,
            userId: user.id,
          },
        }),
        prisma.kbArticle.update({
          where: { id: article.id },
          data: { viewCount: { increment: 1 } },
        }),
      ]);
    }
  }

  return NextResponse.json({
    id: article.id,
    title: article.title,
    slug: article.slug,
    category: article.category,
    content: article.content,
    viewCount: article.viewCount,
    createdAt: article.createdAt,
    updatedAt: article.updatedAt,
  });
}
