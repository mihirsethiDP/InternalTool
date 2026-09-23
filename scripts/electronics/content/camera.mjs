// EZVIZ (Hikvision) CS-H6C Wi-Fi pan & tilt camera — the same unit at every
// plant. Source: "EZVIZ_H6C_Handbook - Camera.docx" (DigitalPaani, 2026),
// cross-checked with the EZVIZ H6c user manual (Jan 2022) for the LED table.

export const sections = {
  tds: `# EZVIZ H6c (CS-H6C) — at a glance

| Item | Detail |
|---|---|
| Model | CS-H6C (EZVIZ H6c) — Hikvision's EZVIZ-branded indoor Wi-Fi camera |
| Type | 360° pan & tilt indoor camera, Full HD 1080p |
| Connectivity | Wi-Fi 802.11 b/g/n — **2.4 GHz only** (does not connect to 5 GHz) — plus a wired Ethernet port on the base |
| Storage | microSD card slot (up to 256 GB) and/or optional EZVIZ CloudPlay subscription |
| App | EZVIZ app (iOS App Store / Google Play / Huawei AppGallery) |
| Cloud | Connects via EZVIZ's own cloud service — no NVR/DVR needed for basic use |
| Features | Motion detection with pan/tilt tracking, two-way audio, night vision, privacy mode (physically covers the lens from the app) |
| Bandwidth | EZVIZ recommends more than 2 Mbps **upload** per camera at the router |
| Package | Camera, base, screw kit, drill template, power cable, power adapter, quick start guide |

**Important:** this camera only supports 2.4 GHz Wi-Fi. If the network name looks the same for both bands, identify or temporarily split the 2.4 GHz network on the router before setup — most routers broadcast "MyWiFi" and "MyWiFi_5G" or similar.
`,

  install_commission: `# Connecting the camera to the EZVIZ app

Follow these steps in order the first time, or any time you re-add the camera after a factory reset.

## Step 1 — Install the app and create an account
1. On your phone, connect to the **2.4 GHz** Wi-Fi network.
2. Search "EZVIZ" in the App Store or Google Play and install it.
3. Open the app and create an EZVIZ account (email or phone number), then log in.

## Step 2 — Put the camera into pairing mode
1. Power the camera on and wait about 30 seconds.
2. Press and hold the **Reset** button (the small pinhole on the base — use a straightened paperclip or SIM tool) for 10–15 seconds. Some units say "Reset successfully".
3. Wait roughly a minute. The status light should flash **blue quickly**, or flash red/blue alternately — it is ready to pair. (Some units show no visible change — wait a minute anyway.)

## Step 3 — Add the camera in the app
1. Make sure the phone is still on 2.4 GHz Wi-Fi only.
2. In the EZVIZ app, tap **+** on the Home page to open Scan QR Code.
3. Scan the QR code on the label on the back or base of the camera.
4. Grant camera/network permissions if prompted.
5. Follow the wizard: enter the Wi-Fi name and password when asked, then wait for the app to confirm the camera has connected.
6. The camera appears on the Home page — tap it to view the live feed.

**Tip:** a camera can be linked to only one EZVIZ account at a time. If it was set up on another phone or account, remove it from that account first, or factory reset it (see Other) before adding it elsewhere.

## Finding the QR code, serial number, reset button and verification code

Every H6c has a printed label — usually on the back or underside of the base — with the **QR code**, the **serial number (S/N)** and a 6-character **Verification Code**. You need these for setup, support calls, and to reconnect manually after a reset.

Keep a photo of this label before mounting the camera somewhere hard to reach.
`,

  configure: `# Settings that matter on site

- **Wi-Fi band:** 2.4 GHz only. Setup fails silently if the phone is on 5 GHz.
- **Router:** DHCP enabled, IPv6 disabled, and no MAC/IP whitelist or blacklist blocking new devices.
- **Signal check:** in the app, Account (bottom of Home) → Settings → Device Network Tools → Check Wi-Fi Signal. Aim for above 2 Mbps upload per camera.
- **Wired fallback:** the base has an Ethernet port — a cable to the router is the most reliable connection where Wi-Fi is weak.
- **microSD card:** Class 10 or UHS-1. Format **FAT32** for cards under 64 GB, **exFAT** for 64 GB and above. Initialise from the app after inserting. By default the camera overwrites the oldest footage when the card is full.
- **Firmware and app:** keep both on the latest version (camera settings in the app) — most repeated drop-outs and SD card errors clear after an update.
- **Password format for manual reconnection:** the camera's own hotspot is named EZVIZ_<serial number> and its password is EZVIZ_<verification code> (e.g. verification code ABCDEF → password EZVIZ_ABCDEF).
`,

  troubleshoot_repair: `# Identify the symptom

## 1. App says "Device is offline"
1. Check the status light. **Solid blue or slow blue flash** usually means the camera is actually fine — refresh the Home page in the app.
2. If the light is **flashing red slowly**: reboot the Wi-Fi router first (connectivity/range), then unplug the camera, wait 10–30 seconds, plug it back in.
3. Still offline: reconfigure it — in the app open the camera's Device Settings (three-dot icon) → Wi-Fi, hold Reset a few seconds until the light flashes blue quickly, then follow the wizard to reconnect.

This is the most common issue and is almost always fixable without calling anyone.

## 2. "Incorrect device Wi-Fi password" during setup
1. Re-type the Wi-Fi password exactly — it is case-sensitive.
2. If it still fails: in the phone's Wi-Fi settings find the network **EZVIZ_<serial number>**, forget it, then reconnect manually with password **EZVIZ_<verification code>** (from the label). Return to the app and continue.
3. If the router password uses special characters, temporarily simplify it (letters and numbers only, under 64 characters) to rule that out.

## 3. Wi-Fi connection fails during pairing
1. Confirm the router itself works — turn off mobile data on the phone and check it can browse on Wi-Fi alone.
2. Make sure the phone is on the **2.4 GHz** network, not 5 GHz.
3. Check signal strength at the camera's location: Account → Settings → Device Network Tools → Check Wi-Fi Signal.
4. Weak signal: move the camera closer to the router; keep it away from walls, microwaves, washing machines and other Bluetooth/Wi-Fi devices; try a less congested Wi-Fi channel.
5. On the router: DHCP enabled, IPv6 disabled, no MAC/IP whitelist/blacklist blocking new devices.
6. If nothing helps, run an Ethernet cable from the base to the router.

## 4. Camera goes offline frequently
1. Update both the camera firmware and the EZVIZ app to the latest version.
2. Re-check Wi-Fi signal strength as above — most repeated drop-outs are a weak or congested signal, not a faulty camera.
3. Angle the router antennas differently, or add a Wi-Fi extender if the camera is far from the router.

## 5. No live view / video won't load or keeps buffering
1. Confirm the camera shows as online first (symptom 1 if not).
2. Check the phone's own internet connection.
3. Try viewing on Wi-Fi vs mobile data to isolate the phone's network from the camera's.
4. Low upload speed at the camera's router causes this — EZVIZ recommends over 2 Mbps upload per camera.

## 6. SD card not detected / "No memory card" / won't initialise
1. Update camera firmware and the app.
2. Check the card is Class 10 or UHS-1 and formatted FAT32 (under 64 GB) or exFAT (64 GB+).
3. Power off the camera, remove and reinsert the card, power on, then initialise again from the app.
4. Try a different card, or this card in another EZVIZ device, to isolate a faulty card.
5. Last resort: factory reset (see Other) and set up again.

**Recordings missing or gaps in playback:** confirm free space (oldest footage is overwritten when full); frequent Wi-Fi drop-outs also interrupt cloud recording if you use CloudPlay.

## Indicator light quick reference

| Light | Usually means |
|---|---|
| Solid red | Camera starting up |
| Solid blue / slow blue flash | Online and working — if the app says offline, refresh the Home page |
| Fast blue flash | Ready to pair — waiting for the app |
| Red/blue alternating | Also pairing mode on some units |
| Slow red flash | Wi-Fi connection failed — reboot the router, then power-cycle the camera |
| Fast red flash | Camera exception (e.g. microSD card error) |
| No light at all | Check the power supply and cable first |
`,

  other: `# Factory reset

1. Locate the pinhole **Reset** button on the base.
2. With the camera powered on, press and hold Reset for 10–15 seconds, until you hear the voice prompt (on models that have one) or the status light changes.
3. Wait about a minute for the camera to reboot to factory defaults.
4. Set it up again from Install & Commission, Step 3, as if brand new.

A factory reset erases the Wi-Fi settings and removes the camera from any account it was linked to — you must add it again from scratch.

# Where to get further help

- EZVIZ official support & FAQs: support.ezviz.com
- In-app: Account → Help & Feedback for chat/ticket support directly with EZVIZ.
- For a Hikvision-branded unit bought locally, the dealer/distributor invoice may list a local service contact — record it in the escalation directory.
`,
};

