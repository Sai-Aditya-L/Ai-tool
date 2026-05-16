export default function ChatLoading() {
  return (
    <div className="flex flex-col h-screen p-4 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-white/5 mb-6" />
      <div className="flex-1 space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className={`flex gap-3 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
            <div className="w-8 h-8 rounded-full bg-white/5 flex-shrink-0" />
            <div className={`h-16 rounded-xl bg-white/5 ${i % 2 === 0 ? 'w-2/3' : 'w-1/2'}`} />
          </div>
        ))}
      </div>
      <div className="h-14 rounded-xl bg-white/5 mt-4" />
    </div>
  )
}
