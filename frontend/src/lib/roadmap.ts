/**
 * The route to BIS compliance, which depends on what you are building.
 *
 * "What do you make?" only earns its place if the answer changes something, so
 * the answers here select a scheme, and schemes differ in substance, not
 * wording. A domestic manufacturer of cement goes through Scheme-I and an ISI
 * licence. A maker of laptop chargers registers under Scheme-II on a different
 * portal and never gets a factory inspection. A factory in Shenzhen needs an
 * Authorised Indian Representative before it can apply at all. A jeweller
 * registers with BIS and sells only through an assaying centre. Pasting the
 * product name into one generic list would be personalisation in appearance
 * only.
 *
 * Every step carries the BIS page it came from. Where BIS states a figure it is
 * quoted rather than rounded, and where BIS hedges - or where we have not
 * verified a scheme's detail ourselves - the step says so in a caveat.
 *
 * Deliberately absent: a claim about whether *your* product is under a Quality
 * Control Order. The catalogue this app holds has no reliable QCO flag, and the
 * orders are issued and amended by several ministries, so the step sends you to
 * BIS's own list instead of guessing.
 */

export type MadeIn = "india" | "abroad";
export type ProductKind = "general" | "electronics" | "jewellery" | "machinery";

export interface BusinessProfile {
  /** In the user's own words: "LED bulbs", "gold chains", "PVC pipes". */
  product: string;
  madeIn: MadeIn;
  kind: ProductKind;
}

export type SchemeId = "scheme-i" | "scheme-ii" | "scheme-x" | "fmcs" | "hallmarking";

export interface RoadmapStep {
  id: string;
  title: string;
  detail: string;
  sourceUrl: string;
  sourceLabel: string;
  caveat?: string;
  timing?: string;
}

export interface SchemeTrack {
  id: SchemeId;
  name: string;
  /** One line on why this scheme was chosen for these answers. */
  because: string;
  sourceUrl: string;
  steps: RoadmapStep[];
}

const FAQ = "https://www.bis.gov.in/product-certification/product-certification-faq/";

// --- steps shared by every product track ----------------------------------

const findStandard: RoadmapStep = {
  id: "find-standard",
  title: "Find the Indian Standard for your product",
  detail:
    "Everything that follows is measured against a specific Indian Standard, so start by identifying it. The standards matched to your product are shown above; if none fits, BIS asks you to contact the relevant technical department.",
  sourceUrl: FAQ,
  sourceLabel: "Product certification FAQ",
};

const checkMandatory: RoadmapStep = {
  id: "check-mandatory",
  title: "Check whether certification is compulsory for your product",
  detail:
    "Products under a Quality Control Order must carry the BIS mark before they can be made, imported or sold in India. Which products are covered, and from when, is set by the issuing ministry.",
  sourceUrl: "https://www.bis.gov.in/product-certification/products-under-compulsory-certification/",
  sourceLabel: "Products under compulsory certification",
  caveat:
    "This app cannot tell you whether your product is covered - check BIS's current list. Coverage is extended by amendment, so a saved copy goes out of date.",
};

// --- the tracks ------------------------------------------------------------

