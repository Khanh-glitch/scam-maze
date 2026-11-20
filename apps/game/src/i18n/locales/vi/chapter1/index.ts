import type en from "../../en/chapter1";
import type { LocaleShape } from "../../../types";
import hud from "./hud";
import phone from "./phone";
import story from "./story";
import outcome from "./outcome";
import laptop from "./laptop";
import room from "./room";
import journalCombine from "./journalCombine";
import debriefForensic from "./debriefForensic";
import device from "./device";
import voice from "./voice";

const chapter1: LocaleShape<typeof en> = {
  ...hud,
  ...phone,
  ...story,
  ...outcome,
  ...laptop,
  ...room,
  ...journalCombine,
  ...debriefForensic,
  ...device,
  ...voice,
};

export default chapter1;
