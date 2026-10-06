// Minimal toasts: toast('text') anywhere; <Toaster/> shows them.
const EVENT = 'mp-toast';
export const toast = (text: string) => window.dispatchEvent(new CustomEvent(EVENT, { detail: text }));
export const TOAST_EVENT = EVENT;
