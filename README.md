# Tofarati Farinu · Tech Portfolio

Personal portfolio, live at https://tman6290.github.io/Tofarati_Farinu_Tech_Portfolio

## What it is
A scroll-driven site where each project chapter has its own GPU-rendered world. No framework, no build step.

- `index.html` · markup only
- `css/styles.css` · design tokens, per-chapter themes, layout, the drawn project renders
- `js/world.js` · WebGL2 fragment shaders (warp tunnel, neural lattice, vinyl disc, gyroid) and the post pass (chromatic aberration, bloom, grain)
- `js/app.js` · scroll engine, particle name, chapters and theme switching, HUD, cursor, keyboard navigation
- `js/relics.js` · three.js point-cloud objects that assemble and disintegrate per chapter; GSAP ScrollTrigger entrances
- `js/main.js` · the frame loop
- `TofaratiFarinu_CV.pdf` · linked from the hero
- `images/` · project screenshots: source PNGs plus the WebP (720/1280/1800w) and JPEG files the page serves

External: GSAP 3.12 (deferred) and three.js r149 (loaded after the page is idle, skipped on data saver) from CDNs, Syne / Geist / Geist Mono from Google Fonts.

## Run locally
Open `index.html` in a browser, or serve the folder (`npx serve .`). Add `?q=0.3` to render the world at 30% resolution on a slow machine.

## Deploy
GitHub Pages: Settings → Pages → Deploy from a branch → `main`, `/ (root)`.
