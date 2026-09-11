/**
 * The interface's own words, in English and Hindi.
 *
 * These are written out rather than machine-translated at runtime, for three
 * reasons. They are a fixed, small set that never changes between page loads,
 * so translating them repeatedly would be paying per render for the same
 * answer. They must be exact - a navigation label that comes back slightly
 * different on a later load makes the app feel unstable. And a wrong button
 * label is not recoverable by the reader the way a wrong sentence is, because
 * there is no original beside it to compare against.
 *
 * The assistant's *answers* are the opposite case - unbounded, generated, and
 * different every time - so those go through POST /translate instead, where
 * the citation markers are checked. See components/chat/TranslateAnswer.tsx.
 *
 * Terms deliberately left in Latin script: BIS, ISI, HUID, QCO, FMCS, CRS, and
 * standard numbers such as IS 1417. These appear exactly this way on the BIS
 * portal and on the forms a user has to fill in, so translating them would
 * make the thing on screen stop matching the thing in their hand.
 */

export type Language = "en" | "hi";

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  hi: "हिन्दी",
};

type Dictionary = Record<string, string>;

const en: Dictionary = {
  // Shell and navigation
  "app.name": "BIS Sahayak",
  "app.tagline": "Bureau of Indian Standards",
  "nav.home": "Home",
  "nav.chat": "Chat Assistant",
  "nav.wizard": "Product Wizard",
  "nav.standards": "Standards",
  "nav.labs": "Lab Finder",
  "nav.verify": "Verify License",
  "nav.documents": "Documents",
  "nav.recents": "Recents",
  "nav.recentChats": "Recent Chats",
  "nav.recentDocuments": "Recent Documents",
  "nav.viewAll": "View all",
  "nav.showLess": "Show less",
  "nav.noChats": "No chats yet - ask your first question.",
  "nav.profile": "Profile",
  "nav.settings": "Settings",
  "nav.logout": "Log out",
  "nav.openNavigation": "Open navigation",

  // Language switch
  "lang.label": "Language",
  "lang.switchTo": "Switch to हिन्दी",

  // Chat
  "chat.placeholder": "Ask about Indian Standards, certification, hallmarking, testing labs…",
  "chat.send": "Send message",
  "chat.reset": "Reset chat history",
  "chat.resetConfirm": "Delete all your conversations? This cannot be undone.",
  "chat.resetYes": "Delete all",
  "chat.cancel": "Cancel",
  "chat.newChat": "New chat",
  "chat.conversation": "Conversation",
  "chat.messages": "Chat messages",
  "chat.tryAsking": "Try asking",
  "chat.newAnswer": "New answer",
  "chat.requestFailed": "Request failed",
  "chat.retry": "Retry",
  "chat.sources": "Sources",
  "chat.translate": "Translate",
  "chat.showEnglish": "Show English",
  "chat.translateInto": "Translate this answer into",
  "chat.translatedNote":
    "Translated from the English answer. Standard numbers, scheme names and the sources below are unchanged.",
  "chat.translateUnavailable": "Translation is unavailable at the moment.",

  // Context panel
  "panel.label": "Answer context",
  "panel.business": "Your business",
  "panel.businessEmpty": "Tell me what you make or sell and I'll tailor answers to it.",
  "panel.askedAbout": "You've asked about",
  "panel.youSaid": "You said",
  "panel.certification": "Certification",
  "panel.certificationEmpty":
    "Ask about licensing, a scheme or a QCO and the documents behind the answer land here.",
  "panel.citedInAnswer": "Cited in this answer",
  "panel.youToldUs": "You told us",
  "panel.unverified": "As entered during onboarding. Not checked against BIS records.",
  "panel.sources": "Sources",
  "panel.sourcesEmpty":
    "Sources for the current answer will appear here, each linking back to the BIS document it came from.",
  "panel.abstained": "Abstained",
  "panel.abstainedBody":
    "The assistant found no authoritative source for that question and declined to answer rather than guess.",
  "panel.labs": "Nearby testing labs",
  "panel.labsLoading": "Loading the BIS directory…",
  "panel.labsUnreachable": "The laboratory directory could not be reached just now.",
  "panel.mapView": "Map view",
  "panel.mapNoKey": "Google Maps key not configured",
  "panel.sortByDistance": "Sort by distance from me",
  "panel.locating": "Finding you…",
  "panel.locationDeclined": "Location not shared — showing laboratories in directory order.",
  "panel.suspended": "Currently suspended",
  "panel.labsCaveat":
    "BIS publishes each laboratory's city, not its address, so distances are to the city centre. Test scopes are not published in this list.",

  // Lab finder
  "labs.title": "Find a testing laboratory",
  "labs.eyebrow": "BIS laboratory directory",
  "labs.subtitle": "Search the laboratories BIS publishes, by name, city or state.",
  "labs.searchPlaceholder": "Search by name, city or OSL code…",
  "labs.allLocations": "All locations",
  "labs.allLabs": "All laboratories",
  "labs.recognisedOnly": "BIS recognised only",
  "labs.matches": "matches",
  "labs.loading": "Loading the directory…",
  "labs.recognised": "BIS recognised",
  "labs.usedByBis": "Used by BIS",
  "labs.noneTitle": "No laboratories match",
  "labs.noneBody": "Try a different state, or search by the laboratory's name.",
  "labs.osl": "OSL",
  "labs.type": "Type",
  "labs.validTo": "Valid to",
  "labs.lapsed": "Lapsed",
  "labs.locationUnknown": "Location not published",

  // BIS updates
  "nav.updates": "BIS Updates",
  "nav.roadmap": "Compliance Roadmap",
  "updates.eyebrow": "Bureau of Indian Standards",
  "updates.title": "BIS Updates",
  "updates.subtitle":
    "Amendments, quality control orders, licences and announcements, newest first, grouped by the week BIS published them.",
  "updates.sourceNote": "Every item links to the notice on",
  "updates.loading": "Loading updates…",
  "updates.unreachable": "Could not load BIS updates just now.",
  "updates.filter": "Filter by category",
  "updates.all": "All",
  "updates.thisWeek": "This week",
  "updates.lastWeek": "Last week",
  "updates.weekOf": "Week of",
  "updates.undated": "Undated",
  "updates.noneTitle": "Nothing in this category",
  "updates.noneBody": "Try another category, or view all updates.",
  "updates.category.amendment": "Amendment",
  "updates.category.qco": "Quality Control Order",
  "updates.category.hallmarking": "Hallmarking",
  "updates.category.licence": "Licence",
  "updates.category.standard": "Standard",
  "updates.category.recruitment": "Recruitment",
  "updates.category.event": "Event",
  "updates.category.news": "News",

  // Document upload
  "upload.button": "Upload a document",
  "upload.dropHere": "Drop a file here, or choose one",
  "upload.formats": "PDF, image, Word or text · up to 20 MB",
  "upload.category": "Category",
  "upload.category.License": "Licence",
  "upload.category.TestReport": "Test report",
  "upload.category.Certificate": "Certificate",
  "upload.category.Other": "Other",
  "upload.expiry": "Expires on (optional)",
  "upload.choose": "Choose file",
  "upload.close": "Close",
  "upload.added": "Added",
  "upload.tooLarge": "Too large to add",
  "attach.button": "Attach a document",
  "attach.reading": "Reading…",
  "attach.ready": "Read",
  "attach.failed": "Could not read",
  "attach.remove": "Remove attachment",
  "attach.note": "Sent with your next question for the assistant to read. It is never cited as a BIS source.",
  "attach.truncated": "It is long, so only the first part is read.",
  "attach.tooLarge": "The file is larger than 10 MB.",
  "attach.defaultQuestion": "Summarise this document and tell me what it means for BIS compliance.",
  "upload.privacy":
    "Signed in, files are saved privately to your account - only you can open them. Without an account they stay in this browser. Nothing is sent to BIS, and the assistant reads a file only when you attach it in the chat.",

  // Certification roadmap
  "roadmap.eyebrow": "What to do next",
  "roadmap.title": "Compliance Roadmap",
  "roadmap.subtitle":
    "The route to a licence, in the order it happens. Every step links to the BIS page it came from.",
  "roadmap.stepsDone": "steps marked done",
  "roadmap.nextUp": "Next up",
  "roadmap.allDone": "Every step marked done.",
  "roadmap.timing": "Timing",
  "roadmap.markDone": "Mark done",
  "roadmap.markNotDone": "Mark not done",
  "roadmap.reset": "Clear all",
  "roadmap.disclaimer":
    "You are marking your own progress; this is not confirmation from BIS that a step is complete. Fees and timelines are as BIS states them and can change — check",

  // Roadmap intake
  "intake.subtitle":
    "Tell us what you are building. The answers decide which BIS scheme applies, and the steps change with it.",
  "intake.fromChat": "From your chat",
  "intake.useThis": "Use this",
  "intake.product": "What do you make or sell?",
  "intake.productPlaceholder": "e.g. LED bulbs, PVC pipes, gold chains, laptop chargers",
  "intake.madeIn": "Where is it manufactured?",
  "intake.madeIn.india": "In India",
  "intake.madeIn.abroad": "Outside India",
  "intake.kind": "What kind of product is it?",
  "intake.kindHint": "We have guessed from your description — change it if it is wrong.",
  "intake.kind.general": "Other manufactured goods",
  "intake.kind.electronics": "Electronics or IT",
  "intake.kind.jewellery": "Gold or silver jewellery",
  "intake.kind.machinery": "Machinery or electrical equipment",
  "intake.build": "Build my roadmap",
  "intake.change": "Change my answers",
  "intake.startOver": "Start over",
  "intake.standardsTitle": "Indian Standards matched to your product",
  "intake.standardsLoading": "Searching the BIS catalogue…",
  "intake.standardsFailed": "The catalogue could not be searched just now.",
  "intake.standardsNone": "No close match in the catalogue — try describing the product differently.",
  "intake.standardsCaveat":
    "Candidates from the BIS catalogue, not a ruling. Confirm the applicable standard with BIS before you apply.",
};

