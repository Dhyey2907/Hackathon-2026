/**
 * AI assistant style chat composer with glassmorphism treatment and
 * keyboard shortcuts (Enter to send, Shift+Enter for newline).
 */

"use client";

import { useRef, useEffect, KeyboardEvent, ChangeEvent } from "react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = "Ask about Indian Standards, certification, hallmarking, testing labs…",
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSend();
      }
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className="px-3 pb-4 sm:px-4">
      <div className="chat-composer-shell mx-auto max-w-2xl rounded-[20px] border p-3">
        <div className="chat-composer-inner rounded-[12px] border p-1.5">
          <div className="flex items-end gap-2">
            <button
              type="button"
              className="chat-composer-action flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition"
              aria-label="Attach file"
            >
              <PaperclipIcon />
            </button>

            <textarea
              ref={textareaRef}
              id="chat-input"
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={placeholder}
              rows={1}
              aria-label="Message"
              aria-multiline="true"
              className="flex-1 resize-none bg-transparent px-2 py-1 text-sm leading-4 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              style={{ minHeight: "32px", maxHeight: "120px" }}
            />

            <button
              type="button"
              className="chat-composer-action flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition"
              aria-label="Use voice input"
            >
              <MicIcon />
            </button>

            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              aria-label="Send message"
              className="chat-composer-send flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white shadow-lg transition hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-[var(--color-powder-blue)] focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SendIcon />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 1 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v4" />
      <path d="M8 22h8" />
    </svg>
  );
}

