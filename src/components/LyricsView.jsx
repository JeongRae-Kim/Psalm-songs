
export default function LyricsView({ verses }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      {verses.map((verse) => (
        <div
          key={verse.number}
          className="bg-card rounded-lg border border-b-light shadow-sm p-4"
        >
          <span className="text-xs text-t-hint mb-2 block">
            {verse.number}절
          </span>
          <p className="text-t-primary leading-relaxed whitespace-pre-line">
            {verse.text}
          </p>
        </div>
      ))}
    </div>
  );
}