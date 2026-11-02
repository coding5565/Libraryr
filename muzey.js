import * as THREE from './vendor/three.module.min.js';
import { SOZLAMALAR } from './sozlamalar.js';

// ---------- O‘lchamlar (metrda) ----------
const XONA = { en: 26, chuqur: 13, baland: 4.6 };
const KOZ = 1.6;              // ko‘z balandligi
const TEZLIK = 3.2;           // yurish tezligi, m/s
const ROM_MAX = { w: 1.6, h: 1.75 };
const PASPARTU = 0.07;
const ROM_QALIN = 0.06;
const ROM_Y = 1.65;           // romlar markazining balandligi
const RASM_SONI = 20;
const BOSH_POS = new THREE.Vector3(-XONA.en / 2 + 2.4, KOZ, 0);
const BOSH_YAW = -Math.PI / 2; // to‘rdagi (sharq) devorga qarab
const TOUCH = matchMedia('(pointer: coarse)').matches;
const TEXTURA_MAX = TOUCH ? 1024 : 1600;
const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const ikki = (n) => String(n).padStart(2, '0');
const silliq = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const rasmlar = Array.from({ length: RASM_SONI }, (_, i) => SOZLAMALAR.rasmlar[i] ?? {});

// ---------- Matnlar ----------
if (TOUCH) document.body.classList.add('touch');
document.title = SOZLAMALAR.muzeyNomi;
$('#chipta-nom').textContent = SOZLAMALAR.muzeyNomi;
$('#chipta-matn').textContent = SOZLAMALAR.kirishMatni;
$('#chipta-ism').textContent = SOZLAMALAR.ism;
const bugun = new Date();
$('#chipta-sana').textContent = `${bugun.getDate()}-${OYLAR[bugun.getMonth()]}`;
$('#belgi-matn').textContent = SOZLAMALAR.muzeyNomi;
$('#yakun-sarlavha').textContent = `Bu kutubxona senga bag‘ishlandi, ${SOZLAMALAR.ism}`;
$('#yakun-matn').textContent = SOZLAMALAR.yakunMatni;
$('#yakun-imzo').textContent = SOZLAMALAR.imzo ? `— ${SOZLAMALAR.imzo}` : '';
$('#yakun-imzo').hidden = !SOZLAMALAR.imzo;
$('#maslahat').innerHTML = (TOUCH
  ? '<b>Chapdagi doira</b> — yurish · <b>ekranni suring</b> — atrofga qarash<br><b>Rasmga teging</b> — yaqindan ko‘rish'
  : '<b>W A S D</b> — yurish · <b>sichqonchani torting</b> — atrofga qarash<br><b>Rasmga bosing</b> — yaqindan ko‘rish')
  + ' · yoki <b>Sayohat</b>ni bosing';

// ---------- Renderer ----------
const canvas = $('#sahna');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch {
  $('#chipta-matn').textContent = 'Bu brauzer 3D ko‘rinishni ochmadi. Telefonda Chrome yoki Safari’dan oching.';
  $('#kirish-tugma').disabled = true;
  throw new Error('WebGL ishlamadi');
}
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
const ANIZOTROPIYA = Math.min(8, renderer.capabilities.getMaxAnisotropy());

const scene = new THREE.Scene();
scene.background = new THREE.Color('#1f1224');
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 80);
camera.rotation.order = 'YXZ';
function fovniMoslash() {
  camera.aspect = innerWidth / innerHeight;
  camera.fov = camera.aspect < 1 ? 74 : 62;
  camera.updateProjectionMatrix();
}
fovniMoslash();

// Kanvasdagi yozuvlar shriftlar yuklangach chiziladi
await Promise.race([
  Promise.all([
    document.fonts.load('italic 600 64px "Cormorant Garamond"'),
    document.fonts.load('700 32px Manrope'),
    document.fonts.load('600 32px Manrope'),
  ]),
  new Promise((ok) => setTimeout(ok, 2500)),
]).catch(() => {});

