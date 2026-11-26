import { buildQuestions, type Row } from './build';

const NIST = 'NIST Handbook 44, Appendix C (US customary units)';
const MATH = 'Arithmetic';
const CAL = 'Gregorian calendar';

const rows: Row[] = [
  // Units & measures
  ['How many feet are in one mile?', 5280, 'ft', NIST],
  ['How many yards are in one mile?', 1760, 'yards', NIST],
  ['How many inches are in one yard?', 36, 'in', NIST],
  ['How many centimeters are in one inch? (to two decimal places)', 2.54, 'cm', NIST, { fact: 'Exactly 2.54 — by international agreement since 1959.' }],
  ['How many kilometers are in one mile? (to two decimal places)', 1.61, 'km', NIST],
  ['How many fluid ounces are in one US gallon?', 128, 'fl oz', NIST],
  ['How many cups are in one US gallon?', 16, 'cups', NIST],
  ['How many teaspoons are in one tablespoon?', 3, 'teaspoons', NIST],
  ['How many ounces are in one pound?', 16, 'oz', NIST],
  ['How many pounds are in one US (short) ton?', 2000, 'lb', NIST],
  ['How many liters are in one US gallon? (to two decimal places)', 3.79, 'liters', NIST],
  ['How many pounds are in one kilogram? (to one decimal place)', 2.2, 'lb', NIST],
  ['How many things are in a "baker\'s dozen"?', 13, '', 'Merriam-Webster, "baker\'s dozen"'],
  ['How many things are in a "gross"?', 144, '', 'Merriam-Webster, "gross"', { fact: 'A gross is a dozen dozens.' }],
  ['How many years is "four score and seven", as in Lincoln\'s Gettysburg Address?', 87, 'years', 'Library of Congress, Gettysburg Address', { fact: 'A "score" is 20.' }],
  ['How many zeros follow the 1 in a googol?', 100, 'zeros', 'Merriam-Webster, "googol"'],
  ['How many zeros are in one trillion (US)?', 12, 'zeros', MATH],

  // Time
  ['How many seconds are in one hour?', 3600, 'seconds', MATH],
  ['How many minutes are in one day?', 1440, 'minutes', MATH],
  ['How many hours are in one week?', 168, 'hours', MATH],
  ['How many seconds are in one week?', 604800, 'seconds', MATH],
  ['How many seconds are in a non-leap year?', 31536000, 'seconds', MATH],
  ['How many days are in a leap year?', 366, 'days', CAL],
  ['How many full weeks are in one year?', 52, 'weeks', CAL],
  ['How many months of the year have 31 days?', 7, 'months', CAL],
  ['How many times does the hour hand go all the way around a 12-hour clock in one day?', 2, 'times', MATH],

  // Shapes & numbers
  ['How many sides does a dodecagon have?', 12, 'sides', 'Merriam-Webster, "dodecagon"'],
  ['How many sides does a heptagon have?', 7, 'sides', 'Merriam-Webster, "heptagon"'],
  ['How many faces does an icosahedron have?', 20, 'faces', 'Encyclopaedia Britannica, "Platonic solid"'],
  ['How many edges does a cube have?', 12, 'edges', 'Encyclopaedia Britannica, "cube"'],
  ['How many corners (vertices) does a cube have?', 8, 'corners', 'Encyclopaedia Britannica, "cube"'],
  ['What do the inside angles of a pentagon add up to, in degrees?', 540, 'degrees', 'Geometry: (5 − 2) × 180°'],
  ['What do the inside angles of a hexagon add up to, in degrees?', 720, 'degrees', 'Geometry: (6 − 2) × 180°'],
  ['What is pi to two decimal places?', 3.14, '', 'Mathematical constant π = 3.14159…'],
  ['What is 2 to the 10th power (ten 2s multiplied together)?', 1024, '', MATH],
  ['What is 2 to the 20th power?', 1048576, '', MATH],
  ['What is 11 × 11?', 121, '', MATH],
  ['What is 5 factorial (5 × 4 × 3 × 2 × 1)?', 120, '', MATH],
  ['What do you get if you add up every whole number from 1 to 10?', 55, '', MATH],
  ['How many prime numbers are there below 20?', 8, 'primes', 'Mathematics: 2, 3, 5, 7, 11, 13, 17, 19'],
  ['How many times does the digit 9 appear when you write out every number from 1 to 100?', 20, 'times', MATH, { hint: "It's more than 10!" }],
  ['If 10 people each shake hands with everyone else exactly once, how many handshakes is that?', 45, 'handshakes', 'Combinatorics: 10 × 9 ÷ 2'],
  ['How many people need to be in a room for there to be a better-than-even chance that two share a birthday?', 23, 'people', 'The "birthday problem" in probability theory', { hint: 'Fewer than you think!' }],
  ['How many squares of any size (1×1 up to 8×8) can you find on a chessboard?', 204, 'squares', 'Mathematics: 1² + 2² + … + 8²', { hint: 'Way more than 64!' }],
  ['How many different results are possible when you roll two six-sided dice (counting which die is which)?', 36, 'results', 'Probability: 6 × 6'],
  ['What do all the dots on a full double-six set of dominoes add up to?', 168, 'dots', 'Arithmetic: each number from 0 to 6 appears 8 times'],
  ['What do all the numbers on a roulette wheel (0 to 36) add up to?', 666, '', 'Arithmetic: 0 + 1 + … + 36'],
  ['How many pockets are on a European roulette wheel?', 37, 'pockets', 'Standard single-zero roulette wheel'],
  ['What do all the numbers around a standard dartboard add up to?', 210, '', 'Arithmetic: 1 + 2 + … + 20'],
  ['How many winning lines (rows, columns and diagonals) are there in tic-tac-toe?', 8, 'lines', 'Game of tic-tac-toe'],
  ['How many face cards (jacks, queens and kings) are in a standard deck?', 12, 'cards', 'Standard 52-card deck'],
  ['What number is the Roman numeral MCMLXXXIV?', 1984, 'year', 'Roman numerals: M + CM + L + XXX + IV'],
  ['What number is the Roman numeral MDCCLXXVI?', 1776, 'year', 'Roman numerals: M + D + CC + L + XX + V + I'],

  // Words, letters & codes
  ['How many letters are in the English alphabet?', 26, 'letters', 'Oxford English Dictionary'],
  ['How many letters are in the Greek alphabet?', 24, 'letters', 'Encyclopaedia Britannica, "Greek alphabet"'],
  ['How many letters are in the modern Russian alphabet?', 33, 'letters', 'Encyclopaedia Britannica, "Russian alphabet"'],
  ['How many letters are in the Hawaiian alphabet?', 13, 'letters', 'University of Hawaiʻi, Hawaiian language', { fact: 'Five vowels, seven consonants and the ʻokina.' }],
  ['How many letters are in "supercalifragilisticexpialidocious"?', 34, 'letters', 'Merriam-Webster; Walt Disney\'s "Mary Poppins" (1964)'],
  ['How many letters are in "Massachusetts"?', 13, 'letters', 'Spelling'],
  ['"Typewriter" is famous for being one of the longest words you can type using only the top row of a keyboard. How many letters is it?', 10, 'letters', 'Spelling'],
  ['How many raised dots make up a full Braille cell?', 6, 'dots', 'National Federation of the Blind, "What is Braille?"'],
  ['How many bits are in one byte?', 8, 'bits', 'IEC 80000-13'],
  ['How many different values can a single byte hold?', 256, 'values', 'Computer science: 2⁸'],
  ['What is the ASCII code number for the capital letter A?', 65, '', 'ANSI X3.4 (ASCII) character table'],
  ['How many points are on a traditional mariner\'s compass rose?', 32, 'points', 'Encyclopaedia Britannica, "Compass card"'],
  ['How many digits are in a standard US phone number, including the area code?', 10, 'digits', 'North American Numbering Plan Administrator'],
  ['How many digits are in a basic US ZIP code?', 5, 'digits', 'USPS, ZIP Code history'],

  // Everyday oddities
  ['How many nickels make one US dollar?', 20, 'nickels', MATH],
  ['How many quarters are in $10?', 40, 'quarters', MATH],
  ['How many stripes are on the US flag?', 13, 'stripes', 'US Code, Title 4, Chapter 1'],
  ['How many inches across is a standard US quarter? (to two decimal places)', 0.96, 'in', 'United States Mint, coin specifications (24.26 mm)'],
  ['How many corner pieces does a standard 3×3 Rubik\'s Cube have?', 8, 'pieces', 'Rubik\'s Brand Ltd.'],
  ['How many edge pieces does a standard 3×3 Rubik\'s Cube have?', 12, 'pieces', 'Rubik\'s Brand Ltd.'],
  ['How many degrees are in a full circle?', 360, 'degrees', 'Geometry'],
  ['How many years are in a millennium?', 1000, 'years', 'Merriam-Webster, "millennium"'],
  ['How many hours are in the month of February in a non-leap year?', 672, 'hours', 'Arithmetic: 28 × 24'],
  ['How many time zones cover the 48 contiguous US states?', 4, 'time zones', 'US Department of Transportation, time zones'],
  ['How many letters in the English alphabet are vowels (not counting Y)?', 5, 'vowels', 'Oxford English Dictionary'],
];

export const WEIRD_QUESTIONS = buildQuestions('weird', 'xwf', rows);
