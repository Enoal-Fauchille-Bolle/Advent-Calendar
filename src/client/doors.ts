// Opens a door in place: asks the server for the day and shows a preview of it inside
// the door, which stays open on later visits (remembered in this browser). Tapping an
// opened door shows the whole day in the dialog. The server refuses a locked day, so
// this script never holds a surprise early.

type ShownBlock =
  | { type: "text" | "letter"; text: string }
  | { type: "list"; title: string | null; items: string[] }
  | { type: "voucher"; title: string; details: string | null }
  | { type: "image"; url: string; alt: string; caption: string | null }
  | { type: "audio"; url: string; caption: string | null };

interface ShownDay {
  day: number;
  title: string | null;
  blocks: ShownBlock[];
}

interface ClientStrings {
  loading: string;
  locked: string;
  empty: string;
  error: string;
  voucher: string;
  notificationsBlocked: string;
  testSent: string;
  testUnknown: string;
  testFailed: string;
  checking: string;
  checkOk: string;
  checkEmpty: string;
  checkProblem: string;
  checkFailed: string;
}

const strings = JSON.parse(
  document.getElementById("client-strings")?.textContent ?? "{}",
) as ClientStrings;
const dialog = document.querySelector<HTMLDialogElement>("#day-dialog");
const content = dialog?.querySelector<HTMLElement>(".day-content");

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function show(...nodes: Node[]): void {
  if (dialog === null || content === null || content === undefined) return;
  content.replaceChildren(...nodes);
  if (!dialog.open) dialog.showModal();
  // The dialog keeps its scroll between two days: each one starts at its top.
  dialog.scrollTop = 0;
}

function caption(figure: HTMLElement, text: string | null): void {
  if (text !== null)
    figure.append(element("figcaption", "block-caption", text));
}

function renderBlock(block: ShownBlock): HTMLElement {
  switch (block.type) {
    case "text":
    case "letter":
      return element("p", `block block-${block.type}`, block.text);
    case "list": {
      const section = element("section", "block block-list");
      if (block.title !== null) {
        section.append(element("h3", "block-title", block.title));
      }
      const list = element("ol", "block-items");
      for (const item of block.items) list.append(element("li", "", item));
      section.append(list);
      return section;
    }
    case "voucher": {
      const card = element("section", "block block-voucher");
      card.append(
        element("p", "voucher-kicker", strings.voucher),
        element("h3", "voucher-title", block.title),
      );
      if (block.details !== null) {
        card.append(element("p", "voucher-details", block.details));
      }
      return card;
    }
    case "image": {
      const figure = element("figure", "block block-image");
      const image = element("img", "");
      image.src = block.url;
      image.alt = block.alt;
      image.loading = "lazy";
      figure.append(image);
      caption(figure, block.caption);
      return figure;
    }
    case "audio": {
      const figure = element("figure", "block block-audio");
      const audio = element("audio", "");
      audio.src = block.url;
      audio.controls = true;
      audio.preload = "metadata";
      figure.append(audio);
      caption(figure, block.caption);
      return figure;
    }
  }
}

/** Doors opened in this browser, by number. Storage can be missing or refused. */
const STORAGE_KEY = "advent-calendar:opened";

function openedDays(): Set<string> {
  try {
    const saved: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "[]",
    );
    return new Set(
      Array.isArray(saved)
        ? saved.filter((day): day is string => typeof day === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

function remember(day: string): void {
  try {
    const days = openedDays();
    days.add(day);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...days]));
  } catch {
    // Without storage the door still opens; it just closes again on the next visit.
  }
}

/** Days already fetched, for the dialog. */
const fetched = new Map<string, ShownDay>();

type Fetched = ShownDay | "locked" | "empty" | "error";

async function fetchDay(day: string): Promise<Fetched> {
  const known = fetched.get(day);
  if (known !== undefined) return known;
  try {
    const response = await fetch(`/api/days/${day}`, {
      headers: { Accept: "application/json" },
    });
    if (response.status === 401) {
      window.location.assign("/login");
      return "error";
    }
    // 403: the page was loaded before the door opened, and the clock says not yet.
    if (response.status === 403) return "locked";
    if (response.status === 404) return "empty";
    if (!response.ok) return "error";
    const shown = (await response.json()) as ShownDay;
    fetched.set(day, shown);
    return shown;
  } catch {
    return "error";
  }
}

