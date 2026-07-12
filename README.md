# SpeakText

Webapp sencilla de **text-to-speech** para uso propio durante el **reposo vocal**.
Escribe (o toca una frase rápida) y el dispositivo lo dice por ti — rápido, natural y sin instalar nada.

## Características

- 🗣️ **Voz natural del sistema** vía Web Speech API (sin servidor, sin cuentas).
- ⚡ **Frases rápidas** editables para comunicar al instante ("Sí", "Gracias", "Estoy en reposo vocal…").
- 🎚️ Ajustes de **voz, velocidad, tono y volumen**, guardados en el dispositivo.
- 🕘 **Historial** de lo último dicho, para repetir con un toque.
- 📱 **PWA**: instalable en el móvil y funciona **offline**.
- ⌨️ Atajo: `Ctrl` / `⌘` + `Enter` para hablar.

## Uso

Al ser 100% estática, basta con servir la carpeta por HTTPS (o `localhost`).
El service worker y varias voces requieren un contexto seguro.

### Local

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```

### Publicar (GitHub Pages)

1. Sube esta rama y activa **Pages** apuntando a la carpeta raíz.
2. Abre la URL en el móvil → menú del navegador → **Añadir a pantalla de inicio**.

## Notas

- La cantidad y calidad de voces depende del sistema/navegador. En iOS y Android
  suelen sonar muy naturales; en escritorio, Chrome y Edge ofrecen buenas voces.
- Todo (frases, ajustes, historial) se guarda solo en tu dispositivo (`localStorage`).
