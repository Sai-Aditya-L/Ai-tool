import { NextRequest } from 'next/server'
import os from 'os'

export const dynamic = 'force-dynamic'

function getStats() {
  const cpus = os.cpus()
  // Calculate CPU usage via idle vs total ticks
  const cpuUsage = cpus.map(cpu => {
    const total = Object.values(cpu.times).reduce((a, b) => a + b, 0)
    const idle = cpu.times.idle
    return Math.round((1 - idle / total) * 100)
  })
  const avgCpu = Math.round(cpuUsage.reduce((a, b) => a + b, 0) / cpuUsage.length)

  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  const memPercent = Math.round((usedMem / totalMem) * 100)

  const loadAvg = os.loadavg()
  const uptime = os.uptime()

  return {
    cpu: { avg: avgCpu, cores: cpuUsage, count: cpus.length, model: cpus[0]?.model || 'Unknown' },
    memory: { total: totalMem, used: usedMem, free: freeMem, percent: memPercent },
    load: { '1m': loadAvg[0].toFixed(2), '5m': loadAvg[1].toFixed(2), '15m': loadAvg[2].toFixed(2) },
    uptime: Math.floor(uptime),
    platform: os.platform(),
    hostname: os.hostname(),
    arch: os.arch(),
    timestamp: Date.now(),
  }
}

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      const send = () => {
        try {
          const data = JSON.stringify(getStats())
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        } catch {}
      }
      send()
      const interval = setInterval(send, 2000)
      req.signal.addEventListener('abort', () => {
        clearInterval(interval)
        try { controller.close() } catch {}
      })
    },
  })
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
