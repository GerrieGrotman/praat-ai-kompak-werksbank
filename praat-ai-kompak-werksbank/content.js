/*
  Turns compact layout on for Praat job pages and keeps it on across
  Next.js client-side navigations. Does not change, move, or submit text.
*/
(function () {
  if (window.__praatCompactLoaded) return;
  window.__praatCompactLoaded = true;

  const LS_KEY = "praat-compact-enabled";
  const query = new URLSearchParams(location.search).get("compact");
  const queryLock = query === "0" || query === "1";
  const inExtension = typeof chrome !== "undefined" && !!chrome.runtime?.id;

  function isMock() {
    return document.documentElement.hasAttribute("data-praat-mock");
  }

  function isJobPage() {
    if (isMock()) {
      const hash = location.hash || "";
      return hash === "" || hash === "#" || hash.startsWith("#job");
    }
    const host = location.hostname;
    if (host !== "praat.ai" && !host.endsWith(".praat.ai")) return false;
    return /^\/job\/[^/?#]+/.test(location.pathname);
  }

  function readLocal() {
    try {
      const value = localStorage.getItem(LS_KEY);
      if (value === "0") return false;
      if (value === "1") return true;
    } catch (err) {
      /* Private mode or a page that blocks storage. Default on. */
    }
    return true;
  }

  function writeLocal(on) {
    try {
      localStorage.setItem(LS_KEY, on ? "1" : "0");
    } catch (err) {
      /* Ignore. chrome.storage is the backup inside the extension. */
    }
  }

  let enabled = query === "0" ? false : query === "1" ? true : readLocal();

  function syncClass() {
    document.documentElement.classList.toggle("praat-compact", enabled && isJobPage());
  }

  function setEnabled(on, source) {
    enabled = !!on;
    writeLocal(enabled);
    syncClass();
    reflowWaveform(true);
    if (queryLock) return;
    if (inExtension && source !== "storage") {
      chrome.storage.local.set({ compactEnabled: enabled, toggledAt: Date.now() });
    }
  }

  function directChild(ancestor, node) {
    let current = node;
    while (current && current.parentElement !== ancestor) current = current.parentElement;
    return current;
  }

  function findMainInner() {
    const main = document.querySelector("main");
    if (!main) return null;
    return (
      [...main.children].find(
        (el) => el.querySelector("h1") && (el.querySelector("[data-play-button='true']") || el.querySelector("textarea"))
      ) || [...main.children].find((el) => el.querySelector("h1"))
    );
  }

  /* display:contents on every wrapper between a card and the main column. */
  function lift(el, stop) {
    let node = el.parentElement;
    while (node && node !== stop && stop.contains(node)) {
      node.setAttribute("data-praat-lift", "");
      node = node.parentElement;
    }
  }

  function tagChrome() {
    const aside = document.querySelector('aside[role="navigation"]');
    if (aside) aside.setAttribute("data-praat", "sidebar");

    const menu = document.querySelector("[data-slot='sheet-trigger']");
    if (menu) menu.setAttribute("data-praat", "menu-btn");

    const logo = document.querySelector('img[alt="Solidariteit en Afriforum"]');
    const shell = (logo && logo.closest(".h-dvh")) || document.querySelector(".h-dvh");
    if (logo && shell) {
      let node = logo;
      while (node.parentElement && node.parentElement !== shell) node = node.parentElement;
      if (node && node !== shell) node.setAttribute("data-praat", "topbar");
    }
  }

  function tagPlayer(mainInner) {
    const play = document.querySelector("main [data-play-button='true']");
    if (!play) return false;
    const card = play.closest("[data-slot='card']");
    if (!card) return false;
    card.setAttribute("data-praat", "audio-card");
    if (mainInner) lift(card, mainInner);

    const content = card.querySelector(":scope > [data-slot='card-content']") || card;
    const speedButtons = [...content.querySelectorAll("button")].filter((button) =>
      /^\s*\d+(?:[.,]\d+)?\s*x\s*$/i.test(button.textContent || "")
    );

    let container = content;
    let transport = directChild(container, play);
    let meta = speedButtons.length ? directChild(container, speedButtons[0]) : null;
    let guard = 0;
    while (transport && meta && transport === meta && transport !== container && guard < 6) {
      container = transport;
      transport = directChild(container, play);
      meta = speedButtons.length ? directChild(container, speedButtons[0]) : null;
      guard += 1;
    }

    if (container !== content) container.setAttribute("data-praat", "audio-content");
    if (transport && transport !== meta) transport.setAttribute("data-praat", "transport");
    if (meta && meta !== transport) {
      meta.setAttribute("data-praat", "meta-row");
      [...meta.children].forEach((child) => {
        if (child.matches("button") || child.querySelector("button")) return;
        child.setAttribute("data-praat", "time");
      });
    }

    [...container.children].forEach((child) => {
      if (child === transport || child === meta) return;
      if (child.querySelector && child.querySelector("[data-play-button='true']")) return;
      child.setAttribute("data-praat", "waveform");
    });

    const jobCard = card.parentElement
      ? [...card.parentElement.children].find(
          (el) => el !== card && el.matches && el.matches("[data-slot='card']")
        )
      : null;
    if (jobCard) {
      jobCard.setAttribute("data-praat", "job-card");
      if (mainInner) lift(jobCard, mainInner);
    }
    return true;
  }

  function tagEditor(mainInner) {
    const fresh = [...document.querySelectorAll("main textarea")].filter(
      (textarea) => !textarea.closest("[role='dialog']")
    );
    if (!fresh.length) return false;

    const text = fresh[0];
    const note = fresh[1] || null;
    const card = text.closest("[data-slot='card']");
    if (!card) return false;
    card.setAttribute("data-praat", "editor-card");
    if (mainInner) lift(card, mainInner);

    const content = card.querySelector(":scope > [data-slot='card-content']") || card;
    content.setAttribute("data-praat", "editor-content");
    text.setAttribute("data-praat", "text");

    if (note && note !== text) {
      note.setAttribute("data-praat", "note-field");
      const block = directChild(content, note);
      if (block && block !== note) block.setAttribute("data-praat", "note");
    }

    const buttonRows = [...content.children].filter(
      (el) => el.querySelector && el.querySelector("button") && !el.querySelector("textarea")
    );
    if (buttonRows[0]) buttonRows[0].setAttribute("data-praat", "toolbar");
    if (buttonRows.length > 1) buttonRows[buttonRows.length - 1].setAttribute("data-praat", "actions");

    [...content.children].forEach((el) => {
      if (el === text) return;
      if (el.querySelector && (el.querySelector("button") || el.querySelector("textarea"))) return;
      el.setAttribute("data-praat", "text-label");
    });
    return true;
  }

  /*
    The waveform library (wavesurfer and similar) paints bars at its own height.
    Compact mode only shortens the outer box. If the painted wave is taller than
    that box, scale it so the whole shape stays visible instead of clipping to a
    line. A resize event lets a library that follows the container redraw.
  */
  let waveCompactState = null;
  let waveReflowTimer = 0;

  function clearWaveScale(wave) {
    [...wave.children].forEach((child) => {
      if (child.getAttribute("data-praat-wave-fit") == null && !child.style.transform) return;
      child.style.transform = "";
      child.style.transformOrigin = "";
      child.removeAttribute("data-praat-wave-fit");
    });
  }

  function fitWaveforms() {
    const compact = document.documentElement.classList.contains("praat-compact") && isJobPage();
    document.querySelectorAll("[data-praat='waveform']").forEach((wave) => {
      if (!compact) {
        clearWaveScale(wave);
        const natural = Number(wave.getAttribute("data-praat-natural") || 0);
        const inner = wave.firstElementChild;
        /* height:'auto' players adopt the compact box; give them their old height back. */
        if (natural > 60 && inner && inner.offsetHeight < natural - 8) {
          wave.style.minHeight = natural + "px";
          window.setTimeout(() => {
            wave.style.minHeight = "";
          }, 350);
        }
        return;
      }
      const target = wave.clientHeight;
      if (target < 24) return;
      [...wave.children].forEach((inner) => {
        /* offsetHeight ignores transforms, so this is the library's painted height. */
        const natural = inner.offsetHeight;
        if (natural > target + 4) {
          if (!wave.getAttribute("data-praat-natural")) {
            wave.setAttribute("data-praat-natural", String(natural));
          }
          inner.style.transformOrigin = "top center";
          inner.style.transform = "scaleY(" + target / natural + ")";
          inner.setAttribute("data-praat-wave-fit", "");
        } else if (inner.getAttribute("data-praat-wave-fit") != null) {
          inner.style.transform = "";
          inner.style.transformOrigin = "";
          inner.removeAttribute("data-praat-wave-fit");
        }
      });
    });
  }

  function reflowWaveform(force) {
    const compact = document.documentElement.classList.contains("praat-compact") && isJobPage();
    const wave = document.querySelector("[data-praat='waveform']");
    if (!wave && compact) return;
    const changed = force || compact !== waveCompactState;
    if (wave || !compact) waveCompactState = compact;
    if (changed) {
      window.dispatchEvent(new Event("resize"));
      window.clearTimeout(waveReflowTimer);
      waveReflowTimer = window.setTimeout(() => {
        window.dispatchEvent(new Event("resize"));
        fitWaveforms();
      }, 180);
    }
    fitWaveforms();
  }

  function tagAll() {
    if (!isJobPage() || !document.body) return;
    try {
      tagChrome();
      const mainInner = findMainInner();
      if (mainInner) {
        mainInner.setAttribute("data-praat", "main-inner");
        const titleRow = [...mainInner.children].find(
          (el) => el.querySelector && el.querySelector("h1") && !el.querySelector("[data-slot='card']")
        );
        if (titleRow) titleRow.setAttribute("data-praat", "title-row");
      }
      tagPlayer(mainInner);
      tagEditor(mainInner);
    } catch (err) {
      /* A half-rendered Next.js tree should not break the shortcut or observer. */
    }
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    const run = () => {
      scheduled = false;
      syncClass();
      if (isJobPage()) tagAll();
      reflowWaveform(false);
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
    else run();
  }

  syncClass();

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  let lastHref = location.href;
  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      schedule();
      return;
    }
    const want = enabled && isJobPage();
    const has = document.documentElement.classList.contains("praat-compact");
    if (want !== has) schedule();
    else if (want && !document.querySelector("textarea[data-praat='text']") && document.querySelector("main textarea")) {
      schedule();
    }
  }, 400);

  window.addEventListener("hashchange", schedule);
  window.addEventListener("popstate", schedule);
  document.addEventListener("DOMContentLoaded", schedule);

  if (inExtension && !queryLock) {
    chrome.storage.local.get({ compactEnabled: null }, (data) => {
      if (chrome.runtime.lastError || data.compactEnabled === null) {
        chrome.storage.local.set({ compactEnabled: enabled });
        return;
      }
      if (!!data.compactEnabled !== enabled) setEnabled(!!data.compactEnabled, "storage");
    });
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes.compactEnabled || queryLock) return;
      const on = !!changes.compactEnabled.newValue;
      if (on === enabled) return;
      setEnabled(on, "storage");
    });
  }

  window.addEventListener(
    "keydown",
    (event) => {
      if (event.repeat) return;
      if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return;
      if (event.code !== "KeyC") return;
      /* When the extension command is registered it swallows the key.
         If both fire, toggledAt makes the second write a no-op. */
      event.preventDefault();
      event.stopPropagation();
      const now = Date.now();
      if (inExtension) {
        chrome.storage.local.get({ compactEnabled: enabled, toggledAt: 0 }, (data) => {
          if (now - (data.toggledAt || 0) < 350) return;
          setEnabled(!data.compactEnabled, "key");
        });
        return;
      }
      setEnabled(!enabled, "key");
    },
    true
  );

  window.__praatCompact = {
    get enabled() {
      return enabled;
    },
    isJobPage,
    setEnabled: (on) => setEnabled(on, "api"),
    retag: tagAll,
  };
})();