function lockedMessage(door: HTMLButtonElement): string {
  return `${strings.locked} ${door.dataset.unlocks ?? ""}.`;
}

function showMessage(text: string): void {
  show(element("p", "door-message", text));
}

function showDay(shown: ShownDay): void {
  const nodes: Node[] = [];
  if (shown.title !== null) nodes.push(element("h2", "day-title", shown.title));
  for (const block of shown.blocks) nodes.push(renderBlock(block));
  show(...nodes);
}

const SVG = "http://www.w3.org/2000/svg";

/** An SVG element with its attributes. */
function svg(tag: string, attributes: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG, tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  return node;
}

/** Number of bars in the sound wave of an audio preview. */
const BARS = 22;

/**
 * Bars of different heights, like a chat voice message. They only decorate: they do not
 * follow the sound. The same seed always draws the same bars.
 */
function soundWave(seed: number): SVGElement {
  const wave = svg("svg", {
    class: "wave",
    viewBox: `0 0 ${String(BARS * 5 - 2)} 18`,
    preserveAspectRatio: "none",
    "aria-hidden": "true",
  });
  // A small pseudo-random sequence (linear congruential), steady for a given seed.
  let x = (seed * 9301 + 49297) % 233280;
  for (let i = 0; i < BARS; i++) {
    x = (x * 9301 + 49297) % 233280;
    const height = 3 + Math.round((x / 233280) * 13);
    wave.append(
      svg("rect", {
        x: String(i * 5),
        y: String((18 - height) / 2),
        width: "3",
        height: String(height),
        rx: "1.5",
      }),
    );
  }
  return wave;
}

/** A length in seconds as minutes and seconds, such as `1:05`. */
function minutesSeconds(seconds: number): string {
  const whole = Math.round(seconds);
  return `${String(Math.floor(whole / 60))}:${String(whole % 60).padStart(2, "0")}`;
}

/**
 * A voice-message bubble: a play sign, a sound wave and the length, then the caption.
 * The length shows once the browser has read the start of the file.
 */
function audioPreview(
  block: Extract<ShownBlock, { type: "audio" }>,
  seed: number,
): HTMLElement {
  const preview = element("span", "preview-audio");
  const bubble = element("span", "audio-bubble");
  const play = element("span", "audio-play");
  play.append(svg("svg", { viewBox: "0 0 10 10", "aria-hidden": "true" }));
  play.firstElementChild?.append(svg("path", { d: "M1 0.5 9.5 5 1 9.5z" }));
  const time = element("span", "audio-time");
  bubble.append(play, soundWave(seed), time);
  preview.append(bubble);
  if (block.caption !== null) {
    preview.append(element("span", "audio-caption", block.caption));
  }
  const audio = new Audio();
  audio.preload = "metadata";
  audio.addEventListener("loadedmetadata", () => {
    // A stream of unknown length reports Infinity: the bubble then shows no time.
    if (Number.isFinite(audio.duration)) {
      time.textContent = minutesSeconds(audio.duration);
    }
  });
  audio.src = block.url;
  return preview;
}

/**
 * A block as a door shows it. A door is a button, so its preview holds no link, player
 * or other control: only text and pictures, in spans. `seed` varies the drawings from
 * one block to the next.
 */
function previewBlock(block: ShownBlock, seed: number): HTMLElement {
  switch (block.type) {
    case "text":
    case "letter":
      return element("span", `preview-${block.type}`, block.text);
    case "list": {
      const lines = block.items.map((item) => `• ${item}`);
      if (block.title !== null) lines.unshift(block.title);
      return element("span", "preview-list", lines.join("\n"));
    }
    case "voucher": {
      const card = element("span", "preview-voucher");
      card.append(
        element("span", "voucher-kicker", strings.voucher),
        element("span", "voucher-title", block.title),
      );
      return card;
    }
    case "image": {
      const image = element("img", "preview-image");
      image.src = block.url;
      image.alt = "";
      return image;
    }
    case "audio":
      return audioPreview(block, seed);
  }
}