const A = (id, text, next, extra = {}) => ({ id, kind: 'action', text, next, visit: 'no_visit', skill: 'anyone', source_section: 'troubleshoot_repair', ...extra });
const Q = (id, text, options) => ({ id, kind: 'question', text, options });
const R = (id, text) => ({ id, kind: 'resolve', text });
const ESC = (id, text) => ({ id, kind: 'escalate', text, skill: 'vendor_support' });

export const flows = [
  {
    title: 'Camera shows "Device is offline" in the EZVIZ app',
    trigger_symptoms: ['camera offline', 'device is offline', 'camera not connecting', 'camera not showing', 'cctv offline', 'camera band'],
    definition: {
      start: 'light',
      nodes: [
        Q('light', 'Look at the status light on the camera. What is it doing?', [
          { label: 'Solid blue or slow blue flash', next: 'refresh' },
          { label: 'Flashing red slowly', next: 'router' },
          { label: 'No light at all', next: 'power' },
          { label: 'Fast blue / red-blue flashing', next: 'pairing' },
        ]),
        A('refresh', 'The camera is actually online. Pull down to refresh the Home page in the EZVIZ app, or close and reopen the app.', 'ok1'),
        R('ok1', 'Live view should be back. If the app still says offline after a refresh, power-cycle the camera once (unplug, wait 20 seconds, plug in).'),
        A('power', 'Check the power adapter is plugged into a live socket and the cable is firmly in the camera. Try another socket or adapter if available.', 'litnow'),
        Q('litnow', 'Does the camera light come on now?', [
          { label: 'Yes', next: 'light' },
          { label: 'Still no light', next: 'dead' },
        ]),
        ESC('dead', 'No light with a known-good power supply means the camera itself has failed. Contact EZVIZ support (support.ezviz.com or in-app Help & Feedback) with the serial number from the label, or arrange a replacement.'),
        A('router', 'Reboot the Wi-Fi router: switch it off, wait 30 seconds, switch it on, and wait two minutes for it to come back fully.', 'cycle'),
        A('cycle', 'Unplug the camera, wait 10–30 seconds, plug it back in. Wait a minute and check the app again.', 'online'),
        Q('online', 'Is the camera online in the app now?', [
          { label: 'Yes', next: 'ok2' },
          { label: 'No', next: 'reconfig' },
        ]),
        R('ok2', 'Back online. If this happens often, check the Wi-Fi signal at the camera (Account → Settings → Device Network Tools → Check Wi-Fi Signal) — repeated drops are almost always a weak signal.'),
        A('reconfig', 'Reconfigure the Wi-Fi: in the app open the camera\'s Device Settings (three-dot icon) → Wi-Fi. Hold the pinhole Reset button on the base a few seconds until the light flashes blue quickly, then follow the wizard to reconnect (phone on 2.4 GHz Wi-Fi).', 'pairing'),
        Q('pairing', 'The camera is in pairing mode. Did the app reconnect it to Wi-Fi?', [
          { label: 'Yes — it is online', next: 'ok2' },
          { label: 'No — setup keeps failing', next: 'wifi' },
        ]),
        A('wifi', 'Confirm the phone is on the 2.4 GHz network (not 5 GHz), the router has DHCP on and IPv6 off, and the signal at the camera is strong. If Wi-Fi stays unreliable, connect the base to the router with an Ethernet cable.', 'done'),
        Q('done', 'Is the camera online now?', [
          { label: 'Yes', next: 'ok2' },
          { label: 'No', next: 'help' },
        ]),
        ESC('help', 'Contact EZVIZ support (support.ezviz.com or Account → Help & Feedback in the app). Have ready: the serial number and verification code from the label, and what the status light is doing.'),
      ],
      proposed_classification: { visit_required: false, skill_required: 'anyone' },
    },
  },
  {
    title: 'Camera Wi-Fi setup or pairing fails',
    trigger_symptoms: ['wifi setup failed', 'pairing failed', 'incorrect wifi password', 'cannot add camera', 'connection failed', 'camera not pairing'],
    definition: {
      start: 'band',
      nodes: [
        A('band', 'On the phone, check which Wi-Fi network it is on. This camera only works on 2.4 GHz — if the network name ends in 5G or the router shows both bands under one name, switch the phone to the 2.4 GHz one.', 'internet'),
        A('internet', 'Turn off mobile data on the phone and confirm it can still browse the internet on Wi-Fi alone — this proves the router is working.', 'password'),
        A('password', 'Re-type the Wi-Fi password exactly (it is case-sensitive). If the router password has special characters, temporarily simplify it to letters and numbers under 64 characters.', 'retry'),
        Q('retry', 'Try adding the camera again. Did it connect?', [
          { label: 'Yes', next: 'ok' },
          { label: 'No — "incorrect device Wi-Fi password"', next: 'hotspot' },
          { label: 'No — connection fails', next: 'signal' },
        ]),
        R('ok', 'Camera added. Keep a photo of the label (serial number and verification code) before mounting it.'),
        A('hotspot', 'In the phone\'s Wi-Fi settings find the network EZVIZ_<serial number>, forget it, then reconnect to it manually using the password EZVIZ_<verification code> (the 6-character code on the camera label). Return to the EZVIZ app and continue.', 'retry2'),
        A('signal', 'Check signal strength at the camera location: in the app, Account → Settings → Device Network Tools → Check Wi-Fi Signal. If weak, move the camera closer to the router or away from walls, microwaves and other wireless devices. On the router confirm DHCP is on, IPv6 is off, and no MAC/IP filter blocks new devices.', 'retry2'),
        Q('retry2', 'Try once more. Connected?', [
          { label: 'Yes', next: 'ok' },
          { label: 'No', next: 'wired' },
        ]),
        A('wired', 'Run an Ethernet cable from the port on the camera base to the router and add the camera again — the wired path is the most reliable fallback.', 'final'),
        Q('final', 'Connected over the cable?', [
          { label: 'Yes', next: 'ok' },
          { label: 'No', next: 'help' },
        ]),
        ESC('help', 'Contact EZVIZ support (support.ezviz.com or in-app Help & Feedback) with the serial number and verification code from the label.'),
      ],
      proposed_classification: { visit_required: false, skill_required: 'anyone' },
    },
  },
  {
    title: 'Camera keeps dropping offline',
    trigger_symptoms: ['camera drops', 'goes offline frequently', 'keeps disconnecting', 'camera unstable', 'intermittent camera'],
    definition: {
      start: 'update',
      nodes: [
        A('update', 'In the EZVIZ app open the camera\'s settings and update the camera firmware to the latest version. Update the app itself from the app store too.', 'signal'),
        A('signal', 'Check the Wi-Fi signal at the camera: Account → Settings → Device Network Tools → Check Wi-Fi Signal. Most repeated drop-outs are a weak or congested signal, not a faulty camera.', 'weak'),
        Q('weak', 'Is the signal weak or the upload below 2 Mbps?', [
          { label: 'Yes — weak', next: 'improve' },
          { label: 'No — signal is strong', next: 'watch' },
        ]),
        A('improve', 'Improve the link: move the camera closer to the router, angle the router antennas, change to a less congested Wi-Fi channel, add a Wi-Fi extender — or connect the base to the router with an Ethernet cable.', 'watch'),
        R('watch', 'Watch it for a few days. If it still drops with a strong signal and current firmware, contact EZVIZ support (support.ezviz.com) with the serial number.'),
      ],
      proposed_classification: { visit_required: false, skill_required: 'anyone' },
    },
  },
  {
    title: 'Camera live view will not load or keeps buffering',
    trigger_symptoms: ['no live view', 'video not loading', 'buffering', 'video lag', 'live feed not working', 'black screen camera'],
    definition: {
      start: 'online',
      nodes: [
        Q('online', 'Does the camera show as online in the EZVIZ app?', [
          { label: 'No — it says offline', next: 'offline' },
          { label: 'Yes — online but no video', next: 'phone' },
        ]),
        R('offline', 'Pick the "Device is offline" issue first — live view cannot load while the camera is offline.'),
        A('phone', 'Check the phone\'s own internet: open any website. Then try live view on Wi-Fi and again on mobile data to see whether the phone\'s network or the camera\'s is the problem.', 'which'),
        Q('which', 'Does live view work on one of the two?', [
          { label: 'Works on mobile data, not on plant Wi-Fi', next: 'plantnet' },
          { label: 'Fails on both', next: 'upload' },
          { label: 'Works now', next: 'ok' },
        ]),
        R('plantnet', 'The plant Wi-Fi the phone is on is the bottleneck, not the camera. Use mobile data to view, or ask for the plant network to be checked.'),
        A('upload', 'Low upload speed at the camera\'s router causes buffering — EZVIZ recommends over 2 Mbps upload per camera. Check the router\'s internet plan and whether other devices are saturating it; move the camera to a wired connection if possible.', 'ok'),
        R('ok', 'Live view restored. If buffering returns at the same times each day, the internet link is congested at those hours.'),
      ],
      proposed_classification: { visit_required: false, skill_required: 'anyone' },
    },
  },
  {
    title: 'Camera microSD card not detected or will not initialise',
    trigger_symptoms: ['sd card not detected', 'no memory card', 'card error', 'recording not saving', 'initialise failed', 'memory card'],
    definition: {
      start: 'update',
      nodes: [
        A('update', 'Update the camera firmware and the EZVIZ app to the latest versions.', 'spec'),
        A('spec', 'Check the card: it must be Class 10 or UHS-1, formatted FAT32 if under 64 GB or exFAT if 64 GB or larger, and at most 256 GB.', 'reseat'),
        A('reseat', 'Power off the camera, remove and reinsert the microSD card, power on, then initialise it again from the app (camera settings → storage).', 'works'),
        Q('works', 'Is the card detected and initialised now?', [
          { label: 'Yes', next: 'ok' },
          { label: 'No', next: 'swap' },
        ]),
        R('ok', 'Recording to the card is working. Check playback once after a day to confirm footage is being saved.'),
        A('swap', 'Try a different microSD card, or test this card in another EZVIZ camera, to tell a faulty card from a faulty slot.', 'other'),
        Q('other', 'Does a different card work in this camera?', [
          { label: 'Yes — the old card was faulty', next: 'replace' },
          { label: 'No card works', next: 'reset' },
        ]),
        R('replace', 'Replace the faulty card with a Class 10 / UHS-1 card of the right format.'),
        A('reset', 'Factory reset the camera (hold the pinhole Reset on the base 10–15 seconds, wait a minute) and set it up again, then retry the card.', 'final'),
        Q('final', 'Card detected after the reset?', [
          { label: 'Yes', next: 'ok' },
          { label: 'No', next: 'help' },
        ]),
        ESC('help', 'The card slot is likely faulty. Contact EZVIZ support (support.ezviz.com or in-app Help & Feedback) with the serial number, or arrange a replacement camera.'),
      ],
      proposed_classification: { visit_required: false, skill_required: 'anyone' },
    },
  },
];

