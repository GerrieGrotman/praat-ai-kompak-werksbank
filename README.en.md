[Afrikaans](README.md) | **English**

# Praat.ai kompak werksbank

A Chrome extension that compacts the [Praat.ai](https://praat.ai) transcription workbench so it fits on a small laptop.

## Why

Praat’s workbench is built for a large screen. On a laptop the text box is too small: the sidebar, the cards and the audio player take the space, and you have to scroll around to listen and type.

This extension clears what an experienced typist does not need. The sidebar and the big headings go away, the player becomes a short strip, and the text box gets the rest of the screen. You can play the clip and type without scrolling the page.

It does not change your words, and it does not submit anything.

## Before and after

The pictures below are from a local stand-in of the workbench (the same layout as the real page), before and after compact mode.

### 1280 × 720

Before. The text is cut off at the bottom of the box.

![Before compact mode, 1280 by 720](docs/before-1280x720.png)

After. The text fits, and the buttons stay on screen.

![After compact mode, 1280 by 720](docs/after-1280x720.png)

### 1366 × 768

![Before, 1366 by 768](docs/before-1366x768.png)

![After, 1366 by 768](docs/after-1366x768.png)

### 1920 × 1080

On a large screen the layout stays readable. The text box simply gets taller.

![Before, 1920 by 1080](docs/before-1920x1080.png)

![After, 1920 by 1080](docs/after-1920x1080.png)

## Features

- Runs only on job pages: `https://praat.ai/job/…`. If Praat moves to another job without a full reload, the layout still switches on.
- The left sidebar is hidden. The site’s own menu button (top left) opens navigation.
- Big headings such as “Audio Player” and “Transcription Editor” are removed. Claim status stays as a short line next to the job id.
- The waveform is short. Play, time and speed sit on one row.
- The text box fills the remaining height. The note is one line. Report, Save and Submit stay visible.
- Compact mode is on as soon as you load the extension. The icon shows a small **ON**.
- Turn it off or on from the extension’s popup, or with **Alt+Shift+C**. The choice is remembered.

## Install

You do not need a build step, or an account for this project.

1. Download the ZIP from the [releases page](https://github.com/GerrieGrotman/praat-ai-kompak-werksbank/releases/latest). The file is named `praat-ai-kompak-werksbank-1.0.1-cws.zip`.
2. Unzip it. Select the folder that contains `manifest.json` directly.
3. Open Chrome. Type `chrome://extensions` in the address bar and press Enter.
4. Turn **Developer mode** on. It is the switch at the top right. In Afrikaans Chrome it is labelled **Ontwikkelaarmodus**.
5. Click **Load unpacked**. In Afrikaans Chrome: **Laai uitgepak**.
6. Select the folder that contains `manifest.json` directly. In this source tree that folder is `praat-ai-kompak-werksbank`.
7. Open a transcription job: `https://praat.ai/job/…`

The page should already look compact.

If you download the whole source instead (Code → Download ZIP on GitHub), unzip it and select the *inner* folder named `praat-ai-kompak-werksbank`.

Pin it so it is easy to find: click the puzzle-piece icon in Chrome, then the pin next to **Praat.ai kompak werksbank**.

The same steps are in `praat-ai-kompak-werksbank/INSTALL.txt`, inside the folder you load.

## Use

- Click the extension icon and use the switch to turn compact mode off or on.
- Or, while a job is open, press **Alt+Shift+C**.
- If the shortcut does nothing the first time, open `chrome://extensions/shortcuts`. Find **Toggle compact transcription layout** and set it to Alt+Shift+C.

Other Praat pages, such as the dashboard, stay as they are. If you go from the dashboard to a job without a full page reload, compact mode still turns on.

## How it works, and its limits

The extension runs only on `https://praat.ai/job/*`. It changes only how the page is laid out on your screen. It does not read your text in order to send it anywhere, and it does not click Save or Submit. Praat’s own buttons, shortcuts and play control keep working.

Praat may change its page later. If something looks wrong, turn compact mode off and reload the page. A new version of the extension may be needed. See [CHANGELOG.md](CHANGELOG.md).

The waveform is drawn by Praat’s own player. Compact mode only makes the outer box 52 pixels tall and scales the drawing so the bars stay visible.

## Development and testing

There is no build step. Load the `praat-ai-kompak-werksbank` folder in Chrome as above.

The real site needs an account, so `test/mock-job.html` reproduces the page, with WaveSurfer for the waveform. From this project folder:

```bash
python3 -m http.server 8741
```

Open [the mock job](http://127.0.0.1:8741/test/mock-job.html). Add `?compact=0` to the address to see the original spacing. Alt+Shift+C toggles the layout. The preview does not upload audio or submit a transcript.

To measure the layout automatically you need Chrome and Node:

```bash
cd test
npm install
node verify.mjs
```

It checks 1280×720, 1366×768 and 1920×1080: no page scrolling, a large text box, and a waveform whose bars stay visible.

| Path | What it is |
| --- | --- |
| `praat-ai-kompak-werksbank/` | The extension. Load this folder in Chrome. |
| `praat-ai-kompak-werksbank/content.css` | The compact layout. |
| `praat-ai-kompak-werksbank/content.js` | Turns the layout on for `/job/` pages and follows Praat’s in-page navigation. |
| `praat-ai-kompak-werksbank/popup.html` | The on/off switch. |
| `test/mock-job.html` | A stand-in for the job page. |
| `test/verify.mjs` | Measures the stand-in. |
| `docs/` | Before-and-after pictures. |

The choice is stored in `chrome.storage`, and also in the page’s `localStorage` under `praat-compact-enabled`, so the layout is already right when the job opens.

## Licence

MIT. See [LICENSE](LICENSE).

## Privacy

The extension collects no personal data. The on/off choice stays on this computer. See [PRIVACY.md](PRIVACY.md).

## Disclaimer

This is an unofficial project. It is not affiliated with Praat, Solidariteit or AfriForum, and it is not made or endorsed by them.
