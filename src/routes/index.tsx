import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronDown, ClipboardList, Download, Menu, Plus, RotateCcw, Settings, Share2, Trophy, Users, Pencil, Trash2, User, X } from "lucide-react";
import { Calculator } from "@/components/Calculator";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Domino Score Counter" },
      { name: "description", content: "Hitung skor domino dengan mudah, hingga 4 pemain. Data tersimpan otomatis." },
    ],
  }),
});

interface Player {
  id: string;
  name: string;
  scores: number[];
  wins: number;
  balance: number; // akumulasi saldo Rp (tidak direset)
}

interface GameSettings {
  winner: number;
  loser1: number;
  loser2: number;
  loser3: number;
  aligAmount: number;
  aligThreshold: number;
}

interface MatchResult {
  playerId: string;
  name: string;
  total: number;
  tier: number;
  amount: number;
}

interface MatchEntry {
  id: string;
  round: number;
  createdAt: string;
  results: MatchResult[];
}

interface VictoryHistoryEntry {
  playerId: string;
  name: string;
  wins: number;
  balance: number;
}

interface StoredState {
  players: Player[];
  settings: GameSettings;
  matchHistory: MatchEntry[];
  recapMode: "off" | "every5";
  lastActivityAt?: string;
  sessionVictoryHistory?: VictoryHistoryEntry[];
}

const STORAGE_KEY = "domino-score-state-v3";
const LEGACY_STORAGE_KEY = "domino-score-state-v2";
const IDLE_SESSION_TIMEOUT_MS = 3 * 60 * 60 * 1000;
const DEFAULT_SETTINGS: GameSettings = {
  winner: 15000,
  loser1: 6000,
  loser2: 5000,
  loser3: 4000,
  aligAmount: 8000,
  aligThreshold: 11,
};
const COLORS = [
  "var(--player-1)",
  "var(--player-2)",
  "var(--player-3)",
  "var(--player-4)",
];

function makePlayer(i: number): Player {
  return { id: crypto.randomUUID(), name: `Player ${i + 1}`, scores: [], wins: 0, balance: 0 };
}

function resetPlayerForNewSession(player: Player): Player {
  return { ...player, scores: [], wins: 0, balance: 0 };
}

function isSessionExpired(lastActivityAt: string | undefined, now = Date.now()): boolean {
  if (!lastActivityAt) return false;
  const lastActivityTime = new Date(lastActivityAt).getTime();
  if (!Number.isFinite(lastActivityTime)) return false;
  return now - lastActivityTime >= IDLE_SESSION_TIMEOUT_MS;
}

function formatRupiah(amount: number): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(safeAmount);
}

function formatRupiahInput(amount: number): string {
  return formatRupiah(amount).replace(/\s/g, " ");
}

function formatCompactRupiah(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1000) return `${amount < 0 ? "-" : "+"}${Math.round(abs / 1000)}K`;
  if (amount === 0) return "0";
  return `${amount > 0 ? "+" : "-"}${abs}`;
}

function normalizeSettings(value?: Partial<GameSettings>): GameSettings {
  const normalized = {
    winner: typeof value?.winner === "number" && !isNaN(value.winner) ? value.winner : DEFAULT_SETTINGS.winner,
    loser1: typeof value?.loser1 === "number" && !isNaN(value.loser1) ? value.loser1 : DEFAULT_SETTINGS.loser1,
    loser2: typeof value?.loser2 === "number" && !isNaN(value.loser2) ? value.loser2 : DEFAULT_SETTINGS.loser2,
    loser3: typeof value?.loser3 === "number" && !isNaN(value.loser3) ? value.loser3 : DEFAULT_SETTINGS.loser3,
    aligAmount: typeof value?.aligAmount === "number" && !isNaN(value.aligAmount) ? value.aligAmount : DEFAULT_SETTINGS.aligAmount,
    aligThreshold: typeof value?.aligThreshold === "number" && !isNaN(value.aligThreshold) ? value.aligThreshold : DEFAULT_SETTINGS.aligThreshold,
  };

  if (
    normalized.winner === 15000 &&
    normalized.loser1 === 4000 &&
    normalized.loser2 === 5000 &&
    normalized.loser3 === 6000
  ) {
    return DEFAULT_SETTINGS;
  }

  return normalized;
}

function getTierPayments(settings: GameSettings, playerCount: number, isAlig = false): number[] {
  if (isAlig) {
    return [settings.aligAmount * Math.max(0, playerCount - 1), ...Array.from({ length: Math.max(0, playerCount - 1) }, () => -settings.aligAmount)];
  }

  return [settings.winner, -settings.loser3, -settings.loser2, -settings.loser1].slice(0, playerCount);
}

function buildMatchEntry(players: Player[], tiers: Map<string, { tier: number; amount: number }>, round: number): MatchEntry {
  return {
    id: crypto.randomUUID(),
    round,
    createdAt: new Date().toISOString(),
    results: players.map((p) => {
      const tierInfo = tiers.get(p.id);
      return {
        playerId: p.id,
        name: p.name,
        total: p.scores.reduce((a, b) => a + b, 0),
        tier: tierInfo?.tier ?? 0,
        amount: tierInfo?.amount ?? 0,
      };
    }),
  };
}

function mergeSessionVictoryHistory(history: VictoryHistoryEntry[], players: Player[]): VictoryHistoryEntry[] {
  const totals = new Map<string, VictoryHistoryEntry>();

  history.forEach((entry) => {
    const wins = typeof entry.wins === "number" && !isNaN(entry.wins) ? entry.wins : 0;
    const balance = typeof entry.balance === "number" && !isNaN(entry.balance) ? entry.balance : 0;
    totals.set(entry.playerId, { ...entry, wins, balance });
  });

  players.forEach((player) => {
    const wins = typeof player.wins === "number" && !isNaN(player.wins) ? player.wins : 0;
    const balance = typeof player.balance === "number" && !isNaN(player.balance) ? player.balance : 0;
    const existing = totals.get(player.id);
    totals.set(player.id, {
      playerId: player.id,
      name: player.name,
      wins: (existing?.wins ?? 0) + wins,
      balance: (existing?.balance ?? 0) + balance,
    });
  });

  return Array.from(totals.values()).filter((entry) => entry.wins !== 0 || entry.balance !== 0);
}

function getResultLabel(tier: number, playerCount: number): string {
  if (tier === 1) return "Menang";
  const lossLevel = playerCount - tier + 1;
  return `Kalah ${lossLevel}`;
}

/**
 * Hitung tier setiap pemain berdasarkan total skor.
 * Tier 1 (pemenang) = total terkecil  → +Rp 15.000
 * Tier 2            = total ke-2 terkecil → -Rp 4.000
 * Tier 3            = total ke-3 terkecil → -Rp 5.000
 * Tier 4            = total terbesar      → -Rp 6.000
 */
