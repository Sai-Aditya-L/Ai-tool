'use client'

import { useState } from 'react'
import { Header } from '@/components/layout/header'
import { FolderOpen, Upload, FileText, File, Trash2, Search } from 'lucide-react'
import { cn, formatBytes } from '@/lib/utils'

export default function FilesPage() {
  const [dragOver, setDragOver] = useState(false)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Files" subtitle="Document storage & AI analysis" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-4">

          {/* Phase notice */}
          <div className="glass-panel rounded-xl p-4 border border-violet-500/15 flex items-start gap-3">
            <FolderOpen size={18} className="text-violet-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white/70 text-sm font-medium">File System — Phase 3</p>
              <p className="text-white/40 text-xs mt-0.5">
                Full file upload, storage, and AI document analysis (PDF summaries, OCR, code review)
                is coming in Phase 3. The upload interface is ready — backend storage integration in progress.
              </p>
            </div>
          </div>

          {/* Upload area */}
          <div
            className={cn(
              'border-2 border-dashed rounded-2xl p-12 flex flex-col items-center gap-4 transition-all cursor-pointer',
              dragOver
                ? 'border-cyan-400/60 bg-cyan-400/5'
                : 'border-white/10 hover:border-cyan-400/30 hover:bg-white/2'
            )}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false) }}
          >
            <div className="w-16 h-16 rounded-2xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
              <Upload size={28} className="text-cyan-400/60" />
            </div>
            <div className="text-center">
              <p className="text-white/60 font-medium">Drop files here or click to upload</p>
              <p className="text-white/30 text-sm mt-1">PDF, Word, Excel, Images, Code files (Phase 3)</p>
            </div>
            <button className="nexus-btn-primary text-sm flex items-center gap-2 opacity-50 cursor-not-allowed">
              <Upload size={14} />
              Select Files (Coming Phase 3)
            </button>
          </div>

          {/* Supported formats */}
          <div className="glass-panel rounded-xl p-4">
            <p className="text-white/40 text-xs uppercase tracking-wider mb-3">Planned File Support</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: '📄', type: 'PDF', desc: 'AI summaries, text extraction' },
                { icon: '📝', type: 'Word/Docs', desc: 'Document analysis' },
                { icon: '📊', type: 'Excel/Sheets', desc: 'Data analysis' },
                { icon: '🖼️', type: 'Images', desc: 'OCR, visual analysis' },
                { icon: '💻', type: 'Code files', desc: 'Code review, explanation' },
                { icon: '📋', type: 'Markdown', desc: 'Notes, documentation' },
                { icon: '🗂️', type: 'Text files', desc: 'Content analysis' },
                { icon: '🔒', type: 'Encrypted', desc: 'Secure storage' },
              ].map(f => (
                <div key={f.type} className="flex items-center gap-2 p-2 rounded-lg bg-white/2">
                  <span className="text-lg">{f.icon}</span>
                  <div>
                    <p className="text-white/60 text-xs font-medium">{f.type}</p>
                    <p className="text-white/30 text-[10px]">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
