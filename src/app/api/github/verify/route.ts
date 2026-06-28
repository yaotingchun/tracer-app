// POST /api/github/verify
// Verifies GitHub repo URL + PAT via GitHub REST API
import { NextRequest, NextResponse } from 'next/server';
import { verifyRepo } from '@/lib/github';

export async function POST(req: NextRequest) {
  try {
    const { url, token } = await req.json();

    if (!url || !token) {
      return NextResponse.json({ error: 'url and token are required' }, { status: 400 });
    }

    const result = await verifyRepo(url, token);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      repo: {
        id: result.repo!.id,
        name: result.repo!.name,
        fullName: result.repo!.full_name,
        description: result.repo!.description,
        private: result.repo!.private,
        htmlUrl: result.repo!.html_url,
        defaultBranch: result.repo!.default_branch,
        stars: result.repo!.stargazers_count,
        forks: result.repo!.forks_count,
        language: result.repo!.language,
        owner: result.repo!.owner.login,
        ownerAvatar: result.repo!.owner.avatar_url,
      },
    });
  } catch (err) {
    console.error('[verify]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
