/**
 * The Compliance Roadmap in Hindi.
 *
 * Kept beside lib/roadmap.ts rather than in the interface dictionary: these are
 * paragraphs of regulatory content keyed to step ids, not interface labels, and
 * whoever checks a translation wants the English and the Hindi of one step in
 * view together. Figures (Rs 1,000), portal addresses, scheme names and BIS's
 * own terms - ISI, HUID, QCO, CRS, FMCS, LIMS, Scheme-I - stay as BIS writes
 * them, so the Hindi reader can still match them to BIS's pages.
 *
 * Anything without a Hindi entry falls back to the English, so a step added to
 * lib/roadmap.ts later shows in English rather than disappearing.
 */

import type { Language } from "@/lib/i18n/strings";
import type { RoadmapStep, SchemeId, SchemeTrack } from "@/lib/roadmap";

type StepText = Partial<Pick<RoadmapStep, "title" | "detail" | "caveat" | "timing">>;

const TRACKS_HI: Record<SchemeId, { name: string; because: string }> = {
  "scheme-i": {
    name: "ISI मार्क लाइसेंस (Scheme-I)",
    because: "आप भारत में निर्माण करते हैं, और यहाँ बनने वाले अधिकांश उत्पादों के लिए यही योजना है।",
  },
  "scheme-ii": {
    name: "अनिवार्य पंजीकरण (Scheme-II / CRS)",
    because: "इलेक्ट्रॉनिक्स और IT वस्तुएँ Scheme-I के लाइसेंस के बजाय Scheme-II के तहत पंजीकृत होती हैं।",
  },
  "scheme-x": {
    name: "Scheme-X प्रमाणन",
    because: "तकनीकी विनियमन के अंतर्गत आने वाली मशीनरी और विद्युत उपकरण Scheme-X के तहत प्रमाणित होते हैं।",
  },
  fmcs: {
    name: "विदेशी निर्माता प्रमाणन (FMCS)",
    because: "आप भारत के बाहर निर्माण करते हैं, जिसे BIS अपनी विदेशी निर्माता योजना के तहत देखता है।",
  },
  hallmarking: {
    name: "ज्वैलर पंजीकरण (हॉलमार्किंग)",
    because: "सोने और चाँदी के आभूषण उत्पाद लाइसेंस के बजाय BIS हॉलमार्किंग के तहत बेचे जाते हैं।",
  },
};

