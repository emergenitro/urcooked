import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini';

const SYSTEM_PROMPT = `You are a brutally honest, funny, and specific code critic roasting a developer's GitHub profile. You have been given structured data about their GitHub account. Your job is to roast them.

Rules:
- Be specific. Reference actual repo names, languages, gaps, star counts, follower numbers. No generic roasts that could apply to anyone.
- Be funny, not mean. Punch hard but keep it playful. Aim for laughs, not tears.
- Keep it to 6-9 lines maximum. VERY short punchy lines, one thought per line. Each line under 100 characters.
- No bullet points, no numbered lists, no markdown formatting (no asterisks, no backticks, no hashes). Plain text only.
- No em dashes anywhere. Use commas, periods, or parentheses instead.
- Simple, direct observations. Think twitter one-liners, not paragraphs.
- End with one backhanded compliment.
- Do not say "I" or refer to yourself. Just deliver the roast.
- The first line is the most savage, quotable one-liner. Self-contained, under 140 chars, no quotation marks. This will be used as the share preview.
- Do not address the developer in second person at the start of the first line. Make the first line work as a standalone tweetable observation.
- Output the roast and nothing else. No preamble, no "here's your roast:", no closing remarks.`;

/**
 * Build the user prompt with the structured GitHub data.
 */
function buildUserPrompt(githubData) {
  return `Roast this developer based on their GitHub profile:\n\n${JSON.stringify(githubData, null, 2)}`;
}

/**
 * Stream the roast to a writable (Express response). Calls onChunk for each
 * delta so the route can also accumulate the full text for storage.
 * Returns the full roast text once streaming completes.
 */
export async function streamRoast(githubData, onChunk) {
  const stream = await client.chat.completions.create({
    model: MODEL,
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(githubData) },
    ],
  });

  let full = '';
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content || '';
    if (delta) {
      full += delta;
      onChunk(delta);
    }
  }
  return full;
}

/**
 * Non-streaming roast for browser clients. Awaits the whole response.
 */
export async function generateRoast(githubData) {
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(githubData) },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() || '';
}

/**
 * First non-empty line of a roast, used as the share preview / tweet text.
 */
export function extractPreviewLine(roastText) {
  const lines = roastText.split('\n').map((l) => l.trim()).filter(Boolean);
  return lines[0] || '';
}

const BATTLE_SYSTEM_PROMPT = `You are a brutally honest judge presiding over a head-to-head GitHub profile battle. You have been given two developer profiles. Your job is to deliver a comparative roast - savage observations about BOTH profiles - then declare a winner.

Rules:
- Be specific. Reference actual repo names, star counts, activity gaps, languages from each profile. Name each developer by their username.
- Roast both hard. No one gets off easy.
- The winner is the LESS cooked developer (better GitHub hygiene, more active, better repos).
- 14–18 lines total. Short punchy lines, one thought per line.
- No bullet points, no numbered lists, no markdown formatting. Plain text only.
- No em dashes. Commas, periods, or parentheses only.
- First line is the most savage head-to-head comparison. Self-contained, under 140 chars.
- Final line must be exactly: WINNER: <username> (just that, nothing else on the line)
- Output the battle roast and nothing else. No preamble, no closing remarks.`;

function buildBattlePrompt(data1, data2) {
  return `Battle these two developers:\n\nPROFILE 1:\n${JSON.stringify(data1, null, 2)}\n\nPROFILE 2:\n${JSON.stringify(data2, null, 2)}`;
}

export function extractBattleWinner(roastText) {
  const lines = roastText.split('\n').map((l) => l.trim()).filter(Boolean);
  const last = lines[lines.length - 1] || '';
  const m = last.match(/^WINNER:\s*(\S+)$/i);
  return m ? m[1] : null;
}

export async function streamBattleRoast(data1, data2, onChunk) {
  const stream = await client.chat.completions.create({
    model: MODEL,
    stream: true,
    messages: [
      { role: 'system', content: BATTLE_SYSTEM_PROMPT },
      { role: 'user', content: buildBattlePrompt(data1, data2) },
    ],
  });

  let full = '';
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content || '';
    if (delta) {
      full += delta;
      onChunk(delta);
    }
  }
  return full;
}

export async function generateBattleRoast(data1, data2) {
  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: BATTLE_SYSTEM_PROMPT },
      { role: 'user', content: buildBattlePrompt(data1, data2) },
    ],
  });
  return completion.choices[0]?.message?.content?.trim() || '';
}
