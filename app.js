(() => {
  "use strict";

  const synth = window.speechSynthesis;

  // --- DOM ---
  const $ = (id) => document.getElementById(id);
  const textEl = $("text");
  const speakBtn = $("speakBtn");
  const stopBtn = $("stopBtn");
  const clearBtn = $("clearBtn");
  const quickPhrasesEl = $("quickPhrases");
  const historySection = $("historySection");
  const historyEl = $("history");
  const clearHistoryBtn = $("clearHistoryBtn");

  const settingsPanel = $("settingsPanel");
  const settingsBtn = $("settingsBtn");
  const closeSettings = $("closeSettings");
  const voiceSelect = $("voiceSelect");
  const rate = $("rate");
  const pitch = $("pitch");
  const volume = $("volume");
  const rateVal = $("rateVal");
  const pitchVal = $("pitchVal");
  const volumeVal = $("volumeVal");
  const speakOnPhrase = $("speakOnPhrase");
  const testVoice = $("testVoice");

  const phrasesPanel = $("phrasesPanel");
  const editPhrasesBtn = $("editPhrasesBtn");
  const closePhrases = $("closePhrases");
  const phrasesEditor = $("phrasesEditor");
  const savePhrases = $("savePhrases");
  const resetPhrases = $("resetPhrases");

  // --- Estado / almacenamiento ---
  const KEYS = {
    settings: "speaktext.settings",
    phrases: "speaktext.phrases",
    history: "speaktext.history",
  };

  const DEFAULT_PHRASES = [
    "Sí",
    "No",
    "Gracias",
    "Un momento, por favor",
    "Estoy en reposo vocal, disculpa que use el móvil para hablar.",
    "¿Puedes repetir, por favor?",
    "No te oigo bien",
    "Ahora mismo no puedo hablar",
    "Espera un segundo",
    "Perdona",
  ];

  const load = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const save = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  };

  const settings = Object.assign(
    { voiceURI: "", rate: 1, pitch: 1, volume: 1, speakOnPhrase: true },
    load(KEYS.settings, {})
  );
  let phrases = load(KEYS.phrases, DEFAULT_PHRASES);
  let history = load(KEYS.history, []);

  // --- Voces ---
  let voices = [];

  function populateVoices() {
    voices = synth.getVoices();
    // Priorizar español; luego el resto.
    const es = voices.filter((v) => /^es/i.test(v.lang));
    const rest = voices.filter((v) => !/^es/i.test(v.lang));
    const ordered = [...es, ...rest];

    voiceSelect.innerHTML = "";
    ordered.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.voiceURI;
      opt.textContent = `${v.name} (${v.lang})${v.default ? " — por defecto" : ""}`;
      voiceSelect.appendChild(opt);
    });

    // Selección: guardada > primera española > primera disponible.
    if (settings.voiceURI && ordered.some((v) => v.voiceURI === settings.voiceURI)) {
      voiceSelect.value = settings.voiceURI;
    } else if (es.length) {
      voiceSelect.value = es[0].voiceURI;
      settings.voiceURI = es[0].voiceURI;
    } else if (ordered.length) {
      voiceSelect.value = ordered[0].voiceURI;
      settings.voiceURI = ordered[0].voiceURI;
    }
  }

  function getSelectedVoice() {
    return voices.find((v) => v.voiceURI === settings.voiceURI) || null;
  }

  // --- Hablar ---
  function speak(text, chip) {
    text = (text || "").trim();
    if (!text) return;
    if (!synth) {
      alert("Tu navegador no soporta síntesis de voz.");
      return;
    }

    synth.cancel(); // corta lo anterior para respuesta rápida

    const u = new SpeechSynthesisUtterance(text);
    const voice = getSelectedVoice();
    if (voice) {
      u.voice = voice;
      u.lang = voice.lang;
    } else {
      u.lang = "es-ES";
    }
    u.rate = settings.rate;
    u.pitch = settings.pitch;
    u.volume = settings.volume;

    u.onstart = () => {
      stopBtn.disabled = false;
      if (chip) chip.classList.add("speaking");
    };
    const done = () => {
      stopBtn.disabled = true;
      if (chip) chip.classList.remove("speaking");
    };
    u.onend = done;
    u.onerror = done;

    synth.speak(u);
  }

  function stop() {
    synth.cancel();
    stopBtn.disabled = true;
    document.querySelectorAll(".chip.speaking").forEach((c) => c.classList.remove("speaking"));
  }

  // --- Historial ---
  function addToHistory(text) {
    text = text.trim();
    if (!text) return;
    history = history.filter((h) => h !== text);
    history.unshift(text);
    history = history.slice(0, 8);
    save(KEYS.history, history);
    renderHistory();
  }

  function renderHistory() {
    historyEl.innerHTML = "";
    if (!history.length) {
      historySection.hidden = true;
      return;
    }
    historySection.hidden = false;
    history.forEach((text) => {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.textContent = text.length > 42 ? text.slice(0, 40) + "…" : text;
      chip.title = text;
      chip.addEventListener("click", () => {
        textEl.value = text;
        speak(text, chip);
      });
      historyEl.appendChild(chip);
    });
  }

  // --- Frases rápidas ---
  function renderPhrases() {
    quickPhrasesEl.innerHTML = "";
    phrases.forEach((text) => {
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.textContent = text;
      chip.title = text;
      chip.addEventListener("click", () => {
        if (settings.speakOnPhrase) {
          speak(text, chip);
        } else {
          textEl.value = text;
          textEl.focus();
        }
      });
      quickPhrasesEl.appendChild(chip);
    });
  }

  // --- Eventos principales ---
  function doSpeakFromInput() {
    const text = textEl.value.trim();
    if (!text) return;
    speak(text);
    addToHistory(text);
  }

  speakBtn.addEventListener("click", doSpeakFromInput);
  stopBtn.addEventListener("click", stop);
  clearBtn.addEventListener("click", () => {
    textEl.value = "";
    textEl.focus();
  });

  textEl.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      doSpeakFromInput();
    }
  });

  clearHistoryBtn.addEventListener("click", () => {
    history = [];
    save(KEYS.history, history);
    renderHistory();
  });

  // --- Panel de ajustes ---
  function openPanel(panel) { panel.hidden = false; }
  function closePanel(panel) { panel.hidden = true; }

  settingsBtn.addEventListener("click", () => openPanel(settingsPanel));
  closeSettings.addEventListener("click", () => closePanel(settingsPanel));
  settingsPanel.addEventListener("click", (e) => {
    if (e.target === settingsPanel) closePanel(settingsPanel);
  });

  voiceSelect.addEventListener("change", () => {
    settings.voiceURI = voiceSelect.value;
    save(KEYS.settings, settings);
  });

  function bindRange(input, label, prop) {
    input.value = settings[prop];
    label.textContent = Number(settings[prop]).toFixed(prop === "pitch" || prop === "volume" ? 1 : 2);
    input.addEventListener("input", () => {
      settings[prop] = parseFloat(input.value);
      label.textContent = settings[prop].toFixed(prop === "pitch" || prop === "volume" ? 1 : 2);
      save(KEYS.settings, settings);
    });
  }
  bindRange(rate, rateVal, "rate");
  bindRange(pitch, pitchVal, "pitch");
  bindRange(volume, volumeVal, "volume");

  speakOnPhrase.checked = settings.speakOnPhrase;
  speakOnPhrase.addEventListener("change", () => {
    settings.speakOnPhrase = speakOnPhrase.checked;
    save(KEYS.settings, settings);
  });

  testVoice.addEventListener("click", () =>
    speak("Hola, esta es una prueba de voz para el reposo vocal.")
  );

  // --- Panel de frases ---
  editPhrasesBtn.addEventListener("click", () => {
    phrasesEditor.value = phrases.join("\n");
    openPanel(phrasesPanel);
  });
  closePhrases.addEventListener("click", () => closePanel(phrasesPanel));
  phrasesPanel.addEventListener("click", (e) => {
    if (e.target === phrasesPanel) closePanel(phrasesPanel);
  });
  savePhrases.addEventListener("click", () => {
    phrases = phrasesEditor.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    save(KEYS.phrases, phrases);
    renderPhrases();
    closePanel(phrasesPanel);
  });
  resetPhrases.addEventListener("click", () => {
    phrasesEditor.value = DEFAULT_PHRASES.join("\n");
  });

  // --- Init ---
  populateVoices();
  if (synth.onvoiceschanged !== undefined) {
    synth.onvoiceschanged = populateVoices;
  }
  renderPhrases();
  renderHistory();

  // Service worker (offline / instalable)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
