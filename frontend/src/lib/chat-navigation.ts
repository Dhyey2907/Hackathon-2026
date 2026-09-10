import type { ChatNavigation, Source } from "./types";

const STORAGE_KEY = "bis-sahayak-chat-navigation-context";

export function getMockChatNavigation(sources: Source[]): ChatNavigation | undefined {
  const standardSource = sources.find((source) => source.is_number);
  if (!standardSource?.is_number) return undefined;

  const slug = standardSource.is_number.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return { label: `View ${standardSource.is_number} details`, href: `/standards/${slug}`, sources };
}

export function saveChatNavigationContext(navigation: ChatNavigation) {
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(navigation));
}

export function consumeChatNavigationContext(pathname: string): ChatNavigation | null {
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  window.sessionStorage.removeItem(STORAGE_KEY);
  try {
    const navigation = JSON.parse(raw) as ChatNavigation;
    return navigation.href === pathname ? navigation : null;
  } catch {
    return null;
  }
}