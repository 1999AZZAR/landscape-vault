# Landscape Vault

> Archival procedural Chinese landscape scroll synthesis engine, Shan Shui (山水画) vector plate repository, and topographical telemetry system.

Landscape Vault is a production-grade procedural generative engine and digital specimen vault adapted from Lingdong Huang's classic *shan-shui-inf* (2018) and re-architected under Azzar Budiyanto's Swiss-Archival design system. It procedurally generates authentic Chinese classical landscape paintings featuring towering mountain peaks, rock strata, riverbanks, ancient pines, footbridges, secluded pagodas, flying cranes, and solitary boatmen.

---

## Technical Architecture

```
+--------------------------------------------------------------------------+
|                            LANDSCAPE VAULT                               |
|                  Port 8088 // Swiss-Archival Standard                    |
+--------------------------------------------------------------------------+
       |                                                    |
       v                                                    v
[ Narrative Seed Input ]                             [ Accession ID ]
  "Misty Peaks in Autumn"                              "LSV-0B-B2493C"
       |                                                    |
       +-----------------------+----------------------------+
                               |
                               v
                     [ 32-bit FNV-1a Hash ]
                               |
                               v
               [ Isolated PRNG & Perlin Noise ]
                               |
         +---------------------+---------------------+
         |                     |                     |
         v                     v                     v
 [ Distant Ridges &     [ Main Mountain Crags &   [ Riverbanks, Boats &
   Flying Cranes ]        Pagodas / Bridges ]       Water Currents ]
   Mount.distMount        Mount.mountain            Mount.flatMount
   generateCraneFlock     Tree.tree01-08            Arch.boat01 / water
         |                     |                     |
         +---------------------+---------------------+
                               |
                               v
                  [ Depth-Sorted Chunk Canvas ]
                    Painter's Order (y-sort)
                               |
                               v
                   [ Pigment Wash Remapping ]
            Pine Soot / Shallow Umber / Blue-Green /
                  Golden Dusk / Mist Ink
                               |
                               v
                [ Swiss-Archival Drafting Plate ]
           - Dual Technical Drafting Borders
           - Topographical Survey Scale Bar (10 Li / 5 Km)
           - Cinnabar Vermilion Seal Chop (山水典藏)
           - Vector Hershey Cursive Latin Binomen
                               |
         +---------------------+---------------------+
         |                     |                     |
         v                     v                     v
   [ Web UI / PWA ]     [ Standalone SVG ]     [ 300 DPI PNG ]
```

---

## Key Features

1. **Procedural Shan Shui Generation:**
   - Evaluates multi-octave 2D Perlin noise fields to dynamically locate mountain ridges, erosion ravines, and plateaus.
   - Generates 8 distinct procedural tree species (conifers, bamboos, deciduous foliage, weeping willows).
   - Places traditional Chinese architectural structures (cliff pavilions, tiered pagodas, thatched huts, arched stone footbridges).
   - Injects calligraphic flying crane flocks and solitary river boatmen.

2. **Swiss-Archival Design System:**
   - Technical minimalism on cold-press Xuan paper (`#EFE9DC` / `#E8E0D0`).
   - Dual drafting border rules with precise corner offsets.
   - 10 Li / 5 Km distance survey scale bar calibrated for 1:50,000 scale cartography.
   - Four-character square cinnabar vermilion seal chop: `山水典藏` (*Shan Shui Archival Collection*).
   - Latin binomen calligraphy rendered with vector Hershey cursive strokes (*Montes Nebulosi et Flumina*).

3. **Lossless Recovery & Accession Identifiers:**
   - Uniform 32-bit FNV-1a hashing ensures every narrative maps deterministically to a unique landscape.
   - Accession IDs follow the standard `LSV-XX-XXXXXX` format.
   - Entering an Accession ID restores the exact seed and reproduces the identical vector plate.