const SCHEME_I: SchemeTrack = {
  id: "scheme-i",
  name: "ISI Mark licence (Scheme-I)",
  because: "You manufacture in India, and this is the scheme for most products made here.",
  sourceUrl: "https://www.bis.gov.in/product-certification/product-certification-process/",
  steps: [
    findStandard,
    checkMandatory,
    {
      id: "register-portal",
      title: "Register on the BIS portal",
      detail:
        "BIS accepts product certification applications online only, through manakonline.in. Register there before applying.",
      sourceUrl: "https://www.manakonline.in/",
      sourceLabel: "manakonline.in",
    },
    {
      id: "choose-route",
      title: "Choose your certification route",
      detail:
        "Option 1 involves a factory assessment and testing of samples drawn during the visit; the licence is granted only once that report shows conformity. Option 2 is based on a test report from a BIS-recognised laboratory.",
      sourceUrl: FAQ,
      sourceLabel: "Product certification FAQ",
      timing: "BIS gives roughly one month for Option 2 and roughly four months for Option 1",
    },
    {
      id: "prepare-factory",
      title: "Put manufacturing and testing capability in place",
      detail:
        "BIS verifies manufacturing infrastructure, process control, quality control and in-house testing against what your Indian Standard requires.",
      sourceUrl: "https://www.bis.gov.in/product-certification/product-certification-process/",
      sourceLabel: "Certification process and Scheme-I guidelines",
      caveat: "BIS publishes no single document checklist for every product; your standard sets it.",
    },
    {
      id: "get-tested",
      title: "Have samples tested",
      detail:
        "Testing is against the Indian Standard at a BIS-recognised laboratory. The Lab Finder lists the laboratories BIS publishes; LIMS searches them by standard number.",
      sourceUrl: "https://lims.bis.gov.in/home/search_is_number/",
      sourceLabel: "LIMS standards-wise laboratory search",
    },
    {
      id: "apply",
      title: "Apply and pay the application fee",
      detail: "Submit the application through the portal. BIS states an application fee of Rs 1,000.",
      sourceUrl: FAQ,
      sourceLabel: "Product certification FAQ",
    },
    {
      id: "inspection",
      title: "Host the factory inspection",
      detail:
        "Under Option 1 a BIS officer visits and draws samples. BIS states an inspection fee of Rs 7,000 per person per day.",
      sourceUrl: FAQ,
      sourceLabel: "Product certification FAQ",
      caveat: "Applies to the factory route; the laboratory route turns on the test report.",
    },
    {
      id: "grant",
      title: "Receive the licence and start marking",
      detail:
        "A Scheme-I licence may initially be granted for up to two years. BIS states a minimum annual licence fee of Rs 1,000 plus marking charges set out in the schedule.",
      sourceUrl: FAQ,
      sourceLabel: "Product certification FAQ",
    },
    {
      id: "maintain",
      title: "Keep it valid",
      detail:
        "BIS carries out surprise factory inspections and tests ISI-marked products bought from the market. Renew through the portal before expiry; BIS states that failing to renew by then leads to suspension.",
      sourceUrl: FAQ,
      sourceLabel: "Product certification FAQ",
    },
  ],
};

const SCHEME_II: SchemeTrack = {
  id: "scheme-ii",
  name: "Compulsory Registration (Scheme-II / CRS)",
  because: "Electronics and IT goods are registered under Scheme-II rather than licensed under Scheme-I.",
  sourceUrl: "https://www.bis.gov.in/product-certification/compulsory-registration-scheme/",
  steps: [
    findStandard,
    {
      ...checkMandatory,
      detail:
        "Registration is compulsory only for the electronics and IT products notified under the scheme. Confirm yours is one of them before starting.",
      sourceUrl: "https://www.bis.gov.in/product-certification/compulsory-registration-scheme/",
      sourceLabel: "Compulsory Registration Scheme",
    },
    {
      id: "crs-portal",
      title: "Register on the CRS portal",
      detail:
        "Registration runs through its own portal, crsbis.in - not manakonline.in, which is the Scheme-I route.",
      sourceUrl: "https://www.crsbis.in/BIS/",
      sourceLabel: "crsbis.in",
    },
    {
      id: "crs-test",
      title: "Have the product tested at a BIS-recognised laboratory",
      detail:
        "Registration rests on a test report from a BIS-recognised laboratory against the relevant Indian Standard.",
      sourceUrl: "https://www.bis.gov.in/product-certification/compulsory-registration-scheme/",
      sourceLabel: "Compulsory Registration Scheme",
    },
    {
      id: "crs-apply",
      title: "Apply for registration with the test report",
      detail: "Submit the application and the laboratory's report through the CRS portal.",
      sourceUrl: "https://www.crsbis.in/BIS/",
      sourceLabel: "crsbis.in",
      caveat: "Fees are listed on the CRS portal rather than in the Scheme-I FAQ, so they are not quoted here.",
    },
    {
      id: "crs-mark",
      title: "Receive your registration and mark the product",
      detail:
        "Once registered, the product carries the Standard Mark with your registration number before it is sold.",
      sourceUrl: "https://www.bis.gov.in/product-certification/compulsory-registration-scheme/",
      sourceLabel: "Compulsory Registration Scheme",
    },
    {
      id: "crs-renew",
      title: "Keep the registration current",
      detail: "Renew before the registration lapses, and register each new model or variant.",
      sourceUrl: "https://www.crsbis.in/BIS/",
      sourceLabel: "crsbis.in",
      caveat: "Check the portal for the validity period of your registration.",
    },
  ],
};

