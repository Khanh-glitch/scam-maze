// Subtitle timings of Alex's Mission 01 clips: for each unit of the caption (see `splitCaptionUnits`),
// when it starts and ends in the clip, in milliseconds. Generated from the pauses in the recordings;
// regenerate (and check the numbers against the audio) if a clip or its transcript changes.
import type { SubtitleTimings } from "./mission01Subtitles";

export const MISSION01_SUBTITLE_TIMINGS: SubtitleTimings = {
  "en": {
    "intro": [
      [30, 2780],
      [3210, 4660],
      [4870, 11620],
      [11570, 14570],
      [14690, 17030],
      [17320, 19230],
      [19260, 21210],
      [21260, 24670],
      [24850, 27530],
      [27860, 29240],
      [29650, 30520],
      [30810, 31850],
      [31930, 33880],
      [34010, 35396]
    ],
    "thesisStart": [
      [0, 840],
      [850, 4510],
      [4640, 5956]
    ],
    "emailReceived": [
      [30, 1850],
      [2120, 2650],
      [2840, 5190]
    ],
    "emailSuspicious": [
      [70, 3230],
      [3700, 5920]
    ],
    "verify": [
      [90, 3090],
      [3270, 6034]
    ],
    "securityBreach": [
      [10, 620],
      [540, 3720],
      [3680, 4640],
      [4670, 7190],
      [7190, 8202]
    ],
    "easyMoney": [
      [60, 2830],
      [3170, 4620],
      [4930, 7314]
    ],
    "investment": [
      [20, 4650],
      [4810, 5580],
      [5500, 7967]
    ],
    "exhausted": [
      [30, 4370],
      [5110, 6860]
    ],
    "overnight": [
      [20, 3150],
      [3880, 7240]
    ]
  },
  "vi": {
    "intro": [
      [0, 2410],
      [3100, 5260],
      [5880, 12590],
      [12860, 15240],
      [15410, 18230],
      [18640, 20440],
      [20520, 22290],
      [22520, 24250],
      [24390, 26100],
      [26460, 29300],
      [29220, 30720],
      [30910, 31960],
      [32430, 34110],
      [34230, 35553]
    ],
    "thesisStart": [
      [80, 910],
      [1320, 3420],
      [3560, 4760]
    ],
    "emailReceived": [
      [0, 1260],
      [1680, 2630],
      [2810, 5970]
    ],
    "emailSuspicious": [
      [50, 3020],
      [3450, 4230],
      [4440, 5880]
    ],
    "verify": [
      [60, 2720],
      [3230, 5410]
    ],
    "securityBreach": [
      [0, 690],
      [780, 3230],
      [3320, 4850],
      [5470, 6990],
      [7030, 7860]
    ],
    "easyMoney": [
      [70, 2960],
      [3480, 4910],
      [5160, 6500],
      [6740, 8751]
    ],
    "investment": [
      [70, 3960],
      [4440, 5190],
      [5230, 8046]
    ],
    "exhausted": [
      [0, 4080],
      [4930, 6320]
    ],
    "overnight": [
      [50, 3420],
      [4120, 6750]
    ]
  }
};