const STEPS_HI: Record<string, StepText> = {
  "find-standard": {
    title: "अपने उत्पाद का भारतीय मानक पहचानें",
    detail:
      "आगे का हर चरण किसी विशिष्ट भारतीय मानक के आधार पर होता है, इसलिए पहले उसे पहचानें। आपके उत्पाद से मेल खाने वाले मानक ऊपर दिखाए गए हैं; यदि कोई उपयुक्त न हो, तो BIS संबंधित तकनीकी विभाग से संपर्क करने को कहता है।",
  },
  "check-mandatory": {
    title: "जाँचें कि आपके उत्पाद के लिए प्रमाणन अनिवार्य है या नहीं",
    detail:
      "गुणवत्ता नियंत्रण आदेश (QCO) के अंतर्गत आने वाले उत्पादों पर भारत में बनाने, आयात करने या बेचने से पहले BIS मार्क होना ज़रूरी है। कौन-से उत्पाद और कब से शामिल हैं, यह जारी करने वाला मंत्रालय तय करता है।",
    caveat:
      "यह ऐप नहीं बता सकता कि आपका उत्पाद इसमें शामिल है या नहीं — BIS की वर्तमान सूची देखें। सूची संशोधनों से बढ़ती रहती है, इसलिए सहेजी गई प्रति पुरानी हो जाती है।",
  },
  "register-portal": {
    title: "BIS पोर्टल पर पंजीकरण करें",
    detail:
      "BIS उत्पाद प्रमाणन के आवेदन केवल ऑनलाइन, manakonline.in के माध्यम से स्वीकार करता है। आवेदन से पहले वहाँ पंजीकरण करें।",
  },
  "choose-route": {
    title: "अपना प्रमाणन मार्ग चुनें",
    detail:
      "विकल्प 1 में फ़ैक्टरी मूल्यांकन होता है और निरीक्षण के दौरान लिए गए नमूनों की जाँच होती है; रिपोर्ट में अनुरूपता दिखने पर ही लाइसेंस मिलता है। विकल्प 2 BIS-मान्यता प्राप्त प्रयोगशाला की परीक्षण रिपोर्ट पर आधारित है।",
    timing: "BIS के अनुसार विकल्प 2 में लगभग एक महीना और विकल्प 1 में लगभग चार महीने लगते हैं",
  },
  "prepare-factory": {
    title: "निर्माण और परीक्षण क्षमता तैयार करें",
    detail:
      "BIS आपके भारतीय मानक की आवश्यकताओं के अनुसार निर्माण ढाँचे, प्रक्रिया नियंत्रण, गुणवत्ता नियंत्रण और आंतरिक परीक्षण की जाँच करता है।",
    caveat: "BIS हर उत्पाद के लिए कोई एक दस्तावेज़ सूची प्रकाशित नहीं करता; यह आपका मानक तय करता है।",
  },
  "get-tested": {
    title: "नमूनों की जाँच करवाएँ",
    detail:
      "जाँच भारतीय मानक के अनुसार BIS-मान्यता प्राप्त प्रयोगशाला में होती है। प्रयोगशाला खोजें पेज BIS द्वारा प्रकाशित प्रयोगशालाएँ दिखाता है; LIMS उन्हें मानक संख्या से खोजता है।",
  },
  apply: {
    title: "आवेदन करें और आवेदन शुल्क चुकाएँ",
    detail: "पोर्टल के माध्यम से आवेदन जमा करें। BIS के अनुसार आवेदन शुल्क Rs 1,000 है।",
  },
  inspection: {
    title: "फ़ैक्टरी निरीक्षण करवाएँ",
    detail:
      "विकल्प 1 में BIS अधिकारी फ़ैक्टरी आकर नमूने लेते हैं। BIS के अनुसार निरीक्षण शुल्क Rs 7,000 प्रति व्यक्ति प्रति दिन है।",
    caveat: "यह फ़ैक्टरी मार्ग पर लागू है; प्रयोगशाला मार्ग परीक्षण रिपोर्ट पर निर्भर करता है।",
  },
  grant: {
    title: "लाइसेंस पाएँ और मार्किंग शुरू करें",
    detail:
      "Scheme-I लाइसेंस शुरुआत में अधिकतम दो वर्ष के लिए दिया जा सकता है। BIS के अनुसार न्यूनतम वार्षिक लाइसेंस शुल्क Rs 1,000 है, साथ में अनुसूची में दिए गए मार्किंग शुल्क।",
  },
  maintain: {
    title: "लाइसेंस मान्य बनाए रखें",
    detail:
      "BIS अचानक फ़ैक्टरी निरीक्षण करता है और बाज़ार से ख़रीदे गए ISI-मार्क वाले उत्पादों की जाँच करता है। समाप्ति से पहले पोर्टल पर नवीनीकरण करें; BIS के अनुसार समय पर नवीनीकरण न करने पर लाइसेंस निलंबित हो जाता है।",
  },
  "crs-portal": {
    title: "CRS पोर्टल पर पंजीकरण करें",
    detail: "पंजीकरण अपने अलग पोर्टल crsbis.in से होता है — manakonline.in से नहीं, जो Scheme-I का मार्ग है।",
  },
  "crs-test": {
    title: "BIS-मान्यता प्राप्त प्रयोगशाला में उत्पाद की जाँच करवाएँ",
    detail:
      "पंजीकरण संबंधित भारतीय मानक के अनुसार BIS-मान्यता प्राप्त प्रयोगशाला की परीक्षण रिपोर्ट पर आधारित होता है।",
  },
  "crs-apply": {
    title: "परीक्षण रिपोर्ट के साथ पंजीकरण के लिए आवेदन करें",
    detail: "CRS पोर्टल पर आवेदन और प्रयोगशाला की रिपोर्ट जमा करें।",
    caveat: "शुल्क Scheme-I FAQ के बजाय CRS पोर्टल पर दिए गए हैं, इसलिए यहाँ नहीं बताए गए।",
  },
  "crs-mark": {
    title: "पंजीकरण पाएँ और उत्पाद पर मार्क लगाएँ",
    detail: "पंजीकरण के बाद, बिक्री से पहले उत्पाद पर आपकी पंजीकरण संख्या के साथ मानक मार्क लगाया जाता है।",
  },
  "crs-renew": {
    title: "पंजीकरण चालू रखें",
    detail: "पंजीकरण समाप्त होने से पहले नवीनीकरण करें, और हर नए मॉडल या वेरिएंट का पंजीकरण करें।",
    caveat: "अपने पंजीकरण की वैधता अवधि पोर्टल पर देखें।",
  },
  "x-read": {
    title: "अपने उत्पाद के लिए Scheme-X दिशानिर्देश पढ़ें",
    detail:
      "Scheme-X बताती है कि इसके अंतर्गत आने वाले उपकरणों की अनुरूपता का आकलन कैसे होता है। आवेदन तैयार करने से पहले पहचानें कि आपके उत्पाद पर कौन-सी आवश्यकताएँ लागू होती हैं।",
    caveat:
      "हमने यहाँ Scheme-X के आकलन का विवरण संक्षेप में नहीं दिया है; किसी सारांश पर निर्भर रहने के बजाय BIS के दिशानिर्देश पढ़ें।",
  },
  "x-test": {
    title: "मानक के अनुसार परीक्षण की व्यवस्था करें",
    detail: "परीक्षण लागू भारतीय मानक के अनुसार किया जाता है।",
  },
  "x-apply": {
    title: "प्रमाणन के लिए आवेदन करें",
    detail: "दिशानिर्देशों में माँगे गए दस्तावेज़ों के साथ BIS पोर्टल पर आवेदन करें।",
  },
  "x-maintain": {
    title: "प्रमाणन मान्य बनाए रखें",
    detail: "प्रमाणन मिलने के बाद अनुरूपता बनाए रखें और समाप्ति से पहले नवीनीकरण करें।",
  },
  "fmcs-air": {
    title: "अधिकृत भारतीय प्रतिनिधि नियुक्त करें",
    detail:
      "विदेशी निर्माता को एक अधिकृत भारतीय प्रतिनिधि नामित करना होता है, जो BIS के साथ उसकी ओर से काम करे और भारत में अनुपालन की ज़िम्मेदारी निभाए।",
  },
  "fmcs-apply": {
    title: "ऑनलाइन आवेदन करें",
    detail: "प्रतिनिधि के विवरण के साथ BIS पोर्टल पर आवेदन जमा करें।",
    caveat: "शुल्क उत्पाद के अनुसार अलग-अलग हैं; BIS इन्हें एक आँकड़े के बजाय FMCS पेजों पर देता है।",
  },
  "fmcs-inspect": {
    title: "निरीक्षण और नमूना परीक्षण करवाएँ",
    detail: "योजना के अनुसार BIS विदेशी फ़ैक्टरी का आकलन करता है और नमूनों की जाँच करता है।",
  },
  "fmcs-grant": {
    title: "लाइसेंस पाएँ",
    detail: "लाइसेंस मिलने के बाद मार्क वाला उत्पाद भारत में बेचा जा सकता है।",
  },
  "fmcs-renew": {
    title: "समाप्ति से पहले नवीनीकरण करें",
    detail: "लाइसेंस एक निश्चित अवधि के लिए मान्य होता है, जिसके बाद बिक्री जारी रखने के लिए इसका नवीनीकरण ज़रूरी है।",
  },
  "hm-district": {
    title: "जाँचें कि आपके ज़िले में हॉलमार्किंग अनिवार्य है या नहीं",
    detail:
      "सोने के आभूषणों की अनिवार्य हॉलमार्किंग ज़िलेवार लागू होती है और चरणों में बढ़ाई गई है। अपने ज़िले के बारे में सहायक से पूछें — वह BIS की प्रकाशित ज़िला सूची से उत्तर देता है।",
  },
  "hm-register": {
    title: "BIS के साथ ज्वैलर के रूप में पंजीकरण करें",
    detail:
      "हॉलमार्क वाले आभूषण बेचने वाले ज्वैलर manakonline.in के माध्यम से ज्वैलर पंजीकरण योजना के तहत BIS में पंजीकरण करते हैं।",
  },
  "hm-ahc": {
    title: "परख और हॉलमार्किंग केंद्र (AHC) पर हॉलमार्क करवाएँ",
    detail:
      "आभूषणों की जाँच और मार्किंग BIS-मान्यता प्राप्त परख और हॉलमार्किंग केंद्र में होती है, ज्वैलर द्वारा नहीं।",
  },
  "hm-huid": {
    title: "केवल HUID वाले आभूषण ही बेचें",
    detail:
      "1 जुलाई 2021 से हॉलमार्क के तीन भाग हैं: BIS लोगो, शुद्धता, और हर आभूषण का छह-अक्षर का विशिष्ट HUID, जिसे ग्राहक BIS Care ऐप में सत्यापित कर सकते हैं।",
  },
  "hm-maintain": {
    title: "ज्वैलरों के लिए दिशानिर्देशों का पालन करें",
    detail: "पंजीकरण बनाए रखने के लिए पंजीकृत ज्वैलरों के लिए BIS के दिशानिर्देशों का पालन करें।",
  },
};

