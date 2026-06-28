// ========================
// SESSION QUERY LIMIT (TIME-BASED)
// ========================
const RESET_HOURS = 24;
let queriesLeft = 20;
let resetAt = 0;

function initSession() {
  const saved = localStorage.getItem('mra-session');
  const now = Date.now();

  if (saved) {
    const session = JSON.parse(saved);
    if (now < session.resetAt) {
      queriesLeft = session.queriesLeft;
      resetAt = session.resetAt;
    } else {
      startNewSession();
    }
  } else {
    startNewSession();
  }

  updateCounter();
}

function startNewSession() {
  queriesLeft = 20;
  resetAt = Date.now() + (RESET_HOURS * 60 * 60 * 1000);
  saveSession();
}

function saveSession() {
  localStorage.setItem('mra-session', JSON.stringify({
    queriesLeft: queriesLeft,
    resetAt: resetAt
  }));
}

function updateCounter() {
  document.getElementById('queries-left').textContent = queriesLeft;
}

// ========================
// FILL PROMPT FROM PILLS
// ========================
function fillPrompt(text) {
  document.getElementById('research-input').value = text;
  document.getElementById('research-input').focus();
}

// ========================


// ========================
// RENDER OUTPUT
// ========================

function renderBrief(text) {
  const sections = [
    { key: 'SUMMARY', label: 'Summary', icon: '📋' },
    { key: 'MARKET CONTEXT', label: 'Market Context', icon: '📈' },
    { key: 'WHAT IS HAPPENING ON MANTLE', label: 'What Is Happening on Mantle', icon: '⛓️' },
    { key: 'KEY INSIGHTS', label: 'Key Insights', icon: '💡' },
    { key: 'WHAT COMES NEXT', label: 'What Comes Next', icon: '🔭' },
    { key: 'DATA SOURCES', label: 'Data Sources', icon: '🔗' }
  ];

  let html = '<div class="brief-grid">';

  sections.forEach((section, index) => {
    const nextKey = sections[index + 1] ? sections[index + 1].key : null;
    let content = '';

    const startIndex = text.indexOf(section.key);
    if (startIndex === -1) return;

    const contentStart = startIndex + section.key.length;

    if (nextKey) {
      const endIndex = text.indexOf(nextKey);
      content = endIndex !== -1
        ? text.substring(contentStart, endIndex).trim()
        : text.substring(contentStart).trim();
    } else {
      content = text.substring(contentStart).trim();
    }

    if (content) {
      const isWide = section.key === 'SUMMARY' ||
                     section.key === 'WHAT COMES NEXT' ||
                     section.key === 'DATA SOURCES';

      html += `
        <div class="brief-card ${isWide ? 'brief-card-wide' : ''}">
          <div class="brief-card-header">
            <span class="brief-card-icon">${section.icon}</span>
            <h3>${section.label}</h3>
          </div>
          <div class="brief-card-body">
            ${content.replace(/\n/g, '<br/>')}
          </div>
        </div>
      `;
    }
  });

  html += '</div>';
  return html;
}

// ========================
// MAIN RESEARCH FUNCTION
// ========================
async function runResearch() {
  const input = document.getElementById('research-input').value.trim();

  if (!input) {
    alert('Please enter a research topic first.');
    return;
  }

  if (queriesLeft <= 0) {
    alert('You have used all 5 research queries for this session.');
    return;
  }

 // Decrement counter
  queriesLeft--;
  saveSession();
  updateCounter();

  // Disable button
  const btn = document.getElementById('research-btn');
  btn.disabled = true;
  btn.textContent = 'Researching...';

  // Show output section with loading
  const outputSection = document.getElementById('output-section');
  const outputBody = document.getElementById('output-body');

  outputSection.style.display = 'block';
  outputBody.innerHTML = `
    <div class="loading">
      <p>Generating your research brief</p>
      <div class="loading-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;

  // Scroll to output
  outputSection.scrollIntoView({ behavior: 'smooth' });

  try {
    const response = await fetch('/.netlify/functions/research', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ topic: input })
    });

    const data = await response.json();
    console.log('API response:', data);

    if (data.content && data.content[0]) {
      const briefText = data.content[0].text;
      outputBody.innerHTML = renderBrief(briefText);
    } else {
      outputBody.innerHTML = '<p style="color: var(--grey);">Something went wrong. Please try again.</p>';
    }

  } catch (error) {
    console.log('Full error:', error);
    outputBody.innerHTML = '<p style="color: var(--grey);">Connection error. Please check your setup and try again.</p>';
  }

  // Re-enable button
  btn.disabled = false;
  btn.textContent = 'Research';
}

// ========================
// COPY BRIEF
// ========================
function copyBrief() {
  const outputBody = document.getElementById('output-body');
  const text = outputBody.innerText;

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.btn-copy');
    btn.textContent = 'Copied!';
    setTimeout(() => {
      btn.textContent = 'Copy Brief';
    }, 2000);
  });
}

initSession();

// ========================
// LIVE ONCHAIN DATA
// ========================
async function fetchLiveData() {
  fetchMNTPrice();
  fetchMantleTVL();
}

async function fetchMNTPrice() {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=mantle&vs_currencies=usd&include_24hr_change=true'
    );
    const data = await response.json();

    if (data.mantle) {
      const price = data.mantle.usd.toFixed(4);
      const change = data.mantle.usd_24h_change.toFixed(2);
      const sign = change >= 0 ? '+' : '';
      const color = change >= 0 ? 'var(--green)' : '#ff6b6b';

      document.getElementById('mnt-price').innerHTML =
        `$${price} <span style="font-size:0.75rem; color:${color}">${sign}${change}%</span>`;
    }
  } catch (error) {
    document.getElementById('mnt-price').textContent = 'Unavailable';
  }
}

async function fetchMantleTVL() {
  try {
    const response = await fetch('https://api.llama.fi/v2/chains');
    const chains = await response.json();

    const mantle = chains.find(chain =>
      chain.name && chain.name.toLowerCase() === 'mantle'
    );

    if (mantle && mantle.tvl) {
      const formatted = (mantle.tvl / 1e9).toFixed(2);
      document.getElementById('mantle-tvl').textContent = `$${formatted}B`;
    } else {
      document.getElementById('mantle-tvl').textContent = 'Unavailable';
    }
  } catch (error) {
    document.getElementById('mantle-tvl').textContent = 'Unavailable';
  }
}

// Fetch on page load, refresh every 5 minutes
fetchLiveData();
setInterval(fetchLiveData, 5 * 60 * 1000);