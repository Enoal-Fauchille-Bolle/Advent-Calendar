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

/**
 * A block as a door shows it. A door is a button, so its preview holds no link, player
 * or other control: only text and pictures, in spans.
 */
function previewBlock(block: ShownBlock): HTMLElement {
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
      return element(
        "span",
        "preview-audio",
        block.caption === null ? "▶" : `▶ ${block.caption}`,
      );
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
    for (const block of shown.blocks) preview.append(previewBlock(block));
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
// half covers the strip, and lengthens the loop so each copy keeps the same speed.
const banner = document.querySelector<HTMLElement>(".banner");
const track = banner?.querySelector<HTMLElement>(".banner-track");
const copy = track?.querySelector<HTMLElement>("span");
/** Seconds one copy takes to scroll by its own width, as in the stylesheet. */
const SECONDS_PER_COPY = 30;

function fillBanner(): void {
  if (banner === null || track === null || track === undefined) return;
  if (copy === null || copy === undefined) return;
  const copyWidth = copy.getBoundingClientRect().width;
  if (copyWidth === 0) return;
  const perHalf = Math.max(1, Math.ceil(banner.clientWidth / copyWidth));
  if (track.children.length === 2 * perHalf) return;
  const clones = Array.from(
    { length: 2 * perHalf - 1 },
    () => copy.cloneNode(true) as HTMLElement,
  );
  track.replaceChildren(copy, ...clones);
  track.style.setProperty(
    "--banner-duration",
    `${String(perHalf * SECONDS_PER_COPY)}s`,
  );
}

// Again when the window changes width, or when the web font loads and widens the text.
if (banner !== null && copy !== null && copy !== undefined) {
  const observer = new ResizeObserver(fillBanner);
  observer.observe(banner);
  observer.observe(copy);
}
