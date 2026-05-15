'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Header } from '@/components/layout/header'
import {
  Upload, FileText, FileJson, File, FileCode, Trash2,
  FolderOpen, Sparkles, Loader2, AlertCircle
} from 'lucide-react'
import { cn, formatBytes, formatRelativeTime } from '@/lib/utils'
import toast from 'react-hot-toast'

interface UserFile {
  id: string
  name: string
  originalName: string
  mimeType: string
  size: number
  path: string        // extracted text content lives here
  url: string | null
  summary: string | null
  tags: string | null
  createdAt: string
  updatedAt: string
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

const ACCEPT_TYPES = '.txt,.md,.json,.csv,.pdf'

function getMimeIcon(mimeType: string) {
  if (mimeType === 'application/json') return FileJson
  if (mimeType === 'text/csv') return FileCode
  if (mimeType === 'application/pdf') return File
  if (mimeType.startsWith('text/')) return FileText
  return File
}

function getMimeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    'text/plain': 'TXT',
    'text/markdown': 'MD',
    'text/x-markdown': 'MD',
    'application/x-markdown': 'MD',
    'application/json': 'JSON',
    'text/csv': 'CSV',
    'application/pdf': 'PDF',
  }
  return map[mimeType] ?? mimeType.split('/')[1]?.toUpperCase() ?? 'FILE'
}

function getMimeColor(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'text-red-400 bg-red-400/10 border-red-400/20'
  if (mimeType === 'application/json') return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'
  if (mimeType === 'text/csv') return 'text-green-400 bg-green-400/10 border-green-400/20'
  if (mimeType.startsWith('text/')) return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/20'
  return 'text-violet-400 bg-violet-400/10 border-violet-400/20'
}

