
const saveSongButton = document.getElementById("saveSongButton");
const songList = document.getElementById("songList");
const libraryCount = document.getElementById("libraryCount");

let currentLoadedFile = null;
let currentSavedSongId = null;
let musicDatabase = null;
let currentObjectUrl = null;

const audioUpload = document.getElementById("audioUpload");
const uploadBox = document.getElementById("uploadBox");
const uploadTitle = document.getElementById("uploadTitle");
const uploadSubtitle = document.getElementById("uploadSubtitle");
const fileStatus = document.getElementById("fileStatus");
const fileStatusDot = document.getElementById("fileStatusDot");

const audioPlayer = document.getElementById("audioPlayer");
const trackName = document.getElementById("trackName");
const trackMeta = document.getElementById("trackMeta");
const trackBadge = document.getElementById("trackBadge");

const playButton = document.getElementById("playButton");
const restartButton = document.getElementById("restartButton");
const stopButton = document.getElementById("stopButton");
const progressBar = document.getElementById("progressBar");
const currentTimeLabel = document.getElementById("currentTime");
const durationLabel = document.getElementById("duration");
const volumeSlider = document.getElementById("volumeSlider");

const sensitivitySlider = document.getElementById("sensitivitySlider");
const sensitivityValue = document.getElementById("sensitivityValue");
const themeButton = document.getElementById("themeButton");

const canvas = document.getElementById("visualizerCanvas");
const ctx = canvas.getContext("2d");
const visualizerPlaceholder =
  document.getElementById("visualizerPlaceholder");
const visualizerModeLabel =
  document.getElementById("visualizerModeLabel");
const audioState = document.getElementById("audioState");
const modeButtons = document.querySelectorAll(".mode-button");

let audioContext = null;
let analyser = null;
let sourceNode = null;
let frequencyData = null;
let waveformData = null;
let currentMode = "bars";
let sensitivity = 0.7;
let audioReady = false;
let themeIndex = 0;

const themes = ["theme-ocean", "theme-cosmic", "theme-solar"];

const modeNames = {
  bars: "SPECTRUM MODE",
  circle: "GALAXY MODE",
  wave: "WAVEFORM MODE"
};

// ========================================
// LOCAL MUSIC STORAGE USING INDEXEDDB
// ========================================

const DATABASE_NAME = "AuroraMusicDatabase";
const DATABASE_VERSION = 1;
const STORE_NAME = "songs";

function openMusicDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = indexedDB.open(
      DATABASE_NAME,
      DATABASE_VERSION
    );

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, {
          keyPath: "id",
          autoIncrement: true
        });
      }
    };

    request.onsuccess = () => {
      musicDatabase = request.result;
      musicDatabase.onversionchange = () => musicDatabase.close();
      resolve(musicDatabase);
    };

    request.onerror = () => {
      reject(request.error || new Error("Could not open database."));
    };
  });
}

