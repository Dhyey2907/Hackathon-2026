"use client";

import { useLanguage } from "@/components/i18n/LanguageProvider";
import { fill } from "@/lib/i18n/format";
import { useState } from "react";
import Link from "next/link";

const CATEGORIES = [
  "Household electrical", "Electronics & IT", "Wires & cables", "Cement",
  "Steel & construction", "Drinking water", "Automobiles & tyres", "Helmets & PPE",
  "Cookers & utensils", "LPG appliances", "Toys", "Hallmarking", "Food",
  "Pipes & plumbing", "Plywood", "Fire safety", "Solar", "EV charging",
  "Furniture", "Footwear", "Textiles", "Pumps & motors", "Agriculture",
  "Batteries", "Chemicals, plastics & rubber"
];

// Mock questions based on category
const MOCK_QUESTIONS: Record<string, { q: string, options: string[] }[]> = {
  "Household electrical": [
    { q: "What specific type of product is it?", options: ["LED Bulb / Luminaire", "Ceiling Fan", "Room Heater", "Other"] },
    { q: "Is the product intended for domestic or commercial use?", options: ["Domestic", "Commercial", "Both"] }
  ],
  "Helmets & PPE": [
    { q: "What is the primary use of the helmet?", options: ["Two-wheeler rider", "Industrial safety", "Fire fighting", "Sports"] },
    { q: "Does it have a face shield?", options: ["Yes", "No"] }
  ]
};

/** Hindi for the demo questions and results above; English is the key. */
const WIZARD_HI: Record<string, string> = {
  "Household electrical": "घरेलू विद्युत उपकरण",
  "Electronics & IT": "इलेक्ट्रॉनिक्स और IT",
  "Wires & cables": "तार और केबल",
  Cement: "सीमेंट",
  "Steel & construction": "इस्पात और निर्माण",
  "Drinking water": "पेयजल",
  "Automobiles & tyres": "ऑटोमोबाइल और टायर",
  "Helmets & PPE": "हेलमेट और PPE",
  "Cookers & utensils": "कुकर और बर्तन",
  "LPG appliances": "LPG उपकरण",
  Toys: "खिलौने",
  Hallmarking: "हॉलमार्किंग",
  Food: "खाद्य",
  "Pipes & plumbing": "पाइप और प्लंबिंग",
  Plywood: "प्लाईवुड",
  "Fire safety": "अग्नि सुरक्षा",
  Solar: "सौर ऊर्जा",
  "EV charging": "EV चार्जिंग",
  Furniture: "फ़र्नीचर",
  Footwear: "जूते-चप्पल",
  Textiles: "वस्त्र",
  "Pumps & motors": "पंप और मोटर",
  Agriculture: "कृषि",
  Batteries: "बैटरी",
  "Chemicals, plastics & rubber": "रसायन, प्लास्टिक और रबर",
  "What specific type of product is it?": "यह किस प्रकार का उत्पाद है?",
  "LED Bulb / Luminaire": "LED बल्ब / ल्यूमिनेयर",
  "Ceiling Fan": "छत का पंखा",
  "Room Heater": "रूम हीटर",
  Other: "अन्य",
  "Is the product intended for domestic or commercial use?": "क्या उत्पाद घरेलू उपयोग के लिए है या व्यावसायिक?",
  Domestic: "घरेलू",
  Commercial: "व्यावसायिक",
  Both: "दोनों",
  "What is the primary use of the helmet?": "हेलमेट का मुख्य उपयोग क्या है?",
  "Two-wheeler rider": "दोपहिया चालक",
  "Industrial safety": "औद्योगिक सुरक्षा",
  "Fire fighting": "अग्निशमन",
  Sports: "खेल",
  "Does it have a face shield?": "क्या इसमें फ़ेस शील्ड है?",
  Yes: "हाँ",
  No: "नहीं",
  "Is this product manufactured in India?": "क्या यह उत्पाद भारत में बनता है?",
  "Self-Ballasted LED Lamps for General Lighting Services": "सामान्य प्रकाश सेवाओं के लिए सेल्फ़-बैलास्टेड LED लैंप",
  "Compulsory Registration Scheme (CRS)": "अनिवार्य पंजीकरण योजना (CRS)",
  "Apply for CRS": "CRS के लिए आवेदन करें",
  "Protective Helmets for Two Wheeler Riders": "दोपहिया चालकों के लिए सुरक्षात्मक हेलमेट",
  "ISI Mark Scheme (Scheme-I)": "ISI मार्क योजना (Scheme-I)",
  "Apply for ISI Mark": "ISI मार्क के लिए आवेदन करें",
  "View Scheme Details": "योजना का विवरण देखें",
};

// Mock results based on selections
const getMockResult = (category: string, answers: string[]) => {
  if (category === "Household electrical" && answers[0] === "LED Bulb / Luminaire") {
    return {
      isCode: "IS 16102 (Part 1):2012",
      title: "Self-Ballasted LED Lamps for General Lighting Services",
      scheme: "Compulsory Registration Scheme (CRS)",
      actionLabel: "Apply for CRS",
      generic: false,
    };
  }
  if (category === "Helmets & PPE" && answers[0] === "Two-wheeler rider") {
    return {
      isCode: "IS 4151:2015",
      title: "Protective Helmets for Two Wheeler Riders",
      scheme: "ISI Mark Scheme (Scheme-I)",
      actionLabel: "Apply for ISI Mark",
      generic: false,
    };
  }
  // Generic fallback
  return {
    isCode: "IS 12345:2024",
    title: `General Specification for ${category} Products`,
    scheme: "ISI Mark Scheme (Scheme-I)",
    actionLabel: "View Scheme Details",
    generic: true,
  };
};

