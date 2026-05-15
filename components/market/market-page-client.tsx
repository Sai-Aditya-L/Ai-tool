'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'

interface CoinData {
  id: string
  name: string
  symbol: string
  current_price: number
  price_change_percentage_1h: number
  price_change_percentage_24h: number
  price_change_percentage_7d: number
  market_cap: number
  total_volume: number
  high_24h: number
  low_24h: number
  image: string | null
  rank: number
}

export function MarketPageClient() {
  const [coins, setCoins] = useState<CoinData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState('')
  const [sortBy, setSortBy] = useState<'rank' | 'price' | 'change_24h'>('rank')

  const fetchData = async () => {
    try {
      const res = await fetch('/api/crypto')
      const data = await res.json()
      if (data.coins) {
        setCoins(data.coins)
        setLastUpdated(new Date().toLocaleTimeString())
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    const iv = setInterval(fetchData, 60000)
    return () => clearInterval(iv)
  }, [])

  const sorted = [...coins].sort((a, b) => {
    if (sortBy === 'price') return b.current_price - a.current_price
    if (sortBy === 'change_24h') return (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)
    return (a.rank || 99) - (b.rank || 99)
  })

  const formatPrice = (p: number) => p >= 1000 ? `$${p.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : p >= 1 ? `$${p.toFixed(2)}` : `$${p.toFixed(4)}`
  const formatChange = (c: number) => { const s = c >= 0 ? '+' : ''; return `${s}${c?.toFixed(2) ?? '0.00'}%` }
  const formatMCap = (m: number) => m >= 1e12 ? `$${(m/1e12).toFixed(2)}T` : m >= 1e9 ? `$${(m/1e9).toFixed(1)}B` : `$${(m/1e6).toFixed(0)}M`

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          {[['rank','BY RANK'],['price','BY PRICE'],['change_24h','BY 24H CHANGE']].map(([val, label]) => (
            <button key={val}
              onClick={() => setSortBy(val as typeof sortBy)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${sortBy === val ? 'bg-amber-400/15 text-amber-400 border border-amber-400/30' : 'bg-white/5 text-white/40 border border-white/10 hover:text-white/70'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && <span className="hud-label text-xs opacity-40">UPDATED {lastUpdated}</span>}
          <button onClick={fetchData} className="p-2 rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-400/5 border border-white/10 transition-all">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="hud-panel rounded-xl p-4 animate-pulse h-16" />
          ))}
        </div>
      ) : (
        <>
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 px-4 mb-2 text-[10px] uppercase tracking-wider text-white/30 font-mono">
            <span className="col-span-1">#</span>
            <span className="col-span-3">Asset</span>
            <span className="col-span-2 text-right">Price</span>
            <span className="col-span-2 text-right">1H</span>
            <span className="col-span-2 text-right">24H</span>
            <span className="col-span-2 text-right">Market Cap</span>
          </div>

          <div className="space-y-2">
            {sorted.map(coin => {
              const change24 = coin.price_change_percentage_24h || 0
              const change1h = coin.price_change_percentage_1h || 0
              return (
                <div key={coin.id}
                  className="hud-panel hud-panel-inner rounded-xl grid grid-cols-12 gap-4 items-center px-4 py-3 hover:border-amber-400/15 transition-all">
                  <span className="col-span-1 text-white/30 text-xs">{coin.rank}</span>
                  <div className="col-span-3 flex items-center gap-2.5">
                    {coin.image ? (
                      <img src={coin.image} alt={coin.name} className="w-7 h-7 rounded-full" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-amber-400/20 flex items-center justify-center">
                        <span className="text-amber-400 text-xs font-bold">{coin.symbol.charAt(0)}</span>
                      </div>
                    )}
                    <div>
                      <div className="text-white/90 text-sm font-medium">{coin.name}</div>
                      <div className="text-white/30 text-xs">{coin.symbol}</div>
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="text-white/90 text-sm font-mono font-medium">{formatPrice(coin.current_price)}</span>
                  </div>
                  <div className={`col-span-2 text-right flex items-center justify-end gap-1 text-xs ${change1h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {change1h >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                    {formatChange(change1h)}
                  </div>
                  <div className={`col-span-2 text-right flex items-center justify-end gap-1 text-sm font-medium ${change24 >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {change24 >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                    {formatChange(change24)}
                  </div>
                  <div className="col-span-2 text-right text-white/50 text-xs font-mono">
                    {formatMCap(coin.market_cap)}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-center text-white/20 text-xs mt-4 nexus-mono">Data via CoinGecko • Updates every 60s</p>
        </>
      )}
    </div>
  )
}
