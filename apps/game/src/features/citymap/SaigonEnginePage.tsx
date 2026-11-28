import { useEffect, useRef, useState } from "react";
import { generateCity } from "./cityGen";
import { addCityLayer } from "./cityLayer";
import { extendTrafficGraph, spawnCityVehicles } from "./cityTraffic";
import { signalizeCityIntersections } from "./citySignals";
import { buildCityBusCircuit, spawnCityBus, type CityBus } from "./cityBus";
import { buildCoreWorld, type CoreWorld } from "./coreWorld";
import { OpenWorldEngine } from "../testbus/openworld/world/OpenWorldEngine";
import { loadStreetFurniture } from "../khupho/world/streetFurniture";

/**
 * `/saigon` — SÀI GÒN 2026, chạy trên **chính runtime của map chuẩn**.
 *
 * Đây không phải một engine thứ hai "làm cho giống" `/testbus`: trang này dựng đúng
 * `OpenWorldEngine` mà `/testbus` đang chạy — cùng renderer, cùng `AtmosphereSystem` (PMREM ba chế
 * độ ngày/hoàng hôn/đêm, sương, mưa, sấm), cùng ánh sáng, cùng bộ giao thông `SaigonTrafficManager`
 * (đèn QCVN 41:2024, ACC/IDM+, sublane, va chạm OBB, người qua đường, còi), cùng nhà trọ 59 với
 * phòng 6.07, cùng bến xe buýt 06, cùng NPC và âm thanh.
 *
 * Thành phố thủ tục (`cityGen` + `cityMesh` + mặt đường/mặt đứng thật) được **cấy** vào scene đó
 * bằng `addCityLayer` — cùng một hàm `/saigon` bản cũ dùng, nên hình học thành phố không thể lệch
 * giữa hai nơi. Nó chỉ thêm hình, không thay đèn, không thay trời, không thay vật liệu của engine.
 *
 * KHU PHỐ GỐC: `city.core` là chỗ `cityMesh` đã cắt đất; ở đây `buildCoreWorld` dựng **nguyên thế
 * giới đang chơi được** của game (`features/khupho`: nhà ống, hẻm, sân chung, dây điện, người, xe)
 * vào đúng chỗ đó — cùng builder với màn chơi, không vẽ lại.
 *
 * Người chơi bắt đầu trong phòng 6.07 như thường lệ và bước ra là đứng giữa thành phố.
 */