export default function FilesPage() {
  const [files, setFiles] = useState<UserFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { fetchFiles() }, [])

  async function fetchFiles() {
    setLoading(true)
    try {
      const res = await fetch('/api/files')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setFiles(data.files || [])
    } catch {
      toast.error('Failed to load files')
    } finally {
      setLoading(false)
    }
  }

  async function uploadFile(file: File) {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`File too large — max 5 MB (${formatBytes(file.size)})`)
      return
    }

    setUploading(true)
    const toastId = toast.loading(`Uploading ${file.name}…`)

    try {
      const fd = new FormData()
      fd.append('file', file)

      const res = await fetch('/api/files', { method: 'POST', body: fd })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? 'Upload failed')
      }
      const data = await res.json()
      setFiles(prev => [data.file, ...prev])
      toast.success(`${file.name} uploaded & analysed`, { id: toastId })
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed', { id: toastId })
    } finally {
      setUploading(false)
    }
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    Array.from(fileList).forEach(uploadFile)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [])

  async function deleteFile(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/files/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setFiles(prev => prev.filter(f => f.id !== id))
      if (expandedId === id) setExpandedId(null)
      toast.success('File deleted')
    } catch {
      toast.error('Failed to delete file')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Files" subtitle="Document intelligence vault" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-5">

          {/* Upload zone */}
          <div
            className={cn(
              'border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-4 transition-all cursor-pointer select-none',
              dragOver
                ? 'border-cyan-400/70 bg-cyan-400/6 scale-[1.01]'
                : uploading
                ? 'border-violet-500/40 bg-violet-500/4 cursor-wait'
                : 'border-white/10 hover:border-cyan-400/35 hover:bg-white/[0.015]'
            )}
            onClick={() => !uploading && fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragEnter={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPT_TYPES}
              multiple
              className="hidden"
              onChange={e => handleFiles(e.target.files)}
            />

            <div className={cn(
              'w-16 h-16 rounded-2xl border flex items-center justify-center transition-colors',
              dragOver
                ? 'bg-cyan-400/20 border-cyan-400/40'
                : 'bg-cyan-400/8 border-cyan-400/15'
            )}>
              {uploading
                ? <Loader2 size={28} className="text-violet-400 animate-spin" />
                : <Upload size={28} className={cn('transition-colors', dragOver ? 'text-cyan-400' : 'text-cyan-400/55')} />
              }
            </div>

            <div className="text-center">
              <p className="text-white/65 font-medium">
                {uploading ? 'Uploading & analysing…' : dragOver ? 'Drop to upload' : 'Drop files here or click to browse'}
              </p>
              <p className="text-white/30 text-sm mt-1">
                TXT, MD, JSON, CSV, PDF &nbsp;·&nbsp; max 5 MB per file
              </p>
            </div>

            {!uploading && (
              <button
                className="nexus-btn-primary text-sm flex items-center gap-2"
                onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}
              >
                <Upload size={14} />
                Select Files
              </button>
            )}
          </div>

          {/* Info strip */}
          <div className="glass-panel rounded-xl p-3 flex items-center gap-3 border border-violet-500/10">
            <Sparkles size={15} className="text-violet-400 flex-shrink-0" />
            <p className="text-white/40 text-xs">
              NEXUS reads your files and generates AI summaries automatically.
              Text files (TXT, MD, JSON, CSV) are fully indexed; PDFs are summarised by filename and type.
            </p>
          </div>

          {/* File list */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            </div>
          ) : files.length === 0 ? (
            <div className="glass-panel rounded-2xl py-16 flex flex-col items-center gap-3">
              <FolderOpen size={42} className="text-white/15" />
              <p className="text-white/35 font-medium">No files yet</p>
              <p className="text-white/20 text-sm">Upload a document above to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-white/30 text-xs uppercase tracking-wider px-1">
                {files.length} {files.length === 1 ? 'file' : 'files'}
              </p>

              {files.map(file => {
                const Icon = getMimeIcon(file.mimeType)
                const badgeColor = getMimeColor(file.mimeType)
                const label = getMimeLabel(file.mimeType)
                const isExpanded = expandedId === file.id
                const isDeleting = deletingId === file.id

                return (
                  <div
                    key={file.id}
                    className={cn(
                      'glass-panel-hover rounded-xl border border-white/5 transition-all',
                      isDeleting && 'opacity-50 pointer-events-none'
                    )}
                  >
                    {/* Main row */}
                    <div
                      className="flex items-center gap-3 p-4 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : file.id)}
                    >
                      {/* Type badge */}
                      <div className={cn(
                        'w-10 h-10 rounded-lg border flex-shrink-0 flex items-center justify-center',
                        badgeColor
                      )}>
                        <Icon size={18} />
                      </div>

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white/85 text-sm font-medium truncate max-w-xs">
                            {file.originalName}
                          </p>
                          <span className={cn(
                            'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                            badgeColor
                          )}>
                            {label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-white/30 text-xs">{formatBytes(file.size)}</span>
                          <span className="text-white/20 text-xs">·</span>
                          <span className="text-white/30 text-xs">{formatRelativeTime(file.createdAt)}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => deleteFile(file.id, file.originalName)}
                          className="p-2 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-400/8 transition-colors"
                          title="Delete file"
                        >
                          {isDeleting
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Trash2 size={14} />
                          }
                        </button>
                      </div>
                    </div>

                    {/* Expanded: summary + content preview */}
                    {isExpanded && (
                      <div className="px-4 pb-4 pt-0 border-t border-white/5 space-y-3">
                        {file.summary ? (
                          <div className="flex items-start gap-2 pt-3">
                            <Sparkles size={13} className="text-violet-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-white/35 text-[10px] uppercase tracking-wider mb-1">AI Summary</p>
                              <p className="text-white/60 text-xs leading-relaxed">{file.summary}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 pt-3 text-white/30 text-xs">
                            <AlertCircle size={12} />
                            <span>No summary available</span>
                          </div>
                        )}

                        {file.path && file.path.length > 0 && (
                          <div>
                            <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Content Preview</p>
                            <pre className="text-white/35 text-[11px] leading-relaxed font-mono bg-white/[0.02] rounded-lg p-3 max-h-40 overflow-y-auto whitespace-pre-wrap break-words">
                              {file.path.slice(0, 800)}{file.path.length > 800 ? '\n…' : ''}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
