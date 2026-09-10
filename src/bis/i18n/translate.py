"""Translate a finished answer, without losing what makes it checkable.

The assistant answers in English because the corpus is in English and the
citation validator runs against English text. Translation happens afterwards,
on an answer that has already been validated, and it is the user who asks for
it - so what leaves here must be the same answer in another language, not a
second answer generated from scratch.

Three things survive translation unchanged, and the first is enforced in code
rather than requested in a prompt:

  Citation markers. `[S1]` is how a claim connects to the document behind it.
  A translation that drops one silently turns a sourced sentence into an
  unsourced one, which is precisely the failure this whole project is built to
  avoid. So the markers are counted before and after, and a translation that
  loses any is refused - the caller gets the English back and is told why.

  Standard numbers. "IS 1417", "IEC 62368-1" are identifiers. Transliterating
  the digits would make them unsearchable.

  Scheme and body names. BIS, ISI, HUID, CRS, FMCS: these appear in the forms
  on the portal the user will have to fill in, so they stay recognisable.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

from bis.llm import chat

log = logging.getLogger(__name__)

MARKER_RE = re.compile(r"\[S\d+\]")

# The eight most widely spoken languages the assistant serves. Kept short and
# checked rather than long and unverifiable: a garbled answer in a language
# nobody here can read is worse than an honest English one.
LANGUAGES: dict[str, str] = {
    "hi": "Hindi",
    "bn": "Bengali",
    "ta": "Tamil",
    "te": "Telugu",
    "mr": "Marathi",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
}

# Endonyms, for the picker. A speaker looks for their language written the way
# they write it, not the way English spells it.
LANGUAGE_NAMES: dict[str, str] = {
    "hi": "हिन्दी",
    "bn": "বাংলা",
    "ta": "தமிழ்",
    "te": "తెలుగు",
    "mr": "मराठी",
    "gu": "ગુજરાતી",
    "kn": "ಕನ್ನಡ",
    "ml": "മലയാളം",
}

SYSTEM_PROMPT = """You translate a Bureau of Indian Standards assistant's \
answer into {language}. You are translating, not answering: add nothing, drop \
nothing, and do not correct or expand what the text says.

Keep these EXACTLY as they appear in the original, unchanged and in the Latin \
script:
- Citation markers such as [S1], [S2]. Every one in the source must appear in \
your translation, in the same place in the sentence it belongs to.
- Standard and specification numbers: IS 1417, IS/IEC 62368-1, IEC 61215.
- Names of bodies, schemes and marks: BIS, ISI, HUID, CRS, FMCS, QCO, BIS Care.
- URLs and e-mail addresses.

Keep the markdown structure: headings, bullet points, numbered lists, bold, \
tables and horizontal rules all stay as they are.

Where a technical term has no settled {language} equivalent, translate it and \
put the English in brackets after it the first time it appears.

Return only the translated text."""


@dataclass
class Translation:
    text: str
    language: str
    """False when the translation was rejected and `text` is the English original."""
    translated: bool = True
    warning: str | None = None


def _markers(text: str) -> list[str]:
    return MARKER_RE.findall(text)


def translate(text: str, target: str) -> Translation:
    """Translate one answer. Returns the original if it cannot be done safely."""
    language = LANGUAGES.get(target)
    if language is None:
        raise ValueError(f"unsupported language: {target}")

    if not text.strip():
        return Translation(text=text, language=target, translated=False)

    try:
        rendered = chat(
            [
                {"role": "system", "content": SYSTEM_PROMPT.format(language=language)},
                {"role": "user", "content": text},
            ],
            temperature=0.2,
            # Indic scripts cost markedly more tokens per sentence than the
            # English they came from, so this is well above the answer budget.
            max_tokens=4000,
        )
    except Exception as exc:
        log.warning("translation to %s failed: %s", target, str(exc)[:160])
        return Translation(
            text=text,
            language=target,
            translated=False,
            warning="Translation is unavailable at the moment.",
        )

    expected, produced = _markers(text), _markers(rendered)
    missing = [marker for marker in expected if marker not in produced]
    if missing:
        # Refusing is the point. A translation that has quietly shed its
        # citations reads as authoritative and can no longer be checked.
        log.warning("translation to %s dropped citations %s", target, missing)
        return Translation(
            text=text,
            language=target,
            translated=False,
            warning=(
                "The translation dropped its citations, so the original is shown instead."
            ),
        )

    return Translation(text=rendered.strip(), language=target)
