// ABOUT: Victorian explorer name generator for Gazette profile creation
// ABOUT: Produces plausible expedition-manifest names; includes "A. Anning" Easter egg

const TITLES = [
  'Dr.',
  'Prof.',
  'Captain',
  'Sir',
  'Rev.',
  'Lt.',
  'Col.',
  'Major',
  'Lady',
  'Dame',
]

const INITIALS = 'ABCDEFGHIJKLMNOPRSTW'.split('')

const SURNAMES = [
  'Agassiz', 'Anning', 'Ashworth', 'Attenborough',
  'Babington', 'Baird', 'Barclay', 'Barlow', 'Barrington', 'Blackwood',
  'Brightwell', 'Buckland', 'Buxton',
  'Cavendish', 'Challis', 'Chambers', 'Clift', 'Collingwood', 'Conybeare',
  'Dalton', 'Darwin', 'Dawson', 'Drayton',
  'Elton', 'Enderby', 'Esper',
  'Farrow', 'Fitch', 'Forbes', 'Forsythe', 'Franklin',
  'Gladstone', 'Grant', 'Gray', 'Greenwood',
  'Halcomb', 'Harcourt', 'Hartley', 'Harvey', 'Hawkins', 'Hooker', 'Huxley',
  'Ingram',
  'Jekyll', 'Jennings',
  'Kelvin', 'Kingsley', 'Kirby',
  'Lancaster', 'Lankester', 'Latham', 'Lowe', 'Lyell',
  'Marcet', 'Marsden', 'Masters', 'Murchison',
  'Nightingale', 'Norton',
  'Ogilvie', 'Owen',
  'Packard', 'Paley', 'Pennant', 'Plunkett', 'Prestwich',
  'Quelch',
  'Ramsbottom', 'Rawlinson', 'Ridley', 'Rolleston', 'Rosse',
  'Salter', 'Savery', 'Sedgwick', 'Solly', 'Stanhope', 'Stirling', 'Strutt',
  'Talbot', 'Tanner', 'Terrace', 'Trevelyan', 'Turton',
  'Underhill',
  'Vane', 'Verney',
  'Walcott', 'Wallace', 'Ward', 'Waterhouse', 'Whittaker', 'Wollaston', 'Woodward',
  'Yarrell', 'Yates',
]

/** Returns a seeded pseudo-random integer in [0, max). Not cryptographically secure. */
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return Math.abs(s) / 0x7fffffff
  }
}

/**
 * Generates a single Victorian-style explorer name.
 *
 * With no seed, uses Math.random for the sparkle button.
 * With a numeric seed, the output is deterministic — useful for tests.
 *
 * Easter egg: there is one chance in ~2000 of generating "A. Anning" exactly.
 */
export function generateExplorerName(seed?: number): string {
  const rand = seed !== undefined ? seededRandom(seed) : Math.random.bind(Math)

  // ~1-in-2000 Easter egg: honour the original
  if (rand() < 0.0005) return 'A. Anning'

  const title   = TITLES[Math.floor(rand() * TITLES.length)]
  const initial = INITIALS[Math.floor(rand() * INITIALS.length)]
  const surname = SURNAMES[Math.floor(rand() * SURNAMES.length)]

  return `${title} ${initial}. ${surname}`
}

/** Returns a fresh random name. Intended for the sparkle button. */
export function randomExplorerName(): string {
  return generateExplorerName()
}
