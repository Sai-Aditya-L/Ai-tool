import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { anthropic } from '@/lib/anthropic'

function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/,
  ]
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { url } = body
  if (!url) return NextResponse.json({ error: 'url is required' }, { status: 400 })

  const videoId = extractVideoId(url)
  if (!videoId) return NextResponse.json({ error: 'Invalid YouTube URL' }, { status: 400 })

  try {
    // Dynamically import youtube-transcript
    const { YoutubeTranscript } = await import('youtube-transcript')
    const transcript = await YoutubeTranscript.fetchTranscript(videoId)

    if (!transcript || transcript.length === 0) {
      return NextResponse.json({ error: 'No transcript available for this video. It may be private, not have captions, or region-restricted.' }, { status: 422 })
    }

    // Build full transcript text (truncate to ~12k tokens)
    const fullText = transcript
      .map((t: { text: string; offset: number }) => t.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 48000)

    const durationSec = transcript.reduce((sum: number, t: any) => sum + (t.duration || 0), 0)
    const durationMin = Math.round(durationSec / 60)

    // Summarize with Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: `Please provide a comprehensive summary of this YouTube video transcript. Include:
1. **Main Topic** - What is this video about?
2. **Key Points** - The 5-7 most important points (bullet points)
3. **Key Insights** - Notable quotes or insights
4. **Conclusion** - Main takeaway

Keep the summary clear and useful. Video duration: ~${durationMin} minutes.

TRANSCRIPT:
${fullText}`,
      }],
    })

    const summary = response.content[0].type === 'text' ? response.content[0].text : ''
    const wordCount = fullText.split(' ').length

    return NextResponse.json({
      videoId,
      url: `https://youtube.com/watch?v=${videoId}`,
      summary,
      metadata: {
        transcriptSegments: transcript.length,
        wordCount,
        durationMinutes: durationMin,
      },
    })
  } catch (e: any) {
    if (e?.message?.includes('Could not get transcripts')) {
      return NextResponse.json({ error: 'This video does not have available captions/transcript.' }, { status: 422 })
    }
    return NextResponse.json({ error: e?.message || 'Failed to process video' }, { status: 500 })
  }
}
