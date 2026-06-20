"use client";

import { useState, useEffect, useRef } from "react";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [language, setLanguage] = useState<"english" | "urdu">("english");
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const recognitionRef = useRef<any>(null);

  // CRITICAL FIX: Jab bhi language change ho, chalne wali speech ko immediately cancel karo
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, [language]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const anyWindow = window as any;
      const SpeechRecognition =
        anyWindow.SpeechRecognition || anyWindow.webkitSpeechRecognition;

      if (!SpeechRecognition) return;

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      
      // CRITICAL FIX: Audio listening language switch dynamically
      rec.lang = language === "urdu" ? "ur-PK" : "en-US";

      let finalTranscript = "";
      let silenceTimer: any = null;

      rec.onresult = async (event: any) => {
        if (silenceTimer) clearTimeout(silenceTimer);

        let interimTranscript = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript + " ";
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const currentText = finalTranscript + interimTranscript;
        setTranscript(currentText);

        silenceTimer = setTimeout(async () => {
          if (currentText.trim()) {
            rec.stop();
            setIsListening(false);
            await streamAIResponse(currentText.trim());
          }
        }, 2500);
      };

      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);

      recognitionRef.current = rec;
    }
  }, [chatHistory, language]);

  const startRecording = () => {
    if (!recognitionRef.current) return;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setTranscript("");
    setIsSpeaking(false);
    setIsListening(true);
    recognitionRef.current.start();
  };

  const streamAIResponse = async (text: string) => {
    try {
      const res = await fetch("/api/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          messages: [...chatHistory, { role: "user", content: text }],
          language: language
        }),
      });

      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let completeText: string = "";

      setChatHistory((prev) => [...prev, { role: "user", content: text }]);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        completeText += decoder.decode(value);
      }

      setChatHistory((prev) => [...prev, { role: "assistant", content: completeText }]);

      if (typeof window !== "undefined" && window.speechSynthesis) {
        // CRITICAL FIX: Speak logic se pehle state clean up aur fresh execution
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance();
        utterance.text = String(completeText);
        
        // CRITICAL FIX: Target real Urdu-Pakistan instead of hi-IN Hindi
        utterance.lang = language === "urdu" ? "ur-PK" : "en-US";

        const getVoice = () => {
          const voices = window.speechSynthesis.getVoices();
          if (language === "urdu") {
            // Priority 1: Proper Urdu Voice, Priority 2: Google/Default Hindi/Urdu localization fallback
            return voices.find((v) => v.lang.includes("ur-PK") || v.name.toLowerCase().includes("urdu")) 
              || voices.find((v) => v.lang.includes("hi-IN") || v.lang.startsWith("ur") || v.lang.startsWith("hi")) 
              || null;
          } else {
            return voices.find((v) => 
              v.lang.includes("en-US") && 
              (v.name.toLowerCase().includes("zira") || 
               v.name.toLowerCase().includes("female") ||
               v.name.toLowerCase().includes("samantha") ||
               v.name.toLowerCase().includes("google us english"))
            ) || voices.find((v) => v.lang.startsWith("en")) || null;
          }
        };

        // Urdu thodi natural lagay is liye speed thodi kam (0.95), English 1.0 standard
        utterance.rate = language === "urdu" ? 0.95 : 1.0;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        const chosenVoice = getVoice();
        if (chosenVoice) utterance.voice = chosenVoice;
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      setIsSpeaking(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 sm:p-12 md:py-20 bg-gradient-to-b from-[#0a0712] via-[#0f0c1b] to-[#07050d] text-white font-sans antialiased selection:bg-purple-500/30 relative overflow-x-hidden">
      
      {/* Top Navigation Control Center */}
      <div className="w-full max-w-5xl flex justify-center sm:justify-start z-20 mb-8 sm:mb-0">
        <div className="flex bg-black/40 backdrop-blur-md border border-purple-900/20 p-1 rounded-xl shadow-xl w-auto">
          <button
            onClick={() => setLanguage("english")}
            className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              language === "english"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            English Mode
          </button>
          <button
            onClick={() => setLanguage("urdu")}
            className={`px-5 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
              language === "urdu"
                ? "bg-fuchsia-700 text-white shadow-lg shadow-fuchsia-500/20"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Urdu Mode
          </button>
        </div>
      </div>

      {/* Main Container Core */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md z-10 my-auto">
        <div className="text-center mb-10">
          <h1 className="text-5xl sm:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white via-purple-200 to-purple-400 drop-shadow-sm select-none">
            JEEUTY
          </h1>
          <p className="text-xs tracking-[0.18em] text-purple-400/80 mt-2 uppercase font-medium">
            By Muhammad Areeb Farooq
          </p>
        </div>

        {/* Central Dynamic Mic Button */}
        <div className="relative flex items-center justify-center mb-12">
          <button
            onClick={startRecording}
            disabled={isListening}
            className={`relative z-10 w-32 h-32 sm:w-36 sm:h-36 rounded-full text-xs uppercase tracking-widest font-bold flex flex-col items-center justify-center transition-all duration-500 border ${
              isListening
                ? "bg-red-950/60 text-red-400 border-red-500/40 scale-105 shadow-2xl shadow-red-500/10"
                : "bg-purple-900/30 hover:bg-purple-800/50 text-purple-200 border-purple-500/30 hover:border-purple-400/50 active:scale-95 shadow-lg shadow-purple-500/5"
            }`}
          >
            <span className="tracking-widest">
              {isListening ? "Listening" : "Tap To Talk"}
            </span>
          </button>

          {isListening ? (
            <div className="absolute w-40 h-40 sm:w-44 sm:h-44 rounded-full border border-red-500/30 opacity-40 animate-ping" />
          ) : (
            <div className="absolute w-40 h-40 sm:w-44 sm:h-44 rounded-full bg-purple-500/5 blur-xl pointer-events-none opacity-40" />
          )}
        </div>

        {/* Purple Combined Visualizer Stage */}
        <div className="h-20 flex items-center justify-center w-full bg-black/40 backdrop-blur-md border border-purple-900/20 rounded-2xl p-4 shadow-xl">
          {isSpeaking ? (
            <div className="flex items-end gap-1.5 h-8">
              {[60, 100, 45, 80, 55, 90, 40].map((h, i) => (
                <div 
                  key={i} 
                  className="w-1 bg-gradient-to-t from-purple-500 via-fuchsia-500 to-purple-400 rounded-full" 
                  style={{ 
                    height: `${h}%`,
                    animation: `bounce 1s ease-in-out infinite alternate`,
                    animationDelay: `${i * 0.08}s`
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 tracking-wider text-xs uppercase font-medium">
              {isListening ? "Processing Audio..." : "System Standby"}
            </p>
          )}
        </div>

        {transcript && (
          <div className="mt-8 w-full text-center bg-purple-950/20 border border-purple-900/20 px-5 py-3 rounded-xl text-xs text-purple-300 leading-relaxed max-w-sm overflow-hidden text-ellipsis whitespace-nowrap shadow-md">
            <span className="text-purple-400 font-bold uppercase tracking-wider mr-1.5">You:</span> "{transcript}"
          </div>
        )}
      </div>

      <div className="h-4 w-full z-0 hidden sm:block"></div>

      {/* Clean Utility Footer with Whole Chat Option Only */}
      <footer className="w-full max-w-5xl flex justify-center items-center z-20 border-t border-purple-900/20 pt-5">
        <button
          onClick={() => setShowHistoryModal(true)}
          className="bg-black/30 hover:bg-purple-900/20 border border-purple-900/40 px-5 py-2 rounded-xl text-xs uppercase tracking-widest font-bold font-mono transition-all duration-300 shadow-md text-purple-300 hover:text-purple-100"
        >
          Get Whole Chat
        </button>
      </footer>

      {/* Clean Slate Sheet (Modal) */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-950 border border-purple-900/40 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[75vh]">
            <div className="p-5 border-b border-purple-900/30 flex justify-between items-center bg-purple-950/10">
              <h2 className="text-sm font-bold text-purple-400 uppercase tracking-widest">Chat Session Scripts</h2>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-500 hover:text-white transition-colors text-xs uppercase p-1"
              >
                Close
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex flex-col gap-4 text-xs">
              {chatHistory.length === 0 ? (
                <p className="text-gray-600 italic text-center py-4 uppercase tracking-wider">No transactional logs found.</p>
              ) : (
                chatHistory.map((msg, index) => (
                  <div 
                    key={index} 
                    className={`p-3.5 rounded-xl max-w-[90%] border ${
                      msg.role === "user" 
                        ? "bg-purple-950/20 border-purple-800/30 self-end text-right text-purple-200" 
                        : "bg-black/40 border-neutral-800 self-start text-left text-gray-300"
                    }`}
                  >
                    <strong className={`block text-[10px] uppercase tracking-widest mb-1 ${msg.role === "user" ? "text-purple-400" : "text-neutral-400"}`}>
                      {msg.role === "user" ? "Client" : "Jeeuty"}
                    </strong>
                    <p className="leading-relaxed">{msg.content}</p>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-4 border-t border-purple-900/20 text-right bg-purple-950/5">
              <button
                onClick={() => setShowHistoryModal(false)}
                className="bg-purple-700 hover:bg-purple-600 text-white font-bold tracking-widest text-xs uppercase px-5 py-2.5 rounded-lg transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded Animation Layer */}
      <style jsx global>{`
        @keyframes bounce {
          0% { transform: scaleY(0.3); }
          100% { transform: scaleY(1); }
        }
      `}</style>
    </main>
  );
}