const SCHEME_X: SchemeTrack = {
  id: "scheme-x",
  name: "Scheme-X certification",
  because: "Machinery and electrical equipment covered by the technical regulation are certified under Scheme-X.",
  sourceUrl: "https://www.bis.gov.in/scheme-x-certification/",
  steps: [
    findStandard,
    {
      ...checkMandatory,
      detail:
        "Scheme-X applies to machinery and electrical equipment notified under the relevant technical regulation. Confirm your product is covered.",
      sourceUrl: "https://www.bis.gov.in/scheme-x-certification/",
      sourceLabel: "Scheme-X certification",
    },
    {
      id: "x-read",
      title: "Read the Scheme-X guidelines for your product",
      detail:
        "Scheme-X sets out how conformity is assessed for the equipment it covers. Identify which requirements apply to your product before preparing an application.",
      sourceUrl: "https://www.bis.gov.in/scheme-x-certification/",
      sourceLabel: "Scheme-X certification",
      caveat:
        "We have not summarised Scheme-X's assessment detail here; read BIS's guidelines rather than relying on a paraphrase.",
    },
    {
      id: "x-test",
      title: "Arrange testing against the standard",
      detail: "Testing is carried out against the applicable Indian Standard.",
      sourceUrl: "https://lims.bis.gov.in/home/search_is_number/",
      sourceLabel: "LIMS standards-wise laboratory search",
    },
    {
      id: "x-apply",
      title: "Apply for certification",
      detail: "Apply through the BIS portal with the documents the guidelines ask for.",
      sourceUrl: "https://www.manakonline.in/",
      sourceLabel: "manakonline.in",
    },
    {
      id: "x-maintain",
      title: "Keep the certification valid",
      detail: "Maintain conformity after grant and renew before expiry.",
      sourceUrl: "https://www.bis.gov.in/scheme-x-certification/",
      sourceLabel: "Scheme-X certification",
    },
  ],
};

const FMCS: SchemeTrack = {
  id: "fmcs",
  name: "Foreign Manufacturers Certification (FMCS)",
  because: "You manufacture outside India, which BIS handles through its foreign manufacturers scheme.",
  sourceUrl: "https://www.bis.gov.in/product-certification/foreign-manufacturers-certification-scheme/",
  steps: [
    findStandard,
    checkMandatory,
    {
      id: "fmcs-air",
      title: "Appoint an Authorised Indian Representative",
      detail:
        "A foreign manufacturer must nominate an Authorised Indian Representative to act on its behalf with BIS and carry compliance responsibilities in India.",
      sourceUrl: "https://www.bis.gov.in/product-certification/foreign-manufacturers-certification-scheme/",
      sourceLabel: "Foreign Manufacturers Certification Scheme",
    },
    {
      id: "fmcs-apply",
      title: "Apply online",
      detail: "Submit the application, with the representative's details, through the BIS portal.",
      sourceUrl: "https://www.manakonline.in/",
      sourceLabel: "manakonline.in",
      caveat: "Fees vary by product; BIS lists them on the FMCS pages rather than as a single figure.",
    },
    {
      id: "fmcs-inspect",
      title: "Host the inspection and sample testing",
      detail: "BIS assesses the overseas factory and tests samples as the scheme requires.",
      sourceUrl: "https://www.bis.gov.in/product-certification/foreign-manufacturers-certification-scheme/",
      sourceLabel: "Foreign Manufacturers Certification Scheme",
    },
    {
      id: "fmcs-grant",
      title: "Receive the licence",
      detail: "Once granted, the licence allows the marked product to be sold in India.",
      sourceUrl: "https://www.bis.gov.in/product-certification/foreign-manufacturers-certification-scheme/",
      sourceLabel: "Foreign Manufacturers Certification Scheme",
    },
    {
      id: "fmcs-renew",
      title: "Renew before it lapses",
      detail: "The licence is valid for a set period, after which it must be renewed to keep selling.",
      sourceUrl: "https://www.bis.gov.in/product-certification/foreign-manufacturers-certification-scheme/",
      sourceLabel: "Foreign Manufacturers Certification Scheme",
    },
  ],
};

