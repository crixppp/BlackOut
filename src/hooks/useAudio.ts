import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AUDIO_TRACKS } from '../data/audioTracks';
import type { GameSettings } from '../types/game';
import { CryptoRandomSource } from '../engine/random';

interface UseAudioResult {
  playing: boolean;
  available: boolean;
  currentTrackLabel: string;
  toggle: () => void;
  setVolume: (volume: number) => void;
}

export function useAudio(
  settings: GameSettings,
  updateSettings: (settings: GameSettings) => void,
): UseAudioResult {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shouldPlayRef = useRef(false);
  const volumeRef = useRef(settings.musicVolume);
  const [playing, setPlaying] = useState(false);
  const [available, setAvailable] = useState(AUDIO_TRACKS.length > 0);
  const random = useMemo(() => new CryptoRandomSource(), []);
  const [trackIndex, setTrackIndex] = useState(() => random.integer(0, AUDIO_TRACKS.length - 1));

  useEffect(() => {
    const audio = new Audio(AUDIO_TRACKS[trackIndex]?.src);
    audio.loop = false;
    audio.preload = 'auto';
    audio.volume = volumeRef.current;
    audioRef.current = audio;

    const playCurrent = () => {
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => {
          shouldPlayRef.current = false;
          setPlaying(false);
          setAvailable(false);
        });
    };

    const onEnded = () => {
      if (AUDIO_TRACKS.length <= 1) {
        audio.currentTime = 0;
        playCurrent();
        return;
      }
      setTrackIndex((index) => (index + 1) % AUDIO_TRACKS.length);
    };
    const onError = () => {
      if (shouldPlayRef.current && AUDIO_TRACKS.length > 1) {
        setTrackIndex((index) => (index + 1) % AUDIO_TRACKS.length);
        return;
      }
      shouldPlayRef.current = false;
      setAvailable(AUDIO_TRACKS.length > 0);
      setPlaying(false);
    };
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    if (shouldPlayRef.current && settings.backgroundMusic) {
      playCurrent();
    }

    return () => {
      audio.pause();
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [settings.backgroundMusic, trackIndex]);

  useEffect(() => {
    volumeRef.current = settings.musicVolume;
    if (audioRef.current) {
      audioRef.current.volume = settings.musicVolume;
    }
  }, [settings.musicVolume]);

  useEffect(() => {
    if (!settings.backgroundMusic && audioRef.current) {
      shouldPlayRef.current = false;
      audioRef.current.pause();
      setPlaying(false);
    }
  }, [settings.backgroundMusic]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !settings.backgroundMusic) {
      shouldPlayRef.current = true;
      updateSettings({ ...settings, backgroundMusic: true });
      return;
    }

    if (playing) {
      shouldPlayRef.current = false;
      audio.pause();
      setPlaying(false);
      return;
    }

    shouldPlayRef.current = true;
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => {
        shouldPlayRef.current = false;
        setPlaying(false);
        setAvailable(false);
      });
  }, [playing, settings, updateSettings]);

  const setVolume = useCallback(
    (volume: number) => {
      updateSettings({ ...settings, musicVolume: Math.max(0, Math.min(1, volume)) });
    },
    [settings, updateSettings],
  );

  return {
    playing,
    available,
    currentTrackLabel: AUDIO_TRACKS[trackIndex]?.label ?? 'No track',
    toggle,
    setVolume,
  };
}
