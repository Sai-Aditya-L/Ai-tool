export default function TasksLoading() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div className="h-8 w-48 rounded-lg bg-white/5" />
        <div className="h-9 w-32 rounded-lg bg-white/5" />
      </div>
      {[...Array(8)].map((_, i) => (
        <div key={i} className="h-14 rounded-xl bg-white/5" />
      ))}
    </div>
  )
}
