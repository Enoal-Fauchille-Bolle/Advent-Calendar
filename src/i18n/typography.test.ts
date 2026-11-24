import { describe, expect, it } from "vitest";
import type { ShownDay } from "../days.ts";
import { frenchSpaces, polishDay } from "./typography.ts";

const NBSP = " ";

describe("frenchSpaces", () => {
  it("keeps each sign on the line of its word", () => {
    expect(frenchSpaces("le film : toi ; oui ! non ? « bon »")).toBe(
      `le film${NBSP}: toi${NBSP}; oui${NBSP}! non${NBSP}? «${NBSP}bon${NBSP}»`,
    );
  });

  it("never adds a space", () => {
    expect(frenchSpaces("Oui! Non? 9:00 «bon»")).toBe("Oui! Non? 9:00 «bon»");
  });

  it("leaves a line break before a sign alone", () => {
    expect(frenchSpaces("Les règles\n: une")).toBe("Les règles\n: une");
  });
});

describe("polishDay", () => {
  const day: ShownDay = {
    day: 1,
    title: "Coucou !",
    blocks: [
      { type: "letter", text: "Bonjour !" },
      { type: "text", text: "Question ?" },
      { type: "list", title: "Liste :", items: ["un !", "deux ?"] },
      {
        type: "voucher",
        title: "Un joker « oui »",
        details: "Quand tu veux !",
      },
      { type: "voucher", title: "Un câlin", details: null },
      { type: "image", url: "/media/1/a.jpg", alt: "", caption: "Nous !" },
      { type: "audio", url: "/media/1/a.m4a", caption: null },
    ],
  };

  it("fixes every shown text in French", () => {
    expect(polishDay(day, "fr")).toEqual({
      day: 1,
      title: `Coucou${NBSP}!`,
      blocks: [
        { type: "letter", text: `Bonjour${NBSP}!` },
        { type: "text", text: `Question${NBSP}?` },
        {
          type: "list",
          title: `Liste${NBSP}:`,
          items: [`un${NBSP}!`, `deux${NBSP}?`],
        },
        {
          type: "voucher",
          title: `Un joker «${NBSP}oui${NBSP}»`,
          details: `Quand tu veux${NBSP}!`,
        },
        { type: "voucher", title: "Un câlin", details: null },
        {
          type: "image",
          url: "/media/1/a.jpg",
          alt: "",
          caption: `Nous${NBSP}!`,
        },
        { type: "audio", url: "/media/1/a.m4a", caption: null },
      ],
    });
  });

  it("leaves English as written", () => {
    expect(polishDay(day, "en")).toBe(day);
  });
});
