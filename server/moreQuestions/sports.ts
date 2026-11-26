import { buildQuestions, type Row } from './build';

const MLB = 'Official Baseball Rules (MLB)';
const NBA = 'NBA Official Rules';
const NFL = 'NFL Rulebook';
const NHL = 'NHL Official Rules';
const IFAB = 'IFAB Laws of the Game (soccer)';
const ITF = 'ITF Rules of Tennis';
const WA = 'World Athletics rules and records';
const MLBSTATS = 'MLB.com / Baseball Hall of Fame career statistics';
const IOC = 'International Olympic Committee (olympics.com)';

const rows: Row[] = [
  // Teams & game length
  ['How many players does each team have on the field in a soccer match?', 11, 'players', IFAB],
  ['How many players does each team have on the court in basketball?', 5, 'players', NBA],
  ['How many defensive players are on the field in baseball?', 9, 'players', MLB],
  ['How many players (including the goalie) does each team have on the ice in hockey at full strength?', 6, 'players', NHL],
  ['How many players does each team have on the court in indoor volleyball?', 6, 'players', 'FIVB Official Volleyball Rules'],
  ['How many players does each team have on the field in rugby union?', 15, 'players', 'World Rugby Laws of the Game'],
  ['How many players (including the goalkeeper) does each team have in the water in water polo?', 7, 'players', 'World Aquatics water polo rules'],
  ['How many innings are in a regulation Major League Baseball game?', 9, 'innings', MLB],
  ['How many minutes long is each period in an NHL hockey game?', 20, 'minutes', NHL],
  ['How many minutes long is each quarter in an NBA game?', 12, 'minutes', NBA],
  ['How many minutes long is each quarter in an NFL game?', 15, 'minutes', NFL],
  ['How many minutes long is a regulation soccer match (not counting stoppage time)?', 90, 'minutes', IFAB],
  ['How many points is a safety worth in American football?', 2, 'points', NFL],
  ['How many points is a field goal worth in American football?', 3, 'points', NFL],
  ['In baseball, how many balls does it take to walk a batter?', 4, 'balls', MLB],
  ['How many balls are bowled in one over in cricket?', 6, 'balls', 'MCC Laws of Cricket'],
  ['How many rounds is a modern men\'s world championship boxing match?', 12, 'rounds', 'WBC / WBA / IBF / WBO championship rules'],

  // Fields, courts & equipment
  ['How many feet is the NBA three-point line from the basket at the top of the arc? (to two decimal places)', 23.75, 'ft', NBA, { fact: 'That is 23 feet 9 inches; in the corners it is 22 feet.' }],
  ['How many feet is the free-throw line from the face of the backboard in basketball?', 15, 'ft', NBA],
  ['How many inches across is a basketball rim?', 18, 'in', NBA],
  ['How many feet long is an NBA court?', 94, 'ft', NBA],
  ['How many feet wide is a soccer goal?', 24, 'ft', IFAB],
  ['How many yards from the goal line is the penalty spot in soccer?', 12, 'yards', IFAB],
  ['How many inches high is a tennis net at the center?', 36, 'in', ITF],
  ['How many feet long is a tennis court?', 78, 'ft', ITF],
  ['How many millimeters across is a table tennis ball?', 40, 'mm', 'ITTF Handbook, Laws of Table Tennis'],
  ['How many points do you need to win a game of table tennis (if not tied at the end)?', 11, 'points', 'ITTF Handbook, Laws of Table Tennis'],
  ['How many points do you need to win a game of badminton (if not tied at the end)?', 21, 'points', 'BWF Laws of Badminton'],
  ['How many points do you need to win a regular (non-deciding) set of indoor volleyball?', 25, 'points', 'FIVB Official Volleyball Rules'],
  ['How many meters high is the net in men\'s indoor volleyball? (to two decimal places)', 2.43, 'm', 'FIVB Official Volleyball Rules'],
  ['What is the most clubs a golfer may carry in their bag during a round?', 14, 'clubs', 'USGA / R&A Rules of Golf, Rule 4.1'],
  ['What is the minimum diameter of a golf ball in inches? (to two decimal places)', 1.68, 'in', 'USGA / R&A Equipment Rules'],
  ['How many inches across is an ice hockey puck?', 3, 'in', NHL],
  ['How many feet long is an NHL hockey rink?', 200, 'ft', NHL],
  ['How many feet is it from the foul line to the head pin in bowling?', 60, 'ft', 'United States Bowling Congress specifications'],
  ['How many inches wide is home plate in baseball?', 17, 'in', MLB],
  ['How many inches high is the pitcher\'s mound in Major League Baseball?', 10, 'in', MLB],
  ['How many red stitches are on an official Major League baseball?', 108, 'stitches', 'Rawlings / MLB official baseball specifications'],
  ['How many yards wide is an NFL field? (to one decimal place)', 53.3, 'yards', NFL, { fact: 'It is exactly 160 feet.' }],
  ['How many balls are on the table at the start of a frame of snooker, including the cue ball?', 22, 'balls', 'World Professional Billiards and Snooker Association rules'],
  ['What is the highest possible break in snooker (without a free ball)?', 147, 'points', 'World Snooker Tour'],
  ['How many balls are used in a game of 8-ball pool, including the cue ball?', 16, 'balls', 'World Pool-Billiard Association rules'],
  ['How many meters away is the target in Olympic recurve archery?', 70, 'm', 'World Archery rules'],
  ['How many grams does a men\'s javelin weigh?', 800, 'g', WA],
  ['How many kilograms does a men\'s discus weigh?', 2, 'kg', WA],
  ['How many events are in an Olympic decathlon?', 10, 'events', WA],
  ['How many events are in an Olympic heptathlon?', 7, 'events', WA],
  ['How many kilometers is the bike leg of an Olympic-distance triathlon?', 40, 'km', 'World Triathlon competition rules'],
  ['How many miles is a full Ironman triathlon in total? (to one decimal place)', 140.6, 'miles', 'IRONMAN Group', { fact: '2.4 miles swimming, 112 cycling and 26.2 running.' }],
  ['How many miles long is the Kentucky Derby? (to two decimal places)', 1.25, 'miles', 'Churchill Downs, Kentucky Derby'],
  ['How many laps is the Indianapolis 500?', 200, 'laps', 'Indianapolis Motor Speedway'],
  ['How many stages does the modern Tour de France have?', 21, 'stages', 'Amaury Sport Organisation (letour.fr)'],
  ['How many Grand Slam tennis tournaments are played each year?', 4, 'tournaments', 'International Tennis Federation'],

  // Records & legends
  ['What jersey number did Wayne Gretzky wear (now retired across the whole NHL)?', 99, '', 'NHL.com'],
  ['How many NBA championships did Michael Jordan win?', 6, 'titles', 'NBA.com, Michael Jordan bio'],
  ['How many NBA championships did Bill Russell win as a player?', 11, 'titles', 'NBA.com, Bill Russell bio'],
  ['How many career regular-season points did Kareem Abdul-Jabbar score in the NBA?', 38387, 'points', 'NBA.com career statistics'],
  ['In the 1961–62 season, Wilt Chamberlain averaged how many points per game? (to one decimal place)', 50.4, 'points', 'NBA.com / Basketball-Reference'],
  ['How many Super Bowls did quarterback Tom Brady win?', 7, 'Super Bowls', 'NFL.com, Tom Brady career'],
  ['How many career home runs did Barry Bonds hit in Major League Baseball?', 762, 'home runs', MLBSTATS],
  ['In 2001, Barry Bonds set the single-season home run record. How many did he hit?', 73, 'home runs', MLBSTATS],
  ['In 1941, Joe DiMaggio set the record for the longest hitting streak. How many games did it last?', 56, 'games', MLBSTATS],
  ['How many consecutive games did Cal Ripken Jr. play, the all-time MLB record?', 2632, 'games', MLBSTATS],
  ['How many career hits did Pete Rose have, the all-time MLB record?', 4256, 'hits', MLBSTATS],
  ['How many career strikeouts did pitcher Nolan Ryan record, the all-time MLB record?', 5714, 'strikeouts', MLBSTATS],
  ['How many no-hitters did Nolan Ryan pitch in his career?', 7, 'no-hitters', MLBSTATS],
  ['How many career wins did pitcher Cy Young have, the all-time MLB record?', 511, 'wins', MLBSTATS],
  ['In 1954, Roger Bannister ran the first sub-four-minute mile. What was his time in seconds? (to one decimal place)', 239.4, 'seconds', WA, { fact: 'That is 3 minutes 59.4 seconds.' }],
  ['In 1968, Bob Beamon set a famous long jump world record. How many meters did he jump? (to two decimal places)', 8.9, 'm', WA, { p: 2 }],
  ['What is the men\'s long jump world record in meters, set by Mike Powell in 1991? (to two decimal places)', 8.95, 'm', WA],
  ['What is Usain Bolt\'s 200 m world record time in seconds, set in 2009? (to two decimal places)', 19.19, 'seconds', WA],
  ['What is Florence Griffith-Joyner\'s women\'s 100 m world record time in seconds, set in 1988? (to two decimal places)', 10.49, 'seconds', WA],
  ['In 1976, gymnast Nadia Comăneci scored the first perfect score in Olympic gymnastics. What was the score?', 10, 'points', IOC],
  ['How many Olympic gold medals did Michael Phelps win at the 2008 Beijing Games?', 8, 'golds', IOC],
  ['How many Olympic gold medals did swimmer Mark Spitz win at the 1972 Munich Games?', 7, 'golds', IOC],
  ['How many Olympic gold medals did gymnast Simone Biles win through the 2024 Paris Games?', 7, 'golds', IOC],
  ['How many FIFA World Cups has Brazil won?', 5, 'World Cups', 'FIFA (fifa.com)'],
  ['How many FIFA World Cups did Pelé win as a player?', 3, 'World Cups', 'FIFA (fifa.com)'],
  ['How many Grand Slam singles titles did Roger Federer win?', 20, 'titles', 'ATP Tour, Roger Federer profile'],
  ['How many French Open singles titles did Rafael Nadal win?', 14, 'titles', 'ATP Tour, Rafael Nadal profile'],
  ['How many Wimbledon singles titles did Martina Navratilova win?', 9, 'titles', 'WTA, Martina Navratilova profile'],
  ['How many Grand Slam singles titles did Steffi Graf win?', 22, 'titles', 'WTA, Steffi Graf profile'],
  ['How many major championships did golfer Jack Nicklaus win, the all-time record?', 18, 'majors', 'PGA of America / PGA Tour'],
  ['In the 1973 Belmont Stakes, by how many lengths did Secretariat win?', 31, 'lengths', 'New York Racing Association / Belmont Stakes history'],
  ['In what year was the first FIFA World Cup held?', 1930, 'year', 'FIFA (fifa.com)'],
  ['In what year were the first Winter Olympics held, in Chamonix?', 1924, 'year', IOC],
  ['In what year did the US hockey team win the "Miracle on Ice" game against the Soviet Union?', 1980, 'year', IOC],
  ['In what year was the first Super Bowl played?', 1967, 'year', 'NFL.com, Super Bowl history'],
];

export const SPORTS_QUESTIONS = buildQuestions('sports', 'xsp', rows);