function getAllSavedSongs() {
  return new Promise((resolve, reject) => {
    if (!musicDatabase) {
      reject(new Error("Music database is not ready."));
      return;
    }

    const transaction = musicDatabase.transaction(
      STORE_NAME,
      "readonly"
    );

    const request = transaction.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function saveSongToDatabase(song) {
  return new Promise((resolve, reject) => {
    const transaction = musicDatabase.transaction(
      STORE_NAME,
      "readwrite"
    );

    const request = transaction.objectStore(STORE_NAME).add(song);
    let savedId;

    request.onsuccess = () => {
      savedId = request.result;
    };

    transaction.oncomplete = () => resolve(savedId);

    transaction.onerror = () => {
      reject(transaction.error || new Error("Save failed."));
    };

    transaction.onabort = () => {
      reject(transaction.error || new Error("Save was cancelled."));
    };
  });
}

function deleteSongFromDatabase(id) {
  return new Promise((resolve, reject) => {
    const transaction = musicDatabase.transaction(
      STORE_NAME,
      "readwrite"
    );

    transaction.objectStore(STORE_NAME).delete(id);

    transaction.oncomplete = () => resolve();

    transaction.onerror = () => {
      reject(transaction.error || new Error("Delete failed."));
    };

    transaction.onabort = () => {
      reject(transaction.error || new Error("Delete was cancelled."));
    };
  });
}

// Display saved songs in the personal music library.
async function refreshMusicLibrary() {
  try {
    const songs = await getAllSavedSongs();

    libraryCount.textContent =
      `${songs.length} SAVED SONG${songs.length === 1 ? "" : "S"}`;

    songList.replaceChildren();

    if (songs.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-message";
      empty.textContent = "Your music universe is waiting...";
      songList.appendChild(empty);
      return;
    }

    songs.sort((a, b) => a.name.localeCompare(b.name));

    songs.forEach(song => {
      const item = document.createElement("div");
      item.className = "saved-song";

      const info = document.createElement("div");
      info.className = "saved-song-info";

      const name = document.createElement("strong");
      name.textContent = `♫ ${song.name}`;

      const details = document.createElement("span");
      details.textContent =
        `${(song.size / (1024 * 1024)).toFixed(2)} MB · Saved on this browser`;

      info.append(name, details);

      const actions = document.createElement("div");
      actions.className = "saved-song-actions";

      const playSavedButton = document.createElement("button");
      playSavedButton.type = "button";
      playSavedButton.textContent = "▶ Play";

      playSavedButton.addEventListener("click", async () => {
        try {
          const file = new File(
            [song.blob],
            song.name,
            { type: song.type || "audio/mpeg" }
          );

          loadAudio(file, song.id);
          await playAudio();
        } catch (error) {
          console.error("Could not play saved song:", error);
          fileStatus.textContent = "Unable to play this saved song.";
        }
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.textContent = "Delete";
      deleteButton.className = "delete-song-button";

      deleteButton.addEventListener("click", async () => {
        const confirmed = window.confirm(
          `Delete "${song.name}" from your saved music?`
        );

        if (!confirmed) return;

        try {
          await deleteSongFromDatabase(song.id);

          if (currentSavedSongId === song.id) {
            currentSavedSongId = null;
            saveSongButton.textContent = "𝅘𝅥𝅮 Save to My Music";
          }

          await refreshMusicLibrary();
          fileStatus.textContent = "Song deleted from your library.";
        } catch (error) {
          console.error("Could not delete song:", error);
          fileStatus.textContent = "Could not delete this song.";
        }
      });

      actions.append(playSavedButton, deleteButton);
      item.append(info, actions);
      songList.appendChild(item);
    });
  } catch (error) {
    console.error("Could not load saved songs:", error);
    fileStatus.textContent = "Could not load your saved music library.";
  }
}

async function initializeMusicLibrary() {
  try {
    await openMusicDatabase();
    await refreshMusicLibrary();
  } catch (error) {
    console.error("AURORA storage error:", error);

    fileStatus.textContent =
      "Music storage could not be opened. Check your browser storage.";

    saveSongButton.disabled = true;
  }
}

// Save the currently loaded song to browser storage.
saveSongButton.addEventListener("click", async () => {
  if (!currentLoadedFile) {
    fileStatus.textContent = "Upload a song before saving it.";
    return;
  }

  if (currentSavedSongId !== null) {
    fileStatus.textContent = "This song is already saved in your library.";
    return;
  }

  if (!musicDatabase) {
    fileStatus.textContent = "Music storage is still loading. Try again.";
    return;
  }

  saveSongButton.disabled = true;

  try {
    const songs = await getAllSavedSongs();

    const duplicate = songs.some(song =>
      song.name === currentLoadedFile.name &&
      song.size === currentLoadedFile.size &&
      song.type === currentLoadedFile.type
    );

    if (duplicate) {
      fileStatus.textContent = "This song is already in your library.";
      return;
    }

    const id = await saveSongToDatabase({
      name: currentLoadedFile.name,
      type: currentLoadedFile.type || "audio/mpeg",
      size: currentLoadedFile.size,
      blob: currentLoadedFile,
      savedAt: Date.now()
    });

    currentSavedSongId = id;

    await refreshMusicLibrary();

    saveSongButton.textContent = "✓ Saved to My Music";
    fileStatus.textContent = "Your song has been saved in AURORA!";
  } catch (error) {
    console.error("Could not save song:", error);

    fileStatus.textContent =
      error.name === "QuotaExceededError"
        ? "Browser storage is full. Free some space and try again."
        : "Song could not be saved. Please try again.";
  } finally {
    saveSongButton.disabled = false;
  }
});

// ========================================
// AUDIO PLAYER
// ========================================

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";

  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60).toString().padStart(2, "0");

  return `${minutes}:${secs}`;
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function setupAudio() {
  if (audioContext) {
    if (audioContext.state === "suspended") {
      return audioContext.resume();
    }
    return Promise.resolve();
  }

  const AudioContextClass =
    window.AudioContext || window.webkitAudioContext;

  if (!AudioContextClass) {
    fileStatus.textContent =
      "Your browser does not support audio visualization.";
    return Promise.resolve();
  }

  audioContext = new AudioContextClass();
  analyser = audioContext.createAnalyser();

  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.82;

  frequencyData = new Uint8Array(analyser.frequencyBinCount);
  waveformData = new Uint8Array(analyser.fftSize);

  sourceNode = audioContext.createMediaElementSource(audioPlayer);
  sourceNode.connect(analyser);
  analyser.connect(audioContext.destination);

  return audioContext.resume();
}

function loadAudio(file, savedSongId = null) {
  if (!file) return;

  if (!file.type.startsWith("audio/")) {
    fileStatus.textContent = "Please choose an audio file.";
    return;
  }

  currentLoadedFile = file;
  currentSavedSongId = savedSongId;

  saveSongButton.textContent =
    savedSongId !== null
      ? "✓ Saved to My Music"
      : "𝅘𝅥𝅮 Save to My Music";

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
  }

  currentObjectUrl = URL.createObjectURL(file);

  audioPlayer.src = currentObjectUrl;
  audioPlayer.load();

  audioReady = true;

  trackName.textContent = file.name.replace(/\.[^/.]+$/, "");
  trackMeta.textContent =
    `${(file.size / (1024 * 1024)).toFixed(2)} MB · Local audio`;
  trackBadge.textContent = "LOADED";

  uploadTitle.textContent = "Your track is ready";
  uploadSubtitle.textContent = file.name;

  fileStatus.textContent = "Track loaded — press play when ready";
  fileStatusDot.classList.add("ready");

  visualizerPlaceholder.classList.remove("hidden");
  audioState.textContent = "READY";
  playButton.textContent = "▶";
  progressBar.value = 0;
  currentTimeLabel.textContent = "0:00";
  durationLabel.textContent = "0:00";
}

audioUpload.addEventListener("change", event => {
  loadAudio(event.target.files[0]);
  audioUpload.value = "";
});

["dragenter", "dragover"].forEach(eventName => {
  uploadBox.addEventListener(eventName, event => {
    event.preventDefault();
    uploadBox.classList.add("drag-over");
  });
});

["dragleave", "drop"].forEach(eventName => {
  uploadBox.addEventListener(eventName, event => {
    event.preventDefault();
    uploadBox.classList.remove("drag-over");
  });
});

uploadBox.addEventListener("drop", event => {
  loadAudio(event.dataTransfer.files[0]);
});

async function playAudio() {
  if (!audioReady) {
    fileStatus.textContent = "Choose an audio track first.";
    return;
  }

  try {
    await setupAudio();
    await audioPlayer.play();
  } catch (error) {
    console.error("Playback error:", error);
    fileStatus.textContent =
      "Unable to play this file. Try another audio format.";
  }
}

playButton.addEventListener("click", () => {
  if (audioPlayer.paused) {
    playAudio();
  } else {
    audioPlayer.pause();
  }
});

restartButton.addEventListener("click", () => {
  if (!audioReady) return;

  audioPlayer.currentTime = 0;

  if (audioPlayer.paused) {
    playAudio();
  }
});

stopButton.addEventListener("click", () => {
  audioPlayer.pause();
  audioPlayer.currentTime = 0;
});

audioPlayer.addEventListener("play", () => {
  playButton.textContent = "Ⅱ";
  trackBadge.textContent = "PLAYING";
  audioState.textContent = "LIVE";
  visualizerPlaceholder.classList.add("hidden");
  fileStatus.textContent = "Now playing — enjoy the visuals";
});

audioPlayer.addEventListener("pause", () => {
  playButton.textContent = "▶";

  if (audioReady) {
    trackBadge.textContent =
      audioPlayer.currentTime > 0 ? "PAUSED" : "LOADED";
  }

  audioState.textContent = audioReady ? "PAUSED" : "STANDBY";
});

audioPlayer.addEventListener("ended", () => {
  trackBadge.textContent = "FINISHED";
  audioState.textContent = "FINISHED";
  playButton.textContent = "▶";
});

audioPlayer.addEventListener("loadedmetadata", () => {
  durationLabel.textContent = formatTime(audioPlayer.duration);
});

audioPlayer.addEventListener("timeupdate", () => {
  currentTimeLabel.textContent = formatTime(audioPlayer.currentTime);
  durationLabel.textContent = formatTime(audioPlayer.duration);

  if (Number.isFinite(audioPlayer.duration) && audioPlayer.duration > 0) {
    progressBar.value =
      (audioPlayer.currentTime / audioPlayer.duration) * 100;
  }
});

progressBar.addEventListener("input", () => {
  if (Number.isFinite(audioPlayer.duration) && audioPlayer.duration > 0) {
    audioPlayer.currentTime =
      (Number(progressBar.value) / 100) * audioPlayer.duration;
  }
});

volumeSlider.addEventListener("input", () => {
  audioPlayer.volume = Number(volumeSlider.value);
});

audioPlayer.volume = Number(volumeSlider.value);

// ========================================
// VISUAL SENSITIVITY AND THEMES
// ========================================

sensitivitySlider.addEventListener("input", () => {
  sensitivity = Number(sensitivitySlider.value) / 100;
  sensitivityValue.textContent = `${sensitivitySlider.value}%`;
});

modeButtons.forEach(button => {
  button.addEventListener("click", () => {
    currentMode = button.dataset.mode;

    modeButtons.forEach(item => {
      item.classList.toggle("active", item === button);
    });

    visualizerModeLabel.textContent = modeNames[currentMode];
  });
});

themeButton.addEventListener("click", () => {
  document.body.classList.remove(...themes);

  themeIndex = (themeIndex + 1) % themes.length;
  document.body.classList.add(themes[themeIndex]);
});

// ========================================
// VISUALIZER ANIMATIONS
// ========================================

function getEnergy(index) {
  if (!frequencyData || !frequencyData.length) return 0;

  return frequencyData[index % frequencyData.length] / 255 * sensitivity;
}

function drawBars(width, height) {
  const count = Math.max(24, Math.floor(width / 7));
  const gap = Math.max(2, width * 0.004);
  const barWidth = (width - gap * (count - 1)) / count;
  const baseY = height * 0.76;

  for (let i = 0; i < count; i++) {
    const dataIndex = Math.floor(
      (i / count) *
      (frequencyData ? frequencyData.length : 1) * 0.72
    );

    const energy = getEnergy(dataIndex);
    const idle = 0.025 + Math.abs(Math.sin(i * 0.37)) * 0.025;
    const barHeight = Math.max(3, (energy + idle) * height * 0.66);
    const x = i * (barWidth + gap);

    const gradient = ctx.createLinearGradient(
      0, baseY - barHeight, 0, baseY
    );

    gradient.addColorStop(0, "#c6a0ff");
    gradient.addColorStop(0.45, "#49d9ff");
    gradient.addColorStop(1, "#42fff4");

    ctx.fillStyle = gradient;
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#42fff4";

    ctx.beginPath();
    ctx.roundRect(
      x,
      baseY - barHeight,
      barWidth,
      barHeight,
      Math.min(5, barWidth / 2)
    );
    ctx.fill();

    ctx.shadowBlur = 0;
  }
}

function drawCircle(width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * 0.19;
  const count = 150;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.globalCompositeOperation = "lighter";

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;

    const dataIndex = Math.floor(
      (i / count) *
      (frequencyData ? frequencyData.length : 1) * 0.75
    );

    const length = (getEnergy(dataIndex) + 0.04) * height * 0.45;

    ctx.strokeStyle =
      i % 3 === 0 ? "#42fff4" :
      i % 3 === 1 ? "#429dff" : "#bd83ff";

    ctx.lineWidth = i % 4 === 0 ? 2 : 1;
    ctx.shadowBlur = 9;
    ctx.shadowColor = ctx.strokeStyle;

    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    ctx.lineTo(
      Math.cos(angle) * (radius + Math.max(3, length)),
      Math.sin(angle) * (radius + Math.max(3, length))
    );
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(66,255,244,.65)";

  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.66, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawWave(width, height) {
  const centerY = height / 2;

  ctx.beginPath();

  if (
    waveformData &&
    analyser &&
    audioContext &&
    audioContext.state === "running"
  ) {
    for (let i = 0; i < waveformData.length; i++) {
      const x = (i / (waveformData.length - 1)) * width;
      const value = (waveformData[i] - 128) / 128;
      const y = centerY + value * height * 0.38 * sensitivity;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  } else {
    for (let x = 0; x <= width; x += 2) {
      const y = centerY
        + Math.sin(x * 0.025 + performance.now() * 0.001) * 10
        + Math.sin(x * 0.009 - performance.now() * 0.0007) * 8;

      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }

  ctx.strokeStyle = "#42fff4";
  ctx.lineWidth = 2;
  ctx.shadowBlur = 14;
  ctx.shadowColor = "#42fff4";
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawVisualizer() {
  const rect = canvas.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  ctx.clearRect(0, 0, width, height);

  if (analyser && audioContext && audioContext.state === "running") {
    analyser.getByteFrequencyData(frequencyData);
    analyser.getByteTimeDomainData(waveformData);
  }

  if (currentMode === "bars") {
    drawBars(width, height);
  } else if (currentMode === "circle") {
    drawCircle(width, height);
  } else {
    drawWave(width, height);
  }

  requestAnimationFrame(drawVisualizer);
}

// ========================================
// FLOATING PARTICLES AND CLEANUP
// ========================================

function createParticles() {
  const container = document.getElementById("particles");

  if (!container) return;

  container.replaceChildren();

  for (let i = 0; i < 34; i++) {
    const particle = document.createElement("span");

    particle.className = "particle";
    particle.style.left = `${Math.random() * 100}%`;

    particle.style.setProperty(
      "--duration",
      `${9 + Math.random() * 15}s`
    );

    particle.style.setProperty(
      "--drift",
      `${Math.random() * 100 - 50}px`
    );

    particle.style.animationDelay = `${Math.random() * -20}s`;

    if (i % 4 === 0) {
      particle.style.background = "#a88aff";
      particle.style.boxShadow =
        "0 0 12px 2px rgba(168,138,255,.55)";
    }

    container.appendChild(particle);
  }
}

window.addEventListener("beforeunload", () => {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
  }

  if (musicDatabase) {
    musicDatabase.close();
  }
});

// Start the frontend.
// ========================================
// LOAD SONGS SHARED BY THE OWNER
// ========================================

async function loadSharedSongs() {
  const sharedSongList = document.getElementById("sharedSongList");

  if (!sharedSongList) return;

  try {
    const response = await fetch(
      "https://aurora-backend-opf0.onrender.com/api/songs/shared/"
    );

    if (!response.ok) {
      throw new Error("Could not fetch shared songs.");
    }

    const songs = await response.json();
    sharedSongList.replaceChildren();

    if (songs.length === 0) {
      const message = document.createElement("p");
      message.className = "empty-message";
      message.textContent = "No shared songs available yet.";
      sharedSongList.appendChild(message);
      return;
    }

    songs.forEach(song => {
      const item = document.createElement("div");
      item.className = "saved-song";

      const info = document.createElement("div");
      info.className = "saved-song-info";

      const title = document.createElement("strong");
      title.textContent = `♫ ${song.title}`;

      const artist = document.createElement("span");
      artist.textContent = song.artist || "Unknown artist";

      info.append(title, artist);

      const playButton = document.createElement("button");
      playButton.type = "button";
      playButton.textContent = "▶ Play";

      playButton.addEventListener("click", async () => {
        audioPlayer.crossOrigin = "anonymous";
        audioPlayer.src = song.audio_url;
        audioPlayer.load();

        currentLoadedFile = null;
        currentSavedSongId = null;
        audioReady = true;

        trackName.textContent = song.title;
        trackMeta.textContent = song.artist || "AURORA Shared Song";
        trackBadge.textContent = "LOADED";
        uploadTitle.textContent = "Shared track selected";
        uploadSubtitle.textContent = song.title;
        fileStatus.textContent = "Shared song loaded — press play";
        fileStatusDot.classList.add("ready");

        progressBar.value = 0;
        currentTimeLabel.textContent = "0:00";
        durationLabel.textContent = "0:00";
        audioState.textContent = "READY";
        visualizerPlaceholder.classList.remove("hidden");

        await playAudio();
      });

      item.append(info, playButton);
      sharedSongList.appendChild(item);
    });
  } catch (error) {
    console.error("Could not load shared songs:", error);

    sharedSongList.replaceChildren();

    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent =
      "Could not load shared songs. Check that Django is running.";

    sharedSongList.appendChild(message);
  }
}

// Start the frontend.
createParticles();
drawVisualizer();
initializeMusicLibrary();
loadSharedSongs();

console.log("AURORA frontend loaded successfully.");