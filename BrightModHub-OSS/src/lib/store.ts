// ==========================================
// Zustand Store — Client-Side State
// ==========================================

import { create } from 'zustand';
import {
  DimensionUpdate,
  ConnectionState,
  TrackedUser,
  DetectionEvent,
  ChatMessage,
  getBotThreatLevel,
  getKarmaLevel,
  getUserCategory,
  type ThreatLevel,
  type KarmaLevel,
  type UserCategory,
  type ChannelConfig,
} from '../types';
import { Locale } from './i18n';

interface LiveEvent {
  id: string;
  username: string;
  botDelta: number;
  karmaDelta: number;
  newBotScore: number;
  newKarmaScore: number;
  detector: string;
  botThreatLevel: ThreatLevel;
  karmaLevel: KarmaLevel;
  timestamp: number;
}

interface ChatEntry {
  id: string;
  username: string;
  displayName: string;
  message: string;
  timestamp: number;
  isSub: boolean;
  isMod: boolean;
  isVip: boolean;
}

export type AppTab = 'dashboard' | 'settings' | 'history';
export type ThemeMode = 'dark' | 'light';
export type UserFilter = 'all' | 'bot' | 'no_lifer' | 'command_spammer' | 'communicative';

interface AppState {
  // Settings
  locale: Locale;
  activeTab: AppTab;
  theme: ThemeMode;
  soundEnabled: boolean;

  // Connection
  connectionState: ConnectionState;
  channel: string;
  isMonitoring: boolean;

  // Spam mode
  spamMode: boolean;
  gracePeriod: boolean;

  // Channel config
  channelConfig: ChannelConfig | null;
  channelConfigLoading: boolean;

  // Live data
  users: Map<string, TrackedUser & { botThreatLevel: ThreatLevel; karmaLevel: KarmaLevel; category: UserCategory }>;
  userFilter: UserFilter;
  liveEvents: LiveEvent[];
  chatMessages: ChatEntry[];
  gapEvents: { startTime: number; endTime: number; durationMs: number }[];

  // Whitelist
  whitelist: Set<string>;

  // User detail panel
  selectedUser: string | null;

  // Stats
  messagesProcessed: number;
  flagsRaised: number;
  wsConnected: boolean;

  // Actions
  hydrateSettings: () => void;
  setLocale: (locale: Locale) => void;
  setActiveTab: (tab: AppTab) => void;
  setTheme: (theme: ThemeMode) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setConnectionState: (state: ConnectionState) => void;
  setChannel: (channel: string) => void;
  setMonitoring: (monitoring: boolean) => void;
  setSpamMode: (mode: boolean) => void;
  setGracePeriod: (active: boolean) => void;
  setUserFilter: (filter: UserFilter) => void;
  setChannelConfig: (config: ChannelConfig | null) => void;
  setChannelConfigLoading: (loading: boolean) => void;
  updateChannelConfigField: (
    section: keyof ChannelConfig,
    field: string,
    value: number
  ) => ChannelConfig;
  processDimensionUpdate: (updates: DimensionUpdate[]) => void;
  processChatMessage: (msg: ChatMessage) => void;
  addGapEvent: (gap: { startTime: number; endTime: number; durationMs: number }) => void;
  setWsConnected: (connected: boolean) => void;
  setInitialUsers: (users: TrackedUser[]) => void;
  toggleWhitelist: (username: string) => void;
  isWhitelisted: (username: string) => boolean;
  setSelectedUser: (username: string | null) => void;
  reset: () => void;
}

const MAX_LIVE_EVENTS = 200;
const MAX_CHAT_MESSAGES = 500;

// Persistent settings keys
const STORAGE_KEYS = {
  locale: 'brightmod-locale',
  theme: 'brightmod-theme',
  sound: 'brightmod-sound',
  whitelist: 'brightmod-whitelist',
} as const;

function enrichUser(user: TrackedUser): TrackedUser & { botThreatLevel: ThreatLevel; karmaLevel: KarmaLevel; category: UserCategory } {
  const botThreatLevel = getBotThreatLevel(user.botScore);
  const karmaLevel = getKarmaLevel(user.karmaScore);
  return {
    ...user,
    botThreatLevel,
    karmaLevel,
    category: getUserCategory(user.botScore, user.noLiferFlag, user.commandSpammerFlag, user.communicativeRank),
  };
}

