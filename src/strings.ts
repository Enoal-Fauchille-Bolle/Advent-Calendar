/** Every French text of the interface, in one place so another language can follow. */
export const strings = {
  lang: "fr",
  login: {
    title: "Entre le mot de passe",
    password: "Mot de passe", // betterleaks:allow (a field label)
    submit: "Ouvrir le calendrier",
    wrong: "Ce n'est pas le bon mot de passe.",
    tooMany: (seconds: number) =>
      `Trop d'essais. Réessaie dans ${String(Math.ceil(seconds / 60))} min.`,
  },
  calendar: {
    door: (day: number) => `Porte ${String(day)}`,
    authorMode:
      "Mode auteur : toutes les portes s'ouvrent, même avant leur date.",
    logout: "Se déconnecter",
    close: "Fermer",
  },
  /** Texts the browser script shows, sent to it with the page. */
  client: {
    loading: "Ouverture…",
    locked: "Patience, cette porte s'ouvre",
    empty: "Cette porte est encore vide.",
    error: "La porte est coincée. Réessaie dans un instant.",
    voucher: "Bon pour",
  },
  /** "le 7 décembre à 09:00" */
  unlocksOn: (day: number, month: number, year: number, time: string) => {
    const date = new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(year, month - 1, day)));
    return `le ${date} à ${time}`;
  },
} as const;

export type ClientStrings = typeof strings.client;