const hi: Dictionary = {
  // Shell and navigation
  "app.name": "BIS सहायक",
  "app.tagline": "भारतीय मानक ब्यूरो",
  "nav.home": "होम",
  "nav.chat": "चैट सहायक",
  "nav.wizard": "उत्पाद विज़ार्ड",
  "nav.standards": "मानक",
  "nav.labs": "प्रयोगशाला खोजें",
  "nav.verify": "लाइसेंस सत्यापित करें",
  "nav.documents": "दस्तावेज़",
  "nav.recents": "हाल के",
  "nav.recentChats": "हाल की चैट",
  "nav.recentDocuments": "हाल के दस्तावेज़",
  "nav.viewAll": "सभी देखें",
  "nav.showLess": "कम दिखाएँ",
  "nav.noChats": "अभी कोई चैट नहीं - अपना पहला प्रश्न पूछें।",
  "nav.profile": "प्रोफ़ाइल",
  "nav.settings": "सेटिंग्स",
  "nav.logout": "लॉग आउट",
  "nav.openNavigation": "नेविगेशन खोलें",

  // Language switch
  "lang.label": "भाषा",
  "lang.switchTo": "English पर जाएँ",

  // Chat
  "chat.placeholder": "भारतीय मानकों, प्रमाणन, हॉलमार्किंग या परीक्षण प्रयोगशालाओं के बारे में पूछें…",
  "chat.send": "संदेश भेजें",
  "chat.reset": "चैट इतिहास मिटाएँ",
  "chat.resetConfirm": "आपकी सभी बातचीत मिटाएँ? इसे वापस नहीं लाया जा सकता।",
  "chat.resetYes": "सभी मिटाएँ",
  "chat.cancel": "रद्द करें",
  "chat.newChat": "नई चैट",
  "chat.conversation": "बातचीत",
  "chat.messages": "चैट संदेश",
  "chat.tryAsking": "यह पूछकर देखें",
  "chat.newAnswer": "नया उत्तर",
  "chat.requestFailed": "अनुरोध विफल रहा",
  "chat.retry": "पुनः प्रयास करें",
  "chat.sources": "स्रोत",
  "chat.translate": "अनुवाद करें",
  "chat.showEnglish": "अंग्रेज़ी में देखें",
  "chat.translateInto": "इस उत्तर का अनुवाद करें",
  "chat.translatedNote":
    "अंग्रेज़ी उत्तर से अनुवादित। मानक संख्याएँ, योजनाओं के नाम और नीचे दिए स्रोत अपरिवर्तित हैं।",
  "chat.translateUnavailable": "अनुवाद अभी उपलब्ध नहीं है।",

  // Context panel
  "panel.label": "उत्तर का संदर्भ",
  "panel.business": "आपका व्यवसाय",
  "panel.businessEmpty": "बताइए आप क्या बनाते या बेचते हैं, उत्तर उसी के अनुसार दूँगा।",
  "panel.askedAbout": "आपने इनके बारे में पूछा",
  "panel.youSaid": "आपने कहा",
  "panel.certification": "प्रमाणन",
  "panel.certificationEmpty":
    "लाइसेंस, किसी योजना या QCO के बारे में पूछिए — उत्तर के पीछे के दस्तावेज़ यहाँ दिखेंगे।",
  "panel.citedInAnswer": "इस उत्तर में उद्धृत",
  "panel.youToldUs": "आपने हमें बताया",
  "panel.unverified": "पंजीकरण के समय आपके द्वारा दर्ज। BIS रिकॉर्ड से सत्यापित नहीं।",
  "panel.sources": "स्रोत",
  "panel.sourcesEmpty":
    "वर्तमान उत्तर के स्रोत यहाँ दिखेंगे, प्रत्येक उस BIS दस्तावेज़ से जुड़ा जिससे वह लिया गया है।",
  "panel.abstained": "उत्तर नहीं दिया",
  "panel.abstainedBody":
    "उस प्रश्न के लिए कोई प्रामाणिक स्रोत नहीं मिला, इसलिए अनुमान लगाने के बजाय उत्तर नहीं दिया गया।",
  "panel.labs": "आस-पास की परीक्षण प्रयोगशालाएँ",
  "panel.labsLoading": "BIS निर्देशिका लोड हो रही है…",
  "panel.labsUnreachable": "प्रयोगशाला निर्देशिका अभी उपलब्ध नहीं हो सकी।",
  "panel.mapView": "मानचित्र",
  "panel.mapNoKey": "Google Maps कुंजी कॉन्फ़िगर नहीं है",
  "panel.sortByDistance": "मेरी दूरी के अनुसार क्रमबद्ध करें",
  "panel.locating": "आपका स्थान खोजा जा रहा है…",
  "panel.locationDeclined": "स्थान साझा नहीं किया गया — प्रयोगशालाएँ निर्देशिका क्रम में दिख रही हैं।",
  "panel.suspended": "फ़िलहाल निलंबित",
  "panel.labsCaveat":
    "BIS प्रत्येक प्रयोगशाला का शहर प्रकाशित करता है, पता नहीं — इसलिए दूरी शहर के केंद्र तक है। इस सूची में परीक्षण का दायरा प्रकाशित नहीं होता।",

  // Lab finder
  "labs.title": "परीक्षण प्रयोगशाला खोजें",
  "labs.eyebrow": "BIS प्रयोगशाला निर्देशिका",
  "labs.subtitle": "BIS द्वारा प्रकाशित प्रयोगशालाएँ नाम, शहर या राज्य से खोजें।",
  "labs.searchPlaceholder": "नाम, शहर या OSL कोड से खोजें…",
  "labs.allLocations": "सभी स्थान",
  "labs.allLabs": "सभी प्रयोगशालाएँ",
  "labs.recognisedOnly": "केवल BIS मान्यता प्राप्त",
  "labs.matches": "परिणाम",
  "labs.loading": "निर्देशिका लोड हो रही है…",
  "labs.recognised": "BIS मान्यता प्राप्त",
  "labs.usedByBis": "BIS द्वारा प्रयुक्त",
  "labs.noneTitle": "कोई प्रयोगशाला नहीं मिली",
  "labs.noneBody": "कोई दूसरा राज्य चुनें, या प्रयोगशाला के नाम से खोजें।",
  "labs.osl": "OSL",
  "labs.type": "प्रकार",
  "labs.validTo": "मान्य",
  "labs.lapsed": "समाप्त",
  "labs.locationUnknown": "स्थान प्रकाशित नहीं",

  // BIS updates
  "nav.updates": "BIS अपडेट",
  "nav.roadmap": "अनुपालन रोडमैप",
  "updates.eyebrow": "भारतीय मानक ब्यूरो",
  "updates.title": "BIS अपडेट",
  "updates.subtitle":
    "संशोधन, गुणवत्ता नियंत्रण आदेश, लाइसेंस और घोषणाएँ — नवीनतम पहले, BIS के प्रकाशन सप्ताह के अनुसार।",
  "updates.sourceNote": "प्रत्येक प्रविष्टि मूल सूचना से जुड़ी है —",
  "updates.loading": "अपडेट लोड हो रहे हैं…",
  "updates.unreachable": "BIS अपडेट अभी लोड नहीं हो सके।",
  "updates.filter": "श्रेणी से छानें",
  "updates.all": "सभी",
  "updates.thisWeek": "इस सप्ताह",
  "updates.lastWeek": "पिछले सप्ताह",
  "updates.weekOf": "सप्ताह",
  "updates.undated": "दिनांक रहित",
  "updates.noneTitle": "इस श्रेणी में कुछ नहीं",
  "updates.noneBody": "कोई दूसरी श्रेणी चुनें, या सभी अपडेट देखें।",
  "updates.category.amendment": "संशोधन",
  "updates.category.qco": "गुणवत्ता नियंत्रण आदेश",
  "updates.category.hallmarking": "हॉलमार्किंग",
  "updates.category.licence": "लाइसेंस",
  "updates.category.standard": "मानक",
  "updates.category.recruitment": "भर्ती",
  "updates.category.event": "आयोजन",
  "updates.category.news": "समाचार",

  // Document upload
  "upload.button": "दस्तावेज़ अपलोड करें",
  "upload.dropHere": "फ़ाइल यहाँ छोड़ें, या चुनें",
  "upload.formats": "PDF, चित्र, Word या टेक्स्ट · अधिकतम 20 MB",
  "upload.category": "श्रेणी",
  "upload.category.License": "लाइसेंस",
  "upload.category.TestReport": "परीक्षण रिपोर्ट",
  "upload.category.Certificate": "प्रमाणपत्र",
  "upload.category.Other": "अन्य",
  "upload.expiry": "समाप्ति तिथि (वैकल्पिक)",
  "upload.choose": "फ़ाइल चुनें",
  "upload.close": "बंद करें",
  "upload.added": "जोड़ा गया",
  "upload.tooLarge": "बहुत बड़ी है, जोड़ी नहीं गई",
  "attach.button": "दस्तावेज़ संलग्न करें",
  "attach.reading": "पढ़ा जा रहा है…",
  "attach.ready": "पढ़ लिया गया",
  "attach.failed": "पढ़ा नहीं जा सका",
  "attach.remove": "संलग्नक हटाएँ",
  "attach.note": "यह आपके अगले प्रश्न के साथ सहायक को पढ़ने के लिए भेजा जाएगा। इसे कभी BIS स्रोत के रूप में उद्धृत नहीं किया जाता।",
  "attach.truncated": "यह लंबा है, इसलिए केवल शुरुआती भाग पढ़ा गया।",
  "attach.tooLarge": "फ़ाइल 10 MB से बड़ी है।",
  "attach.defaultQuestion": "इस दस्तावेज़ का सारांश दें और बताएँ कि BIS अनुपालन के लिए इसका क्या अर्थ है।",
  "upload.privacy":
    "साइन इन होने पर फ़ाइलें आपके खाते में निजी रूप से सहेजी जाती हैं - केवल आप उन्हें खोल सकते हैं। खाते के बिना वे इसी ब्राउज़र में रहती हैं। कुछ भी BIS को नहीं भेजा जाता, और सहायक किसी फ़ाइल को तभी पढ़ता है जब आप उसे चैट में संलग्न करते हैं।",

  // Certification roadmap
  "roadmap.eyebrow": "आगे क्या करें",
  "roadmap.title": "अनुपालन रोडमैप",
  "roadmap.subtitle":
    "लाइसेंस तक का रास्ता, उसी क्रम में जिस क्रम में यह होता है। हर चरण उस BIS पृष्ठ से जुड़ा है जहाँ से वह लिया गया है।",
  "roadmap.stepsDone": "चरण पूर्ण",
  "roadmap.nextUp": "अगला चरण",
  "roadmap.allDone": "सभी चरण पूर्ण चिह्नित हैं।",
  "roadmap.timing": "समय",
  "roadmap.markDone": "पूर्ण चिह्नित करें",
  "roadmap.markNotDone": "अपूर्ण चिह्नित करें",
  "roadmap.reset": "सभी हटाएँ",
  "roadmap.disclaimer":
    "आप अपनी स्वयं की प्रगति चिह्नित कर रहे हैं; यह BIS की ओर से पुष्टि नहीं है कि कोई चरण पूरा हो चुका है। शुल्क और समयसीमा BIS द्वारा बताए अनुसार हैं और बदल सकते हैं — देखें",

  // Roadmap intake
  "intake.subtitle":
    "बताइए आप क्या बना रहे हैं। आपके उत्तर तय करते हैं कि कौन-सी BIS योजना लागू होगी, और चरण उसी के अनुसार बदलते हैं।",
  "intake.fromChat": "आपकी चैट से",
  "intake.useThis": "यही उपयोग करें",
  "intake.product": "आप क्या बनाते या बेचते हैं?",
  "intake.productPlaceholder": "जैसे LED बल्ब, PVC पाइप, सोने की चेन, लैपटॉप चार्जर",
  "intake.madeIn": "इसका निर्माण कहाँ होता है?",
  "intake.madeIn.india": "भारत में",
  "intake.madeIn.abroad": "भारत के बाहर",
  "intake.kind": "यह किस प्रकार का उत्पाद है?",
  "intake.kindHint": "आपके विवरण से अनुमान लगाया गया है — गलत हो तो बदल दें।",
  "intake.kind.general": "अन्य निर्मित वस्तुएँ",
  "intake.kind.electronics": "इलेक्ट्रॉनिक्स या IT",
  "intake.kind.jewellery": "सोने या चाँदी के आभूषण",
  "intake.kind.machinery": "मशीनरी या विद्युत उपकरण",
  "intake.build": "मेरा रोडमैप बनाएँ",
  "intake.change": "मेरे उत्तर बदलें",
  "intake.startOver": "फिर से शुरू करें",
  "intake.standardsTitle": "आपके उत्पाद से मेल खाते भारतीय मानक",
  "intake.standardsLoading": "BIS सूची में खोजा जा रहा है…",
  "intake.standardsFailed": "सूची अभी खोजी नहीं जा सकी।",
  "intake.standardsNone": "सूची में कोई निकट मेल नहीं मिला — उत्पाद का वर्णन अलग ढंग से करके देखें।",
  "intake.standardsCaveat":
    "BIS सूची से संभावित मानक, कोई निर्णय नहीं। आवेदन से पहले लागू मानक की पुष्टि BIS से करें।",
};

const DICTIONARIES: Record<Language, Dictionary> = { en, hi };

/**
 * Look up a key. An untranslated key falls back to the English rather than
 * showing the key itself: a gap in the dictionary should read as an
 * untranslated phrase, not as `panel.labsCaveat` in the middle of the page.
 */
export function lookup(language: Language, key: string): string {
  return DICTIONARIES[language][key] ?? en[key] ?? key;
}

/** Keys present in English but not yet in Hindi. Used by the test. */
export function missingKeys(language: Language): string[] {
  return Object.keys(en).filter((key) => !(key in DICTIONARIES[language]));
}
