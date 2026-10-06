import { useEffect, useState } from 'react';
import { TOAST_EVENT } from '../lib/toast';

/** Stacks short messages above the player, each for ~2.5 s. */
export const Toaster = () => {
  const [items, setItems] = useState<{ id: number; text: string }[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const id = Date.now() + Math.random();
      setItems(x => [...x.slice(-2), { id, text: (e as CustomEvent<string>).detail }]);
      setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 2500);
    };
    window.addEventListener(TOAST_EVENT, on);
    return () => window.removeEventListener(TOAST_EVENT, on);
  }, []);
  return (
    <div className="fixed inset-x-0 bottom-[calc(9rem+env(safe-area-inset-bottom))] md:bottom-28 z-50 flex flex-col items-center gap-2 pointer-events-none" role="status" aria-live="polite">
      {items.map(i => (
        <div key={i.id} className="px-4 py-2 rounded-full bg-white text-black text-sm font-medium shadow-xl animate-[toast-in_.2s_ease-out]">{i.text}</div>
      ))}
    </div>
  );
};