4. **Aspect Ratio Matrix (9 Formats):**
   - 1:1 (Square Album Leaf / 斗方)
   - 4:5 (Classical Hanging Scroll / 立轴)
   - 3:4 (Medium Vertical Scroll / 竖轴)
   - 2:3 (Golden Ratio Hanging Scroll / 挂轴)
   - 9:16 (Towering Vertical Scroll / 高远立轴)
   - 5:4 (Display Horizontal Plate / 横幅)
   - 4:3 (Traditional Horizontal Scroll / 横轴)
   - 3:2 (Handscroll Leaf / 册页)
   - 16:9 (Panoramic Continuous Handscroll / 平远长卷)

5. **Pigment Wash Styles:**
   - **Pine Soot (墨黑):** Classical monochrome carbon pine soot ink on warm Xuan paper.
   - **Shallow Umber (浅绛):** Yuan dynasty Qianjiang style with raw umber, sienna, and tea washes.
   - **Blue-Green (青绿):** Tang and Song dynasty azurite and malachite mineral washes.
   - **Golden Dusk (金碧):** Imperial gold ochre with cinnabar vermilion mountain ridge accents.
   - **Mist Ink (云烟):** Mi Fu atmospheric cloud mountains with cool slate and silver mist washes.

6. **Topographical Telemetry Card:**
   - Real-time extraction of derived Latin binomen and Chinese title.
   - Mountain morphology classification (Granitic Crags, Sandstone Pinnacles, Terraced Karst, Rolling Loess).
   - Vegetation canopy analysis (Ancient Pines & Willows, Bamboo, Alpine Shrub).
   - Hydrography metrics (River Basin, Mirror Lake, Cascading Torrent).
   - Architectural habitation and human presence tracking.
   - Estimated peak density and Li span.

7. **Production Exports & Embed Protocols:**
   - Standalone clean vector SVG file download and clipboard copy.
   - 300 DPI high-resolution PNG rendering via offscreen canvas.
   - Fullscreen modal inspection with pan and zoom.
   - Iframe embed mode (`mode=embed`) and two-way `postMessage` control API.
   - Offline-capable Progressive Web Application (PWA) with Service Worker and manifest.

---

## Deployment & Docker

Landscape Vault is configured to run on port `8088`.

```bash
# Build and run container
docker compose up -d --build

# View container logs
docker compose logs -f landscape-vault

# Verify running container
docker compose ps
```

The service will be live at:
```
http://localhost:8088/
```

---

## Local Development

Landscape Vault is self-contained and requires no build tools or package managers:

```bash
# Clone repository
git clone https://github.com/1999AZZAR/landscape-vault.git
cd landscape-vault

# Serve with Python
python3 -m http.server 8088

# Or serve with Node.js
npx serve -l 8088 .
```

---

## File Structure

```
landscape-vault/
├── js/
│   └── landscapedraw.js      # Procedural landscape engine & Hershey font
├── index.html                # Web vault GUI & Topographical Telemetry card
├── docs.html                 # Technical documentation & embed guide
├── manifest.json             # Web App Manifest
├── sw.js                     # Offline Service Worker (cache landscape-vault-v1.0.0)
├── icon-192.svg              # 192x192 PWA Icon
├── icon-512.svg              # 512x512 PWA Icon
├── icon-maskable.svg         # Maskable PWA Icon
├── nginx.conf                # Nginx configuration (gzip, caching, CORS)
├── Dockerfile                # Alpine Nginx container build
├── docker-compose.yml        # Docker compose configuration (port 8088:80)
├── .dockerignore             # Docker build ignore rules
├── .gitignore                # Git repository ignore rules
├── API_EXAMPLES.md           # Programmatic code examples
├── QUICKSTART.md             # Concise quickstart instructions
├── llms.txt                  # LLM agent specification
├── LICENSE                   # MIT License
└── README.md                 # System overview and architecture
```

---

## Attribution & License

- Core procedural algorithms adapted from Lingdong Huang's *shan-shui-inf* (2018).
- Designed and re-engineered by Azzar Budiyanto (2026).
- Released under the MIT License. See `LICENSE` for details.
