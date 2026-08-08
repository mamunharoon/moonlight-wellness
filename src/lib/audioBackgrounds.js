// WakeWise — Audio Architecture, Phase C1 — background soundscape types.
import { BACKGROUND_ICON_MAP } from './audioIcons';

export const BACKGROUND_TYPES = [
  { id: 'none', label: 'None' },
  { id: 'rain', label: 'Rain' },
  { id: 'ocean', label: 'Ocean waves' },
  { id: 'forest', label: 'Forest sounds' },
  { id: 'fireplace', label: 'Fireplace' },
  { id: 'wind', label: 'Wind' },
  { id: 'white-noise', label: 'White noise' },
  { id: 'pink-noise', label: 'Pink noise' },
  { id: 'brown-noise', label: 'Brown noise' }
].map((background) => ({ ...background, icon: BACKGROUND_ICON_MAP[background.id] }));

export const getBackgroundLabel = (backgroundType) =>
  BACKGROUND_TYPES.find((b) => b.id === backgroundType)?.label ?? backgroundType;
