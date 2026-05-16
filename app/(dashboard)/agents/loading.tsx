export default function AgentsLoading() {
  return (
    <div className="p-6 animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-white/5 mb-6" />
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-white/5" />
        ))}
      </div>
    </div>
  )
}
