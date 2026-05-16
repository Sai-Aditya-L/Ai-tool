export default function MeetingsLoading() {
  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
      <div className="space-y-3">
        <div className="h-8 w-40 rounded-lg bg-white/5 mb-4" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-white/5" />
        ))}
      </div>
      <div className="h-96 rounded-xl bg-white/5" />
    </div>
  )
}
