// Interacciones ligeras compartidas por todas las páginas de NMO Records.
document.documentElement.classList.add("js");
const year = document.querySelector("#year");
if (year) year.textContent = new Date().getFullYear();

// El menú solo se expande en pantallas pequeñas y se cierra al elegir una ruta.
const topbar = document.querySelector(".topbar");
const menuButton = document.querySelector(".menu");
if (topbar && menuButton) {
  menuButton.addEventListener("click", () => {
    const isOpen = topbar.classList.toggle("nav-open");
    menuButton.classList.toggle("is-open", isOpen);
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Cerrar menú" : "Abrir menú");
  });
  const closeMenu = () => {
    topbar.classList.remove("nav-open");
    menuButton.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Abrir menú");
  };
  topbar.querySelectorAll("nav a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && topbar.classList.contains("nav-open")) {
      closeMenu();
      menuButton.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (!topbar.contains(event.target) && topbar.classList.contains("nav-open")) closeMenu();
  });
}

// Revela cada bloque al entrar en pantalla una sola vez; sin bucles de scroll.
const revealItems = document.querySelectorAll("[data-reveal]");
if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -32px 0px" });
  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

// El reproductor existe solo en la ficha del sencillo.
const player = document.querySelector(".music-player");
if (player) {
  const audio = player.querySelector("#cancion");
  const playButton = player.querySelector("#reproducir");
  const seekBar = player.querySelector("#avance");
  const volumeBar = player.querySelector("#volumen");
  const currentTime = player.querySelector("#tiempo-actual");
  const duration = player.querySelector("#duracion");
  const status = player.querySelector("#estado-audio");
  const muteButton = player.querySelector("#silencio");
  const likeButton = player.querySelector(".like-button");
  const canvas = player.querySelector("#visualizador");
  const context = canvas.getContext("2d");
  let audioContext;
  let analyser;
  let source;
  let frequencyData;
  let animationFrame;

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return "0:00";
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
  };

  function drawWaveform() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(height * scale)) {
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
    }
    context.setTransform(scale, 0, 0, scale, 0, 0);
    context.clearRect(0, 0, width, height);
    const count = Math.max(24, Math.min(64, Math.floor(width / 8)));
    const gap = 3;
    const barWidth = (width - gap * (count - 1)) / count;
    const center = height / 2;
    const playing = !audio.paused;

    for (let index = 0; index < count; index += 1) {
      const sample = analyser && frequencyData && playing
        ? frequencyData[Math.floor((index / count) * frequencyData.length * 0.72)] / 255
        : 0.12 + Math.abs(Math.sin(index * 0.42)) * 0.2;
      const amplitude = playing ? 5 + sample * height * 0.42 : 5 + sample * 25;
      const x = index * (barWidth + gap);
      const gradient = context.createLinearGradient(0, center - amplitude, 0, center + amplitude);
      gradient.addColorStop(0, "#b4ebff");
      gradient.addColorStop(0.5, "#70c9ee");
      gradient.addColorStop(1, "#28799e");
      context.fillStyle = gradient;
      context.beginPath();
      if (typeof context.roundRect === "function") context.roundRect(x, center - amplitude, barWidth, amplitude * 2, barWidth / 2);
      else context.rect(x, center - amplitude, barWidth, amplitude * 2);
      context.fill();
    }
  }

  function animateWaveform() {
    if (analyser && frequencyData && !audio.paused) analyser.getByteFrequencyData(frequencyData);
    drawWaveform();
    if (!audio.paused) animationFrame = requestAnimationFrame(animateWaveform);
  }

  async function prepareAnalyser() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass || source) return;
    try {
      audioContext = new AudioContextClass();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.82;
      source = audioContext.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      frequencyData = new Uint8Array(analyser.frequencyBinCount);
    } catch {
      analyser = null;
      frequencyData = null;
    }
  }

  function updatePlayingState() {
    const playing = !audio.paused;
    player.classList.toggle("is-playing", playing);
    playButton.setAttribute("aria-label", playing ? "Pausar canción" : "Reproducir canción");
    playButton.title = playing ? "Pausar" : "Reproducir";
    status.textContent = playing ? "SONANDO AHORA" : "LISTO PARA ESCUCHAR";
  }

  function updateProgress() {
    currentTime.textContent = formatTime(audio.currentTime);
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      const progress = (audio.currentTime / audio.duration) * 100;
      seekBar.value = String(Math.round(progress * 10));
      player.style.setProperty("--played", `${progress}%`);
    }
  }

  playButton.addEventListener("click", async () => {
    if (!audio.paused) {
      audio.pause();
      return;
    }
    try {
      await prepareAnalyser();
      if (audioContext?.state === "suspended") await audioContext.resume();
      await audio.play();
    } catch {
      status.textContent = "NO SE PUDO ABRIR EL AUDIO";
    }
  });

  audio.addEventListener("play", () => {
    updatePlayingState();
    cancelAnimationFrame(animationFrame);
    animateWaveform();
  });
  audio.addEventListener("pause", () => {
    updatePlayingState();
    cancelAnimationFrame(animationFrame);
    drawWaveform();
  });
  audio.addEventListener("ended", () => {
    updatePlayingState();
    seekBar.value = "0";
    updateProgress();
  });
  audio.addEventListener("loadedmetadata", () => { duration.textContent = formatTime(audio.duration); });
  audio.addEventListener("durationchange", () => { duration.textContent = formatTime(audio.duration); });
  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("error", () => { status.textContent = "NO SE PUDO CARGAR EL AUDIO"; });
  seekBar.addEventListener("input", () => {
    if (Number.isFinite(audio.duration)) audio.currentTime = (Number(seekBar.value) / 1000) * audio.duration;
  });
  player.querySelector("#retroceder").addEventListener("click", () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
  player.querySelector("#adelantar").addEventListener("click", () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });

  audio.volume = Number(volumeBar.value);
  volumeBar.addEventListener("input", () => {
    audio.volume = Number(volumeBar.value);
    audio.muted = audio.volume === 0;
    muteButton.textContent = audio.muted ? "◖×" : "◖))";
  });
  muteButton.addEventListener("click", () => {
    audio.muted = !audio.muted;
    muteButton.textContent = audio.muted ? "◖×" : "◖))";
    muteButton.setAttribute("aria-label", audio.muted ? "Activar sonido" : "Silenciar audio");
  });
  likeButton.addEventListener("click", () => {
    const liked = likeButton.classList.toggle("is-liked");
    likeButton.textContent = liked ? "♥" : "♡";
    likeButton.setAttribute("aria-label", liked ? "Quitar de favoritos" : "Marcar canción como favorita");
  });
  window.addEventListener("resize", drawWaveform, { passive: true });
  drawWaveform();
}