/** Replaces the closed door by a preview of its day. */
function fill(door: HTMLButtonElement, shown: ShownDay): void {
  const preview = element("span", "door-preview");
  const [first] = shown.blocks;
  if (first?.type === "image") {
    // A photo first fills the whole door.
    const image = element("img", "preview-photo");
    image.src = first.url;
    image.alt = "";
    preview.append(image);
  } else {
    if (shown.title !== null) {
      preview.append(element("span", "preview-title", shown.title));
    }
    shown.blocks.forEach((block, index) => {
      preview.append(previewBlock(block, shown.day * 31 + index));
    });
  }
  door.querySelector(".door-preview")?.remove();
  door.append(preview);
  door.dataset.opened = "true";
}

/** The pieces of the closed door each opening animation moves. */
const PIECES: Partial<Record<string, readonly string[]>> = {
  swing: ["whole"],
  double: ["left", "right"],
  tear: ["left", "right"],
  lid: ["whole"],
  fade: ["whole"],
};

/** Waits for a photo in the door to be ready, two seconds at most. */
async function photoReady(door: HTMLButtonElement): Promise<void> {
  const photo = door.querySelector<HTMLImageElement>(".door-preview img");
  if (photo === null) return;
  await Promise.race([
    photo.decode().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 2000)),
  ]);
}

/**
 * Opens a door for the first time: a copy of the closed door covers its preview and
 * moves away (the stylesheet draws the motion, or none under reduced motion).
 */
async function openFirstTime(
  door: HTMLButtonElement,
  shown: ShownDay,
): Promise<void> {
  const animation = door.dataset.animation ?? "none";
  const pieces = PIECES[animation];
  if (pieces === undefined) {
    fill(door, shown);
    return;
  }
  const number = door.querySelector(".door-number")?.textContent ?? "";
  const cover = element("span", `door-cover door-cover--${animation}`);
  cover.setAttribute("aria-hidden", "true");
  for (const piece of pieces) {
    const face = element("span", `door-face door-face--${piece}`);
    face.append(element("span", "door-number", number));
    cover.append(face);
  }
  door.append(cover);
  fill(door, shown);
  await photoReady(door);
  door.dataset.animating = animation;
  await Promise.allSettled(
    door.getAnimations({ subtree: true }).map((running) => running.finished),
  );
  cover.remove();
  delete door.dataset.animating;
}

async function openDoor(door: HTMLButtonElement): Promise<void> {
  const day = door.dataset.day ?? "";
  if (door.dataset.state === "locked") {
    showMessage(lockedMessage(door));
    return;
  }
  if (door.dataset.loading === "true" || door.dataset.opening === "true") {
    return;
  }
  door.dataset.loading = "true";
  const shown = await fetchDay(day);
  delete door.dataset.loading;
  if (shown === "locked") showMessage(lockedMessage(door));
  else if (shown === "empty") showMessage(strings.empty);
  else if (shown === "error") showMessage(strings.error);
  else if (door.dataset.opened === "true") showDay(shown);
  else {
    remember(day);
    // A tap during the opening waits for its end before showing the dialog.
    door.dataset.opening = "true";
    await openFirstTime(door, shown);
    delete door.dataset.opening;
  }
}

// Doors opened on an earlier visit open again, without the dialog.
const remembered = openedDays();
for (const door of document.querySelectorAll<HTMLButtonElement>(
  'button.door[data-state="open"]',
)) {
  const day = door.dataset.day ?? "";
  if (!remembered.has(day)) continue;
  void fetchDay(day).then((shown) => {
    if (typeof shown !== "string") fill(door, shown);
  });
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const door = target.closest<HTMLButtonElement>("button.door");
  if (door !== null) void openDoor(door);
});

// Author mode: the toolbar above the doors. Its tools change the view in this browser
// only; the page leaves the toolbar out for visitors.
const tools = document.querySelector<HTMLElement>(".author-tools");
const toolResult = tools?.querySelector<HTMLElement>(".tools-result");
const doorGrid = document.querySelector<HTMLElement>(".doors");

/** Time between two doors when "open all" opens them one after another. */
const OPEN_ALL_DELAY = 80;

function allDoors(): HTMLButtonElement[] {
  return [...document.querySelectorAll<HTMLButtonElement>("button.door")];
}

