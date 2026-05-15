import { Header } from '@/components/layout/header'
import { NewsPageClient } from '@/components/news/news-page-client'

export const dynamic = 'force-dynamic'

export default function NewsPage() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Intel Feed" subtitle="Real-time global news and intelligence" />
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <NewsPageClient />
      </div>
    </div>
  )
}
