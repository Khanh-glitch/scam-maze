import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import type { GameSettings } from "@scammaze/shared-types";
import type { Hud, Simulation } from "./sim/runtime";
import { formatCash } from "./sim/transit";

interface TestBusPageProps {
  settings: GameSettings;
  onBackToMenu: () => void;
}

const BUTTON =
  "cursor-pointer rounded-md border border-white/15 bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur transition hover:bg-white/25";

/**
 * Prototype route `/testbus`: the Saigon bus stop and Route 06 ride, populated with the game's own
 * characters, scooter riders and parked scooters instead of the blocky stand-ins.
 */
export const TestBusPage: React.FC<TestBusPageProps> = ({ settings, onBackToMenu }) => {
  const { t } = useTranslation("worlds");
  const mountRef = useRef<HTMLDivElement | null>(null);
  const simRef = useRef<Simulation | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const muted = !settings.soundEnabled;

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let cancelled = false;
    void (async () => {
      try {
        const [{ createSimulation }, { loadTestBusAssets }] = await Promise.all([import("./sim/runtime"), import("./actors")]);
        const assets = await loadTestBusAssets();
        if (cancelled) return;
        const sim = createSimulation(
          el,
          {
            onHud: setHud,
            onPanel: (panel) => { if (panel === "pause") { sim.setPaused(true); setPaused(true); } },
            onReady: () => setLoading(false),
            onError: (message) => setError(message),
          },
          undefined,
          assets,
        );
        simRef.current = sim;
        sim.setMuted(muted);
      } catch (err) {
        console.error(err);
        if (!cancelled) { setError(t("testbus.error")); setLoading(false); }
      }
    })();
    return () => {
      cancelled = true;
      simRef.current?.dispose();
      simRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { simRef.current?.setMuted(muted); }, [muted]);

  const resume = () => { simRef.current?.setPaused(false); setPaused(false); };
  const shadow = { textShadow: "0 1px 6px rgba(0,0,0,.9)" } as const;

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden bg-black text-stone-100"
      data-phase={hud?.phase ?? "waiting"}
      data-onboard={hud?.onboard ?? false}
      data-seated={hud?.seated ?? false}
      data-paid={hud?.paid ?? false}
    >
      <div ref={mountRef} className="absolute inset-0" />
      <button type="button" onClick={onBackToMenu} className={`absolute left-3 top-3 z-50 flex items-center gap-1.5 ${BUTTON}`}>
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
        {t("testbus.backToMenu")}
      </button>
      {hud && !loading && !paused && (
        <>
          <div className="pointer-events-none absolute right-4 top-3 text-right text-xs" style={shadow}>
            <div className="text-sm font-medium">{hud.objective}</div>
            <div className="text-white/70">{t("testbus.clock")} {hud.clock} · {t("testbus.cash")} {formatCash(hud.cash)}</div>
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-1 w-1 rounded-full bg-white/60" />
            <div className="absolute top-1/2 mt-8 flex flex-col items-center gap-1 text-[13px]" style={shadow}>
              {hud.notice && <div className="mb-2 max-w-md text-center text-white/90">{hud.notice}</div>}
              {[hud.prompt, hud.secondary].map((p) => p && (
                <div key={p.key + p.label} className="flex items-center gap-2">
                  <span className="rounded border border-white/40 px-1.5 py-0.5 text-[11px]">{p.key}</span>
                  <span>{p.label}</span>
                  {p.detail && <span className="text-white/55">{p.detail}</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-5 left-5 text-[12px] text-white/45">{t("testbus.controls")}</div>
        </>
      )}
      {paused && (
        <button type="button" onClick={resume} className="absolute inset-0 z-40 flex cursor-pointer items-center justify-center bg-black/45 backdrop-blur-[1px]">
          <span className="text-sm uppercase tracking-[0.3em] text-white/75">{t("testbus.paused")}</span>
        </button>
      )}
      {loading && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0d1117] text-sm tracking-widest text-white/70" role="status">
          {error ?? t("testbus.loading")}
        </div>
      )}
    </div>
  );
};
