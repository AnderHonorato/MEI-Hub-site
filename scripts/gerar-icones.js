const sharp = require('sharp');
const path = require('node:path');

const BASE = path.join(__dirname, '..', 'public', 'img', 'icone-base.png');
const DIR = path.join(__dirname, '..', 'public', 'img');

async function gerar() {
  // 192x192
  await sharp(BASE).resize(192, 192).png().toFile(path.join(DIR, 'icone-192.png'))

  // 512x512
  await sharp(BASE).resize(512, 512).png().toFile(path.join(DIR, 'icone-512.png'))

  // 512x512 maskable (10% de margem de segurança)
  const margem = Math.round(512 * 0.1); // 51px
  await sharp(BASE)
    .resize(512 - margem * 2, 512 - margem * 2)
    .extend({ top: margem, bottom: margem, left: margem, right: margem, background: '#c6f3dc' })
    .png()
    .toFile(path.join(DIR, 'icone-512-maskable.png'))

  // 180x180 apple-touch-icon (sem margem extra pois o iOS já aplica seu próprio recorte)
  await sharp(BASE).resize(180, 180).png().toFile(path.join(DIR, 'apple-touch-icon.png'))

  console.log('Ícones PWA gerados com sucesso.');
  console.log(`  - ${path.join(DIR, 'icone-192.png')}`);
  console.log(`  - ${path.join(DIR, 'icone-512.png')}`);
  console.log(`  - ${path.join(DIR, 'icone-512-maskable.png')}`);
  console.log(`  - ${path.join(DIR, 'apple-touch-icon.png')}`);
}

gerar().catch(err => { console.error(err); process.exit(1); });
