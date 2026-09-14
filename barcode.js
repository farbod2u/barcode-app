const bwipjs = require('bwip-js');
const fs = require('fs');

bwipjs.toBuffer({
  bcid: 'code128',       // Barcode type
  text: '123456789012',  // Text to encode
  scale: 3,               // 3x scaling factor
  height: 10,              // Bar height, in millimeters
  includetext: true,      // Show human-readable text
  textxalign: 'center',   // Center the text
}, function (err, png) {
  if (err) {
    console.error('Error:', err);
  } else {
    fs.writeFileSync('barcode.png', png);
    console.log('Barcode saved as barcode.png');
  }
});
