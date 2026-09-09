"use client";

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

// Mock results based on selections
const getMockResult = (category: string, answers: string[]) => {
  if (category === "Household electrical" && answers[0] === "LED Bulb / Luminaire") {
    return {
      isCode: "IS 16102 (Part 1):2012",
      title: "Self-Ballasted LED Lamps for General Lighting Services",
      scheme: "Compulsory Registration Scheme (CRS)",
      actionLabel: "Apply for CRS"
    };
  }
  if (category === "Helmets & PPE" && answers[0] === "Two-wheeler rider") {
    return {
      isCode: "IS 4151:2015",
      title: "Protective Helmets for Two Wheeler Riders",
      scheme: "ISI Mark Scheme (Scheme-I)",
      actionLabel: "Apply for ISI Mark"
    };
  }
  // Generic fallback
  return {
    isCode: "IS 12345:2024",
    title: `General Specification for ${category} Products`,
    scheme: "ISI Mark Scheme (Scheme-I)",
    actionLabel: "View Scheme Details"
  };
};

export default function WizardFlow() {
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
          <span className={`text-sm font-medium ${step >= 1 ? 'text-gray-900' : 'text-gray-500'}`}>Category</span>
          
          <div className={`w-8 h-px mx-2 ${step >= 2 ? 'bg-[var(--color-navy)]' : 'bg-gray-300'}`} />
          
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= 2 ? 'bg-[var(--color-navy)] text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
          <span className={`text-sm font-medium ${step >= 2 ? 'text-gray-900' : 'text-gray-500'}`}>Details</span>
          
          <div className={`w-8 h-px mx-2 ${step >= 3 ? 'bg-[var(--color-navy)]' : 'bg-gray-300'}`} />
          
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 3 ? 'bg-[var(--color-navy)] text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
          <span className={`text-sm font-medium ${step === 3 ? 'text-gray-900' : 'text-gray-500'}`}>Result</span>
        </div>
        
        {step > 1 && (
          <button 
            onClick={handleStartOver}
            className="text-sm font-medium text-gray-500 hover:text-gray-900 focus:outline-none focus:underline"
          >
            Start Over
          </button>
        )}
      </div>

      {/* Step 1: Category Selection */}
      {step === 1 && (
        <div className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">What category does your product fall under?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {CATEGORIES.map(category => (
              <button
                key={category}
                onClick={() => handleCategorySelect(category)}
                className="text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-[var(--color-navy)] hover:bg-[var(--color-navy-lighter)] hover:text-[var(--color-navy)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-navy)] text-sm font-medium text-gray-700 shadow-sm"
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Refining Questions */}
      {step === 2 && (
        <div className="p-6 max-w-2xl mx-auto w-full">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Tell us more about the product ({selectedCategory})</h2>
          
          <div className="space-y-8">
            {currentQuestions.map((q, qIndex) => (
              <div key={qIndex} className="bg-gray-50 p-5 rounded-lg border border-gray-100">
                <p className="font-medium text-gray-900 mb-3">{qIndex + 1}. {q.q}</p>
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
                      {opt}
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
          
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Standards Identified</h2>
          <p className="text-gray-600 mb-8">Based on your selections, here are the applicable requirements.</p>
          
          <div className="bg-white text-left border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-8">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <span className="inline-flex items-center rounded border border-gray-300 bg-white px-2.5 py-1 font-mono text-sm font-semibold text-gray-800">
                {result.isCode}
              </span>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">{result.title}</h3>
              <p className="text-sm text-gray-600 mb-6">Category: {selectedCategory}</p>
              
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-800 mb-1">Applicable Certification</p>
                <p className="text-sm text-blue-900 font-medium">{result.scheme}</p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button className="px-6 py-2.5 bg-[var(--color-navy)] text-white text-sm font-medium rounded-lg hover:bg-[var(--color-navy-light)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-navy)] shadow-sm">
              {result.actionLabel}
            </button>
            <Link 
              href={`/chat?q=What are the testing requirements for ${result.isCode}?`}
              className="px-6 py-2.5 bg-white text-gray-700 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-navy)] shadow-sm"
            >
              Ask Assistant
            </Link>
          </div>
        </div>
      )}

    </div>
  );
}
