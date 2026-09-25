/** Display-only puzzle bank. Answers and passwords live in secrets.js (server-only). */

export const ROUND_MS = 12 * 60 * 1000;
export const SET_COUNT = 7;

export const puzzlesBySet = {
  1: [
    {
      n: 1,
      title: "0s and 1s will speak",
      type: "tokens",
      tokens: ["0001", "0011", "0101", "0111", "?", "1011"],
    },
    {
      n: 2,
      title: "The alphabet has a pattern",
      type: "tokens",
      tokens: ["A", "C", "E", "G", "?", "K"],
    },
    {
      n: 3,
      title: "Someone shifted the letters",
      type: "shift",
      letters: ["K", "H", "O", "O", "R"],
      hint: "A → D",
      focus: 2,
    },
    {
      n: 4,
      title: "Find what comes next",
      type: "tokens",
      tokens: ["4", "3", "2", "?", "0"],
    },
  ],
  2: [
    {
      n: 1,
      title: "0s and 1s will speak",
      type: "tokens",
      tokens: ["0000", "0010", "0100", "0110", "?", "1010"],
    },
    {
      n: 2,
      title: "The numbers can speak",
      type: "tokens",
      tokens: ["67", "79", "68", "69"],
    },
    {
      n: 3,
      title: "Someone shifted the letters",
      type: "shift",
      letters: ["F", "O", "H", "D", "U"],
      hint: "A → D",
      focus: 1,
    },
    {
      n: 4,
      title: "Find what comes next",
      type: "tokens",
      tokens: ["13", "10", "7", "4", "?"],
    },
  ],
  3: [
    {
      n: 1,
      title: "0s and 1s will speak",
      type: "tokens",
      tokens: ["0010", "0100", "0110", "?", "1010", "1100"],
    },
    {
      n: 2,
      title: "The alphabet has a pattern",
      type: "tokens",
      tokens: ["B", "E", "H", "K", "?", "Q"],
    },
    {
      n: 3,
      title: "Someone shifted the letters",
      type: "varshift",
      letters: ["M", "K", "J", "L", "Y"],
      hint: "+1, +2, +3, +4, +5",
      focus: 2,
    },
    {
      n: 4,
      title: "Find what comes next",
      type: "tokens",
      tokens: ["14", "11", "8", "5", "?"],
    },
  ],
  4: [
    {
      n: 1,
      title: "0s and 1s will speak",
      type: "tokens",
      tokens: ["0001", "0011", "0101", "?", "1001", "1011"],
    },
    {
      n: 2,
      title: "The numbers can speak",
      type: "tokens",
      tokens: ["70", "79", "85", "82"],
    },
    {
      n: 3,
      title: "Someone shifted the letters",
      type: "shift",
      letters: ["Z", "R", "U", "O", "G"],
      hint: "A → D",
      focus: 1,
    },
    {
      n: 4,
      title: "Find what comes next",
      type: "tokens",
      tokens: ["15", "12", "9", "6", "?"],
    },
  ],
  5: [
    {
      n: 1,
      title: "0s and 1s will speak",
      type: "tokens",
      tokens: ["0011", "0101", "0111", "?", "1011", "1101"],
    },
    {
      n: 2,
      title: "The alphabet has a pattern",
      type: "tokens",
      tokens: ["D", "F", "H", "J", "L", "?"],
    },
    {
      n: 3,
      title: "Someone shifted the letters",
      type: "shift",
      letters: ["G", "S", "H", "I", "W"],
      hint: "A → E",
      focus: 3,
    },
    {
      n: 4,
      title: "Find what comes next",
      type: "tokens",
      tokens: ["20", "16", "12", "8", "?"],
    },
  ],
  6: [
    {
      n: 1,
      title: "0s and 1s will speak",
      type: "tokens",
      tokens: ["0111", "1000", "?", "1010", "1011"],
    },
    {
      n: 2,
      title: "The numbers can speak",
      type: "tokens",
      tokens: ["83", "73", "88"],
    },
    {
      n: 3,
      title: "Someone shifted the letters",
      type: "shift",
      letters: ["V", "K", "L", "I", "W"],
      hint: "A → D",
      focus: 1,
    },
    {
      n: 4,
      title: "Find what comes next",
      type: "tokens",
      tokens: ["1", "3", "?", "7", "9"],
    },
  ],
  7: [
    {
      n: 1,
      title: "0s and 1s will speak",
      type: "tokens",
      tokens: ["0000", "0011", "0110", "?", "1100"],
    },
    {
      n: 2,
      title: "The numbers can speak",
      type: "tokens",
      tokens: ["79", "78", "69"],
    },
    {
      n: 3,
      title: "Someone shifted the letters",
      type: "shift",
      letters: ["U", "I", "F", "S", "F"],
      hint: "A → B",
      focus: 4,
    },
    {
      n: 4,
      title: "Find what comes next",
      type: "tokens",
      tokens: ["21", "18", "15", "12", "9", "?"],
    },
  ],
};