// ---------- Teksturalar ----------
function kanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function texturaQil(c, takror = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANIZOTROPIYA;
  if (takror) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function polTexturasi() {
  const [c, g] = kanvas(1024, 1024);
  const qatorlar = 8, h = 1024 / qatorlar;
  for (let q = 0; q < qatorlar; q++) {
    const y = q * h;
    let x = Math.random() * 1024, jami = 0;
    while (jami < 1024) {
      const uz = Math.min(280 + Math.random() * 380, 1024 - jami);
      const rang = `hsl(${24 + Math.random() * 8}, ${40 + Math.random() * 12}%, ${33 + Math.random() * 11}%)`;
      const tolalar = Array.from({ length: 12 }, () => ({
        y: y + 4 + Math.random() * (h - 8),
        a: 0.04 + Math.random() * 0.08,
        w: 0.8 + Math.random() * 1.6,
        e: (Math.random() - 0.5) * 10,
      }));
      // Chetdan oshgan taxta boshqa chetda davom etadi — tekstura choksiz takrorlanadi
      for (const siljish of [0, -1024]) {
        const x0 = x + siljish;
        g.fillStyle = rang;
        g.fillRect(x0, y, uz, h);
        for (const t of tolalar) {
          g.strokeStyle = `rgba(55,30,18,${t.a})`;
          g.lineWidth = t.w;
          g.beginPath();
          g.moveTo(x0, t.y);
          g.bezierCurveTo(x0 + uz * 0.33, t.y + t.e, x0 + uz * 0.66, t.y - t.e, x0 + uz, t.y);
          g.stroke();
        }
        g.fillStyle = 'rgba(28,16,10,0.55)';
        g.fillRect(x0, y, 2, h);
      }
      x += uz;
      jami += uz;
      if (x >= 1024) x -= 1024;
    }
    g.fillStyle = 'rgba(28,16,10,0.6)';
    g.fillRect(0, y, 1024, 2);
  }
  const t = texturaQil(c, true);
  t.repeat.set(XONA.en / 1.6, XONA.chuqur / 1.6);
  return t;
}

function devorTexturasi() {
  const [c, g] = kanvas(512, 512);
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * 512, y = Math.random() * 512, r = 30 + Math.random() * 90;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(120,100,120,${Math.random() * 0.035})`);
    gr.addColorStop(1, 'rgba(120,100,120,0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const d = g.getImageData(0, 0, 512, 512);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 10;
    d.data[i] += n;
    d.data[i + 1] += n;
    d.data[i + 2] += n;
  }
  g.putImageData(d, 0, 0);
  return texturaQil(c, true);
}

function nurTexturasi() {
  const [c, g] = kanvas(256, 256);
  const gr = g.createRadialGradient(128, 104, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,232,196,1)');
  gr.addColorStop(0.45, 'rgba(255,225,185,0.42)');
  gr.addColorStop(1, 'rgba(255,220,180,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 256, 256);
  return texturaQil(c);
}

function namunaTexturasi(raqam) {
  const [c, g] = kanvas(640, 800);
  const gr = g.createLinearGradient(0, 0, 640, 800);
  gr.addColorStop(0, '#eadbec');
  gr.addColorStop(1, '#f7e6e4');
  g.fillStyle = gr;
  g.fillRect(0, 0, 640, 800);
  g.strokeStyle = 'rgba(91,58,94,0.28)';
  g.lineWidth = 3;
  g.setLineDash([16, 12]);
  g.strokeRect(44, 44, 552, 712);
  g.setLineDash([]);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#5b3a5e';
  g.font = 'italic 600 240px "Cormorant Garamond", Georgia, serif';
  g.fillText(ikki(raqam), 320, 380);
  g.fillStyle = 'rgba(91,58,94,0.7)';
  g.font = '700 28px Manrope, sans-serif';
  g.letterSpacing = '6px';
  g.fillText('RASM SHU YERGA', 320, 560);
  return texturaQil(c);
}

function yorliqTexturasi(raqam, sarlavha = '') {
  const H = 150, chet = 34, oraliq = 30;
  const raqamShrift = 'italic 600 66px "Cormorant Garamond", Georgia, serif';
  const matnShrift = '600 42px Manrope, sans-serif';
  const raqamMatn = `№ ${ikki(raqam)}`;
  const [, o] = kanvas(1, 1);
  o.font = raqamShrift;
  const rw = o.measureText(raqamMatn).width;
  let s = sarlavha.trim();
  o.font = matnShrift;
  if (s && o.measureText(s).width > 820) {
    while (s.length > 1 && o.measureText(s + '…').width > 820) s = s.slice(0, -1);
    s += '…';
  }
  const sw = s ? o.measureText(s).width + oraliq : 0;
  const [c, g] = kanvas(Math.ceil(chet * 2 + rw + sw), H);
  g.fillStyle = '#fbf7f1';
  g.beginPath();
  g.roundRect(0, 0, c.width, H, 16);
  g.fill();
  g.textBaseline = 'middle';
  g.fillStyle = '#9a7434';
  g.font = raqamShrift;
  g.fillText(raqamMatn, chet, H / 2 + 4);
  if (s) {
    g.fillStyle = '#3b2b3c';
    g.font = matnShrift;
    g.fillText(s, chet + rw + oraliq, H / 2 + 2);
  }
  return { t: texturaQil(c), nisbat: c.width / H };
}

function sarlavhaTexturasi(matn, rang = '#e8c987', soya = 'rgba(0,0,0,0.35)') {
  const [c, g] = kanvas(2048, 320);
  let olcham = 150;
  const shrift = () => `italic 600 ${olcham}px "Cormorant Garamond", Georgia, serif`;
  g.font = shrift();
  while (g.measureText(matn).width > 1900 && olcham > 60) {
    olcham -= 6;
    g.font = shrift();
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = rang;
  g.shadowColor = soya;
  g.shadowBlur = 14;
  g.fillText(matn, 1024, 150);
  g.shadowBlur = 0;
  const yarim = Math.min(g.measureText(matn).width * 0.42, 640);
  g.strokeStyle = rang;
  g.globalAlpha = 0.75;
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(1024 - yarim, 268);
  g.lineTo(1024 - 26, 268);
  g.moveTo(1024 + 26, 268);
  g.lineTo(1024 + yarim, 268);
  g.stroke();
  g.globalAlpha = 1;
  g.save();
  g.translate(1024, 268);
  g.rotate(Math.PI / 4);
  g.fillRect(-8, -8, 16, 16);
  g.restore();
  return texturaQil(c);
}

// ---------- Materiallar ----------
const birlikTekislik = new THREE.PlaneGeometry(1, 1);
const birlikQuti = new THREE.BoxGeometry(1, 1, 1);
const romMat = new THREE.MeshPhongMaterial({ color: '#b48a46', specular: '#ffdf9e', shininess: 60 });
const paspartuMat = new THREE.MeshLambertMaterial({ color: '#fbf8f2' });
const misMat = new THREE.MeshPhongMaterial({ color: '#c39a55', specular: '#fff0c8', shininess: 90 });
const lampaMat = new THREE.MeshBasicMaterial({ color: '#fff4dc', toneMapped: false });
const oqMat = new THREE.MeshLambertMaterial({ color: '#faf6f2' });
const nurTex = nurTexturasi();
const nurMat = (kuch) => new THREE.MeshBasicMaterial({
  map: nurTex, transparent: true, opacity: kuch,
  blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
});
const nurOchiq = nurMat(0.26);
const nurToq = nurMat(0.42);

const nishonlar = [];        // nur bilan tekshiriladigan narsalar
const doiralar = [];         // to‘siqlar: { x, z, r }
const qutilar = [];          // to‘siqlar: { x1, x2, z1, z2 }

// ---------- Xona ----------
function xonaQur() {
  const { en, chuqur, baland } = XONA;

  const pol = new THREE.Mesh(new THREE.PlaneGeometry(en, chuqur), new THREE.MeshLambertMaterial({ map: polTexturasi() }));
  pol.rotation.x = -Math.PI / 2;
  scene.add(pol);

  const ship = new THREE.Mesh(new THREE.PlaneGeometry(en, chuqur), new THREE.MeshLambertMaterial({ color: '#f3edf1' }));
  ship.rotation.x = Math.PI / 2;
  ship.position.y = baland;
  scene.add(ship);

  // Shiftdagi oyna: oq hoshiya, yorug‘ panel va to‘rtta bo‘lak
  const ow = en * 0.6, od = chuqur * 0.36;
  const hoshiya = new THREE.Mesh(new THREE.BoxGeometry(ow + 0.3, 0.1, od + 0.3), oqMat);
  hoshiya.position.y = baland - 0.05;
  scene.add(hoshiya);
  const oyna = new THREE.Mesh(new THREE.PlaneGeometry(ow, od), new THREE.MeshBasicMaterial({ color: '#fff8ee', toneMapped: false }));
  oyna.rotation.x = Math.PI / 2;
  oyna.position.y = baland - 0.105;
  scene.add(oyna);
  for (const k of [-1, 0, 1]) {
    const bolak = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, od), oqMat);
    bolak.position.set(k * ow / 4, baland - 0.12, 0);
    scene.add(bolak);
  }

  const asos = devorTexturasi();
  const devorMat = (rang, uzunlik) => {
    const t = asos.clone();
    t.repeat.set(uzunlik / 3, baland / 3);
    t.needsUpdate = true;
    return new THREE.MeshLambertMaterial({ color: rang, map: t });
  };
  const ochiq = '#efe3ee', toq = '#5b3a5e';
  devor(en, devorMat(ochiq, en), 0, -chuqur / 2, 0);              // chap (shimol)
  devor(en, devorMat(ochiq, en), 0, chuqur / 2, Math.PI);         // o‘ng (janub)
  devor(chuqur, devorMat(toq, chuqur), en / 2, 0, -Math.PI / 2);  // to‘r (sharq)
  devor(chuqur, devorMat(ochiq, chuqur), -en / 2, 0, Math.PI / 2); // kirish (g‘arb)

  // Nom ikki devorda: to‘rdagi to‘q devorda oltin rangda, kirish devorida binafsha rangda
  const nomGeo = new THREE.PlaneGeometry(8.4, 8.4 * 320 / 2048);
  const nomlar = [
    { map: sarlavhaTexturasi(SOZLAMALAR.muzeyNomi), x: en / 2 - 0.01, ry: -Math.PI / 2 },
    { map: sarlavhaTexturasi(SOZLAMALAR.muzeyNomi, '#5b3a5e', 'rgba(91,58,94,0.2)'), x: -en / 2 + 0.01, ry: Math.PI / 2 },
  ];
  for (const { map, x, ry } of nomlar) {
    const nom = new THREE.Mesh(nomGeo, new THREE.MeshBasicMaterial({ map, transparent: true, toneMapped: false }));
    nom.position.set(x, 3.62, 0);
    nom.rotation.y = ry;
    scene.add(nom);
  }
}

function devor(uzunlik, mat, x, z, ry) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(uzunlik, XONA.baland), mat);
  m.position.set(x, XONA.baland / 2, z);
  m.rotation.y = ry;
  scene.add(m);
  const plintus = new THREE.Mesh(new THREE.BoxGeometry(uzunlik, 0.14, 0.03), oqMat);
  plintus.position.set(x, 0.07, z);
  plintus.rotation.y = ry;
  plintus.translateZ(0.015);
  scene.add(plintus);
  const karniz = new THREE.Mesh(new THREE.BoxGeometry(uzunlik, 0.12, 0.08), oqMat);
  karniz.position.set(x, XONA.baland - 0.06, z);
  karniz.rotation.y = ry;
  karniz.translateZ(0.04);
  scene.add(karniz);
}

// ---------- Romlar ----------
function joylarniHisobla() {
  const { en, chuqur } = XONA;
  const uzun = [-3, -2, -1, 0, 1, 2, 3].map((i) => i * 3.4);
  const qisqa = [-1, 0, 1].map((i) => i * 4);
  const j = (x, z, nx, nz, toq = false) => ({ pos: new THREE.Vector3(x, ROM_Y, z), normal: new THREE.Vector3(nx, 0, nz), toq });
  return [
    ...uzun.map((x) => j(x, -chuqur / 2, 0, 1)),                   // 1–7: chap devor
    ...qisqa.map((z) => j(en / 2, z, -1, 0, true)),                // 8–10: to‘r devor
    ...[...uzun].reverse().map((x) => j(x, chuqur / 2, 0, -1)),    // 11–17: o‘ng devor
    ...[...qisqa].reverse().map((z) => j(-en / 2, z, 1, 0)),       // 18–20: kirish devori
  ];
}

const qalpoqGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 14);
const lampaGeo = new THREE.BoxGeometry(1, 0.012, 0.024);
const tutqichGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.24, 8);
const taglikGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16);

function chiroqQur() {
  const g = new THREE.Group();
  const qalpoq = new THREE.Mesh(qalpoqGeo, misMat);
  qalpoq.rotation.z = Math.PI / 2;
  qalpoq.position.z = 0.24;
  const lampa = new THREE.Mesh(lampaGeo, lampaMat);
  lampa.position.set(0, -0.028, 0.24);
  const tutqich = new THREE.Mesh(tutqichGeo, misMat);
  tutqich.rotation.x = Math.PI / 2;
  tutqich.position.z = 0.12;
  const taglik = new THREE.Mesh(taglikGeo, misMat);
  taglik.rotation.x = Math.PI / 2;
  taglik.position.z = 0.01;
  g.add(qalpoq, lampa, tutqich, taglik);
  g.userData = { qalpoq, lampa };
  return g;
}

function slotQur(joy, i) {
  const g = new THREE.Group();
  g.position.copy(joy.pos);
  g.lookAt(joy.pos.clone().add(joy.normal));
  scene.add(g);
  const nur = new THREE.Mesh(birlikTekislik, joy.toq ? nurToq : nurOchiq);
  nur.position.z = 0.004;
  const rom = new THREE.Mesh(birlikQuti, romMat);
  const paspartu = new THREE.Mesh(birlikTekislik, paspartuMat);
  const rasm = new THREE.Mesh(birlikTekislik, new THREE.MeshBasicMaterial({ map: namunaTexturasi(i + 1), toneMapped: false }));
  const yorliq = new THREE.Mesh(birlikTekislik, new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false }));
  const chiroq = chiroqQur();
  g.add(nur, rom, paspartu, rasm, yorliq, chiroq);
  rom.userData.nishon = i;
  rasm.userData.nishon = i;
  nishonlar.push(rom, rasm);
  const s = { joy, g, nur, rom, paspartu, rasm, yorliq, chiroq, w: 1, h: 1 };
  olchamQoy(s, 0.8);
  yorliqQoy(s, i);
  return s;
}

// Rom rasm nisbatiga moslashadi: eng ko‘pi bilan ROM_MAX ichiga sig‘adi
function olchamQoy(s, nisbat) {
  let w = ROM_MAX.w, h = w / nisbat;
  if (h > ROM_MAX.h) {
    h = ROM_MAX.h;
    w = h * nisbat;
  }
  s.w = w;
  s.h = h;
  const pw = w + 2 * PASPARTU, ph = h + 2 * PASPARTU;
  const rw = pw + 2 * ROM_QALIN, rh = ph + 2 * ROM_QALIN;
  s.rom.scale.set(rw, rh, 0.06);
  s.rom.position.z = 0.03;
  s.paspartu.scale.set(pw, ph, 1);
  s.paspartu.position.z = 0.063;
  s.rasm.scale.set(w, h, 1);
  s.rasm.position.z = 0.066;
  s.nur.scale.set(rw + 1.5, rh + 1.9, 1);
  s.nur.position.y = 0.3;
  const uz = clamp(w * 0.55, 0.35, 0.8);
  s.chiroq.position.y = rh / 2 + 0.13;
  s.chiroq.userData.qalpoq.scale.y = uz;
  s.chiroq.userData.lampa.scale.x = uz * 0.92;
  s.yorliq.position.set(0, -rh / 2 - 0.15, 0.006);
}

function yorliqQoy(s, i) {
  const { t, nisbat } = yorliqTexturasi(i + 1, rasmlar[i].sarlavha);
  s.yorliq.material.map?.dispose();
  s.yorliq.material.map = t;
  s.yorliq.material.needsUpdate = true;
  s.yorliq.scale.set(0.11 * nisbat, 0.11, 1);
}

// ---------- Markaz: tosh ustun va yurak ----------
function yurakGeometriyasi() {
  const s = new THREE.Shape();
  s.moveTo(5, 5);
  s.bezierCurveTo(5, 5, 4, 0, 0, 0);
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  s.bezierCurveTo(16, 7, 16, 0, 10, 0);
  s.bezierCurveTo(7, 0, 5, 5, 5, 5);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 3, steps: 1, curveSegments: 32,
    bevelEnabled: true, bevelSegments: 8, bevelSize: 1.6, bevelThickness: 2,
  });
  geo.center();
  geo.rotateZ(Math.PI);
  geo.scale(0.027, 0.027, 0.027);
  return geo;
}

function markazQur() {
  const tosh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.42, 0.48, 1.0, 48),
    new THREE.MeshPhongMaterial({ color: '#f5efe9', specular: '#ffffff', shininess: 25 }),
  );
  tosh.position.y = 0.5;
  tosh.userData.nishon = null;
  scene.add(tosh);
  for (const [r, y] of [[0.425, 1.0], [0.485, 0.03]]) {
    const halqa = new THREE.Mesh(new THREE.TorusGeometry(r, 0.016, 10, 48), misMat);
    halqa.rotation.x = Math.PI / 2;
    halqa.position.y = y;
    scene.add(halqa);
  }
  const yurak = new THREE.Mesh(
    yurakGeometriyasi(),
    new THREE.MeshPhongMaterial({ color: '#e35d7f', emissive: '#4a0d1f', specular: '#ffd0dc', shininess: 80 }),
  );
  yurak.position.y = 1.62;
  yurak.userData.nishon = 'yurak';
  scene.add(yurak);
  const pushti = new THREE.PointLight('#ff7aa2', 2.5, 4, 2);
  pushti.position.set(0, 1.75, 0);
  scene.add(pushti);
  nishonlar.push(tosh, yurak);
  doiralar.push({ x: 0, z: 0, r: 0.95 });
  return yurak;
}

const yogochMat = new THREE.MeshLambertMaterial({ color: '#8a5a3c' });
const temirMat = new THREE.MeshLambertMaterial({ color: '#2f2630' });
function skameyka(x, z) {
  const g = new THREE.Group();
  const orindiq = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.07, 0.5), yogochMat);
  orindiq.position.y = 0.45;
  orindiq.userData.nishon = null;
  g.add(orindiq);
  for (const s of [-0.85, 0.85]) {
    const oyoq = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.44), temirMat);
    oyoq.position.set(s, 0.21, 0);
    g.add(oyoq);
  }
  g.position.set(x, 0, z);
  scene.add(g);
  nishonlar.push(orindiq);
  qutilar.push({ x1: x - 1.35, x2: x + 1.35, z1: z - 0.6, z2: z + 0.6 });
}

// ---------- Gullar: lola va pion ----------
// Har bir gul qismi avval bo‘sh Object3D bo‘lib joylanadi, keyin hammasi
// to‘rtta InstancedMesh ga yig‘iladi — telefonda chizish arzon bo‘ladi.
const LOLA_RANGLARI = ['#e8476f', '#f27c9b', '#ffd6df', '#d81e5b', '#fff1ec', '#f59ab5', '#ff6f61'];
const PION_RANGLARI = ['#f7b6c8', '#f490b0', '#ffe3ea', '#e86a92', '#fbd0dc'];
const gulQismlari = { lola: [], poya: [], barg: [], gulbarg: [] };
const tasodif = (a, b) => a + Math.random() * (b - a);
const tanla = (r) => r[Math.floor(Math.random() * r.length)];

const vazaGeo = new THREE.LatheGeometry(
  [[0, 0], [0.15, 0], [0.19, 0.06], [0.23, 0.22], [0.21, 0.4], [0.14, 0.55], [0.12, 0.6], [0.14, 0.64]]
    .map(([r, y]) => new THREE.Vector2(r, y)),
  40,
);
const vazaMat = new THREE.MeshPhongMaterial({ color: '#f1e9e2', specular: '#ffffff', shininess: 40, side: THREE.DoubleSide });
const gardishGeo = new THREE.TorusGeometry(0.14, 0.012, 8, 32);

function qism(ota, tur, rang) {
  const o = new THREE.Object3D();
  o.userData = { tur, rang: new THREE.Color(rang) };
  ota.add(o);
  return o;
}

// Vaza ichidan chiqib tashqariga og‘gan poya; uchidagi nuqtani qaytaradi
function poyaQoy(ota, uzunlik, egilish) {
  const asos = new THREE.Object3D();
  asos.position.y = 0.45;
  asos.rotation.y = tasodif(0, Math.PI * 2);
  const egik = new THREE.Object3D();
  egik.rotation.x = egilish;
  asos.add(egik);
  ota.add(asos);
  qism(egik, 'poya', new THREE.Color('#4c7a3d').offsetHSL(0, 0, tasodif(-0.04, 0.04))).scale.set(1, uzunlik, 1);
  const uch = new THREE.Object3D();
  uch.position.y = uzunlik;
  egik.add(uch);
  return uch;
}

function bargQoy(ota, uz, en, egilish) {
  const asos = new THREE.Object3D();
  asos.position.y = 0.5;
  asos.rotation.y = tasodif(0, Math.PI * 2);
  const egik = new THREE.Object3D();
  egik.rotation.x = egilish;
  asos.add(egik);
  ota.add(asos);
  const b = qism(egik, 'barg', new THREE.Color('#4f8a43').offsetHSL(tasodif(-0.02, 0.02), 0, tasodif(-0.06, 0.03)));
  b.position.y = uz;
  b.scale.set(en, uz, en * 0.22);
}

function lolaQoy(ota) {
  const uch = poyaQoy(ota, tasodif(0.55, 0.85), tasodif(0.04, 0.34));
  const bosh = qism(uch, 'lola', tanla(LOLA_RANGLARI));
  bosh.rotation.y = tasodif(0, Math.PI);
  bosh.scale.setScalar(tasodif(0.9, 1.15));
}

// Pion: o‘rtada g‘uncha, atrofida uch qavat gulbarg — ichkarisi tik, tashqarisi yoyilgan
function pionQoy(ota) {
  const asosRang = new THREE.Color(tanla(PION_RANGLARI));
  const uch = poyaQoy(ota, tasodif(0.42, 0.7), tasodif(0.1, 0.5));
  const bosh = new THREE.Object3D();
  bosh.scale.setScalar(tasodif(0.85, 1.2));
  uch.add(bosh);
  const yadro = qism(bosh, 'gulbarg', asosRang.clone().offsetHSL(0, 0.05, -0.08));
  yadro.position.y = 0.03;
  yadro.scale.set(0.035, 0.03, 0.035);
  const qavatlar = [
    { n: 6, r: 0.016, egilish: 0.25, w: 0.03, h: 0.04, och: -0.05 },
    { n: 8, r: 0.032, egilish: 0.65, w: 0.042, h: 0.05, och: 0 },
    { n: 11, r: 0.048, egilish: 1.1, w: 0.05, h: 0.055, och: 0.05 },
  ];
  for (const q of qavatlar) {
    for (let k = 0; k < q.n; k++) {
      const aylan = new THREE.Object3D();
      aylan.rotation.y = (k / q.n) * Math.PI * 2 + tasodif(0, 0.3);
      const tayanch = new THREE.Object3D();
      tayanch.position.z = q.r;
      tayanch.rotation.x = q.egilish + tasodif(-0.1, 0.1);
      aylan.add(tayanch);
      bosh.add(aylan);
      const g = qism(tayanch, 'gulbarg', asosRang.clone().offsetHSL(0, 0, q.och + tasodif(-0.02, 0.02)));
      g.position.y = q.h;
      g.scale.set(q.w, q.h, 0.012);
    }
  }
}

function vazaQur(x, z, tur) {
  const g = new THREE.Group();
  const vaza = new THREE.Mesh(vazaGeo, vazaMat);
  vaza.userData.nishon = null;
  const gardish = new THREE.Mesh(gardishGeo, misMat);
  gardish.rotation.x = Math.PI / 2;
  gardish.position.y = 0.64;
  const yigma = new THREE.Group();
  g.add(vaza, gardish, yigma);
  if (tur === 'lola') {
    for (let k = 0; k < 13; k++) lolaQoy(yigma);
    for (let k = 0; k < 8; k++) bargQoy(yigma, tasodif(0.18, 0.26), 0.04, tasodif(0.3, 0.75));
  } else {
    for (let k = 0; k < 7; k++) pionQoy(yigma);
    for (let k = 0; k < 9; k++) bargQoy(yigma, tasodif(0.1, 0.14), 0.065, tasodif(0.9, 1.3));
  }
  g.position.set(x, 0, z);
  scene.add(g);
  g.updateMatrixWorld(true);
  yigma.traverse((o) => {
    if (o.userData.tur) gulQismlari[o.userData.tur].push({ m: o.matrixWorld.clone(), rang: o.userData.rang });
  });
  g.remove(yigma);
  nishonlar.push(vaza);
  doiralar.push({ x, z, r: 0.6 });
}

// Lola kosachasi: aylanma profil, tepasida uchta gulbarg uchi biroz ko‘tarilgan
function lolaGeometriyasi() {
  const H = 0.098;
  const geo = new THREE.LatheGeometry(
    [[0.002, 0], [0.022, 0.006], [0.038, 0.022], [0.045, 0.045], [0.042, 0.07], [0.034, 0.088], [0.028, H]]
      .map(([r, y]) => new THREE.Vector2(r, y)),
    24,
  );
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const t = y / H, lob = Math.cos(Math.atan2(z, x) * 3), k = 1 + 0.07 * lob * t;
    p.setXYZ(i, x * k, y + 0.014 * Math.max(0, lob) * t ** 4, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

function gullarniYigish() {
  const poyaGeo = new THREE.CylinderGeometry(0.0055, 0.0075, 1, 6);
  poyaGeo.translate(0, 0.5, 0);
  const shar = new THREE.SphereGeometry(1, 12, 8);
  const turlar = {
    lola: [lolaGeometriyasi(), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })],
    poya: [poyaGeo, new THREE.MeshLambertMaterial()],
    barg: [shar, new THREE.MeshLambertMaterial()],
    gulbarg: [shar, new THREE.MeshLambertMaterial()],
  };
  for (const [tur, [geo, mat]] of Object.entries(turlar)) {
    const royxat = gulQismlari[tur];
    const im = new THREE.InstancedMesh(geo, mat, royxat.length);
    royxat.forEach(({ m, rang }, i) => {
      im.setMatrixAt(i, m);
      im.setColorAt(i, rang);
    });
    im.frustumCulled = false;
    scene.add(im);
  }
}

// ---------- Sahnani yig‘ish ----------
scene.add(new THREE.HemisphereLight('#fff4ea', '#6b4b3a', 2.3));
for (const x of [-8.5, 0, 8.5]) {
  const l = new THREE.PointLight('#ffe6cc', 16, 0, 2);
  l.position.set(x, 4.1, 0);
  scene.add(l);
}
xonaQur();
const slotlar = joylarniHisobla().map(slotQur);
const yurak = markazQur();
skameyka(-6.5, 0);
skameyka(6.5, 0);
vazaQur(-12.2, -5.6, 'lola');
vazaQur(12.2, -5.6, 'lola');
vazaQur(12.2, 5.6, 'pion');
vazaQur(-12.2, 5.6, 'pion');
gullarniYigish();

// ---------- Rasmlarni yuklash ----------
function rasmOl(src) {
  return new Promise((ok, xato) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = xato;
    img.src = src;
  });
}

const yuklanadigan = rasmlar.filter((r) => r.fayl).length;
let yuklandi = 0;
function yuklanishniYoz() {
  if (!yuklanadigan) return;
  $('#yuklanish').textContent = yuklandi < yuklanadigan
    ? `Rasmlar devorga ilinmoqda… ${yuklandi}/${yuklanadigan}`
    : 'Hamma rasmlar joyida ✓';
}

async function rasmYukla(i) {
  const fayl = rasmlar[i].fayl;
  if (!fayl) return;
  try {
    const img = await rasmOl(fayl);
    // Katta rasmlar telefon xotirasini to‘ldirmasligi uchun kichraytiriladi
    const k = Math.min(1, TEXTURA_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const [c, g] = kanvas(Math.round(img.naturalWidth * k), Math.round(img.naturalHeight * k));
    g.drawImage(img, 0, 0, c.width, c.height);
    const s = slotlar[i];
    s.rasm.material.map.dispose();
    s.rasm.material.map = texturaQil(c);
    s.rasm.material.needsUpdate = true;
    olchamQoy(s, c.width / c.height);
  } catch {
    console.warn('Rasm topilmadi:', fayl);
  }
  yuklandi++;
  yuklanishniYoz();
}

yuklanishniYoz();
rasmlar.forEach((_, i) => rasmYukla(i));

// ---------- Holat ----------
let rejim = 'kirish';         // 'kirish' | 'muzey'
let fokusIndex = -1;
let uchish = null;
const holat = { pos: BOSH_POS.clone(), yaw: BOSH_YAW, pitch: -0.03, v: new THREE.Vector3() };

const panel = $('#panel');
const joystik = $('#joystik');
const joystikTugma = $('#joystik-tugma');

// Kamera a nuqtadan b ga egri chiziq bo‘ylab uchadi; yo‘lda markazdagi ustunni aylanib o‘tadi
function uchibBor(pos, yaw, pitch, dav) {
  const a = holat.pos.clone(), b = pos.clone(), c = a.clone().lerp(b, 0.5);
  const abx = b.x - a.x, abz = b.z - a.z, l2 = abx * abx + abz * abz;
  const t = l2 ? clamp((-a.x * abx - a.z * abz) / l2, 0, 1) : 0;
  const yx = a.x + abx * t, yz = a.z + abz * t, yaqin = Math.hypot(yx, yz);
  if (yaqin < 1.6 && l2 > 0.01) {
    let nx = -abz, nz = abx;
    const nl = Math.hypot(nx, nz);
    nx /= nl;
    nz /= nl;
    if (nx * yx + nz * yz < 0) {
      nx = -nx;
      nz = -nz;
    }
    const surish = (2.6 - yaqin) * 2;
    c.x += nx * surish;
    c.z += nz * surish;
  }
  const dyaw = Math.atan2(Math.sin(yaw - holat.yaw), Math.cos(yaw - holat.yaw));
  uchish = {
    a, b, c, yaw0: holat.yaw, dyaw, p0: holat.pitch, p1: pitch, t: 0,
    dav: dav ?? clamp(0.9 + a.distanceTo(b) * 0.07, 0.9, 2.2),
  };
}

function uchishQadam(dt) {
  const u = uchish;
  u.t = Math.min(1, u.t + dt / u.dav);
  const k = silliq(u.t), m = 1 - k;
  holat.pos.set(
    m * m * u.a.x + 2 * m * k * u.c.x + k * k * u.b.x,
    m * m * u.a.y + 2 * m * k * u.c.y + k * k * u.b.y,
    m * m * u.a.z + 2 * m * k * u.c.z + k * k * u.b.z,
  );
  holat.yaw = u.yaw0 + u.dyaw * k;
  holat.pitch = u.p0 + (u.p1 - u.p0) * k;
  if (u.t >= 1) uchish = null;
}

function fokus(i) {
  fokusIndex = i;
  const s = slotlar[i], r = rasmlar[i];
  $('#panel-raqam').textContent = ikki(i + 1);
  $('#panel-sarlavha').textContent = r.sarlavha || (r.fayl ? '' : 'Bu yerga rasm ilinadi');
  $('#panel-izoh').textContent = r.izoh || '';
  $('#panel-matn').hidden = !$('#panel-sarlavha').textContent && !$('#panel-izoh').textContent;
  panel.hidden = false;
  joystik.hidden = true;
  maslahatniYashir();

  // Rom (yorlig‘i bilan) panel ustidagi bo‘sh joyga to‘liq sig‘adigan masofa
  const j = s.joy;
  const tw = s.w + 2 * (PASPARTU + ROM_QALIN);
  const th = s.h + 2 * (PASPARTU + ROM_QALIN) + 0.42;
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const tanH = tanV * camera.aspect;
  const panelH = panel.getBoundingClientRect().height + 28;
  const bosh = Math.max(0.45, 1 - panelH / innerHeight);
  const d = Math.max((th / 2) / (tanV * bosh), (tw / 2) / tanH) * 1.1 + 0.07;
  const pos = j.pos.clone().addScaledVector(j.normal, d);
  pos.y = clamp(j.pos.y - 0.2 - (panelH / innerHeight) * d * tanV, 0.4, 3);
  uchibBor(pos, Math.atan2(j.normal.x, j.normal.z), 0);
}

function fokusdanChiq() {
  if (fokusIndex < 0) return;
  fokusIndex = -1;
  panel.hidden = true;
  if (TOUCH && rejim === 'muzey') joystik.hidden = false;
}

function toxtat() {
  uchish = null;
  fokusdanChiq();
}

function keyingi() {
  if (fokusIndex >= RASM_SONI - 1) yakunniOch();
  else fokus(fokusIndex + 1);
}

function oldingi() {
  if (fokusIndex > 0) fokus(fokusIndex - 1);
}

function yakunniOch() {
  toxtat();
  joystik.hidden = true;
  $('#yakun').hidden = false;
}

function yakunniYop() {
  $('#yakun').hidden = true;
  if (TOUCH && fokusIndex < 0) joystik.hidden = false;
}

// ---------- Kirish ----------
let audio = null;
const musiqaTugma = $('#musiqa-tugma');
const IKONKA_MUSIQA = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 17.5V6l10-2v11.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.5" fill="currentColor"/><circle cx="16.5" cy="15.5" r="2.5" fill="currentColor"/></svg>';
const IKONKA_JIM = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 17.5V6l10-2v11.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" opacity=".45"/><circle cx="6.5" cy="17.5" r="2.5" fill="currentColor" opacity=".45"/><circle cx="16.5" cy="15.5" r="2.5" fill="currentColor" opacity=".45"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
if (SOZLAMALAR.musiqa) {
  audio = new Audio(SOZLAMALAR.musiqa);
  audio.loop = true;
  audio.preload = 'auto';
  musiqaTugma.hidden = false;
  musiqaTugma.innerHTML = IKONKA_JIM;
}

function musiqaChal() {
  if (!audio) return;
  audio.volume = 0;
  audio.play().then(() => {
    musiqaTugma.innerHTML = IKONKA_MUSIQA;
    const oshir = setInterval(() => {
      audio.volume = Math.min(0.6, audio.volume + 0.03);
      if (audio.volume >= 0.6) clearInterval(oshir);
    }, 80);
  }).catch(() => {});
}

musiqaTugma.addEventListener('click', () => {
  if (audio.paused) musiqaChal();
  else {
    audio.pause();
    musiqaTugma.innerHTML = IKONKA_JIM;
  }
});

let maslahatVaqti = null;
function maslahatKorsat() {
  $('#maslahat').classList.add('korin');
  clearTimeout(maslahatVaqti);
  maslahatVaqti = setTimeout(maslahatniYashir, 9000);
}
function maslahatniYashir() {
  $('#maslahat').classList.remove('korin');
}

function kirish() {
  if (rejim !== 'kirish') return;
  rejim = 'muzey';
  $('.chipta').classList.add('yirtildi');
  musiqaChal();
  uchibBor(BOSH_POS, BOSH_YAW, -0.03, 1.4);
  setTimeout(() => $('#kirish').classList.add('ketdi'), 450);
  setTimeout(() => {
    $('#kirish').hidden = true;
    $('#yuqori').hidden = false;
    if (TOUCH) joystik.hidden = false;
    maslahatKorsat();
  }, 1250);
}

$('#kirish-tugma').addEventListener('click', kirish);
$('#sayohat-tugma').addEventListener('click', () => fokus(0));
$('#yordam-tugma').addEventListener('click', maslahatKorsat);
$('#keyingi').addEventListener('click', keyingi);
$('#oldingi').addEventListener('click', oldingi);
$('#yopish').addEventListener('click', fokusdanChiq);
$('#yakun-yopish').addEventListener('click', yakunniYop);
$('#yakun-boshidan').addEventListener('click', () => {
  yakunniYop();
  fokus(0);
});

// ---------- Boshqaruv: qarash va bosish ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function nishon(x, y) {
  ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObjects(nishonlar, false)[0];
  if (!hit || hit.distance > 30) return null;
  return hit.object.userData.nishon ?? null;
}

function bosish(x, y) {
  const n = nishon(x, y);
  if (n === 'yurak') yakunniOch();
  else if (typeof n === 'number') fokus(n);
  else fokusdanChiq();
}

const korish = { id: null, x: 0, y: 0, t0: 0, yol: 0 };
let sichqon = null;

canvas.addEventListener('pointerdown', (e) => {
  if (rejim !== 'muzey' || korish.id !== null) return;
  korish.id = e.pointerId;
  korish.x = e.clientX;
  korish.y = e.clientY;
  korish.t0 = performance.now();
  korish.yol = 0;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'mouse') sichqon = { x: e.clientX, y: e.clientY };
  if (e.pointerId !== korish.id) return;
  const dx = e.clientX - korish.x, dy = e.clientY - korish.y;
  korish.x = e.clientX;
  korish.y = e.clientY;
  korish.yol += Math.abs(dx) + Math.abs(dy);
  if (korish.yol < 6) return;
  if (fokusIndex >= 0 || uchish) toxtat();
  canvas.style.cursor = 'grabbing';
  const k = TOUCH ? 0.0055 : 0.0038;
  // Barmoq qaysi tomonga yursa, nigoh ham o‘sha tomonga buriladi
  holat.yaw -= dx * k;
  holat.pitch = clamp(holat.pitch - dy * k, -1.1, 1.1);
});

function korishTugadi(e) {
  if (e.pointerId !== korish.id) return;
  korish.id = null;
  canvas.style.cursor = 'grab';
  if (e.type === 'pointerup' && korish.yol < 8 && performance.now() - korish.t0 < 400) bosish(e.clientX, e.clientY);
}
canvas.addEventListener('pointerup', korishTugadi);
canvas.addEventListener('pointercancel', korishTugadi);
canvas.addEventListener('pointerleave', () => { sichqon = null; });

// ---------- Boshqaruv: joystik ----------
const joy = { id: null, x: 0, y: 0 };
function joyYangila(e) {
  const r = joystik.getBoundingClientRect();
  let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  const max = r.width / 2 - 12, l = Math.hypot(dx, dy);
  if (l > max) {
    dx *= max / l;
    dy *= max / l;
  }
  joy.x = dx / max;
  joy.y = dy / max;
  joystikTugma.style.transform = `translate(${dx}px, ${dy}px)`;
}
joystik.addEventListener('pointerdown', (e) => {
  joy.id = e.pointerId;
  joystik.setPointerCapture(e.pointerId);
  toxtat();
  joyYangila(e);
});
joystik.addEventListener('pointermove', (e) => {
  if (e.pointerId === joy.id) joyYangila(e);
});
function joyTugadi(e) {
  if (e.pointerId !== joy.id) return;
  joy.id = null;
  joy.x = joy.y = 0;
  joystikTugma.style.transform = '';
}
joystik.addEventListener('pointerup', joyTugadi);
joystik.addEventListener('pointercancel', joyTugadi);

// ---------- Boshqaruv: klaviatura ----------
const tugmalar = new Set();
const YURISH_TUGMALARI = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown'];
addEventListener('keydown', (e) => {
  if (rejim === 'kirish') {
    if (e.code === 'Enter') kirish();
    return;
  }
  if (!$('#yakun').hidden) {
    if (e.code === 'Escape') yakunniYop();
    return;
  }
  if (fokusIndex >= 0) {
    if (e.code === 'ArrowRight' || e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat) keyingi();
      return;
    }
    if (e.code === 'ArrowLeft') {
      if (!e.repeat) oldingi();
      return;
    }
    if (e.code === 'Escape') {
      fokusdanChiq();
      return;
    }
    if (YURISH_TUGMALARI.includes(e.code)) toxtat();
  }
  if (YURISH_TUGMALARI.includes(e.code) || e.code === 'ArrowLeft' || e.code === 'ArrowRight') uchish = null;
  tugmalar.add(e.code);
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
});
addEventListener('keyup', (e) => tugmalar.delete(e.code));
addEventListener('blur', () => tugmalar.clear());

// ---------- Yurish va to‘qnashuv ----------
function toqnash(p) {
  const hx = XONA.en / 2 - 0.5, hz = XONA.chuqur / 2 - 0.5;
  p.x = clamp(p.x, -hx, hx);
  p.z = clamp(p.z, -hz, hz);
  for (const d of doiralar) {
    const dx = p.x - d.x, dz = p.z - d.z, l = Math.hypot(dx, dz);
    if (l < d.r) {
      const k = d.r / (l || 1e-4);
      p.x = d.x + dx * k;
      p.z = d.z + dz * k;
    }
  }
  for (const q of qutilar) {
    if (p.x > q.x1 && p.x < q.x2 && p.z > q.z1 && p.z < q.z2) {
      const m = Math.min(p.x - q.x1, q.x2 - p.x, p.z - q.z1, q.z2 - p.z);
      if (m === p.x - q.x1) p.x = q.x1;
      else if (m === q.x2 - p.x) p.x = q.x2;
      else if (m === p.z - q.z1) p.z = q.z1;
      else p.z = q.z2;
    }
  }
}

const oldinga = new THREE.Vector3(), ong = new THREE.Vector3(), maqsadV = new THREE.Vector3();
function yurish(dt) {
  const bor = (...k) => k.some((x) => tugmalar.has(x));
  let f = 0, s = 0;
  if (bor('KeyW', 'ArrowUp')) f += 1;
  if (bor('KeyS', 'ArrowDown')) f -= 1;
  if (bor('KeyD')) s += 1;
  if (bor('KeyA')) s -= 1;
  if (bor('ArrowLeft')) holat.yaw += 1.8 * dt;
  if (bor('ArrowRight')) holat.yaw -= 1.8 * dt;
  f -= joy.y;
  s += joy.x;
  const l = Math.hypot(f, s);
  if (l > 1) {
    f /= l;
    s /= l;
  }
  oldinga.set(-Math.sin(holat.yaw), 0, -Math.cos(holat.yaw));
  ong.set(Math.cos(holat.yaw), 0, -Math.sin(holat.yaw));
  const tez = TEZLIK * (bor('ShiftLeft', 'ShiftRight') ? 1.7 : 1);
  maqsadV.copy(oldinga).multiplyScalar(f * tez).addScaledVector(ong, s * tez);
  holat.v.lerp(maqsadV, 1 - Math.exp(-dt * 10));
  holat.pos.addScaledVector(holat.v, dt);
  toqnash(holat.pos);
  holat.pos.y += (KOZ - holat.pos.y) * (1 - Math.exp(-dt * 5));
}

// ---------- Asosiy sikl ----------
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight, false);
  fovniMoslash();
});

const soat = new THREE.Clock();
let vaqt = 0, hoverVaqt = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(soat.getDelta(), 0.05);
  vaqt += dt;
  yurak.rotation.y += dt * 0.7;
  yurak.position.y = 1.62 + Math.sin(vaqt * 1.5) * 0.05;

  if (rejim === 'kirish') holat.yaw = BOSH_YAW + Math.sin(vaqt * 0.22) * 0.45;
  else if (uchish) uchishQadam(dt);
  else if (fokusIndex < 0) yurish(dt);

  camera.position.copy(holat.pos);
  camera.rotation.set(holat.pitch, holat.yaw, 0);

  if (!TOUCH && rejim === 'muzey' && sichqon && korish.id === null && vaqt - hoverVaqt > 0.1) {
    hoverVaqt = vaqt;
    canvas.style.cursor = nishon(sichqon.x, sichqon.y) !== null ? 'pointer' : 'grab';
  }
  renderer.render(scene, camera);
});
