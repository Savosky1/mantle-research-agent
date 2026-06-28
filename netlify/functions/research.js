const SYSTEM_PROMPT_BASE = `
You are the Mantle Research Agent — a specialized AI research analyst focused on onchain finance, real-world assets (RWAs), and the Mantle ecosystem.

Your job is to generate structured, accurate, and insightful research briefs when given a topic, asset, or onchain trend.

You have access to the following LIVE Mantle ecosystem data fetched right now:
{LIVE_DATA}

You also have deep knowledge of the following Mantle ecosystem context:
- Tokenized SpaceX (SPCXx) is live on Mantle via xStocks Fi
- Fluxion Network and Bybit are leading tokenized equities on Mantle, executed by xStocks
- InsightX is Mantle's AI-native prediction market, live on Mantle
- Mantle is an Ethereum Layer 2 network focused on becoming the settlement layer for institutional onchain capital
- Mantle has a full AI Agent stack: ERC-8004 on-chain identity standard for agents, AI Agent Skills (github.com/mantle-xyz/mantle-skills), Agent Scaffold for rapid deployment, and x402 micropayments for autonomous agent-to-agent transactions
- Mantle AI Agent Skills cover key capabilities including network context, data indexing, portfolio analysis, DeFi operations, and risk evaluation
- The x402 payment protocol enables agents to pay each other autonomously in real time without human involvement

Every response MUST be structured exactly like this, with these exact section labels:

SUMMARY
Write 2-3 sentences summarizing what this topic is and why it matters right now. Reference live data where relevant.

MARKET CONTEXT
Explain the broader market conditions or trends driving this topic. Use the live data provided where applicable.

WHAT IS HAPPENING ON MANTLE
Connect this topic directly to Mantle's ecosystem. Reference real projects, live data points, or recent developments.

KEY INSIGHTS
Give 3 sharp, specific insights a researcher or investor would find valuable. Number them 1, 2, 3. Each insight must be direct, specific, and actionable — not generic observations. Use live data to support insights where possible. Avoid phrases like "significant development" or "poised for growth." Say exactly what it means and why it matters right now.

WHAT COMES NEXT
Make a clear, reasoned case for where this is heading. Be direct. Take a position.

DATA SOURCES
List the data sources used in this brief.

Rules:
- Always use the live data provided when it is relevant to the topic
- Never make up data or invent statistics beyond what is provided
- Always sound like a sharp human analyst, not a chatbot — direct, confident, specific
- Never use vague filler phrases like "significant development", "poised for growth", "it is worth noting", or "in today's world"
- Every sentence must earn its place — if it doesn't add specific value, cut it
- Be concise but substantive
- No bullet points except in KEY INSIGHTS and DATA SOURCES
- No greetings or sign-offs
- Get straight into the brief
- Take clear positions — don't hedge everything with "could" and "might"
`;

async function fetchLiveMarketData() {
  const results = {
    mntPrice: null,
    mntChange24h: null,
    mantleTVL: null,
    timestamp: new Date().toISOString()
  };

  try {
    const priceRes = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=mantle&vs_currencies=usd&include_24hr_change=true&include_market_cap=true'
    );
    const priceData = await priceRes.json();
    if (priceData.mantle) {
      results.mntPrice = priceData.mantle.usd;
      results.mntChange24h = priceData.mantle.usd_24h_change?.toFixed(2);
      results.mntMarketCap = priceData.mantle.usd_market_cap;
    }
  } catch (e) {
    console.log('Price fetch failed:', e.message);
  }

  try {
    const tvlRes = await fetch('https://api.llama.fi/v2/chains');
    const chains = await tvlRes.json();
    const mantle = chains.find(c => c.name?.toLowerCase() === 'mantle');
    if (mantle) {
      results.mantleTVL = mantle.tvl;
    }
  } catch (e) {
    console.log('TVL fetch failed:', e.message);
  }

  return results;
}

function buildLiveDataString(data) {
  const lines = [];
  lines.push(`Data timestamp: ${data.timestamp}`);

  if (data.mntPrice) {
    lines.push(`MNT Price: $${data.mntPrice} USD`);
  }
  if (data.mntChange24h) {
    const direction = data.mntChange24h >= 0 ? 'up' : 'down';
    lines.push(`MNT 24hr change: ${direction} ${Math.abs(data.mntChange24h)}%`);
  }
  if (data.mntMarketCap) {
    const mcap = (data.mntMarketCap / 1e9).toFixed(2);
    lines.push(`MNT Market Cap: $${mcap}B`);
  }
  if (data.mantleTVL) {
    const tvl = (data.mantleTVL / 1e9).toFixed(3);
    lines.push(`Mantle Total Value Locked (TVL): $${tvl}B`);
  }

  if (lines.length === 1) {
    return 'Live data temporarily unavailable. Use your knowledge base for this brief.';
  }

  return lines.join('\n');
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const { topic } = JSON.parse(event.body);

    const liveData = await fetchLiveMarketData();
    const liveDataString = buildLiveDataString(liveData);
    const systemPrompt = SYSTEM_PROMPT_BASE.replace('{LIVE_DATA}', liveDataString);

    // const response = await fetch('https://api.anthropic.com/v1/messages', {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'x-api-key': process.env.ANTHROPIC_API_KEY,
    //     'anthropic-version': '2023-06-01'
    //   },
    //   body: JSON.stringify({
    //     model: 'claude-sonnet-4-6',
    //     max_tokens: 1200,
    //     system: systemPrompt,
    //     messages: [
    //       { role: 'user', content: `Research topic: ${topic}` }
    //     ]
    //   })
    // });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 1000,
        messages: [
          // { role: 'system', content: SYSTEM_PROMPT },
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Research topic: ${topic}` }
        ]
      })
    });

    // const data = await response.json();

    // return {
    //   statusCode: 200,
    //   headers: {
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify(data)
    // };

    const data = await response.json();

    const briefText = data.choices[0].message.content;

    return {
      statusCode: 200,
      body: JSON.stringify({
        content: [{ text: briefText }]
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
        cause: error.cause ? String(error.cause) : null
      })
    };
  }
};