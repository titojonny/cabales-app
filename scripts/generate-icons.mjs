import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';

/** Calcula el CRC requerido por cada bloque del formato PNG. */
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Empaqueta datos binarios como un bloque PNG con longitud y suma de control. */
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

/**
 * Genera un icono RGBA determinista sin recursos externos.
 * Los radios son proporciones del lienzo para conservar la misma silueta en 192 y 512 px.
 */
function createIcon(size) {
  const rows = [];
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    for (let x = 0; x < size; x += 1) {
      const dx = x - size / 2;
      const dy = y - size / 2;
      const radius = Math.hypot(dx, dy);
      // Dos circunferencias concéntricas recortadas a la derecha forman la C de Cabales.
      const cShape = radius > size * 0.18 && radius < size * 0.31 && x < size * 0.65;
      // La barra coral cruza la abertura sin depender de coordenadas de una resolución concreta.
      const crossbar = x > size * 0.52 && x < size * 0.76 && Math.abs(dy) < size * 0.045;
      const offset = 1 + x * 4;
      const edge = Math.min(x, y, size - x - 1, size - y - 1);
      // La distancia al borde aproxima una máscara de esquinas redondeadas y fondo transparente.
      const rounded =
        edge > size * 0.08 || Math.hypot(size * 0.08 - edge, size * 0.08) < size * 0.09;
      const color = cShape ? [248, 249, 255] : crossbar ? [255, 141, 114] : [16, 20, 44];
      row.set([...color, rounded ? 255 : 0], offset);
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) writeFileSync(`public/icon-${size}.png`, createIcon(size));