/** Where one step's wording differs between tracks: `${trackId}:${stepId}`. */
const STEP_OVERRIDES_HI: Record<string, StepText> = {
  "scheme-ii:check-mandatory": {
    detail:
      "पंजीकरण केवल उन इलेक्ट्रॉनिक्स और IT उत्पादों के लिए अनिवार्य है जो इस योजना के तहत अधिसूचित हैं। शुरू करने से पहले पुष्टि करें कि आपका उत्पाद उनमें शामिल है।",
  },
  "scheme-x:check-mandatory": {
    detail:
      "Scheme-X संबंधित तकनीकी विनियमन के तहत अधिसूचित मशीनरी और विद्युत उपकरणों पर लागू होती है। पुष्टि करें कि आपका उत्पाद इसमें शामिल है।",
  },
};

/** BIS page names, translated; portal addresses stay as they are. */
const SOURCE_LABELS_HI: Record<string, string> = {
  "Product certification FAQ": "उत्पाद प्रमाणन FAQ",
  "Products under compulsory certification": "अनिवार्य प्रमाणन वाले उत्पाद",
  "Certification process and Scheme-I guidelines": "प्रमाणन प्रक्रिया और Scheme-I दिशानिर्देश",
  "LIMS standards-wise laboratory search": "LIMS मानक-वार प्रयोगशाला खोज",
  "Compulsory Registration Scheme": "अनिवार्य पंजीकरण योजना",
  "Scheme-X certification": "Scheme-X प्रमाणन",
  "Foreign Manufacturers Certification Scheme": "विदेशी निर्माता प्रमाणन योजना",
  "Mandatory hallmarking order": "अनिवार्य हॉलमार्किंग आदेश",
  "Jewellers registration scheme": "ज्वैलर पंजीकरण योजना",
  "List of hallmarking centres": "हॉलमार्किंग केंद्रों की सूची",
  "Hallmarking FAQs": "हॉलमार्किंग FAQ",
  "Guidelines for Jewellers": "ज्वैलरों के लिए दिशानिर्देश",
};

/** The track in the reader's language. English is returned untouched. */
export function localizeTrack(track: SchemeTrack, language: Language): SchemeTrack {
  if (language !== "hi") return track;
  const names = TRACKS_HI[track.id];
  return {
    ...track,
    name: names?.name ?? track.name,
    because: names?.because ?? track.because,
    steps: track.steps.map((step) => ({
      ...step,
      ...STEPS_HI[step.id],
      ...STEP_OVERRIDES_HI[`${track.id}:${step.id}`],
      sourceLabel: SOURCE_LABELS_HI[step.sourceLabel] ?? step.sourceLabel,
    })),
  };
}