/** Turns the toolbar off while a long tool runs, so two never overlap. */
async function busy(task: () => Promise<void>): Promise<void> {
  const controls =
    tools?.querySelectorAll<HTMLButtonElement | HTMLInputElement>(
      "button, input",
    ) ?? [];
  for (const control of controls) control.disabled = true;
  try {
    await task();
  } finally {
    for (const control of controls) control.disabled = false;
  }
}

/**
 * Opens every door the author may open and has not opened yet, one after another, each
 * with its own animation. An empty or broken door stays shut, without a message;
 * "check content" lists them.
 */
async function openAll(): Promise<void> {
  const closed = allDoors().filter(
    (door) =>
      door.dataset.state === "open" &&
      door.dataset.opened !== "true" &&
      door.dataset.opening !== "true",
  );
  // Every day is fetched first, so that the motions start on time.
  const fetchedDays = await Promise.all(
    closed.map((door) => fetchDay(door.dataset.day ?? "")),
  );
  const ready = closed.flatMap((door, index) => {
    const shown = fetchedDays[index];
    return shown === undefined || typeof shown === "string"
      ? []
      : [{ door, shown }];
  });
  await Promise.all(
    ready.map(async ({ door, shown }, index) => {
      await new Promise((resolve) =>
        setTimeout(resolve, index * OPEN_ALL_DELAY),
      );
      remember(door.dataset.day ?? "");
      door.dataset.opening = "true";
      await openFirstTime(door, shown);
      delete door.dataset.opening;
    }),
  );
}

/** Closes every door and forgets them in this browser, as on a first visit. */
function closeAll(): void {
  for (const door of allDoors()) {
    door.querySelector(".door-preview")?.remove();
    delete door.dataset.opened;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Without storage, no door was remembered.
  }
}

/**
 * Shows the doors as a visitor sees them now: a door before its date is locked, and
 * its preview hidden. Switched off, the doors the author had opened open again.
 */
function visitorView(on: boolean): void {
  const remembered = openedDays();
  for (const door of allDoors()) {
    if (door.dataset.unlocked !== "false") continue;
    door.dataset.state = on ? "locked" : "open";
    if (on) {
      door.querySelector(".door-preview")?.remove();
      delete door.dataset.opened;
    } else if (remembered.has(door.dataset.day ?? "")) {
      void fetchDay(door.dataset.day ?? "").then((shown) => {
        if (typeof shown !== "string") fill(door, shown);
      });
    }
  }
}

function showResult(...nodes: Node[]): void {
  if (toolResult === null || toolResult === undefined) return;
  toolResult.replaceChildren(...nodes);
  toolResult.hidden = false;
}

/** Asks the server to read every day, and lists the broken and empty ones. */
async function checkContent(): Promise<void> {
  showResult(element("p", "", strings.checking));
  try {
    const response = await fetch("/api/check", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(`check: ${String(response.status)}`);
    const { empty, problems } = (await response.json()) as {
      empty: number[];
      problems: { day: number; message: string }[];
    };
    const nodes: Node[] = [];
    if (problems.length === 0) nodes.push(element("p", "", strings.checkOk));
    for (const { day, message } of problems) {
      nodes.push(
        element(
          "p",
          "check-door",
          strings.checkProblem.replace("{day}", String(day)),
        ),
        element("pre", "check-message", message),
      );
    }
    if (empty.length > 0) {
      nodes.push(element("p", "", `${strings.checkEmpty} ${empty.join(", ")}`));
    }
    showResult(...nodes);
  } catch {
    showResult(element("p", "", strings.checkFailed));
  }
}

tools?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const tool =
    target.closest<HTMLButtonElement>("button[data-tool]")?.dataset.tool;
  if (tool === "open-all") void busy(openAll);
  else if (tool === "close-all") closeAll();
  else if (tool === "check") void busy(checkContent);
});

tools?.addEventListener("change", (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement)) return;
  if (input.dataset.tool === "visitor-view") visitorView(input.checked);
  else if (input.dataset.tool === "unlock-dates" && doorGrid !== null) {
    doorGrid.dataset.dates = input.checked ? "shown" : "hidden";
  }
});

