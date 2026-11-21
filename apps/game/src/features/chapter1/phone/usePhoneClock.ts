// The in-game clock text for the phone ("23:08"). It reads the same clock as the wall clock of the
// room and the call screen (`gameClock`), refreshed once a second.
import { useEffect, useState } from "react";
import { gameClockText } from "../../../game/clock/gameClock";

export function usePhoneClock(): string {
  const [time, setTime] = useState(gameClockText);
  useEffect(() => {
    const id = window.setInterval(() => setTime(gameClockText()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return time;
}
