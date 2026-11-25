export const ROUTE = {
  number: '06',
  origin: 'Lý Thái Tổ',
  via: 'Châu Văn Liêm',
  destination: 'Chợ Lớn',
  fare: 7000,
  initialCash: 50000,
  start: 8 * 3600,
  deadline: 11 * 3600 + 30 * 60,
  waitMinutes: 4,
  rideMinutes: 34,
  originZ: 0,
  viaZ: -66,
  destinationZ: -128,
  approachZ: 31,
  /**
   * The bus used to wait at `curbX = -1.54`, the east kerb. That is the wrong side of the road for
   * this route: Chợ Lớn is at `x -25.78..-19.06`, so a passenger alighting at -1.54 is still 17.5 m
   * east of the nearest stall, across 12.32 m of moving traffic. The bus now runs the west lane and
   * puts its door on the market side.
   *
   * -12.2 is the west lane centre: the carriageway is `x -12.56..-0.24`, and a 2.55 m body at -12.2
   * spans -13.48..-10.92, so its west flank overhangs the kerb by 0.9 m and the body is clear of the
   * centre line. Alighting puts the passenger on the west pavement, 6.5 m from the market's edge at
   * -19.06 — a pavement walk, not a road crossing.
   *
   * It cannot stop closer than that. The strip between the street's west shop row (dense to x -17)
   * and the market (from -19.06) is a 1.5 m gap, and the bus is 2.55 m wide.
   */
  curbX: -12.2,
} as const;

export type Phase = 'waiting' | 'approaching' | 'boarding' | 'departing' | 'driving' | 'arrived' | 'complete';
export type DoorId = 'front' | 'rear';
export type TransitEvent = {
  type: 'wait-started' | 'bus-at-stop' | 'boarded' | 'left-bus' | 'fare-paid' | 'departed' | 'passed-stop' | 'arrived' | 'transfer-complete';
  at: number;
  route: string;
  stop?: string;
  amount?: number;
  onTime?: boolean;
};

export interface TransitHost {
  clock?: { read: () => number; advance: (seconds: number) => void };
  wallet?: { read: () => number; debit: (amount: number) => boolean };
  onEvent?: (event: TransitEvent) => void;
}

