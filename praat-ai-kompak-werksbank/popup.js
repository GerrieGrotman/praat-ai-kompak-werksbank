const toggle = document.getElementById("toggle");
const state = document.getElementById("state");
const hasChrome = typeof chrome !== "undefined" && !!chrome.storage?.local;
const LS_KEY = "praat-compact-enabled";

function paint(on) {
  toggle.setAttribute("aria-checked", on ? "true" : "false");
  state.textContent = on ? "Compact mode is on" : "Compact mode is off";
}

function read(callback) {
  if (hasChrome) {
    chrome.storage.local.get({ compactEnabled: true }, (data) => {
      callback(data.compactEnabled !== false);
    });
    return;
  }
  const raw = localStorage.getItem(LS_KEY);
  callback(raw === null ? true : raw === "1");
}

function write(on) {
  if (hasChrome) {
    chrome.storage.local.set({ compactEnabled: on, toggledAt: Date.now() });
  } else {
    localStorage.setItem(LS_KEY, on ? "1" : "0");
  }
  paint(on);
}

read(paint);

toggle.addEventListener("click", () => {
  write(toggle.getAttribute("aria-checked") !== "true");
});
