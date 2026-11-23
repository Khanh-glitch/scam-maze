import { useEffect, useRef, useState } from "react";
import {
  OpenWorldEngine,
  type LandmarkWaypoint,
  type OpenWorldSnapshot,
} from "./world/OpenWorldEngine";
import type { WeatherPreset } from "./world/AtmosphereSystem";

function formatClock(hours: number): string {
  const h = Math.floor(((hours % 24) + 24) % 24);
  const m = Math.floor((((hours % 24) + 24) % 24 - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const WEATHER_LABELS: { id: WeatherPreset; label: string; badge: string }[] = [
  { id: "clear", label: "Nắng / Quang", badge: "1" },
  { id: "overcast", label: "Mây Ẩm", badge: "2" },
  { id: "drizzle", label: "Sau Cơn Mưa", badge: "3" },
  { id: "monsoon", label: "Mưa Giông", badge: "4" },
];

const WAYPOINTS: { id: LandmarkWaypoint; label: string }[] = [
  { id: "room", label: "Phòng 6.07" },
  { id: "balcony", label: "Hành Lang Trọ" },
  { id: "hem", label: "Hẻm 462/14" },
  { id: "bus", label: "Trạm Xe Buýt" },
  { id: "bitexco", label: "Bitexco Q.1" },
  { id: "landmark81", label: "Landmark 81" },
];

function MiniMap({ pos, heading }: { pos: { x: number; z: number }; heading: number }) {
  // Maps world X ∈ [-40, 140], Z ∈ [-380, 40] into 132×132 radar
  const toSvg = (wx: number, wz: number) => ({
    x: ((wx + 45) / 195) * 124 + 4,
    y: ((wz + 385) / 435) * 124 + 4,
  });
  const p = toSvg(pos.x, pos.z);
  const room = toSvg(22, -16.8);
  const bus = toSvg(-3, 0);
  const bx = toSvg(94, -186);
  const lm = toSvg(26, -356);

  return (
    <div className="pointer-events-none select-none rounded-xl border border-white/15 bg-black/55 p-2 backdrop-blur-md">
      <div className="mb-1 flex items-center justify-between text-[10px] font-semibold tracking-wider text-white/65 uppercase">
        <span>Bản Đồ TP.HCM</span>
        <span>N ↑</span>
      </div>
      <svg width="132" height="132" className="rounded-lg bg-slate-950/80">
        {/* Lý Thái Tổ + Northern Riverside Ave */}
        <line x1={toSvg(-6, 35).x} y1={toSvg(-6, 35).y} x2={toSvg(-6, -345).x} y2={toSvg(-6, -345).y} stroke="#475569" strokeWidth="4" />
        {/* Hẻm 462/14 */}
        <line x1={toSvg(0, -11.2).x} y1={toSvg(0, -11.2).y} x2={room.x} y2={room.y} stroke="#f59e0b" strokeWidth="2.2" />
        {/* East Boulevards Z=-76 & Z=-147 */}
        <line x1={toSvg(0, -76).x} y1={toSvg(0, -76).y} x2={toSvg(118, -76).x} y2={toSvg(118, -76).y} stroke="#475569" strokeWidth="3" />
        <line x1={toSvg(0, -147).x} y1={toSvg(0, -147).y} x2={toSvg(118, -147).x} y2={toSvg(118, -147).y} stroke="#475569" strokeWidth="3" />
        {/* Hải Triều Connector */}
        <line x1={toSvg(56, -72).x} y1={toSvg(56, -72).y} x2={toSvg(56, -230).x} y2={toSvg(56, -230).y} stroke="#475569" strokeWidth="3" />

        {/* Landmarks */}
        <circle cx={lm.x} cy={lm.y} r="4.2" fill="#38bdf8" />
        <text x={lm.x + 6} y={lm.y + 3} fill="#bae6fd" fontSize="8" fontWeight="700">L81</text>

        <circle cx={bx.x} cy={bx.y} r="4.2" fill="#a78bfa" />
        <text x={bx.x - 16} y={bx.y - 6} fill="#ddd6fe" fontSize="8" fontWeight="700">Bitexco</text>

        <circle cx={bus.x} cy={bus.y} r="3.4" fill="#34d399" />
        <text x={bus.x + 5} y={bus.y + 8} fill="#a7f3d0" fontSize="7.5" fontWeight="600">Bus 06</text>

        <circle cx={room.x} cy={room.y} r="3.4" fill="#fbbf24" />
        <text x={room.x + 5} y={room.y + 3} fill="#fde68a" fontSize="7.5" fontWeight="600">6.07</text>

        {/* Player marker */}
        <g transform={`translate(${p.x}, ${p.y}) rotate(${heading})`}>
          <polygon points="0,-6 4,4 0,2 -4,4" fill="#ffffff" stroke="#0f172a" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
}

export default function OpenWorldApp() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<OpenWorldEngine | null>(null);
  const [snap, setSnap] = useState<OpenWorldSnapshot | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let engine: OpenWorldEngine | null = null;
    try {
      engine = new OpenWorldEngine(el, setSnap);
      engineRef.current = engine;
    } catch (err) {
      console.error("OpenWorldEngine init error:", err);
      setBootError(err instanceof Error ? err.message : String(err));
    }
    return () => {
      engine?.dispose();
      engineRef.current = null;
    };
  }, []);

  const atm = snap?.atmosphere;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 font-sans text-white">
      {/* Full-Bleed Seamless 3D Open World Viewport */}
      <div ref={mountRef} className="h-full w-full cursor-grab active:cursor-grabbing" />

      {bootError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-6">
          <div className="max-w-md rounded-2xl border border-red-400/40 bg-slate-900 p-6 text-sm text-white shadow-2xl">
            <div className="mb-2 text-base font-bold text-red-300">Không thể khởi tạo WebGL Open World</div>
            <p className="font-mono text-xs text-white/80">{bootError}</p>
          </div>
        </div>
      )}

      {/* Center Ultra-Minimal Crosshair (never looks like a glowing floating orb!) */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div
          className={`rounded-full transition-all duration-150 ${
            snap?.prompt
              ? "h-1.5 w-1.5 border border-amber-200/80 bg-amber-200/60"
              : "h-1 w-1 bg-white/35"
          }`}
        />
      </div>

      {/* Top-Left: Live Seamless Location, Clock & Streaming Status */}
      {snap && (
        <div className="pointer-events-none fixed top-4 left-4 flex flex-col gap-2">
          <div className="rounded-xl border border-white/15 bg-black/55 px-4 py-2.5 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
              <span className="text-sm font-bold tracking-wide text-white">{snap.zone}</span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-mono text-amber-200">
                {formatClock(snap.atmosphere.timeOfDay)}
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-[11px] text-white/70">
              <span>{snap.district}</span>
              <span>•</span>
              <span>
                Streaming: {snap.streaming.activeNear} near / {snap.streaming.activeLod} LOD
              </span>
              <span>•</span>
              <span className="font-mono">{snap.fps} FPS</span>
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/45 px-3 py-1.5 text-[11px] text-white/75 backdrop-blur-sm">
            <span className="font-semibold text-emerald-300">Tuyến Buýt 06:</span> {snap.busStatus}
          </div>
        </div>
      )}

      {/* Top-Right: AAA World Director Controls (Day/Night, Tropical Weather, Landmarks) */}
      <div className="fixed top-4 right-4 z-20 flex flex-col items-end gap-2">
        <button
          onClick={() => setPanelOpen((v) => !v)}
          className="rounded-lg border border-white/15 bg-black/60 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-md transition hover:bg-white/15"
        >
          {panelOpen ? "Ẩn Bảng Điều Khiển ✕" : "Điều Khiển Sài Gòn ☰"}
        </button>

        {panelOpen && snap && atm && (
          <div className="w-72 rounded-xl border border-white/15 bg-black/65 p-3.5 text-xs shadow-2xl backdrop-blur-xl">
            {/* 24-Hour Day / Night Cycle */}
            <div className="mb-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-semibold tracking-wider text-white/80 uppercase">
                  Chu Kỳ Ngày / Đêm
                </span>
                <button
                  onClick={() => engineRef.current?.setAutoCycle(!atm.autoCycle)}
                  className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                    atm.autoCycle
                      ? "bg-emerald-500/25 text-emerald-300 border border-emerald-400/30"
                      : "bg-white/10 text-white/70"
                  }`}
                >
                  {atm.autoCycle ? "Tự động: BẬT" : "Tự động: TẮT"}
                </button>
              </div>
              <input
                type="range"
                min={0}
                max={23.95}
                step={0.05}
                value={atm.timeOfDay}
                onChange={(e) => {
                  engineRef.current?.setAutoCycle(false);
                  engineRef.current?.setTimeOfDay(parseFloat(e.target.value));
                }}
                className="w-full accent-amber-400"
              />
              <div className="mt-1.5 grid grid-cols-4 gap-1">
                {[
                  { label: "Bình Minh", h: 6.0 },
                  { label: "Trưa", h: 12.5 },
                  { label: "Hoàng Hôn", h: 17.75 },
                  { label: "Đêm", h: 22.15 },
                ].map((t) => (
                  <button
                    key={t.label}
                    onClick={() => {
                      engineRef.current?.setAutoCycle(false);
                      engineRef.current?.setTimeOfDay(t.h);
                    }}
                    className="rounded bg-white/10 py-1 text-[10px] font-medium text-white/85 transition hover:bg-amber-400/25 hover:text-amber-200"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dynamic Tropical Weather */}
            <div className="mb-3 border-t border-white/10 pt-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-semibold tracking-wider text-white/80 uppercase">
                  Thời Tiết Nhiệt Đới
                </span>
                <span className="text-[10px] text-sky-300">
                  Ẩm {Math.round(atm.wetness * 100)}% · Gió {Math.round(atm.windStrength * 100)}%
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {WEATHER_LABELS.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => engineRef.current?.setWeather(w.id)}
                    className={`flex items-center justify-between rounded-lg border px-2 py-1.5 text-[11px] font-medium transition ${
                      atm.weather === w.id
                        ? "border-sky-400/60 bg-sky-500/25 text-sky-100"
                        : "border-white/10 bg-white/5 text-white/75 hover:bg-white/15"
                    }`}
                  >
                    <span>{w.label}</span>
                    <span className="rounded bg-black/40 px-1 text-[9px] text-white/50">{w.badge}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Seamless Open-World Landmarks (All Connected in 1 Continuous World) */}
            <div className="border-t border-white/10 pt-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="font-semibold tracking-wider text-white/80 uppercase">
                  Địa Điểm Liền Mạch
                </span>
                <button
                  onClick={() => engineRef.current?.toggleDoor()}
                  className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/35"
                >
                  {snap.doorOpen ? "Đóng Cửa 6.07" : "Mở Cửa 6.07"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {WAYPOINTS.map((wp) => (
                  <button
                    key={wp.id}
                    onClick={() => engineRef.current?.moveToWaypoint(wp.id)}
                    className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-left text-[11px] text-white/85 transition hover:border-amber-400/50 hover:bg-amber-400/15"
                  >
                    {wp.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom-Left: Live Ho Chi Minh City Open-World Radar */}
      {snap && (
        <div className="fixed bottom-4 left-4 z-10 flex items-end gap-3">
          <MiniMap pos={snap.position} heading={snap.headingDeg} />
          <div className="pointer-events-none hidden rounded-lg border border-white/10 bg-black/50 px-3 py-2 text-[11px] leading-relaxed text-white/75 backdrop-blur-md sm:block">
            <div><span className="font-semibold text-white">WASD / Mũi tên:</span> Di chuyển (Shift chạy)</div>
            <div><span className="font-semibold text-white">Kéo chuột / Double-Click:</span> Xoay góc nhìn</div>
            <div><span className="font-semibold text-white">E:</span> Mở cửa · Tương tác · Lên Xe Buýt 06</div>
          </div>
        </div>
      )}

      {/* Bottom-Center: Interactive Action Prompt (positioned cleanly ABOVE controls bar — ZERO overlap!) */}
      {snap?.prompt && !snap.activeModal && (
        <div className="pointer-events-none fixed bottom-28 left-1/2 z-20 -translate-x-1/2">
          <div className="rounded-full border border-amber-300/45 bg-black/75 px-5 py-2 text-sm font-semibold text-amber-100 shadow-2xl backdrop-blur-md">
            {snap.prompt}
          </div>
        </div>
      )}

      {/* Room 6.07 Authentic Smartphone Message Modal */}
      {snap?.activeModal === "phone" && (
        <div
          onClick={() => engineRef.current?.closeModal()}
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-80 rounded-3xl border border-white/20 bg-slate-900/95 p-5 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between text-xs text-white/55">
              <span>Phòng 6.07 · Tin nhắn mới</span>
              <span>{formatClock(snap.atmosphere.timeOfDay)}</span>
            </div>
            <div className="rounded-2xl bg-slate-800/90 p-4 text-sm leading-relaxed text-white/95">
              <div className="mb-1 text-xs font-semibold text-amber-300">Mẹ</div>
              “Trời Sài Gòn vừa tạnh mưa rồi đó con. Có ra ngoài bắt xe buýt hay đi dạo quanh khu trọ thì nhớ mang theo áo khoác kẻo lạnh nha.”
            </div>
            <button
              onClick={() => engineRef.current?.closeModal()}
              className="mt-4 w-full rounded-xl bg-white/10 py-2 text-xs font-semibold text-white hover:bg-white/20"
            >
              Đóng điện thoại (E / Esc)
            </button>
          </div>
        </div>
      )}

      {/* Room 6.07 Authentic Handwritten Note Modal */}
      {snap?.activeModal === "note" && (
        <div
          onClick={() => engineRef.current?.closeModal()}
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/65 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ fontFamily: "'Patrick Hand', cursive" }}
            className="w-80 -rotate-1 rounded-md border border-amber-300/40 bg-[#f6e8b8] p-6 text-lg leading-relaxed text-slate-800 shadow-2xl"
          >
            <div className="mb-2 text-xl font-bold text-slate-900">Ghi chú — Phòng 6.07</div>
            <p>- Tiền trọ 462/14 Lý Thái Tổ: đóng trước ngày 5</p>
            <p>- Ra Hẻm 462/14 bắt xe Buýt Tuyến 06</p>
            <p>- Rẽ Đường 3/2 đi thẳng ra Bitexco Quận 1</p>
            <p>- Đi dọc bờ sông lên Công viên Landmark 81</p>
            <button
              onClick={() => engineRef.current?.closeModal()}
              className="mt-4 w-full rounded bg-slate-800/15 py-1.5 font-sans text-xs font-semibold text-slate-800 hover:bg-slate-800/25"
            >
              Gấp tờ giấy lại (E / Esc)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
