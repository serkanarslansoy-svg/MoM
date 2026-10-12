# MoM — Meeting Minutes

Phone app (PWA) for the daily morning meeting: record the meeting, turn it into
text on the device, have Microsoft 365 Copilot Chat write the minutes, and keep
them in Italian and English with a searchable archive.

Free to run. Audio and text stay on the device; nothing is uploaded except what
you paste into Copilot yourself.

## How a meeting works

1. **Record.** Put the phone in the middle of the table and tap the red button.
   Keep the app open and the screen on (the app keeps it awake). The recording is
   saved in 10-second pieces, so a crash or a closed app loses at most 10 seconds;
   the next start rebuilds the file.
2. **Transcribe.** *Bu cihazda yazıya dök* runs Whisper speech recognition in the
   browser. The model downloads once (80 MB to 760 MB depending on the setting)
   and then works offline. On a computer with a graphics card the large model is
   used automatically and is much faster than real time; on a phone or a computer
   without one, the balanced model takes roughly as long as the recording.
   Alternative: share the audio file and use Word for the web → Dictate →
   Transcribe (limited to 300 minutes of uploads per month).
3. **Copilot.** Copy the ready-made prompt (template + departments + transcript)
   and paste it into Copilot Chat (m365.cloud.microsoft/chat) with your work account.
4. **Save.** Paste Copilot's answer back. The app splits the Italian and English
   parts and shows the minutes by department; copy or share either language.

Tip: record on the phone and transcribe on a PC. Import the audio file there with
*Ses dosyası içe aktar*.

## Install

The app runs from GitHub Pages. One-time setup in this repository:
**Settings → Pages → Build and deployment**: Source *Deploy from a branch*, branch `main`,
folder `/ (root)`, **Save**. After a minute it is live at

`https://serkanarslansoy-svg.github.io/MoM/`

- Android (Chrome): open the address, menu → *Install app*.
- iPhone (Safari): open the address, Share → *Add to Home Screen*.

## Settings

Departments (order of the minutes), plant name, speech model, spoken language,
microphone noise suppression, automatic deletion of old audio, and a JSON backup
of all minutes and transcripts.

## Files

- `index.html` – the app, including the 16 kHz recorder and the on-device speech
  recognition worker (transformers.js 3.7.1, Whisper). It also runs when opened as a
  local file in Chrome, but installing on a phone needs the web address.
- `sw.js`, `manifest.webmanifest`, `icons/` – install and offline support
