import hud from "./hud";
import phone from "./phone";
import story from "./story";
import outcome from "./outcome";
import laptop from "./laptop";
import room from "./room";
import journalCombine from "./journalCombine";
import debriefForensic from "./debriefForensic";

/** The `chapter1` namespace, composed from area files with disjoint top-level key groups. */
const chapter1 = {
  ...hud,
  ...phone,
  ...story,
  ...outcome,
  ...laptop,
  ...room,
  ...journalCombine,
  ...debriefForensic,
};

export default chapter1;
