# Landscape Vault Quickstart

Landscape Vault is an archival procedural Chinese landscape painting (Shan Shui / 山水画) synthesis engine and vector plate repository.

## Running with Docker (Recommended)

To build and start the container on port `8088`:

```bash
docker compose up -d --build
```

Access the service locally:
```
http://localhost:8088/
```

Verify service status:
```bash
docker compose ps
docker compose logs landscape-vault
```

To stop the service:
```bash
docker compose down
```

## Running without Docker (Static Server)

Landscape Vault is a zero-dependency static web application and can be served with any static web server:

```bash
# Using Python
python3 -m http.server 8088

# Using Node.js npx
npx serve -l 8088 .
```

## Programmatic Node.js Usage

```javascript
const LandscapeDraw = require('./js/landscapedraw.js');

// Synthesize from narrative seed
const specimen = LandscapeDraw.synthesize("Misty Mountain Peaks in Late Autumn Solitude", {
  width: 1200,
  height: 800,
  pigment: "pine-soot"
});

console.log("Accession ID:", specimen.id);
console.log("Title:", specimen.metrics.zhTitle, specimen.metrics.title);

// Generate standalone SVG plate
const svgString = LandscapeDraw.generateSvgPlate(specimen);
require('fs').writeFileSync('specimen.svg', svgString);
```
