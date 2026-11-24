# Planes

Cuaderno de planes y salidas. Cada plan es una tarjeta con título, descripción, enlaces de actividades, fecha y presupuesto por conceptos (gasolina, actividad, transporte, material…). Todo es opcional.

Orden: primero los planes con fecha, del más próximo al más lejano; después los que no tienen fecha; los ya pasados quedan plegados al final en «Ya vividos».

## Cómo funciona

- **Web**: estática (`index.html`, `styles.css`, `app.js`), publicada con GitHub Pages.
- **Base de datos**: una hoja de Google Sheets (pestaña `Planes`).
- **API**: un Google Apps Script desplegado como aplicación web (`apps-script/Code.gs`). Su URL está en `config.js`.
- **Clave**: la web pide una clave la primera vez y la recuerda en el navegador. Se define en la constante `CLAVE` del Apps Script.

## Cambiar la clave

1. Abre el proyecto *Planes API* en script.google.com y cambia `CLAVE`.
2. Implementar → Gestionar implementaciones → editar (lápiz) → Versión: *Nueva versión* → Implementar. La URL no cambia.
3. En la web, pulsa «Cambiar clave» al pie de página.
