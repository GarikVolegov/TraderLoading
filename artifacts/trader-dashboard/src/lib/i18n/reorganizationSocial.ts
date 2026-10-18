import type { Language } from "../i18n";

const it = {
  title: "Social", subtitle: "Persone, conversazioni e competizioni in un unico spazio.",
  conversations: "Conversazioni", activity: "Attività", competitions: "Competizioni",
  navigation: "Sezioni Social", all: "Tutte", private: "Messaggi privati", community: "Community",
  myCommunity: "Le mie community", explore: "Esplora community", create: "Crea community",
  search: "Cerca nelle conversazioni", empty: "Scegli una conversazione",
  emptyHint: "Apri un messaggio privato o una community dall’elenco.",
  noContacts: "Nessun contatto disponibile", find: "Trova trader", noCommunity: "Non partecipi ancora a una community",
  unavailable: "Questa conversazione non è disponibile", back: "Torna alle conversazioni",
  xp: "Classifica XP", tournament: "Torneo", path: "Il mio percorso", competitionNavigation: "Viste competizioni",
  paymentWaiting: "L’accesso sarà disponibile dopo la conferma del pagamento.",
  paymentCancelled: "Pagamento annullato. Puoi riprovare dal canale.", retry: "Riprova",
  voiceMute: "Disattiva microfono", voiceUnmute: "Attiva microfono", voiceLeave: "Esci dal canale vocale",
  chatNotReady: "Chat non pronta. L’invio è sospeso: riprova.",
  attachmentPending: "Invio dell’allegato non confermato. Riprova prima di ricaricare la pagina.",
};
type SocialCopy = { [K in keyof typeof it]: string };
const copy: Record<Language, SocialCopy> = {
  it,
  en: {
    attachmentPending: "Attachment delivery not confirmed. Retry before reloading the page.",
    chatNotReady: "Chat is not ready. Sending is paused: retry.",
    voiceMute: "Mute microphone", voiceUnmute: "Unmute microphone", voiceLeave: "Leave voice channel",
    title: "Social", subtitle: "People, conversations and competitions in one place.", conversations: "Conversations", activity: "Activity", competitions: "Competitions", navigation: "Social sections", all: "All", private: "Direct messages", community: "Communities", myCommunity: "My communities", explore: "Explore communities", create: "Create community", search: "Search conversations", empty: "Choose a conversation", emptyHint: "Open a direct message or a community from the list.", noContacts: "No contacts available", find: "Find traders", noCommunity: "You haven’t joined a community yet", unavailable: "This conversation is unavailable", back: "Back to conversations", xp: "XP ranking", tournament: "Tournament", path: "My progress", competitionNavigation: "Competition views", paymentWaiting: "Access will become available once payment is confirmed.", paymentCancelled: "Payment cancelled. You can try again from the channel.", retry: "Retry",
  },
  es: {
    attachmentPending: "Envío del adjunto no confirmado. Reintenta antes de recargar la página.",
    chatNotReady: "El chat no está listo. El envío está en pausa: reintenta.",
    voiceMute: "Desactivar micrófono", voiceUnmute: "Activar micrófono", voiceLeave: "Salir del canal de voz",
    title: "Social", subtitle: "Personas, conversaciones y competiciones en un solo lugar.", conversations: "Conversaciones", activity: "Actividad", competitions: "Competiciones", navigation: "Secciones sociales", all: "Todas", private: "Mensajes privados", community: "Comunidades", myCommunity: "Mis comunidades", explore: "Explorar comunidades", create: "Crear comunidad", search: "Buscar conversaciones", empty: "Elige una conversación", emptyHint: "Abre un mensaje privado o una comunidad de la lista.", noContacts: "No hay contactos disponibles", find: "Buscar traders", noCommunity: "Todavía no participas en una comunidad", unavailable: "Esta conversación no está disponible", back: "Volver a las conversaciones", xp: "Clasificación XP", tournament: "Torneo", path: "Mi progreso", competitionNavigation: "Vistas de competición", paymentWaiting: "El acceso estará disponible cuando se confirme el pago.", paymentCancelled: "Pago cancelado. Puedes volver a intentarlo desde el canal.", retry: "Reintentar",
  },
  fr: {
    attachmentPending: "Envoi de la pièce jointe non confirmé. Réessayez avant de recharger la page.",
    chatNotReady: "Le chat n’est pas prêt. L’envoi est suspendu : réessayez.",
    voiceMute: "Désactiver le microphone", voiceUnmute: "Activer le microphone", voiceLeave: "Quitter le canal vocal",
    title: "Social", subtitle: "Personnes, conversations et compétitions au même endroit.", conversations: "Conversations", activity: "Activité", competitions: "Compétitions", navigation: "Sections sociales", all: "Toutes", private: "Messages privés", community: "Communautés", myCommunity: "Mes communautés", explore: "Explorer les communautés", create: "Créer une communauté", search: "Rechercher une conversation", empty: "Choisissez une conversation", emptyHint: "Ouvrez un message privé ou une communauté dans la liste.", noContacts: "Aucun contact disponible", find: "Trouver des traders", noCommunity: "Vous n’avez pas encore rejoint de communauté", unavailable: "Cette conversation n’est pas disponible", back: "Retour aux conversations", xp: "Classement XP", tournament: "Tournoi", path: "Ma progression", competitionNavigation: "Vues des compétitions", paymentWaiting: "L’accès sera disponible après confirmation du paiement.", paymentCancelled: "Paiement annulé. Vous pouvez réessayer depuis le canal.", retry: "Réessayer",
  },
  de: {
    attachmentPending: "Versand des Anhangs nicht bestätigt. Vor dem Neuladen erneut versuchen.",
    chatNotReady: "Der Chat ist noch nicht bereit. Senden ist pausiert: erneut versuchen.",
    voiceMute: "Mikrofon stummschalten", voiceUnmute: "Mikrofon einschalten", voiceLeave: "Sprachkanal verlassen",
    title: "Social", subtitle: "Menschen, Gespräche und Wettbewerbe an einem Ort.", conversations: "Gespräche", activity: "Aktivität", competitions: "Wettbewerbe", navigation: "Social-Bereiche", all: "Alle", private: "Direktnachrichten", community: "Communitys", myCommunity: "Meine Communitys", explore: "Communitys entdecken", create: "Community erstellen", search: "Gespräche suchen", empty: "Gespräch auswählen", emptyHint: "Öffne eine Direktnachricht oder Community aus der Liste.", noContacts: "Keine Kontakte verfügbar", find: "Trader finden", noCommunity: "Du bist noch keiner Community beigetreten", unavailable: "Dieses Gespräch ist nicht verfügbar", back: "Zurück zu den Gesprächen", xp: "XP-Rangliste", tournament: "Turnier", path: "Mein Fortschritt", competitionNavigation: "Wettbewerbsansichten", paymentWaiting: "Der Zugang wird nach der Zahlungsbestätigung verfügbar.", paymentCancelled: "Zahlung abgebrochen. Du kannst es im Kanal erneut versuchen.", retry: "Erneut versuchen",
  },
};

export function socialText(language: Language, key: keyof SocialCopy): string {
  return copy[language][key];
}
