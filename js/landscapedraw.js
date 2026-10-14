/**
 * Landscape Vault // Archival Shan Shui Procedural Synthesis Engine (LandscapeDraw)
 * Procedural Chinese landscape painting scroll and vector plate generator.
 *
 * Based on Lingdong Huang's shan-shui-inf (2018) and Azzar Budiyanto's Archival Vault Suite.
 * Core design: Swiss-Archival technical minimalism, deterministic narrative seeds,
 * losslessly recoverable accession IDs, and topographical morphometrics.
 */

(function(root, factory) {
  if (typeof define === "function" && define.amd) {
    define([], factory);
  } else if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.LandscapeDraw = factory();
  }
}(typeof self !== "undefined" ? self : this, function() {
  // non-strict for Lingdong 2018 procedural algorithms compatibility

  // ============================================================================
  // Deterministic Hashing & Accession ID Systems
  // ============================================================================

  function fnv1a(str) {
    var hash = 2166136261;
    for (var i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function seedToId(seed) {
    var hex = (seed >>> 0).toString(16).toUpperCase().padStart(8, "0");
    return "LSV-" + hex.substring(0, 2) + "-" + hex.substring(2);
  }

  function idToSeed(id) {
    if (!id || typeof id !== "string") return 0;
    var clean = id.trim().replace(/^LSV-?/i, "").replace(/[^0-9A-Fa-f]/g, "");
    if (clean.length < 8) return 0;
    return parseInt(clean.substring(0, 8), 16) >>> 0;
  }

  // ============================================================================
  // Isolated Deterministic PRNG & Perlin Noise Engine
  // ============================================================================

  function PrngEngine() {
    this.s = 1234;
    this.p = 999979;
    this.q = 999983;
    this.m = this.p * this.q;
  }
  PrngEngine.prototype.hash = function(x) {
    var str = JSON.stringify(x);
    var z = 0;
    for (var i = 0; i < str.length; i++) {
      z = (z + str.charCodeAt(i) * Math.pow(128, i % 4)) % this.m;
    }
    return z;
  };
  PrngEngine.prototype.seed = function(x) {
    if (x == null) x = Date.now();
    var val = typeof x === "number" ? x : this.hash(x);
    var y = 0, z = 0;
    var self = this;
    function redo() {
      y = (val + z) % self.m;
      z += 1;
    }
    while (y % this.p === 0 || y % this.q === 0 || y === 0 || y === 1) {
      redo();
    }
    this.s = y;
    for (var i = 0; i < 10; i++) this.next();
  };
  PrngEngine.prototype.next = function() {
    this.s = (this.s * this.s) % this.m;
    return this.s / this.m;
  };

  function NoiseEngine(prng) {
    this.prng = prng;
    this.PERLIN_YWRAPB = 4;
    this.PERLIN_YWRAP = 1 << this.PERLIN_YWRAPB;
    this.PERLIN_ZWRAPB = 8;
    this.PERLIN_ZWRAP = 1 << this.PERLIN_ZWRAPB;
    this.PERLIN_SIZE = 4095;
    this.perlin_octaves = 4;
    this.perlin_amp_falloff = 0.5;
    this.perlin = null;
  }
  NoiseEngine.prototype.scaled_cosine = function(i) {
    return 0.5 * (1.0 - Math.cos(i * Math.PI));
  };
  NoiseEngine.prototype.seedNoise = function(seed) {
    this.perlin = new Array(this.PERLIN_SIZE + 1);
    var lcg = { s: (seed >>> 0) || 1234, rand: function() { this.s = (this.s * 1664525 + 1013904223) >>> 0; return this.s / 4294967296; } };
    for (var i = 0; i < this.PERLIN_SIZE + 1; i++) {
      this.perlin[i] = lcg.rand();
    }
  };
  NoiseEngine.prototype.noise = function(x, y, z) {
    y = y || 0;
    z = z || 0;
    if (!this.perlin) {
      this.seedNoise(12345);
    }
    if (x < 0) x = -x;
    if (y < 0) y = -y;
    if (z < 0) z = -z;
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    var rxf, ryf;
    var r = 0, ampl = 0.5;
    var n1, n2, n3;
    for (var o = 0; o < this.perlin_octaves; o++) {
      var of = xi + (yi << this.PERLIN_YWRAPB) + (zi << this.PERLIN_ZWRAPB);
      rxf = this.scaled_cosine(xf);
      ryf = this.scaled_cosine(yf);
      n1 = this.perlin[of & this.PERLIN_SIZE];
      n1 += rxf * (this.perlin[(of + 1) & this.PERLIN_SIZE] - n1);
      n2 = this.perlin[(of + this.PERLIN_YWRAP) & this.PERLIN_SIZE];
      n2 += rxf * (this.perlin[(of + this.PERLIN_YWRAP + 1) & this.PERLIN_SIZE] - n2);
      n1 += ryf * (n2 - n1);
      of += this.PERLIN_ZWRAP;
      n2 = this.perlin[of & this.PERLIN_SIZE];
      n2 += rxf * (this.perlin[(of + 1) & this.PERLIN_SIZE] - n2);
      n3 = this.perlin[(of + this.PERLIN_YWRAP) & this.PERLIN_SIZE];
      n3 += rxf * (this.perlin[(of + this.PERLIN_YWRAP + 1) & this.PERLIN_SIZE] - n3);
      n2 += ryf * (n3 - n2);
      n1 += this.scaled_cosine(zf) * (n2 - n1);
      r += n1 * ampl;
      ampl *= this.perlin_amp_falloff;
      xi <<= 1; xf *= 2;
      yi <<= 1; yf *= 2;
      zi <<= 1; zf *= 2;
      if (xf >= 1.0) { xi++; xf--; }
      if (yf >= 1.0) { yi++; yf--; }
      if (zf >= 1.0) { zi++; zf--; }
    }
    return r;
  };

  // ============================================================================
  // Authentic Hershey Vector Font Engine (Vector Glyphs & Pen-Up)
  // ============================================================================

  const HERSHEY_RAW = {
    "501":"  9I[RFJ[ RRFZ[ RMTWT",
    "502":" 24G\\KFK[ RKFTFWGXHYJYLXNWOTP RKPTPWQXRYTYWXYWZT[K[",
    "503":" 19H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZV",
    "504":" 16G\\KFK[ RKFRFUGWIXKYNYSXVWXUZR[K[",
    "505":" 12H[LFL[ RLFYF RLPTP RL[Y[",
    "506":"  9HZLFL[ RLFYF RLPTP",
    "507":" 23H]ZKYIWGUFQFOGMILKKNKSLVMXOZQ[U[WZYXZVZS RUSZS",
    "508":"  9G]KFK[ RYFY[ RKPYP",
    "509":"  3NVRFR[",
    "510":" 11JZVFVVUYTZR[P[NZMYLVLT",
    "511":"  9G\\KFK[ RYFKT RPOY[",
    "512":"  6HYLFL[ RL[X[",
    "513":" 12F^JFJ[ RJFR[ RZFR[ RZFZ[",
    "514":"  9G]KFK[ RKFY[ RYFY[",
    "515":" 22G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF",
    "516":" 14G\\KFK[ RKFTFWGXHYJYMXOWPTQKQ",
    "517":" 25G]PFNGLIKKJNJSKVLXNZP[T[VZXXYVZSZNYKXIVGTFPF RSWY]",
    "518":" 17G\\KFK[ RKFTFWGXHYJYLXNWOTPKP RRPY[",
    "519":" 21H\\YIWGTFPFMGKIKKLMMNOOUQWRXSYUYXWZT[P[MZKX",
    "520":"  6JZRFR[ RKFYF",
    "521":" 11G]KFKULXNZQ[S[VZXXYUYF",
    "522":"  6I[JFR[ RZFR[",
    "523":" 12F^HFM[ RRFM[ RRFW[ R\\FW[",
    "524":"  6H\\KFY[ RYFK[",
    "525":"  7I[JFRPR[ RZFRP",
    "526":"  9H\\YFK[ RKFYF RK[Y[",
    "601":" 18I\\XMX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
    "602":" 18H[LFL[ RLPNNPMSMUNWPXSXUWXUZS[P[NZLX",
    "603":" 15I[XPVNTMQMONMPLSLUMXOZQ[T[VZXX",
    "604":" 18I\\XFX[ RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
    "605":" 18I[LSXSXQWOVNTMQMONMPLSLUMXOZQ[T[VZXX",
    "606":"  9MYWFUFSGRJR[ ROMVM",
    "607":" 23I\\XMX]W`VaTbQbOa RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
    "608":" 11I\\MFM[ RMQPNRMUMWNXQX[",
    "609":"  9NVQFRGSFREQF RRMR[",
    "610":" 12MWRFSGTFSERF RSMS^RaPbNb",
    "611":"  9IZMFM[ RWMMW RQSX[",
    "612":"  3NVRFR[",
    "613":" 19CaGMG[ RGQJNLMOMQNRQR[ RRQUNWMZM\\N]Q][",
    "614":" 11I\\MMM[ RMQPNRMUMWNXQX[",
    "615":" 18I\\QMONMPLSLUMXOZQ[T[VZXXYUYSXPVNTMQM",
    "616":" 18H[LMLb RLPNNPMSMUNWPXSXUWXUZS[P[NZLX",
    "617":" 18I\\XMXb RXPVNTMQMONMPLSLUMXOZQ[T[VZXX",
    "618":"  9KXOMO[ ROSPPRNTMWM",
    "619":" 18J[XPWNTMQMNNMPNRPSUTWUXWXXWZT[Q[NZMX",
    "620":"  9MYRFRWSZU[W[ ROMVM",
    "621":" 11I\\MMMWNZP[S[UZXW RXMX[",
    "622":"  6JZLMR[ RXMR[",
    "623":" 12G]JMN[ RRMN[ RRMV[ RZMV[",
    "624":"  6J[MMX[ RXMM[",
    "625":" 10JZLMR[ RXMR[P_NaLbKb",
    "626":"  9J[XMM[ RMMXM RM[X[",
    "710":"  6MWRYQZR[SZRY"
  };

  const hersheyCache = {};

  function compile_hershey(i) {
    if (hersheyCache[i]) return hersheyCache[i];
    const entry = HERSHEY_RAW[i];
    if (!entry) return null;
    const ordR = 82;
    const bound = entry.substring(3, 5);
    const xmin = bound.charCodeAt(0) - ordR;
    const xmax = bound.charCodeAt(1) - ordR;
    const content = entry.substring(5);
    const polylines = [[]];
    let j = 0;
    while (j < content.length) {
      const digit = content.substring(j, j + 2);
      if (digit === " R") {
        polylines.push([]);
      } else {
        const x = digit.charCodeAt(0) - ordR;
        const y = digit.charCodeAt(1) - ordR;
        polylines[polylines.length - 1].push([x, y]);
      }
      j += 2;
    }
    const data = { xmin, xmax, polylines };
    hersheyCache[i] = data;
    return data;
  }

  function put_text(txt) {
    const base = 500;
    let x = 0;
    const o = [];
    for (let i = 0; i < txt.length; i++) {
      const ord = txt.charCodeAt(i);
      let idx;
      if (65 <= ord && ord <= 90) {
        idx = base + 1 + (ord - 65);
      } else if (97 <= ord && ord <= 122) {
        idx = base + 101 + (ord - 97);
      } else if (ord === 46) {
        idx = 710;
      } else if (ord === 32) {
        x += 10;
        continue;
      } else {
        continue;
      }
      const h = compile_hershey(idx);
      if (!h) continue;
      for (const poly of h.polylines) {
        if (poly.length === 0) continue;
        o.push(poly.map(p => [p[0] + x - h.xmin, p[1]]));
      }
      x += (h.xmax - h.xmin);
    }
    return [x, o];
  }

  function hersheyToSvgPaths(text, x, y, scale) {
    scale = scale || 0.35;
    const res = put_text(text);
    const polylines = res[1];
    let paths = "";
    for (const poly of polylines) {
      if (poly.length === 0) continue;
      let d = "";
      for (let i = 0; i < poly.length; i++) {
        const gx = (x + poly[i][0] * scale).toFixed(1);
        const gy = (y + poly[i][1] * scale).toFixed(1);
        if (i === 0) d += "M " + gx + " " + gy;
        else d += " L " + gx + " " + gy;
      }
      paths += '<path d="' + d + '" fill="none" />\n';
    }
    return paths;
  }

  function renderHersheyText(ctx, text, x, y, scale, color) {
    scale = scale || 0.35;
    color = color || "#2A2520";
    const res = put_text(text);
    const totalWidth = res[0];
    const polylines = res[1];
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.0;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const poly of polylines) {
      if (poly.length === 0) continue;
      ctx.beginPath();
      for (let i = 0; i < poly.length; i++) {
        const gx = x + poly[i][0] * scale;
        const gy = y + poly[i][1] * scale;
        if (i === 0) ctx.moveTo(gx, gy);
        else ctx.lineTo(gx, gy);
      }
      ctx.stroke();
    }
    ctx.restore();
    return totalWidth * scale;
  }

  // ============================================================================
  // Procedural Crane Flocks Generator (Mountain Cranes & Geese)
  // ============================================================================

  function generateCraneFlock(x0, y0, count, seed, color) {
    color = color || "rgba(40,36,32,0.75)";
    var rng = { s: (seed >>> 0) || 54321, next: function() { this.s = (this.s * 1664525 + 1013904223) >>> 0; return this.s / 4294967296; } };
    var canv = '<g class="crane-flock">';
    var cx = x0, cy = y0;
    for (var i = 0; i < count; i++) {
      var sc = 0.5 + rng.next() * 0.4;
      var ox = cx + (i % 2 === 0 ? -1 : 1) * Math.floor((i + 1) / 2) * (26 + rng.next() * 12) + (rng.next() - 0.5) * 8;
      var oy = cy + Math.floor((i + 1) / 2) * (14 + rng.next() * 8) + (rng.next() - 0.5) * 6;
      var wingSpread = (18 + rng.next() * 6) * sc;
      var wingArch = (8 + rng.next() * 4) * sc;
      var d = "M " + (ox - wingSpread).toFixed(1) + " " + (oy - wingArch * 0.2).toFixed(1) +
              " Q " + (ox - wingSpread * 0.4).toFixed(1) + " " + (oy - wingArch).toFixed(1) + " " + ox.toFixed(1) + " " + oy.toFixed(1) +
              " Q " + (ox + wingSpread * 0.4).toFixed(1) + " " + (oy - wingArch).toFixed(1) + " " + (ox + wingSpread).toFixed(1) + " " + (oy - wingArch * 0.2).toFixed(1);
      canv += '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + (1.2 * sc).toFixed(1) + '" stroke-linecap="round"/>';
      canv += '<path d="M ' + ox.toFixed(1) + ' ' + oy.toFixed(1) + ' Q ' + (ox + 3 * sc).toFixed(1) + ' ' + (oy - 4 * sc).toFixed(1) + ' ' + (ox + 5 * sc).toFixed(1) + ' ' + (oy - 8 * sc).toFixed(1) + '" fill="none" stroke="' + color + '" stroke-width="' + (0.9 * sc).toFixed(1) + '" stroke-linecap="round"/>';
    }
    canv += '</g>';
    return canv;
  }

  // ============================================================================
  // Pigment Wash Definitions (Classic Chinese Shan Shui Pigments)
  // ============================================================================

  const PIGMENTS = {
    "pine-soot": {
      id: "pine-soot",
      name: "Pine Soot",
      zhName: "墨黑 · Pine Soot Monochrome",
      paper: "#EFE9DC",
      stroke: "#2A2520",
      meta: "#7A7068",
      accent: "#8B1A1A",
      inkRgb: "40,36,32",
      washRgb: "75,70,64",
      waterRgb: "60,65,72",
      craneColor: "rgba(40,36,32,0.85)"
    },
    "shallow-umber": {
      id: "shallow-umber",
      name: "Shallow Umber",
      zhName: "浅绛 · Qianjiang Ochre & Tea",
      paper: "#EFE7D8",
      stroke: "#3A2A1E",
      meta: "#8A6E58",
      accent: "#9E3D22",
      inkRgb: "72,50,34",
      washRgb: "148,102,68",
      waterRgb: "90,82,75",
      craneColor: "rgba(72,50,34,0.85)"
    },
    "blue-green": {
      id: "blue-green",
      name: "Blue-Green",
      zhName: "青绿 · Qinglü Azurite & Malachite",
      paper: "#E8E2D2",
      stroke: "#1E3430",
      meta: "#5A7A72",
      accent: "#B83227",
      inkRgb: "28,48,46",
      washRgb: "42,108,98",
      waterRgb: "46,92,126",
      craneColor: "rgba(28,48,46,0.85)"
    },
    "golden-dusk": {
      id: "golden-dusk",
      name: "Golden Dusk",
      zhName: "金碧 · Jinbi Golden Ochre",
      paper: "#EFE5D2",
      stroke: "#3A2818",
      meta: "#8E7250",
      accent: "#A83220",
      inkRgb: "58,40,24",
      washRgb: "168,112,42",
      waterRgb: "110,88,60",
      craneColor: "rgba(58,40,24,0.85)"
    },
    "mist-ink": {
      id: "mist-ink",
      name: "Mist Ink",
      zhName: "云烟 · Yunyan Atmospheric Slate",
      paper: "#EAE6DE",
      stroke: "#222830",
      meta: "#6E7886",
      accent: "#8B1A1A",
      inkRgb: "38,42,48",
      washRgb: "88,100,114",
      waterRgb: "75,90,105",
      craneColor: "rgba(38,42,48,0.85)"
    }
  };

  // ============================================================================
  // Topographical Telemetry Derivation
  // ============================================================================

  const TITLES_LATIN = [
    { latin: "Montes Nebulosi et Flumina", zh: "烟岚叠嶂图", desc: "Towering granitic spires enveloped in autumn mist with river hermit" },
    { latin: "Altitudines Immortales", zh: "仙山琼阁图", desc: "Immortal celestial pinnacles veiled in ascending cloud strata" },
    { latin: "Solitudo ad Fluvium", zh: "寒江独钓图", desc: "Solitary fisherman on placid cold waters beneath craggy cliffs" },
    { latin: "Pini Antiqui ad Clivos", zh: "松岩飞瀑图", desc: "Ancient cliffside gnarled pines overlooking tumbling cascades" },
    { latin: "Nebulae Super Valles", zh: "万壑云烟图", desc: "Endless mountain ravines blanketed in morning atmospheric haze" },
    { latin: "Serenitas Silvarum", zh: "幽篁古刹图", desc: "Bamboo grove sanctuary harboring secluded mountain monastery" },
    { latin: "Pinnacula Aeterna", zh: "万仞崇山图", desc: "Ten thousand fathoms of eternal rock facets and weathered plateaus" },
    { latin: "Flumina Infinita", zh: "千里江山图", desc: "Vast meandering riverways connecting distant mountain ranges" },
    { latin: "Saxum et Unda", zh: "石壁流泉图", desc: "Stratified metamorphic rock escarpments and cold mountain springs" },
    { latin: "Vallis Autumnalis", zh: "秋山暮霭图", desc: "Late autumn evening shadows gathering over tiered mountain ridges" },
    { latin: "Aves super Clivos", zh: "晴空归雁图", desc: "Wild cranes ascending gracefully above mist-draped mountain heights" },
    { latin: "Mons Silens et Amnis", zh: "秋江晚泊图", desc: "Silent cliffside river anchorage under tranquil twilight skies" }
  ];

  const MORPHOLOGY_TYPES = [
    "Granitic Crags & Fissures (花岗岩峰林)",
    "Sandstone Pinnacles & Spires (砂岩层叠峰)",
    "Terraced Karst Plateaus (喀斯特台地)",
    "Rolling Loess Ridges (黄土起伏丘陵)",
    "Glaciated Horn Peaks (冰川尖峰群)",
    "Columnar Basalt Escarpments (玄武岩断崖)"
  ];

  const VEGETATION_TYPES = [
    "Ancient Pines & Twisted Willows (古松偃柏)",
    "Sparse Mountain Bamboo (幽篁竹丛)",
    "Dense Conifer Mountain Forest (高山针叶混交林)",
    "Alpine Shrub & Lichen Crag (高山杜鹃灌丛)",
    "Weeping Riverbank Foliage (溪畔垂柳丛)"
  ];

  const HYDROGRAPHY_TYPES = [
    "Misty River Basin & Cascades (烟波浩渺江渚)",
    "Braided Mountain Torrent (奔腾深壑溪涧)",
    "Serene Mirror Lake Cove (平湖秋月回水)",
    "Cascading Ridge Waterfall (飞流直下叠瀑)",
    "Tidal Riverbank Shallows (浅渚回环滩涂)"
  ];

  const HABITATION_TYPES = [
    "Scholar Thatched Pavilion (草堂茅亭)",
    "Secluded Mountain Pagoda (层峦古塔)",
    "Riverside Stilt Abode (水阁茅舍)",
    "Arched Stone Footbridge (古意石拱桥)",
    "Cliffside Taoist Hermitage (临崖静舍)",
    "Uninhabited Pristine Wilds (无人旷野)"
  ];

  const HUMAN_PRESENCE = [
    "Solitary Fisherman with Oar (孤舟蓑笠翁)",
    "Wandering Scholar with Staff (策杖登高客)",
    "Two Scholars in Dialogue (松下对弈友)",
    "Boatman Guiding Sampan (泛舟弄潮人)",
    "Silent Contemplative Solitude (幽人空谷行)"
  ];

  function deriveLandscapeMetrics(hash, width, height, pigmentKey) {
    const tIdx = hash % TITLES_LATIN.length;
    const t = TITLES_LATIN[tIdx];
    const mIdx = (hash >>> 4) % MORPHOLOGY_TYPES.length;
    const vIdx = (hash >>> 8) % VEGETATION_TYPES.length;
    const hIdx = (hash >>> 12) % HYDROGRAPHY_TYPES.length;
    const aIdx = (hash >>> 16) % HABITATION_TYPES.length;
    const pIdx = (hash >>> 20) % HUMAN_PRESENCE.length;

    const ratio = width / height;
    let formatName = "Square Album Leaf [册页 · 斗方] 1:1";
    if (Math.abs(ratio - 1) < 0.05) formatName = "Square Album Leaf [册页 · 斗方] 1:1";
    else if (ratio < 0.6) formatName = "Towering Vertical Scroll [高远立轴] 9:16";
    else if (ratio < 0.7) formatName = "Golden Ratio Hanging Scroll [挂轴] 2:3";
    else if (ratio < 0.8) formatName = "Medium Vertical Scroll [竖轴] 3:4";
    else if (ratio < 0.9) formatName = "Classical Hanging Scroll [立轴] 4:5";
    else if (ratio < 1.3) formatName = "Display Horizontal Plate [横幅] 5:4";
    else if (ratio < 1.4) formatName = "Traditional Horizontal Scroll [横轴] 4:3";
    else if (ratio < 1.6) formatName = "Handscroll Leaf [横卷] 3:2";
    else formatName = "Panoramic Continuous Handscroll [平远长卷] 16:9";

    const peakCount = 12 + ((hash >>> 3) % 18);
    const liSpan = 25 + ((hash >>> 7) % 65);
    const pigment = PIGMENTS[pigmentKey] || PIGMENTS["pine-soot"];

    return {
      title: t.latin,
      zhTitle: t.zh,
      meaning: t.desc,
      format: formatName,
      morphology: MORPHOLOGY_TYPES[mIdx],
      vegetation: VEGETATION_TYPES[vIdx],
      hydrography: HYDROGRAPHY_TYPES[hIdx],
      habitation: HABITATION_TYPES[aIdx],
      humanPresence: HUMAN_PRESENCE[pIdx],
      peakCount: peakCount + " Peaks",
      liSpan: liSpan + " Li (" + (liSpan * 0.5).toFixed(1) + " Km)",
      pigment: pigment.zhName,
      pigmentKey: pigment.id,
      hashHex: "0x" + (hash >>> 0).toString(16).toUpperCase().padStart(8, "0"),
      accessionId: seedToId(hash)
    };
  }

  // ============================================================================
  // Core Lingdong Huang Algorithms (PolyTools, Util, Tree, Mount, Arch, Man, water)
  // ============================================================================

  function createEngineInstance(seedVal) {
    var Prng = new PrngEngine();
    Prng.seed(seedVal);
    var Noise = new NoiseEngine(Prng);
    Noise.seedNoise(seedVal);

var PolyTools = new function() {
    this.midPt = function() {
      var plist =
        arguments.length == 1 ? arguments[0] : Array.apply(null, arguments);
      return plist.reduce(
        function(acc, v) {
          /*       if (v == undefined || acc == undefined){
        console.log("ERRR");
        console.log(plist)
        return [0,0]
      } */
          return [v[0] / plist.length + acc[0], v[1] / plist.length + acc[1]];
        },
        [0, 0],
      );
    };
    this.triangulate = function(plist, args) {
      //return []
      var args = args != undefined ? args : {};
      var area = args.area != undefined ? args.area : 100;
      var convex = args.convex != undefined ? args.convex : false;
      var optimize = args.optimize != undefined ? args.optimize : true;
      function lineExpr(pt0, pt1) {
        var den = pt1[0] - pt0[0];
        var m = den == 0 ? Infinity : (pt1[1] - pt0[1]) / den;
        var k = pt0[1] - m * pt0[0];
        return [m, k];
      }
      function intersect(ln0, ln1) {
        var le0 = lineExpr(...ln0);
        var le1 = lineExpr(...ln1);
        var den = le0[0] - le1[0];
        if (den == 0) {
          return false;
        }
        var x = (le1[1] - le0[1]) / den;
        var y = le0[0] * x + le0[1];
        function onSeg(p, ln) {
          //non-inclusive
          return (
            Math.min(ln[0][0], ln[1][0]) <= p[0] &&
            p[0] <= Math.max(ln[0][0], ln[1][0]) &&
            Math.min(ln[0][1], ln[1][1]) <= p[1] &&
            p[1] <= Math.max(ln[0][1], ln[1][1])
          );
        }
        if (onSeg([x, y], ln0) && onSeg([x, y], ln1)) {
          return [x, y];
        }
        return false;
      }
      function ptInPoly(pt, plist) {
        var scount = 0;
        for (var i = 0; i < plist.length; i++) {
          var np = plist[i != plist.length - 1 ? i + 1 : 0];
          var sect = intersect(
            [plist[i], np],
            [pt, [pt[0] + 999, pt[1] + 999]],
          );
          if (sect != false) {
            scount++;
          }
        }
        return scount % 2 == 1;
      }
      function lnInPoly(ln, plist) {
        var lnc = [[0, 0], [0, 0]];
        var ep = 0.01;

        lnc[0][0] = ln[0][0] * (1 - ep) + ln[1][0] * ep;
        lnc[0][1] = ln[0][1] * (1 - ep) + ln[1][1] * ep;
        lnc[1][0] = ln[0][0] * ep + ln[1][0] * (1 - ep);
        lnc[1][1] = ln[0][1] * ep + ln[1][1] * (1 - ep);

        for (var i = 0; i < plist.length; i++) {
          var pt = plist[i];
          var np = plist[i != plist.length - 1 ? i + 1 : 0];
          if (intersect(lnc, [pt, np]) != false) {
            return false;
          }
        }
        var mid = PolyTools.midPt(ln);
        if (ptInPoly(mid, plist) == false) {
          return false;
        }
        return true;
      }

      function sidesOf(plist) {
        var slist = [];
        for (var i = 0; i < plist.length; i++) {
          var pt = plist[i];
          var np = plist[i != plist.length - 1 ? i + 1 : 0];
          var s = Math.sqrt(
            Math.pow(np[0] - pt[0], 2) + Math.pow(np[1] - pt[1], 2),
          );
          slist.push(s);
        }
        return slist;
      }
      function areaOf(plist) {
        var slist = sidesOf(plist);
        var a = slist[0],
          b = slist[1],
          c = slist[2];
        var s = (a + b + c) / 2;
        var prod = s * (s - a) * (s - b) * (s - c);
        if (prod <= 0 || isNaN(prod)) return 0;
        return Math.sqrt(prod);
      }
      function sliverRatio(plist) {
        var A = areaOf(plist);
        var P = sidesOf(plist).reduce(function(m, n) {
          return m + n;
        }, 0);
        return A / P;
      }
      function bestEar(plist) {
        var cuts = [];
        for (var i = 0; i < plist.length; i++) {
          var pt = plist[i];
          var lp = plist[i != 0 ? i - 1 : plist.length - 1];
          var np = plist[i != plist.length - 1 ? i + 1 : 0];
          var qlist = plist.slice();
          qlist.splice(i, 1);
          if (convex || lnInPoly([lp, np], plist)) {
            var c = [[lp, pt, np], qlist];
            if (!optimize) return c;
            cuts.push(c);
          }
        }
        var best = [plist, []];
        var bestRatio = 0;
        for (var i = 0; i < cuts.length; i++) {
          var r = sliverRatio(cuts[i][0]);
          if (r >= bestRatio) {
            best = cuts[i];
            bestRatio = r;
          }
        }
        return best;
      }
      function shatter(plist, a, depth) {
        depth = depth || 0;
        if (depth > 10 || plist.length == 0) return [plist];
        var ar = areaOf(plist);
        if (isNaN(ar) || ar < a) return [plist];
        if (plist.length == 0) {
          return [];
        }
        if (areaOf(plist) < a) {
          return [plist];
        } else {
          var slist = sidesOf(plist);
          var ind = slist.reduce(
            (iMax, x, i, arr) => (x > arr[iMax] ? i : iMax),
            0,
          );
          var nind = (ind + 1) % plist.length;
          var lind = (ind + 2) % plist.length;
          try {
            var mid = PolyTools.midPt([plist[ind], plist[nind]]);
          } catch (err) {
            console.log(plist);
            console.log(err);
            return [];
          }
          return shatter([plist[ind], mid, plist[lind]], a, depth + 1).concat(
            shatter([plist[lind], plist[nind], mid], a, depth + 1),
          );
        }
      }
      if (plist.length <= 3) {
        return shatter(plist, area);
      } else {
        var cut = bestEar(plist);
        return shatter(cut[0], area).concat(
          PolyTools.triangulate(cut[1], args),
        );
      }
    };
  }();


function unNan(plist) {
    if (typeof plist != "object" || plist == null) {
      return plist || 0;
    } else {
      return plist.map(unNan);
    }
  }
  //console.log(unNan([[undefined,[NaN,NaN],null],false,1]))

  function distance(p0, p1) {
    return Math.sqrt(Math.pow(p0[0] - p1[0], 2) + Math.pow(p0[1] - p1[1], 2));
  }

  function mapval(value, istart, istop, ostart, ostop) {
    return (
      ostart + (ostop - ostart) * (((value - istart) * 1.0) / (istop - istart))
    );
  }
  function loopNoise(nslist) {
    var dif = nslist[nslist.length - 1] - nslist[0];
    var bds = [100, -100];
    for (var i = 0; i < nslist.length; i++) {
      nslist[i] += (dif * (nslist.length - 1 - i)) / (nslist.length - 1);
      if (nslist[i] < bds[0]) bds[0] = nslist[i];
      if (nslist[i] > bds[1]) bds[1] = nslist[i];
    }
    for (var i = 0; i < nslist.length; i++) {
      nslist[i] = mapval(nslist[i], bds[0], bds[1], 0, 1);
    }
  }

  function randChoice(arr) {
    return arr[Math.floor(arr.length * Math.random())];
  }

  function normRand(m, M) {
    return mapval(Math.random(), 0, 1, m, M);
  }

  function wtrand(func) {
    for (var k = 0; k < 500; k++) {
      var x = Math.random();
      var y = Math.random();
      if (y < func(x)) {
        return x;
      }
    }
    return Math.random();
  }

  function randGaussian() {
    return (
      wtrand(function(x) {
        return Math.pow(Math.E, -24 * Math.pow(x - 0.5, 2));
      }) *
        2 -
      1
    );
  }

  function bezmh(P, w) {
    w = w == undefined ? 1 : w;
    if (P.length == 2) {
      P = [P[0], PolyTools.midPt(P[0], P[1]), P[1]];
    }
    var plist = [];
    for (var j = 0; j < P.length - 2; j++) {
      var p0;
      var p1;
      var p2;
      if (j == 0) {
        p0 = P[j];
      } else {
        p0 = PolyTools.midPt(P[j], P[j + 1]);
      }
      p1 = P[j + 1];
      if (j == P.length - 3) {
        p2 = P[j + 2];
      } else {
        p2 = PolyTools.midPt(P[j + 1], P[j + 2]);
      }
      var pl = 20;
      for (var i = 0; i < pl + (j == P.length - 3); i += 1) {
        var t = i / pl;
        var u = Math.pow(1 - t, 2) + 2 * t * (1 - t) * w + t * t;
        plist.push([
          (Math.pow(1 - t, 2) * p0[0] +
            2 * t * (1 - t) * p1[0] * w +
            t * t * p2[0]) /
            u,
          (Math.pow(1 - t, 2) * p0[1] +
            2 * t * (1 - t) * p1[1] * w +
            t * t * p2[1]) /
            u,
        ]);
      }
    }
    return plist;
  }

  function poly(plist, args) {
    var args = args != undefined ? args : {};
    var xof = args.xof != undefined ? args.xof : 0;
    var yof = args.yof != undefined ? args.yof : 0;
    var fil = args.fil != undefined ? args.fil : "rgba(0,0,0,0)";
    var str = args.str != undefined ? args.str : fil;
    var wid = args.wid != undefined ? args.wid : 0;

    var canv = "<polyline points='";
    for (var i = 0; i < plist.length; i++) {
      canv +=
        " " +
        (plist[i][0] + xof).toFixed(1) +
        "," +
        (plist[i][1] + yof).toFixed(1);
    }
    canv +=
      "' style='fill:" +
      fil +
      ";stroke:" +
      str +
      ";stroke-width:" +
      wid +
      "'/>";
    return canv;
  }


function stroke(ptlist, args) {
    var args = args != undefined ? args : {};
    var xof = args.xof != undefined ? args.xof : 0;
    var yof = args.yof != undefined ? args.yof : 0;
    var wid = args.wid != undefined ? args.wid : 2;
    var col = args.col != undefined ? args.col : "rgba(200,200,200,0.9)";
    var noi = args.noi != undefined ? args.noi : 0.5;
    var out = args.out != undefined ? args.out : 1;
    var fun =
      args.fun != undefined
        ? args.fun
        : function(x) {
            return Math.sin(x * Math.PI);
          };

    if (ptlist.length == 0) {
      return "";
    }
    vtxlist0 = [];
    vtxlist1 = [];
    vtxlist = [];
    var n0 = Math.random() * 10;
    for (var i = 1; i < ptlist.length - 1; i++) {
      var w = wid * fun(i / ptlist.length);
      w = w * (1 - noi) + w * noi * Noise.noise(i * 0.5, n0);
      var a1 = Math.atan2(
        ptlist[i][1] - ptlist[i - 1][1],
        ptlist[i][0] - ptlist[i - 1][0],
      );
      var a2 = Math.atan2(
        ptlist[i][1] - ptlist[i + 1][1],
        ptlist[i][0] - ptlist[i + 1][0],
      );
      var a = (a1 + a2) / 2;
      if (a < a2) {
        a += Math.PI;
      }
      vtxlist0.push([
        ptlist[i][0] + w * Math.cos(a),
        ptlist[i][1] + w * Math.sin(a),
      ]);
      vtxlist1.push([
        ptlist[i][0] - w * Math.cos(a),
        ptlist[i][1] - w * Math.sin(a),
      ]);
    }

    vtxlist = [ptlist[0]]
      .concat(
        vtxlist0.concat(vtxlist1.concat([ptlist[ptlist.length - 1]]).reverse()),
      )
      .concat([ptlist[0]]);

    var canv = poly(
      vtxlist.map(function(x) {
        return [x[0] + xof, x[1] + yof];
      }),
      { fil: col, str: col, wid: out },
    );
    return canv;
  }

  function blob(x, y, args) {
    var args = args != undefined ? args : {};
    var len = args.len != undefined ? args.len : 20;
    var wid = args.wid != undefined ? args.wid : 5;
    var ang = args.ang != undefined ? args.ang : 0;
    var col = args.col != undefined ? args.col : "rgba(200,200,200,0.9)";
    var noi = args.noi != undefined ? args.noi : 0.5;
    var ret = args.ret != undefined ? args.ret : 0;
    var fun =
      args.fun != undefined
        ? args.fun
        : function(x) {
            return x <= 1
              ? Math.pow(Math.sin(x * Math.PI), 0.5)
              : -Math.pow(Math.sin((x + 1) * Math.PI), 0.5);
          };

    var reso = 20.0;
    var lalist = [];
    for (var i = 0; i < reso + 1; i++) {
      var p = (i / reso) * 2;
      var xo = len / 2 - Math.abs(p - 1) * len;
      var yo = (fun(p) * wid) / 2;
      var a = Math.atan2(yo, xo);
      var l = Math.sqrt(xo * xo + yo * yo);
      lalist.push([l, a]);
    }
    var nslist = [];
    var n0 = Math.random() * 10;
    for (var i = 0; i < reso + 1; i++) {
      nslist.push(Noise.noise(i * 0.05, n0));
    }

    loopNoise(nslist);
    var plist = [];
    for (var i = 0; i < lalist.length; i++) {
      var ns = nslist[i] * noi + (1 - noi);
      var nx = x + Math.cos(lalist[i][1] + ang) * lalist[i][0] * ns;
      var ny = y + Math.sin(lalist[i][1] + ang) * lalist[i][0] * ns;
      plist.push([nx, ny]);
    }

    if (ret == 0) {
      return poly(plist, { fil: col, str: col, wid: 0 });
    } else {
      return plist;
    }
  }

  function div(plist, reso) {
    var tl = (plist.length - 1) * reso;
    var lx = 0;
    var ly = 0;
    var rlist = [];

    for (var i = 0; i < tl; i += 1) {
      var lastp = plist[Math.floor(i / reso)];
      var nextp = plist[Math.ceil(i / reso)];
      var p = (i % reso) / reso;
      var nx = lastp[0] * (1 - p) + nextp[0] * p;
      var ny = lastp[1] * (1 - p) + nextp[1] * p;

      var ang = Math.atan2(ny - ly, nx - lx);

      rlist.push([nx, ny]);
      lx = nx;
      ly = ny;
    }

    if (plist.length > 0) {
      rlist.push(plist[plist.length - 1]);
    }
    return rlist;
  }

  var texture = function(ptlist, args) {
    var args = args != undefined ? args : {};
    var xof = args.xof != undefined ? args.xof : 0;
    var yof = args.yof != undefined ? args.yof : 0;
    var tex = args.tex != undefined ? args.tex : 400;
    var wid = args.wid != undefined ? args.wid : 1.5;
    var len = args.len != undefined ? args.len : 0.2;
    var sha = args.sha != undefined ? args.sha : 0;
    var ret = args.ret != undefined ? args.ret : 0;
    var noi =
      args.noi != undefined
        ? args.noi
        : function(x) {
            return 30 / x;
          };
    var col =
      args.col != undefined
        ? args.col
        : function(x) {
            return "rgba(100,100,100," + (Math.random() * 0.3).toFixed(3) + ")";
          };
    var dis =
      args.dis != undefined
        ? args.dis
        : function() {
            if (Math.random() > 0.5) {
              return (1 / 3) * Math.random();
            } else {
              return (1 * 2) / 3 + (1 / 3) * Math.random();
            }
          };
    var reso = [ptlist.length, ptlist[0].length];
    var texlist = [];
    for (var i = 0; i < tex; i++) {
      var mid = (dis() * reso[1]) | 0;
      //mid = (reso[1]/3+reso[1]/3*Math.random())|0

      var hlen = Math.floor(Math.random() * (reso[1] * len));

      var start = mid - hlen;
      var end = mid + hlen;
      start = Math.min(Math.max(start, 0), reso[1]);
      end = Math.min(Math.max(end, 0), reso[1]);

      var layer = (i / tex) * (reso[0] - 1);

      texlist.push([]);
      for (var j = start; j < end; j++) {
        var p = layer - Math.floor(layer);

        var x =
          ptlist[Math.floor(layer)][j][0] * p +
          ptlist[Math.ceil(layer)][j][0] * (1 - p);

        var y =
          ptlist[Math.floor(layer)][j][1] * p +
          ptlist[Math.ceil(layer)][j][1] * (1 - p);

        var ns = [
          noi(layer + 1) * (Noise.noise(x, j * 0.5) - 0.5),
          noi(layer + 1) * (Noise.noise(y, j * 0.5) - 0.5),
        ];

        texlist[texlist.length - 1].push([x + ns[0], y + ns[1]]);
      }
    }
    var canv = "";
    //SHADE
    if (sha) {
      for (var j = 0; j < texlist.length; j += 1 + (sha != 0)) {
        canv += stroke(
          texlist[j].map(function(x) {
            return [x[0] + xof, x[1] + yof];
          }),
          { col: "rgba(100,100,100,0.1)", wid: sha },
        );
      }
    }
    //TEXTURE
    for (var j = 0 + sha; j < texlist.length; j += 1 + sha) {
      canv += stroke(
        texlist[j].map(function(x) {
          return [x[0] + xof, x[1] + yof];
        }),
        { col: col(j / texlist.length), wid: wid },
      );
    }
    return ret ? texlist : canv;
  };

  

var Tree = new function() {
    this.tree01 = function(x, y, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 50;
      var wid = args.wid != undefined ? args.wid : 3;
      var col = args.col != undefined ? args.col : "rgba(100,100,100,0.5)";
      var noi = args.noi != undefined ? args.noi : 0.5;

      reso = 10;
      var nslist = [];
      for (var i = 0; i < reso; i++) {
        nslist.push([Noise.noise(i * 0.5), Noise.noise(i * 0.5, 0.5)]);
      }

      var leafcol;
      if (col.includes("rgba(")) {
        leafcol = col
          .replace("rgba(", "")
          .replace(")", "")
          .split(",");
      } else {
        leafcol = ["100", "100", "100", "0.5"];
      }
      var canv = "";
      var line1 = [];
      var line2 = [];
      for (var i = 0; i < reso; i++) {
        var nx = x;
        var ny = y - (i * hei) / reso;
        if (i >= reso / 4) {
          for (var j = 0; j < (reso - i) / 5; j++) {
            canv += blob(
              nx + (Math.random() - 0.5) * wid * 1.2 * (reso - i),
              ny + (Math.random() - 0.5) * wid,
              {
                len: Math.random() * 20 * (reso - i) * 0.2 + 10,
                wid: Math.random() * 6 + 3,
                ang: ((Math.random() - 0.5) * Math.PI) / 6,
                col:
                  "rgba(" +
                  leafcol[0] +
                  "," +
                  leafcol[1] +
                  "," +
                  leafcol[2] +
                  "," +
                  (Math.random() * 0.2 + parseFloat(leafcol[3])).toFixed(1) +
                  ")",
              },
            );
          }
        }
        line1.push([nx + (nslist[i][0] - 0.5) * wid - wid / 2, ny]);
        line2.push([nx + (nslist[i][1] - 0.5) * wid + wid / 2, ny]);
      }
      canv +=
        poly(line1, { fil: "none", str: col, wid: 1.5 }) +
        poly(line2, { fil: "none", str: col, wid: 1.5 });
      return canv;
    };
    this.tree02 = function(x, y, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 16;
      var wid = args.wid != undefined ? args.wid : 8;
      var clu = args.clu != undefined ? args.clu : 5;
      var col = args.col != undefined ? args.col : "rgba(100,100,100,0.5)";
      var noi = args.noi != undefined ? args.noi : 0.5;

      var leafcol;
      if (col.includes("rgba(")) {
        leafcol = col
          .replace("rgba(", "")
          .replace(")", "")
          .split(",");
      } else {
        leafcol = ["100", "100", "100", "0.5"];
      }

      var canv = "";
      for (var i = 0; i < clu; i++) {
        canv += blob(
          x + randGaussian() * clu * 4,
          y + randGaussian() * clu * 4,
          {
            ang: Math.PI / 2,
            col: "rgba(100,100,100,0.8)",
            fun: function(x) {
              return x <= 1
                ? Math.pow(Math.sin(x * Math.PI) * x, 0.5)
                : -Math.pow(Math.sin((x - 2) * Math.PI * (x - 2)), 0.5);
            },
            wid: Math.random() * wid * 0.75 + wid * 0.5,
            len: Math.random() * hei * 0.75 + hei * 0.5,
            col: col,
          },
        );
      }
      return canv;
    };
    this.tree03 = function(x, y, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 50;
      var wid = args.wid != undefined ? args.wid : 5;
      var ben =
        args.ben != undefined
          ? args.ben
          : function(x) {
              return 0;
            };
      var col = args.col != undefined ? args.col : "rgba(100,100,100,0.5)";
      var noi = args.noi != undefined ? args.noi : 0.5;

      reso = 10;
      var nslist = [];
      for (var i = 0; i < reso; i++) {
        nslist.push([Noise.noise(i * 0.5), Noise.noise(i * 0.5, 0.5)]);
      }

      var leafcol;
      if (col.includes("rgba(")) {
        leafcol = col
          .replace("rgba(", "")
          .replace(")", "")
          .split(",");
      } else {
        leafcol = ["100", "100", "100", "0.5"];
      }
      var canv = "";
      var blobs = "";
      var line1 = [];
      var line2 = [];
      for (var i = 0; i < reso; i++) {
        var nx = x + ben(i / reso) * 100;
        var ny = y - (i * hei) / reso;
        if (i >= reso / 5) {
          for (var j = 0; j < (reso - i) * 2; j++) {
            var shape = function(x) {
              return Math.log(50 * x + 1) / 3.95;
            };
            var ox = Math.random() * wid * 2 * shape((reso - i) / reso);
            blobs += blob(
              nx + ox * randChoice([-1, 1]),
              ny + (Math.random() - 0.5) * wid * 2,
              {
                len: ox * 2,
                wid: Math.random() * 6 + 3,
                ang: ((Math.random() - 0.5) * Math.PI) / 6,
                col:
                  "rgba(" +
                  leafcol[0] +
                  "," +
                  leafcol[1] +
                  "," +
                  leafcol[2] +
                  "," +
                  (Math.random() * 0.2 + parseFloat(leafcol[3])).toFixed(3) +
                  ")",
              },
            );
          }
        }
        line1.push([
          nx + (((nslist[i][0] - 0.5) * wid - wid / 2) * (reso - i)) / reso,
          ny,
        ]);
        line2.push([
          nx + (((nslist[i][1] - 0.5) * wid + wid / 2) * (reso - i)) / reso,
          ny,
        ]);
      }
      var lc = line1.concat(line2.reverse());
      canv += poly(lc, { fil: "white", str: col, wid: 1.5 });
      canv += blobs;
      return canv;
    };

    var branch = function(args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 300;
      var wid = args.wid != undefined ? args.wid : 6;
      var ang = args.ang != undefined ? args.ang : 0;
      var det = args.det != undefined ? args.det : 10;
      var ben = args.ben != undefined ? args.ben : Math.PI * 0.2;

      var tlist;
      var nx = 0;
      var ny = 0;
      tlist = [[nx, ny]];
      var a0 = 0;
      var g = 3;
      for (var i = 0; i < g; i++) {
        a0 += (ben / 2 + (Math.random() * ben) / 2) * randChoice([-1, 1]);
        nx += (Math.cos(a0) * hei) / g;
        ny -= (Math.sin(a0) * hei) / g;
        tlist.push([nx, ny]);
      }
      var ta = Math.atan2(
        tlist[tlist.length - 1][1],
        tlist[tlist.length - 1][0],
      );

      for (var i = 0; i < tlist.length; i++) {
        var a = Math.atan2(tlist[i][1], tlist[i][0]);
        var d = Math.sqrt(
          tlist[i][0] * tlist[i][0] + tlist[i][1] * tlist[i][1],
        );
        tlist[i][0] = d * Math.cos(a - ta + ang);
        tlist[i][1] = d * Math.sin(a - ta + ang);
      }

      var trlist1 = [];
      var trlist2 = [];
      var span = det;
      var tl = (tlist.length - 1) * span;
      var lx = 0;
      var ly = 0;

      for (var i = 0; i < tl; i += 1) {
        var lastp = tlist[Math.floor(i / span)];
        var nextp = tlist[Math.ceil(i / span)];
        var p = (i % span) / span;
        var nx = lastp[0] * (1 - p) + nextp[0] * p;
        var ny = lastp[1] * (1 - p) + nextp[1] * p;

        var ang = Math.atan2(ny - ly, nx - lx);
        var woff = ((Noise.noise(i * 0.3) - 0.5) * wid * hei) / 80;

        var b = 0;
        if (p == 0) {
          b = Math.random() * wid;
        }

        var nw = wid * (((tl - i) / tl) * 0.5 + 0.5);
        trlist1.push([
          nx + Math.cos(ang + Math.PI / 2) * (nw + woff + b),
          ny + Math.sin(ang + Math.PI / 2) * (nw + woff + b),
        ]);
        trlist2.push([
          nx + Math.cos(ang - Math.PI / 2) * (nw - woff + b),
          ny + Math.sin(ang - Math.PI / 2) * (nw - woff + b),
        ]);
        lx = nx;
        ly = ny;
      }

      return [trlist1, trlist2];
    };

    var twig = function(tx, ty, dep, args) {
      var args = args != undefined ? args : {};
      var dir = args.dir != undefined ? args.dir : 1;
      var sca = args.sca != undefined ? args.sca : 1;
      var wid = args.wid != undefined ? args.wid : 1;
      var ang = args.ang != undefined ? args.ang : 0;
      var lea = args.lea != undefined ? args.lea : [true, 12];

      var canv = "";
      var twlist = [];
      var tl = 10;
      var hs = Math.random() * 0.5 + 0.5;
      var fun1 = function(x) {
        return Math.pow(x, 0.5);
      };
      var fun2 = function(x) {
        return -1 / Math.pow(i / tl + 1, 5) + 1;
      };

      var tfun = randChoice([fun2]);
      var a0 = ((Math.random() * Math.PI) / 6) * dir + ang;
      for (var i = 0; i < tl; i++) {
        var mx = dir * tfun(i / tl) * 50 * sca * hs;
        var my = -i * 5 * sca;

        var a = Math.atan2(my, mx);
        var d = Math.pow(mx * mx + my * my, 0.5);

        var nx = Math.cos(a + a0) * d;
        var ny = Math.sin(a + a0) * d;

        twlist.push([nx + tx, ny + ty]);
        if ((i == ((tl / 3) | 0) || i == (((tl * 2) / 3) | 0)) && dep > 0) {
          canv += twig(nx + tx, ny + ty, dep - 1, {
            ang: ang,
            sca: sca * 0.8,
            wid: wid,
            dir: dir * randChoice([-1, 1]),
            lea: lea,
          });
        }
        if (i == tl - 1 && lea[0] == true) {
          for (var j = 0; j < 5; j++) {
            var dj = (j - 2.5) * 5;
            canv += blob(
              nx + tx + Math.cos(ang) * dj * wid,
              ny + ty + (Math.sin(ang) * dj - lea[1] / (dep + 1)) * wid,
              {
                wid: (6 + 3 * Math.random()) * wid,
                len: (15 + 12 * Math.random()) * wid,
                ang:
                  ang / 2 + Math.PI / 2 + Math.PI * 0.2 * (Math.random() - 0.5),
                col: "rgba(100,100,100," + (0.5 + dep * 0.2).toFixed(3) + ")",
                fun: function(x) {
                  return x <= 1
                    ? Math.pow(Math.sin(x * Math.PI) * x, 0.5)
                    : -Math.pow(Math.sin((x - 2) * Math.PI * (x - 2)), 0.5);
                },
              },
            );
          }
        }
      }
      canv += stroke(twlist, {
        wid: 1,
        fun: function(x) {
          return Math.cos((x * Math.PI) / 2);
        },
        col: "rgba(100,100,100,0.5)",
      });
      return canv;
    };

    var barkify = function(x, y, trlist) {
      function bark(x, y, wid, ang) {
        var len = 10 + 10 * Math.random();
        var noi = 0.5;
        var fun = function(x) {
          return x <= 1
            ? Math.pow(Math.sin(x * Math.PI), 0.5)
            : -Math.pow(Math.sin((x + 1) * Math.PI), 0.5);
        };
        var reso = 20.0;
        var canv = "";

        var lalist = [];
        for (var i = 0; i < reso + 1; i++) {
          var p = (i / reso) * 2;
          var xo = len / 2 - Math.abs(p - 1) * len;
          var yo = (fun(p) * wid) / 2;
          var a = Math.atan2(yo, xo);
          var l = Math.sqrt(xo * xo + yo * yo);
          lalist.push([l, a]);
        }
        var nslist = [];
        var n0 = Math.random() * 10;
        for (var i = 0; i < reso + 1; i++) {
          nslist.push(Noise.noise(i * 0.05, n0));
        }

        loopNoise(nslist);
        var brklist = [];
        for (var i = 0; i < lalist.length; i++) {
          var ns = nslist[i] * noi + (1 - noi);
          var nx = x + Math.cos(lalist[i][1] + ang) * lalist[i][0] * ns;
          var ny = y + Math.sin(lalist[i][1] + ang) * lalist[i][0] * ns;
          brklist.push([nx, ny]);
        }
        var fr = Math.random();
        canv += stroke(brklist, {
          wid: 0.8,
          noi: 0,
          col: "rgba(100,100,100,0.4)",
          out: 0,
          fun: function(x) {
            return Math.sin((x + fr) * Math.PI * 3);
          },
        });

        return canv;
      }
      var canv = "";

      for (var i = 2; i < trlist[0].length - 1; i++) {
        var a0 = Math.atan2(
          trlist[0][i][1] - trlist[0][i - 1][1],
          trlist[0][i][0] - trlist[0][i - 1][0],
        );
        var a1 = Math.atan2(
          trlist[1][i][1] - trlist[1][i - 1][1],
          trlist[1][i][0] - trlist[1][i - 1][0],
        );
        var p = Math.random();
        var nx = trlist[0][i][0] * (1 - p) + trlist[1][i][0] * p;
        var ny = trlist[0][i][1] * (1 - p) + trlist[1][i][1] * p;
        if (Math.random() < 0.2) {
          canv += blob(nx + x, ny + y, {
            noi: 1,
            len: 15,
            wid: 6 - Math.abs(p - 0.5) * 10,
            ang: (a0 + a1) / 2,
            col: "rgba(100,100,100,0.6)",
          });
        } else {
          canv += bark(
            nx + x,
            ny + y,
            5 - Math.abs(p - 0.5) * 10,
            (a0 + a1) / 2,
          );
        }

        if (Math.random() < 0.05) {
          var jl = Math.random() * 2 + 2;
          var xya = randChoice([
            [trlist[0][i][0], trlist[0][i][1], a0],
            [trlist[1][i][0], trlist[1][i][1], a1],
          ]);
          for (var j = 0; j < jl; j++) {
            canv += blob(
              xya[0] + x + Math.cos(xya[2]) * (j - jl / 2) * 4,
              xya[1] + y + Math.sin(xya[2]) * (j - jl / 2) * 4,
              {
                wid: 4,
                len: 4 + 6 * Math.random(),
                ang: a0 + Math.PI / 2,
                col: "rgba(100,100,100,0.6)",
              },
            );
          }
        }
      }
      var trflist = trlist[0].concat(trlist[1].slice().reverse());
      var rglist = [[]];
      for (var i = 0; i < trflist.length; i++) {
        if (Math.random() < 0.5) {
          rglist.push([]);
        } else {
          rglist[rglist.length - 1].push(trflist[i]);
        }
      }

      for (var i = 0; i < rglist.length; i++) {
        rglist[i] = div(rglist[i], 4);
        for (var j = 0; j < rglist[i].length; j++) {
          rglist[i][j][0] +=
            (Noise.noise(i, j * 0.1, 1) - 0.5) * (15 + 5 * randGaussian());
          rglist[i][j][1] +=
            (Noise.noise(i, j * 0.1, 2) - 0.5) * (15 + 5 * randGaussian());
        }
        canv += stroke(
          rglist[i].map(function(v) {
            return [v[0] + x, v[1] + y];
          }),
          { wid: 1.5, col: "rgba(100,100,100,0.7)", out: 0 },
        );
      }
      return canv;
    };

    this.tree04 = function(x, y, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 300;
      var wid = args.wid != undefined ? args.wid : 6;
      var col = args.col != undefined ? args.col : "rgba(100,100,100,0.5)";
      var noi = args.noi != undefined ? args.noi : 0.5;

      var canv = "";
      var txcanv = "";
      var twcanv = "";

      var trlist = branch({ hei: hei, wid: wid, ang: -Math.PI / 2 });
      txcanv += barkify(x, y, trlist);
      trlist = trlist[0].concat(trlist[1].reverse());

      var trmlist = [];

      for (var i = 0; i < trlist.length; i++) {
        if (
          (i >= trlist.length * 0.3 &&
            i <= trlist.length * 0.7 &&
            Math.random() < 0.1) ||
          i == trlist.length / 2 - 1
        ) {
          var ba = Math.PI * 0.2 - Math.PI * 1.4 * (i > trlist.length / 2);
          var brlist = branch({
            hei: hei * (Math.random() + 1) * 0.3,
            wid: wid * 0.5,
            ang: ba,
          });

          brlist[0].splice(0, 1);
          brlist[1].splice(0, 1);
          var foff = function(v) {
            return [v[0] + trlist[i][0], v[1] + trlist[i][1]];
          };
          txcanv += barkify(x, y, [brlist[0].map(foff), brlist[1].map(foff)]);

          for (var j = 0; j < brlist[0].length; j++) {
            if (Math.random() < 0.2 || j == brlist[0].length - 1) {
              twcanv += twig(
                brlist[0][j][0] + trlist[i][0] + x,
                brlist[0][j][1] + trlist[i][1] + y,
                1,
                {
                  wid: hei / 300,
                  ang: ba > -Math.PI / 2 ? ba : ba + Math.PI,
                  sca: (0.5 * hei) / 300,
                  dir: ba > -Math.PI / 2 ? 1 : -1,
                },
              );
            }
          }
          brlist = brlist[0].concat(brlist[1].reverse());
          trmlist = trmlist.concat(
            brlist.map(function(v) {
              return [v[0] + trlist[i][0], v[1] + trlist[i][1]];
            }),
          );
        } else {
          trmlist.push(trlist[i]);
        }
      }
      canv += poly(trmlist, { xof: x, yof: y, fil: "white", str: col, wid: 0 });

      trmlist.splice(0, 1);
      trmlist.splice(trmlist.length - 1, 1);
      canv += stroke(
        trmlist.map(function(v) {
          return [v[0] + x, v[1] + y];
        }),
        {
          col:
            "rgba(100,100,100," + (0.4 + Math.random() * 0.1).toFixed(3) + ")",
          wid: 2.5,
          fun: function(x) {
            return Math.sin(1);
          },
          noi: 0.9,
          out: 0,
        },
      );

      canv += txcanv;
      canv += twcanv;
      return canv;
    };

    this.tree05 = function(x, y, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 300;
      var wid = args.wid != undefined ? args.wid : 5;
      var col = args.col != undefined ? args.col : "rgba(100,100,100,0.5)";
      var noi = args.noi != undefined ? args.noi : 0.5;

      var canv = "";
      var txcanv = "";
      var twcanv = "";

      var trlist = branch({ hei: hei, wid: wid, ang: -Math.PI / 2, ben: 0 });
      txcanv += barkify(x, y, trlist);
      trlist = trlist[0].concat(trlist[1].reverse());

      var trmlist = [];

      for (var i = 0; i < trlist.length; i++) {
        var p = Math.abs(i - trlist.length * 0.5) / (trlist.length * 0.5);
        if (
          (i >= trlist.length * 0.2 &&
            i <= trlist.length * 0.8 &&
            i % 3 == 0 &&
            Math.random() > p) ||
          i == trlist.length / 2 - 1
        ) {
          var bar = Math.random() * 0.2;
          var ba =
            -bar * Math.PI - (1 - bar * 2) * Math.PI * (i > trlist.length / 2);
          var brlist = branch({
            hei: hei * (0.3 * p - Math.random() * 0.05),
            wid: wid * 0.5,
            ang: ba,
            ben: 0.5,
          });

          brlist[0].splice(0, 1);
          brlist[1].splice(0, 1);
          var foff = function(v) {
            return [v[0] + trlist[i][0], v[1] + trlist[i][1]];
          };
          //txcanv += barkify(x,y,[brlist[0].map(foff),brlist[1].map(foff)])

          for (var j = 0; j < brlist[0].length; j++) {
            if (j % 20 == 0 || j == brlist[0].length - 1) {
              twcanv += twig(
                brlist[0][j][0] + trlist[i][0] + x,
                brlist[0][j][1] + trlist[i][1] + y,
                0,
                {
                  wid: hei / 300,
                  ang: ba > -Math.PI / 2 ? ba : ba + Math.PI,
                  sca: (0.2 * hei) / 300,
                  dir: ba > -Math.PI / 2 ? 1 : -1,
                  lea: [true, 5],
                },
              );
            }
          }
          brlist = brlist[0].concat(brlist[1].reverse());
          trmlist = trmlist.concat(
            brlist.map(function(v) {
              return [v[0] + trlist[i][0], v[1] + trlist[i][1]];
            }),
          );
        } else {
          trmlist.push(trlist[i]);
        }
      }

      canv += poly(trmlist, { xof: x, yof: y, fil: "white", str: col, wid: 0 });

      trmlist.splice(0, 1);
      trmlist.splice(trmlist.length - 1, 1);
      canv += stroke(
        trmlist.map(function(v) {
          return [v[0] + x, v[1] + y];
        }),
        {
          col:
            "rgba(100,100,100," + (0.4 + Math.random() * 0.1).toFixed(3) + ")",
          wid: 2.5,
          fun: function(x) {
            return Math.sin(1);
          },
          noi: 0.9,
          out: 0,
        },
      );

      canv += txcanv;
      canv += twcanv;
      return canv;
    };

    this.tree06 = function(x, y, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 100;
      var wid = args.wid != undefined ? args.wid : 6;
      var col = args.col != undefined ? args.col : "rgba(100,100,100,0.5)";
      var noi = args.noi != undefined ? args.noi : 0.5;

      var canv = "";
      var txcanv = "";
      var twcanv = "";

      function fracTree(xoff, yoff, dep, args) {
        var args = args != undefined ? args : {};
        var hei = args.hei != undefined ? args.hei : 300;
        var wid = args.wid != undefined ? args.wid : 5;
        var ang = args.ang != undefined ? args.ang : 0;
        var ben = args.ben != undefined ? args.ben : Math.PI * 0.2;

        var trlist = branch({
          hei: hei,
          wid: wid,
          ang: ang,
          ben: ben,
          det: hei / 20,
        });
        txcanv += barkify(xoff, yoff, trlist);
        trlist = trlist[0].concat(trlist[1].reverse());

        var trmlist = [];

        for (var i = 0; i < trlist.length; i++) {
          var p = Math.abs(i - trlist.length * 0.5) / (trlist.length * 0.5);
          if (
            ((Math.random() < 0.025 &&
              i >= trlist.length * 0.2 &&
              i <= trlist.length * 0.8) ||
              i == ((trlist.length / 2) | 0) - 1 ||
              i == ((trlist.length / 2) | 0) + 1) &&
            dep > 0
          ) {
            var bar = 0.02 + Math.random() * 0.08;
            var ba =
              bar * Math.PI - bar * 2 * Math.PI * (i > trlist.length / 2);

            var brlist = fracTree(
              trlist[i][0] + xoff,
              trlist[i][1] + yoff,
              dep - 1,
              {
                hei: hei * (0.7 + Math.random() * 0.2),
                wid: wid * 0.6,
                ang: ang + ba,
                ben: 0.55,
              },
            );

            for (var j = 0; j < brlist.length; j++) {
              if (Math.random() < 0.03) {
                twcanv += twig(
                  brlist[j][0] + trlist[i][0] + xoff,
                  brlist[j][1] + trlist[i][1] + yoff,
                  2,
                  {
                    ang: ba * (Math.random() * 0.5 + 0.75),
                    sca: 0.3,
                    dir: ba > 0 ? 1 : -1,
                    lea: [false, 0],
                  },
                );
              }
            }

            trmlist = trmlist.concat(
              brlist.map(function(v) {
                return [v[0] + trlist[i][0], v[1] + trlist[i][1]];
              }),
            );
          } else {
            trmlist.push(trlist[i]);
          }
        }
        return trmlist;
      }

      var trmlist = fracTree(x, y, 3, {
        hei: hei,
        wid: wid,
        ang: -Math.PI / 2,
        ben: 0,
      });

      canv += poly(trmlist, { xof: x, yof: y, fil: "white", str: col, wid: 0 });

      trmlist.splice(0, 1);
      trmlist.splice(trmlist.length - 1, 1);
      canv += stroke(
        trmlist.map(function(v) {
          return [v[0] + x, v[1] + y];
        }),
        {
          col:
            "rgba(100,100,100," + (0.4 + Math.random() * 0.1).toFixed(3) + ")",
          wid: 2.5,
          fun: function(x) {
            return Math.sin(1);
          },
          noi: 0.9,
          out: 0,
        },
      );

      canv += txcanv;
      canv += twcanv;
      return canv;
    };

    this.tree07 = function(x, y, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 60;
      var wid = args.wid != undefined ? args.wid : 4;
      var ben =
        args.ben != undefined
          ? args.ben
          : function(x) {
              return Math.sqrt(x) * 0.2;
            };
      var col = args.col != undefined ? args.col : "rgba(100,100,100,1)";
      var noi = args.noi != undefined ? args.noi : 0.5;

      reso = 10;
      var nslist = [];
      for (var i = 0; i < reso; i++) {
        nslist.push([Noise.noise(i * 0.5), Noise.noise(i * 0.5, 0.5)]);
      }
      var leafcol;
      if (col.includes("rgba(")) {
        leafcol = col
          .replace("rgba(", "")
          .replace(")", "")
          .split(",");
      } else {
        leafcol = ["100", "100", "100", "1"];
      }
      var canv = "";
      var line1 = [];
      var line2 = [];
      var T = [];
      for (var i = 0; i < reso; i++) {
        var nx = x + ben(i / reso) * 100;
        var ny = y - (i * hei) / reso;
        if (i >= reso / 4) {
          for (var j = 0; j < 1; j++) {
            var bpl = blob(
              nx + (Math.random() - 0.5) * wid * 1.2 * (reso - i) * 0.5,
              ny + (Math.random() - 0.5) * wid * 0.5,
              {
                len: Math.random() * 50 + 20,
                wid: Math.random() * 12 + 12,
                ang: (-Math.random() * Math.PI) / 6,
                col:
                  "rgba(" +
                  leafcol[0] +
                  "," +
                  leafcol[1] +
                  "," +
                  leafcol[2] +
                  "," +
                  parseFloat(leafcol[3]).toFixed(3) +
                  ")",
                fun: function(x) {
                  return x <= 1
                    ? 2.75 * x * Math.pow(1 - x, 1 / 1.8)
                    : 2.75 * (x - 2) * Math.pow(x - 1, 1 / 1.8);
                },
                ret: 1,
              },
            );

            //canv+=poly(bpl,{fil:col,wid:0})
            T = T.concat(
              PolyTools.triangulate(bpl, {
                area: 50,
                convex: true,
                optimize: false,
              }),
            );
          }
        }
        line1.push([nx + (nslist[i][0] - 0.5) * wid - wid / 2, ny]);
        line2.push([nx + (nslist[i][1] - 0.5) * wid + wid / 2, ny]);
      }

      //canv += poly(line1.concat(line2.reverse()),{fil:col,wid:0})
      T = PolyTools.triangulate(line1.concat(line2.reverse()), {
        area: 50,
        convex: true,
        optimize: true,
      }).concat(T);

      for (var k = 0; k < T.length; k++) {
        var m = PolyTools.midPt(T[k]);
        var c = (Noise.noise(m[0] * 0.02, m[1] * 0.02) * 200 + 50) | 0;
        var co = "rgba(" + c + "," + c + "," + c + ",0.8)";
        canv += poly(T[k], { fil: co, str: co, wid: 0 });
      }
      return canv;
    };

    this.tree08 = function(x, y, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 80;
      var wid = args.wid != undefined ? args.wid : 1;
      var col = args.col != undefined ? args.col : "rgba(100,100,100,0.5)";
      var noi = args.noi != undefined ? args.noi : 0.5;

      var canv = "";
      var txcanv = "";
      var twcanv = "";

      var ang = normRand(-1, 1) * Math.PI * 0.2;

      var trlist = branch({
        hei: hei,
        wid: wid,
        ang: -Math.PI / 2 + ang,
        ben: Math.PI * 0.2,
        det: hei / 20,
      });
      //txcanv += barkify(x,y,trlist)

      trlist = trlist[0].concat(trlist[1].reverse());

      function fracTree(xoff, yoff, dep, args) {
        var args = args != undefined ? args : {};
        var ang = args.ang != undefined ? args.ang : -Math.PI / 2;
        var len = args.len != undefined ? args.len : 15;
        var ben = args.ben != undefined ? args.ben : 0;

        var fun =
          dep == 0
            ? function(x) {
                return Math.cos(0.5 * Math.PI * x);
              }
            : function(x) {
                return 1;
              };
        var spt = [xoff, yoff];
        var ept = [xoff + Math.cos(ang) * len, yoff + Math.sin(ang) * len];

        var trmlist = [[xoff, yoff], [xoff + len, yoff]];

        var bfun = randChoice([
          function(x) {
            return Math.sin(x * Math.PI);
          },
          function(x) {
            return -Math.sin(x * Math.PI);
          },
        ]);

        trmlist = div(trmlist, 10);

        for (var i = 0; i < trmlist.length; i++) {
          trmlist[i][1] += bfun(i / trmlist.length) * 2;
        }
        for (var i = 0; i < trmlist.length; i++) {
          var d = distance(trmlist[i], spt);
          var a = Math.atan2(trmlist[i][1] - spt[1], trmlist[i][0] - spt[0]);
          trmlist[i][0] = spt[0] + d * Math.cos(a + ang);
          trmlist[i][1] = spt[1] + d * Math.sin(a + ang);
        }

        var tcanv = "";
        tcanv += stroke(trmlist, {
          fun: fun,
          wid: 0.8,
          col: "rgba(100,100,100,0.5)",
        });
        if (dep != 0) {
          var nben = ben + randChoice([-1, 1]) * Math.PI * 0.001 * dep * dep;
          if (Math.random() < 0.5) {
            tcanv += fracTree(ept[0], ept[1], dep - 1, {
              ang:
                ang +
                ben +
                Math.PI *
                  randChoice([normRand(-1, 0.5), normRand(0.5, 1)]) *
                  0.2,
              len: len * normRand(0.8, 0.9),
              ben: nben,
            });
            tcanv += fracTree(ept[0], ept[1], dep - 1, {
              ang:
                ang +
                ben +
                Math.PI *
                  randChoice([normRand(-1, -0.5), normRand(0.5, 1)]) *
                  0.2,
              len: len * normRand(0.8, 0.9),
              ben: nben,
            });
          } else {
            tcanv += fracTree(ept[0], ept[1], dep - 1, {
              ang: ang + ben,
              len: len * normRand(0.8, 0.9),
              ben: nben,
            });
          }
        }
        return tcanv;
      }

      for (var i = 0; i < trlist.length; i++) {
        if (Math.random() < 0.2) {
          twcanv += fracTree(
            x + trlist[i][0],
            y + trlist[i][1],
            Math.floor(4 * Math.random()),
            { hei: 20, ang: -Math.PI / 2 - ang * Math.random() },
          );
        } else if (i == Math.floor(trlist.length / 2)) {
          twcanv += fracTree(x + trlist[i][0], y + trlist[i][1], 3, {
            hei: 25,
            ang: -Math.PI / 2 + ang,
          });
        }
      }

      canv += poly(trlist, { xof: x, yof: y, fil: "white", str: col, wid: 0 });

      canv += stroke(
        trlist.map(function(v) {
          return [v[0] + x, v[1] + y];
        }),
        {
          col:
            "rgba(100,100,100," + (0.6 + Math.random() * 0.1).toFixed(3) + ")",
          wid: 2.5,
          fun: function(x) {
            return Math.sin(1);
          },
          noi: 0.9,
          out: 0,
        },
      );

      canv += txcanv;
      canv += twcanv;
      //console.log(canv)
      return canv;
    };
  }();

  

var Mount = new function() {
    var foot = function(ptlist, args) {
      var args = args != undefined ? args : {};
      var xof = args.xof != undefined ? args.xof : 0;
      var yof = args.yof != undefined ? args.yof : 0;
      var ret = args.ret != undefined ? args.ret : 0;

      var ftlist = [];
      var span = 10;
      var ni = 0;
      for (var i = 0; i < ptlist.length - 2; i += 1) {
        if (i == ni) {
          ni = Math.min(ni + randChoice([1, 2]), ptlist.length - 1);

          ftlist.push([]);
          ftlist.push([]);
          for (var j = 0; j < Math.min(ptlist[i].length / 8, 10); j++) {
            ftlist[ftlist.length - 2].push([
              ptlist[i][j][0] + Noise.noise(j * 0.1, i) * 10,
              ptlist[i][j][1],
            ]);
            ftlist[ftlist.length - 1].push([
              ptlist[i][ptlist[i].length - 1 - j][0] -
                Noise.noise(j * 0.1, i) * 10,
              ptlist[i][ptlist[i].length - 1 - j][1],
            ]);
          }

          ftlist[ftlist.length - 2] = ftlist[ftlist.length - 2].reverse();
          ftlist[ftlist.length - 1] = ftlist[ftlist.length - 1].reverse();
          for (var j = 0; j < span; j++) {
            var p = j / span;
            var x1 = ptlist[i][0][0] * (1 - p) + ptlist[ni][0][0] * p;
            var y1 = ptlist[i][0][1] * (1 - p) + ptlist[ni][0][1] * p;

            var x2 =
              ptlist[i][ptlist[i].length - 1][0] * (1 - p) +
              ptlist[ni][ptlist[i].length - 1][0] * p;
            var y2 =
              ptlist[i][ptlist[i].length - 1][1] * (1 - p) +
              ptlist[ni][ptlist[i].length - 1][1] * p;

            var vib = -1.7 * (p - 1) * Math.pow(p, 1 / 5);
            y1 += vib * 5 + Noise.noise(xof * 0.05, i) * 5;
            y2 += vib * 5 + Noise.noise(xof * 0.05, i) * 5;

            ftlist[ftlist.length - 2].push([x1, y1]);
            ftlist[ftlist.length - 1].push([x2, y2]);
          }
        }
      }
      var canv = "";
      for (var i = 0; i < ftlist.length; i++) {
        canv += poly(ftlist[i], {
          xof: xof,
          yof: yof,
          fil: "white",
          str: "none",
        });
      }
      for (var j = 0; j < ftlist.length; j++) {
        canv += stroke(
          ftlist[j].map(function(x) {
            return [x[0] + xof, x[1] + yof];
          }),
          {
            col:
              "rgba(100,100,100," +
              (0.1 + Math.random() * 0.1).toFixed(3) +
              ")",
            wid: 1,
          },
        );
      }
      return ret ? ftlist : canv;
    };

    this.mountain = function(xoff, yoff, seed, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 100 + Math.random() * 400;
      var wid = args.wid != undefined ? args.wid : 400 + Math.random() * 200;
      var tex = args.tex != undefined ? args.tex : 200;
      var veg = args.veg != undefined ? args.veg : true;
      var ret = args.ret != undefined ? args.ret : 0;
      var col = args.col != undefined ? args.col : undefined;

      seed = seed != undefined ? seed : 0;

      var canv = "";

      var ptlist = [];
      var h = hei;
      var w = wid;
      var reso = [10, 50];

      var hoff = 0;
      for (var j = 0; j < reso[0]; j++) {
        hoff += (Math.random() * yoff) / 100;
        ptlist.push([]);
        for (var i = 0; i < reso[1]; i++) {
          var x = (i / reso[1] - 0.5) * Math.PI;
          var y = Math.cos(x);
          y *= Noise.noise(x + 10, j * 0.15, seed);
          var p = 1 - j / reso[0];
          ptlist[ptlist.length - 1].push([
            (x / Math.PI) * w * p,
            -y * h * p + hoff,
          ]);
        }
      }

      function vegetate(treeFunc, growthRule, proofRule) {
        var veglist = [];
        for (var i = 0; i < ptlist.length; i += 1) {
          for (var j = 0; j < ptlist[i].length; j += 1) {
            if (growthRule(i, j)) {
              veglist.push([ptlist[i][j][0], ptlist[i][j][1]]);
            }
          }
        }
        for (var i = 0; i < veglist.length; i++) {
          if (proofRule(veglist, i)) {
            canv += treeFunc(veglist[i][0], veglist[i][1]);
          }
        }
      }
      //RIM
      vegetate(
        function(x, y) {
          return Tree.tree02(x + xoff, y + yoff - 5, {
            col:
              "rgba(100,100,100," +
              (Noise.noise(0.01 * x, 0.01 * y) * 0.5 * 0.3 + 0.5).toFixed(3) +
              ")",
            clu: 2,
          });
        },
        function(i, j) {
          var ns = Noise.noise(j * 0.1, seed);
          return (
            i == 0 && ns * ns * ns < 0.1 && Math.abs(ptlist[i][j][1]) / h > 0.2
          );
        },
        function(veglist, i) {
          return true;
        },
      );

      //WHITE BG
      canv += poly(ptlist[0].concat([[0, reso[0] * 4]]), {
        xof: xoff,
        yof: yoff,
        fil: "white",
        str: "none",
      });
      //OUTLINE
      canv += stroke(
        ptlist[0].map(function(x) {
          return [x[0] + xoff, x[1] + yoff];
        }),
        { col: "rgba(100,100,100,0.3)", noi: 1, wid: 3 },
      );

      canv += foot(ptlist, { xof: xoff, yof: yoff });
      canv += texture(ptlist, {
        xof: xoff,
        yof: yoff,
        tex: tex,
        sha: randChoice([0, 0, 0, 0, 5]),
        col: col,
      });

      //TOP
      vegetate(
        function(x, y) {
          return Tree.tree02(x + xoff, y + yoff, {
            col:
              "rgba(100,100,100," +
              (Noise.noise(0.01 * x, 0.01 * y) * 0.5 * 0.3 + 0.5).toFixed(3) +
              ")",
          });
        },
        function(i, j) {
          var ns = Noise.noise(i * 0.1, j * 0.1, seed + 2);
          return ns * ns * ns < 0.1 && Math.abs(ptlist[i][j][1]) / h > 0.5;
        },
        function(veglist, i) {
          return true;
        },
      );

      if (veg) {
        //MIDDLE
        vegetate(
          function(x, y) {
            var ht = ((h + y) / h) * 70;
            ht = ht * 0.3 + Math.random() * ht * 0.7;
            return Tree.tree01(x + xoff, y + yoff, {
              hei: ht,
              wid: Math.random() * 3 + 1,
              col:
                "rgba(100,100,100," +
                (Noise.noise(0.01 * x, 0.01 * y) * 0.5 * 0.3 + 0.3).toFixed(3) +
                ")",
            });
          },
          function(i, j) {
            var ns = Noise.noise(i * 0.2, j * 0.05, seed);
            return (
              j % 2 &&
              ns * ns * ns * ns < 0.012 &&
              Math.abs(ptlist[i][j][1]) / h < 0.3
            );
          },
          function(veglist, i) {
            var counter = 0;
            for (var j = 0; j < veglist.length; j++) {
              if (
                i != j &&
                Math.pow(veglist[i][0] - veglist[j][0], 2) +
                  Math.pow(veglist[i][1] - veglist[j][1], 2) <
                  30 * 30
              ) {
                counter++;
              }
              if (counter > 2) {
                return true;
              }
            }
            return false;
          },
        );

        //BOTTOM
        vegetate(
          function(x, y) {
            var ht = ((h + y) / h) * 120;
            ht = ht * 0.5 + Math.random() * ht * 0.5;
            var bc = Math.random() * 0.1;
            var bp = 1;
            return Tree.tree03(x + xoff, y + yoff, {
              hei: ht,
              ben: function(x) {
                return Math.pow(x * bc, bp);
              },
              col:
                "rgba(100,100,100," +
                (Noise.noise(0.01 * x, 0.01 * y) * 0.5 * 0.3 + 0.3).toFixed(3) +
                ")",
            });
          },
          function(i, j) {
            var ns = Noise.noise(i * 0.2, j * 0.05, seed);
            return (
              (j == 0 || j == ptlist[i].length - 1) && ns * ns * ns * ns < 0.012
            );
          },
          function(veglist, i) {
            return true;
          },
        );
      }

      //BOTT ARCH
      vegetate(
        function(x, y) {
          var tt = randChoice([0, 0, 1, 1, 1, 2]);
          if (tt == 1) {
            return Arch.arch02(x + xoff, y + yoff, seed, {
              wid: normRand(40, 70),
              sto: randChoice([1, 2, 2, 3]),
              rot: Math.random(),
              sty: randChoice([1, 2, 3]),
            });
          } else if (tt == 2) {
            return Arch.arch04(x + xoff, y + yoff, seed, {
              sto: randChoice([1, 1, 1, 2, 2]),
            });
          } else {
            return "";
          }
        },
        function(i, j) {
          var ns = Noise.noise(i * 0.2, j * 0.05, seed + 10);
          return (
            i != 0 &&
            (j == 1 || j == ptlist[i].length - 2) &&
            ns * ns * ns * ns < 0.008
          );
        },
        function(veglist, i) {
          return true;
        },
      );
      //TOP ARCH
      vegetate(
        function(x, y) {
          return Arch.arch03(x + xoff, y + yoff, seed, {
            sto: randChoice([5, 7]),
            wid: 40 + Math.random() * 20,
          });
        },
        function(i, j) {
          return (
            i == 1 &&
            Math.abs(j - ptlist[i].length / 2) < 1 &&
            Math.random() < 0.02
          );
        },
        function(veglist, i) {
          return true;
        },
      );

      //TRANSM
      vegetate(
        function(x, y) {
          return Arch.transmissionTower01(x + xoff, y + yoff, seed);
        },
        function(i, j) {
          var ns = Noise.noise(i * 0.2, j * 0.05, seed + 20 * Math.PI);
          return (
            i % 2 == 0 &&
            (j == 1 || j == ptlist[i].length - 2) &&
            ns * ns * ns * ns < 0.002
          );
        },
        function(veglist, i) {
          return true;
        },
      );

      //BOTT ROCK
      vegetate(
        function(x, y) {
          return Mount.rock(x + xoff, y + yoff, seed, {
            wid: 20 + Math.random() * 20,
            hei: 20 + Math.random() * 20,
            sha: 2,
          });
        },
        function(i, j) {
          return (j == 0 || j == ptlist[i].length - 1) && Math.random() < 0.1;
        },
        function(veglist, i) {
          return true;
        },
      );

      if (ret == 0) {
        return canv;
      } else {
        return [ptlist];
      }
    };

    this.flatMount = function(xoff, yoff, seed, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 40 + Math.random() * 400;
      var wid = args.wid != undefined ? args.wid : 400 + Math.random() * 200;
      var tex = args.tex != undefined ? args.tex : 80;
      var cho = args.cho != undefined ? args.cho : 0.5;
      var ret = args.ret != undefined ? args.ret : 0;

      seed = seed != undefined ? seed : 0;

      var canv = "";
      var ptlist = [];
      var reso = [5, 50];
      var hoff = 0;
      var flat = [];
      for (var j = 0; j < reso[0]; j++) {
        hoff += (Math.random() * yoff) / 100;
        ptlist.push([]);
        flat.push([]);
        for (var i = 0; i < reso[1]; i++) {
          var x = (i / reso[1] - 0.5) * Math.PI;
          var y = Math.cos(x * 2) + 1;
          y *= Noise.noise(x + 10, j * 0.1, seed);
          var p = 1 - (j / reso[0]) * 0.6;
          var nx = (x / Math.PI) * wid * p;
          var ny = -y * hei * p + hoff;
          var h = 100;
          if (ny < -h * cho + hoff) {
            ny = -h * cho + hoff;
            if (flat[flat.length - 1].length % 2 == 0) {
              flat[flat.length - 1].push([nx, ny]);
            }
          } else {
            if (flat[flat.length - 1].length % 2 == 1) {
              flat[flat.length - 1].push(
                ptlist[ptlist.length - 1][ptlist[ptlist.length - 1].length - 1],
              );
            }
          }

          ptlist[ptlist.length - 1].push([nx, ny]);
        }
      }

      //WHITE BG
      canv += poly(ptlist[0].concat([[0, reso[0] * 4]]), {
        xof: xoff,
        yof: yoff,
        fil: "white",
        str: "none",
      });
      //OUTLINE
      canv += stroke(
        ptlist[0].map(function(x) {
          return [x[0] + xoff, x[1] + yoff];
        }),
        { col: "rgba(100,100,100,0.3)", noi: 1, wid: 3 },
      );

      //canv += foot(ptlist,{xof:xoff,yof:yoff})
      canv += texture(ptlist, {
        xof: xoff,
        yof: yoff,
        tex: tex,
        wid: 2,
        dis: function() {
          if (Math.random() > 0.5) {
            return 0.1 + 0.4 * Math.random();
          } else {
            return 0.9 - 0.4 * Math.random();
          }
        },
      });
      var grlist1 = [];
      var grlist2 = [];
      for (var i = 0; i < flat.length; i += 2) {
        if (flat[i].length >= 2) {
          grlist1.push(flat[i][0]);
          grlist2.push(flat[i][flat[i].length - 1]);
        }
      }

      if (grlist1.length == 0) {
        return canv;
      }
      var wb = [grlist1[0][0], grlist2[0][0]];
      for (var i = 0; i < 3; i++) {
        var p = 0.8 - i * 0.2;

        grlist1.unshift([wb[0] * p, grlist1[0][1] - 5]);
        grlist2.unshift([wb[1] * p, grlist2[0][1] - 5]);
      }
      wb = [grlist1[grlist1.length - 1][0], grlist2[grlist2.length - 1][0]];
      for (var i = 0; i < 3; i++) {
        var p = 0.6 - i * i * 0.1;
        grlist1.push([wb[0] * p, grlist1[grlist1.length - 1][1] + 1]);
        grlist2.push([wb[1] * p, grlist2[grlist2.length - 1][1] + 1]);
      }

      var d = 5;
      grlist1 = div(grlist1, d);
      grlist2 = div(grlist2, d);

      var grlist = grlist1.reverse().concat(grlist2.concat([grlist1[0]]));
      for (var i = 0; i < grlist.length; i++) {
        var v = (1 - Math.abs((i % d) - d / 2) / (d / 2)) * 0.12;
        grlist[i][0] *= 1 - v + Noise.noise(grlist[i][1] * 0.5) * v;
      }
      /*       for (var i = 0; i < ptlist.length; i++){
        canv += poly(ptlist[i],{xof:xoff,yof:yoff,str:"red",fil:"none",wid:2})
      }
 */
      canv += poly(grlist, {
        xof: xoff,
        yof: yoff,
        str: "none",
        fil: "white",
        wid: 2,
      });
      canv += stroke(grlist.map(x => [x[0] + xoff, x[1] + yoff]), {
        wid: 3,
        col: "rgba(100,100,100,0.2)",
      });

      var bound = function(plist) {
        var xmin;
        var xmax;
        var ymin;
        var ymax;
        for (var i = 0; i < plist.length; i++) {
          if (xmin == undefined || plist[i][0] < xmin) {
            xmin = plist[i][0];
          }
          if (xmax == undefined || plist[i][0] > xmax) {
            xmax = plist[i][0];
          }
          if (ymin == undefined || plist[i][1] < ymin) {
            ymin = plist[i][1];
          }
          if (ymax == undefined || plist[i][1] > ymax) {
            ymax = plist[i][1];
          }
        }
        return { xmin: xmin, xmax: xmax, ymin: ymin, ymax: ymax };
      };

      canv += this.flatDec(xoff, yoff, bound(grlist));

      return canv;
    };

    this.flatDec = function(xoff, yoff, grbd) {
      var canv = "";

      var tt = randChoice([0, 0, 1, 2, 3, 4]);

      for (var j = 0; j < Math.random() * 5; j++) {
        canv += Mount.rock(
          xoff + normRand(grbd.xmin, grbd.xmax),
          yoff + (grbd.ymin + grbd.ymax) / 2 + normRand(-10, 10) + 10,
          Math.random() * 100,
          {
            wid: 10 + Math.random() * 20,
            hei: 10 + Math.random() * 20,
            sha: 2,
          },
        );
      }
      for (var j = 0; j < randChoice([0, 0, 1, 2]); j++) {
        var xr = xoff + normRand(grbd.xmin, grbd.xmax);
        var yr = yoff + (grbd.ymin + grbd.ymax) / 2 + normRand(-5, 5) + 20;
        for (var k = 0; k < 2 + Math.random() * 3; k++) {
          canv += Tree.tree08(
            xr + Math.min(Math.max(normRand(-30, 30), grbd.xmin), grbd.xmax),
            yr,
            { hei: 60 + Math.random() * 40 },
          );
        }
      }

      if (tt == 0) {
        for (var j = 0; j < Math.random() * 3; j++) {
          canv += Mount.rock(
            xoff + normRand(grbd.xmin, grbd.xmax),
            yoff + (grbd.ymin + grbd.ymax) / 2 + normRand(-5, 5) + 20,
            Math.random() * 100,
            {
              wid: 50 + Math.random() * 20,
              hei: 40 + Math.random() * 20,
              sha: 5,
            },
          );
        }
      }
      if (tt == 1) {
        var pmin = Math.random() * 0.5;
        var pmax = Math.random() * 0.5 + 0.5;
        var xmin = grbd.xmin * (1 - pmin) + grbd.xmax * pmin;
        var xmax = grbd.xmin * (1 - pmax) + grbd.xmax * pmax;
        for (var i = xmin; i < xmax; i += 30) {
          canv += Tree.tree05(
            xoff + i + 20 * normRand(-1, 1),
            yoff + (grbd.ymin + grbd.ymax) / 2 + 20,
            { hei: 100 + Math.random() * 200 },
          );
        }
        for (var j = 0; j < Math.random() * 4; j++) {
          canv += Mount.rock(
            xoff + normRand(grbd.xmin, grbd.xmax),
            yoff + (grbd.ymin + grbd.ymax) / 2 + normRand(-5, 5) + 20,
            Math.random() * 100,
            {
              wid: 50 + Math.random() * 20,
              hei: 40 + Math.random() * 20,
              sha: 5,
            },
          );
        }
      } else if (tt == 2) {
        for (var i = 0; i < randChoice([1, 1, 1, 1, 2, 2, 3]); i++) {
          var xr = normRand(grbd.xmin, grbd.xmax);
          var yr = (grbd.ymin + grbd.ymax) / 2;
          canv += Tree.tree04(xoff + xr, yoff + yr + 20, {});
          for (var j = 0; j < Math.random() * 2; j++) {
            canv += Mount.rock(
              xoff +
                Math.max(
                  grbd.xmin,
                  Math.min(grbd.xmax, xr + normRand(-50, 50)),
                ),
              yoff + yr + normRand(-5, 5) + 20,
              j * i * Math.random() * 100,
              {
                wid: 50 + Math.random() * 20,
                hei: 40 + Math.random() * 20,
                sha: 5,
              },
            );
          }
        }
      } else if (tt == 3) {
        for (var i = 0; i < randChoice([1, 1, 1, 1, 2, 2, 3]); i++) {
          canv += Tree.tree06(
            xoff + normRand(grbd.xmin, grbd.xmax),
            yoff + (grbd.ymin + grbd.ymax) / 2,
            { hei: 60 + Math.random() * 60 },
          );
        }
      } else if (tt == 4) {
        var pmin = Math.random() * 0.5;
        var pmax = Math.random() * 0.5 + 0.5;
        var xmin = grbd.xmin * (1 - pmin) + grbd.xmax * pmin;
        var xmax = grbd.xmin * (1 - pmax) + grbd.xmax * pmax;
        for (var i = xmin; i < xmax; i += 20) {
          canv += Tree.tree07(
            xoff + i + 20 * normRand(-1, 1),
            yoff + (grbd.ymin + grbd.ymax) / 2 + normRand(-1, 1) + 0,
            { hei: normRand(40, 80) },
          );
        }
      }

      for (var i = 0; i < 50 * Math.random(); i++) {
        canv += Tree.tree02(
          xoff + normRand(grbd.xmin, grbd.xmax),
          yoff + normRand(grbd.ymin, grbd.ymax),
        );
      }

      var ts = randChoice([0, 0, 0, 0, 1]);
      if (ts == 1 && tt != 4) {
        canv += Arch.arch01(
          xoff + normRand(grbd.xmin, grbd.xmax),
          yoff + (grbd.ymin + grbd.ymax) / 2 + 20,
          Math.random(),
          {
            wid: normRand(160, 200),
            hei: normRand(80, 100),
            per: Math.random(),
          },
        );
      }

      return canv;
    };

    this.distMount = function(xoff, yoff, seed, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 300;
      var len = args.len != undefined ? args.len : 2000;
      var seg = args.seg != undefined ? args.seg : 5;

      seed = seed != undefined ? seed : 0;
      var canv = "";
      var span = 10;

      var ptlist = [];

      for (var i = 0; i < len / span / seg; i++) {
        ptlist.push([]);
        for (var j = 0; j < seg + 1; j++) {
          var tran = function(k) {
            return [
              xoff + k * span,
              yoff -
                hei *
                  Noise.noise(k * 0.05, seed) *
                  Math.pow(Math.sin((Math.PI * k) / (len / span)), 0.5),
            ];
          };
          ptlist[ptlist.length - 1].push(tran(i * seg + j));
        }
        for (var j = 0; j < seg / 2 + 1; j++) {
          var tran = function(k) {
            return [
              xoff + k * span,
              yoff +
                24 *
                  Noise.noise(k * 0.05, 2, seed) *
                  Math.pow(Math.sin((Math.PI * k) / (len / span)), 1),
            ];
          };
          ptlist[ptlist.length - 1].unshift(tran(i * seg + j * 2));
        }
      }
      for (var i = 0; i < ptlist.length; i++) {
        var getCol = function(x, y) {
          var c = (Noise.noise(x * 0.02, y * 0.02, yoff) * 55 + 200) | 0;
          return "rgb(" + c + "," + c + "," + c + ")";
        };
        canv += poly(ptlist[i], {
          fil: getCol(...ptlist[i][ptlist[i].length - 1]),
          str: "none",
          wid: 1,
        });

        var T = PolyTools.triangulate(ptlist[i], {
          area: 100,
          convex: true,
          optimize: false,
        });
        for (var k = 0; k < T.length; k++) {
          var m = PolyTools.midPt(T[k]);
          var co = getCol(m[0], m[1]);
          canv += poly(T[k], { fil: co, str: co, wid: 1 });
        }
      }
      return canv;
    };

    this.rock = function(xoff, yoff, seed, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 80;
      var wid = args.wid != undefined ? args.wid : 100;
      var tex = args.tex != undefined ? args.tex : 40;
      var ret = args.ret != undefined ? args.ret : 0;
      var sha = args.sha != undefined ? args.sha : 10;

      seed = seed != undefined ? seed : 0;

      var canv = "";

      var reso = [10, 50];
      var ptlist = [];

      for (var i = 0; i < reso[0]; i++) {
        ptlist.push([]);

        var nslist = [];
        for (var j = 0; j < reso[1]; j++) {
          nslist.push(Noise.noise(i, j * 0.2, seed));
        }
        loopNoise(nslist);

        for (var j = 0; j < reso[1]; j++) {
          var a = (j / reso[1]) * Math.PI * 2 - Math.PI / 2;
          var l =
            (wid * hei) /
            Math.sqrt(
              Math.pow(hei * Math.cos(a), 2) + Math.pow(wid * Math.sin(a), 2),
            );

          /*           var l = Math.sin(a)>0? Math.pow(Math.sin(a),0.1)*wid
                             : - Math.pow(Math.sin(a+Math.PI),0.1)*wid */
          l *= 0.7 + 0.3 * nslist[j];

          var p = 1 - i / reso[0];

          var nx = Math.cos(a) * l * p;
          var ny = -Math.sin(a) * l * p;

          if (Math.PI < a || a < 0) {
            ny *= 0.2;
          }

          ny += hei * (i / reso[0]) * 0.2;

          ptlist[ptlist.length - 1].push([nx, ny]);
        }
      }

      //WHITE BG
      canv += poly(ptlist[0].concat([[0, 0]]), {
        xof: xoff,
        yof: yoff,
        fil: "white",
        str: "none",
      });
      //OUTLINE
      canv += stroke(
        ptlist[0].map(function(x) {
          return [x[0] + xoff, x[1] + yoff];
        }),
        { col: "rgba(100,100,100,0.3)", noi: 1, wid: 3 },
      );
      canv += texture(ptlist, {
        xof: xoff,
        yof: yoff,
        tex: tex,
        wid: 3,
        sha: sha,
        col: function(x) {
          return (
            "rgba(180,180,180," + (0.3 + Math.random() * 0.3).toFixed(3) + ")"
          );
        },
        dis: function() {
          if (Math.random() > 0.5) {
            return 0.15 + 0.15 * Math.random();
          } else {
            return 0.85 - 0.15 * Math.random();
          }
        },
      });

      for (var i = 0; i < reso[0]; i++) {
        //canv += poly(ptlist[i],{xof:xoff,yof:yoff,fil:"none",str:"red",wid:2})
      }
      return canv;
    };
  }();

  

var Arch = new function() {
    var flip = function(ptlist, axis) {
      axis = axis == undefined ? 0 : axis;
      for (var i = 0; i < ptlist.length; i++) {
        if (ptlist[i].length > 0) {
          if (typeof ptlist[i][0] == "object") {
            for (var j = 0; j < ptlist[i].length; j++) {
              ptlist[i][j][0] = axis - (ptlist[i][j][0] - axis);
            }
          } else {
            ptlist[i][0] = axis - (ptlist[i][0] - axis);
          }
        }
      }
      return ptlist;
    };

    var hut = function(xoff, yoff, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 40;
      var wid = args.wid != undefined ? args.wid : 180;
      var tex = args.tex != undefined ? args.tex : 300;

      var reso = [10, 10];
      var ptlist = [];

      for (var i = 0; i < reso[0]; i++) {
        ptlist.push([]);
        var heir = hei + hei * 0.2 * Math.random();
        for (var j = 0; j < reso[1]; j++) {
          var nx =
            wid * (i / (reso[0] - 1) - 0.5) * Math.pow(j / (reso[1] - 1), 0.7);
          var ny = heir * (j / (reso[1] - 1));
          ptlist[ptlist.length - 1].push([nx, ny]);
        }
      }
      var canv = "";
      canv += poly(
        ptlist[0]
          .slice(0, -1)
          .concat(ptlist[ptlist.length - 1].slice(0, -1).reverse()),
        { xof: xoff, yof: yoff, fil: "white", str: "none" },
      );
      canv += poly(ptlist[0], {
        xof: xoff,
        yof: yoff,
        fil: "none",
        str: "rgba(100,100,100,0.3)",
        wid: 2,
      });
      canv += poly(ptlist[ptlist.length - 1], {
        xof: xoff,
        yof: yoff,
        fil: "none",
        str: "rgba(100,100,100,0.3)",
        wid: 2,
      });

      canv += texture(ptlist, {
        xof: xoff,
        yof: yoff,
        tex: tex,
        wid: 1,
        len: 0.25,
        col: function(x) {
          return (
            "rgba(120,120,120," + (0.3 + Math.random() * 0.3).toFixed(3) + ")"
          );
        },
        dis: function() {
          return wtrand(a => a * a);
        },
        noi: function(x) {
          return 5;
        },
      });

      for (var i = 0; i < reso[0]; i++) {
        //canv += poly(ptlist[i],{xof:xoff,yof:yoff,fil:"none",str:"red",wid:2})
      }

      return canv;
    };

    var box = function(xoff, yoff, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 20;
      var wid = args.wid != undefined ? args.wid : 120;
      var rot = args.rot != undefined ? args.rot : 0.7;
      var per = args.per != undefined ? args.per : 4;
      var tra = args.tra != undefined ? args.tra : true;
      var bot = args.bot != undefined ? args.bot : true;
      var wei = args.wei != undefined ? args.wei : 3;
      var dec =
        args.dec != undefined
          ? args.dec
          : function(a) {
              return [];
            };

      var mid = -wid * 0.5 + wid * rot;
      var bmid = -wid * 0.5 + wid * (1 - rot);
      var ptlist = [];
      ptlist.push(div([[-wid * 0.5, -hei], [-wid * 0.5, 0]], 5));
      ptlist.push(div([[wid * 0.5, -hei], [wid * 0.5, 0]], 5));
      if (bot) {
        ptlist.push(div([[-wid * 0.5, 0], [mid, per]], 5));
        ptlist.push(div([[wid * 0.5, 0], [mid, per]], 5));
      }
      ptlist.push(div([[mid, -hei], [mid, per]], 5));
      if (tra) {
        if (bot) {
          ptlist.push(div([[-wid * 0.5, 0], [bmid, -per]], 5));
          ptlist.push(div([[wid * 0.5, 0], [bmid, -per]], 5));
        }
        ptlist.push(div([[bmid, -hei], [bmid, -per]], 5));
      }

      var surf = (rot < 0.5) * 2 - 1;
      ptlist = ptlist.concat(
        dec({
          pul: [surf * wid * 0.5, -hei],
          pur: [mid, -hei + per],
          pdl: [surf * wid * 0.5, 0],
          pdr: [mid, per],
        }),
      );

      var polist = [
        [-wid * 0.5, -hei],
        [wid * 0.5, -hei],
        [wid * 0.5, 0],
        [mid, per],
        [-wid * 0.5, 0],
      ];

      var canv = "";
      if (!tra) {
        canv += poly(polist, {
          xof: xoff,
          yof: yoff,
          str: "none",
          fil: "white",
        });
      }

      for (var i = 0; i < ptlist.length; i++) {
        canv += stroke(
          ptlist[i].map(function(x) {
            return [x[0] + xoff, x[1] + yoff];
          }),
          {
            col: "rgba(100,100,100,0.4)",
            noi: 1,
            wid: wei,
            fun: function(x) {
              return 1;
            },
          },
        );
      }
      return canv;
    };

    var deco = function(style, args) {
      var args = args != undefined ? args : {};
      var pul = args.pul != undefined ? args.pul : [0, 0];
      var pur = args.pur != undefined ? args.pur : [0, 100];
      var pdl = args.pdl != undefined ? args.pdl : [100, 0];
      var pdr = args.pdr != undefined ? args.pdr : [100, 100];
      var hsp = args.hsp != undefined ? args.hsp : [1, 3];
      var vsp = args.vsp != undefined ? args.vsp : [1, 2];

      var plist = [];
      var dl = div([pul, pdl], vsp[1]);
      var dr = div([pur, pdr], vsp[1]);
      var du = div([pul, pur], hsp[1]);
      var dd = div([pdl, pdr], hsp[1]);

      if (style == 1) {
        //-| |-
        var mlu = du[hsp[0]];
        var mru = du[du.length - 1 - hsp[0]];
        var mld = dd[hsp[0]];
        var mrd = dd[du.length - 1 - hsp[0]];

        for (var i = vsp[0]; i < dl.length - vsp[0]; i += vsp[0]) {
          var mml = div([mlu, mld], vsp[1])[i];
          var mmr = div([mru, mrd], vsp[1])[i];
          var ml = dl[i];
          var mr = dr[i];
          plist.push(div([mml, ml], 5));
          plist.push(div([mmr, mr], 5));
        }
        plist.push(div([mlu, mld], 5));
        plist.push(div([mru, mrd], 5));
      } else if (style == 2) {
        //||||

        for (var i = hsp[0]; i < du.length - hsp[0]; i += hsp[0]) {
          var mu = du[i];
          var md = dd[i];
          plist.push(div([mu, md], 5));
        }
      } else if (style == 3) {
        //|##|
        var mlu = du[hsp[0]];
        var mru = du[du.length - 1 - hsp[0]];
        var mld = dd[hsp[0]];
        var mrd = dd[du.length - 1 - hsp[0]];

        for (var i = vsp[0]; i < dl.length - vsp[0]; i += vsp[0]) {
          var mml = div([mlu, mld], vsp[1])[i];
          var mmr = div([mru, mrd], vsp[1])[i];
          var mmu = div([mlu, mru], vsp[1])[i];
          var mmd = div([mld, mrd], vsp[1])[i];

          var ml = dl[i];
          var mr = dr[i];
          plist.push(div([mml, mmr], 5));
          plist.push(div([mmu, mmd], 5));
        }
        plist.push(div([mlu, mld], 5));
        plist.push(div([mru, mrd], 5));
      }
      return plist;
    };

    var rail = function(xoff, yoff, seed, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 20;
      var wid = args.wid != undefined ? args.wid : 180;
      var rot = args.rot != undefined ? args.rot : 0.7;
      var per = args.per != undefined ? args.per : 4;
      var seg = args.seg != undefined ? args.seg : 4;
      var wei = args.wei != undefined ? args.wei : 1;
      var tra = args.tra != undefined ? args.tra : true;
      var fro = args.fro != undefined ? args.fro : true;

      seed = seed != undefined ? seed : 0;

      var mid = -wid * 0.5 + wid * rot;
      var bmid = -wid * 0.5 + wid * (1 - rot);
      var ptlist = [];

      if (fro) {
        ptlist.push(div([[-wid * 0.5, 0], [mid, per]], seg));
        ptlist.push(div([[mid, per], [wid * 0.5, 0]], seg));
      }
      if (tra) {
        ptlist.push(div([[-wid * 0.5, 0], [bmid, -per]], seg));
        ptlist.push(div([[bmid, -per], [wid * 0.5, 0]], seg));
      }
      if (fro) {
        ptlist.push(div([[-wid * 0.5, -hei], [mid, -hei + per]], seg));
        ptlist.push(div([[mid, -hei + per], [wid * 0.5, -hei]], seg));
      }
      if (tra) {
        ptlist.push(div([[-wid * 0.5, -hei], [bmid, -hei - per]], seg));
        ptlist.push(div([[bmid, -hei - per], [wid * 0.5, -hei]], seg));
      }
      if (tra) {
        var open = Math.floor(Math.random() * ptlist.length);
        ptlist[open] = ptlist[open].slice(0, -1);
        ptlist[(open + ptlist.length) % ptlist.length] = ptlist[
          (open + ptlist.length) % ptlist.length
        ].slice(0, -1);
      }
      var canv = "";

      for (var i = 0; i < ptlist.length / 2; i++) {
        for (var j = 0; j < ptlist[i].length; j++) {
          //ptlist.push(div([ptlist[i][j],ptlist[4+i][j]],2))
          ptlist[i][j][1] += (Noise.noise(i, j * 0.5, seed) - 0.5) * hei;
          ptlist[(ptlist.length / 2 + i) % ptlist.length][
            j % ptlist[(ptlist.length / 2 + i) % ptlist.length].length
          ][1] += (Noise.noise(i + 0.5, j * 0.5, seed) - 0.5) * hei;
          var ln = div(
            [
              ptlist[i][j],
              ptlist[(ptlist.length / 2 + i) % ptlist.length][
                j % ptlist[(ptlist.length / 2 + i) % ptlist.length].length
              ],
            ],
            2,
          );
          ln[0][0] += (Math.random() - 0.5) * hei * 0.5;
          canv += poly(ln, {
            xof: xoff,
            yof: yoff,
            fil: "none",
            str: "rgba(100,100,100,0.5)",
            wid: 2,
          });
        }
      }

      for (var i = 0; i < ptlist.length; i++) {
        canv += stroke(
          ptlist[i].map(function(x) {
            return [x[0] + xoff, x[1] + yoff];
          }),
          {
            col: "rgba(100,100,100,0.5)",
            noi: 0.5,
            wid: wei,
            fun: function(x) {
              return 1;
            },
          },
        );
      }
      return canv;
    };

    var roof = function(xoff, yoff, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 20;
      var wid = args.wid != undefined ? args.wid : 120;
      var rot = args.rot != undefined ? args.rot : 0.7;
      var per = args.per != undefined ? args.per : 4;
      var cor = args.cor != undefined ? args.cor : 5;
      var wei = args.wei != undefined ? args.wei : 3;
      var pla = args.pla != undefined ? args.pla : [0, ""];

      var opf = function(ptlist) {
        if (rot < 0.5) {
          return flip(ptlist);
        } else {
          return ptlist;
        }
      };
      var rrot = rot < 0.5 ? 1 - rot : rot;

      var mid = -wid * 0.5 + wid * rrot;
      var bmid = -wid * 0.5 + wid * (1 - rrot);
      var quat = (mid + wid * 0.5) * 0.5 - mid;

      var ptlist = [];
      ptlist.push(
        div(
          opf([
            [-wid * 0.5 + quat, -hei - per / 2],
            [-wid * 0.5 + quat * 0.5, -hei / 2 - per / 4],
            [-wid * 0.5 - cor, 0],
          ]),
          5,
        ),
      );
      ptlist.push(
        div(
          opf([
            [mid + quat, -hei],
            [(mid + quat + wid * 0.5) / 2, -hei / 2],
            [wid * 0.5 + cor, 0],
          ]),
          5,
        ),
      );
      ptlist.push(
        div(
          opf([
            [mid + quat, -hei],
            [mid + quat / 2, -hei / 2 + per / 2],
            [mid + cor, per],
          ]),
          5,
        ),
      );

      ptlist.push(div(opf([[-wid * 0.5 - cor, 0], [mid + cor, per]]), 5));
      ptlist.push(div(opf([[wid * 0.5 + cor, 0], [mid + cor, per]]), 5));

      ptlist.push(
        div(opf([[-wid * 0.5 + quat, -hei - per / 2], [mid + quat, -hei]]), 5),
      );

      var canv = "";

      var polist = opf([
        [-wid * 0.5, 0],
        [-wid * 0.5 + quat, -hei - per / 2],
        [mid + quat, -hei],
        [wid * 0.5, 0],
        [mid, per],
      ]);
      canv += poly(polist, { xof: xoff, yof: yoff, str: "none", fil: "white" });

      for (var i = 0; i < ptlist.length; i++) {
        canv += stroke(
          ptlist[i].map(function(x) {
            return [x[0] + xoff, x[1] + yoff];
          }),
          {
            col: "rgba(100,100,100,0.4)",
            noi: 1,
            wid: wei,
            fun: function(x) {
              return 1;
            },
          },
        );
      }

      if (pla[0] == 1) {
        var pp = opf([
          [mid + quat / 2, -hei / 2 + per / 2],
          [-wid * 0.5 + quat * 0.5, -hei / 2 - per / 4],
        ]);
        if (pp[0][0] > pp[1][0]) {
          pp = [pp[1], pp[0]];
        }
        var mp = PolyTools.midPt(pp);
        var a = Math.atan2(pp[1][1] - pp[0][1], pp[1][0] - pp[0][0]);
        var adeg = (a * 180) / Math.PI;
        canv +=
          "<text font-size='" +
          hei * 0.6 +
          "' font-family='Verdana'" +
          " style='fill:rgba(100,100,100,0.9)'" +
          " text-anchor='middle' transform='translate(" +
          (mp[0] + xoff) +
          "," +
          (mp[1] + yoff) +
          ") rotate(" +
          adeg +
          ")'>" +
          pla[1] +
          "</text>";
      }
      return canv;
    };

    var pagroof = function(xoff, yoff, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 20;
      var wid = args.wid != undefined ? args.wid : 120;
      var rot = args.rot != undefined ? args.rot : 0.7;
      var per = args.per != undefined ? args.per : 4;
      var cor = args.cor != undefined ? args.cor : 10;
      var sid = args.sid != undefined ? args.sid : 4;
      var wei = args.wei != undefined ? args.wei : 3;

      var ptlist = [];
      var polist = [[0, -hei]];
      var canv = "";
      for (var i = 0; i < sid; i++) {
        var fx = wid * ((i * 1.0) / (sid - 1) - 0.5);
        var fy = per * (1 - Math.abs((i * 1.0) / (sid - 1) - 0.5) * 2);
        var fxx = (wid + cor) * ((i * 1.0) / (sid - 1) - 0.5);
        if (i > 0) {
          ptlist.push([ptlist[ptlist.length - 1][2], [fxx, fy]]);
        }
        ptlist.push([[0, -hei], [fx * 0.5, (-hei + fy) * 0.5], [fxx, fy]]);
        polist.push([fxx, fy]);
      }

      canv += poly(polist, { xof: xoff, yof: yoff, str: "none", fil: "white" });
      for (var i = 0; i < ptlist.length; i++) {
        canv += stroke(
          div(ptlist[i], 5).map(function(x) {
            return [x[0] + xoff, x[1] + yoff];
          }),
          {
            col: "rgba(100,100,100,0.4)",
            noi: 1,
            wid: wei,
            fun: function(x) {
              return 1;
            },
          },
        );
      }

      return canv;
    };

    this.arch01 = function(xoff, yoff, seed, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 70;
      var wid = args.wid != undefined ? args.wid : 180;
      var rot = args.rot != undefined ? args.rot : 0.7;
      var per = args.per != undefined ? args.per : 5;

      seed = seed != undefined ? seed : 0;

      var p = 0.4 + Math.random() * 0.2;
      var h0 = hei * p;
      var h1 = hei * (1 - p);

      var canv = "";
      canv += hut(xoff, yoff - hei, { hei: h0, wid: wid });
      canv += box(xoff, yoff, {
        hei: h1,
        wid: (wid * 2) / 3,
        per: per,
        bot: false,
      });

      canv += rail(xoff, yoff, seed, {
        tra: true,
        fro: false,
        hei: 10,
        wid: wid,
        per: per * 2,
        seg: (3 + Math.random() * 3) | 0,
      });

      var mcnt = randChoice([0, 1, 1, 2]);
      if (mcnt == 1) {
        canv += Man.man(xoff + normRand(-wid / 3, wid / 3), yoff, {
          fli: randChoice([true, false]),
          sca: 0.42,
        });
      } else if (mcnt == 2) {
        canv += Man.man(xoff + normRand(-wid / 4, -wid / 5), yoff, {
          fli: false,
          sca: 0.42,
        });
        canv += Man.man(xoff + normRand(wid / 5, wid / 4), yoff, {
          fli: true,
          sca: 0.42,
        });
      }
      canv += rail(xoff, yoff, seed, {
        tra: false,
        fro: true,
        hei: 10,
        wid: wid,
        per: per * 2,
        seg: (3 + Math.random() * 3) | 0,
      });

      return canv;
    };

    this.arch02 = function(xoff, yoff, seed, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 10;
      var wid = args.wid != undefined ? args.wid : 50;
      var rot = args.rot != undefined ? args.rot : 0.3;
      var per = args.per != undefined ? args.per : 5;
      var sto = args.sto != undefined ? args.sto : 3;
      var sty = args.sty != undefined ? args.sty : 1;
      var rai = args.rai != undefined ? args.rai : false;

      seed = seed != undefined ? seed : 0;
      var canv = "";

      var hoff = 0;
      for (var i = 0; i < sto; i++) {
        canv += box(xoff, yoff - hoff, {
          tra: false,
          hei: hei,
          wid: wid * Math.pow(0.85, i),
          rot: rot,
          wei: 1.5,
          per: per,
          dec: function(a) {
            return deco(
              sty,
              Object.assign({}, a, {
                hsp: [[], [1, 5], [1, 5], [1, 4]][sty],
                vsp: [[], [1, 2], [1, 2], [1, 3]][sty],
              }),
            );
          },
        });
        canv += rai
          ? rail(xoff, yoff - hoff, i * 0.2, {
              wid: wid * Math.pow(0.85, i) * 1.1,
              hei: hei / 2,
              per: per,
              rot: rot,
              wei: 0.5,
              tra: false,
            })
          : [];
        var pla = undefined;
        if (sto == 1 && Math.random() < 1 / 3) {
          pla = [1, "Pizza Hut"];
        }
        canv += roof(xoff, yoff - hoff - hei, {
          hei: hei,
          wid: wid * Math.pow(0.9, i),
          rot: rot,
          wei: 1.5,
          per: per,
          pla: pla,
        });

        hoff += hei * 1.5;
      }
      return canv;
    };
    this.arch03 = function(xoff, yoff, seed, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 10;
      var wid = args.wid != undefined ? args.wid : 50;
      var rot = args.rot != undefined ? args.rot : 0.7;
      var per = args.per != undefined ? args.per : 5;
      var sto = args.sto != undefined ? args.sto : 7;

      seed = seed != undefined ? seed : 0;
      var canv = "";

      var hoff = 0;
      for (var i = 0; i < sto; i++) {
        canv += box(xoff, yoff - hoff, {
          tra: false,
          hei: hei,
          wid: wid * Math.pow(0.85, i),
          rot: rot,
          wei: 1.5,
          per: per / 2,
          dec: function(a) {
            return deco(1, Object.assign({}, a, { hsp: [1, 4], vsp: [1, 2] }));
          },
        });
        canv += rail(xoff, yoff - hoff, i * 0.2, {
          seg: 5,
          wid: wid * Math.pow(0.85, i) * 1.1,
          hei: hei / 2,
          per: per / 2,
          rot: rot,
          wei: 0.5,
          tra: false,
        });
        canv += pagroof(xoff, yoff - hoff - hei, {
          hei: hei * 1.5,
          wid: wid * Math.pow(0.9, i),
          rot: rot,
          wei: 1.5,
          per: per,
        });
        hoff += hei * 1.5;
      }
      return canv;
    };
    this.arch04 = function(xoff, yoff, seed, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 15;
      var wid = args.wid != undefined ? args.wid : 30;
      var rot = args.rot != undefined ? args.rot : 0.7;
      var per = args.per != undefined ? args.per : 5;
      var sto = args.sto != undefined ? args.sto : 2;

      seed = seed != undefined ? seed : 0;
      var canv = "";

      var hoff = 0;
      for (var i = 0; i < sto; i++) {
        canv += box(xoff, yoff - hoff, {
          tra: true,
          hei: hei,
          wid: wid * Math.pow(0.85, i),
          rot: rot,
          wei: 1.5,
          per: per / 2,
          dec: function(a) {
            return [];
          },
        });
        canv += rail(xoff, yoff - hoff, i * 0.2, {
          seg: 3,
          wid: wid * Math.pow(0.85, i) * 1.2,
          hei: hei / 3,
          per: per / 2,
          rot: rot,
          wei: 0.5,
          tra: true,
        });
        canv += pagroof(xoff, yoff - hoff - hei, {
          hei: hei * 1,
          wid: wid * Math.pow(0.9, i),
          rot: rot,
          wei: 1.5,
          per: per,
        });
        hoff += hei * 1.2;
      }
      return canv;
    };

    this.boat01 = function(xoff, yoff, seed, args) {
      var args = args != undefined ? args : {};
      var len = args.len != undefined ? args.len : 120;
      var sca = args.sca != undefined ? args.sca : 1;
      var fli = args.fli != undefined ? args.fli : false;
      var canv = "";

      var dir = fli ? -1 : 1;
      canv += Man.man(xoff + 20 * sca * dir, yoff, {
        ite: Man.stick01,
        hat: Man.hat02,
        sca: 0.5 * sca,
        fli: !fli,
        len: [0, 30, 20, 30, 10, 30, 30, 30, 30],
      });

      var plist1 = [];
      var plist2 = [];
      var fun1 = function(x) {
        return Math.pow(Math.sin(x * Math.PI), 0.5) * 7 * sca;
      };
      var fun2 = function(x) {
        return Math.pow(Math.sin(x * Math.PI), 0.5) * 10 * sca;
      };
      for (var i = 0; i < len * sca; i += 5 * sca) {
        plist1.push([i * dir, fun1(i / len)]);
        plist2.push([i * dir, fun2(i / len)]);
      }
      var plist = plist1.concat(plist2.reverse());
      canv += poly(plist, { xof: xoff, yof: yoff, fil: "white" });
      canv += stroke(plist.map(v => [xoff + v[0], yoff + v[1]]), {
        wid: 1,
        fun: function(x) {
          return Math.sin(x * Math.PI * 2);
        },
        col: "rgba(100,100,100,0.4)",
      });

      return canv;
    };

    this.transmissionTower01 = function(xoff, yoff, seed, args) {
      var args = args != undefined ? args : {};
      var hei = args.hei != undefined ? args.hei : 100;
      var wid = args.wid != undefined ? args.wid : 20;

      var canv = "";
      var toGlobal = function(v) {
        return [v[0] + xoff, v[1] + yoff];
      };

      var quickstroke = function(pl) {
        return stroke(div(pl, 5).map(toGlobal), {
          wid: 1,
          fun: x => 0.5,
          col: "rgba(100,100,100,0.4)",
        });
      };

      var p00 = [-wid * 0.05, -hei];
      var p01 = [wid * 0.05, -hei];

      var p10 = [-wid * 0.1, -hei * 0.9];
      var p11 = [wid * 0.1, -hei * 0.9];

      var p20 = [-wid * 0.2, -hei * 0.5];
      var p21 = [wid * 0.2, -hei * 0.5];

      var p30 = [-wid * 0.5, 0];
      var p31 = [wid * 0.5, 0];

      var bch = [[0.7, -0.85], [1, -0.675], [0.7, -0.5]];

      for (var i = 0; i < bch.length; i++) {
        canv += quickstroke([
          [-bch[i][0] * wid, bch[i][1] * hei],
          [bch[i][0] * wid, bch[i][1] * hei],
        ]);
        canv += quickstroke([
          [-bch[i][0] * wid, bch[i][1] * hei],
          [0, (bch[i][1] - 0.05) * hei],
        ]);
        canv += quickstroke([
          [bch[i][0] * wid, bch[i][1] * hei],
          [0, (bch[i][1] - 0.05) * hei],
        ]);

        canv += quickstroke([
          [-bch[i][0] * wid, bch[i][1] * hei],
          [-bch[i][0] * wid, (bch[i][1] + 0.1) * hei],
        ]);
        canv += quickstroke([
          [bch[i][0] * wid, bch[i][1] * hei],
          [bch[i][0] * wid, (bch[i][1] + 0.1) * hei],
        ]);
      }

      var l10 = div([p00, p10, p20, p30], 5);
      var l11 = div([p01, p11, p21, p31], 5);

      for (var i = 0; i < l10.length - 1; i++) {
        canv += quickstroke([l10[i], l11[i + 1]]);
        canv += quickstroke([l11[i], l10[i + 1]]);
      }

      canv += quickstroke([p00, p01]);
      canv += quickstroke([p10, p11]);
      canv += quickstroke([p20, p21]);
      canv += quickstroke([p00, p10, p20, p30]);
      canv += quickstroke([p01, p11, p21, p31]);

      return canv;
    };
  }();

  

var Man = new function() {
    var expand = function(ptlist, wfun) {
      vtxlist0 = [];
      vtxlist1 = [];
      vtxlist = [];
      var n0 = Math.random() * 10;
      for (var i = 1; i < ptlist.length - 1; i++) {
        var w = wfun(i / ptlist.length);
        var a1 = Math.atan2(
          ptlist[i][1] - ptlist[i - 1][1],
          ptlist[i][0] - ptlist[i - 1][0],
        );
        var a2 = Math.atan2(
          ptlist[i][1] - ptlist[i + 1][1],
          ptlist[i][0] - ptlist[i + 1][0],
        );
        var a = (a1 + a2) / 2;
        if (a < a2) {
          a += Math.PI;
        }
        vtxlist0.push([
          ptlist[i][0] + w * Math.cos(a),
          ptlist[i][1] + w * Math.sin(a),
        ]);
        vtxlist1.push([
          ptlist[i][0] - w * Math.cos(a),
          ptlist[i][1] - w * Math.sin(a),
        ]);
      }
      var l = ptlist.length - 1;
      var a0 =
        Math.atan2(ptlist[1][1] - ptlist[0][1], ptlist[1][0] - ptlist[0][0]) -
        Math.PI / 2;
      var a1 =
        Math.atan2(
          ptlist[l][1] - ptlist[l - 1][1],
          ptlist[l][0] - ptlist[l - 1][0],
        ) -
        Math.PI / 2;
      var w0 = wfun(0);
      var w1 = wfun(1);
      vtxlist0.unshift([
        ptlist[0][0] + w0 * Math.cos(a0),
        ptlist[0][1] + w0 * Math.sin(a0),
      ]);
      vtxlist1.unshift([
        ptlist[0][0] - w0 * Math.cos(a0),
        ptlist[0][1] - w0 * Math.sin(a0),
      ]);
      vtxlist0.push([
        ptlist[l][0] + w1 * Math.cos(a1),
        ptlist[l][1] + w1 * Math.sin(a1),
      ]);
      vtxlist1.push([
        ptlist[l][0] - w1 * Math.cos(a1),
        ptlist[l][1] - w1 * Math.sin(a1),
      ]);
      return [vtxlist0, vtxlist1];
    };

    var tranpoly = function(p0, p1, ptlist) {
      var plist = ptlist.map(function(v) {
        return [-v[0], v[1]];
      });
      var ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) - Math.PI / 2;
      var scl = distance(p0, p1);
      var qlist = plist.map(function(v) {
        var d = distance(v, [0, 0]);
        var a = Math.atan2(v[1], v[0]);
        return [
          p0[0] + d * scl * Math.cos(ang + a),
          p0[1] + d * scl * Math.sin(ang + a),
        ];
      });
      return qlist;
    };
    var flipper = function(plist) {
      return plist.map(function(v) {
        return [-v[0], v[1]];
      });
    };

    this.hat01 = function(p0, p1, args) {
      var args = args != undefined ? args : {};
      var fli = args.fli != undefined ? args.fli : false;

      var canv = "";
      var seed = Math.random();
      var f = fli
        ? flipper
        : function(x) {
            return x;
          };
      //var plist = [[-0.5,0.5],[0.5,0.5],[0.5,1],[-0.5,2]]
      canv += poly(
        tranpoly(
          p0,
          p1,
          f([
            [-0.3, 0.5],
            [0.3, 0.8],
            [0.2, 1],
            [0, 1.1],
            [-0.3, 1.15],
            [-0.55, 1],
            [-0.65, 0.5],
          ]),
        ),
        { fil: "rgba(100,100,100,0.8)" },
      );

      var qlist1 = [];
      for (var i = 0; i < 10; i++) {
        qlist1.push([
          -0.3 - Noise.noise(i * 0.2, seed) * i * 0.1,
          0.5 - i * 0.3,
        ]);
      }
      canv += poly(tranpoly(p0, p1, f(qlist1)), {
        str: "rgba(100,100,100,0.8)",
        wid: 1,
      });

      return canv;
    };

    this.hat02 = function(p0, p1, args) {
      var args = args != undefined ? args : {};
      var fli = args.fli != undefined ? args.fli : false;

      var canv = "";
      var seed = Math.random();

      var f = fli
        ? flipper
        : function(x) {
            return x;
          };
      // canv += poly(tranpoly(p0,p1,[
      //   [-0.3,0.6],[-0.15,1.0],[0,1.1],[0.15,1.0],[0.3,0.6]
      //   ]),{fil:"white",str:"rgba(130,130,130,0.8)",wid:1})
      canv += poly(
        tranpoly(
          p0,
          p1,
          f([
            [-0.3, 0.5],
            [-1.1, 0.5],
            [-1.2, 0.6],
            [-1.1, 0.7],
            [-0.3, 0.8],
            [0.3, 0.8],
            [1.0, 0.7],
            [1.3, 0.6],
            [1.2, 0.5],
            [0.3, 0.5],
          ]),
        ),
        { fil: "rgba(100,100,100,0.8)" },
      );
      return canv;
    };

    this.stick01 = function(p0, p1, args) {
      var args = args != undefined ? args : {};
      var fli = args.fli != undefined ? args.fli : false;

      var canv = "";
      var seed = Math.random();
      var f = fli
        ? flipper
        : function(x) {
            return x;
          };

      var qlist1 = [];
      var l = 12;
      for (var i = 0; i < l; i++) {
        qlist1.push([
          -Noise.noise(i * 0.1, seed) * 0.1 * Math.sin((i / l) * Math.PI) * 5,
          0 + i * 0.3,
        ]);
      }
      canv += poly(tranpoly(p0, p1, f(qlist1)), {
        str: "rgba(100,100,100,0.5)",
        wid: 1,
      });

      return canv;
    };

    //      2
    //    1/
    // 7/  | \_ 6
    // 8| 0 \ 5
    //      /3
    //     4

    this.man = function(xoff, yoff, args) {
      var args = args != undefined ? args : {};
      var sca = args.sca != undefined ? args.sca : 0.5;
      var hat = args.hat != undefined ? args.hat : Man.hat01;
      var ite =
        args.ite != undefined
          ? args.ite
          : function() {
              return "";
            };
      var fli = args.fli != undefined ? args.fli : true;
      var ang =
        args.ang != undefined
          ? args.ang
          : [
              0,
              -Math.PI / 2,
              normRand(0, 0),
              (Math.PI / 4) * Math.random(),
              ((Math.PI * 3) / 4) * Math.random(),
              (Math.PI * 3) / 4,
              -Math.PI / 4,
              (-Math.PI * 3) / 4 - (Math.PI / 4) * Math.random(),
              -Math.PI / 4,
            ];
      var len =
        args.len != undefined ? args.len : [0, 30, 20, 30, 30, 30, 30, 30, 30];

      len = len.map(function(v) {
        return v * sca;
      });
      var canv = "";
      var sct = {
        0: { 1: { 2: {}, 5: { 6: {} }, 7: { 8: {} } }, 3: { 4: {} } },
      };
      var toGlobal = function(v) {
        return [(fli ? -1 : 1) * v[0] + xoff, v[1] + yoff];
      };

      function gpar(sct, ind) {
        var keys = Object.keys(sct);
        for (var i = 0; i < keys.length; i++) {
          if (keys[i] == ind) {
            return [ind];
          } else {
            var r = gpar(sct[keys[i]], ind);
            if (r != false) {
              return [parseFloat(keys[i])].concat(r);
            }
          }
        }
        return false;
      }
      function grot(sct, ind) {
        var par = gpar(sct, ind);
        var rot = 0;
        for (var i = 0; i < par.length; i++) {
          rot += ang[par[i]];
        }
        return rot;
      }
      function gpos(sct, ind) {
        var par = gpar(sct, ind);
        var pos = [0, 0];
        for (var i = 0; i < par.length; i++) {
          var a = grot(sct, par[i]);
          pos[0] += len[par[i]] * Math.cos(a);
          pos[1] += len[par[i]] * Math.sin(a);
        }
        return pos;
      }

      var pts = [];
      for (var i = 0; i < ang.length; i++) {
        pts.push(gpos(sct, i));
      }
      yoff -= pts[4][1];

      for (var i = 1; i < pts.length; i++) {
        var par = gpar(sct, i);
        var p0 = gpos(sct, par[par.length - 2]);
        var s = div([p0, pts[i]], 10);
        //canv += stroke(s.map(toGlobal))
      }

      var cloth = function(plist, fun) {
        var canv = "";
        var tlist = bezmh(plist, 2);
        var [tlist1, tlist2] = expand(tlist, fun);
        canv += poly(tlist1.concat(tlist2.reverse()).map(toGlobal), {
          fil: "white",
        });
        canv += stroke(tlist1.map(toGlobal), {
          wid: 1,
          col: "rgba(100,100,100,0.5)",
        });
        canv += stroke(tlist2.map(toGlobal), {
          wid: 1,
          col: "rgba(100,100,100,0.6)",
        });

        return canv;
      };

      var fsleeve = function(x) {
        return (
          sca *
          8 *
          (Math.sin(0.5 * x * Math.PI) * Math.pow(Math.sin(x * Math.PI), 0.1) +
            (1 - x) * 0.4)
        );
      };
      var fbody = function(x) {
        return (
          sca *
          11 *
          (Math.sin(0.5 * x * Math.PI) * Math.pow(Math.sin(x * Math.PI), 0.1) +
            (1 - x) * 0.5)
        );
      };
      var fhead = function(x) {
        return sca * 7 * Math.pow(0.25 - Math.pow(x - 0.5, 2), 0.3);
      };

      canv += ite(toGlobal(pts[8]), toGlobal(pts[6]), { fli: fli });

      canv += cloth([pts[1], pts[7], pts[8]], fsleeve);
      canv += cloth([pts[1], pts[0], pts[3], pts[4]], fbody);
      canv += cloth([pts[1], pts[5], pts[6]], fsleeve);
      canv += cloth([pts[1], pts[2]], fhead);

      var hlist = bezmh([pts[1], pts[2]], 2);
      var [hlist1, hlist2] = expand(hlist, fhead);
      hlist1.splice(0, Math.floor(hlist1.length * 0.1));
      hlist2.splice(0, Math.floor(hlist2.length * 0.95));
      canv += poly(hlist1.concat(hlist2.reverse()).map(toGlobal), {
        fil: "rgba(100,100,100,0.6)",
      });

      canv += hat(toGlobal(pts[1]), toGlobal(pts[2]), { fli: fli });

      return canv;
    };
  }();

  

function water(xoff, yoff, seed, args) {
    var args = args != undefined ? args : {};
    var hei = args.hei != undefined ? args.hei : 2;
    var len = args.len != undefined ? args.len : 800;
    var clu = args.clu != undefined ? args.clu : 10;
    var canv = "";

    var ptlist = [];
    var yk = 0;
    for (var i = 0; i < clu; i++) {
      ptlist.push([]);
      var xk = (Math.random() - 0.5) * (len / 8);
      yk += Math.random() * 5;
      var lk = len / 4 + Math.random() * (len / 4);
      var reso = 5;
      for (var j = -lk; j < lk; j += reso) {
        ptlist[ptlist.length - 1].push([
          j + xk,
          Math.sin(j * 0.2) * hei * Noise.noise(j * 0.1) - 20 + yk,
        ]);
      }
    }

    for (var j = 1; j < ptlist.length; j += 1) {
      canv += stroke(
        ptlist[j].map(function(x) {
          return [x[0] + xoff, x[1] + yoff];
        }),
        {
          col:
            "rgba(100,100,100," + (0.3 + Math.random() * 0.3).toFixed(3) + ")",
          wid: 1,
        },
      );
    }

    return canv;
  }

  


      // Procedural Mount Planner & Chunk Generator adapted for bounded canvas & aspect ratios
      function generateLandscapeScene(vWidth, vHeight, seed) {
        var origRandom = Math.random;
        Math.random = function() {
          return Prng.next();
        };
        try {
        var samp = 0.03;
        var ns = function(x, y) {
          return Math.max(Noise.noise(x * samp) - 0.55, 0) * 2;
        };
        var yr = function(x) {
          return Noise.noise(x * 0.01, Math.PI);
        };

        var reg = [];
        function locmax(x, y, f, r) {
          var z0 = f(x, y);
          if (z0 <= 0.3) return false;
          for (var i = x - r; i < x + r; i++) {
            for (var j = y - r; j < y + r; j++) {
              if (f(i, j) > z0) return false;
            }
          }
          return true;
        }

        function chadd(r, mind) {
          mind = mind == undefined ? 15 : mind;
          for (var k = 0; k < reg.length; k++) {
            if (Math.abs(reg[k].x - r.x) < mind) return false;
          }
          reg.push(r);
          return true;
        }

        var xstep = 8;
        var planmtx = [];
        for (var i = -100; i < vWidth + 100; i += xstep) {
          var i1 = Math.floor(i / xstep);
          planmtx[i1] = 0;
        }

        // Vertical scaling factor relative to 800px base
        var yFactor = vHeight / 800;

        // Distant mountain layers in the sky
        var distStep = Math.max(380, Math.floor(vWidth / 3));
        for (var i = -100; i < vWidth + 200; i += distStep) {
          chadd({
            tag: "distmount",
            x: i + (Math.random() - 0.5) * 100,
            y: (220 - Math.random() * 60) * yFactor,
            h: 120 * yFactor,
            len: Math.max(vWidth * 0.7, 700)
          }, 150);
        }

        // Cranes in flight
        var craneX = vWidth * (0.2 + Math.random() * 0.6);
        var craneY = (140 + Math.random() * 120) * yFactor;
        var craneCount = 4 + Math.floor(Math.random() * 5);

        // Main mountain peaks
        var mwid = 180;
        for (var i = -50; i < vWidth + 50; i += xstep) {
          for (var j = 0; j < yr(i) * 440; j += 32) {
            if (locmax(i, j, ns, 2)) {
              var xof = i + 2 * (Math.random() - 0.5) * 350;
              var yof = (j + 280) * yFactor;
              var r = {
                tag: "mount",
                x: xof,
                y: yof,
                h: ns(i, j) * 350 * yFactor
              };
              if (chadd(r, 60)) {
                for (var k = Math.floor((xof - mwid) / xstep); k < (xof + mwid) / xstep; k++) {
                  planmtx[k] = (planmtx[k] || 0) + 1;
                }
              }
            }
          }
        }

        // Riverbanks and flat foothills in the lower areas
        for (var i = -50; i < vWidth + 50; i += xstep) {
          var idx = Math.floor(i / xstep);
          if (!planmtx[idx] || planmtx[idx] === 0) {
            if (Math.random() < 0.035) {
              for (var j = 0; j < 3 * Math.random(); j++) {
                chadd({
                  tag: "flatmount",
                  x: i + 2 * (Math.random() - 0.5) * 500,
                  y: (660 - j * 45) * yFactor,
                  h: 80 * yFactor
                }, 100);
              }
            }
          }
        }

        // Solitary boats in the river
        for (var i = 50; i < vWidth - 50; i += xstep) {
          if (Math.random() < 0.08) {
            chadd({
              tag: "boat",
              x: i,
              y: (350 + Math.random() * 360) * yFactor
            }, 300);
          }
        }

        // Assemble chunks with depth sorting
        var chunks = [];
        function addChunk(nch) {
          if (nch.canv.indexOf("NaN") !== -1) {
            nch.canv = nch.canv.replace(/NaN/g, "-1000");
          }
          if (chunks.length === 0) {
            chunks.push(nch);
            return;
          }
          if (nch.y <= chunks[0].y) {
            chunks.unshift(nch);
            return;
          }
          if (nch.y >= chunks[chunks.length - 1].y) {
            chunks.push(nch);
            return;
          }
          for (var j = 0; j < chunks.length - 1; j++) {
            if (chunks[j].y <= nch.y && nch.y <= chunks[j + 1].y) {
              chunks.splice(j + 1, 0, nch);
              return;
            }
          }
        }

        for (var i = 0; i < reg.length; i++) {
          var p = reg[i];
          if (p.tag === "mount") {
            addChunk({
              tag: "mount",
              x: p.x,
              y: p.y,
              canv: Mount.mountain(p.x, p.y, i * 2.5 * Math.random(), {
                hei: 140 * yFactor + Math.random() * 320 * yFactor,
                wid: 360 + Math.random() * 180,
                tex: 180
              })
            });
            addChunk({
              tag: "water",
              x: p.x,
              y: p.y - 10000,
              canv: water(p.x, p.y, i * 2, {
                len: 700 + Math.random() * 300,
                clu: 8
              })
            });
          } else if (p.tag === "flatmount") {
            addChunk({
              tag: "flatmount",
              x: p.x,
              y: p.y,
              canv: Mount.flatMount(p.x, p.y, 2 * Math.random() * Math.PI, {
                wid: 500 + Math.random() * 350,
                hei: 80 * yFactor,
                cho: 0.5 + Math.random() * 0.2
              })
            });
          } else if (p.tag === "distmount") {
            addChunk({
              tag: "distmount",
              x: p.x,
              y: p.y,
              canv: Mount.distMount(p.x, p.y, Math.random() * 100, {
                hei: 120 * yFactor,
                len: p.len || 1000
              })
            });
          } else if (p.tag === "boat") {
            addChunk({
              tag: "boat",
              x: p.x,
              y: p.y,
              canv: Arch.boat01(p.x, p.y, Math.random(), {
                sca: (p.y / vHeight) * 0.9,
                fli: randChoice([true, false])
              })
            });
          }
        }

        var landscapeSvg = "";
        for (var i = 0; i < chunks.length; i++) {
          landscapeSvg += chunks[i].canv;
        }

        var cranesSvg = generateCraneFlock(craneX, craneY, craneCount, seed);
        landscapeSvg = cranesSvg + landscapeSvg;

        return {
          svgElements: landscapeSvg,
          chunkCount: chunks.length,
          vWidth: vWidth,
          vHeight: vHeight
        };
      } finally {
        Math.random = origRandom;
      }
    }

    return {
      generateLandscapeScene: generateLandscapeScene
    };
  }

  // ============================================================================
  // Public Synthesis Pipeline & Archival Plate Generators
  // ============================================================================

  const LandscapeDraw = {
    PIGMENTS: PIGMENTS,
    TITLES_LATIN: TITLES_LATIN,

    fnv1a: fnv1a,
    seedToId: seedToId,
    idToSeed: idToSeed,

    deriveTaxon: function(hash, pigmentKey) {
      return deriveLandscapeMetrics(hash, 1000, 1000, pigmentKey);
    },

    synthesize: function(seedInput, options) {
      options = options || {};
      var seed = 0;
      var inputNarrative = "";

      if (typeof seedInput === "number") {
        seed = seedInput >>> 0;
        inputNarrative = "Seed #" + seed;
      } else if (typeof seedInput === "string" && seedInput.trim().length > 0) {
        var str = seedInput.trim();
        if (/^LSV-[0-9A-Fa-f]{2}-[0-9A-Fa-f]{6}$/i.test(str)) {
          seed = idToSeed(str);
          inputNarrative = str;
        } else {
          seed = fnv1a(str);
          inputNarrative = str;
        }
      } else {
        seed = Math.floor(Math.random() * 0xFFFFFFFF) >>> 0;
        inputNarrative = "Procedural Landscape Specimen #" + seed;
      }

      var width = options.width || 1200;
      var height = options.height || 800;
      var ratio = width / height;

      var baseDim = 1000;
      var vWidth, vHeight;
      if (width >= height) {
        vWidth = Math.round(baseDim * ratio);
        vHeight = baseDim;
      } else {
        vWidth = baseDim;
        vHeight = Math.round(baseDim / ratio);
      }

      var pigmentKey = options.pigment || "pine-soot";
      var pigment = PIGMENTS[pigmentKey] || PIGMENTS["pine-soot"];

      var engine = createEngineInstance(seed);
      var scene = engine.generateLandscapeScene(vWidth, vHeight, seed);

      var coloredSvg = scene.svgElements;
      if (pigment.id !== "pine-soot") {
        coloredSvg = coloredSvg.replace(/rgba\(100,100,100,/g, "rgba(" + pigment.inkRgb + ",");
        coloredSvg = coloredSvg.replace(/rgba\(200,200,200,/g, "rgba(" + pigment.washRgb + ",");
      } else {
        coloredSvg = coloredSvg.replace(/rgba\(100,100,100,/g, "rgba(40,36,32,");
        coloredSvg = coloredSvg.replace(/rgba\(200,200,200,/g, "rgba(75,70,64,");
      }

      var metrics = deriveLandscapeMetrics(seed, width, height, pigmentKey);

      return {
        id: metrics.accessionId,
        seed: seed,
        narrative: inputNarrative,
        width: width,
        height: height,
        vWidth: vWidth,
        vHeight: vHeight,
        pigment: pigment,
        metrics: metrics,
        svgContent: coloredSvg,
        chunkCount: scene.chunkCount
      };
    },

    generateSvgPlate: function(data, options) {
      options = options || {};
      var width = (data && data.vWidth) ? data.vWidth : (options.width || 1200);
      var height = (data && data.vHeight) ? data.vHeight : (options.height || 800);
      var pigment = (data && data.pigment) || PIGMENTS[options.pigment || "pine-soot"] || PIGMENTS["pine-soot"];
      var m = (data && data.metrics) || deriveLandscapeMetrics(data ? data.seed : 12345, width, height, pigment.id);
      var svgContent = (data && data.svgContent) || "";

      var minDim = Math.min(width, height);
      var margin = options.margin || Math.round(minDim * 0.024);
      var borderGap = Math.max(3, Math.round(minDim * 0.007));
      var outerLineWidth = Math.max(1.0, (minDim / 600) * 1.0);
      var innerLineWidth = Math.max(0.5, (minDim / 600) * 0.5);

      var metaColor = pigment.meta;
      var strokeColor = pigment.stroke;
      var titleText = m.title || "Montes Nebulosi et Flumina";

      var cursiveScale = Math.max(0.28, (minDim / 600) * 0.36);
      var cursiveY = height - margin - Math.max(12, Math.round(minDim * 0.025));
      var res = put_text(titleText);
      var textW = res[0];
      var cursiveX = Math.round((width - textW * cursiveScale) / 2);
      var hersheySvgPaths = titleText ? hersheyToSvgPaths(titleText, cursiveX, cursiveY, cursiveScale) : "";

      var scaleBarX = margin + borderGap + Math.round(minDim * 0.02);
      var scaleBarY = height - margin - borderGap - Math.round(minDim * 0.022);
      var scaleFactor = minDim / 600;
      var barW = Math.round(72 * scaleFactor);
      var barH = Math.max(3, Math.round(3.5 * scaleFactor));
      var segW = barW / 4;
      var tickH = Math.max(2, Math.round(3 * scaleFactor));
      var scaleFontSize = Math.max(7, Math.round(8.5 * scaleFactor));
      var captionFontSize = Math.max(6, Math.round(6.8 * scaleFactor));

      var sealSize = Math.max(28, Math.round(minDim * 0.064));
      var sealX = width - margin - borderGap - sealSize - Math.round(minDim * 0.02);
      var sealY = height - margin - borderGap - sealSize - Math.round(minDim * 0.022);
      var sealInset = Math.max(1.5, sealSize * 0.06);
      var sealFontSize = Math.round(sealSize * 0.36);

      var lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + width + ' ' + height + '" width="' + width + '" height="' + height + '">',
        '  <!-- Archival Xuan Paper Base Plate -->',
        '  <rect width="100%" height="100%" fill="' + pigment.paper + '" />',
        '',
        '  <!-- Procedural Chinese Landscape (Shan Shui) Group with Multiply Blending -->',
        '  <g id="landscape-elements" style="mix-blend-mode: multiply;">',
        '    ' + svgContent,
        '  </g>',
        '',
        '  <!-- Archival Drafting Borders (Swiss-Archival Standard) -->',
        '  <rect x="' + margin + '" y="' + margin + '" width="' + (width - margin * 2) + '" height="' + (height - margin * 2) + '" fill="none" stroke="' + strokeColor + '" stroke-width="' + outerLineWidth.toFixed(2) + '" />',
        '  <rect x="' + (margin + borderGap) + '" y="' + (margin + borderGap) + '" width="' + (width - (margin + borderGap) * 2) + '" height="' + (height - (margin + borderGap) * 2) + '" fill="none" stroke="' + metaColor + '" stroke-width="' + innerLineWidth.toFixed(2) + '" />',
        '',
        '  <!-- Topographical Survey Scale Bar (10 Li / 5 Km Rule) -->',
        '  <g class="drafting-scale-bar" transform="translate(' + scaleBarX + ', ' + scaleBarY + ')">',
        '    <rect x="0" y="0" width="' + segW + '" height="' + barH + '" fill="' + strokeColor + '" />',
        '    <rect x="' + segW + '" y="0" width="' + segW + '" height="' + barH + '" fill="none" stroke="' + strokeColor + '" stroke-width="0.75" />',
        '    <rect x="' + (segW * 2) + '" y="0" width="' + segW + '" height="' + barH + '" fill="' + strokeColor + '" />',
        '    <rect x="' + (segW * 3) + '" y="0" width="' + segW + '" height="' + barH + '" fill="none" stroke="' + strokeColor + '" stroke-width="0.75" />',
        '    <rect x="0" y="0" width="' + barW + '" height="' + barH + '" fill="none" stroke="' + strokeColor + '" stroke-width="0.75" />',
        '    <line x1="0" y1="' + (-tickH) + '" x2="0" y2="0" stroke="' + strokeColor + '" stroke-width="0.75" />',
        '    <line x1="' + (segW * 2) + '" y1="' + (-tickH) + '" x2="' + (segW * 2) + '" y2="0" stroke="' + strokeColor + '" stroke-width="0.75" />',
        '    <line x1="' + barW + '" y1="' + (-tickH) + '" x2="' + barW + '" y2="0" stroke="' + strokeColor + '" stroke-width="0.75" />',
        '    <text x="0" y="' + (-tickH - 2) + '" font-family="JetBrains Mono, monospace" font-size="' + scaleFontSize + '" font-weight="600" fill="' + strokeColor + '" text-anchor="middle">0</text>',
        '    <text x="' + (segW * 2) + '" y="' + (-tickH - 2) + '" font-family="JetBrains Mono, monospace" font-size="' + scaleFontSize + '" font-weight="600" fill="' + strokeColor + '" text-anchor="middle">5</text>',
        '    <text x="' + barW + '" y="' + (-tickH - 2) + '" font-family="JetBrains Mono, monospace" font-size="' + scaleFontSize + '" font-weight="600" fill="' + strokeColor + '" text-anchor="middle">10 Li</text>',
        '    <text x="0" y="' + (barH + captionFontSize + 2) + '" font-family="JetBrains Mono, monospace" font-size="' + captionFontSize + '" font-weight="500" fill="' + metaColor + '">SURVEY SCALE 1:50,000</text>',
        '  </g>',
        '',
        '  <!-- Archival Vermilion Seal Chop (朱砂印章 · 山水典藏) -->',
        '  <g class="archival-seal" transform="translate(' + sealX + ', ' + sealY + ')">',
        '    <rect width="' + sealSize + '" height="' + sealSize + '" fill="#B83227" fill-opacity="0.06" stroke="#B83227" stroke-width="' + Math.max(1.2, sealSize * 0.05).toFixed(2) + '" />',
        '    <rect x="' + sealInset + '" y="' + sealInset + '" width="' + (sealSize - sealInset * 2) + '" height="' + (sealSize - sealInset * 2) + '" fill="none" stroke="#B83227" stroke-width="' + Math.max(0.5, sealSize * 0.02).toFixed(2) + '" />',
        '    <line x1="' + (sealSize / 2) + '" y1="' + sealInset + '" x2="' + (sealSize / 2) + '" y2="' + (sealSize - sealInset) + '" stroke="#B83227" stroke-opacity="0.35" stroke-width="0.5" />',
        '    <line x1="' + sealInset + '" y1="' + (sealSize / 2) + '" x2="' + (sealSize - sealInset) + '" y2="' + (sealSize / 2) + '" stroke="#B83227" stroke-opacity="0.35" stroke-width="0.5" />',
        '    <text x="' + (sealSize * 0.28) + '" y="' + (sealSize * 0.38) + '" font-family="Noto Serif SC, Source Han Serif, Songti SC, SimSun, serif" font-weight="bold" font-size="' + sealFontSize + '" fill="#B83227" text-anchor="middle">山</text>',
        '    <text x="' + (sealSize * 0.72) + '" y="' + (sealSize * 0.38) + '" font-family="Noto Serif SC, Source Han Serif, Songti SC, SimSun, serif" font-weight="bold" font-size="' + sealFontSize + '" fill="#B83227" text-anchor="middle">典</text>',
        '    <text x="' + (sealSize * 0.28) + '" y="' + (sealSize * 0.80) + '" font-family="Noto Serif SC, Source Han Serif, Songti SC, SimSun, serif" font-weight="bold" font-size="' + sealFontSize + '" fill="#B83227" text-anchor="middle">水</text>',
        '    <text x="' + (sealSize * 0.72) + '" y="' + (sealSize * 0.80) + '" font-family="Noto Serif SC, Source Han Serif, Songti SC, SimSun, serif" font-weight="bold" font-size="' + sealFontSize + '" fill="#B83227" text-anchor="middle">藏</text>',
        '  </g>',
        '',
        '  <!-- Engraved Cursive Landscape Latin Title -->',
        '  <g stroke="' + strokeColor + '" stroke-width="' + (outerLineWidth * 1.05).toFixed(2) + '" stroke-linecap="round" stroke-linejoin="round">',
        '    ' + hersheySvgPaths,
        '  </g>',
        '</svg>'
      ];
      return lines.join('\n');
    },

    renderToCanvas: function(data, canvas, options) {
      options = options || {};
      var width = options.width || (canvas && canvas.width) || 1200;
      var height = options.height || (canvas && canvas.height) || 800;
      var ctx = canvas.getContext("2d");
      var fullSvg = this.generateSvgPlate(data, { width: width, height: height });

      return new Promise(function(resolve, reject) {
        var img = new Image();
        var blob = new Blob([fullSvg], { type: "image/svg+xml;charset=utf-8" });
        var url = URL.createObjectURL(blob);
        img.onload = function() {
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);
          resolve(canvas);
        };
        img.onerror = function(err) {
          URL.revokeObjectURL(url);
          reject(err);
        };
        img.src = url;
      });
    }
  };

  return LandscapeDraw;
}));
