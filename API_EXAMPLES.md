# Landscape Vault API Examples

This document demonstrates programmatic access to `LandscapeDraw` in Node.js, client-side JavaScript, and iframe embedding.

---

## 1. Node.js Programmatic Synthesis

`js/landscapedraw.js` is a universal UMD module that executes in Node.js with zero dependencies:

```javascript
const fs = require('fs');
const LandscapeDraw = require('./js/landscapedraw.js');

// 1. Synthesize from narrative seed
const specimen = LandscapeDraw.synthesize("Solitary Fishing Boat on Cold River at Dusk", {
  width: 1200,
  height: 800,
  pigment: "blue-green" // "pine-soot" | "shallow-umber" | "blue-green" | "golden-dusk" | "mist-ink"
});

console.log("Accession ID:", specimen.id); // e.g. LSV-XX-XXXXXX
console.log("Derived Title:", specimen.metrics.zhTitle, "-", specimen.metrics.title);
console.log("Scroll Format:", specimen.metrics.format);
console.log("Mountain Morphology:", specimen.metrics.morphology);
console.log("Vegetation Canopy:", specimen.metrics.vegetation);
console.log("Hydrography:", specimen.metrics.hydrography);

// 2. Generate Archival SVG Plate
const svgString = LandscapeDraw.generateSvgPlate(specimen);
fs.writeFileSync(`${specimen.id}_plate.svg`, svgString);

// 3. Lossless Seed Recovery from Accession ID
const recovered = LandscapeDraw.synthesize(specimen.id, {
  width: 1200,
  height: 800,
  pigment: "blue-green"
});

console.log("Identical output:", specimen.svgContent === recovered.svgContent); // true
```

---

## 2. Browser Client-Side Usage

```html
<!DOCTYPE html>
<html>
<head>
  <script src="/js/landscapedraw.js"></script>
</head>
<body>
  <div id="plate-container"></div>

  <script>
    // Synthesize landscape
    const specimen = LandscapeDraw.synthesize("Towering Granite Spire Piercing Morning Clouds", {
      width: 1422,
      height: 800,
      pigment: "pine-soot"
    });

    // Generate plate SVG and inject into DOM
    const svgPlate = LandscapeDraw.generateSvgPlate(specimen);
    document.getElementById('plate-container').innerHTML = svgPlate;
  </script>
</body>
</html>
```

---

## 3. High-Resolution PNG Export (300 DPI)

```javascript
async function exportHighResPng(specimen) {
  const offscreenCanvas = document.createElement('canvas');
  const exportScale = 2400;
  const ratio = specimen.vWidth / specimen.vHeight;
  
  if (ratio >= 1) {
    offscreenCanvas.width = Math.round(exportScale * ratio);
    offscreenCanvas.height = exportScale;
  } else {
    offscreenCanvas.width = exportScale;
    offscreenCanvas.height = Math.round(exportScale / ratio);
  }

  await LandscapeDraw.renderToCanvas(specimen, offscreenCanvas, {
    width: offscreenCanvas.width,
    height: offscreenCanvas.height
  });

  return new Promise((resolve) => {
    offscreenCanvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}
```

---

## 4. Iframe Embed Protocol

Embed Landscape Vault directly into external portals:

```html
<iframe 
  src="https://landscape-vault.glassgallery.my.id/?id=LSV-0B-B2493C&pigment=pine-soot&w=3&h=2&mode=embed" 
  width="100%" 
  height="600" 
  frameborder="0" 
  style="border:1px solid #DDD5C5; background:#EFE9DC;" 
  allowfullscreen>
</iframe>
```

---

## 5. PostMessage API Controller

Dynamically control embedded iframe specimens in real-time:

```javascript
const iframe = document.querySelector('iframe');

// Re-synthesize with new narrative and blue-green mineral pigment
iframe.contentWindow.postMessage({
  seed: "Thousand Li of Rivers and Emerald Mountains",
  pigment: "blue-green",
  w: 16,
  h: 9
}, "*");

// Switch by accession ID
iframe.contentWindow.postMessage({
  id: "LSV-39-DB6D68",
  pigment: "golden-dusk"
}, "*");
```
