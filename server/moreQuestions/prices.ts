import { buildQuestions, type Row } from './build';

const MONOPOLY = 'Hasbro, Monopoly (standard US edition) rules and title deeds';
const USPS = 'USPS, "Rates for Domestic Letters Since 1863"';
const DOL = 'US Department of Labor, "History of Federal Minimum Wage Rates"';
const MINT = 'United States Mint, coin specifications';

const rows: Row[] = [
  // Monopoly
  ['In the standard US edition of Monopoly, how much does Mediterranean Avenue cost to buy?', 60, '$', MONOPOLY],
  ['In the standard US edition of Monopoly, how much does Oriental Avenue cost to buy?', 100, '$', MONOPOLY],
  ['In the standard US edition of Monopoly, how much does St. Charles Place cost to buy?', 140, '$', MONOPOLY],
  ['In the standard US edition of Monopoly, how much does Virginia Avenue cost to buy?', 160, '$', MONOPOLY],
  ['In the standard US edition of Monopoly, how much does New York Avenue cost to buy?', 200, '$', MONOPOLY],
  ['In the standard US edition of Monopoly, how much does Kentucky Avenue cost to buy?', 220, '$', MONOPOLY],
  ['In the standard US edition of Monopoly, how much does Illinois Avenue cost to buy?', 240, '$', MONOPOLY],
  ['In the standard US edition of Monopoly, how much does Atlantic Avenue cost to buy?', 260, '$', MONOPOLY],
  ['In the standard US edition of Monopoly, how much does Marvin Gardens cost to buy?', 280, '$', MONOPOLY],
  ['In the standard US edition of Monopoly, how much does Pacific Avenue cost to buy?', 300, '$', MONOPOLY],
  ['In the standard US edition of Monopoly, how much does Pennsylvania Avenue cost to buy?', 320, '$', MONOPOLY],
  ['In the standard US edition of Monopoly, how much does Park Place cost to buy?', 350, '$', MONOPOLY],
  ['In the standard US edition of Monopoly, how much does a railroad (like Reading Railroad) cost to buy?', 200, '$', MONOPOLY],
  ['In the standard US edition of Monopoly, how much does the Electric Company cost to buy?', 150, '$', MONOPOLY],
  ['In the standard US edition of Monopoly, how much is the rent on Mediterranean Avenue with no houses?', 2, '$', MONOPOLY],
  ['In the standard US edition of Monopoly, how much is the rent on Boardwalk with no houses?', 50, '$', MONOPOLY],
  ['In the standard US edition of Monopoly, how much does it cost to build one house on Boardwalk?', 200, '$', MONOPOLY],
  ['In Monopoly, how much do you pay to get out of jail?', 50, '$', MONOPOLY],
  ['How many plastic houses come in a standard Monopoly set?', 32, 'houses', MONOPOLY, { fact: 'There are also 12 hotels.' }],
  ['How many property title deed cards are in a standard Monopoly set (streets, railroads and utilities)?', 28, 'cards', MONOPOLY],

  // Games & toys
  ['How many cards are in a standard deck of playing cards, not counting jokers?', 52, 'cards', 'Standard French-suited 52-card deck'],
  ['How many wooden blocks come in a standard Jenga set?', 54, 'blocks', 'Hasbro, Jenga product description'],
  ['How many holes (slots) are in the grid of a standard Connect 4 game?', 42, 'slots', 'Hasbro, Connect 4 rules (6 rows × 7 columns)'],
  ['How many tiles are in a standard double-six set of dominoes?', 28, 'tiles', 'Standard double-six domino set'],
  ['In backgammon, how many checkers does each player start with?', 15, 'checkers', 'US Backgammon Federation, rules'],
  ['How many pieces does each player start with in checkers?', 12, 'pieces', 'World Checkers/Draughts Federation, rules'],
  ['In English-language Scrabble, how many points is the letter K worth?', 5, 'points', 'Hasbro, official Scrabble rules'],
  ['How many E tiles come in a standard English-language Scrabble set?', 12, 'tiles', 'Hasbro, official Scrabble letter distribution'],
  ['How many squares are on a standard Scrabble board?', 225, 'squares', 'Hasbro, Scrabble board (15 × 15)'],
  ['How many rooms are on the board in the classic game of Clue?', 9, 'rooms', 'Hasbro, classic Clue rules'],
  ['In classic Battleship, how many squares does one player\'s whole fleet cover in total?', 17, 'squares', 'Hasbro, Battleship rules (ships of 5, 4, 3, 3 and 2)'],
  ['How many letter cubes come in the classic 4×4 Boggle game?', 16, 'cubes', 'Hasbro, classic Boggle'],
  ['How many colored circles are on a standard Twister mat?', 24, 'circles', 'Hasbro, Twister mat (4 colors × 6)'],
  ['In US-style bingo, how many numbered balls are there?', 75, 'balls', 'Standard US 75-ball bingo'],
  ['On a standard dartboard, how many points is the inner bullseye worth?', 50, 'points', 'World Darts Federation, dartboard specifications'],
  ['In darts, what is the highest score possible with three darts?', 180, 'points', 'World Darts Federation rules (three treble 20s)'],
  ['In Yahtzee, how many points is a Yahtzee (five of a kind) worth the first time you score it?', 50, 'points', 'Hasbro, official Yahtzee rules'],
  ['In Yahtzee, how many points is a large straight worth?', 40, 'points', 'Hasbro, official Yahtzee rules'],
  ['How many small squares are in a standard Sudoku grid?', 81, 'squares', 'Standard 9 × 9 Sudoku'],
  ['How many different answers can a classic Magic 8 Ball give?', 20, 'answers', 'Mattel, Magic 8 Ball'],
  ['How many studs are on top of a classic 2×4 LEGO brick?', 8, 'studs', 'The LEGO Group, brick dimensions'],

  // Video game consoles & gadgets (US launch prices)
  ['What was the US launch price of the original Microsoft Xbox in November 2001?', 299, '$', 'Microsoft press release, 2001'],
  ['What was the US launch price of the Nintendo 64 in September 1996?', 199.99, '$', 'Nintendo of America, 1996 launch announcement'],
  ['What was the US launch price of the PlayStation 2 in October 2000?', 299, '$', 'Sony Computer Entertainment America, 2000 launch'],
  ['What was the US launch price of the PlayStation 4 in November 2013?', 399, '$', 'Sony press release, E3 2013'],
  ['What was the US launch price of the standard (disc) PlayStation 5 in November 2020?', 499, '$', 'Sony Interactive Entertainment, September 16, 2020'],
  ['What was the US launch price of the Xbox One in November 2013?', 499, '$', 'Microsoft press release, E3 2013'],
  ['What was the US launch price of the Xbox Series X in November 2020?', 499, '$', 'Microsoft Xbox Wire, September 9, 2020'],
  ['What was the US launch price of the original Nintendo DS in November 2004?', 149.99, '$', 'Nintendo of America press release, 2004'],
  ['What was the US launch price of the Nintendo 3DS in March 2011?', 249.99, '$', 'Nintendo of America press release, January 2011'],
  ['What was the US launch price of the Nintendo Switch Lite in September 2019?', 199.99, '$', 'Nintendo of America press release, July 2019'],
  ['What was the US launch price of the Nintendo Switch OLED Model in October 2021?', 349.99, '$', 'Nintendo of America press release, July 2021'],
  ['What was the US launch price of the Nintendo Switch 2 in June 2025?', 449.99, '$', 'Nintendo of America, Nintendo Switch 2 Direct, April 2025'],
  ['What was the US launch price of the basic Wii U in November 2012?', 299.99, '$', 'Nintendo of America press release, September 2012'],
  ['What was the US launch price of the Sega Genesis in 1989?', 189.99, '$', 'Sega of America, 1989 launch'],
  ['What was the price of the 64 GB Steam Deck when it launched in 2022?', 399, '$', 'Valve, Steam Deck announcement, July 2021'],
  ['What was the price of the very first Apple iPod when it launched in October 2001?', 399, '$', 'Apple press release, October 23, 2001'],
  ['What was the starting price of the original iPad (16 GB, Wi-Fi) in 2010?', 499, '$', 'Apple press release, January 27, 2010'],
  ['What was the price of the Apple I computer when it went on sale in 1976?', 666.66, '$', 'Apple history; Computer History Museum', { fact: 'Steve Wozniak said he just liked repeating digits.' }],
  ['What was the price of an Apple II with 4 KB of memory when it launched in 1977?', 1298, '$', 'Apple II launch advertising; Computer History Museum'],
  ['What was the price of the 8 GB iPhone 3G (with a two-year contract) when it launched in July 2008?', 199, '$', 'Apple press release, June 9, 2008'],
  ['What was the starting price of the first Apple Watch (Sport, 38 mm) in 2015?', 349, '$', 'Apple press release, March 9, 2015'],
  ['What was the price of the very first Amazon Kindle when it launched in November 2007?', 399, '$', 'Amazon press release, November 19, 2007'],

  // Postage
  ['How much did it cost to mail a one-ounce first-class letter in the US in 1950?', 0.03, '$', USPS],
  ['How much did it cost to mail a one-ounce first-class letter in the US in 1960?', 0.04, '$', USPS],
  ['How much did it cost to mail a one-ounce first-class letter in the US in 1980?', 0.15, '$', USPS],
  ['How much did it cost to mail a one-ounce first-class letter in the US in 1990?', 0.25, '$', USPS],
  ['How much did it cost to mail a one-ounce first-class letter in the US in 2000?', 0.33, '$', USPS],
  ['How much did it cost to mail a one-ounce first-class letter in the US in 2010?', 0.44, '$', USPS],
  ['How much did it cost to mail a one-ounce first-class letter in the US in 2020?', 0.55, '$', USPS],

  // Minimum wage
  ['What was the US federal minimum wage per hour in 1960?', 1, '$', DOL],
  ['What was the US federal minimum wage per hour in 1970?', 1.6, '$', DOL],
  ['What was the US federal minimum wage per hour in 1985?', 3.35, '$', DOL],
  ['What was the US federal minimum wage per hour in 2000?', 5.15, '$', DOL],
  ['What has the US federal minimum wage been per hour since July 2009?', 7.25, '$', DOL],

  // Money & everyday products
  ['How many grams does a US nickel weigh?', 5, 'g', MINT],
  ['How many grams does a US quarter weigh? (to two decimal places)', 5.67, 'g', MINT],
  ['What is the largest denomination of US paper money ever printed (used only between Federal Reserve Banks)?', 100000, '$', 'US Bureau of Engraving and Printing, "The $100,000 Gold Certificate"'],
  ['What is the largest denomination of US paper money ever issued to the public?', 10000, '$', 'Federal Reserve, "What denominations of currency are there?"'],
  ['What percentage of US paper money is cotton (the rest is linen)?', 75, '%', 'US Bureau of Engraving and Printing, "Money Facts"'],
  ['How many sheets of paper are in a standard ream?', 500, 'sheets', 'Paper industry standard'],
  ['How many volts does a standard AA battery provide?', 1.5, 'volts', 'Duracell / Energizer product specifications'],
  ['How many inches wide is a standard US letter-size sheet of paper?', 8.5, 'in', 'ANSI paper sizes (8.5 × 11 in)'],
  ['How many millimeters tall is a sheet of A4 paper?', 297, 'mm', 'ISO 216 (A4 is 210 × 297 mm)'],
  ['How many millimeters wide is a standard credit card? (to two decimal places)', 85.6, 'mm', 'ISO/IEC 7810 ID-1 card format (85.60 × 53.98 mm)', { p: 2 }],
  ['How many fluid ounces are in a standard US soda can?', 12, 'fl oz', 'US beverage industry standard 355 mL can'],
  ['How many digits are in the number on a standard Visa credit card?', 16, 'digits', 'ISO/IEC 7812 card numbering; Visa'],
  ['How many digits are in a standard UPC barcode on US products?', 12, 'digits', 'GS1 US, UPC-A barcode'],
];

export const PRICE_QUESTIONS = buildQuestions('prices', 'xpr', rows);