export default function WizardFlow() {
  const { t, language } = useLanguage();
  // The demo data is written in English; this shows it in Hindi when chosen.
  const tr = (text: string) => (language === "hi" ? WIZARD_HI[text] ?? text : text);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Answers to step 2 questions
  const [answers, setAnswers] = useState<string[]>([]);

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setAnswers([]);
    setStep(2);
  };

  const handleAnswerSelect = (answer: string, questionIndex: number) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = answer;
    setAnswers(newAnswers);

    const questions = MOCK_QUESTIONS[selectedCategory || ""] || [
      { q: "Is this product manufactured in India?", options: ["Yes", "No"] }
    ];

    if (newAnswers.filter(Boolean).length === questions.length) {
      setStep(3);
    }
  };

  const handleStartOver = () => {
    setStep(1);
    setSelectedCategory(null);
    setAnswers([]);
  };

  const currentQuestions = MOCK_QUESTIONS[selectedCategory || ""] || [
    { q: "Is this product manufactured in India?", options: ["Yes", "No"] }
  ];

  const result = step === 3 ? getMockResult(selectedCategory!, answers) : null;

  return (
    <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      
      {/* Progress Bar */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 1 ? 'bg-[var(--color-navy)] text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
          <span className={`text-sm font-medium ${step >= 1 ? 'text-gray-900' : 'text-gray-500'}`}>{t("wiz.stepCategory")}</span>
          
          <div className={`w-8 h-px mx-2 ${step >= 2 ? 'bg-[var(--color-navy)]' : 'bg-gray-300'}`} />
          
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-[var(--color-navy)] text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
          <span className={`text-sm font-medium ${step >= 2 ? 'text-gray-900' : 'text-gray-500'}`}>{t("wiz.stepDetails")}</span>
          
          <div className={`w-8 h-px mx-2 ${step >= 3 ? 'bg-[var(--color-navy)]' : 'bg-gray-300'}`} />
          
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 3 ? 'bg-[var(--color-navy)] text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
          <span className={`text-sm font-medium ${step === 3 ? 'text-gray-900' : 'text-gray-500'}`}>{t("wiz.stepResult")}</span>
        </div>
        
        {step > 1 && (
          <button 
            onClick={handleStartOver}
            className="text-sm font-medium text-gray-500 hover:text-gray-900 focus:outline-none focus:underline"
          >
            {t("wiz.startOver")}
          </button>
        )}
      </div>

      {/* Step 1: Category Selection */}
      {step === 1 && (
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">{t("wiz.q1")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => handleCategorySelect(category)}
                className="text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-[var(--color-navy)] hover:bg-[var(--color-navy-lighter)] hover:text-[var(--color-navy)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] text-sm font-medium text-gray-700 shadow-sm"
              >
                {tr(category)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Refining Questions */}
      {step === 2 && (
        <div className="p-6 max-w-2xl mx-auto w-full">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">{fill(t("wiz.more"), { cat: tr(selectedCategory ?? "") })}</h2>
          
          <div className="space-y-8">
            {currentQuestions.map((q, qIndex) => (
              <div key={qIndex} className="bg-gray-50 p-5 rounded-lg border border-gray-100">
                <p className="font-medium text-gray-900 mb-3">{qIndex + 1}. {tr(q.q)}</p>
                <div className="flex flex-wrap gap-3">
                  {q.options.map(opt => (
                    <button
                      key={opt}
                      onClick={() => handleAnswerSelect(opt, qIndex)}
                      className={`px-4 py-2 rounded border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] shadow-sm ${
                        answers[qIndex] === opt 
                          ? "bg-[var(--color-navy)] text-white border-[var(--color-navy)]" 
                          : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {tr(opt)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Results */}
      {step === 3 && result && (
        <div className="p-6 md:p-10 max-w-3xl mx-auto w-full text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("wiz.identified")}</h2>
          <p className="text-gray-600 mb-8">{t("wiz.identifiedHint")}</p>
          
          <div className="bg-white text-left border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-8">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <span className="inline-flex items-center rounded border border-gray-300 bg-white px-2.5 py-1 font-mono text-sm font-semibold text-gray-800">
                {result.isCode}
              </span>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{result.generic ? fill(t("wiz.generic"), { cat: tr(selectedCategory ?? "") }) : tr(result.title)}</h3>
              <p className="text-sm text-gray-600 mb-6">{fill(t("wiz.categoryIs"), { cat: tr(selectedCategory ?? "") })}</p>
              
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-800 mb-1">{t("wiz.certification")}</p>
                <p className="text-sm text-blue-900 font-medium">{tr(result.scheme)}</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button className="px-6 py-2.5 bg-[var(--color-navy)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-navy-light)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-navy)] shadow-sm">
              {tr(result.actionLabel)}
            </button>
            <Link 
              href={`/chat?q=What are the testing requirements for ${result.isCode}?`}
              className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-navy)] shadow-sm"
            >
              {t("wiz.ask")}
            </Link>
          </div>
        </div>
      )}

    </div>
  );
}
