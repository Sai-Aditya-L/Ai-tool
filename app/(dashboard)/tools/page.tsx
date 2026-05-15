'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { QrCode, Youtube, Download, Copy, Check, Loader2, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ToolsPage() {
  // QR Code state
  const [qrText, setQrText] = useState('')
  const [qrSize, setQrSize] = useState(300)
  const [qrResult, setQrResult] = useState<string | null>(null)
  const [qrLoading, setQrLoading] = useState(false)
  const [qrCopied, setQrCopied] = useState(false)

  // YouTube state
  const [ytUrl, setYtUrl] = useState('')
  const [ytResult, setYtResult] = useState<{ summary: string; metadata: any; videoId: string; url: string } | null>(null)
  const [ytLoading, setYtLoading] = useState(false)
  const [ytError, setYtError] = useState('')

  const generateQR = async () => {
    if (!qrText.trim()) { toast.error('Enter text or URL first'); return }
    setQrLoading(true)
    setQrResult(null)
    try {
      const res = await fetch('/api/tools/qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: qrText, size: qrSize, darkColor: '#00e5ff', lightColor: '#000810' }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      setQrResult(data.dataUrl)
    } catch {
      toast.error('QR generation failed')
    }
    setQrLoading(false)
  }

  const downloadQR = () => {
    if (!qrResult) return
    const a = document.createElement('a')
    a.href = qrResult
    a.download = 'nexus-qr.png'
    a.click()
  }

  const copyQR = async () => {
    if (!qrResult) return
    try {
      const blob = await fetch(qrResult).then(r => r.blob())
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
      setQrCopied(true)
      setTimeout(() => setQrCopied(false), 2000)
      toast.success('QR code copied!')
    } catch {
      toast.error('Copy not supported in this browser')
    }
  }

  const summarizeYT = async () => {
    if (!ytUrl.trim()) { toast.error('Enter a YouTube URL'); return }
    setYtLoading(true)
    setYtResult(null)
    setYtError('')
    try {
      const res = await fetch('/api/tools/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: ytUrl }),
      })
      const data = await res.json()
      if (data.error) { setYtError(data.error); setYtLoading(false); return }
      setYtResult(data)
    } catch {
      setYtError('Failed to process video')
    }
    setYtLoading(false)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Tools" subtitle="Utility tools powered by NEXUS" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* QR Code Generator */}
          <div className="hud-panel hud-panel-inner rounded-xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
                <QrCode size={18} className="text-cyan-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold hud-text-cyan" style={{ letterSpacing: '0.05em' }}>QR CODE GENERATOR</h2>
                <p className="text-white/40 text-xs">Convert any text or URL into a QR code</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="hud-label text-xs mb-2 block">TEXT OR URL</label>
                <textarea
                  value={qrText}
                  onChange={e => setQrText(e.target.value)}
                  placeholder="https://example.com or any text..."
                  className="nexus-input resize-none h-20 text-sm"
                  onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) generateQR() }}
                />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="hud-label text-xs mb-1 block">SIZE: {qrSize}px</label>
                  <input type="range" min={150} max={600} step={50} value={qrSize}
                    onChange={e => setQrSize(parseInt(e.target.value))}
                    className="w-full accent-cyan-400" />
                </div>
              </div>
              <button onClick={generateQR} disabled={qrLoading || !qrText.trim()}
                className="w-full nexus-btn-primary flex items-center justify-center gap-2 py-2.5">
                {qrLoading ? <Loader2 size={15} className="animate-spin" /> : <QrCode size={15} />}
                {qrLoading ? 'GENERATING...' : 'GENERATE QR CODE'}
              </button>
            </div>

            {qrResult && (
              <div className="mt-5 flex flex-col items-center gap-3">
                <div className="p-3 rounded-xl border border-cyan-400/20 bg-black/40">
                  <img src={qrResult} alt="QR Code" className="rounded-lg" style={{ width: Math.min(qrSize, 260) }} />
                </div>
                <div className="flex gap-2">
                  <button onClick={downloadQR}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-sm hover:bg-cyan-400/20 transition-all">
                    <Download size={13} /> Download
                  </button>
                  <button onClick={copyQR}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white/60 text-sm hover:bg-white/10 transition-all">
                    {qrCopied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                    {qrCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* YouTube Summarizer */}
          <div className="hud-panel hud-panel-inner rounded-xl p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-lg bg-red-400/10 border border-red-400/20 flex items-center justify-center">
                <Youtube size={18} className="text-red-400" />
              </div>
              <div>
                <h2 className="text-white font-semibold" style={{ letterSpacing: '0.05em' }}>YOUTUBE SUMMARIZER</h2>
                <p className="text-white/40 text-xs">Get AI summaries of any YouTube video</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="hud-label text-xs mb-2 block">YOUTUBE URL OR VIDEO ID</label>
                <input
                  type="text"
                  value={ytUrl}
                  onChange={e => setYtUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="nexus-input text-sm"
                  onKeyDown={e => { if (e.key === 'Enter') summarizeYT() }}
                />
              </div>
              <button onClick={summarizeYT} disabled={ytLoading || !ytUrl.trim()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{ background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' }}>
                {ytLoading ? <Loader2 size={15} className="animate-spin" /> : <Youtube size={15} />}
                {ytLoading ? 'ANALYZING VIDEO...' : 'SUMMARIZE VIDEO'}
              </button>
            </div>

            {ytLoading && (
              <div className="mt-5 p-4 rounded-lg bg-white/3 border border-white/8">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <span className="hud-label text-xs">FETCHING TRANSCRIPT & ANALYZING...</span>
                </div>
                <div className="space-y-2">
                  {[80, 60, 70, 50].map((w, i) => (
                    <div key={i} className="h-2 rounded animate-pulse bg-white/10" style={{ width: `${w}%` }} />
                  ))}
                </div>
              </div>
            )}

            {ytError && (
              <div className="mt-4 p-3 rounded-lg bg-red-400/8 border border-red-400/20">
                <p className="text-red-400 text-sm">{ytError}</p>
              </div>
            )}

            {ytResult && (
              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs text-white/40">
                    <span>{ytResult.metadata.durationMinutes} min video</span>
                    <span>•</span>
                    <span>{ytResult.metadata.wordCount.toLocaleString()} words</span>
                  </div>
                  <a href={ytResult.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-red-400/60 hover:text-red-400">
                    <ExternalLink size={11} /> Watch
                  </a>
                </div>
                <div className="p-4 rounded-lg bg-white/3 border border-white/8 max-h-64 overflow-y-auto">
                  <div className="text-white/75 text-sm leading-relaxed whitespace-pre-wrap">{ytResult.summary}</div>
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(ytResult!.summary).then(() => toast.success('Summary copied!'))}
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
                  <Copy size={11} /> Copy Summary
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