function computeTiers(players: Player[], settings: GameSettings, tieOrder: string[] = []): Map<string, { tier: number; amount: number }> {
  const result = new Map<string, { tier: number; amount: number }>();
  const totals = players.map((p) => p.scores.reduce((a, b) => a + b, 0));
  const someoneReached51 = totals.some((t) => t >= 51);
  if (!someoneReached51) return result;

  const ranked = players
    .map((p, i) => ({ id: p.id, total: totals[i] }))
    .sort((a, b) => {
      if (a.total !== b.total) return a.total - b.total;
      const aIdx = tieOrder.indexOf(a.id);
      const bIdx = tieOrder.indexOf(b.id);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return 0;
    });

  const isAlig = ranked[0]?.total < settings.aligThreshold;
  const tierPayments = getTierPayments(settings, players.length, isAlig);
  ranked.forEach((entry, rank) => {
    const tierIndex = Math.min(rank, players.length - 1);
    if (tierIndex >= players.length) return;
    const payment = tierPayments[tierIndex] ?? -settings.loser3;
    result.set(entry.id, { tier: tierIndex + 1, amount: payment });
  });

  return result;
}

// ===== Install Guide Banner =====
function useInstallGuide() {
  const isStandalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent) && !(window as unknown as Record<string, unknown>).MSStream;
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  // Show if not installed and not dismissed this session
  const shouldShow = !isStandalone && (isIOS || isAndroid || true);
  const [visible, setVisible] = useState(() => {
    if (isStandalone) return false;
    return !sessionStorage.getItem('install-guide-dismissed');
  });

  const dismiss = () => {
    sessionStorage.setItem('install-guide-dismissed', '1');
    setVisible(false);
  };

  return { visible, dismiss, isIOS, isAndroid, isStandalone, shouldShow };
}

function InstallGuideBanner({ onDismiss, isIOS, isAndroid }: { onDismiss: () => void; isIOS: boolean; isAndroid: boolean }) {
  const defaultTab = isIOS ? 'ios' : 'android';
  const [tab, setTab] = useState<'ios' | 'android'>(defaultTab);

  return (
    <>
      {/* Backdrop */}
      <div className="install-guide-backdrop" onClick={onDismiss} />
      {/* Sheet */}
      <div className="install-guide-sheet" role="dialog" aria-label="Petunjuk Install Aplikasi">
        {/* Handle */}
        <div className="install-guide-handle" />

        {/* Header */}
        <div className="install-guide-header">
          <div>
            <div className="install-guide-eyebrow">📲 Gratis &amp; Offline</div>
            <h2 className="install-guide-title">Install Aplikasi</h2>
          </div>
          <button className="install-guide-close" onClick={onDismiss} aria-label="Tutup">
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="install-guide-tabs">
          <button
            className={`install-guide-tab ${tab === 'ios' ? 'active' : ''}`}
            onClick={() => setTab('ios')}
          >
             iOS (Safari)
          </button>
          <button
            className={`install-guide-tab ${tab === 'android' ? 'active' : ''}`}
            onClick={() => setTab('android')}
          >
             Android (Chrome)
          </button>
        </div>

        {/* Steps */}
        {tab === 'ios' && (
          <div className="install-guide-steps">
            <div className="install-guide-step">
              <div className="step-num">1</div>
              <div className="step-content">
                <div className="step-title">Buka di Safari</div>
                <div className="step-desc">Pastikan kamu membuka link ini di browser <strong>Safari</strong> (bukan Chrome/Firefox)</div>
              </div>
            </div>
            <div className="install-guide-step">
              <div className="step-num">2</div>
              <div className="step-content">
                <div className="step-title">Tap tombol Bagikan</div>
                <div className="step-desc">Tap ikon <Share2 style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle' }} /> <strong>Bagikan</strong> di bagian bawah Safari</div>
              </div>
            </div>
            <div className="install-guide-step">
              <div className="step-num">3</div>
              <div className="step-content">
                <div className="step-title">Tambahkan ke Layar Utama</div>
                <div className="step-desc">Scroll ke bawah, tap <strong>"Tambahkan ke Layar Utama"</strong> lalu tap <strong>Tambahkan</strong></div>
              </div>
            </div>
            <div className="install-guide-tip">
              💡 App akan tampil seperti aplikasi native di homescreen kamu!
            </div>
          </div>
        )}

        {tab === 'android' && (
          <div className="install-guide-steps">
            <div className="install-guide-step">
              <div className="step-num">1</div>
              <div className="step-content">
                <div className="step-title">Buka di Chrome atau Edge</div>
                <div className="step-desc">Pastikan kamu membuka link ini di browser <strong>Chrome</strong> atau <strong>Edge</strong></div>
              </div>
            </div>
            <div className="install-guide-step">
              <div className="step-num">2</div>
              <div className="step-content">
                <div className="step-title">Buka Menu Sidebar</div>
                <div className="step-desc">Tap ikon <Menu style={{ width: 14, height: 14, display: 'inline', verticalAlign: 'middle' }} /> <strong>Menu</strong> di pojok kiri atas aplikasi</div>
              </div>
            </div>
            <div className="install-guide-step">
              <div className="step-num">3</div>
              <div className="step-content">
                <div className="step-title">Tap "Download & Install App"</div>
                <div className="step-desc">Scroll ke bawah sidebar, tap tombol <strong>"Download & Install App"</strong> berwarna hijau</div>
              </div>
            </div>
            <div className="install-guide-tip">
              💡 App bisa dipakai <strong>offline</strong> setelah terinstall!
            </div>
          </div>
        )}

        <button className="install-guide-dismiss-btn" onClick={onDismiss}>
          Mengerti, Jangan Tampilkan Lagi
        </button>
      </div>
    </>
  );
}

function usePWAInstall() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    const installedHandler = () => setInstalled(true);
    window.addEventListener("appinstalled", installedHandler);

    // Jika sudah berjalan sebagai standalone (sudah terinstall)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    const result = await prompt.prompt();
    if (result.outcome === "accepted") {
      setInstalled(true);
      setPrompt(null);
    }
  };

  return { canInstall: !!prompt && !installed, installed, install };
}

// Extend Window type for beforeinstallprompt
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: "accepted" | "dismissed" }>;
}

