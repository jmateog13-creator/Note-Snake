// music.js — Font Única de Veritat per a les Dades Musicals

const DIATONIC  = ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si", "Do"];
const CHROMATIC = ["Do", "Do#", "Re", "Mib", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "Sib", "Si"];

// coloredNotes: false → totes les notes es veuen igual (gris), sense pista visual

const MUSIC_DATA = {
  campaign: [
    {
      level: 1,
      name: "Nivell 1: Escala Diatònica",
      sequences: [
        { scale: DIATONIC, speed: 160, trapCount: 2, coloredNotes: true }
      ]
    },
    {
      level: 2,
      name: "Nivell 2: Doble Passada",
      sequences: [
        { scale: DIATONIC, speed: 155, trapCount: 2, coloredNotes: true },
        { scale: DIATONIC, speed: 138, trapCount: 3, coloredNotes: true }
      ]
    },
    {
      level: 3,
      name: "Nivell 3: Triple Passada",
      sequences: [
        { scale: DIATONIC, speed: 138, trapCount: 3, coloredNotes: true },
        { scale: DIATONIC, speed: 118, trapCount: 4, coloredNotes: true },
        { scale: DIATONIC, speed: 100, trapCount: 5, coloredNotes: false }
      ]
    },
    {
      level: 4,
      name: "Nivell 4: El Caos Cromàtic",
      sequences: [
        { scale: CHROMATIC, speed: 112, trapCount: 3, coloredNotes: true }
      ]
    },
    {
      level: 5,
      name: "Nivell 5: Caos Doble",
      sequences: [
        { scale: CHROMATIC, speed: 108, trapCount: 3, coloredNotes: true },
        { scale: CHROMATIC, speed: 90,  trapCount: 4, coloredNotes: true }
      ]
    },
    {
      level: 6,
      name: "Nivell 6: Caos Triple",
      sequences: [
        { scale: CHROMATIC, speed: 105, trapCount: 3, coloredNotes: true },
        { scale: CHROMATIC, speed: 88,  trapCount: 4, coloredNotes: true },
        { scale: CHROMATIC, speed: 72,  trapCount: 5, coloredNotes: true }
      ]
    },
    {
      level: 7,
      name: "Nivell 7: ??? SORPRESA",
      sequences: [
        { scale: DIATONIC,  speed: 132, trapCount: 3, coloredNotes: true  },
        { scale: CHROMATIC, speed: 118, trapCount: 4, coloredNotes: true  },
        { scale: CHROMATIC, speed: 105, trapCount: 5, coloredNotes: true  },
        { scale: DIATONIC,  speed: 96,  trapCount: 5, coloredNotes: false },
        { scale: DIATONIC,  speed: 88,  trapCount: 5, coloredNotes: false }
      ]
    }
  ],
  allNotes: CHROMATIC,
  masterScales: {
    "Do Major":  ["Do", "Re", "Mi", "Fa", "Sol", "La", "Si", "Do"],
    "Sol Major": ["Sol", "La", "Si", "Do", "Re", "Mi", "Fa#", "Sol"],
    "Re Major":  ["Re", "Mi", "Fa#", "Sol", "La", "Si", "Do#", "Re"],
    "La Major":  ["La", "Si", "Do#", "Re", "Mi", "Fa#", "Sol#", "La"],
    "Mi Major":  ["Mi", "Fa#", "Sol#", "La", "Si", "Do#", "Re#", "Mi"],
    "Fa Major":  ["Fa", "Sol", "La", "Sib", "Do", "Re", "Mi", "Fa"],
    "La Menor":  ["La", "Si", "Do", "Re", "Mi", "Fa", "Sol", "La"],
    "Mi Menor":  ["Mi", "Fa#", "Sol", "La", "Si", "Do", "Re", "Mi"],
    "Re Menor":  ["Re", "Mi", "Fa", "Sol", "La", "Sib", "Do", "Re"]
  }
};

// Construeix una escala a partir de tònica + alteració + mode
function buildScale(root, alteration, mode) {
  const majorIntervals = [2, 2, 1, 2, 2, 2, 1];
  const minorIntervals = [2, 1, 2, 2, 1, 2, 2];
  const intervals = mode === "Major" ? majorIntervals : minorIntervals;

  const suffix = alteration === "Sostingut" ? "#" : alteration === "Bemoll" ? "b" : "";
  const rootNote = root + suffix;
  const all = MUSIC_DATA.allNotes;

  const enharmonic = {
    "Reb": "Do#", "Mib": "Mib", "Lab": "Sol#", "Sib": "Sib",
    "Re#": "Mib", "La#": "Sib", "Sol#": "Sol#", "Fa#": "Fa#"
  };

  let startIdx = all.indexOf(rootNote);
  if (startIdx === -1) startIdx = all.indexOf(enharmonic[rootNote]);
  if (startIdx === -1) startIdx = 0;

  const scale = [all[startIdx]];
  let cur = startIdx;
  for (const step of intervals) {
    cur = (cur + step) % 12;
    scale.push(all[cur]);
  }
  return scale;
}
