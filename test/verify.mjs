import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

const CHROME = "/usr/local/bin/google-chrome";
const BASE = process.env.MOCK_URL || "http://127.0.0.1:8741/test/mock-job.html";
const OUT = "/opt/cursor/artifacts";
fs.mkdirSync(OUT, { recursive: true });

const viewports = [
  { w: 1280, h: 720, name: "1280x720" },
  { w: 1366, h: 768, name: "1366x768" },
  { w: 1920, h: 1080, name: "1920x1080" },
];

function assert(cond, message, dump) {
  if (!cond) {
    const extra = dump ? "\n" + JSON.stringify(dump, null, 2) : "";
    throw new Error(message + extra);
  }
}

async function measure(page) {
  return page.evaluate(() => {
    const q = (sel) => document.querySelector(sel);
    const text = q("textarea[data-praat='text'], #transcript");
    const note = q("#note");
    const play = q("[data-play-button='true']");
    const submit = [...document.querySelectorAll("button")].find((b) => /submit|dien in/i.test(b.textContent || ""));
    const save = [...document.querySelectorAll("button")].find((b) => /save draft|stoor konsep/i.test(b.textContent || ""));
    const report = [...document.querySelectorAll("button")].find((b) => /report issue|rapporteer/i.test(b.textContent || ""));
    const stamp = [...document.querySelectorAll("button")].find((b) => /timestamp|tydstempel/i.test(b.textContent || ""));
    const shortcuts = [...document.querySelectorAll("button")].find((b) => /shortcut|sleutelbord/i.test(b.textContent || ""));
    const speed = q("[data-speed='1']");
    const menu = q("[data-slot='sheet-trigger']");
    const aside = q("aside[role='navigation']");
    const audioHeader = q("[data-praat='audio-card'] [data-slot='card-header'], main [data-slot='card']:has([data-play-button='true']) > [data-slot='card-header']");
    const editorHeader = q("[data-praat='editor-card'] [data-slot='card-header'], main [data-slot='card']:has(textarea) > [data-slot='card-header']");
    const shell = q(".h-dvh");
    const inner = q("#job-slot");
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top: Math.round(r.top),
        left: Math.round(r.left),
        bottom: Math.round(r.bottom),
        right: Math.round(r.right),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    };
    const shown = (el) => {
      if (!el) return false;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return s.display !== "none" && s.visibility !== "hidden" && r.width > 1 && r.height > 1;
    };
    const inView = (el) => {
      if (!shown(el)) return false;
      const r = el.getBoundingClientRect();
      return r.top >= -1 && r.left >= -1 && r.bottom <= window.innerHeight + 1 && r.right <= window.innerWidth + 1;
    };
    const canScroll = (el) => {
      if (!el) return false;
      const y = el.scrollTop;
      const x = el.scrollLeft;
      el.scrollTop = y + 80;
      el.scrollLeft = x + 80;
      const moved = el.scrollTop > y + 1 || el.scrollLeft > x + 1;
      el.scrollTop = y;
      el.scrollLeft = x;
      return moved;
    };
    const se = document.scrollingElement;
    const hit = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const node = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (!node) return "none";
      const owner = node.closest("button, textarea, a, [data-play-button]") || node;
      return owner === el || el.contains(node) || node.contains(el);
    };
    return {
      compact: document.documentElement.classList.contains("praat-compact"),
      viewport: { w: window.innerWidth, h: window.innerHeight },
      pageCanScroll: canScroll(se),
      shellCanScroll: canScroll(shell),
      innerCanScroll: canScroll(inner),
      textCanScroll: text ? text.scrollHeight > text.clientHeight + 2 : null,
      textClient: text ? text.clientHeight : 0,
      textScroll: text ? text.scrollHeight : 0,
      noteClient: note ? note.clientHeight : 0,
      pageScrollW: se.scrollWidth,
      pageClientW: se.clientWidth,
      sidebarShown: shown(aside),
      menuShown: shown(menu),
      audioHeaderShown: shown(audioHeader),
      editorHeaderShown: shown(editorHeader),
      inView: {
        play: inView(play),
        submit: inView(submit),
        save: inView(save),
        report: inView(report),
        stamp: inView(stamp),
        shortcuts: inView(shortcuts),
        speed: inView(speed),
        text: inView(text),
        note: inView(note),
        menu: inView(menu),
      },
      hit: {
        play: hit(play),
        submit: hit(submit),
        stamp: hit(stamp),
        speed: hit(speed),
        text: hit(text),
        note: hit(note),
      },
      rect: {
        text: rect(text),
        note: rect(note),
        play: rect(play),
        submit: rect(submit),
        editor: rect(q("[data-praat='editor-card']")),
        audio: rect(q("[data-praat='audio-card']")),
        inner: rect(inner),
      },
      display: {
        mainInner: inner ? getComputedStyle(inner).display : null,
        editor: q("[data-praat='editor-card']") ? getComputedStyle(q("[data-praat='editor-card']")).gridArea : null,
        editorH: q("[data-praat='editor-card']") ? getComputedStyle(q("[data-praat='editor-card']")).height : null,
      },
    };
  });
}

