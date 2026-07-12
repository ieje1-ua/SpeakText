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
  const refreshVoices = $("refreshVoices");
  const spanglish = $("spanglish");
  const enVoiceName = $("enVoiceName");
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
    { voiceURI: "", rate: 1, pitch: 0.7, volume: 1, speakOnPhrase: true, spanglish: true, settingsVersion: 2 },
    load(KEYS.settings, {})
  );
  // Migración: aplica el tono grave por defecto a quienes ya tenían ajustes,
  // respetando el valor si lo habían cambiado a algo distinto de 1.
  if (settings.settingsVersion !== 2) {
    if (settings.pitch === 1 || settings.pitch == null) settings.pitch = 0.7;
    settings.settingsVersion = 2;
    save(KEYS.settings, settings);
  }
  let phrases = load(KEYS.phrases, DEFAULT_PHRASES);
  // Si por lo que sea se guardó una lista vacía, recuperamos las de por defecto.
  if (!Array.isArray(phrases) || phrases.length === 0) phrases = DEFAULT_PHRASES.slice();
  let history = load(KEYS.history, []);

  // --- Detección de inglés (para Spanglish) ---
  // Palabras inglesas frecuentes en español que NO tienen letras/combinaciones
  // "delatoras" (se detectan por lista); las demás se detectan por heurística.
  const ENGLISH_WORDS = new Set([
    "email", "manager", "random", "outfit", "post", "posts", "story", "stories",
    "reel", "reels", "influencer", "podcast", "spoiler", "trailer", "briefing",
    "hater", "haters", "gamer", "selfie", "selfies", "casting", "meeting",
    "streaming", "shopping", "running", "gaming", "boarding", "deadline",
    "feedback", "brunch", "hobby", "fitness", "workout", "fit", "cool", "look",
    "looks", "crush", "match", "player", "team", "call", "chill", "trend",
    "trending", "boomer", "millennial", "hype", "flow", "vibe", "vibes",
    "playlist", "hashtag", "link", "links", "click", "clicks", "software",
    "hardware", "backup", "login", "logout", "update", "smartphone", "laptop",
    "tablet", "gadget", "startup", "freelance", "remote", "office", "coworking",
    "networking", "coach", "coaching", "sorry", "please", "ok", "okay", "yes",
    "nice", "wow", "top", "best", "friend", "friends", "happy", "birthday",
    "weekend", "party", "after", "delivery", "rider", "packaging", "trekking",
    "casual", "vintage", "outlet", "sale", "black", "friday",
  ]);

  // Excepciones: llevan k/w pero son palabras usadas en español -> NO inglés.
  const SPANISH_KW = new Set([
    "kilo", "kilos", "kilómetro", "kilómetros", "kiwi", "kiosco", "koala",
    "karate", "kart", "web", "wifi", "whatsapp", "waterpolo", "wc", "kit",
  ]);

  function isEnglishToken(raw) {
    const w = raw.toLowerCase().replace(/[^a-záéíóúñü]/gi, "");
    if (w.length < 2) return false;
    if (/[áéíóúñ]/.test(w)) return false;                 // acento/ñ => español
    if (SPANISH_KW.has(w)) return false;
    if (ENGLISH_WORDS.has(w) || ENGLISH_WORDS.has(w.replace(/s$/, ""))) return true;
    if (/(sh|th|ght|wh|ck|oo|ee|ea|ph| mp3)/.test(w)) return true; // clusters ingleses
    if (/[kw]/.test(w)) return true;                       // k/w no exceptuadas
    return false;
  }

  // Divide el texto en tramos consecutivos por idioma, conservando espacios.
  function segmentByLang(text) {
    const tokens = text.match(/\s+|[^\s]+/g) || [];
    const segs = [];
    let cur = null;
    for (const t of tokens) {
      if (/^\s+$/.test(t)) {
        if (cur) cur.text += t;
        else cur = { text: t, lang: "es" };
        continue;
      }
      const lang = isEnglishToken(t) ? "en" : "es";
      if (cur && cur.lang === lang) cur.text += t;
      else {
        if (cur) segs.push(cur);
        cur = { text: t, lang };
      }
    }
    if (cur) segs.push(cur);
    return segs;
  }

  // --- Voces ---
  let voices = [];
  let esVoice = null; // voz elegida en español
  let enVoice = null; // mejor voz en inglés (para el Spanglish)

  // Nombres masculinos habituales de voces en español (iOS/Android/Windows).
  const MALE_ES_NAMES = [
    "jorge", "diego", "carlos", "enrique", "pablo", "juan", "marco",
    "miguel", "javier", "pedro", "raul", "raúl", "gonzalo", "andres", "andrés",
  ];

  function isNatural(v) {
    return /enhanced|premium|siri|neural|natural/i.test(v.voiceURI + " " + v.name);
  }
  function isCompact(v) {
    return /compact/i.test(v.voiceURI);
  }
  const MALE_EN_NAMES = ["daniel", "aaron", "arthur", "fred", "rishi", "oliver", "george", "reed", "tom", "alex"];
  function isMaleName(v, names) {
    return names.some((n) => v.name.toLowerCase().includes(n));
  }

  // Puntúa voces en español: castellano + hombre + natural = mejor.
  function esScore(v) {
    const lang = (v.lang || "").toLowerCase();
    let s = 0;
    if (lang.startsWith("es-es")) s += 100;      // castellano de España
    else if (lang.startsWith("es")) s += 40;     // otro español
    if (isNatural(v)) s += 30;                    // voz natural/mejorada
    if (isCompact(v)) s -= 25;                    // voz compacta = robótica
    if (isMaleName(v, MALE_ES_NAMES)) s += 20;    // voz de hombre
    return s;
  }
  // Puntúa voces en inglés (para el Spanglish): hombre + natural mejor.
  function enScore(v) {
    let s = 0;
    if (isNatural(v)) s += 30;
    if (isCompact(v)) s -= 25;
    if (isMaleName(v, MALE_EN_NAMES)) s += 20;
    if (/en-us|en-gb/i.test(v.lang)) s += 10;
    return s;
  }

  function voiceLabel(v) {
    let tag = "";
    if (isNatural(v)) tag = " · ★ natural";
    else if (isCompact(v)) tag = " · básica";
    return `${v.name} (${v.lang})${tag}`;
  }

  function bestBy(list, scoreFn) {
    if (!list.length) return null;
    return list
      .map((v) => ({ v, score: scoreFn(v) }))
      .sort((a, b) => b.score - a.score)[0].v;
  }

  function populateVoices() {
    voices = synth.getVoices();

    // El desplegable solo muestra voces en español (lista corta).
    const esVoices = voices
      .filter((v) => /^es/i.test(v.lang))
      .map((v) => ({ v, score: esScore(v) }))
      .sort((a, b) => b.score - a.score)
      .map((x) => x.v);

    voiceSelect.innerHTML = "";
    esVoices.forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v.voiceURI;
      opt.textContent = voiceLabel(v);
      voiceSelect.appendChild(opt);
    });
    if (!esVoices.length) {
      const opt = document.createElement("option");
      opt.textContent = "No hay voces en español disponibles";
      opt.disabled = true;
      voiceSelect.appendChild(opt);
    }

    // Voz española: la guardada por el usuario, o la mejor puntuada.
    if (settings.voiceURI && esVoices.some((v) => v.voiceURI === settings.voiceURI)) {
      voiceSelect.value = settings.voiceURI;
    } else if (esVoices.length) {
      voiceSelect.value = esVoices[0].voiceURI;
      settings.voiceURI = esVoices[0].voiceURI;
    }
    esVoice = voices.find((v) => v.voiceURI === settings.voiceURI) || esVoices[0] || null;

    // Mejor voz en inglés (oculta), para pronunciar el Spanglish.
    enVoice = bestBy(voices.filter((v) => /^en/i.test(v.lang)), enScore);
    enVoiceName.textContent = enVoice ? `(${enVoice.name})` : "(no hay voz inglesa)";
  }

  // --- Hablar ---
  // Reparte los tramos en español/inglés (o uno solo si no hay Spanglish).
  function makeSegments(text) {
    return settings.spanglish ? segmentByLang(text) : [{ text, lang: "es" }];
  }

  function speak(text, chip) {
    text = (text || "").trim();
    if (!text) return;
    if (!synth) {
      alert("Tu navegador no soporta síntesis de voz.");
      return;
    }
    synth.cancel(); // corta lo anterior para respuesta rápida

    const segments = makeSegments(text);
    stopBtn.disabled = false;
    if (chip) chip.classList.add("speaking");
    const finish = () => {
      stopBtn.disabled = true;
      if (chip) chip.classList.remove("speaking");
    };

    segments.forEach((seg, i) => {
      const u = new SpeechSynthesisUtterance(seg.text);
      const voice = seg.lang === "en" ? enVoice : esVoice;
      if (voice) {
        u.voice = voice;
        u.lang = voice.lang;
      } else {
        u.lang = seg.lang === "en" ? "en-US" : "es-ES";
      }
      u.rate = settings.rate;
      u.pitch = settings.pitch;   // tono grave por defecto => suena más masculina
      u.volume = settings.volume;
      if (i === segments.length - 1) {
        u.onend = finish;
        u.onerror = finish;
      }
      synth.speak(u);
    });
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

  spanglish.checked = settings.spanglish;
  spanglish.addEventListener("change", () => {
    settings.spanglish = spanglish.checked;
    save(KEYS.settings, settings);
  });

  refreshVoices.addEventListener("click", () => {
    populateVoices();
    // Un habla muy corta a veces obliga a iOS a exponer voces recién bajadas.
    const ping = new SpeechSynthesisUtterance(" ");
    ping.volume = 0;
    ping.onend = populateVoices;
    synth.speak(ping);
  });

  testVoice.addEventListener("click", () =>
    speak("Hola, esta es una prueba de voz. This is an English test.")
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
    const next = phrasesEditor.value
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    // Nunca dejamos la lista vacía: si borras todo, se vuelve a las de por defecto.
    phrases = next.length ? next : DEFAULT_PHRASES.slice();
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
  // iOS puebla la lista de voces con retraso: reintentamos unas veces.
  [300, 1200, 2500].forEach((ms) => setTimeout(populateVoices, ms));
  renderPhrases();
  renderHistory();

  // Service worker (offline / instalable)
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
})();
