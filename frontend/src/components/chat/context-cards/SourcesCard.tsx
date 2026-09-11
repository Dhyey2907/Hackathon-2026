"use client";

/**
 * The sources behind the answer currently on screen.
 *
 * These are the ones the answer actually cited - the backend's validator drops
 * any marker it could not resolve before the response leaves the server, so
 * everything here is real and openable.
 *
 * An abstention gets said out loud rather than shown as an empty list. "No
 * authoritative source" is a result the assistant reached on purpose, and it
 * should not look like the panel failed to load.
 */

import SourceCard from "../SourceCard";
import ContextCard from "./ContextCard";
import { useLatestAnswer } from "./useLatestAnswer";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export default function SourcesCard() {
  const answer = useLatestAnswer();
  const { t } = useLanguage();
  const sources = answer?.sources ?? [];

  if (answer?.abstained) {
    return (
      <ContextCard title={t("panel.sources")} badge={t("panel.abstained")} badgeTone="warning">
        <p className="text-sm leading-relaxed text-gray-600">
          {t("panel.abstainedBody")}
        </p>
      </ContextCard>
    );
  }

  if (sources.length === 0) {
    return (
      <ContextCard
        title={t("panel.sources")}
        awaiting={t("panel.sourcesEmpty")}
      />
    );
  }

  return (
    <ContextCard title={t("panel.sources")} badge={`${sources.length}`}>
      <div className="space-y-3" role="list" aria-label={t("panel.sourcesAria")}>
        {sources.map((source, index) => (
          <div key={source.chunk_uid} role="listitem">
            <SourceCard source={source} index={index} />
          </div>
        ))}
      </div>
    </ContextCard>
  );
}
