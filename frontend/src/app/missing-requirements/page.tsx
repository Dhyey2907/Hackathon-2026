"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";
import { fill } from "@/lib/i18n/format";
import Link from "next/link";
import { useAuth, UserType } from "@/components/auth/AuthProvider";

type RequirementItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  hrefLabel: string;
  isUrgent?: boolean;
};

const MISSING_REQUIREMENTS: Record<UserType, RequirementItem[]> = {
  existing_business: [
    {
      id: "mr-1",
      title: "BIS ISI License — IS 9000 (Electronics)",
      description:
        "Mandatory ISI certification for electrical goods under the Electronics & IT Goods Quality Control Order (QCO). Products cannot be sold in India without this mark.",
      href: "/wizard",
      hrefLabel: "Use Product Wizard to check requirements",
      isUrgent: true,
    },
    {
      id: "mr-2",
      title: "Annual Factory Inspection Report",
      description:
        "A current factory inspection report (within the last 12 months) is required for BIS license renewal under Schedule IV of the IS Act. Upload it to your Documents vault.",
      href: "/documents",
      hrefLabel: "Upload to Documents",
      isUrgent: true,
    },
    {
      id: "mr-3",
      title: "Test Report — IS 616 (Lamps)",
      description:
        "Third-party lab test report from a BIS-recognized laboratory required as evidence of compliance for LED lamp products. Must be less than 2 years old.",
      href: "/labs",
      hrefLabel: "Find a BIS-recognized lab",
    },
  ],
  new_business: [
    {
      id: "mr-4",
      title: "BIS Registration — Compulsory Registration Scheme (CRS)",
      description:
        "CRS registration is required before importing or selling most IT and electronics products in India. Registration must be obtained from BIS before market entry.",
      href: "/wizard",
      hrefLabel: "Use Product Wizard to check requirements",
      isUrgent: true,
    },
    {
      id: "mr-5",
      title: "FSSAI License (if food / packaging sector)",
      description:
        "Food businesses must obtain FSSAI registration or license before commencing operations. Mandatory for manufacturers, traders, and importers of food products.",
      href: "/standards",
      hrefLabel: "Explore food-related standards",
      isUrgent: true,
    },
    {
      id: "mr-6",
      title: "ISO 9001 Quality Management System Certification",
      description:
        "Recommended pre-requisite for BIS license applications. An ISO 9001-certified QMS significantly streamlines the BIS approval process and demonstrates operational control.",
      href: "/standards",
      hrefLabel: "Explore IS / ISO standards",
    },
    {
      id: "mr-7",
      title: "Test Report from NABL-Accredited Laboratory",
      description:
        "Product testing must be performed at an NABL-accredited laboratory for BIS scheme entry. Find an approved lab near your manufacturing location.",
      href: "/labs",
      hrefLabel: "Find a BIS-recognized lab",
    },
  ],
  consumer: [
    {
      id: "mr-8",
      title: "Verify Product ISI / FSSAI Mark Before Purchase",
      description:
        "Use the Verify tool to check whether a product's BIS mark or HUID hallmark number is authentic and currently valid before you purchase.",
      href: "/verify",
      hrefLabel: "Go to Verify BIS Mark",
    },
    {
      id: "mr-9",
      title: "Register Consumer Complaint (if applicable)",
      description:
        "Products sold without a valid ISI mark can be reported to BIS Consumer Affairs. This action protects other consumers and ensures market compliance.",
      href: "/standards",
      hrefLabel: "Learn about consumer rights",
    },
  ],
};

const SECTOR_KEYS: Record<UserType, string> = {
  existing_business: "onb.existing_business.title",
  new_business: "onb.new_business.title",
  consumer: "onb.consumer.title",
};

