/**
 * /chat route — the primary screen of BIS Sahayak.
 *
 * This is a thin server component shell. The stateful chat logic
 * lives in ChatWindow (client component).
 */

import type { Metadata } from "next";
import ChatWindow from "@/components/chat/ChatWindow";

export const metadata: Metadata = {
  title: "BIS Sahayak — Chat",
  description:
    "Ask questions about Indian Standards, BIS certification schemes, hallmarking, testing laboratories, and consumer rights — with cited sources.",
};

export default function ChatPage() {
  return (
    <main className="chat-page flex h-full min-h-0 flex-col" id="main-content">
      <ChatWindow />
    </main>
  );
}
