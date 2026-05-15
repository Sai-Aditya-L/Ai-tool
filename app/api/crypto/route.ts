import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const DEFAULT_COINS = ['bitcoin', 'ethereum', 'solana', 'dogecoin', 'ripple', 'cardano', 'polkadot', 'avalanche-2']

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const coins = req.nextUrl.searchParams.get('coins')?.split(',') || DEFAULT_COINS
  const currency = req.nextUrl.searchParams.get('currency') || 'usd'

  try {
    const ids = coins.join(',')
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency}&ids=${ids}&order=market_cap_desc&per_page=${coins.length}&page=1&sparkline=false&price_change_percentage=1h,24h,7d`,
      { next: { revalidate: 60 }, headers: { 'Accept': 'application/json' } }
    )

    if (!res.ok) {
      // Fallback to simple price endpoint
      const simpleRes = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`,
        { next: { revalidate: 60 } }
      )
      const simpleData = await simpleRes.json()
      const coins2 = Object.entries(simpleData).map(([id, data]: [string, any]) => ({
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        symbol: id.slice(0, 3).toUpperCase(),
        current_price: data[currency],
        price_change_percentage_24h: data[`${currency}_24h_change`],
        market_cap: data[`${currency}_market_cap`],
        total_volume: data[`${currency}_24h_vol`],
        image: null,
      }))
      return NextResponse.json({ coins: coins2, currency, fetchedAt: new Date().toISOString() })
    }

    const data = await res.json()
    const coinsData = data.map((c: any) => ({
      id: c.id,
      name: c.name,
      symbol: c.symbol?.toUpperCase(),
      current_price: c.current_price,
      price_change_percentage_1h: c.price_change_percentage_1h_in_currency,
      price_change_percentage_24h: c.price_change_percentage_24h,
      price_change_percentage_7d: c.price_change_percentage_7d_in_currency,
      market_cap: c.market_cap,
      total_volume: c.total_volume,
      high_24h: c.high_24h,
      low_24h: c.low_24h,
      image: c.image,
      rank: c.market_cap_rank,
    }))

    return NextResponse.json({ coins: coinsData, currency, fetchedAt: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: 'Crypto data unavailable' }, { status: 500 })
  }
}