export const useStore = create<AppState>((set, get) => ({
  // Initial state — defaults to avoid hydration mismatch;
  // real values loaded via hydrateSettings() after mount.
  locale: 'de',
  activeTab: 'dashboard' as AppTab,
  theme: 'dark' as ThemeMode,
  soundEnabled: false,
  connectionState: ConnectionState.DISCONNECTED,
  channel: '',
  isMonitoring: false,
  spamMode: false,
  gracePeriod: false,
  channelConfig: null,
  channelConfigLoading: false,
  users: new Map(),
  userFilter: 'all',
  liveEvents: [],
  chatMessages: [],
  gapEvents: [],
  whitelist: new Set(),
  selectedUser: null,
  messagesProcessed: 0,
  flagsRaised: 0,
  wsConnected: false,

  // Actions
  hydrateSettings: () => {
    if (typeof window === 'undefined') return;

    const locale = localStorage.getItem(STORAGE_KEYS.locale);
    if (locale === 'en' || locale === 'de') {
      set({ locale });
    }

    const theme = localStorage.getItem(STORAGE_KEYS.theme);
    if (theme === 'light' || theme === 'dark') {
      set({ theme });
      document.documentElement.classList.toggle('light', theme === 'light');
      document.documentElement.classList.toggle('dark', theme === 'dark');
    }

    const sound = localStorage.getItem(STORAGE_KEYS.sound);
    if (sound === 'true') {
      set({ soundEnabled: true });
    }

    const wl = localStorage.getItem(STORAGE_KEYS.whitelist);
    if (wl) {
      try {
        const arr = JSON.parse(wl);
        if (Array.isArray(arr)) {
          set({ whitelist: new Set(arr) });
        }
      } catch {}
    }
  },

  setLocale: (locale) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.locale, locale);
    }
    set({ locale });
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  setTheme: (theme) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.theme, theme);
    }
    set({ theme });
  },

  setSoundEnabled: (enabled) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.sound, String(enabled));
    }
    set({ soundEnabled: enabled });
  },

  setConnectionState: (state) => set({ connectionState: state }),

  setChannel: (channel) => set({ channel }),

  setMonitoring: (monitoring) => set({ isMonitoring: monitoring }),

  setSpamMode: (mode) => set({ spamMode: mode }),

  setGracePeriod: (active) => set({ gracePeriod: active }),

  setUserFilter: (filter) => set({ userFilter: filter }),

  setChannelConfig: (config) => set({ channelConfig: config }),

  setChannelConfigLoading: (loading) => set({ channelConfigLoading: loading }),

  updateChannelConfigField: (section, field, value) => {
    const state = get();
    if (!state.channelConfig) {
      throw new Error('No channel config loaded');
    }
    const sectionData = state.channelConfig[section] as Record<string, number>;
    const updated: ChannelConfig = {
      ...state.channelConfig,
      [section]: {
        ...sectionData,
        [field]: value,
      },
    };
    set({ channelConfig: updated });
    return updated;
  },

  processDimensionUpdate: (updates) => set((state) => {
    const newUsers = new Map(state.users);
    const newEvents = [...state.liveEvents];
    let newFlags = state.flagsRaised;
    let playSound = false;

    for (const update of updates) {
      const existing = newUsers.get(update.username);

      // Skip whitelisted users
      if (state.whitelist.has(update.username)) continue;

      const prevBotScore = existing?.botScore ?? 0;

      const baseUser: TrackedUser = {
        username: update.username,
        displayName: existing?.displayName || update.username,
        score: update.botScore,
        botScore: update.botScore,
        karmaScore: update.karmaScore,
        isSubscriber: existing?.isSubscriber || false,
        isMod: existing?.isMod || false,
        isVip: existing?.isVip || false,
        subMonths: existing?.subMonths || 0,
        firstSeen: existing?.firstSeen || new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        totalMessages: existing?.totalMessages || 0,
        totalFlags: (existing?.totalFlags || 0) + (update.botDelta > 0 ? 1 : 0),
        noLiferFlag: update.noLiferFlag || existing?.noLiferFlag || false,
        commandSpammerFlag: update.commandSpammerFlag || existing?.commandSpammerFlag || false,
        communicativeRank: update.communicativeRank || existing?.communicativeRank || 'neutral',
        avgMessageLength: existing?.avgMessageLength || 0,
        replyRatio: existing?.replyRatio || 0,
        uniqueRecipients: existing?.uniqueRecipients || 0,
        messagesPerMinute: existing?.messagesPerMinute || 0,
        commandRatio: update.commandRatio ?? existing?.commandRatio ?? 0,
      };

      newUsers.set(update.username, enrichUser(baseUser));

      newEvents.unshift({
        id: `${Date.now()}-${update.username}-${Math.random().toString(36).slice(2, 6)}`,
        username: update.username,
        botDelta: update.botDelta,
        karmaDelta: update.karmaDelta,
        newBotScore: update.botScore,
        newKarmaScore: update.karmaScore,
        detector: update.detector,
        botThreatLevel: update.botThreatLevel,
        karmaLevel: update.karmaLevel,
        timestamp: Date.now(),
      });

      if (update.botDelta > 0) newFlags++;

      // Sound alert: user crossed suspicious bot threshold
      if (prevBotScore <= 100 && update.botScore > 100) {
        playSound = true;
      }
    }

    // Play alert sound if enabled
    if (playSound && state.soundEnabled && typeof window !== 'undefined') {
      playAlertSound();
    }

    if (newEvents.length > MAX_LIVE_EVENTS) {
      newEvents.length = MAX_LIVE_EVENTS;
    }

    return {
      users: newUsers,
      liveEvents: newEvents,
      flagsRaised: newFlags,
    };
  }),

  processChatMessage: (msg) => set((state) => {
    const newUsers = new Map(state.users);

    const existing = newUsers.get(msg.username);
    if (existing) {
      newUsers.set(msg.username, {
        ...existing,
        displayName: msg.displayName,
        lastSeen: new Date().toISOString(),
        totalMessages: existing.totalMessages + 1,
        isSubscriber: msg.isSub || existing.isSubscriber,
        isMod: msg.isMod || existing.isMod,
        isVip: msg.isVip || existing.isVip,
      });
    } else {
      newUsers.set(msg.username, enrichUser({
        username: msg.username,
        displayName: msg.displayName,
        score: 0,
        botScore: 0,
        karmaScore: 0,
        isSubscriber: msg.isSub,
        isMod: msg.isMod,
        isVip: msg.isVip,
        subMonths: msg.subMonths,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        totalMessages: 1,
        totalFlags: 0,
        noLiferFlag: false,
        commandSpammerFlag: false,
        communicativeRank: 'neutral',
        avgMessageLength: 0,
        replyRatio: 0,
        uniqueRecipients: 0,
        messagesPerMinute: 0,
        commandRatio: 0,
      }));
    }

    const newChatMessages = [{
      id: `${Date.now()}-${msg.username}-${Math.random().toString(36).slice(2, 6)}`,
      username: msg.username,
      displayName: msg.displayName,
      message: msg.message,
      timestamp: msg.timestamp,
      isSub: msg.isSub,
      isMod: msg.isMod,
      isVip: msg.isVip,
    }, ...state.chatMessages];

    if (newChatMessages.length > MAX_CHAT_MESSAGES) {
      newChatMessages.length = MAX_CHAT_MESSAGES;
    }

    return {
      users: newUsers,
      chatMessages: newChatMessages,
      messagesProcessed: state.messagesProcessed + 1,
    };
  }),

  addGapEvent: (gap) => set((state) => ({
    gapEvents: [...state.gapEvents, gap],
  })),

  setWsConnected: (connected) => set({ wsConnected: connected }),

  setInitialUsers: (users) => set(() => {
    const userMap = new Map<string, TrackedUser & { botThreatLevel: ThreatLevel; karmaLevel: KarmaLevel; category: UserCategory }>();
    for (const user of users) {
      userMap.set(user.username, enrichUser(user));
    }
    return { users: userMap };
  }),

  toggleWhitelist: (username) => set((state) => {
    const newWhitelist = new Set(state.whitelist);
    if (newWhitelist.has(username)) {
      newWhitelist.delete(username);
    } else {
      newWhitelist.add(username);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.whitelist, JSON.stringify([...newWhitelist]));
    }
    return { whitelist: newWhitelist };
  }),

  isWhitelisted: (username) => get().whitelist.has(username),

  setSelectedUser: (username) => set({ selectedUser: username }),

  reset: () => set({
    connectionState: ConnectionState.DISCONNECTED,
    isMonitoring: false,
    spamMode: false,
    gracePeriod: false,
    users: new Map(),
    userFilter: 'all',
    liveEvents: [],
    chatMessages: [],
    gapEvents: [],
    messagesProcessed: 0,
    flagsRaised: 0,
    selectedUser: null,
  }),
}));

// Simple alert sound using Web Audio API
function playAlertSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch {}
}
