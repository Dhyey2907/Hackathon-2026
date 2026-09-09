/**
 * Animated typing indicator shown while the assistant is generating a response.
 */

export default function TypingIndicator() {
  return (
    <div
      className="flex items-start gap-3"
      role="status"
      aria-live="polite"
      aria-label="Assistant is typing"
    >
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm">
        <BisIcon />
      </div>

      {/* Bubble */}
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <span
          className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: "0ms", animationDuration: "1s" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: "160ms", animationDuration: "1s" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: "320ms", animationDuration: "1s" }}
        />
      </div>
    </div>
  );
}

function BisIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" fill="#1e3a5f" />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        fill="white"
        fontFamily="sans-serif"
      >
        BIS
      </text>
    </svg>
  );
}
