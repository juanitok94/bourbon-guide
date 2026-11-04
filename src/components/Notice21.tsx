// The 21+ notice. Appears on every page, including 404 and error.
// "quiet" is the slim line under the map on the home page; same wording, less weight.
export default function Notice21({ quiet = false }: { quiet?: boolean }) {
  if (quiet) {
    return (
      <p role="note" className="text-center text-[11px] leading-snug text-muted">
        21+ only · This guide is for adults of legal age. Please plan a safe ride.
      </p>
    )
  }
  return (
    <p role="note" className="flex items-center gap-3 border-y border-gold/60 py-2 text-sm text-muted">
      <strong className="bg-gold px-2 py-0.5 text-xs font-semibold tracking-wide text-wine">21+ ONLY</strong>
      <span>This guide is for adults of legal age. Please plan a safe ride.</span>
    </p>
  )
}
