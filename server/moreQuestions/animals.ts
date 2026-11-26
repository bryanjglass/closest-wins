import { buildQuestions, type Row } from './build';

const NASA = 'NASA Science, planetary fact sheets (science.nasa.gov)';
const SDZ = 'San Diego Zoo Wildlife Alliance, animal fact sheets';
const NCI = 'National Cancer Institute SEER Training, skeletal system';
const IUPAC = 'IUPAC, Periodic Table of the Elements';

const rows: Row[] = [
  // Animals
  ['How many legs does a spider have?', 8, 'legs', 'Smithsonian Institution, "Spiders"'],
  ['How many legs does an adult insect have?', 6, 'legs', 'Smithsonian Institution, "Insects"'],
  ['How many humps does a Bactrian camel have?', 2, 'humps', SDZ],
  ['How many toes does a typical house cat have in total (front and back paws)?', 18, 'toes', 'Cornell Feline Health Center', { fact: 'Five on each front paw and four on each back paw.' }],
  ['How many teeth does an adult pig have?', 44, 'teeth', 'Merck Veterinary Manual, dental anatomy of pigs'],
  ['How many chambers does a fish\'s heart have?', 2, 'chambers', 'Encyclopaedia Britannica, "Heart: fishes"'],
  ['How many chambers does a frog\'s heart have?', 3, 'chambers', 'Encyclopaedia Britannica, "Heart: amphibians"'],
  ['How many eyes do most spiders have?', 8, 'eyes', 'Australian Museum, "Spiders: eyes"'],
  ['How many life stages does a butterfly go through (egg to adult)?', 4, 'stages', 'Smithsonian Institution, "Butterflies"', { fact: 'Egg, caterpillar, chrysalis and adult.' }],
  ['How many wings does a honeybee have?', 4, 'wings', 'Penn State Extension, honeybee anatomy'],
  ['How many wings does a housefly have?', 2, 'wings', 'Encyclopaedia Britannica, "Diptera" (true flies)'],
  ['How many sides does each cell of a honeycomb have?', 6, 'sides', 'Penn State Extension, honeybee biology'],
  ['How many true (jointed) legs does a caterpillar have?', 6, 'legs', 'Smithsonian Institution, "Caterpillars"', { fact: 'The stubby "prolegs" further back are not true legs.' }],
  ['How many arms does an octopus have?', 8, 'arms', 'Smithsonian Ocean, "Octopuses"'],
  ['How many toes does an ostrich have on each foot?', 2, 'toes', SDZ, { fact: 'Ostriches are the only birds with just two toes.' }],
  ['About how many degrees can an owl turn its head?', 270, 'degrees', 'Johns Hopkins Medicine, owl head-rotation study (2013)'],
  ['In 2021, scientists found a millipede (Eumillipes persephone) with more legs than any animal ever recorded. How many legs did it have?', 1306, 'legs', 'Marek et al., Scientific Reports, December 2021'],
  ['How many teats does a dairy cow have?', 4, 'teats', 'Penn State Extension, dairy cow anatomy'],
  ['About how many months is a horse pregnant?', 11, 'months', 'American Association of Equine Practitioners'],
  ['About how many days is a dog pregnant?', 63, 'days', 'American Kennel Club, "Dog pregnancy"'],
  ['About how many months is a giraffe pregnant?', 15, 'months', SDZ],
  ['A typical human pregnancy is counted as how many weeks?', 40, 'weeks', 'American College of Obstetricians and Gynecologists'],
  ['How many inches is one "hand", the unit used to measure a horse\'s height?', 4, 'in', 'American Quarter Horse Association'],

  // Human body
  ['How many baby (primary) teeth does a child usually have?', 20, 'teeth', 'American Dental Association, MouthHealthy'],
  ['How many chambers does the human heart have?', 4, 'chambers', 'National Heart, Lung, and Blood Institute'],
  ['How many bones are in one human hand (including the wrist)?', 27, 'bones', NCI],
  ['How many bones are in one human foot (including the ankle)?', 26, 'bones', NCI],
  ['How many bones make up the human skull?', 22, 'bones', NCI],
  ['How many ribs does a typical human have?', 24, 'ribs', NCI],
  ['How many tiny bones are in each human middle ear?', 3, 'bones', 'National Institute on Deafness and Other Communication Disorders'],
  ['How many lobes do a person\'s two lungs have in total?', 5, 'lobes', 'American Lung Association', { fact: 'Three on the right and two on the left, to make room for the heart.' }],
  ['What is the traditional "normal" human body temperature in °F?', 98.6, '°F', 'Carl Wunderlich (1868); Cleveland Clinic'],

  // Earth
  ['About what percentage of Earth\'s surface is covered by water?', 71, '%', 'US Geological Survey, Water Science School'],
  ['How many named oceans are there on Earth?', 5, 'oceans', 'NOAA, "How many oceans are there?"'],
  ['How many kilometers is Earth\'s diameter at the equator?', 12756, 'km', NASA],
  ['How many kilometers around is Earth at the equator?', 40075, 'km', NASA],
  ['By how many degrees is Earth\'s axis tilted? (to one decimal place)', 23.4, 'degrees', NASA],
  ['About how many billion years old is Earth? (to one decimal place)', 4.5, 'billion years', 'US Geological Survey, "Age of the Earth"'],
  ['How many standard time zones is the world divided into?', 24, 'time zones', 'Royal Museums Greenwich, time zones'],
  ['What is the magnitude of the strongest earthquake ever recorded (Chile, 1960)?', 9.5, 'magnitude', 'US Geological Survey, "Largest earthquakes in the world"'],
  ['How many meters tall is Mount Kilimanjaro, Africa\'s highest mountain?', 5895, 'm', 'Tanzania National Parks'],
  ['How many feet tall is Denali in Alaska, North America\'s highest peak (2015 survey)?', 20310, 'ft', 'US Geological Survey / NOAA, 2015 survey'],
  ['How many meters tall is Angel Falls in Venezuela, the world\'s tallest waterfall?', 979, 'm', 'Canaima National Park (UNESCO World Heritage Centre)'],
  ['About how many kilometers long is Australia\'s Great Barrier Reef?', 2300, 'km', 'Great Barrier Reef Marine Park Authority'],
  ['How many feet tall is the General Sherman Tree, the largest tree on Earth by volume?', 275, 'ft', 'National Park Service, Sequoia & Kings Canyon'],
  ['About what percentage of Antarctica is covered by ice?', 98, '%', 'National Snow and Ice Data Center'],
  ['About how many degrees Fahrenheit can a lightning bolt heat the air to?', 50000, '°F', 'NOAA National Weather Service, lightning science'],
  ['How many colors are traditionally named in a rainbow?', 7, 'colors', 'Isaac Newton, Opticks (1704)'],
  ['At what temperature in degrees Fahrenheit does water freeze?', 32, '°F', 'US Geological Survey, Water Science School'],
  ['What is absolute zero in degrees Celsius? (to two decimal places)', -273.15, '°C', 'International Bureau of Weights and Measures (BIPM), SI Brochure', { hint: 'Negative numbers allowed!' }],
  ['What is absolute zero in degrees Fahrenheit? (to two decimal places)', -459.67, '°F', 'National Institute of Standards and Technology', { hint: 'Negative numbers allowed!' }],

  // Chemistry
  ['How many elements are on the periodic table?', 118, 'elements', IUPAC],
  ['What is the atomic number of gold?', 79, '', IUPAC],
  ['What is the atomic number of iron?', 26, '', IUPAC],
  ['What is the atomic number of oxygen?', 8, '', IUPAC],
  ['What is the atomic number of helium?', 2, '', IUPAC],
  ['What is the atomic number of silver?', 47, '', IUPAC],
  ['What is the atomic number of uranium?', 92, '', IUPAC],
  ['How many atoms are in one molecule of water?', 3, 'atoms', 'Two hydrogen atoms and one oxygen atom (H₂O)'],

  // Space
  ['How many planets are in our solar system?', 8, 'planets', NASA],
  ['How many Earth days does Venus take to orbit the Sun?', 225, 'days', NASA],
  ['How many Earth days does Mercury take to orbit the Sun?', 88, 'days', NASA],
  ['About how many Earth years does Neptune take to orbit the Sun?', 165, 'years', NASA],
  ['How many kilometers wide is the Moon (its diameter)?', 3475, 'km', NASA],
  ['On average, about how many million miles is Earth from the Sun?', 93, 'million miles', NASA],
  ['On average, about how many million kilometers is Earth from the Sun? (to one decimal place)', 149.6, 'million km', NASA],
  ['How many kilometers per second does light travel in a vacuum (rounded to a whole number)?', 299792, 'km/s', 'BIPM, SI definition of the meter (299,792,458 m/s)'],
  ['About how many seconds does moonlight take to reach Earth? (to one decimal place)', 1.3, 'seconds', NASA],
  ['About how many trillion miles is one light-year? (to two decimal places)', 5.88, 'trillion miles', 'NASA, "What is a light-year?"'],
  ['About how many billion years old is the universe? (to one decimal place)', 13.8, 'billion years', 'NASA WMAP / ESA Planck mission results'],
  ['About how many times wider is Jupiter than Earth?', 11, 'times', NASA],
  ['About how many Earths could fit inside the Sun?', 1300000, 'Earths', 'NASA Space Place, "How big is the Sun?"'],
  ['About how many hours long is one day (one spin) on Saturn? (to one decimal place)', 10.7, 'hours', NASA],
  ['By about how many degrees is Uranus tilted on its side?', 98, 'degrees', NASA],
  ['About how many degrees Fahrenheit is the surface of Venus?', 900, '°F', NASA, { fact: 'Hot enough to melt lead — Venus is hotter than Mercury.' }],
  ['About how many degrees Fahrenheit is the visible surface of the Sun?', 10000, '°F', NASA],
  ['How many dwarf planets are officially recognized by the International Astronomical Union?', 5, 'dwarf planets', 'International Astronomical Union', { fact: 'Ceres, Pluto, Haumea, Makemake and Eris.' }],
  ['In what year was Pluto discovered?', 1930, 'year', 'Lowell Observatory, discovery by Clyde Tombaugh'],
  ['In what year was Pluto reclassified as a dwarf planet?', 2006, 'year', 'International Astronomical Union, 2006 General Assembly'],
  ['In what year was the Hubble Space Telescope launched?', 1990, 'year', 'NASA, Hubble mission history'],
  ['How many Apollo missions landed astronauts on the Moon?', 6, 'missions', 'NASA, Apollo program history'],
  ['How many people have walked on the Moon?', 12, 'people', 'NASA, Apollo program history'],
  ['About how many minutes does the International Space Station take to circle Earth once?', 90, 'minutes', 'NASA, "International Space Station Facts and Figures"'],
];

export const ANIMAL_QUESTIONS = buildQuestions('animals', 'xan', rows);