async function waitReady(page) {
  await page.waitForFunction(() => {
    const play = document.querySelector("[data-play-button='true']");
    const host = document.querySelector("#wave");
    const inner = host && host.firstElementChild;
    const canvas = inner && inner.shadowRoot && inner.shadowRoot.querySelector("canvas");
    if (!play || !canvas || canvas.width < 10) return false;
    const radius = parseFloat(getComputedStyle(play).borderTopLeftRadius);
    return radius > 8;
  }, { timeout: 20000 });
  await page.evaluate(() => document.fonts.ready);
}

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
});

const report = { viewports: {}, checks: [] };
const failures = [];

function check(name, cond, dump) {
  report.checks.push({ name, ok: !!cond });
  if (!cond) failures.push(name + (dump ? " " + JSON.stringify(dump) : ""));
}

try {
  for (const vp of viewports) {
    const page = await browser.newPage();
    await page.setViewport({ width: vp.w, height: vp.h, deviceScaleFactor: 1 });
    await page.evaluateOnNewDocument(() => localStorage.setItem("praat-compact-enabled", "0"));
    await page.goto(BASE, { waitUntil: "networkidle0", timeout: 30000 });
    await waitReady(page);
    const before = await measure(page);
    await page.screenshot({ path: path.join(OUT, `before-${vp.name}.png`) });
    await page.evaluate(() => window.__praatCompact.setEnabled(true));
    await page.waitForFunction(() => {
      if (!document.documentElement.classList.contains("praat-compact")) return false;
      const box = document.querySelector("[data-praat='waveform']");
      const inner = box && box.firstElementChild;
      const canvas = inner && inner.shadowRoot && inner.shadowRoot.querySelector("canvas");
      if (!box || !canvas) return false;
      const outer = box.getBoundingClientRect();
      const painted = canvas.getBoundingClientRect();
      return outer.height >= 48 && outer.height <= 56 && painted.height >= 46 && Math.abs(painted.width - outer.width) < 16;
    }, { timeout: 4000 });
    const after = await measure(page);
    const wave = await page.evaluate(() => {
      const box = document.querySelector("[data-praat='waveform']");
      const inner = box && box.firstElementChild;
      const canvas = inner && inner.shadowRoot && inner.shadowRoot.querySelector("canvas");
      const visual = inner ? inner.getBoundingClientRect() : null;
      const outer = box ? box.getBoundingClientRect() : null;
      const painted = canvas ? canvas.getBoundingClientRect() : null;
      let orange = 0;
      if (canvas) {
        try {
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          const w = Math.min(canvas.width, 600);
          const h = canvas.height;
          const data = ctx.getImageData(0, 0, w, h).data;
          for (let i = 0; i < data.length; i += 16) {
            if (data[i] > 180 && data[i + 1] > 80 && data[i + 2] < 140 && data[i + 3] > 200) orange += 1;
          }
        } catch (err) {
          orange = -1;
        }
      }
      return {
        boxH: outer ? Math.round(outer.height) : 0,
        boxW: outer ? Math.round(outer.width) : 0,
        visualH: visual ? Math.round(visual.height) : 0,
        paintedW: painted ? Math.round(painted.width) : 0,
        canvasCss: canvas ? Math.round(parseFloat(getComputedStyle(canvas).height)) : 0,
        orange,
      };
    });
    after.wave = wave;
    await page.screenshot({ path: path.join(OUT, `after-${vp.name}.png`) });
    report.viewports[vp.name] = { before, after };

    const minText = vp.h >= 1000 ? 460 : vp.h >= 750 ? 300 : 280;
    check(`${vp.name} compact class`, after.compact === true, after);
    check(`${vp.name} page does not scroll`, after.pageCanScroll === false && after.shellCanScroll === false && after.innerCanScroll === false, after);
    check(`${vp.name} no horizontal overflow`, after.pageScrollW <= after.pageClientW + 1, after);
    check(`${vp.name} sidebar hidden`, after.sidebarShown === false, after);
    check(`${vp.name} menu reachable`, after.menuShown === true && after.inView.menu === true, after);
    check(`${vp.name} headers hidden`, after.audioHeaderShown === false && after.editorHeaderShown === false, after);
    check(`${vp.name} controls in view`, Object.values(after.inView).every(Boolean), after.inView);
    check(`${vp.name} controls hittable`, Object.values(after.hit).every(Boolean), after.hit);
    check(`${vp.name} text fills`, after.textClient >= minText, { textClient: after.textClient, minText, rect: after.rect });
    check(`${vp.name} text taller than before`, after.textClient >= before.textClient + 80, { before: before.textClient, after: after.textClient });
    check(`${vp.name} sample text fits`, after.textCanScroll === false, { client: after.textClient, scroll: after.textScroll });
    check(`${vp.name} note stays short`, after.noteClient <= 40, { noteClient: after.noteClient });
    check(`${vp.name} waveform box is compact`, wave.boxH >= 48 && wave.boxH <= 56, wave);
    check(`${vp.name} waveform bars stay visible`, wave.visualH >= 46 && wave.visualH <= wave.boxH + 2 && wave.canvasCss >= 48 && Math.abs(wave.paintedW - wave.boxW) < 16, wave);
    check(`${vp.name} waveform painted orange bars`, wave.orange !== 0, wave);
    check(`${vp.name} before was the roomy desktop layout`, before.sidebarShown === true && before.compact === false, before);
    await page.close();
  }

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => localStorage.setItem("praat-compact-enabled", "1"));
  await page.goto(BASE, { waitUntil: "networkidle0", timeout: 30000 });
  await waitReady(page);
  await page.waitForFunction(() => document.documentElement.classList.contains("praat-compact"));

  const clicked = await page.evaluate(() => {
    const play = document.querySelector("[data-play-button='true']");
    play.click();
    const playing = play.getAttribute("aria-pressed") === "true";
    document.querySelector("[data-seek='5']").click();
    const time = document.querySelector("#time-label").textContent;
    document.querySelector("[data-speed='1.5']").click();
    const rate = document.querySelector("[data-speed='1.5']").getAttribute("aria-pressed") === "true";
    const area = document.querySelector("#transcript");
    area.focus();
    area.selectionStart = area.selectionEnd = area.value.length;
    const before = area.value;
    document.querySelector("[data-action='timestamp']").click();
    const stamped = area.value.endsWith("[0:05] ") || area.value.includes("[0:05]");
    area.value = before;
    document.querySelector("[data-action='shortcuts']").click();
    const panel = document.querySelector("#shortcuts");
    const pr = panel.getBoundingClientRect();
    const shortcutsOpen = !panel.hidden && pr.top >= 0 && pr.bottom <= window.innerHeight && pr.left >= 0 && pr.right <= window.innerWidth;
    document.querySelector("[data-action='save']").click();
    const saved = document.querySelector("#status").textContent;
    document.querySelector("[data-action='submit']").click();
    const submitted = document.querySelector("#status").textContent;
    const stillThere = document.querySelector("#transcript").value === before;
    document.querySelector("[data-action='report']").click();
    const report = document.querySelector("#report");
    const reportArea = document.querySelector("#report-text");
    const reportOpen = !report.hidden;
    const reportH = reportArea.getBoundingClientRect().height;
    document.querySelector("[data-action='close-report']").click();
    document.querySelector("[data-action='menu']").click();
    const menuOpen = !document.querySelector("#nav-sheet").hidden;
    document.querySelector("[data-action='close-menu']").click();
    return { playing, time, rate, stamped, shortcutsOpen, saved, submitted, stillThere, reportOpen, reportH, menuOpen, valueKept: stillThere };
  });
  check("play toggles", clicked.playing === true, clicked);
  check("seek updates time", clicked.time === "0:05 / 1:00", clicked);
  check("speed selects", clicked.rate === true, clicked);
  check("timestamp inserts", clicked.stamped === true, clicked);
  check("shortcuts panel on screen", clicked.shortcutsOpen === true, clicked);
  check("save does not submit", /nothing was sent/i.test(clicked.saved), clicked);
  check("submit stays local", /not submitted/i.test(clicked.submitted) && clicked.stillThere === true, clicked);
  check("report dialog usable", clicked.reportOpen === true && clicked.reportH > 40 && clicked.reportH < 220, clicked);
  check("menu opens", clicked.menuOpen === true, clicked);

  await page.focus("#transcript");
  await page.keyboard.type(" hallo");
  const typed = await page.evaluate(() => document.querySelector("#transcript").value.endsWith(" hallo"));
  check("typing works", typed === true);

  const pressed = await page.evaluate(() => document.querySelector("[data-play-button='true']").getAttribute("aria-pressed"));
  await page.keyboard.press("Space");
  const stillPlaying = await page.evaluate(() => document.querySelector("[data-play-button='true']").getAttribute("aria-pressed"));
  check("space in the text box does not toggle play", pressed === stillPlaying, { pressed, stillPlaying });

  await page.keyboard.down("Alt");
  await page.keyboard.down("Shift");
  await page.keyboard.press("KeyC");
  await page.keyboard.up("Shift");
  await page.keyboard.up("Alt");
  await page.waitForFunction(() => !document.documentElement.classList.contains("praat-compact"));
  const sidebarBack = await page.evaluate(() => getComputedStyle(document.querySelector("aside")).display !== "none");
  check("shortcut turns compact off and sidebar returns", sidebarBack === true);

  await page.keyboard.down("Alt");
  await page.keyboard.down("Shift");
  await page.keyboard.press("KeyC");
  await page.keyboard.up("Shift");
  await page.keyboard.up("Alt");
  await page.waitForFunction(() => document.documentElement.classList.contains("praat-compact"));
  check("shortcut turns compact on", true);

  await page.evaluate(() => {
    document.getElementById("report").hidden = true;
    document.getElementById("nav-sheet").hidden = true;
    document.getElementById("shortcuts").hidden = true;
    window.__mock.applyLang("af");
  });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const af = await measure(page);
  await page.screenshot({ path: path.join(OUT, "after-1280x720-afrikaans.png") });
  const afTitle = await page.evaluate(() => document.querySelector("[data-praat='audio-card'] [data-slot='card-title']").textContent);
  check("afrikaans titles do not bring headers back", af.audioHeaderShown === false && af.editorHeaderShown === false && afTitle === "Oudiospeler", { afTitle, headers: [af.audioHeaderShown, af.editorHeaderShown] });
  check("afrikaans layout still fits", af.pageCanScroll === false && af.textClient >= 280 && af.inView.submit && af.inView.play, af);
  await page.evaluate(() => document.querySelector("[data-action='timestamp']").click());
  const afStamp = await page.evaluate(() => /tydstempel/i.test(document.querySelector("[data-action='timestamp']").textContent));
  check("afrikaans timestamp button still present", afStamp === true);

  await page.evaluate(() => { location.hash = "#dashboard"; });
  await page.waitForFunction(() => !document.documentElement.classList.contains("praat-compact") && /dashboard/i.test(document.querySelector("main h1")?.textContent || ""));
  const dashSidebar = await page.evaluate(() => getComputedStyle(document.querySelector("aside")).display !== "none");
  check("leaving the job page restores the normal shell", dashSidebar === true);

  await page.evaluate(() => { location.hash = "#job"; });
  await page.waitForFunction(() => document.documentElement.classList.contains("praat-compact") && !!document.querySelector("#transcript"));
  const restored = await page.evaluate(() => document.querySelector("#transcript").value.includes("Goeie môre") && document.querySelector("#transcript").value.includes("hallo"));
  check("returning to the job keeps the transcript", restored === true);
  const back = await measure(page);
  check("job layout comes back", back.sidebarShown === false && back.textClient >= 280 && back.pageCanScroll === false, back);

  await page.close();

  const popup = await browser.newPage();
  await popup.setViewport({ width: 360, height: 280, deviceScaleFactor: 2 });
  await popup.goto("http://127.0.0.1:8741/praat-ai-kompak-werksbank/popup.html", { waitUntil: "networkidle0" });
  const body = await popup.$("body");
  await body.screenshot({ path: path.join(OUT, "popup.png") });
  await popup.click("#toggle");
  const off = await popup.evaluate(() => document.getElementById("toggle").getAttribute("aria-checked") === "false" && /off/.test(document.getElementById("state").textContent));
  check("popup toggles off", off === true);
  await popup.click("#toggle");
  const on = await popup.evaluate(() => document.getElementById("toggle").getAttribute("aria-checked") === "true");
  check("popup toggles on", on === true);
  await popup.close();
} catch (err) {
  failures.push(err.stack || err.message);
} finally {
  fs.writeFileSync(path.join(OUT, "layout-measurements.json"), JSON.stringify({ report, failures }, null, 2));
  await browser.close();
}

if (failures.length) {
  console.error("FAILED\n" + failures.join("\n\n"));
  process.exit(1);
}
console.log("All checks passed");
console.log(JSON.stringify(report.viewports, null, 2).slice(0, 4000));
