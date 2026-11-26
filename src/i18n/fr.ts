import { formatDay, minutes, type Strings } from "./types.ts";

export const fr: Strings = {
  lang: "fr",
  login: {
    password: "Mot de passe", // betterleaks:allow (a field label)
    submit: "Ouvrir le calendrier",
    wrong: "Ce n'est pas le bon mot de passe.",
    tooMany: (seconds) =>
      `Trop d'essais. Réessaie dans ${minutes(seconds)} min.`,
  },
  calendar: {
    door: (day) => `Porte ${String(day)}`,
    authorBadge: "Auteur",
    authorMode:
      "Mode auteur : toutes les portes s'ouvrent, même avant leur date.",
    notifications: "Notifications",
    notificationTest: "Notification de test",
    logout: "Se déconnecter",
    close: "Fermer",
  },
  tools: {
    label: "Outils de l'auteur",
    openAll: "Tout ouvrir",
    closeAll: "Tout fermer",
    visitorView: "Vue visiteur",
    unlockDates: "Dates d'ouverture",
    check: "Vérifier le contenu",
  },
  client: {
    loading: "Ouverture…",
    locked: "Patience, cette porte s'ouvre",
    empty: "Cette porte est encore vide.",
    error: "La porte est coincée. Réessaie dans un instant.",
    voucher: "Bon pour",
    notificationsBlocked:
      "Les notifications sont bloquées pour ce site. Pour les activer, ouvre les réglages du site dans ton navigateur (souvent l'icône à gauche de l'adresse), autorise les notifications, puis recharge la page.",
    testSent: "Notification envoyée : elle arrive dans quelques secondes.",
    testUnknown:
      "Cet appareil n'est pas enregistré pour les notifications. Recharge la page puis réessaie.",
    testFailed: "L'envoi a échoué. Réessaie dans un instant.",
    checking: "Vérification…",
    checkOk: "Toutes les portes se lisent correctement.",
    checkEmpty: "Encore vides :",
    checkProblem: "Porte {day}",
    checkFailed: "La vérification a échoué. Réessaie dans un instant.",
  },
  share: {
    title: "Calendrier de l'Avent",
    description: "Une surprise derrière chaque porte, jusqu'à Noël",
  },
  push: {
    door: "La porte {day} est ouverte 🎁",
    test: "Les notifications marchent 🎉",
  },
  /** "Mer. 2 déc." */
  shortDate: (now, timeZone) => {
    const date = new Intl.DateTimeFormat("fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone,
    }).format(now);
    return date.charAt(0).toUpperCase() + date.slice(1);
  },
  /** "le 7 décembre à 09:00" */
  unlocksOn: (day, month, year, time) =>
    `le ${formatDay("fr-FR", day, month, year, { day: "numeric", month: "long" })} à ${time}`,
  /** "7 déc., 09:00" */
  doorDate: (day, month, year, time) =>
    `${formatDay("fr-FR", day, month, year, { day: "numeric", month: "short" })}, ${time}`,
};
