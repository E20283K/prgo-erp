/**
 * Audio service for Toast notification sound playback with caching and error safety.
 */

export type ToastSoundTheme = "applepay" | "modern" | "chime" | "pop" | "subtle";
export type ToastSoundType = "success" | "error" | "warning" | "info" | "loading" | "danger";

export interface ToastSoundConfig {
  enabled: boolean;
  theme: ToastSoundTheme;
  volume: number; // 0.0 - 1.0
  telegramToastEnabled?: boolean;
}

export interface ToastSoundThemeInfo {
  id: ToastSoundTheme;
  name: string;
  description: string;
}

export const SOUND_THEMES: ToastSoundThemeInfo[] = [
  {
    id: "applepay",
    name: "Apple Pay (Ding)",
    description: "Klassik Apple Pay tasdiqlash ohangi (aniq va yoqimli)",
  },
  {
    id: "modern",
    name: "Zamonaviy (Modern)",
    description: "Sof garmonik akkordlar, muvozanatli va yengil korporativ ohang",
  },
  {
    id: "chime",
    name: "Mayin qo'ng'iroq (Chime)",
    description: "Kristalldek tiniq jarangli qo'ng'iroq sadosi va sokin pasayish",
  },
  {
    id: "pop",
    name: "Yengil qarsillash (Soft Pop)",
    description: "Qisqa, do'stona va sho'x pufakcha (bubble) ovozlari",
  },
  {
    id: "subtle",
    name: "Sokin minimal (Subtle)",
    description: "Ish muhitini chalg'itmaydigan o'ta sokin mikro-chertishlar",
  },
];

// Audio element pool cache for instant zero-latency playback
const audioCache = new Map<string, HTMLAudioElement>();

function normalizeSoundType(type?: string): "success" | "error" | "warning" | "info" {
  if (!type) return "info";
  if (type === "error" || type === "danger") return "error";
  if (type === "warning") return "warning";
  if (type === "success") return "success";
  return "info";
}

export function getSoundUrl(theme: ToastSoundTheme, type: string): string {
  const normType = normalizeSoundType(type);
  if (theme === "applepay") {
    if (normType === "error") return "/sounds/modern/error.wav";
    if (normType === "warning") return "/sounds/modern/warning.wav";
    return "/sounds/applepay.mp3";
  }
  return `/sounds/${theme}/${normType}.wav`;
}

interface PlaySoundOptions {
  theme?: ToastSoundTheme;
  volume?: number; // 0.0 - 1.0
  force?: boolean; // play even if sound is disabled in store (e.g. preview)
}

/**
 * Safely plays a toast notification sound with the user's configured volume and theme.
 */
export function playToastSound(type: string, options?: PlaySoundOptions): void {
  if (typeof window === "undefined") return;

  try {
    // Dynamic import store state safely to avoid SSR or circular dependencies
    const { useWorkspaceStore } = require("@/store/workspaceStore");
    const soundConfig = useWorkspaceStore.getState().toastSoundConfig;

    const isEnabled = options?.force ? true : soundConfig?.enabled ?? true;
    if (!isEnabled) return;

    const theme: ToastSoundTheme = options?.theme || soundConfig?.theme || "modern";
    const volume: number = Math.max(0, Math.min(1, options?.volume ?? soundConfig?.volume ?? 0.75));

    const url = getSoundUrl(theme, type);

    // Use cached audio or create new
    let audio = audioCache.get(url);
    if (!audio) {
      audio = new Audio(url);
      audio.preload = "auto";
      audioCache.set(url, audio);
    }

    // Set volume and clone or rewind for overlapping triggers
    audio.volume = volume;
    if (!audio.paused) {
      // If already playing, clone node to allow rapid successive plays
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = volume;
      clone.play().catch(() => {
        // Safe catch for browser autoplay policies
      });
    } else {
      audio.currentTime = 0;
      audio.play().catch(() => {
        // Safe catch for browser autoplay policies
      });
    }
  } catch (err) {
    // Graceful degradation if audio subsystem is restricted
  }
}
