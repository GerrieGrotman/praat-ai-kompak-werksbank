/* Badge + keyboard shortcut. The content script applies the layout. */

const BADGE_COLOR = "#f2552a";

function paintBadge(on) {
  chrome.action.setBadgeText({ text: on ? "ON" : "" });
  chrome.action.setBadgeBackgroundColor({ color: BADGE_COLOR });
  if (chrome.action.setBadgeTextColor) {
    chrome.action.setBadgeTextColor({ color: "#ffffff" });
  }
}

function readAndPaint() {
  chrome.storage.local.get({ compactEnabled: true }, (data) => {
    paintBadge(data.compactEnabled !== false);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get({ compactEnabled: null }, (data) => {
    if (data.compactEnabled === null) {
      chrome.storage.local.set({ compactEnabled: true }, readAndPaint);
    } else {
      readAndPaint();
    }
  });
});

chrome.runtime.onStartup.addListener(readAndPaint);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.compactEnabled) {
    paintBadge(!!changes.compactEnabled.newValue);
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== "toggle-compact") return;
  chrome.storage.local.get({ compactEnabled: true, toggledAt: 0 }, (data) => {
    const now = Date.now();
    /* If the page also saw this key, it toggles first and stamps toggledAt. */
    if (now - (data.toggledAt || 0) < 350) return;
    chrome.storage.local.set({
      compactEnabled: !data.compactEnabled,
      toggledAt: now,
    });
  });
});