// The bell asks the browser's permission for notifications. It shows while the answer
// is pending ("default") or refused ("denied"): after a refusal the browser asks no
// more, so a tap explains how to allow them again. `data-permission` lets the
// stylesheet animate the bell only while it waits. The page leaves the bell out when
// the server has no push key.
const bell = document.querySelector<HTMLButtonElement>(
  "button.notify:not(.notify-test)",
);
// Author mode: sends a test notification to this device, in the bell's place.
const testButton =
  document.querySelector<HTMLButtonElement>("button.notify-test");
const vapidKey = bell?.dataset.vapidKey ?? "";
const pushWorks =
  "Notification" in window &&
  "serviceWorker" in navigator &&
  "PushManager" in window;

/** This browser's push subscription, made with the server's current key. */
async function subscription(): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const key = Uint8Array.from(
    atob(vapidKey.replaceAll("-", "+").replaceAll("_", "/")),
    (c) => c.charCodeAt(0),
  );
  const current = await registration.pushManager.getSubscription();
  const currentKey = current?.options.applicationServerKey;
  // A new server key makes the old subscription useless: it is replaced.
  if (
    current !== null &&
    currentKey !== null &&
    currentKey !== undefined &&
    new Uint8Array(currentKey).toString() === key.toString()
  ) {
    return current;
  }
  await current?.unsubscribe();
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: key,
  });
}

/**
 * Sends this browser's subscription to the server, on each visit: the browser may
 * have renewed it, or the server lost it.
 */
async function register(): Promise<void> {
  const current = await subscription();
  await fetch("/api/push/subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(current),
  });
}

function updateBell(): void {
  if (bell === null || !pushWorks || vapidKey === "") return;
  const granted = Notification.permission === "granted";
  bell.dataset.permission = Notification.permission;
  bell.hidden = granted;
  if (testButton !== null) testButton.hidden = !granted;
  if (granted) {
    register().catch((error: unknown) => {
      console.error("push subscription failed", error);
    });
  }
}

updateBell();
bell?.addEventListener("click", () => {
  if (Notification.permission === "denied") {
    showMessage(strings.notificationsBlocked);
    return;
  }
  void Notification.requestPermission().then(updateBell);
});

testButton?.addEventListener("click", () => {
  void (async () => {
    try {
      const { endpoint } = await subscription();
      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint }),
      });
      const { result } = (await response.json()) as { result?: string };
      showMessage(
        result === "sent"
          ? strings.testSent
          : result === "unknown"
            ? strings.testUnknown
            : strings.testFailed,
      );
    } catch {
      showMessage(strings.testFailed);
    }
  })();
});

// The banner scrolls a line of copies of its text by half its width, then starts
// over: the loop looks seamless only while that half covers the whole strip. The page
// holds two copies, enough for a phone; on a wider screen, this adds copies until each
// half covers the strip. The loop lasts as long as half the line takes to pass at the
// speed of the settings (`data-speed`, in pixels per second).
const banner = document.querySelector<HTMLElement>(".banner");
const track = banner?.querySelector<HTMLElement>(".banner-track");
const copy = track?.querySelector<HTMLElement>("span");
const speed = Number(banner?.dataset.speed);

function fillBanner(): void {
  if (banner === null || track === null || track === undefined) return;
  if (copy === null || copy === undefined) return;
  const copyWidth = copy.getBoundingClientRect().width;
  if (copyWidth === 0) return;
  const perHalf = Math.max(1, Math.ceil(banner.clientWidth / copyWidth));
  if (track.children.length !== 2 * perHalf) {
    const clones = Array.from(
      { length: 2 * perHalf - 1 },
      () => copy.cloneNode(true) as HTMLElement,
    );
    track.replaceChildren(copy, ...clones);
  }
  if (speed > 0) {
    const duration = `${String((perHalf * copyWidth) / speed)}s`;
    if (track.style.getPropertyValue("--banner-duration") !== duration) {
      track.style.setProperty("--banner-duration", duration);
    }
  }
}

// Again when the window changes width, or when the web font loads and widens the text.
if (banner !== null && copy !== null && copy !== undefined) {
  const observer = new ResizeObserver(fillBanner);
  observer.observe(banner);
  observer.observe(copy);
}
