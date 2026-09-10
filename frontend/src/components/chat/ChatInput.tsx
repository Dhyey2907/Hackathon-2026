/**
 * Fixed bottom input bar: textarea that auto-expands up to 5 lines,
 * send button, and keyboard shortcut (Enter to send, Shift+Enter for newline).
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

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // Cap at ~5 lines (~120px)
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
    <div className="border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
      {/* Keyboard hint */}
      <p className="mb-2 text-[11px] text-gray-400 text-right select-none">
        Press{" "}
        <kbd className="rounded border border-gray-200 bg-gray-100 px-1 py-0.5 font-mono text-[10px]">
          Enter
        </kbd>{" "}
        to send ·{" "}
        <kbd className="rounded border border-gray-200 bg-gray-100 px-1 py-0.5 font-mono text-[10px]">
          Shift+Enter
        </kbd>{" "}
        for new line
      </p>

      <div className="flex items-end gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 shadow-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500 transition-shadow">
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
          className="flex-1 resize-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 leading-relaxed"
          style={{ minHeight: "24px", maxHeight: "120px" }}
        />

        <button
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send message"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy text-white transition-colors hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-[#B0C4DE] focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ backgroundColor: canSend ? "#3D2B1F" : undefined }}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}

function SendIcon() {
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
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
