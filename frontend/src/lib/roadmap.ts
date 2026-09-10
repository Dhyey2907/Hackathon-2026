/**
 * The route to a BIS product certification licence, in the order it happens.
 *
 * Every step below is drawn from BIS's own published material - the product
 * certification FAQ, the certification process pages and the Scheme-I
 * guidelines - and each one carries the link it came from, so a reader can
 * check the claim rather than take this app's word for it. Where BIS states a
 * figure (an application fee of Rs 1,000, an inspection fee of Rs 7,000 per
 * person per day, roughly one month by the laboratory route against roughly
 * four by the factory route) that figure is quoted rather than rounded or
 * re-expressed.
 *
 * What this is not: a substitute for the regulations, a promise about
 * timelines, or a personalised legal opinion. Fees and durations change, and
 * the `caveat` on a step exists to say so where BIS itself hedges.
 *
 * Deliberately no invented step numbers, form codes or document checklists.
 * BIS does not publish a single canonical document list for every product -
 * the requirement follows the relevant Indian Standard - so the step says that
 * rather than making a list up.
 */

export interface RoadmapStep {
  id: string;
  title: string;
  /** What the applicant actually does. */
  detail: string;
  /** BIS's own page for this step. */
  sourceUrl: string;
  sourceLabel: string;
  /** Shown when BIS's own wording is conditional or varies by product. */
  caveat?: string;
  /** Roughly when this happens, in BIS's words. Absent when BIS gives none. */
  timing?: string;
}

export const ROADMAP_SOURCE =
  "https://www.bis.gov.in/product-certification/product-certification-faq/";

export const ROADMAP: RoadmapStep[] = [
  {
    id: "find-standard",
    title: "Find the Indian Standard for your product",
    detail:
      "Certification is always against a specific Indian Standard, so everything else follows from identifying the right one. Search the catalogue by product, or ask the assistant. If no standard covers your product, BIS asks you to contact the relevant technical department.",
    sourceUrl: "https://www.bis.gov.in/product-certification/product-certification-faq/",
    sourceLabel: "Product certification FAQ",
  },
  {
    id: "check-mandatory",
    title: "Check whether certification is mandatory for you",
    detail:
      "Some products are under a Quality Control Order, which makes the ISI mark compulsory rather than voluntary. Which products, and from which date, is set by the ministry that issued the order.",
    sourceUrl:
      "https://www.bis.gov.in/product-certification/products-under-compulsory-certification/",
    sourceLabel: "Products under compulsory certification",
    caveat: "Coverage is extended by amendment, so check the current list rather than a saved copy.",
  },
  {
    id: "register-portal",
    title: "Register on the BIS portal",
    detail:
      "BIS accepts product certification applications online only, through manakonline.in. You register there before you can apply.",
    sourceUrl: "https://www.manakonline.in/",
    sourceLabel: "manakonline.in",
  },
  {
    id: "choose-route",
    title: "Choose your certification route",
    detail:
      "Option 1 involves a factory assessment and testing of samples drawn during the visit. Option 2 is based on a test report from a BIS-recognised laboratory. The licence under Option 1 is granted only once the report on samples drawn at the visit shows conformity.",
    sourceUrl: "https://www.bis.gov.in/product-certification/product-certification-faq/",
    sourceLabel: "Product certification FAQ",
    timing: "BIS gives roughly one month for Option 2 and roughly four months for Option 1",
  },
  {
    id: "prepare-factory",
    title: "Put the manufacturing and testing capability in place",
    detail:
      "BIS verifies manufacturing infrastructure, process control, quality control and in-house testing against what the relevant Indian Standard requires. The specifics differ by standard, so read the one you identified in step one.",
    sourceUrl: "https://www.bis.gov.in/product-certification/product-certification-process/",
    sourceLabel: "Certification process and Scheme-I guidelines",
    caveat: "BIS publishes no single document checklist covering every product; the standard sets it.",
  },
  {
    id: "get-tested",
    title: "Have samples tested",
    detail:
      "Testing is against the Indian Standard, at a BIS-recognised laboratory. Use the Lab Finder to see the laboratories BIS publishes, and the LIMS portal to search by standard number.",
    sourceUrl: "https://lims.bis.gov.in/home/search_is_number/",
    sourceLabel: "LIMS standards-wise laboratory search",
  },
  {
    id: "apply",
    title: "Apply and pay the application fee",
    detail:
      "Submit the application through the portal with the details of your product, premises and testing. BIS states an application fee of Rs 1,000.",
    sourceUrl: "https://www.bis.gov.in/product-certification/product-certification-faq/",
    sourceLabel: "Product certification FAQ",
  },
  {
    id: "inspection",
    title: "Host the factory inspection",
    detail:
      "Under Option 1 a BIS officer visits the premises and draws samples. BIS states an inspection fee of Rs 7,000 per person per day.",
    sourceUrl: "https://www.bis.gov.in/product-certification/product-certification-faq/",
    sourceLabel: "Product certification FAQ",
    caveat: "Applies to the factory route; the laboratory route turns on the test report instead.",
  },
  {
    id: "grant",
    title: "Receive the licence and start marking",
    detail:
      "A licence under Scheme-I may initially be granted for up to two years. An annual licence fee applies, which BIS states as a minimum of Rs 1,000 plus marking charges set out in the schedule.",
    sourceUrl: "https://www.bis.gov.in/product-certification/product-certification-faq/",
    sourceLabel: "Product certification FAQ",
  },
  {
    id: "maintain",
    title: "Keep it valid",
    detail:
      "BIS carries out surprise factory inspections and buys ISI-marked products from the market for independent testing. Renew through the portal before the licence expires; BIS states that failing to renew by the expiry date leads to suspension.",
    sourceUrl: "https://www.bis.gov.in/product-certification/product-certification-faq/",
    sourceLabel: "Product certification FAQ",
  },
];

/** Progress as a whole percentage, 0 when nothing is done. */
export function progressPercent(doneIds: string[]): number {
  if (ROADMAP.length === 0) return 0;
  const done = ROADMAP.filter((step) => doneIds.includes(step.id)).length;
  return Math.round((done / ROADMAP.length) * 100);
}
