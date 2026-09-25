// Bumped whenever generated media is rebuilt so browsers never show a stale cached copy.
export const ASSET_VERSION = '5';
export const versioned = (url: string) => `${url}${url.includes('?') ? '&' : '?'}v=${ASSET_VERSION}`;
