# airboard
airboard as a chrome extension for webex in the browser (macOS)

## good stuff
☝️ draw or stamp
✌️ hover w/out drawing
🤏 grab, drag, and reposition text
🖐️ erase ink

## MediaPipe Hands
### adjust folders accordingly
```cd ~/Desktop
mkdir -p webex-air-whiteboard/mediapipe
cd webex-air-whiteboard
curl -L https://registry.npmjs.org/@mediapipe/hands/-/hands-0.4.1675469240.tgz -o hands.tgz
tar -xzf hands.tgz
cp package/* mediapipe/
rm -rf package hands.tgz```

## fonts
### if your webex-air-whiteboard folder is on your desktop
### you can pick your fonts - here are three
```cd ~/Desktop/webex-air-whiteboard
mkdir -p fonts
curl -L "https://fonts.gstatic.com/s/lato/v24/S6u9w4BMUTPHh6UVSwiPGQ3q5d0.woff2" -o fonts/Lato-Bold.woff2
curl -L "https://fonts.gstatic.com/s/comfortaa/v45/1Pt_g8LJRfWJmhDAuUsSQamb1W0lwk4S4Y_LDrMfIA.woff2" -o fonts/Comfortaa-Bold.woff2
curl -L "https://fonts.gstatic.com/s/plusjakartasans/v8/L0hebDFMVAiXo2bf05H34JcI9_2N2M4.woff2" -o fonts/GoogleSans-Bold.woff2```

## file structure
webex-air-whiteboard/
```├── manifest.json
├── injector.js
├── tracker.js
├── sandbox.html
├── fonts/
│   ├── Lato-Bold.woff2
│   ├── Comfortaa-Bold.woff2
│   └── GoogleSans-Bold.woff2
└── mediapipe/
    ├── hands.js
    ├── hands_solution_packed_assets.data
    ├── hands_solution_simd_wasm_bin.js
    └── hands_solution_simd_wasm_bin.wasm```

## chrome extension
- chrome://extensions/
- toggle Developer mode to ON
- click Load unpacked
- select your webex-air-whiteboard folder and click Select / Open
- you should see Webex Air Whiteboard 1.3 appear in your list of installed extensions
- test in webex in browser
