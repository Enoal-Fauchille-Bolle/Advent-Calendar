// Opens a door: asks the server for the day, then shows its blocks in the dialog.
// The server refuses a locked day, so this script never holds a surprise early.

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

async function openDoor(door: HTMLButtonElement): Promise<void> {
  const day = door.dataset.day ?? "";
  if (door.dataset.state === "locked") {
    show(
      element(
        "p",
        "door-message",
        `${strings.locked} ${door.dataset.unlocks ?? ""}.`,
      ),
    );
    return;
  }
  show(element("p", "door-message", strings.loading));
  try {
    const response = await fetch(`/api/days/${day}`, {
      headers: { Accept: "application/json" },
    });
    if (response.status === 401) {
      window.location.assign("/login");
      return;
    }
    if (response.status === 403) {
      // The page was loaded before the door opened, and the clock says not yet.
      show(
        element(
          "p",
          "door-message",
          `${strings.locked} ${door.dataset.unlocks ?? ""}.`,
        ),
      );
      return;
    }
    if (response.status === 404) {
      show(element("p", "door-message", strings.empty));
      return;
    }
    if (!response.ok) throw new Error(String(response.status));
    const shown = (await response.json()) as ShownDay;
    const nodes: Node[] = [];
    if (shown.title !== null)
      nodes.push(element("h2", "day-title", shown.title));
    for (const block of shown.blocks) nodes.push(renderBlock(block));
    show(...nodes);
    door.dataset.opened = "true";
  } catch {
    show(element("p", "door-message", strings.error));
  }
}

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const door = target.closest<HTMLButtonElement>("button.door");
  if (door !== null) void openDoor(door);
});
