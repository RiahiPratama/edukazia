export default function Loading() {
  return (
    <div className="px-4 pt-4 space-y-3 animate-pulse">
      <div className="h-5 w-40 bg-[#E5E3FF] rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-[#E5E3FF] rounded-xl" />
        ))}
      </div>
      <div className="h-40 bg-[#E5E3FF] rounded-xl" />
      <div className="h-40 bg-[#E5E3FF] rounded-xl" />
    </div>
  )
}
