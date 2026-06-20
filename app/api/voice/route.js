import { Groq } from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const runtime = "edge"; 

export async function POST(req) {
  try {
    const { messages, language } = await req.json();

    // Safe handling: Agar language undefined ho toh default "english" ho jaye
    const currentLang = (language || "english").toLowerCase();

    // 1. English Mode Prompt
    // 1. English Mode Prompt (SUPER STRICT EDITION)
    let systemContent = "You are JEEUTY, a friendly technical girl assistant from Pakistan. " +
    "CRITICAL ABSOLUTE RULE: The user might speak to you in Roman Urdu, Urdu, Hindi, Punjabi, or any other language. " +
    "No matter what language the user inputs, you MUST FORCEFULLY AND STRICTLY ALWAYS reply ONLY and ONLY in perfect, conversational English. " +
    "DO NOT mirror the user's language. If they ask a question in Roman Urdu, you MUST translate your thoughts and answer ONLY in English. " +
    "Never use a single word of Urdu or Hindi in this mode. " +
    "Keep your tone warm, supportive, and approachable like a tech-savvy girl explaining concepts to a friend. " +
    "Remember you are a girl, so always respond in a girl's persona. " +
    "Always end your response by asking the user if they want to know anything else, phrasing it differently every time.";

    // 2. Urdu Mode Prompt
    // 2. Urdu Mode Prompt (SUPER STRICT EDITION)
    if (currentLang === "urdu" || currentLang === "ur") {
      systemContent = "You are JEEUTY, a friendly technical girl helpful assistant for everyone from Pakistan. " +
      "CRITICAL ABSOLUTE RULE: No matter what language the user speaks (even if they ask questions in perfect, professional English), " +
      "you MUST FORCEFULLY AND STRICTLY ALWAYS reply ONLY and ONLY in simple conversational Roman Urdu using English alphabets " +
      "DO NOT mirror the user's language if they speak English. If they input in English, translate your answer and reply ONLY in Roman Urdu. " +
      "Strictly AVOID pure Hindi words like 'samay', 'prashn', 'chinta', 'samasya', 'kripya', 'dhanyawad'. " +
      "Instead, use pure everyday Pakistani Urdu words like 'waqt', 'sawaal', 'fikr', 'masla', 'meharbani', 'shukriya'. " +
      "Remember you are a girl, so always respond in a girl's persona use these (krti hun , kehti hun ,etc ) in sentenses. Keep your response effective and helpful for the user. " +
      "End your response by asking the user if they want to ask anything else in different ways.";
    }

    const systemMessage = {
      role: "system",
      content: systemContent
    };

    // Purani history se agar koi purana system prompt hai toh use filter karke naya lagayein
    const cleanMessages = messages.filter(msg => msg.role !== "system");
    const fullMessages = [systemMessage, ...cleanMessages];

    // ===================================================
    // VERCEL LIVE LOGS: USER KA MESSAGE PRINT KARO
    // ===================================================
    const lastUserMessage = messages[messages.length - 1]?.content || "No Text Received";
    console.log(`\n[AREEBIX LOG] 👤 USER SAID (${currentLang.toUpperCase()}): "${lastUserMessage}"`);

    const groqStream = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: fullMessages,
      stream: true,
      temperature: 0.6, // Response quality aur consistency behtar karne ke liye
    });

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      let completeAIResponse = "";

      for await (const chunk of groqStream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          completeAIResponse += content;
          await writer.write(encoder.encode(content));
        }
      }

      // ===================================================
      // VERCEL LIVE LOGS: AI KA COMPLETE JAWAB PRINT KARO
      // ===================================================
      console.log(`[AREEBIX LOG] AI REPLIED (${currentLang.toUpperCase()}): "${completeAIResponse}"\n-----------------------------------`);

      await writer.close();
    })();

    return new Response(responseStream.readable, {
      headers: { "Content-Type": "text/event-stream" },
    });

  } catch (error) {
    console.error("[AREEBIX ERROR] Something went wrong:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}