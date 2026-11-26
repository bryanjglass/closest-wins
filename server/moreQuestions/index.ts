/**
 * The extended question bank (500 questions), written in the compact row format
 * from `build.ts`. SERVER-ONLY.
 */
import { ANIMAL_QUESTIONS } from './animals';
import { ENTERTAINMENT_QUESTIONS } from './entertainment';
import { GEOGRAPHY_QUESTIONS } from './geography';
import { PRICE_QUESTIONS } from './prices';
import { SPORTS_QUESTIONS } from './sports';
import { WEIRD_QUESTIONS } from './weird';

export const MORE_QUESTIONS = [
  ...PRICE_QUESTIONS,
  ...ANIMAL_QUESTIONS,
  ...SPORTS_QUESTIONS,
  ...ENTERTAINMENT_QUESTIONS,
  ...WEIRD_QUESTIONS,
  ...GEOGRAPHY_QUESTIONS,
];
