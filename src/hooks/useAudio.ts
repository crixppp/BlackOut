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
  const [playing, setPlaying] = useState(false);
  const [available, setAvailable] = useState(AUDIO_TRACKS.length > 0);
  const random = useMemo(() => new CryptoRandomSource(), []);
  const [trackIndex, setTrackIndex] = useState(() => random.integer(0, AUDIO_TRACKS.length - 1));

  useEffect(() => {
    const audio = new Audio(AUDIO_TRACKS[trackIndex]?.src);
    audio.loop = false;
    audio.preload = 'none';
    audio.volume = settings.musicVolume;
    audioRef.current = audio;

    const onEnded = () => setTrackIndex((index) => (index + 1) % AUDIO_TRACKS.length);
    const onError = () => {
      setAvailable(false);
      setPlaying(false);
    };
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [settings.musicVolume, trackIndex]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = settings.musicVolume;
    }
  }, [settings.musicVolume]);

  useEffect(() => {
    if (!settings.backgroundMusic && audioRef.current) {
      audioRef.current.pause();
      setPlaying(false);
    }
  }, [settings.backgroundMusic]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !settings.backgroundMusic) {
      updateSettings({ ...settings, backgroundMusic: true });
      return;
    }

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => {
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