export const issues = [
  { label: 'Camera offline', aliases: ['device is offline', 'camera not connecting', 'cctv offline', 'camera not showing in app'], flows: ['Camera shows "Device is offline" in the EZVIZ app', 'Camera keeps dropping offline'] },
  { label: 'Camera setup / pairing fails', aliases: ['wifi setup failed', 'incorrect wifi password', 'cannot add camera', 'pairing failed'], flows: ['Camera Wi-Fi setup or pairing fails'] },
  { label: 'Camera keeps disconnecting', aliases: ['drops offline', 'intermittent', 'unstable camera'], flows: ['Camera keeps dropping offline'] },
  { label: 'No live view / buffering', aliases: ['video not loading', 'black screen', 'video lag', 'feed not working'], flows: ['Camera live view will not load or keeps buffering'] },
  { label: 'SD card not detected', aliases: ['no memory card', 'card error', 'recording not saving', 'memory card problem'], flows: ['Camera microSD card not detected or will not initialise'] },
];

export const contacts = [
  { make: 'EZVIZ (Hikvision)', person_name: 'EZVIZ support', contact: 'support.ezviz.com · in-app: Account → Help & Feedback', notes: 'Have the serial number and 6-character verification code from the camera label ready. Local dealer contact (from the invoice) can be added here.' },
];

export const sources = [
  { file: 'ezviz_h6c_handbook_dp.docx', text: 'ezviz_h6c_handbook_dp.txt', title: 'EZVIZ H6C Camera — Setup & Troubleshooting Handbook (DigitalPaani)', type: 'troubleshoot_repair' },
  { url: 'https://mfs.ezvizlife.com/H6c_User%20Manual_EN(V1.0.0).pdf', file: 'ezviz_h6c_user_manual_en.pdf', text: 'ezviz_h6c_user_manual_en.txt', title: 'EZVIZ H6c — User Manual (EN, v1.0.0)', type: 'install_commission' },
  { url: 'https://mfs.ezvizlife.com/H6c_QSG_EN(EU)(V1.0.0).pdf', file: 'ezviz_h6c_quick_start_en.pdf', text: 'ezviz_h6c_quick_start_en.txt', title: 'EZVIZ H6c — Quick Start Guide (EN)', type: 'install_commission' },
];
