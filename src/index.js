
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return json({ error: "Use POST to send an AI request." }, 405);
    }

    if (!env.AI) {
      return json({ error: "AI binding is missing. Enable Workers AI for this Worker." }, 500);
    }

    try {
      const body = await request.json();

      if (body.action === "chat") {
        if (!Array.isArray(body.messages) || body.messages.length === 0) {
          return json({ error: "Please send a message." }, 400);
        }

        const messages = body.messages
          .filter(m =>
            m &&
            ["user", "assistant"].includes(m.role) &&
            typeof m.content === "string"
          )
          .slice(-12)
          .map(m => ({
            role: m.role,
            content: m.content.slice(0, 4000)
          }));

        if (!messages.length || messages[messages.length - 1].role !== "user") {
          return json({ error: "The latest message must be from the user." }, 400);
        }

        const result = await env.AI.run(
          "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
          {
            messages: [
              {
                role: "system",
                content: "You are PixelMind AI, a helpful, creative, friendly assistant. Help users explore ideas, write fiction, learn, and create. Be honest when you are uncertain. Follow applicable safety requirements."
              },
              ...messages
            ],
            max_tokens: 1000
          }
        );

        return json({ reply: result.response || "I couldn't create a reply. Please try again." });
      }

      if (body.action === "image") {
        if (typeof body.prompt !== "string" || !body.prompt.trim()) {
          return json({ error: "Enter an image description first." }, 400);
        }

        const result = await env.AI.run(
          "@cf/black-forest-labs/flux-1-schnell",
          {
            prompt: body.prompt.trim().slice(0, 1500)
          }
        );

        if (!result.image) {
          return json({ error: "The image model did not return an image." }, 502);
        }

        return json({ image: result.image });
      }

      return json({ error: "Unknown action. Use chat or image." }, 400);
    } catch (error) {
      return json({
        error: "AI request failed. Check your model availability, AI binding, and usage limits."
      }, 500);
    }
  }
};