function Index() {
  const { canInstall, installed, install } = usePWAInstall();
  const { visible: showInstallGuide, dismiss: dismissInstallGuide, isIOS, isAndroid } = useInstallGuide();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [calcFor, setCalcFor] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingScore, setEditingScore] = useState<{ playerId: string; index: number; score: number } | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [showResetAllModal, setShowResetAllModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showRecapModal, setShowRecapModal] = useState(false);
  const [showVictoryHistoryModal, setShowVictoryHistoryModal] = useState(false);
  const [currentBatch, setCurrentBatch] = useState<string[]>([]);
  const [showTieModal, setShowTieModal] = useState(false);
  const [tieOrder, setTieOrder] = useState<string[]>([]);
  const [selectedTiePlayerId, setSelectedTiePlayerId] = useState<string | null>(null);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [matchHistory, setMatchHistory] = useState<MatchEntry[]>([]);
  const [sessionVictoryHistory, setSessionVictoryHistory] = useState<VictoryHistoryEntry[]>([]);
  const [recapMode, setRecapMode] = useState<"off" | "every5">("off");
  const [lastActivityAt, setLastActivityAt] = useState(() => new Date().toISOString());
  const [lastAutoRecapRound, setLastAutoRecapRound] = useState(0);
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [hasDismissedTie, setHasDismissedTie] = useState(false);

  const markActivity = () => setLastActivityAt(new Date().toISOString());

  useEffect(() => {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as StoredState | Player[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Normalize: pastikan semua field baru ada nilainya
          const normalized = parsed.map((p) => ({
            ...p,
            wins: typeof p.wins === "number" && !isNaN(p.wins) ? p.wins : 0,
            balance: typeof p.balance === "number" && !isNaN(p.balance) ? p.balance : 0,
          }));
          setPlayers(normalized);
          setSettings(DEFAULT_SETTINGS);
          setMatchHistory([]);
          setSessionVictoryHistory([]);
          setRecapMode("off");
          setLastActivityAt(nowIso);
          setLoaded(true);
          return;
        }
        if (!Array.isArray(parsed) && Array.isArray(parsed.players) && parsed.players.length > 0) {
          const normalized = parsed.players.map((p) => ({
            ...p,
            wins: typeof p.wins === "number" && !isNaN(p.wins) ? p.wins : 0,
            balance: typeof p.balance === "number" && !isNaN(p.balance) ? p.balance : 0,
          }));
          const expired = isSessionExpired(parsed.lastActivityAt, now);
          setPlayers(expired ? normalized.map(resetPlayerForNewSession) : normalized);
          setSettings(normalizeSettings(parsed.settings));
          setMatchHistory(expired ? [] : Array.isArray(parsed.matchHistory) ? parsed.matchHistory : []);
          setSessionVictoryHistory(expired ? [] : Array.isArray(parsed.sessionVictoryHistory) ? parsed.sessionVictoryHistory : []);
          setRecapMode(expired ? "off" : parsed.recapMode === "every5" ? "every5" : "off");
          setLastActivityAt(expired ? nowIso : parsed.lastActivityAt ?? nowIso);
          setLoaded(true);
          return;
        }
      }
    } catch { }
    // Coba migrate dari key lama
    try {
      const oldRaw = localStorage.getItem(LEGACY_STORAGE_KEY) ?? localStorage.getItem("domino-score-state-v1");
      if (oldRaw) {
        const parsed = JSON.parse(oldRaw) as Player[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migrated = parsed.map((p) => ({
            ...p,
            wins: typeof p.wins === "number" && !isNaN(p.wins) ? p.wins : 0,
            balance: 0,
          }));
          setPlayers(migrated);
          setSettings(DEFAULT_SETTINGS);
          setMatchHistory([]);
          setSessionVictoryHistory([]);
          setRecapMode("off");
          setLastActivityAt(nowIso);
          setLoaded(true);
          return;
        }
      }
    } catch { }
    setPlayers([makePlayer(0), makePlayer(1)]);
    setLastActivityAt(nowIso);
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify({ players, settings: normalizeSettings(settings), matchHistory, sessionVictoryHistory, recapMode, lastActivityAt }));
  }, [players, settings, matchHistory, sessionVictoryHistory, recapMode, lastActivityAt, loaded]);

  useEffect(() => {
    if (!loaded) return;

    const resetIdleSession = () => {
      if (!isSessionExpired(lastActivityAt)) return;

      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
      setPlayers((prev) => prev.map(resetPlayerForNewSession));
      setMatchHistory([]);
      setSessionVictoryHistory([]);
      setRecapMode("off");
      setCurrentBatch([]);
      setTieOrder([]);
      setSelectedTiePlayerId(null);
      setHasDismissedTie(false);
      setShowRecapModal(false);
      setShowVictoryHistoryModal(false);
      setShowTieModal(false);
      setShowResetModal(false);
      setShowResetAllModal(false);
      setCalcFor(null);
      setEditingScore(null);
      setLastActivityAt(new Date().toISOString());
    };

    resetIdleSession();
    const intervalId = window.setInterval(resetIdleSession, 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [loaded, lastActivityAt]);

  useEffect(() => {
    if (recapMode !== "every5") return;
    const completedRounds = matchHistory.length;
    if (completedRounds > 0 && completedRounds % 5 === 0 && completedRounds !== lastAutoRecapRound) {
      setLastAutoRecapRound(completedRounds);
      setShowRecapModal(true);
    }
  }, [matchHistory.length, recapMode, lastAutoRecapRound]);

  const gameSettings = normalizeSettings(settings);
  const total = (p: Player) => p.scores.reduce((a, b) => a + b, 0);

  // Cek apakah game sudah selesai: ada pemain yang mencapai >= 51
  const totals = players.map(total);
  const gameFinished = totals.some((t) => t >= 51);

  const roundCounts = players.map((p) => p.scores.length);

  // Pemenang = pemain dengan skor terendah saat game selesai
  const minTotal = gameFinished ? Math.min(...totals) : Infinity;

  const tiers = computeTiers(players, gameSettings, tieOrder);

  // --- Deteksi tie yang belum diresolved di SEMUA posisi ---
  const allSameRounds = roundCounts.length > 0 && roundCounts.every((c) => c === roundCounts[0]);

  const unresolvedTie = (() => {
    if (!gameFinished || !allSameRounds) return null;

    const ranked = players
      .map((p, i) => ({ player: p, total: totals[i] }))
      .sort((a, b) => {
        if (a.total !== b.total) return a.total - b.total;
        const aIdx = tieOrder.indexOf(a.player.id);
        const bIdx = tieOrder.indexOf(b.player.id);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return 0;
      });

    const isAlig = ranked[0]?.total < gameSettings.aligThreshold;
    const tierPayments = getTierPayments(gameSettings, players.length, isAlig);

    let i = 0;
    while (i < ranked.length) {
      let j = i + 1;
      while (j < ranked.length && ranked[j].total === ranked[i].total) j++;

      if (j - i >= 2) {
        const groupPlayers = ranked.slice(i, j).map((r) => r.player);
        const groupAmounts = Array.from({ length: j - i }, (_, k) => {
          const idx = Math.min(i + k, tierPayments.length - 1);
          return tierPayments[idx];
        });

        // Skip jika semua amount sama (misal super tier loser semua -8k)
        if (!groupAmounts.every((a) => a === groupAmounts[0])) {
          const unresolvedPlayers = groupPlayers.filter((p) => !tieOrder.includes(p.id));
          if (unresolvedPlayers.length >= 2) {
            const resolvedCount = groupPlayers.length - unresolvedPlayers.length;
            const betterIdx = i + resolvedCount;
            const isWinnerTie = betterIdx === 0;
            const betterAmount = tierPayments[Math.min(betterIdx, tierPayments.length - 1)];
            return { players: unresolvedPlayers, isWinnerTie, betterAmount };
          }
        }
      }
      i = j;
    }
    return null;
  })();

  // Pemenang = pemain dengan skor terendah (dari tieOrder jika ada tie)
  const winnerId = (() => {
    if (!gameFinished) return null;
    const sorted = players
      .map((p, i) => ({ id: p.id, total: totals[i] }))
      .sort((a, b) => {
        if (a.total !== b.total) return a.total - b.total;
        const aIdx = tieOrder.indexOf(a.id);
        const bIdx = tieOrder.indexOf(b.id);
        if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
        if (aIdx !== -1) return -1;
        if (bIdx !== -1) return 1;
        return 0;
      });
    return sorted[0]?.id ?? null;
  })();

  // --- Blok & R Logo Logic ---
  let lastBlokRowIndex = -1;
  let lastBlokWinnerId: string | null = null;

  const maxScoresLength = Math.max(0, ...players.map(p => p.scores.length));

  for (let i = 0; i < maxScoresLength; i++) {
    const isComplete = players.every(p => p.scores.length > i);
    if (isComplete) {
      const rowScores = players.map(p => p.scores[i]);
      const isBlok = rowScores.every(score => score > 0);
      if (isBlok) {
        lastBlokRowIndex = i;
        const minScore = Math.min(...rowScores);
        const winner = players.find(p => p.scores[i] === minScore);
        if (winner) {
          lastBlokWinnerId = winner.id;
        }
      }
    }
  }

  // Auto-show tie modal ketika ada unresolved tie
  useEffect(() => {
    if (unresolvedTie && !showTieModal && !hasDismissedTie) {
      setSelectedTiePlayerId(null);
      setShowTieModal(true);
    }
  }, [players, tieOrder, hasDismissedTie, unresolvedTie, showTieModal]);

  // Reset dismissed state when there is no unresolved tie and rounds are complete
  useEffect(() => {
    if (allSameRounds && !unresolvedTie) {
      setHasDismissedTie(false);
    }
  }, [allSameRounds, unresolvedTie]);

  // Auto-reset ketika semua tie sudah resolved
  useEffect(() => {
    if (gameFinished && allSameRounds && !unresolvedTie && tieOrder.length > 0) {
      const finalTiers = computeTiers(players, gameSettings, tieOrder);
      recordFinishedGame(finalTiers);
      setPlayers((prev) =>
        prev.map((p) => {
          const currentWins = typeof p.wins === "number" && !isNaN(p.wins) ? p.wins : 0;
          const currentBalance = typeof p.balance === "number" && !isNaN(p.balance) ? p.balance : 0;
          const isWinner = p.id === winnerId;
          const tierInfo = finalTiers.get(p.id);
          const earnedAmount = tierInfo ? tierInfo.amount : 0;
          return { ...p, scores: [], wins: currentWins + (isWinner ? 1 : 0), balance: currentBalance + earnedAmount };
        })
      );
      setTieOrder([]);
      setCurrentBatch([]);
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
    }
  }, [tieOrder]);

  const addScore = (id: string, value: number) => {
    if (!value) return;
    markActivity();
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, scores: [...p.scores, value] } : p)));
  };

  const handleDeleteScore = (playerId: string, scoreIndex: number) => {
    const isDeletingLastScore = players.some((p) => p.id === playerId && scoreIndex === p.scores.length - 1);
    markActivity();

    setPlayers((prev) =>
      prev.map((p) => {
        if (p.id === playerId && scoreIndex >= 0 && scoreIndex < p.scores.length) {
          const newScores = [...p.scores];
          newScores.splice(scoreIndex, 1);
          return { ...p, scores: newScores };
        }
        return p;
      })
    );

    if (!isDeletingLastScore) return;

    setCurrentBatch((prev) => {
      const newBatch = prev.filter((id) => id !== playerId);
      if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
      if (newBatch.length > 0) {
        batchTimeoutRef.current = setTimeout(() => {
          const batchToFill = [...newBatch];
          setPlayers((prev2) =>
            prev2.map((p2) => {
              if (!batchToFill.includes(p2.id)) {
                return { ...p2, scores: [...p2.scores, 0] };
              }
              return p2;
            })
          );
          setCurrentBatch([]);
        }, 10000);
      }
      return newBatch;
    });
  };

  const createScoreGestureHandlers = (playerId: string, scoreIndex: number, score: number) => {
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let startX = 0;
    let currentX = 0;
    let isPointerDown = false;
    let isSwiping = false;

    const clearLongPress = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };

    const resetElement = (element: HTMLElement) => {
      element.style.transition = "transform 0.18s ease, opacity 0.18s ease";
      element.style.transform = "translateX(0)";
      element.style.opacity = "1";
    };

    const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
      if ("button" in event && event.button !== 0) return;
      startX = event.clientX;
      currentX = startX;
      isPointerDown = true;
      isSwiping = false;
      event.currentTarget.setPointerCapture(event.pointerId);
      resetElement(event.currentTarget);
      clearLongPress();
      longPressTimer = setTimeout(() => {
        if (!isSwiping) setEditingScore({ playerId, index: scoreIndex, score });
      }, 500);
    };

    const onPointerMove = (event: React.PointerEvent<HTMLElement>) => {
      if (!isPointerDown) return;
      currentX = event.clientX;
      const distance = startX - currentX;
      if (distance <= 8) return;

      isSwiping = true;
      clearLongPress();
      const swipeDistance = Math.min(distance, 88);
      const element = event.currentTarget;
      element.style.transition = "none";
      element.style.transform = `translateX(-${swipeDistance}px)`;
      element.style.opacity = `${1 - swipeDistance / 110}`;
      event.preventDefault();
    };

    const onPointerUp = (event: React.PointerEvent<HTMLElement>) => {
      clearLongPress();
      if (!isPointerDown) return;

      const distance = startX - currentX;
      const element = event.currentTarget;
      isPointerDown = false;
      if (element.hasPointerCapture(event.pointerId)) {
        element.releasePointerCapture(event.pointerId);
      }

      if (isSwiping && distance > 56) {
        element.style.transition = "transform 0.16s ease, opacity 0.16s ease";
        element.style.transform = "translateX(-100%)";
        element.style.opacity = "0";
        window.setTimeout(() => {
          resetElement(element);
          handleDeleteScore(playerId, scoreIndex);
        }, 120);
      } else {
        resetElement(element);
      }

      isSwiping = false;
    };

    const onPointerCancel = (event: React.PointerEvent<HTMLElement>) => {
      clearLongPress();
      isPointerDown = false;
      isSwiping = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      resetElement(event.currentTarget);
    };

    return {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onContextMenu: (event: React.MouseEvent<HTMLElement>) => {
        event.preventDefault();
        setEditingScore({ playerId, index: scoreIndex, score });
      },
    };
  };

  const renamePlayer = (id: string, name: string) => {
    markActivity();
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const updateSetting = (key: keyof GameSettings, value: string) => {
    const parsed = Math.max(0, Number(value.replace(/\D/g, "")) || 0);
    markActivity();
    setSettings((prev) => ({ ...prev, [key]: parsed }));
  };

  const recordFinishedGame = (finalTiers: Map<string, { tier: number; amount: number }>) => {
    if (!gameFinished) return;
    const nextRound = matchHistory.length + 1;
    const entry = buildMatchEntry(players, finalTiers, nextRound);
    setMatchHistory((prev) => [...prev, { ...entry, round: prev.length + 1 }]);
  };

  const reset = () => {
    setShowResetModal(true);
  };

  const doReset = () => {
    markActivity();
    setCurrentBatch([]);
    if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
    setHasDismissedTie(false);

    // Jika ada unresolved tie, tampilkan modal tie dulu
    if (unresolvedTie) {
      setShowResetModal(false);
      setSelectedTiePlayerId(null);
      setShowTieModal(true);
      return;
    }

    setPlayers((prev) =>
      prev.map((p) => {
        const t = total(p);
        const currentWins = typeof p.wins === "number" && !isNaN(p.wins) ? p.wins : 0;
        const currentBalance = typeof p.balance === "number" && !isNaN(p.balance) ? p.balance : 0;
        const isWinner = gameFinished && p.id === winnerId;
        const tierInfo = tiers.get(p.id);
        const earnedAmount = tierInfo ? tierInfo.amount : 0;
        return {
          ...p,
          scores: [],
          wins: currentWins + (isWinner ? 1 : 0),
          balance: currentBalance + (gameFinished ? earnedAmount : 0),
        };
      })
    );
    if (gameFinished) recordFinishedGame(tiers);
    setShowResetModal(false);
    setTieOrder([]);
  };

  const resetAll = () => {
    setShowResetAllModal(true);
  };

  const doResetAll = () => {
    markActivity();
    setCurrentBatch([]);
    if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
    setHasDismissedTie(false);

    setPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        scores: [],
        wins: 0,
        balance: 0,
      }))
    );
    setSessionVictoryHistory((prev) => mergeSessionVictoryHistory(prev, players));
    setMatchHistory([]);
    setShowRecapModal(false);
    setShowResetAllModal(false);
  };

  const setPlayerCount = (count: number) => {
    if (count < 2 || count > 4) return;
    markActivity();
    setPlayers((prev) => {
      if (count === prev.length) return prev;
      if (count > prev.length) {
        const added = Array.from({ length: count - prev.length }, (_, i) => makePlayer(prev.length + i));
        return [...prev, ...added];
      }
      return prev.slice(0, count);
    });
  };

  const maxRounds = Math.max(0, ...players.map(p => p.scores.length));
  const historyBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    historyBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [maxRounds]);

  const recapEntries = matchHistory.slice(-5);
  const recapProgress = matchHistory.length % 5;
  const runningRoundInCycle = recapMode === "every5" ? recapProgress + 1 : matchHistory.length + 1;
  const lastWinnerName = matchHistory.at(-1)?.results.find((result) => result.tier === 1)?.name;
  const victoryHistoryEntries = mergeSessionVictoryHistory(sessionVictoryHistory, players);
  const recapStats = players.map((p) => {
    const results = recapEntries
      .map((entry) => entry.results.find((result) => result.playerId === p.id || result.name === p.name))
      .filter((result): result is MatchResult => Boolean(result));
    return {
      player: p,
      wins: results.filter((result) => result.tier === 1).length,
      losses: results.filter((result) => result.tier > 1).length,
      balance: results.reduce((sum, result) => sum + result.amount, 0),
    };
  });

  if (!loaded) return null;


  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: '#0A0E1A', color: '#E8ECF4' }}>
      {/* Install Guide Banner */}
      {showInstallGuide && !installed && (
        <InstallGuideBanner
          onDismiss={dismissInstallGuide}
          isIOS={isIOS}
          isAndroid={isAndroid}
        />
      )}

      {/* Floating Tie-Breaker Confirmation Banner */}
      {gameFinished && hasDismissedTie && (!allSameRounds || unresolvedTie !== null) && (
        <button
          onClick={() => {
            setHasDismissedTie(false);
            setShowTieModal(true);
          }}
          className="floating-tie-banner"
        >
          <Trophy className="w-4 h-4 text-yellow-400 shrink-0" />
          <span>Konfirmasi Pemenang</span>
        </button>
      )}

      {/* Header */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => setShowSettingsModal(true)} className="header-btn header-menu-btn" aria-label="Menu">
            <Menu style={{ width: 20, height: 20 }} />
          </button>
          <h1>Domino Score</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button onClick={resetAll} className="header-btn" aria-label="Reset Semua"><Trash2 style={{ width: 20, height: 20, color: 'var(--calc-red)', opacity: 0.7 }} /></button>
          <button onClick={reset} className="header-btn" aria-label="Reset"><RotateCcw style={{ width: 20, height: 20, color: 'var(--calc-red)' }} /></button>
        </div>
      </header>

      {showSettingsModal && (
        <div className="settings-shell">
          <button className="settings-backdrop" aria-label="Tutup pengaturan" onClick={() => setShowSettingsModal(false)} />
          <aside className="settings-sidebar">
            <div className="settings-sidebar-header">
              <div>
                <div className="settings-eyebrow">Menu</div>
                <h2>Pengaturan Permainan</h2>
              </div>
              <button className="settings-close-btn" onClick={() => setShowSettingsModal(false)} aria-label="Tutup pengaturan">x</button>
            </div>

            {/* Jumlah Pemain */}
            <div className="settings-section open">
              <button className="settings-section-toggle" onClick={(e) => {
                const section = e.currentTarget.closest('.settings-section')!;
                section.classList.toggle('open');
              }}>
                <div className="settings-section-title">
                  <Users style={{ width: 16, height: 16 }} />
                  <span>Jumlah Pemain</span>
                </div>
                <ChevronDown className="settings-chevron" style={{ width: 16, height: 16 }} />
              </button>
              <div className="settings-section-body">
                <div className="player-count-selector">
                  {[2, 3, 4].map((count) => (
                    <button
                      key={count}
                      className={`player-count-option ${players.length === count ? 'active' : ''}`}
                      onClick={() => setPlayerCount(count)}
                    >
                      <span className="player-count-num">{count}</span>
                      <span className="player-count-label">Pemain</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="settings-section">
              <button className="settings-section-toggle" onClick={(e) => {
                const section = e.currentTarget.closest('.settings-section')!;
                section.classList.toggle('open');
              }}>
                <div className="settings-section-title">
                  <Settings style={{ width: 16, height: 16 }} />
                  <span>Nominal Saldo</span>
                </div>
                <ChevronDown className="settings-chevron" style={{ width: 16, height: 16 }} />
              </button>
              <div className="settings-section-body">
                <label className="settings-field">
                  <span>Kemenangan</span>
                  <input type="text" inputMode="numeric" value={formatRupiahInput(gameSettings.winner)} onChange={(e) => updateSetting("winner", e.target.value)} />
                </label>
                <label className="settings-field">
                  <span>Kalah 1</span>
                  <input type="text" inputMode="numeric" value={formatRupiahInput(gameSettings.loser1)} onChange={(e) => updateSetting("loser1", e.target.value)} />
                </label>
                <label className="settings-field">
                  <span>Kalah 2</span>
                  <input type="text" inputMode="numeric" value={formatRupiahInput(gameSettings.loser2)} onChange={(e) => updateSetting("loser2", e.target.value)} />
                </label>
                <label className="settings-field">
                  <span>Kalah 3</span>
                  <input type="text" inputMode="numeric" value={formatRupiahInput(gameSettings.loser3)} onChange={(e) => updateSetting("loser3", e.target.value)} />
                </label>
                <label className="settings-field">
                  <span>Alig</span>
                  <input type="text" inputMode="numeric" value={formatRupiahInput(gameSettings.aligAmount)} onChange={(e) => updateSetting("aligAmount", e.target.value)} />
                </label>
                <label className="settings-field">
                  <span>Minimal Alig</span>
                  <input type="text" inputMode="numeric" value={gameSettings.aligThreshold} onChange={(e) => updateSetting("aligThreshold", e.target.value)} />
                </label>
                <p className="settings-help">Alig aktif jika total pemenang di bawah batas ini. Default: di bawah 11.</p>
                <button className="settings-secondary-btn" onClick={() => setSettings(DEFAULT_SETTINGS)}>Reset Nominal Default</button>
              </div>
            </div>

            <div className="settings-section">
              <button className="settings-section-toggle" onClick={(e) => {
                const section = e.currentTarget.closest('.settings-section')!;
                section.classList.toggle('open');
              }}>
                <div className="settings-section-title">
                  <Trophy style={{ width: 16, height: 16 }} />
                  <span>Riwayat Kemenangan</span>
                </div>
                <ChevronDown className="settings-chevron" style={{ width: 16, height: 16 }} />
              </button>
              <div className="settings-section-body">
                <button
                  className="settings-primary-btn"
                  onClick={() => {
                    setShowSettingsModal(false);
                    setShowVictoryHistoryModal(true);
                  }}
                >
                  Buka Riwayat Kemenangan
                </button>
                <p className="settings-help">Menampilkan rekap kemenangan dan saldo dari ronde yang sudah selesai di permainan aktif.</p>
              </div>
            </div>

            <div className="settings-section">
              <button className="settings-section-toggle" onClick={(e) => {
                const section = e.currentTarget.closest('.settings-section')!;
                section.classList.toggle('open');
              }}>
                <div className="settings-section-title">
                  <ClipboardList style={{ width: 16, height: 16 }} />
                  <span>Rekap Kemenangan</span>
                </div>
                <ChevronDown className="settings-chevron" style={{ width: 16, height: 16 }} />
              </button>
              <div className="settings-section-body">
                <div className="recap-toggle">
                  <button className={recapMode === "off" ? "active" : ""} onClick={() => { markActivity(); setRecapMode("off"); }}>Mati</button>
                  <button className={recapMode === "every5" ? "active" : ""} onClick={() => { markActivity(); setRecapMode("every5"); }}>Per 5 Ronde</button>
                </div>
                <button className="settings-primary-btn" onClick={() => setShowRecapModal(true)} disabled={matchHistory.length === 0}>
                  Lihat Rekap
                </button>
                <p className="settings-help">Rekap otomatis muncul setiap game ke-5, 10, 15, dan seterusnya saat mode per 5 ronde aktif.</p>
              </div>
            </div>

            {/* PWA Install Section */}
            <div className="settings-section">
              <button className="settings-section-toggle" onClick={(e) => {
                const section = e.currentTarget.closest('.settings-section')!;
                section.classList.toggle('open');
              }}>
                <div className="settings-section-title">
                  <Download style={{ width: 16, height: 16 }} />
                  <span>Install Aplikasi</span>
                </div>
                <ChevronDown className="settings-chevron" style={{ width: 16, height: 16 }} />
              </button>
              <div className="settings-section-body">
                {!installed && canInstall && (
                  <button
                    className="pwa-install-btn"
                    onClick={install}
                    id="pwa-install-btn"
                  >
                    <Download style={{ width: 18, height: 18 }} />
                    <span>Download &amp; Install App</span>
                  </button>
                )}
                {!installed && !canInstall && (
                  <p className="settings-help" style={{ textAlign: 'center', opacity: 0.55, fontSize: 12 }}>
                    Buka di Chrome/Edge lalu tambahkan ke homescreen untuk install.
                  </p>
                )}
                {installed && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, marginBottom: 4 }}>✅</div>
                    <p className="settings-help" style={{ textAlign: 'center', fontSize: 12, opacity: 0.7 }}>Aplikasi sudah terinstall!</p>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Scrollable Content Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 0', minHeight: 0 }}>
        {recapMode === "every5" && (
          <div className="running-round-banner">
            <div>
              <div className="running-round-label">Round {runningRoundInCycle}</div>
              <div className="running-round-meta">
                {lastWinnerName ? `Terakhir menang: ${lastWinnerName}` : "Belum ada pemenang"}
              </div>
            </div>
          </div>
        )}

        {/* Player Summary Cards */}
        <div className="player-summary-grid" style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }}>
          {players.map((p, i) => {
            const color = COLORS[i];
            const t = total(p);
            const tierInfo = tiers.get(p.id);
            const bal = typeof p.balance === 'number' && !isNaN(p.balance) ? p.balance : 0;
            const projBal = bal + (tierInfo?.amount ?? 0);
            const isDanger = t >= 40 && t < 51;
            const someoneAbove30 = totals.some(tt => tt >= 30);
            const isSTC = t <= 10 && t > 0 && someoneAbove30;
            const balanceState = projBal > 0 ? 'profit' : projBal < 0 ? 'loss' : 'neutral';
            return (
              <div
                key={p.id}
                className={`player-card balance-${balanceState}`}
                style={{
                  '--card-accent-color': color,
                  '--card-glow-idle': `0 8px 24px rgba(0, 0, 0, 0.22), inset 0 0 18px color-mix(in srgb, ${color} 3%, transparent)`,
                  '--card-glow-active': `0 10px 26px rgba(0, 0, 0, 0.3), inset 0 0 20px color-mix(in srgb, ${color} 5%, transparent)`,
                } as React.CSSProperties}
              >
                <div className="card-top-row card-top-row-trophy-only">
                  <div className="card-trophy" style={{ backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`, color }}>
                    <Trophy style={{ width: 13, height: 13 }} />{p.wins}
                  </div>
                </div>
                <div className={`card-total ${isDanger ? 'danger-pulse' : ''} ${isSTC ? 'super-glow' : ''}`} style={{ color: t >= 40 ? 'var(--calc-red)' : isSTC ? '#FFD700' : color }}>{t}</div>
                <div className="card-score-label">TOTAL SCORE</div>
                <div className="card-balance-row">
                  <div className="card-balance-pill">
                    {balanceState === 'loss' ? <ArrowDownRight style={{ width: 14, height: 14 }} /> : <ArrowUpRight style={{ width: 14, height: 14 }} />}
                    <span>{formatCompactRupiah(projBal)}</span>
                  </div>
                </div>
                <div className="card-balance-full">{formatRupiah(projBal)}</div>
              </div>
            );
          })}
        </div>

        {/* Game History Table */}
        <div className="history-container">
          <div className="history-header">
            <span className="history-title">Riwayat Permainan</span>
          </div>
          {maxRounds > 0 && (
            <div className="history-scroll" style={{ maxHeight: 'calc(100dvh - 420px)' }}>
              <table className="history-table">
                <thead><tr>
                  <th></th>
                  {players.map((_, i) => (
                    <th key={i}><div className="player-icon-header" style={{ background: `color-mix(in srgb, ${COLORS[i]} 25%, transparent)` }}><User style={{ width: 14, height: 14, color: COLORS[i] }} /></div></th>
                  ))}
                </tr></thead>
                <tbody>
                  {Array.from({ length: maxRounds }, (_, ri) => {
                    const isLastRound = ri === maxRounds - 1;
                    return (
                      <tr key={ri} className={isLastRound ? 'row-enter' : ''}>
                        <td>{ri + 1}</td>
                        {players.map((p, pi) => {
                          if (ri >= p.scores.length) return <td key={p.id}></td>;
                          const s = p.scores[ri];
                          const showR = p.id === lastBlokWinnerId && ri === lastBlokRowIndex;
                          return (
                            <td key={p.id} className="score-cell" {...createScoreGestureHandlers(p.id, ri, s)}>
                              <span style={{ color: COLORS[pi] }}>{s === 0 ? <span className="score-dash">-</span> : s}</span>
                              {showR && <span className="r-badge">R</span>}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div ref={historyBottomRef} style={{ height: 4 }} />
            </div>
          )}
          {maxRounds === 0 && (
            <div style={{ padding: '32px 0', textAlign: 'center', opacity: 0.2, fontSize: 14 }}>Belum ada riwayat</div>
          )}
        </div>
      </div>

      {/* Bottom Quick Action Bar */}
      <div className="quick-action-bar">
        {players.map((p, i) => {
          const t = total(p);
          const color = COLORS[i];
          const isDanger = t >= 40 && t < 51;
          const someoneAbove30 = totals.some(tt => tt >= 30);
          const isSTC = t <= 10 && t > 0 && someoneAbove30;
          const lastScoreIndex = p.scores.length - 1;
          const lastScore = p.scores[lastScoreIndex];
          const totalGestureHandlers = lastScoreIndex >= 0 ? createScoreGestureHandlers(p.id, lastScoreIndex, lastScore) : {};
          return (
            <div key={p.id} className="action-item">
              <button className="fab-btn" onClick={() => setCalcFor(p.id)} style={{ backgroundColor: color }} aria-label={`Tambah skor ${p.name}`}>
                <Plus style={{ width: 24, height: 24, color: '#fff' }} />
              </button>
              {editingId === p.id ? (
                <input
                  autoFocus
                  value={p.name}
                  onChange={e => renamePlayer(p.id, e.target.value)}
                  onBlur={() => setEditingId(null)}
                  onKeyDown={e => e.key === 'Enter' && setEditingId(null)}
                  className="action-name-input"
                  style={{ color, borderColor: `color-mix(in srgb, ${color} 45%, transparent)` }}
                />
              ) : (
                <button onClick={() => setEditingId(p.id)} className="action-name-button" style={{ color }}>
                  <span className="action-name">{p.name.length > 5 ? p.name.substring(0, 5) : p.name}</span>
                  <Pencil style={{ width: 10, height: 10, opacity: 0.45 }} />
                </button>
              )}
              <span
                className={`action-total score-gesture-target ${isDanger ? 'danger-pulse' : ''} ${isSTC ? 'super-glow' : ''}`}
                style={{ color: t >= 40 ? 'var(--calc-red)' : isSTC ? '#FFD700' : color }}
                {...totalGestureHandlers}
              >
                {t}
              </span>
            </div>
          );
        })}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 modal-overlay" onClick={() => setShowResetModal(false)} />
          <div className="relative bg-[var(--calc-surface)] rounded-2xl p-6 w-80 max-w-[90%] text-center shadow-2xl modal-content">
            <h2 className="text-lg font-semibold mb-2">Reset Skor</h2>
            <p className="text-sm text-foreground/70 mb-6">
              iyo reset ko ?
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 transition"
              >
                Batal
              </button>
              <button
                onClick={doReset}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white transition"
                style={{ backgroundColor: "var(--calc-red)" }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tie-Breaker Modal */}
      {showTieModal && unresolvedTie && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm modal-overlay" onClick={() => { setShowTieModal(false); setTieOrder([]); setHasDismissedTie(true); }} />
          <div className="relative bg-[var(--calc-surface)] rounded-2xl p-6 w-80 max-w-[90%] text-center shadow-2xl border border-yellow-500/30 modal-content">
            {/* Trophy icon */}
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Trophy className="w-7 h-7 text-yellow-400" />
              </div>
            </div>

            <h2 className="text-lg font-semibold mb-1">Samo skor ge</h2>
            <p className="text-sm text-foreground/60 mb-5">
              {unresolvedTie.isWinnerTie
                ? "Siapo menang?"
                : `Siapo yang kalah ${formatRupiah(Math.abs(unresolvedTie.betterAmount))}?`}
            </p>

            {/* Player buttons */}
            <div className="flex flex-col gap-3 mb-4">
              {unresolvedTie.players.map((tp) => {
                const playerIndex = players.findIndex((p) => p.id === tp.id);
                const color = COLORS[playerIndex] || "var(--foreground)";
                const isSelected = selectedTiePlayerId === tp.id;

                return (
                  <button
                    key={tp.id}
                    onClick={() => setSelectedTiePlayerId(tp.id)}
                    className="relative flex items-center justify-center gap-3 px-4 py-3 rounded-xl text-base font-bold transition-all duration-200"
                    style={{
                      backgroundColor: isSelected
                        ? `color-mix(in oklab, ${color} 35%, transparent)`
                        : `color-mix(in oklab, ${color} 12%, transparent)`,
                      color,
                      border: isSelected ? `2px solid ${color}` : '2px solid transparent',
                      transform: isSelected ? 'scale(1.03)' : 'scale(1)',
                      boxShadow: isSelected ? `0 0 20px color-mix(in oklab, ${color} 25%, transparent)` : 'none',
                    }}
                  >
                    {isSelected && (
                      <Trophy className="w-5 h-5 shrink-0" />
                    )}
                    <span>{tp.name}</span>
                    <span className="text-sm font-normal opacity-60">({total(tp)} pts)</span>
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  setShowTieModal(false);
                  setTieOrder([]);
                  setSelectedTiePlayerId(null);
                  setHasDismissedTie(true);
                }}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 transition"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (selectedTiePlayerId) {
                    markActivity();
                    // Tambahkan player yang dipilih ke tieOrder
                    setTieOrder((prev) => [...prev, selectedTiePlayerId]);
                    setSelectedTiePlayerId(null);
                    setShowTieModal(false);
                  }
                }}
                disabled={!selectedTiePlayerId}
                className="px-4 py-2 rounded-xl text-sm font-medium text-black transition disabled:opacity-30"
                style={{ backgroundColor: selectedTiePlayerId ? 'var(--calc-orange)' : 'var(--calc-gray)' }}
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset All Confirmation Modal */}
      {showResetAllModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 modal-overlay" onClick={() => setShowResetAllModal(false)} />
          <div className="relative bg-[var(--calc-surface)] rounded-2xl p-6 w-80 max-w-[90%] text-center shadow-2xl border border-red-500/20 modal-content">
            <h2 className="text-lg font-semibold mb-2 text-red-500">Reset sado </h2>
            <p className="text-sm text-foreground/70 mb-6">
              Reset sado ko?.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowResetAllModal(false)}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-white/10 hover:bg-white/15 transition"
              >
                ndop
              </button>
              <button
                onClick={doResetAll}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white transition bg-red-600 hover:bg-red-700"
              >
                iyo
              </button>
            </div>
          </div>
        </div>
      )}

      {showVictoryHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm modal-overlay" onClick={() => setShowVictoryHistoryModal(false)} />
          <div className="recap-modal modal-content">
            <div className="recap-modal-header">
              <div>
                <div className="settings-eyebrow">Riwayat Kemenangan</div>
                <h2>{victoryHistoryEntries.length > 0 ? "Saldo sesi ini" : "Belum ada kemenangan"}</h2>
              </div>
              <button className="settings-close-btn" onClick={() => setShowVictoryHistoryModal(false)} aria-label="Tutup riwayat kemenangan">x</button>
            </div>

            {victoryHistoryEntries.length > 0 ? (
              <div className="recap-summary-grid">
                {victoryHistoryEntries.map((entry, i) => {
                  const playerIndex = players.findIndex((p) => p.id === entry.playerId);
                  const color = COLORS[playerIndex >= 0 ? playerIndex : i % COLORS.length];
                  return (
                    <div key={entry.playerId} className="recap-player-card" style={{ '--recap-color': color } as React.CSSProperties}>
                      <div className="recap-player-name">{entry.name}</div>
                      <div className="recap-player-balance" data-positive={entry.balance >= 0}>
                        {formatCompactRupiah(entry.balance)}
                      </div>
                      <div className="recap-player-meta">
                        <span>Menang {entry.wins}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="recap-empty">Riwayat akan terisi setelah ada game selesai. Data ini tetap tersimpan saat reset semua.</p>
            )}
          </div>
        </div>
      )}

      {showRecapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm modal-overlay" onClick={() => setShowRecapModal(false)} />
          <div className="recap-modal modal-content">
            <div className="recap-modal-header">
              <div>
                <div className="settings-eyebrow">Rekap Kemenangan</div>
                <h2>{recapEntries.length > 0 ? `${recapEntries.length} ronde terakhir` : "Belum ada rekap"}</h2>
              </div>
              <button className="settings-close-btn" onClick={() => setShowRecapModal(false)} aria-label="Tutup rekap">x</button>
            </div>

            {recapEntries.length > 0 ? (
              <>
                <div className="recap-summary-grid">
                  {recapStats.map((stat, i) => (
                    <div key={stat.player.id} className="recap-player-card" style={{ '--recap-color': COLORS[i] } as React.CSSProperties}>
                      <div className="recap-player-name">{stat.player.name}</div>
                      <div className="recap-player-balance" data-positive={stat.balance >= 0}>
                        {formatCompactRupiah(stat.balance)}
                      </div>
                      <div className="recap-player-meta">
                        <span>Menang {stat.wins}</span>
                        <span>Kalah {stat.losses}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="recap-history-list">
                  {recapEntries.map((entry) => (
                    <div key={entry.id} className="recap-round">
                      <div className="recap-round-title">Ronde {entry.round}</div>
                      <div className="recap-round-results">
                        {entry.results.map((result) => (
                          <div key={`${entry.id}-${result.playerId}`} className="recap-result-row">
                            <span>{result.name}</span>
                            <span>{getResultLabel(result.tier, entry.results.length)}</span>
                            <strong data-positive={result.amount >= 0}>{formatCompactRupiah(result.amount)}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="recap-empty">Rekap akan terisi setelah game selesai dan skor di-reset.</p>
            )}
          </div>
        </div>
      )}

      <Calculator
        open={calcFor !== null}
        onClose={() => setCalcFor(null)}
        onDone={(val) => {
          if (calcFor) {
            if (!isNaN(val) && val > 0) {
              let newBatch = [...currentBatch];

              if (newBatch.includes(calcFor)) {
                // Same player inputted again, previous round must be over!
                // Auto fill the missing players from the PREVIOUS batch
                const batchToFill = [...newBatch];
                setPlayers(prev => prev.map(p => {
                  if (!batchToFill.includes(p.id)) {
                    return { ...p, scores: [...p.scores, 0] };
                  }
                  return p;
                }));
                newBatch = [];
              }

              // Add the new score
              addScore(calcFor, val);
              newBatch.push(calcFor);

              if (newBatch.length === 4) {
                // Blok round complete
                newBatch = [];
                if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
              } else {
                // Start/reset timer
                if (batchTimeoutRef.current) clearTimeout(batchTimeoutRef.current);
                batchTimeoutRef.current = setTimeout(() => {
                  // Auto fill missing players for this batch
                  const batchToFill = [...newBatch];
                  setPlayers(prev => prev.map(p => {
                    if (!batchToFill.includes(p.id)) {
                      return { ...p, scores: [...p.scores, 0] };
                    }
                    return p;
                  }));
                  setCurrentBatch([]);
                }, 10000);
              }

              setCurrentBatch(newBatch);
            }
          }
          setCalcFor(null);
        }}
      />

      <Calculator
        open={editingScore !== null}
        onClose={() => setEditingScore(null)}
        initialValue={editingScore?.score.toString() || "0"}
        onDone={(val) => {
          if (editingScore) {
            if (!isNaN(val) && val >= 0) {
              markActivity();
              setPlayers(prev => prev.map(p => {
                if (p.id === editingScore.playerId) {
                  const newScores = [...p.scores];
                  newScores[editingScore.index] = val;
                  return { ...p, scores: newScores };
                }
                return p;
              }));
            }
          }
          setEditingScore(null);
        }}
      />
    </div>
  );
}
