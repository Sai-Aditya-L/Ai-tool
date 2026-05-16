'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import Link from 'next/link'

interface CoinData {
  id: string
  name: string
  symbol: string
  current_price: number
  price_change_percentage_24h: number
  market_cap: number
  image: string | null
}

export function CryptoWidget() {
  const [coins, setCoins] = useState<CoinData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchCrypto = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/crypto?coins=bitcoin,ethereum,solana,dogecoin', { signal })
      const data = await res.json()
      if (data.coins) {
        setCoins(data.coins.slice(0, 4))
        setLastUpdated(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }))
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchCrypto(controller.signal)
    intervalRef.current = setInterval(() => fetchCrypto(), 60 * 1000)
    return () => {
      controller.abort()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchCrypto])

  const formatPrice = (price: number) => {
    if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
    if (price >= 1) return `$${price.toFixed(2)}`
    return `$${price.toFixed(4)}`
  }

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : ''
    return `${sign}${change.toFixed(2)}%`
  }

  return (
    <div className="hud-panel hud-panel-inner rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="hud-label text-xs">CRYPTO MARKET</span>
        <div className="flex items-center gap-2">
          {lastUpdated && <span className="hud-label" style={{ fontSize: 8 }}>UPD {lastUpdated}</span>}
          <button onClick={() => fetchCrypto()} className="text-white/20 hover:text-cyan-400 transition-colors">
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-4 justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="hud-label text-xs">LOADING MARKET DATA...</span>
        </div>
      ) : (
        <div className="space-y-2">
          {coins.map(coin => {
            const isUp = coin.price_change_percentage_24h >= 0
            return (
              <div key={coin.id}
                className="flex items-center gap-3 p-2 rounded-lg bg-white/3 hover:bg-white/5 transition-colors border border-white/5">
                {coin.image ? (
                  <img src={coin.image} alt={coin.name} className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-amber-400/20 flex items-center justify-center">
                    <span className="text-amber-400 text-xs font-bold">{coin.symbol.charAt(0)}</span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-white/80 text-xs font-medium">{coin.symbol}</span>
                    <span className="text-white/30 text-[10px]">{coin.name}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white/90 text-xs font-mono font-medium">{formatPrice(coin.current_price)}</div>
                  <div className={`flex items-center justify-end gap-0.5 text-[10px] ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                    {isUp ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                    {formatChange(coin.price_change_percentage_24h)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Link href="/market"
        className="mt-3 block text-center text-xs text-amber-400/50 hover:text-amber-400 transition-colors pt-2 border-t border-white/5">
        FULL MARKET VIEW →
      </Link>
    </div>
  )
}
