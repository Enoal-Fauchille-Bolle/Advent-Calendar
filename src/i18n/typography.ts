import type { ShownBlock, ShownDay } from "../days.ts";
import type { Language } from "./index.ts";

/** U+00A0. The narrow U+202F of French typography is missing from Fraunces and Nunito. */
const NO_BREAK_SPACE = " ";
const BEFORE_SIGN = / (?=[:;!?»])/g;
const AFTER_QUOTE = /(?<=«) /g;

/**
 * French puts a space before `: ; ! ?` and `»`, and after `«`. A plain space there lets
 * the browser break the line between the word and its sign, leaving a lone "!" at the
 * start of a line. This turns that space into a no-break space. It never adds a space:
 * "Oui!" stays as written.
 */
export function frenchSpaces(text: string): string {
  return text
    .replace(BEFORE_SIGN, NO_BREAK_SPACE)
    .replace(AFTER_QUOTE, NO_BREAK_SPACE);
}

function polishBlock(
  block: ShownBlock,
  fix: (text: string) => string,
): ShownBlock {
  const maybe = (text: string | null) => (text === null ? null : fix(text));
  switch (block.type) {
    case "text":
    case "letter":
      return { ...block, text: fix(block.text) };
    case "list":
      return {
        ...block,
        title: maybe(block.title),
        items: block.items.map(fix),
      };
    case "voucher":
      return {
        ...block,
        title: fix(block.title),
        details: maybe(block.details),
      };
    case "image":
    case "audio":
      return { ...block, caption: maybe(block.caption) };
  }
}

/** The day's shown text with the spacing rules of its language. */
export function polishDay(day: ShownDay, language: Language): ShownDay {
  if (language !== "fr") return day;
  return {
    ...day,
    title: day.title === null ? null : frenchSpaces(day.title),
    blocks: day.blocks.map((block) => polishBlock(block, frenchSpaces)),
  };
}