export function SaigonEnginePage({ onBackToMenu }: { onBackToMenu?: () => void }) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("Đang dựng Sài Gòn…");
  const [load, setLoad] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    let engine: OpenWorldEngine | null = null;
    let coreWorld: CoreWorld | null = null;
    let cityBus: CityBus | null = null;
    let cancelled = false;
    const qs = new URLSearchParams(window.location.search);

    void (async () => {
      try {
        // Đồ vỉa hè thật phải có **trước** khi dựng: `choLon.ts` chọn prop lúc construct.
        await loadStreetFurniture().catch((err) => console.error("[saigon] đồ vỉa hè lỗi", err));
        if (cancelled) return;

        setStatus("Đang dựng phố Lý Thái Tổ và nhà trọ 59…");
        engine = new OpenWorldEngine(el, undefined);
        if (cancelled) {
          engine.dispose();
          return;
        }

        // Một khung hình trước khi dựng thành phố, để khung nhìn đầu tiên có ngay map chuẩn.
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        if (cancelled) return;
        setStatus("Đang cấy thành phố vào runtime…");

        // Cùng cách map chuẩn tự hạ chi tiết trên renderer phần mềm; `?hq=1` ép bản đầy đủ.
        let software = false;
        try {
          const gl = engine.renderer.getContext();
          const ext = gl.getExtension("WEBGL_debug_renderer_info");
          const info = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
          software = qs.get("hq") !== "1" && /swiftshader|llvmpipe|software|mesa offscreen/i.test(info);
        } catch {
          software = false;
        }

        const t0 = performance.now();
        const city = generateCity(undefined, { realWorld: true });
        const layer =
          qs.get("city") === "0"
            ? { anchors: {}, trees: 0, wind: null }
            : addCityLayer(engine.scene, city, { software, chunkMeters: Number(qs.get("chunk") ?? 0) || 0 });
        // Vòng chân trời giả của map chuẩn (11 cụm tháp tối + tấm nền 880 m) thay cho thành phố ở
        // phía xa khi map đứng một mình ở `/testbus`. Ở đây thành phố thật đã có, để nguyên thì mười
        // một khối đen mọc giữa phố (đúng lỗi đã thấy trong ảnh kiểm tra của `/saigon` bản cũ).
        if (qs.get("city") !== "0") {
          engine.scene.getObjectByName("hcmc-skyline-horizon")?.removeFromParent();
          // MỞ KHOÁ BIÊN GIỚI: map chuẩn chỉ cho đi trong 9 vùng dựng tay, bước ra là bị đẩy lại.
          // Giao vùng thành phố cho engine và dựng hộp bao từng khối nhà làm vật cản — nếu chỉ mở
          // biên giới mà không có vật cản thì nhân vật xuyên thẳng qua tường nhà.
          engine.cityBounds = { x0: city.frame.x0, x1: city.frame.x1, z0: city.frame.z0, z1: city.frame.z1 };
          engine.citySolids = city.buildings
            .filter((b) => !b.walkable)
            .map((b) => ({ x0: b.x0, x1: b.x1, z0: b.z0, z1: b.z1 }));
        }
        engine.renderer.shadowMap.needsUpdate = true;
        const buildMs = Math.round(performance.now() - t0);

        // Giao thông thành phố đi vào **cùng** bộ mô phỏng của engine: cùng đèn, cùng luật, cùng
        // hàng đợi ACC/IDM+ — không phải một vòng lặp xe thứ hai.
        //
        // Quy mô lấy theo đúng mật độ của Lý Thái Tổ, không theo "đủ để thấy có xe": map chuẩn có 3
        // ngã tư có đèn trên 236 m phố, và xe chạy liền nhau trên cả bốn làn. Trước đây thành phố chỉ
        // đưa **10 tuyến trong bán kính 520 m** vào đồ thị với **10 xe** — tức phần lớn bản đồ không
        // có giao thông nào, và lưới phía xa là "phố chết".
        //
        // Nay: 24 tuyến trong bán kính 900 m (phủ gần trọn khung 1,1 km của `city.frame`), 2 xe/làn.
        // Số xe là chi phí CPU thật (mỗi bước duyệt mọi xe cho ACC/IDM+, OBB, sublane), nên trần
        // giữ ở 36 và `cityBudget.test.ts` đo `perStepMs` với đúng con số này.
        const CITY_CORRIDORS = Number(qs.get("corridors") ?? 24) || 24;
        const CITY_VEHICLES = Number(qs.get("vehicles") ?? 36) || 36;
        const extension = extendTrafficGraph(engine.traffic.graph, city, {
          maxCorridors: CITY_CORRIDORS,
          radiusM: 900,
        });
        if (qs.get("veh") !== "0")
          void spawnCityVehicles(engine.traffic, extension, engine.scene, {
            perEdge: 2,
            maxVehicles: CITY_VEHICLES,
          }).catch((err) => console.error("[saigon] xe thành phố lỗi", err));

        // ĐÈN Ở NGÃ TƯ CỦA PHỐ THỦ TỤC: bật `signalized` cho ngã tư thật (không bật đầu cụt — ở đó
        // chỉ có vòng quay đầu), rồi dựng cột đèn bằng đúng `createMastArmSignal` +
        // `TrafficSignalController` của engine. Một bộ điều khiển QCVN 41:2024 lo cả hai bản đồ.
        const signals =
          qs.get("signals") === "0"
            ? { signalized: [] as string[], poles: 0, root: null }
            : signalizeCityIntersections(engine.traffic.graph, engine.traffic, {
                parent: engine.exteriorGroup,
                junctions: extension.junctions,
                // Lý Thái Tổ: 3 ngã tư có đèn trên 236 m. Phố thủ tục có 29 giao lộ sau khi mở
                // rộng lưới; đặt đèn ở 12 ngã tư gần map chuẩn nhất — đủ để mọi hướng đi ra khỏi
                // 6.07 đều gặp đèn thật, mà không phải dựng 29 cột (mỗi cột là một cụm mesh + một
                // chương trình shader của `TrafficSignalController`).
                maxIntersections: Number(qs.get("lights") ?? 12) || 12,
                solids: engine.citySolids,
              });

        // BUS 06 CHẠY THÊM MỘT VÒNG QUA ĐẠI LỘ CỦA THÀNH PHỐ. Không phải vòng lặp xe buýt thứ hai:
        // cùng `BusCircuit` + `BusRouteController` + `TrafficManager` của engine, chỉ thêm một vòng
        // đường nối tiếp tuyến 06 của map chuẩn ở cổng `END_LTT_S`.
        if (qs.get("bus") !== "0") {
          const circuit = buildCityBusCircuit(engine.traffic.graph, extension.edgeIds);
          if (circuit) {
            void spawnCityBus(engine.traffic, circuit.circuit, { parent: engine.exteriorGroup })
              .then((bus) => {
                if (cancelled) {
                  bus.dispose();
                  return;
                }
                cityBus = bus;
                console.info("[saigon] Bus 06 vòng thành phố ·", circuit.edgeIds.join(" → "), "·", Math.round(circuit.circuit.length), "m");
              })
              .catch((err) => console.error("[saigon] xe buýt thành phố lỗi", err));
          }
        }

        (window as unknown as { __saigonEngine?: unknown }).__saigonEngine = {
          buildMs,
          software,
          trees: layer.trees,
          corridors: extension.corridors,
          junctions: extension.junctions.length,
          portals: extension.portals,
          signalized: signals.signalized,
          signalPoles: signals.poles,
          citySolids: engine.citySolids.length,
          vehicles: extension.edgeIds.length,
          scene: engine.scene,
          engine,
        };
        setStatus("");
        console.info(
          "[saigon] thành phố cấy vào engine trong",
          buildMs,
          "ms ·",
          extension.corridors,
          "tuyến ·",
          engine.citySolids.length,
          "khối cản · biên",
          JSON.stringify(engine.cityBounds),
          "· cờ phần mềm",
          software,
        );
        // Giữ tham chiếu để shader gió của cây chạy theo thời gian của engine (engine đã tự vẽ
        // scene; uniform này chỉ cần một giá trị thời gian, đặt ở đây để không đụng vòng lặp).
        // Vòng cập nhật của xe buýt thành phố chạy trong hook **sau** khối mô phỏng giao thông của
        // engine — cùng `dt`, cùng thứ tự với Bus 06 của map chuẩn. Không mở vòng lặp thứ hai và
        // cũng không bọc `traffic.step` (hook `afterTrafficStep` chỉ là một ô trống mặc định `null`,
        // `/testbus` không bị ảnh hưởng).
        engine.afterTrafficStep = (dt) => cityBus?.update(dt);

        const wind = layer.wind;
        if (wind) {
          const tick = () => {
            if (!wind.uTime) return;
            wind.uTime.value = performance.now() / 1000;
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }

        // KHU PHỐ GỐC: cắm nguyên thế giới đang chơi được của game vào đúng chỗ `cityMesh` đã cắt
        // đất cho nó. Cùng `buildCoreWorld` mà `/saigon?engine=0` dùng — không có bản dựng thứ hai.
        if (city.core.streetId && qs.get("city") !== "0" && qs.get("core") !== "0") {
          setLoad("Đang dựng khu phố gốc…");
          // Phiên bản engine đang chạy (không phải bản sao) — cần giữ tham chiếu trong closure.
          const liveEngine = engine;
          void buildCoreWorld(city.core.x, city.core.z, {
            onWorldReady: (root) => {
              if (cancelled) return;
              // Gắn vào `exteriorGroup` chứ không phải thẳng scene: engine ẩn cả nhóm này khi người
              // chơi còn ở trong phòng 6.07 (`sealExterior`), nên khu phố không bị vẽ sau tấm kính
              // phòng ngủ và cũng không bị engine bỏ quên trong các pha warmup.
              liveEngine.exteriorGroup.add(root);
              liveEngine.renderer.shadowMap.needsUpdate = true;
            },
            humans: qs.get("humans") === "1",
            baothu: qs.get("baothu") === "1",
            nolife: qs.get("nolife") === "1",
          })
            .then((world) => {
              if (cancelled) {
                world.dispose();
                return;
              }
              coreWorld = world;
              if (!world.root.parent) engine?.exteriorGroup.add(world.root);
              if (engine) engine.renderer.shadowMap.needsUpdate = true;
              setLoad(null);
              console.info(
                "[saigon] khu phố gốc cấy vào engine ·",
                world.houses.length,
                "nhà ·",
                world.loaded.props,
                "đồ vỉa hè",
              );
            })
            .catch((err) => {
              console.error("[saigon] khu phố gốc không dựng được", err);
              setLoad(null);
            });
        }

        if (qs.get("t")) {
          const [x, z] = qs.get("t")!.split(",").map(Number);
          if (Number.isFinite(x) && Number.isFinite(z)) engine.feet.set(x, Number(qs.get("ty") ?? 0) || 0, z);
          if (qs.has("yaw")) engine.yaw = Number(qs.get("yaw")) || 0;
          if (qs.has("pitch")) engine.pitch = Number(qs.get("pitch")) || 0;
        }
      } catch (err) {
        console.error("[saigon] engine không dựng được", err);
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      cancelled = true;
      if (engine) engine.afterTrafficStep = null;
      cityBus?.dispose();
      cityBus = null;
      coreWorld?.dispose();
      coreWorld = null;
      engine?.dispose();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black">
      <div ref={mountRef} className="absolute inset-0" />
      {status && (
        <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
          <div className="rounded-full bg-black/70 px-4 py-2 text-sm text-white/90">{status}</div>
        </div>
      )}
      {load && !status && (
        <div className="pointer-events-none absolute inset-x-0 top-6 flex justify-center">
          <div className="rounded-full bg-black/70 px-4 py-2 text-sm text-white/90">{load}</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-x-0 bottom-6 flex justify-center">
          <div className="max-w-xl rounded-lg bg-red-950/80 px-4 py-3 text-sm text-red-100">
            Runtime không dựng được: {error}
          </div>
        </div>
      )}
      {onBackToMenu && (
        <button
          type="button"
          onClick={onBackToMenu}
          className="absolute right-4 top-4 rounded bg-black/60 px-3 py-1.5 text-xs text-white/80 hover:bg-black/80"
        >
          Menu
        </button>
      )}
    </div>
  );
}