/** Hindi for the demo requirements above, by id. */
const MR_HI: Record<string, Pick<RequirementItem, "title" | "description" | "hrefLabel">> = {
  "mr-1": {
    title: "BIS ISI लाइसेंस — IS 9000 (इलेक्ट्रॉनिक्स)",
    description:
      "इलेक्ट्रॉनिक्स और IT वस्तु गुणवत्ता नियंत्रण आदेश (QCO) के तहत विद्युत वस्तुओं के लिए अनिवार्य ISI प्रमाणन। इस मार्क के बिना उत्पाद भारत में नहीं बेचे जा सकते।",
    hrefLabel: "आवश्यकताएँ जाँचने के लिए उत्पाद विज़ार्ड का उपयोग करें",
  },
  "mr-2": {
    title: "वार्षिक फ़ैक्टरी निरीक्षण रिपोर्ट",
    description:
      "IS अधिनियम की अनुसूची IV के तहत BIS लाइसेंस के नवीनीकरण के लिए पिछले 12 महीनों की फ़ैक्टरी निरीक्षण रिपोर्ट ज़रूरी है। इसे अपनी दस्तावेज़ तिजोरी में अपलोड करें।",
    hrefLabel: "दस्तावेज़ों में अपलोड करें",
  },
  "mr-3": {
    title: "परीक्षण रिपोर्ट — IS 616 (लैंप)",
    description:
      "LED लैंप उत्पादों के अनुपालन के प्रमाण के रूप में BIS-मान्यता प्राप्त प्रयोगशाला की तृतीय-पक्ष परीक्षण रिपोर्ट ज़रूरी है। यह 2 वर्ष से पुरानी नहीं होनी चाहिए।",
    hrefLabel: "BIS-मान्यता प्राप्त प्रयोगशाला खोजें",
  },
  "mr-4": {
    title: "BIS पंजीकरण — अनिवार्य पंजीकरण योजना (CRS)",
    description:
      "भारत में अधिकांश IT और इलेक्ट्रॉनिक्स उत्पादों के आयात या बिक्री से पहले CRS पंजीकरण ज़रूरी है। बाज़ार में उतारने से पहले BIS से पंजीकरण लेना होगा।",
    hrefLabel: "आवश्यकताएँ जाँचने के लिए उत्पाद विज़ार्ड का उपयोग करें",
  },
  "mr-5": {
    title: "FSSAI लाइसेंस (यदि खाद्य / पैकेजिंग क्षेत्र)",
    description:
      "खाद्य व्यवसायों को काम शुरू करने से पहले FSSAI पंजीकरण या लाइसेंस लेना होगा। यह खाद्य उत्पादों के निर्माताओं, व्यापारियों और आयातकों के लिए अनिवार्य है।",
    hrefLabel: "खाद्य से जुड़े मानक देखें",
  },
  "mr-6": {
    title: "ISO 9001 गुणवत्ता प्रबंधन प्रणाली प्रमाणन",
    description:
      "BIS लाइसेंस आवेदनों के लिए अनुशंसित पूर्व-आवश्यकता। ISO 9001-प्रमाणित QMS से BIS स्वीकृति की प्रक्रिया काफ़ी आसान होती है और परिचालन नियंत्रण दिखता है।",
    hrefLabel: "IS / ISO मानक देखें",
  },
  "mr-7": {
    title: "NABL-मान्यता प्राप्त प्रयोगशाला से परीक्षण रिपोर्ट",
    description:
      "BIS योजना में प्रवेश के लिए उत्पाद परीक्षण NABL-मान्यता प्राप्त प्रयोगशाला में होना चाहिए। अपने निर्माण स्थान के पास स्वीकृत प्रयोगशाला खोजें।",
    hrefLabel: "BIS-मान्यता प्राप्त प्रयोगशाला खोजें",
  },
  "mr-8": {
    title: "ख़रीदने से पहले उत्पाद का ISI / FSSAI मार्क सत्यापित करें",
    description:
      "ख़रीदने से पहले सत्यापन टूल से जाँचें कि उत्पाद का BIS मार्क या HUID हॉलमार्क संख्या असली है और अभी मान्य है।",
    hrefLabel: "BIS मार्क सत्यापन पर जाएँ",
  },
  "mr-9": {
    title: "उपभोक्ता शिकायत दर्ज करें (यदि लागू हो)",
    description:
      "बिना मान्य ISI मार्क के बेचे जा रहे उत्पादों की सूचना BIS उपभोक्ता मामले विभाग को दी जा सकती है। इससे दूसरे उपभोक्ताओं की सुरक्षा होती है और बाज़ार में अनुपालन बना रहता है।",
    hrefLabel: "उपभोक्ता अधिकारों के बारे में जानें",
  },
};

export default function MissingRequirementsPage() {
  const { user } = useAuth();
  const userType: UserType = user?.userType ?? "existing_business";
  const { t, language } = useLanguage();
  const items = MISSING_REQUIREMENTS[userType].map((item) =>
    language === "hi" && MR_HI[item.id] ? { ...item, ...MR_HI[item.id] } : item,
  );
  const urgentCount = items.filter((i) => i.isUrgent).length;

  return (
    <main className="flex-1 overflow-y-auto bg-gray-50" id="main-content">
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-7">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-navy)] hover:underline"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            {t("mr.back")}
          </Link>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-navy)]">
            {t("mr.compliance")} · {t(SECTOR_KEYS[userType])}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">{t("dash.missing")}</h1>
          <p className="mt-2 text-sm text-gray-600 max-w-xl">
            {t("mr.intro")}
          </p>
          {urgentCount > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-700">
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              {fill(t("mr.urgentCount"), { n: urgentCount })}
            </div>
          )}
        </div>

        {/* List */}
        <ol className="flex flex-col gap-4">
          {items.map((item, index) => (
            <li key={item.id}>
              <article
                className={`rounded-xl border bg-white p-5 shadow-sm ${
                  item.isUrgent ? "border-red-200" : "border-[var(--color-border)]"
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Sequence number / urgency indicator */}
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      item.isUrgent
                        ? "bg-red-100 text-red-700"
                        : "bg-[var(--color-navy-lighter)] text-[var(--color-navy)]"
                    }`}
                  >
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold text-gray-900">{item.title}</h2>
                      {item.isUrgent && (
                        <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                          {t("mr.urgent")}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-gray-600 leading-relaxed">{item.description}</p>
                    <Link
                      href={item.href}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-navy)] hover:underline"
                    >
                      {item.hrefLabel}
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ol>

        {/* Footer nudge */}
        <div className="mt-8 rounded-xl border border-[var(--color-border)] bg-white p-5">
          <p className="text-sm font-semibold text-gray-900">{t("mr.notSure")}</p>
          <p className="mt-1 text-sm text-gray-600">
            {t("mr.notSureHint")}
          </p>
          <Link
            href="/wizard"
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--color-navy)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-navy-light)] transition"
          >
            {t("mr.launch")}
          </Link>
        </div>
      </div>
    </main>
  );
}
