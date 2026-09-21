/**
 * Stands in for the Audiveris command line during tests.
 *
 * Takes the same arguments the real one would — `-batch -transcribe -export
 * -output <dir> -- <input>` — and does what FAKE_AUDIVERIS says instead of
 * reading any music:
 *
 *   export   write a small single-part score into the output directory
 *   twice    write two exports, which the service must refuse to choose between
 *   doctype  write a score with a DOCTYPE, which must not get through
 *   nothing  exit cleanly having written nothing
 *   hang     never finish, so the timeout has something to time out
 *   mxl      write the export as a compressed .mxl, as Audiveris does by default
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import { deflateRawSync } from 'node:zlib';

const args = process.argv.slice(2);
const outDir = args[args.indexOf('-output') + 1];
const input = args[args.length - 1];
const stem = basename(input).replace(/\.[^.]+$/, '');
const mode = process.env.FAKE_AUDIVERIS ?? 'export';

const SCORE = `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0">
  <work><work-title>Scanned</work-title></work>
  <part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>
  <part id="P1"><measure number="1">
    <attributes><divisions>1</divisions><key><fifths>0</fifths></key>
    <time><beats>4</beats><beat-type>4</beat-type></time>
    <clef><sign>G</sign><line>2</line></clef></attributes>
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>
  </measure></part>
</score-partwise>
`;

// Audiveris writes into a folder named after the input.
const bookDir = join(outDir, stem);
mkdirSync(bookDir, { recursive: true });

/** The smallest zip that holds one deflated file, which is what an .mxl is. */
function zipOf(name, content) {
  const data = Buffer.from(content, 'utf8');
  const deflated = deflateRawSync(data);
  const nameBytes = Buffer.from(name, 'utf8');
  const crc = crc32(data);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(0, 10);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(deflated.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  local.writeUInt16LE(0, 28);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(0, 12);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(deflated.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(0, 42);

  const localOffset = 0;
  const centralOffset = local.length + nameBytes.length + deflated.length;
  central.writeUInt32LE(localOffset, 42);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + nameBytes.length, 12);
  end.writeUInt32LE(centralOffset, 16);

  return Buffer.concat([local, nameBytes, deflated, central, nameBytes, end]);
}

function crc32(buffer) {
  let crc = ~0;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

switch (mode) {
  case 'export':
    writeFileSync(join(bookDir, `${stem}.xml`), SCORE);
    break;
  case 'twice':
    writeFileSync(join(bookDir, `${stem}.xml`), SCORE);
    writeFileSync(join(bookDir, `${stem}.mvt2.xml`), SCORE);
    break;
  case 'doctype':
    writeFileSync(
      join(bookDir, `${stem}.xml`),
      SCORE.replace(
        '<score-partwise',
        '<!DOCTYPE score-partwise SYSTEM "x.dtd"><score-partwise',
      ),
    );
    break;
  case 'mxl':
    writeFileSync(join(bookDir, `${stem}.mxl`), zipOf(`${stem}.xml`, SCORE));
    break;
  case 'nothing':
    break;
  case 'hang':
    setInterval(() => {}, 1000);
    break;
  default:
    process.exit(2);
}
