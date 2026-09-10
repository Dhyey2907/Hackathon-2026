/**
 * Renders a single chat message bubble.
 *
 * - User messages: right-aligned, navy background
 * - Assistant messages: left-aligned, white card with optional sources below
 * - Abstention state: calm informational card, not an error
 * - Inline [S1] markers are converted to superscript pills
 * - Markdown is rendered with basic support (bold, lists, tables, headings)
 */

"use client";

import { useMemo, useState } from "react";
import type { Message, Source } from "@/lib/types";
import SourceCard from "./SourceCard";
import ChatNavigationAction from "./ChatNavigationAction";
import TranslateAnswer from "./TranslateAnswer";

// ---------------------------------------------------------------------------
// Simple inline markdown renderer
// ---------------------------------------------------------------------------

/**
 * Converts a subset of markdown to HTML-safe JSX-renderable string.
 * We keep this dependency-free for now; swap for `react-markdown` later.
 *
 * Supported: **bold**, headings (#), bullet lists, numbered lists,
 * tables (basic), inline code, newlines, and [S1] citation pills.
 */
function renderMarkdown(text: string, sources: Source[]): React.ReactNode {
  // Build a map from marker string → source index for citation pills
  const markerMap = new Map<string, number>();
  sources.forEach((s, i) => markerMap.set(s.marker, i));

  // Split into lines and process block-level elements
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Heading
    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const Tag = `h${level}` as "h1" | "h2" | "h3";
      const cls =
        // Every level sits at or above the 15px body size - a heading smaller
        // than the text under it reads as a caption, not a heading.
        level === 1
          ? "text-lg font-semibold text-gray-900 mt-4 mb-1.5 first:mt-0"
          : level === 2
          ? "text-base font-semibold text-gray-900 mt-3.5 mb-1 first:mt-0"
          : "text-[15px] font-semibold text-gray-800 mt-3 mb-1 first:mt-0";
      elements.push(
        <Tag key={i} className={cls}>
          {inlineRender(content, markerMap)}
        </Tag>
      );
      i++;
      continue;
    }

    // Table (detect by | at start)
    if (line.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) {
        // skip separator rows (|---|---|)
        if (!lines[i].match(/^\|[\s\-:|]+\|/)) {
          tableLines.push(lines[i]);
        }
        i++;
      }
      if (tableLines.length > 0) {
        const rows = tableLines.map((r) =>
          r
            .split("|")
            .slice(1, -1)
            .map((c) => c.trim())
        );
        const [header, ...body] = rows;
        elements.push(
          <div key={`table-${i}`} className="overflow-x-auto my-2">
            <table className="min-w-full text-sm border-collapse">
              <thead>
                <tr>
                  {header.map((cell, ci) => (
                    <th
                      key={ci}
                      className="border border-gray-200 bg-gray-50 px-3 py-1.5 text-left text-xs font-semibold text-gray-700"
                    >
                      {inlineRender(cell, markerMap)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="border border-gray-200 px-3 py-1.5 text-gray-700"
                      >
                        {inlineRender(cell, markerMap)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      continue;
    }

    // Unordered list
    if (line.match(/^[-*]\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*]\s+/)) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1.5 pl-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex gap-2.5 leading-relaxed text-gray-700">
              {/* em-based offset so the dot stays on the first line's centre
                  whatever the body size is */}
              <span className="mt-[0.6em] h-1 w-1 shrink-0 rounded-full bg-gray-400" />
              <span className="min-w-0 flex-1">{inlineRender(item, markerMap)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\.\s+/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="my-2 list-none space-y-1.5 pl-1">
          {items.map((item, ii) => (
            <li key={ii} className="flex gap-2.5 leading-relaxed text-gray-700">
              {/* Fixed width and tabular figures so "9." and "10." share an
                  edge and every item's text starts on the same column. */}
              <span className="w-5 shrink-0 text-right tabular-nums text-gray-400">
                {ii + 1}.
              </span>
              <span className="min-w-0 flex-1">{inlineRender(item, markerMap)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      const content = line.replace(/^>\s?/, "");
      elements.push(
        <blockquote
          key={i}
          className="my-1.5 border-l-2 border-amber-400 pl-3 text-sm text-gray-600 italic"
        >
          {inlineRender(content, markerMap)}
        </blockquote>
      );
      i++;
      continue;
    }

    // Horizontal rule. Without this the model's "---" separators rendered as
    // a literal "---" paragraph in the middle of the answer.
    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      elements.push(<hr key={i} className="my-3 border-gray-200" />);
      i++;
      continue;
    }

    // Paragraph
    elements.push(
      <p key={i} className="leading-relaxed text-gray-700">
        {inlineRender(line, markerMap)}
      </p>
    );
    i++;
  }

  return <div className="space-y-2">{elements}</div>;
}

/**
 * Renders inline markdown within a single line:
 * **bold**, `code`, [S1] citation pills, plain text.
 */
function inlineRender(
  text: string,
  markerMap: Map<string, number>
): React.ReactNode {
  // Pattern order matters: citation markers, then bold, then code
  const pattern = /(\[S\d+\]|\*\*[^*]+\*\*|`[^`]+`)/g;
  const parts = text.split(pattern);

  return (
    <>
      {parts.map((part, i) => {
        // Citation pill [S1]
        const citationMatch = part.match(/^\[S(\d+)\]$/);
        if (citationMatch) {
          const markerKey = `S${citationMatch[1]}`;
          const idx = markerMap.get(markerKey);
          if (idx !== undefined) {
            return (
              <sup key={i}>
                <a
                  href={`#source-${idx}`}
                  className="citation-pill inline-flex items-center justify-center min-w-[1.1rem] h-4 rounded-full bg-[#B0C4DE]/35 border border-[#B0C4DE]/60 px-1 text-[10px] font-semibold text-[#3D2B1F] hover:bg-[#DCAEB5]/40 hover:border-[#DCAEB5] transition-all no-underline focus:outline-none focus:ring-1 focus:ring-[#B0C4DE]"
                  aria-label={`Go to source ${idx + 1}`}
                  title={`Source ${idx + 1}`}
                >
                  {idx + 1}
                </a>
              </sup>
            );
          }
          // marker not in sources → strip it (validated by backend, strip here too)
          return null;
        }

        // Bold **text**
        const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
        if (boldMatch) {
          return (
            <strong key={i} className="font-semibold text-gray-900">
              {boldMatch[1]}
            </strong>
          );
        }

        // Inline code `text`
        const codeMatch = part.match(/^`([^`]+)`$/);
        if (codeMatch) {
          return (
            <code
              key={i}
              className="rounded bg-gray-100 px-1 py-0.5 font-mono text-[0.8em] text-gray-800"
            >
              {codeMatch[1]}
            </code>
          );
        }

        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

// ---------------------------------------------------------------------------
// Abstention notice
// ---------------------------------------------------------------------------

function AbstentionNotice() {
  return (
    <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
      <svg
        className="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
        />
      </svg>
      <span>
        I did not find sufficient evidence to answer this confidently. A wrong
        answer about a certification requirement could be costly — so I&apos;m
        not guessing. Please check the{" "}
        <a
          href="https://www.bis.gov.in"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500 rounded"
        >
          BIS website
        </a>{" "}
        directly for authoritative information.
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

interface MessageBubbleProps {
  message: Message;
  /** Translate this one without being asked when the UI is not in English. */
  autoTranslate?: boolean;
}

export default function MessageBubble({ message, autoTranslate = false }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const sources = message.sources ?? [];

  // A translation of this answer, when the reader has asked for one. The
  // English stays in `message.content` untouched, so "Show English" is a
  // render away rather than another round trip.
  const [translated, setTranslated] = useState<string | null>(null);
  const [language, setLanguage] = useState<string | null>(null);

  const renderedContent = useMemo(
    () => renderMarkdown(translated ?? message.content, sources),
    [translated, message.content, sources]
  );

  const time = useMemo(
    () =>
      new Date(message.timestamp).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [message.timestamp]
  );

  // ── USER MESSAGE ──────────────────────────────────────────────────────────
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] sm:max-w-[70%]">
          {/* Matches the assistant bubble's size, so the two sides of the
              conversation read as one exchange rather than two typefaces. */}
          <div className="rounded-2xl rounded-tr-sm bg-navy px-5 py-3.5 text-[15px] text-white shadow-sm">
            {message.attachmentName && (
              <p className="mb-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md bg-white/15 px-2 py-0.5 text-[11px] font-medium">
                <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                </svg>
                <span className="truncate">{message.attachmentName}</span>
              </p>
            )}
            <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
          </div>
          <p className="mt-1 text-right text-[11px] text-gray-400">{time}</p>
        </div>
      </div>
    );
  }

  // ── ASSISTANT MESSAGE ─────────────────────────────────────────────────────
  return (
    <div className="flex items-start gap-3">
      {/* Avatar */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm"
        aria-hidden="true"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" fill="#3D2B1F" />
          <text
            x="12"
            y="16"
            textAnchor="middle"
            fontSize="8"
            fontWeight="700"
            fill="white"
            fontFamily="sans-serif"
          >
            BIS
          </text>
        </svg>
      </div>

      <div className="max-w-[92%] sm:max-w-[88%] lg:max-w-[82%] flex-1">
        {/* Bubble */}
        <div
          className={`rounded-2xl rounded-tl-sm border bg-white px-5 py-4 text-[15px] shadow-sm ${
            message.abstained ? "border-amber-200" : "border-gray-200"
          }`}
        >
          <div aria-live="polite" lang={language ?? "en"}>
            {renderedContent}
          </div>

          {/* Abstention notice */}
          {message.abstained && <AbstentionNotice />}

          {/* Offered on the finished answer, never before it: the citations
              were validated against the English, and it stays one tap away. */}
          {!message.abstained && message.content.trim().length > 0 && (
            <TranslateAnswer
              source={message.content}
              active={language}
              auto={autoTranslate}
              onShow={(text, code) => {
                setTranslated(text);
                setLanguage(code);
              }}
            />
          )}
        </div>

        {/* Sources section */}
        {sources.length > 0 && (
          <div className="mt-2 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Sources
            </p>
            <div className="space-y-3" role="list" aria-label="Sources">
              {sources.map((source, idx) => (
                <div
                  key={source.chunk_uid}
                  id={`source-${idx}`}
                  role="listitem"
                  className="scroll-mt-4"
                >
                  <SourceCard source={source} index={idx} />
                </div>
              ))}
            </div>
          </div>
        )}

        {message.navigation && <ChatNavigationAction navigation={message.navigation} />}

        {/* Timestamp + latency */}
        <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-400">
          <span>{time}</span>
          {message.latency_ms !== undefined && (
            <>
              <span>·</span>
              <span>{Math.round(message.latency_ms)}ms</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
