# FaQs — public BIS document corpus

Source documents for the assistant's **full-text** retrieval: BIS certification
scheme guides, FAQs and manuals, all published by the Bureau of Indian Standards.

This is the half of the corpus the catalogue cannot provide. The catalogue gives
a standard's *identity* — number, title, committee — which answers "which
standard applies to my product?". These documents explain the **processes**:
how to get a licence, what a QCO requires, how a foreign manufacturer applies,
what an ISI mark actually certifies. They are also the only material here that
supports genuine clause-level citation, because full IS standard texts are
paywalled and deliberately absent.

## Contents

### 01_BIS_Certification_Schemes_Overview
| File | What it covers |
|---|---|
| `Scheme_I_ISI_Mark_Scheme.pdf` | Scheme I — the ISI mark, products under compulsory certification (191 pages) |
| `Scheme_II_Registration_Scheme.pdf` | Scheme II — CRS registration, mainly electronics and IT goods |
| `Scheme_X_Certification.pdf` | Scheme X — machinery and electrical equipment |
| `Upcoming_QCOs_Notified_and_Due_for_Implementation.pdf` | Quality Control Orders notified and pending |
| `product_and_system_certi_faq.docx` | Product and system certification FAQ (407 paragraphs) |
| `System_certifications.docx` | System certification FAQ — application process, licensing |

### 02_Standard_Specific_FAQs_Manuals
| File | What it covers |
|---|---|
| `FAQ_Cells_and_Batteries.pdf` | Registration FAQ for cells and batteries |
| `FAQ_IS1293_Plugs_Socket_Outlets.pdf` | FAQ for IS 1293 — plugs and socket-outlets |
| `FAQ_Migration_to_IS_IEC_62368-1.pdf` | Migration to IS/IEC 62368-1:2023 |
| `CRS_PWR_Applicant_End_User_Manual.pdf` | CRS portal password-reset manual |

### 03_FMCS
`FAQs_FMCS.docx` — Foreign Manufacturers Certification Scheme.

### 04_Scheme_X_Certification_FAQ
`Scheme-X_Certification_FAQ.pdf` — Scheme X licensing questions.

## Provenance and licensing

Every file is public material published by BIS. Nothing here is paywalled, and
no IS standard full texts are included. This is an independent hackathon project
and is not affiliated with or endorsed by the Bureau of Indian Standards.

## Notes

An Apple Pages copy of `product_and_system_certi_faq` was dropped from the
upload: 10.4 MB, unparseable by the ingestion pipeline, and byte-for-byte
redundant with the `.docx` of the same name.

## How these get used

Not automatically — adding files here does nothing on its own. They are consumed
by the ingestion pipeline:

```
FaQs/*.pdf|.docx
  → parse (PyMuPDF / python-docx), preserving clause numbers and page numbers
  → chunk.py            section-aware, never splitting across a clause boundary
  → embed (Jina, 1024d)
  → chunks table in Supabase
```

The `chunks` table already exists with hybrid search wired up (`match_chunks`)
and is currently empty. Each chunk carries `source_url`, `doc_title`, `clause`
and `page`, which is exactly what a `[S1]` citation displays — so parsing
quality here sets the ceiling on citation quality for the whole assistant.
