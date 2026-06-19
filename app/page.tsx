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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const anyWindow = window as any;
      const SpeechRecognition =
        anyWindow.SpeechRecognition || anyWindow.webkitSpeechRecognition;

      if (!SpeechRecognition) {
        console.log("Speech Recognition not supported");
        return;
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

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

      rec.onerror = (error: any) => {
        console.error("Speech Recognition Error Type:", error.error);
        if (error.error !== "no-speech") {
          setIsListening(false);
        }
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
    }
  }, [chatHistory, language]);

  const startRecording = () => {
    if (!recognitionRef.current) {
      alert("Speech Recognition is not supported");
      return;
    }

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          messages: [...chatHistory, { role: "user", content: text }],
          language: language
        }),
      });

      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let completeText: string = "";

      const updatedHistory: ChatMessage[] = [
        ...chatHistory,
        { role: "user", content: text }
      ];
      setChatHistory(updatedHistory);

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        completeText += chunk;
      }

      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: completeText }
      ]);

      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance();
        utterance.text = String(completeText);

        const getVoice = () => {
          const voices = window.speechSynthesis.getVoices();
          
          if (language === "urdu") {
            const desi = voices.find((v) => 
              v.lang.includes("hi-IN") || v.lang.includes("en-IN") || v.name.toLowerCase().includes("swara")
            );
            if (desi) return desi;
          } else {
            const eng = voices.find((v) => 
              v.lang.includes("en-US") && (v.name.toLowerCase().includes("zira") || v.name.toLowerCase().includes("female"))
            );
            if (eng) return eng;
          }
          return null; 
        };

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);

        const chosenVoice = getVoice();
        if (chosenVoice) {
          utterance.voice = chosenVoice;
        }

        window.speechSynthesis.speak(utterance);
      }

    } catch (error) {
      console.error("Streaming Error:", error);
      setIsSpeaking(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 sm:p-12 md:p-24 bg-gradient-to-tr from-gray-950 via-purple-950 to-neutral-950 text-white select-none relative overflow-x-hidden">
      
      {/* Top Navigation Controls - Fully Responsive Header Stack */}
      <div className="w-full max-w-5xl flex flex-col sm:flex-row gap-4 justify-between items-center z-20 mb-8 sm:mb-0">
        {/* Minimal Language Switcher Toggle */}
        <div className="flex bg-black/40 backdrop-blur-md border border-purple-900/40 p-1 rounded-xl shadow-xl w-full sm:w-auto justify-center">
          <button
            onClick={() => setLanguage("english")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-bold font-mono transition-all duration-300 ${
              language === "english"
                ? "bg-purple-600 text-white shadow-lg shadow-purple-500/20"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            English Mode
          </button>
          <button
            onClick={() => setLanguage("urdu")}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-bold font-mono transition-all duration-300 ${
              language === "urdu"
                ? "bg-fuchsia-700 text-white shadow-lg shadow-fuchsia-500/20"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            Roman Urdu
          </button>
        </div>

        {/* Script Logs Action Trigger */}
        <button
          onClick={() => setShowHistoryModal(true)}
          className="w-full sm:w-auto bg-black/30 hover:bg-purple-900/20 border border-purple-900/40 px-5 py-2 rounded-xl text-xs uppercase tracking-widest font-bold font-mono transition-all duration-300 shadow-md text-purple-300 hover:text-purple-100"
        >
          Get Whole Chat
        </button>
      </div>

      {/* Main Container Core */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md z-10 my-auto">
        {/* Dynamic Typography Section */}
        <div className="text-center mb-10">
          <h1 className="text-5xl sm:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white via-purple-200 to-purple-500 drop-shadow-sm">
            JEEUTY
          </h1>
          <p className="text-xs sm:text-sm tracking-widest font-mono text-purple-400/80 mt-2 uppercase font-medium">
            By Muhammad Areeb
          </p>
        </div>

        {/* Minimal Central State Core Mechanism */}
        <div className="relative flex items-center justify-center mb-12">
          <button
            onClick={startRecording}
            disabled={isListening}
            className={`relative z-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full font-mono text-xs uppercase tracking-widest font-black flex flex-col items-center justify-center transition-all duration-500 shadow-2xl border ${
              isListening
                ? "bg-red-950/80 text-red-400 border-red-500/50 scale-105 cursor-not-allowed shadow-red-500/10"
                : "bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 border-purple-500/30 hover:border-purple-400/60 active:scale-95 shadow-purple-500/5"
            }`}
          >
            <span>
              {isListening ? "Listening" : "Tap To Talk"}
            </span>
          </button>

          {/* Clean Minimal Pulse Waveforms */}
          {isListening && (
            <div className="absolute w-36 h-36 sm:w-40 sm:h-40 rounded-full border border-red-500/30 opacity-40 animate-ping" />
          )}
        </div>

        {/* Dynamic Minimal Waveform Terminal Interface */}
        <div className="h-20 flex items-center justify-center w-full bg-black/40 backdrop-blur-md border border-purple-900/30 rounded-2xl p-4 shadow-2xl">
          {isSpeaking ? (
            <div className="flex items-end gap-1.5 h-8">
              <div className="w-1 bg-purple-400 rounded-full animate-[bounce_1s_infinite_100ms]" style={{ height: "60%" }}></div>
              <div className="w-1 bg-purple-500 rounded-full animate-[bounce_1s_infinite_300ms]" style={{ height: "100%" }}></div>
              <div className="w-1 bg-fuchsia-400 rounded-full animate-[bounce_1s_infinite_200ms]" style={{ height: "45%" }}></div>
              <div className="w-1 bg-purple-400 rounded-full animate-[bounce_1s_infinite_400ms]" style={{ height: "80%" }}></div>
              <div className="w-1 bg-fuchsia-500 rounded-full animate-[bounce_1s_infinite_150ms]" style={{ height: "55%" }}></div>
            </div>
          ) : (
            <p className="text-gray-500 font-mono tracking-widest text-xs uppercase font-medium">
              {isListening ? "Processing Audio..." : "System Standby"}
            </p>
          )}
        </div>

        {/* Minimal Streaming Raw Text Render */}
        {transcript && (
          <div className="mt-6 w-full text-center bg-purple-950/20 border border-purple-900/20 px-4 py-2.5 rounded-xl text-xs text-purple-300/90 font-mono max-w-sm overflow-hidden text-ellipsis whitespace-nowrap">
            <span className="text-purple-400 font-bold uppercase tracking-wider mr-1">You:</span> "{transcript}"
          </div>
        )}
      </div>

      {/* Empty Footer Spacer for Perfect Vertical Alignment */}
      <div className="h-4 w-full z-0 hidden sm:block"></div>

      {/* MINIMAL PURPLE CHAT STORAGE MODAL INTERFACE */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-neutral-950 border border-purple-900/40 w-full max-w-xl rounded-2xl shadow-2xl flex flex-col max-h-[75vh]">
            <div className="p-5 border-b border-purple-900/30 flex justify-between items-center bg-purple-950/10">
              <h2 className="text-sm font-bold text-purple-400 font-mono uppercase tracking-widest">Chat Session Scripts</h2>
              <button 
                onClick={() => setShowHistoryModal(false)}
                className="text-gray-500 hover:text-white transition-colors font-mono text-xs uppercase p-1"
              >
                Close
              </button>
            </div>
            
            <div className="p-5 overflow-y-auto flex flex-col gap-4 font-mono text-xs">
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
                className="bg-purple-700 hover:bg-purple-600 text-white font-mono text-xs uppercase tracking-widest px-5 py-2.5 rounded-lg font-bold transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}