export const formatClock = (seconds: number) => {
  const minutes = Math.floor(seconds / 60) % (24 * 60);
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
};
export const formatCash = (amount: number) => `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
export const clamp = (n: number, min = 0, max = 1) => Math.min(max, Math.max(min, n));
export const smooth = (n: number) => n * n * (3 - 2 * n);
export const damp = (n: number, target: number, speed: number, dt: number) => n + (target - n) * (1 - Math.exp(-speed * dt));

export class BusDoorController {
  amount = 0;
  target = 0;

  get passable() { return this.amount >= 0.93; }
  get sealed() { return this.amount === 0; }

  step(dt: number, obstructed: boolean) {
    if (obstructed && this.target === 0 && this.amount > 0) this.target = 1;
    this.amount = this.target === 1 ? Math.min(1, this.amount + dt / 0.9) : Math.max(0, this.amount - dt / 1.08);
  }
}

export class BusRouteController {
  phase: Phase = 'waiting';
  readonly doors = { front: new BusDoorController(), rear: new BusDoorController() };
  x: number = ROUTE.curbX;
  z: number = ROUTE.approachZ;
  yaw = 0;
  speed = 0;
  paid = false;
  onTime = true;
  progress = 0;
  private cash: number = ROUTE.initialCash;
  private seconds: number = ROUTE.start;
  private nextBus: number;
  private approach = 0;
  private driving = 0;
  private driveThrottle = 1;
  private via = false;
  accel = 0;

  private host: TransitHost;
  constructor(host: TransitHost = {}) {
    this.host = host;
    this.nextBus = this.clock + ROUTE.waitMinutes * 60;
  }

  get clock() { return this.host.clock?.read() ?? this.seconds; }
  get balance() { return this.host.wallet?.read() ?? this.cash; }
  /**
   * True when the bus runs on the chapter's own clock. Then the ride costs real game minutes and the
   * demo accelerators (12x while waiting, 5x otherwise) must be off, and waiting must not fast-forward:
   * on a story clock, four minutes of waiting is four minutes the player actually spends.
   */
  private get storyClock() { return this.host.clock !== undefined; }

  emit(type: TransitEvent['type'], details: Partial<TransitEvent> = {}) {
    this.host.onEvent?.({ type, at: this.clock, route: ROUTE.number, ...details });
  }

  private advance(seconds: number) {
    if (this.host.clock) this.host.clock.advance(seconds);
    else this.seconds += seconds;
  }

  wait() {
    if (this.phase !== 'waiting') return false;
    // On the chapter clock the wait is spent, not skipped: `update` arrives the bus when the clock
    // says so. On the demo clock the wait is compressed so /testbus stays a 40-second loop.
    if (!this.storyClock) this.advance(Math.max(0, this.nextBus - this.clock));
    this.phase = 'approaching';
    this.emit('wait-started', { stop: ROUTE.origin });
    return true;
  }

  toggleDoor(id: DoorId, blocked: boolean) {
    if (this.phase !== 'boarding' && this.phase !== 'arrived' && this.phase !== 'complete') return false;
    const door = this.doors[id];
    if (door.target && blocked) return false;
    door.target = 1 - door.target;
    return true;
  }

  pay(onboard: boolean) {
    if (!onboard || this.phase !== 'boarding') return false;
    if (this.paid) return true;
    if (this.host.wallet ? !this.host.wallet.debit(ROUTE.fare) : this.cash < ROUTE.fare) return false;
    if (!this.host.wallet) this.cash -= ROUTE.fare;
    this.paid = true;
    this.emit('fare-paid', { amount: ROUTE.fare });
    return true;
  }

  depart(onboard: boolean, obstruction: boolean) {
    if (!onboard || obstruction || !this.paid || this.phase !== 'boarding') return false;
    this.phase = 'departing';
    this.doors.front.target = this.doors.rear.target = 0;
    return true;
  }

  passengerCrossed(onboard: boolean, ashore = false) {
    this.emit(onboard ? 'boarded' : 'left-bus');
    if (!onboard && ashore) this.reachSidewalk();
  }

  reachSidewalk() {
    if (this.phase !== 'arrived') return;
    this.phase = 'complete';
    this.onTime = this.clock <= ROUTE.deadline;
    this.emit('transfer-complete', { stop: ROUTE.destination, onTime: this.onTime });
  }

  update(dt: number, occupied: Record<DoorId, boolean>, approachBlocked: boolean, maxSafeSpeed?: number) {
    const oldPosition = this.z;
    const prevSpeed = this.speed;
    if (this.phase !== 'driving') {
      this.advance(dt * (this.storyClock ? 1 : this.phase === 'waiting' ? 12 : 5));
    }
    if (this.phase === 'waiting' && this.clock >= this.nextBus) this.wait();
    if (this.phase === 'approaching') {
      const canMove = !approachBlocked && (maxSafeSpeed === undefined || maxSafeSpeed > 0.35);
      if (canMove) this.approach = clamp(this.approach + dt / 6.8);
      this.z = ROUTE.approachZ * (1 - this.approach ** 1.14 * (2 - this.approach ** 1.14));
      if (this.approach >= 1) {
        this.phase = 'boarding';
        this.emit('bus-at-stop', { stop: ROUTE.origin });
      }
    }

    this.doors.front.step(dt, occupied.front);
    this.doors.rear.step(dt, occupied.rear);
    if (this.phase === 'departing') {
      if (occupied.front || occupied.rear) {
        this.phase = 'boarding';
        if (occupied.front) this.doors.front.target = 1;
        if (occupied.rear) this.doors.rear.target = 1;
      } else if (this.doors.front.sealed && this.doors.rear.sealed) {
        this.phase = 'driving';
        this.emit('departed', { stop: ROUTE.origin });
      }
    }
    if (this.phase === 'driving') {
      const previous = this.driving;
      // Compute nominal cruise speed along the smoothstep curve, then obey traffic signals & leaders!
      const deriv = Math.max(0.15, 6 * this.driving * (1 - this.driving));
      const nominalSpeed = (Math.abs(ROUTE.destinationZ) / 30) * deriv;
      const targetThrottle =
        maxSafeSpeed !== undefined ? clamp(maxSafeSpeed / Math.max(nominalSpeed, 0.8), 0, 1) : 1;
      const rate = targetThrottle < this.driveThrottle ? 4.2 : 1.6;
      this.driveThrottle = damp(this.driveThrottle, targetThrottle, rate, dt);

      this.driving = clamp(this.driving + (dt / 30) * this.driveThrottle);
      this.advance((this.driving - previous) * ROUTE.rideMinutes * 60);
      this.progress = smooth(this.driving);
      this.z = ROUTE.destinationZ * this.progress;
      this.x = ROUTE.curbX - 0.78 * Math.sin(Math.PI * this.progress) ** 2;
      this.yaw = Math.atan2(0.78 * Math.PI * Math.sin(2 * Math.PI * this.progress), -ROUTE.destinationZ);
      if (!this.via && this.z <= ROUTE.viaZ) {
        this.via = true;
        this.emit('passed-stop', { stop: ROUTE.via });
      }
      if (this.driving >= 1) {
        this.phase = 'arrived';
        this.yaw = 0;
        this.doors.front.target = this.doors.rear.target = 1;
        this.emit('arrived', { stop: ROUTE.destination });
      }
    }
    this.speed = dt > 0 ? Math.abs(this.z - oldPosition) / dt : 0;
    this.accel = dt > 0 ? (this.speed - prevSpeed) / dt : 0;
  }
}