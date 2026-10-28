const PLATFORM_HOSTS = [
  { platform: 'Instagram', hosts: ['instagram.com', 'www.instagram.com', 'm.instagram.com'] },
  { platform: 'Facebook', hosts: ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'fb.watch'] },
  { platform: 'LinkedIn', hosts: ['linkedin.com', 'www.linkedin.com', 'm.linkedin.com'] },
  { platform: 'YouTube', hosts: ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com', 'youtu.be', 'www.youtu.be'] },
  { platform: 'Google Business Profile', hosts: ['google.com', 'www.google.com', 'maps.app.goo.gl', 'g.page'] },
  { platform: 'X', hosts: ['x.com', 'www.x.com', 'mobile.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'] },
];

export const parseSocialPostUrl = (value) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Paste a public post URL first.');
  }
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Enter a complete post URL, including https://.');
  }
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error('Only http and https post URLs are supported.');
  if (url.username || url.password) throw new Error('Post URLs cannot contain login credentials.');

  const hostname = url.hostname.toLowerCase();
  const matched = PLATFORM_HOSTS.find(({ hosts }) => hosts.includes(hostname));
  if (!matched) throw new Error('Use a post URL from Instagram, Facebook, LinkedIn, YouTube, Google, or X.');
  url.hash = '';
  return { url: url.toString(), platform: matched.platform };
};

const requestPublicMetadata = async (endpoint, signal) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error('The public metadata request timed out.')), 12000);
  const abort = () => controller.abort(signal.reason);
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) abort();
  try {
    const response = await fetch(endpoint, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Public metadata provider returned HTTP ${response.status}.`);
    }
    const details = await response.json();
    if (details.error) throw new Error(String(details.error).slice(0, 300));
    return details;
  } catch (error) {
    if (controller.signal.aborted) {
      if (signal?.aborted) throw signal.reason || error;
      throw new Error('The public metadata request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
};

const metadataEndpoints = ({ url, platform }) => {
  const endpoints = [];
  if (platform === 'YouTube') {
    const youtube = new URL('https://www.youtube.com/oembed');
    youtube.searchParams.set('url', url);
    youtube.searchParams.set('format', 'json');
    endpoints.push(youtube);
  }
  const noembed = new URL('https://noembed.com/embed');
  noembed.searchParams.set('url', url);
  endpoints.push(noembed);
  return endpoints;
};

/**
 * @param {string} value
 * @param {{ signal?: AbortSignal }} [options]
 */
export const fetchPublicSocialMetadata = async (value, options = {}) => {
  const { signal } = options;
  const parsed = parseSocialPostUrl(value);
  let details = null;
  for (const endpoint of metadataEndpoints(parsed)) {
    try {
      details = await requestPublicMetadata(endpoint, signal);
      if (details.title || details.author_name || details.thumbnail_url || details.description) break;
      details = null;
    } catch (error) {
      if (signal?.aborted) throw error;
      details = null;
    }
  }
  if (!details) {
    throw new Error(`${parsed.platform} did not provide public post details. The post may be private or unsupported; connect its official platform API for account-only data.`);
  }
  const metadata = {
    title: String(details.title || '').slice(0, 500),
    author_name: String(details.author_name || '').slice(0, 200),
    author_url: String(details.author_url || '').slice(0, 2000),
    description: String(details.description || '').slice(0, 3000),
    thumbnail_url: String(details.thumbnail_url || '').slice(0, 2000),
    provider_name: String(details.provider_name || parsed.platform).slice(0, 100),
    provider_url: String(details.provider_url || '').slice(0, 2000),
    content_type: String(details.type || '').slice(0, 50),
    fetched_at: new Date().toISOString(),
  };
  return {
    ...parsed,
    metadata,
    message: `Imported the public title, creator, description, and preview image the provider exposes. Private captions and performance data require official account access.`,
  };
};
