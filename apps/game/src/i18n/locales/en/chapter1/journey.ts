/** English source text for the `chapter1` namespace, `journey` area: the `/journey` map page. */
const journey = {
  journey: {
    badge: "Journey map",
    back: "Back to menu",
    intro:
      "This page is built from the chapter data at runtime. Missions, paths, steps, clock events, appointments, resources and flags are read from the same scenario the game plays, so the map cannot drift from the build.",
    legend: {
      mission: "Required mission",
      optional: "Optional offer",
      planned: "Planned, no data yet",
      event: "Clock event",
      appointment: "Appointment",
    },
    counts: {
      missions: "Missions",
      optional: "Optional",
      events: "Clock events",
      planned: "Planned",
      written: "Flags written",
      reserved: "Flags reserved",
    },
    sections: {
      timeline: "The 72 hours",
      timelineBody:
        "Tuesday 17:00 to Friday 17:00. A bar runs from the minute a mission opens to its deadline; a dot is a clock event or an appointment.",
      now: "What the player can do now",
      nowBody:
        "Every mission in the scenario. Each card lists its paths in priority order and the steps the task tracker shows.",
      planned: "Reserved for later missions",
      plannedBody:
        "The foundation already declares these flags and stages this cast, but the scenario has no mission data for them yet. Times come from the clock checks and the cast from the cast registry.",
      cast: "Who the player meets",
      castBody:
        "The ten story characters, their mission numbers, and whether they are staged in the 3D street or reachable only through the phone.",
      devices: "Where the story happens",
      devicesBody: "Device items per app, the interactables in the room, and the thesis task that moves the draft.",
      resources: "Start state",
      resourcesBody:
        "The values the chapter starts from. Only time, thesis progress and cash are stated by the brief; the rest are configurable placeholders.",
      flags: "Consequences",
      flagsBody: "The persistent flags something writes today, and the flags the later missions will read.",
      code: "Which code owns what",
      codeBody: "Every path below is checked by a test, so the map cannot name a file that does not exist.",
    },
    labels: {
      opens: "Opens",
      deadline: "Deadline",
      noDeadline: "No deadline",
      optional: "Optional",
      path: "Path",
      steps: "Steps",
      objective: "Objective",
      onFail: "If it fails",
      eventWhen: "When",
      afterAction: "After an action",
      responses: "Replies",
      auto: "Resolves on arrival",
      urgent: "Interrupts writing",
      start: "Start",
      inStreet: "In the street",
      phoneOnly: "Phone only",
      cast: "Cast",
      reads: "Reads",
      items: "Items",
      noSteps: "No steps: a choice, not a checklist.",
      minutes: "{{value}} min",
      gain: "+{{value}}%",
      thesisLabel: "Thesis task",
      timeLeft: "Time left",
      thesis: "Thesis",
      evidence: "Evidence",
      hours: "{{value}} h",
      interactables: "Interactables",
      plannedTitle: {
        m3: "MONEY AND HOUSING",
        m4: "AN ONLINE ACQUAINTANCE",
        m5: "THE RECOVERY OFFER",
      },
      plannedNote: {
        m3: "Money lost to an online job or an investment, debt and a housing deposit: the flags exist, the mission does not.",
        m4: "Maya is registered as an online acquaintance for this mission. No item, event or step exists yet.",
        m5: "A recovery offer that can refer to the earlier loss, three hours before the deadline, with the Training Office as the official channel.",
      },
    },
  },
};

export default journey;
