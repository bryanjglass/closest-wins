import { buildQuestions, type Row } from './build';

const AMPAS = 'Academy of Motion Picture Arts and Sciences (oscars.org)';
const DISNEY = 'The Walt Disney Company / D23 archives';
const NINTENDO = 'Nintendo company history (nintendo.com)';
const IBDB = 'Internet Broadway Database (ibdb.com) / The Broadway League';

const rows: Row[] = [
  // Movies
  ['In what year were the first Academy Awards held?', 1929, 'year', AMPAS],
  ['How many Oscars did "Ben-Hur" (1959) win?', 11, 'Oscars', AMPAS],
  ['How many Oscars did "The Lord of the Rings: The Return of the King" win?', 11, 'Oscars', AMPAS, { fact: 'It won every category it was nominated in.' }],
  ['How many competitive Academy Awards did Walt Disney win, more than anyone else?', 22, 'Oscars', AMPAS],
  ['How many Best Actress Oscars did Katharine Hepburn win, the record?', 4, 'Oscars', AMPAS],
  ['In what year was Disney\'s "The Lion King" released?', 1994, 'year', DISNEY],
  ['In what year was Disney\'s "Frozen" released?', 2013, 'year', DISNEY],
  ['In what year was the first "Star Wars" movie released?', 1977, 'year', 'Lucasfilm (starwars.com)'],
  ['In what year was "E.T. the Extra-Terrestrial" released?', 1982, 'year', 'Universal Pictures'],
  ['In what year was "The Wizard of Oz" starring Judy Garland released?', 1939, 'year', 'Warner Bros. / MGM'],
  ['In what year was Pixar\'s "Finding Nemo" released?', 2003, 'year', 'Pixar Animation Studios'],
  ['In what year was "Shrek" released?', 2001, 'year', 'DreamWorks Animation'],
  ['In what year was "Jaws" released?', 1975, 'year', 'Universal Pictures'],
  ['In "Back to the Future", how many miles per hour must the DeLorean reach to travel through time?', 88, 'mph', 'Universal Pictures, "Back to the Future" (1985)'],
  ['In "Back to the Future", how many gigawatts does the time machine need? (to two decimal places)', 1.21, 'gigawatts', 'Universal Pictures, "Back to the Future" (1985)'],
  ['In "Back to the Future", Marty McFly travels back to what year?', 1955, 'year', 'Universal Pictures, "Back to the Future" (1985)'],
  ['In "Back to the Future Part II", Marty and Doc travel to what future year?', 2015, 'year', 'Universal Pictures, "Back to the Future Part II" (1989)'],
  ['How many minutes long is "Avengers: Endgame"?', 181, 'minutes', 'Marvel Studios'],
  ['How many minutes long is the 1997 movie "Titanic"?', 194, 'minutes', 'Paramount Pictures / 20th Century Fox'],
  ['How many Harry Potter movies were made from the seven books?', 8, 'movies', 'Warner Bros. Pictures', { fact: 'The last book was split into two films.' }],
  ['How many Infinity Stones are there in the Marvel movies?', 6, 'stones', 'Marvel Studios'],
  ['How many Ghostbusters were on the original team in the 1984 movie?', 4, 'Ghostbusters', 'Columbia Pictures, "Ghostbusters" (1984)'],
  ['How many official James Bond films were made by Eon Productions through 2025?', 25, 'films', 'Eon Productions (007.com)'],
  ['What is James Bond\'s agent number, without the leading zeros?', 7, '', 'Ian Fleming, Casino Royale (1953)'],
  ['How many "Rocky" movies star Sylvester Stallone as Rocky (not counting the Creed films)?', 6, 'movies', 'MGM / United Artists'],
  ['How many Indiana Jones movies have been released?', 5, 'movies', 'Lucasfilm'],
  ['How many dwarfs are in Disney\'s "Snow White"?', 7, 'dwarfs', DISNEY],
  ['How many golden tickets does Willy Wonka hide in "Charlie and the Chocolate Factory"?', 5, 'tickets', 'Roald Dahl, Charlie and the Chocolate Factory (1964)'],
  ['In Jules Verne\'s famous novel, Phileas Fogg bets he can travel around the world in how many days?', 80, 'days', 'Jules Verne, Around the World in Eighty Days (1872)'],

  // Books & stories
  ['At what age does Harry Potter find out he is a wizard?', 11, 'years old', 'J.K. Rowling, Harry Potter and the Philosopher\'s Stone'],
  ['The Hogwarts Express leaves from Platform Nine and what? Answer as a decimal number (to two decimal places)', 9.75, '', 'J.K. Rowling, Harry Potter and the Philosopher\'s Stone', { hint: 'A fraction of the way between platforms 9 and 10…' }],
  ['How many books are in C.S. Lewis\'s "The Chronicles of Narnia"?', 7, 'books', 'HarperCollins, The Chronicles of Narnia'],
  ['In "The Hunger Games", how many districts are there in Panem (not counting the destroyed one)?', 12, 'districts', 'Suzanne Collins, The Hunger Games (2008)'],
  ['At what number on Baker Street does Sherlock Holmes live (without the letter)?', 221, '', 'Arthur Conan Doyle, A Study in Scarlet (1887)'],
  ['What number Conch Street is SpongeBob SquarePants\'s pineapple house?', 124, '', 'Nickelodeon, "SpongeBob SquarePants"'],
  ['How many syllables are in a traditional haiku?', 17, 'syllables', 'Academy of American Poets (poets.org)'],
  ['How many lines are in a limerick?', 5, 'lines', 'Academy of American Poets (poets.org)'],

  // TV
  ['How many seasons of "Seinfeld" were made?', 9, 'seasons', 'NBC / Sony Pictures Television'],
  ['How many seasons of the US version of "The Office" were made?', 9, 'seasons', 'NBC / Universal Television'],
  ['How many seasons of "M*A*S*H" were made?', 11, 'seasons', 'CBS / 20th Century Fox Television', { fact: 'The show lasted much longer than the Korean War itself.' }],
  ['In what year did the final episode of "M*A*S*H" air, still one of the most-watched broadcasts ever?', 1983, 'year', 'CBS / Nielsen'],
  ['In what year did "Sesame Street" first air?', 1969, 'year', 'Sesame Workshop'],
  ['How many children are in "The Brady Bunch" family?', 6, 'kids', 'Paramount Television, "The Brady Bunch"'],
  ['How many castaways are stranded on "Gilligan\'s Island"?', 7, 'castaways', 'CBS, "Gilligan\'s Island"'],
  ['How old is Bart Simpson?', 10, 'years old', 'FOX, "The Simpsons"'],
  ['How many wedges are on the "Wheel of Fortune" wheel?', 24, 'wedges', 'Sony Pictures Television, "Wheel of Fortune"'],
  ['How many categories are on the board in each regular round of "Jeopardy!"?', 6, 'categories', 'Sony Pictures Television, "Jeopardy!"'],
  ['In 2004, Ken Jennings set the record for consecutive "Jeopardy!" wins. How many games did he win in a row?', 74, 'games', 'Sony Pictures Television, "Jeopardy!"'],
  ['How many sections are on the Showcase Showdown wheel on "The Price Is Right"?', 20, 'sections', 'CBS, "The Price Is Right"'],
  ['On the original "Who Wants to Be a Millionaire?", how many questions did you have to answer to win the top prize?', 15, 'questions', 'ABC / Celador, original format'],
  ['In what year did MTV first go on the air?', 1981, 'year', 'Paramount Global (MTV)'],

  // Music & theatre
  ['How many symphonies did Ludwig van Beethoven complete?', 9, 'symphonies', 'Encyclopaedia Britannica, "Ludwig van Beethoven"'],
  ['How old was Wolfgang Amadeus Mozart when he died?', 35, 'years old', 'Encyclopaedia Britannica, "Wolfgang Amadeus Mozart"'],
  ['How many semitones (half steps) are in one octave?', 12, 'semitones', 'Standard Western music theory'],
  ['How many lines are in a standard musical staff?', 5, 'lines', 'Standard Western music notation'],
  ['How many strings does a standard guitar have?', 6, 'strings', 'Standard six-string guitar'],
  ['How many strings does a standard ukulele have?', 4, 'strings', 'Standard ukulele (G-C-E-A)'],
  ['How many strings does a standard bluegrass banjo have?', 5, 'strings', 'Standard five-string banjo'],
  ['How many valves does a standard trumpet have?', 3, 'valves', 'Standard B♭ trumpet'],
  ['How many songs by The Beatles reached No. 1 on the US Billboard Hot 100?', 20, 'songs', 'Billboard, The Beatles chart history', { fact: 'The most of any act.' }],
  ['How many members were in the Spice Girls?', 5, 'members', 'Spice Girls official site'],
  ['How many Tony Awards did "Hamilton" win in 2016?', 11, 'Tonys', 'The Tony Awards (tonyawards.com)'],
  ['How many Broadway performances did "The Phantom of the Opera" give before it closed in 2023, the longest run in Broadway history?', 13981, 'performances', IBDB],
  ['How many Broadway performances did the original production of "Cats" give (1982–2000)?', 7485, 'performances', IBDB],

  // Theme parks
  ['In what year did Disneyland open in California?', 1955, 'year', DISNEY],
  ['In what year did Walt Disney World open in Florida?', 1971, 'year', DISNEY],

  // Video games & tech
  ['In what year did Mario first appear in a video game ("Donkey Kong")?', 1981, 'year', NINTENDO],
  ['In what year was the arcade game "Pac-Man" released?', 1980, 'year', 'Bandai Namco Entertainment'],
  ['In what year was "Tetris" created by Alexey Pajitnov?', 1984, 'year', 'The Tetris Company'],
  ['In what year was the full version of "Minecraft" released?', 2011, 'year', 'Mojang Studios'],
  ['In what year did Sonic the Hedgehog debut?', 1991, 'year', 'SEGA company history (sega.com)'],
  ['In what year was Nintendo founded (as a playing-card company)?', 1889, 'year', NINTENDO],
  ['In what year was the first Game Boy released in Japan?', 1989, 'year', NINTENDO],
  ['In what year was "Super Mario 64" released?', 1996, 'year', NINTENDO],
  ['In what year were the first Pokémon games released in Japan?', 1996, 'year', 'The Pokémon Company'],
  ['How many ghosts chase Pac-Man in the original arcade game?', 4, 'ghosts', 'Bandai Namco Entertainment', { fact: 'Blinky, Pinky, Inky and Clyde.' }],
  ['What is the highest possible score in the original "Pac-Man" arcade game?', 3333360, 'points', 'Twin Galaxies / Guinness World Records'],
  ['How many Pokémon types are there in the main games today?', 18, 'types', 'The Pokémon Company (pokemon.com)'],
  ['How many gym badges do you need to collect in Pokémon Red and Blue?', 8, 'badges', 'The Pokémon Company'],
  ['In what year was YouTube founded?', 2005, 'year', 'YouTube official blog'],
  ['In what year was Google founded?', 1998, 'year', 'Google, "Our story"'],
];

export const ENTERTAINMENT_QUESTIONS = buildQuestions('entertainment', 'xen', rows);
