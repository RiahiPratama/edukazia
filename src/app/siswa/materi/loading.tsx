export default function Loading() {
  return (
    <div className="px-4 pt-4 space-y-3 animate-pulse">
      <div className="h-5 w-40 bg-[#E5E3FF] rounded-lg" />
      <div className="h-3 w-24 bg-[#E5E3FF] rounded-lg" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-20 bg-[#E5E3FF] rounded-2xl" />
        <div className="h-20 bg-[#E5E3FF] rounded-2xl" />
      </div>
      <div className="h-14 bg-[#E5E3FF] rounded-2xl" />
      <div className="flex gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 w-20 bg-[#E5E3FF] rounded-full flex-shrink-0" />
        ))}
      </div>
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 bg-[#E5E3FF] rounded-2xl" />
      ))}
    </div>
  )
}
