export interface AudioTrack {
  src: string;
  label: string;
}

export const AUDIO_TRACKS: AudioTrack[] = Array.from({ length: 31 }, (_, index) => {
  const trackNumber = index + 1;
  return {
    src: `./assets/audio/track-${trackNumber.toString().padStart(2, '0')}.mp3`,
    label: `Background track ${trackNumber}`,
  };
});
