const fs = require('fs');
const path = require('path');

const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
  const svgContent = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bg" cx="50%" cy="50%" r="50%">
        <stop offset="0%" style="stop-color:#1e3c72"/>
        <stop offset="50%" style="stop-color:#2a5298"/>
        <stop offset="100%" style="stop-color:#c41e3a"/>
      </radialGradient>
    </defs>
    <circle cx="${size/2}" cy="${size/2}" r="${size/2-1}" fill="url(#bg)" stroke="white" stroke-width="1"/>
    <circle cx="${size/2}" cy="${size/2}" r="${size/3}" fill="#ff4444" opacity="0.8"/>
    <text x="${size/2}" y="${size/2 + Math.floor(size*0.15)}" text-anchor="middle" font-size="${Math.floor(size*0.4)}" fill="white">🕷</text>
  </svg>`;
  
  fs.writeFileSync(path.join(__dirname, 'icons', `icon${size}.svg`), svgContent);
  console.log(`Created icon${size}.svg`);
});

console.log('Icons created. Use an online SVG to PNG converter or install librsvg for conversion.');