const HALLMARKING: SchemeTrack = {
  id: "hallmarking",
  name: "Jeweller registration (Hallmarking)",
  because: "Gold and silver jewellery is sold under BIS hallmarking, not product licensing.",
  sourceUrl: "https://www.bis.gov.in/hallmarking-overview/jewellers-registration-scheme/",
  steps: [
    {
      id: "hm-district",
      title: "Check whether hallmarking is mandatory in your district",
      detail:
        "Mandatory hallmarking of gold jewellery applies district by district and has been extended in phases. Ask the assistant about your district - it answers from BIS's published district list.",
      sourceUrl: "https://www.bis.gov.in/hallmarking-overview/mandatory-hallmarking-order/",
      sourceLabel: "Mandatory hallmarking order",
    },
    {
      id: "hm-register",
      title: "Register as a jeweller with BIS",
      detail:
        "Jewellers selling hallmarked jewellery register with BIS under the jewellers registration scheme, through manakonline.in.",
      sourceUrl: "https://www.bis.gov.in/hallmarking-overview/jewellers-registration-scheme/",
      sourceLabel: "Jewellers registration scheme",
    },
    {
      id: "hm-ahc",
      title: "Get articles hallmarked at an Assaying and Hallmarking Centre",
      detail:
        "Jewellery is tested and marked at a BIS-recognised Assaying and Hallmarking Centre, not by the jeweller.",
      sourceUrl: "https://huid.manakonline.in/MANAK/AHCListForWebsite",
      sourceLabel: "List of hallmarking centres",
    },
    {
      id: "hm-huid",
      title: "Sell only articles carrying the HUID",
      detail:
        "Since 1 July 2021 a hallmark has three parts: the BIS logo, the purity, and a six-character HUID unique to each article, which customers can verify in the BIS Care app.",
      sourceUrl: "https://www.bis.gov.in/hallmarking-overview/hallmarking-faqs/hallmarking-faq/",
      sourceLabel: "Hallmarking FAQs",
    },
    {
      id: "hm-maintain",
      title: "Follow the guidelines for jewellers",
      detail: "Keep to BIS's guidelines for registered jewellers to retain registration.",
      sourceUrl: "https://www.bis.gov.in/wp-content/uploads/2026/07/Guidelines-for-Jewellers.pdf",
      sourceLabel: "Guidelines for Jewellers",
    },
  ],
};

export const TRACKS: Record<SchemeId, SchemeTrack> = {
  "scheme-i": SCHEME_I,
  "scheme-ii": SCHEME_II,
  "scheme-x": SCHEME_X,
  fmcs: FMCS,
  hallmarking: HALLMARKING,
};

/**
 * Which scheme these answers point to. Order matters: where you manufacture
 * outranks what you make, because a foreign manufacturer goes through FMCS
 * whatever the product.
 */
export function pickScheme(profile: BusinessProfile): SchemeId {
  if (profile.kind === "jewellery") return "hallmarking";
  if (profile.madeIn === "abroad") return "fmcs";
  if (profile.kind === "electronics") return "scheme-ii";
  if (profile.kind === "machinery") return "scheme-x";
  return "scheme-i";
}

const KIND_HINTS: [ProductKind, RegExp][] = [
  ["jewellery", /\b(gold|silver|jewell?ery|jewel|ornament|bangle|chain|ring|necklace|hallmark)/i],
  [
    "electronics",
    /\b(laptop|mobile|phone|charger|adapter|power bank|battery|led|television|tv|monitor|printer|router|smart ?watch|electronic|it goods|ups|inverter|set.?top)/i,
  ],
  ["machinery", /\b(machine|machinery|pump|motor|compressor|generator|tool|equipment|welding|crane)/i],
];

/**
 * A starting guess at the product kind from its description. Only ever a
 * default in the form - the user sees it and can change it - because a keyword
 * match cannot know that "LED" might be a lamp under Scheme-I or a driver
 * under Scheme-II.
 */
export function guessKind(description: string): ProductKind {
  for (const [kind, pattern] of KIND_HINTS) {
    if (pattern.test(description)) return kind;
  }
  return "general";
}

/** Progress over one track, as a whole percentage. */
export function progressPercent(doneIds: string[], steps: RoadmapStep[]): number {
  if (steps.length === 0) return 0;
  const done = steps.filter((step) => doneIds.includes(step.id)).length;
  return Math.round((done / steps.length) * 100);
}
