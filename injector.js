(function () {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

  const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

  const state = {
    enabled: true,
    autoShape: true,
    brushColor: '#00ffcc',
    brushSize: 6,
    fontSize: 48,
    fontFamily: 'Google Sans',
    pendingText: '',
    currentStroke: [],
    badges: [],
    grabbedBadge: null,
    handX: null,
    handY: null,
    mode: 'none',
    stampCooldown: false,
    camActive: false,
    fontsLoaded: false
  };

  function loadCustomFonts() {
    if (state.fontsLoaded) return;
    const extUrl = document.documentElement.dataset.airWbExtUrl;
    if (!extUrl || !window.FontFace) return;

    state.fontsLoaded = true;
    const fontDefs = [
      { name: 'Lato', file: 'fonts/Lato-Bold.woff2' },
      { name: 'Comfortaa', file: 'fonts/Comfortaa-Bold.woff2' },
      { name: 'Google Sans', file: 'fonts/GoogleSans-Bold.woff2' }
    ];

    fontDefs.forEach(({ name, file }) => {
      const font = new FontFace(name, `url(${extUrl}${file})`, { weight: '700' });
      font.load().then((loadedFace) => {
        document.fonts.add(loadedFace);
      }).catch(() => {});
    });
  }

  setInterval(loadCustomFonts, 1000);

  const inkCanvas = document.createElement('canvas');
  inkCanvas.width = 1280;
  inkCanvas.height = 720;
  const inkCtx = inkCanvas.getContext('2d');
  inkCtx.lineCap = 'round';
  inkCtx.lineJoin = 'round';

  // Listen for hand coordinates from tracker.js in this same frame
  window.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== 'AIR_WB_HAND') return;
    if (!state.enabled || !state.camActive) return;

    const { x, y, mode } = event.data;
    const canvasX = x * inkCanvas.width;
    const canvasY = y * inkCanvas.height;

    if (state.mode === 'draw' && mode !== 'draw' && state.currentStroke.length > 1) {
      commitStroke(state.currentStroke, state.brushColor, state.brushSize);
      state.currentStroke = [];
    }

    if (mode !== 'pinch') {
      state.grabbedBadge = null;
    }

    state.handX = canvasX;
    state.handY = canvasY;
    state.mode = mode;

    // 1. Air-Stamp when pointing 1 finger while text is waiting in the input box
    if (mode === 'draw' && state.pendingText.trim().length > 0) {
      if (!state.stampCooldown) {
        createBadge(canvasX, canvasY, state.pendingText.trim(), state.brushColor, state.fontSize, state.fontFamily);
        state.pendingText = '';
        const inputEl = document.getElementById('air-wb-text-input');
        if (inputEl) inputEl.value = '';
        state.stampCooldown = true;
        setTimeout(() => { state.stampCooldown = false; }, 700);
      }
      return;
    }

    // 2. Normal 1-Finger Drawing
    if (mode === 'draw' && !state.stampCooldown) {
      if (state.currentStroke.length > 0) {
        const prev = state.currentStroke[state.currentStroke.length - 1];
        const smoothX = prev.x + (canvasX - prev.x) * 0.55;
        const smoothY = prev.y + (canvasY - prev.y) * 0.55;
        state.currentStroke.push({ x: smoothX, y: smoothY });
      } else {
        state.currentStroke.push({ x: canvasX, y: canvasY });
      }
    }

    // 3. Pinch to Grab & Drag Text Badges
    if (mode === 'pinch') {
      if (!state.grabbedBadge) {
        for (let i = state.badges.length - 1; i >= 0; i--) {
          const b = state.badges[i];
          if (
            canvasX >= b.x - b.w / 2 - 25 &&
            canvasX <= b.x + b.w / 2 + 25 &&
            canvasY >= b.y - b.h / 2 - 25 &&
            canvasY <= b.y + b.h / 2 + 25
          ) {
            state.grabbedBadge = b;
            break;
          }
        }
      }
      if (state.grabbedBadge) {
        state.grabbedBadge.x = canvasX;
        state.grabbedBadge.y = canvasY;
      }
    }

    // 4. Open-Palm Eraser
    if (mode === 'erase') {
      const eraseRadius = 55;
      inkCtx.save();
      inkCtx.globalCompositeOperation = 'destination-out';
      inkCtx.beginPath();
      inkCtx.arc(canvasX, canvasY, eraseRadius, 0, Math.PI * 2);
      inkCtx.fill();
      inkCtx.restore();
    }
  });

  function createBadge(x, y, text, color, fontSize, fontFamily) {
    const fSize = fontSize || state.fontSize || 48;
    const fFamily = fontFamily || state.fontFamily || 'Google Sans';
    inkCtx.save();
    inkCtx.font = `700 ${fSize}px "${fFamily}", system-ui, sans-serif`;
    const width = inkCtx.measureText(text).width + 48;
    inkCtx.restore();

    state.badges.push({
      id: Date.now() + Math.random(),
      x: x,
      y: y,
      w: width,
      h: fSize + 28,
      fontSize: fSize,
      fontFamily: fFamily,
      text: text,
      color: color
    });
  }

  function commitStroke(pts, color, size) {
    inkCtx.save();
    inkCtx.strokeStyle = color;
    inkCtx.lineWidth = size;
    inkCtx.lineCap = 'round';
    inkCtx.lineJoin = 'round';

    if (!state.autoShape || pts.length < 10) {
      drawRawPath(inkCtx, pts);
      inkCtx.restore();
      return;
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let pathLength = 0;

    for (let i = 0; i < pts.length; i++) {
      if (pts[i].x < minX) minX = pts[i].x;
      if (pts[i].x > maxX) maxX = pts[i].x;
      if (pts[i].y < minY) minY = pts[i].y;
      if (pts[i].y > maxY) maxY = pts[i].y;
      if (i > 0) {
        pathLength += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      }
    }

    const boxW = maxX - minX;
    const boxH = maxY - minY;
    const diag = Math.hypot(boxW, boxH);
    const startEndDist = Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y);

    if (diag > 50 && pathLength / (startEndDist + 1) < 1.15) {
      inkCtx.beginPath();
      inkCtx.moveTo(pts[0].x, pts[0].y);
      inkCtx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      inkCtx.stroke();
      inkCtx.restore();
      return;
    }

    if (diag > 60 && startEndDist < diag * 0.38) {
      let area = 0;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
      }
      area = Math.abs(area) / 2;
      const boxArea = boxW * boxH;
      const fillRatio = area / (boxArea + 1);

      const centerX = minX + boxW / 2;
      const centerY = minY + boxH / 2;

      inkCtx.beginPath();
      if (fillRatio > 0.60 && fillRatio < 0.82 && Math.abs(boxW - boxH) < Math.max(boxW, boxH) * 0.45) {
        const radius = (boxW + boxH) / 4;
        inkCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      } else {
        inkCtx.roundRect(minX, minY, boxW, boxH, 8);
      }
      inkCtx.stroke();
      inkCtx.restore();
      return;
    }

    drawRawPath(inkCtx, pts);
    inkCtx.restore();
  }

  function drawRawPath(ctx, pts) {
    if (pts.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.stroke();
  }

  function renderBadges(ctx) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const b of state.badges) {
      const fSize = b.fontSize || 48;
      const fFamily = b.fontFamily || 'Google Sans';
      ctx.font = `700 ${fSize}px "${fFamily}", system-ui, sans-serif`;

      const isGrabbed = state.grabbedBadge && state.grabbedBadge.id === b.id;
      ctx.fillStyle = isGrabbed ? 'rgba(0, 188, 235, 0.45)' : 'rgba(18, 18, 18, 0.88)';
      ctx.strokeStyle = isGrabbed ? '#ffffff' : b.color;
      ctx.lineWidth = isGrabbed ? 5 : 4;

      ctx.beginPath();
      ctx.roundRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, 14);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.fillText(b.text, b.x, b.y + 2);
    }
    ctx.restore();
  }

  function drawAllOverlays(outCtx, width, height) {
    outCtx.drawImage(inkCanvas, 0, 0, width, height);

    if (state.currentStroke.length > 1) {
      outCtx.save();
      outCtx.strokeStyle = state.brushColor;
      outCtx.lineWidth = state.brushSize;
      outCtx.lineCap = 'round';
      outCtx.lineJoin = 'round';
      drawRawPath(outCtx, state.currentStroke);
      outCtx.restore();
    }

    renderBadges(outCtx);

    if (state.handX !== null && state.handY !== null && state.mode !== 'none') {
      outCtx.save();
      if (state.pendingText.trim().length > 0 && state.mode !== 'erase') {
        outCtx.font = `700 ${Math.max(32, state.fontSize - 8)}px "${state.fontFamily}", system-ui, sans-serif`;
        outCtx.fillStyle = state.brushColor;
        outCtx.textAlign = 'center';
        outCtx.fillText(`📌 "${state.pendingText.trim()}" (☝️ to stamp)`, state.handX, state.handY - 28);
      }

      outCtx.beginPath();
      if (state.mode === 'erase') {
        outCtx.arc(state.handX, state.handY, 55, 0, Math.PI * 2);
        outCtx.fillStyle = 'rgba(255, 77, 77, 0.28)';
        outCtx.fill();
        outCtx.strokeStyle = '#ff4d4d';
        outCtx.lineWidth = 3;
        outCtx.stroke();
      } else if (state.mode === 'pinch') {
        outCtx.arc(state.handX, state.handY, 15, 0, Math.PI * 2);
        outCtx.strokeStyle = '#00bceb';
        outCtx.lineWidth = 4;
        outCtx.stroke();
      } else if (state.mode === 'draw') {
        outCtx.arc(state.handX, state.handY, 10, 0, Math.PI * 2);
        outCtx.fillStyle = state.brushColor;
        outCtx.fill();
      } else {
        outCtx.arc(state.handX, state.handY, 12, 0, Math.PI * 2);
        outCtx.strokeStyle = '#ffffff';
        outCtx.lineWidth = 3;
        outCtx.stroke();
      }
      outCtx.restore();
    }
  }

  // Single, clean stream processor (No duplicate overlay canvas!)
  const hijackedGetUserMedia = async function (constraints) {
    if (!constraints || !constraints.video) {
      return originalGetUserMedia(constraints);
    }

    const rawStream = await originalGetUserMedia(constraints);
    const videoTrack = rawStream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    const width = settings.width || 1280;
    const height = settings.height || 720;

    state.camActive = true;
    inkCanvas.width = width;
    inkCanvas.height = height;

    // Mount the toolbar directly inside THIS frame that owns the camera
    injectFloatingToolbar();
    const statusEl = document.getElementById('air-wb-status');
    if (statusEl) {
      statusEl.textContent = '🟢 Cam Active';
      statusEl.style.color = '#00ffcc';
    }

    const hiddenVideo = document.createElement('video');
    hiddenVideo.srcObject = new MediaStream([videoTrack]);
    hiddenVideo.muted = true;
    hiddenVideo.playsInline = true;
    await hiddenVideo.play();

    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = width;
    outputCanvas.height = height;
    const outCtx = outputCanvas.getContext('2d');

    const trackerCanvas = document.createElement('canvas');
    trackerCanvas.width = 320;
    trackerCanvas.height = 180;
    const trackerCtx = trackerCanvas.getContext('2d');

    let frameCounter = 0;

    function renderStreamLoop() {
      if (hiddenVideo.readyState >= 2) {
        outCtx.clearRect(0, 0, width, height);
        outCtx.drawImage(hiddenVideo, 0, 0, width, height);

        if (state.enabled) {
          drawAllOverlays(outCtx, width, height);

          frameCounter++;
          if (frameCounter % 2 === 0) {
            trackerCtx.drawImage(hiddenVideo, 0, 0, trackerCanvas.width, trackerCanvas.height);
            window.postMessage({
              type: 'AIR_WB_FRAME',
              dataUrl: trackerCanvas.toDataURL('image/jpeg', 0.6)
            }, '*');
          }
        }
      }
      requestAnimationFrame(renderStreamLoop);
    }

    requestAnimationFrame(renderStreamLoop);

    const processedStream = outputCanvas.captureStream(30);
    rawStream.getAudioTracks().forEach(track => processedStream.addTrack(track));
    return processedStream;
  };

  navigator.mediaDevices.getUserMedia = hijackedGetUserMedia;
  if (window.MediaDevices && MediaDevices.prototype) {
    MediaDevices.prototype.getUserMedia = hijackedGetUserMedia;
  }

  function injectFloatingToolbar() {
    if (document.getElementById('air-wb-toolbar')) return;

    const bar = document.createElement('div');
    bar.id = 'air-wb-toolbar';
    bar.style.cssText = `
      position: fixed; bottom: 85px; left: 20px; z-index: 2147483647;
      background: rgba(20, 22, 28, 0.96); color: #fff; padding: 10px 14px;
      border-radius: 12px; font-family: system-ui, -apple-system, sans-serif;
      font-size: 12px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      box-shadow: 0 8px 24px rgba(0,0,0,0.65); border: 1px solid rgba(0,188,235,0.45);
    `;

    bar.innerHTML = `
      <span style="font-weight:700; color:#00bceb;">✋ AirBoard</span>
      <span id="air-wb-status" style="font-size:11px; color:#00ffcc; font-weight:600;">🟢 Cam Active</span>
      <input type="color" id="air-wb-color" value="#00ffcc" title="Brush & Badge Color"
        style="width:26px; height:26px; border:none; background:none; cursor:pointer;">
      <input type="text" id="air-wb-text-input" placeholder="Type text -> press Enter or ☝️"
        style="padding:6px 8px; border-radius:6px; border:1px solid #444; background:#111; color:#fff; width:170px; font-size:12px;">
      <button id="air-wb-stamp-btn" title="Stamp text onto screen right now"
        style="padding:6px 10px; border-radius:6px; border:none; background:#00ffcc; color:#000; font-weight:700; cursor:pointer;">
        📌 Stamp
      </button>
      <select id="air-wb-font-family" title="Select Font Family"
        style="padding:5px 8px; border-radius:6px; border:1px solid #444; background:#111; color:#fff; font-size:12px; cursor:pointer;">
        <option value="Google Sans">Google Sans</option>
        <option value="Lato">Lato</option>
        <option value="Comfortaa">Comfortaa</option>
      </select>
      <label style="display:flex; align-items:center; gap:4px; color:#ccc;" title="Text Font Size">
        <span>Aa</span>
        <input type="range" id="air-wb-font-size" min="28" max="72" value="48" style="width:55px; cursor:pointer;">
      </label>
      <button id="air-wb-shape-toggle" title="Toggle Auto-Shape Smoothing"
        style="padding:6px 9px; border-radius:6px; border:none; background:#00bceb; color:#000; font-weight:600; cursor:pointer;">
        Shapes: ON
      </button>
      <button id="air-wb-clear"
        style="padding:6px 9px; border-radius:6px; border:none; background:#ff4d4d; color:#fff; font-weight:600; cursor:pointer;">
        Clear All
      </button>
      <button id="air-wb-unmirror-self"
        style="padding:6px 9px; border-radius:6px; border:1px solid #555; background:#222; color:#ddd; cursor:pointer;">
        Unmirror Self
      </button>
    `;

    document.body.appendChild(bar);

    const colorEl = document.getElementById('air-wb-color');
    const textInputEl = document.getElementById('air-wb-text-input');
    const stampBtn = document.getElementById('air-wb-stamp-btn');
    const fontFamilyEl = document.getElementById('air-wb-font-family');
    const fontSizeEl = document.getElementById('air-wb-font-size');
    const shapeBtn = document.getElementById('air-wb-shape-toggle');
    const clearBtn = document.getElementById('air-wb-clear');
    const unmirrorBtn = document.getElementById('air-wb-unmirror-self');

    colorEl.addEventListener('input', (e) => {
      state.brushColor = e.target.value;
    });

    fontFamilyEl.addEventListener('change', (e) => {
      state.fontFamily = e.target.value;
      textInputEl.style.fontFamily = `"${e.target.value}", system-ui, sans-serif`;
    });

    fontSizeEl.addEventListener('input', (e) => {
      state.fontSize = Number(e.target.value);
    });

    // Direct, same-frame stamp—no cross-frame message needed!
    function triggerImmediateStamp() {
      const val = textInputEl.value.trim();
      if (!val) return;
      const offset = (state.badges.length % 5) * 36;
      const targetX = state.handX !== null ? state.handX : (inkCanvas.width / 2);
      const targetY = state.handY !== null ? state.handY : (inkCanvas.height / 3 + offset);
      createBadge(targetX, targetY, val, state.brushColor, state.fontSize, state.fontFamily);
      textInputEl.value = '';
      state.pendingText = '';
    }

    stampBtn.addEventListener('click', triggerImmediateStamp);

    textInputEl.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        triggerImmediateStamp();
      }
    });

    textInputEl.addEventListener('input', (e) => {
      state.pendingText = e.target.value;
    });

    shapeBtn.addEventListener('click', () => {
      state.autoShape = !state.autoShape;
      shapeBtn.textContent = state.autoShape ? 'Shapes: ON' : 'Shapes: OFF';
      shapeBtn.style.background = state.autoShape ? '#00bceb' : '#333';
      shapeBtn.style.color = state.autoShape ? '#000' : '#ccc';
    });

    clearBtn.addEventListener('click', () => {
      inkCtx.clearRect(0, 0, inkCanvas.width, inkCanvas.height);
      state.badges = [];
      state.currentStroke = [];
    });

    let selfUnmirrored = false;
    unmirrorBtn.addEventListener('click', () => {
      selfUnmirrored = !selfUnmirrored;
      let styleTag = document.getElementById('air-wb-mirror-fix');
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = 'air-wb-mirror-fix';
        document.head.appendChild(styleTag);
      }
      styleTag.textContent = selfUnmirrored ? `video { transform: scaleX(1) !important; }` : ``;
      unmirrorBtn.style.background = selfUnmirrored ? '#00bceb' : '#222';
      unmirrorBtn.style.color = selfUnmirrored ? '#000' : '#ddd';
    });
  }
})();