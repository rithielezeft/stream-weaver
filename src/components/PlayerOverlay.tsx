import { useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  X,
  Loader2,
  RotateCcw,
  RotateCw,
} from "lucide-react";
import type { Channel } from "@/lib/m3u";
import { attachStream, STREAM_ERROR_MESSAGES } from "@/lib/stream-player";

interface PlayerOverlayProps {
  channel: Channel;
  upNext: Channel[];
  onPlay: (c: Channel) => void;
  onClose: () => void;
}

export function PlayerOverlay({ channel, upNext, onPlay, onClose }: PlayerOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const seekable = duration > 0 && Number.isFinite(duration);


  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setLoading(true);
    setError(null);
    setPlaying(true);

    const detach = attachStream(video, channel.url, {
      onReady: () => setLoading(false),
      onError: (reason) => {
        setError(STREAM_ERROR_MESSAGES[reason]);
        setLoading(false);
      },
    });
    return detach;
  }, [channel]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    setCurrent(0);
    setDuration(0);
    const onTime = () => setCurrent(v.currentTime);
    const onMeta = () => setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    const onPlayEv = () => setPlaying(true);
    const onPauseEv = () => setPlaying(false);
    const onVol = () => {
      setVolume(v.volume);
      setMuted(v.muted);
    };
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onMeta);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("play", onPlayEv);
    v.addEventListener("pause", onPauseEv);
    v.addEventListener("volumechange", onVol);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onMeta);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("play", onPlayEv);
      v.removeEventListener("pause", onPauseEv);
      v.removeEventListener("volumechange", onVol);
    };
  }, [channel]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  const skip = (seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    const target = v.currentTime + seconds;
    const max = Number.isFinite(v.duration) ? v.duration : target;
    v.currentTime = Math.min(Math.max(target, 0), max);
    setCurrent(v.currentTime);
  };

  const seekTo = (value: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = value;
    setCurrent(value);
  };

  const changeVolume = (value: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = value;
    v.muted = value === 0;
    setVolume(value);
    setMuted(v.muted);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    if (!v.muted && v.volume === 0) {
      v.volume = 0.5;
      setVolume(0.5);
    }
    setMuted(v.muted);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        skip(10);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        skip(-10);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        changeVolume(Math.min(1, (videoRef.current?.volume ?? 1) + 0.1));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        changeVolume(Math.max(0, (videoRef.current?.volume ?? 0) - 0.1));
      } else if (e.key === " " || e.key === "k") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "m") {
        toggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const fullscreen = () => {
    containerRef.current?.requestFullscreen?.();
  };

  const formatTime = (s: number) => {
    if (!Number.isFinite(s) || s < 0) return "0:00";
    const total = Math.floor(s);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = total % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${m}:${String(sec).padStart(2, "0")}`;
  };


  return (
    <div className="fixed inset-0 z-50 bg-ink/95 backdrop-blur-md animate-rise [animation-duration:300ms]">
      <div ref={containerRef} className="mx-auto flex h-full max-w-[1600px] flex-col">
        <div className="relative flex-1 overflow-hidden">
          <video
            ref={videoRef}
            className="absolute inset-0 h-full w-full bg-black object-contain"
            playsInline
            onClick={togglePlay}
          />

          {loading && !error && (
            <div className="absolute inset-0 grid place-items-center">
              <Loader2 className="size-10 animate-spin text-aurora-2" />
            </div>
          )}
          {error && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center">
              <div>
                <p className="text-sm text-slate-300">{error}</p>
                <p className="mt-1 font-mono text-xs text-slate-500 break-all">{channel.url}</p>
              </div>
            </div>
          )}

          <div className="absolute left-5 top-5 flex items-center gap-3">
            <div className="grid size-11 place-items-center overflow-hidden rounded-full bg-surface ring-1 ring-white/10">
              {channel.poster || channel.logo ? (
                <img
                  src={channel.poster ?? channel.logo}
                  alt={`Logo de ${channel.name}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-sm font-black text-aurora-2">
                  {channel.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <p className="text-lg font-bold leading-tight text-foreground">{channel.name}</p>
              <p className="text-xs text-slate-400">
                {channel.group}
                {channel.live ? " · Ao vivo" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar player"
            className="absolute right-5 top-5 grid size-10 place-items-center rounded-full bg-ink/70 text-slate-300 ring-1 ring-white/10 backdrop-blur-md transition-colors hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="border-t border-white/10 bg-panel/80 backdrop-blur-xl">
          <div className="flex items-center gap-4 px-5 py-4 sm:px-8">
            <button
              onClick={togglePlay}
              aria-label={playing ? "Pausar" : "Reproduzir"}
              className="grid size-10 place-items-center rounded-full bg-white text-ink transition-transform hover:scale-105"
            >
              {playing ? <Pause className="size-4 fill-ink" /> : <Play className="ml-0.5 size-4 fill-ink" />}
            </button>
            <button
              onClick={toggleMute}
              aria-label={muted ? "Ativar som" : "Silenciar"}
              className="text-slate-300 transition-colors hover:text-foreground"
            >
              {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
            </button>
            <div className="flex-1 text-center font-mono text-xs text-slate-400">
              {channel.live ? (
                <span className="rounded-md bg-live/15 px-2 py-1 font-bold text-live ring-1 ring-live/30">
                  AO VIVO
                </span>
              ) : (
                "stream hls"
              )}
            </div>
            <button
              onClick={fullscreen}
              aria-label="Tela cheia"
              className="text-slate-300 transition-colors hover:text-foreground"
            >
              <Maximize className="size-5" />
            </button>
          </div>

          {upNext.length > 0 && (
            <div className="border-t border-white/5 px-5 py-3 sm:px-8">
              <div className="flex items-center gap-4">
                <span className="shrink-0 text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">
                  A seguir
                </span>
                <div className="flex gap-3 overflow-x-auto scrollbar-none">
                  {upNext.map((ch) => (
                    <button
                      key={ch.id}
                      onClick={() => onPlay(ch)}
                      className="group relative w-28 shrink-0 overflow-hidden rounded-md ring-1 ring-white/10 transition-all hover:ring-aurora-2/60"
                    >
                      <div className="aspect-[4/3] w-full bg-surface">
                        {ch.poster || ch.logo ? (
                          <img
                            src={ch.poster ?? ch.logo}
                            alt={`Capa de ${ch.name}`}
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center">
                            <span className="font-black text-aurora-2/60">
                              {ch.name.slice(0, 1).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink to-transparent p-1.5 pt-5">
                        <p className="truncate text-[10px] font-semibold text-foreground">{ch.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
