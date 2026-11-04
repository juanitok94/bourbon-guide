// The 21+ notice. Appears on every page, including 404 and error.
// "quiet" is the slim line under the map on the home page; same wording, less weight.
export default function Notice21({ quiet = false }: { quiet?: boolean }) {
  if (quiet) {
    return (
      <p role="note" className="text-center text-xs text-muted">
        <strong className="font-semibold text-text">21+ ONLY</strong> · This guide is for adults of legal age. Please
        plan a safe ride.
      </p>
    )
  }
  return (
    <p
      role="note"
      className="flex items-center gap-3 rounded-full border border-line bg-surface/80 py-1.5 pr-4 pl-1.5 text-sm text-muted"
    >
      <strong className="rounded-full bg-amber px-2.5 py-0.5 text-xs font-bold tracking-wide text-bg">21+ ONLY</strong>
      <span>This guide is for adults of legal age. Please plan a safe ride.</span>
    </p>
  )
}
