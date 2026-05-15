import { Header } from '@/components/layout/header'
import { MarketPageClient } from '@/components/market/market-page-client'

export const dynamic = 'force-dynamic'

export default function MarketPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Market Data" subtitle="Live cryptocurrency and market intelligence" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <MarketPageClient />
      </div>
    </div>
  )
}
