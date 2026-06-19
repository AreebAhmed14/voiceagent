import { Groq } from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const runtime = "edge"; 

export async function POST(req) {
  try {
    const { messages, language } = await req.json(); // <-- Language state bhi receive ki

    // 1. English Mode Prompt (Urdu suno, English bolo)
    let systemContent = "You are a friendly technical girl helpful assistant. You MUST always reply in clear, professional, yet warm and conversational English, even user speaks in Urdu. Keep your tone supportive and approachable, as if explaining tech concepts to a friend. Ensure your answers are effective, well-structured, and highly helpful for the user. End every response by asking the user if they need further clarification or want to ask anything else, phrasing it in different ways each time to keep the conversation natural.";

    // 2. Hindi/Urdu Mode Prompt (Urdu suno, Roman Urdu/Karachi dialect bolo)
    if (language === "urdu") {
      systemContent = "You are a friendly technical girl helpful assistant for everyone from Pakistan. You MUST always reply in simple conversational Roman Urdu using English alphabets (e.g., 'Aapka sawaal bohot accha hai', 'Fikr mat karo, main hal nikalta hoon'). Strictly AVOID pure Hindi words like 'samay', 'prashn', 'chinta', 'samasya', 'kripya', 'dhanyawad'. Instead, use pure everyday Pakistani Urdu words like 'waqt', 'sawaal', 'fikr', 'masla', 'meharbani', 'shukriya'. Keep your response effective and helpful for the user. End your response by asking the user if they want to ask anything else in different ways.";
    }

    const systemMessage = {
      role: "system",
      content: systemContent
    };

    const fullMessages = [systemMessage, ...messages];

    // ===================================================
    // VERCEL LIVE LOGS: USER KA MESSAGE PRINT KARO
    // ===================================================
    const lastUserMessage = messages[messages.length - 1]?.content || "No Text Received";
    console.log(`\n[AREEBIX LOG] 👤 USER SAID (${language.toUpperCase()}): "${lastUserMessage}"`);

    const groqStream = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: fullMessages,
      stream: true,
    });

    const responseStream = new TransformStream();
    const writer = responseStream.writable.getWriter();
    const encoder = new TextEncoder();

    (async () => {
      let completeAIResponse = ""; // AI ka pura jawab ek sath capture karne ke liye variable

      for await (const chunk of groqStream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          completeAIResponse += content; // Har chunk ko jodte jao
          await writer.write(encoder.encode(content));
        }
      }

      // ===================================================
      // VERCEL LIVE LOGS: AI KA COMPLETE JAWAB PRINT KARO
      // ===================================================
      console.log(`[AREEBIX LOG] AI REPLIED: "${completeAIResponse}"\n-----------------------------------`);

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