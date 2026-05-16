export default function FocusLoading() {
  return (
    <div className="p-6 flex flex-col items-center animate-pulse">
      <div className="h-8 w-48 rounded-lg bg-white/5 mb-8" />
      <div className="w-48 h-48 rounded-full bg-white/5 mb-6" />
      <div className="h-10 w-64 rounded-xl bg-white/5 mb-4" />
      <div className="h-9 w-32 rounded-lg bg-white/5" />
    </div>
  )
}
