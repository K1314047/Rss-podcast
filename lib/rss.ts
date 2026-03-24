import { XMLParser } from 'fast-xml-parser';

export type Episode = {
  id: string;
  title: string;
  description: string;
  pubDate: string;
  pageUrl: string;
  audioUrl?: string;
  image?: string;
};

export type ParsedFeed = {
  title: string;
  description: string;
  image?: string;
  feedUrl: string;
  episodes: Episode[];
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: true,
  parseTagValue: true,
  removeNSPrefix: false
});

function arrify<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function stripHtml(input: string = '') {
  return input
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickImage(item: any, channelImage?: string) {
  return (
    item?.['media:group']?.['media:thumbnail']?.url ||
    item?.['media:thumbnail']?.url ||
    item?.image?.url ||
    channelImage
  );
}

function pickAudioUrl(item: any) {
  const enclosures = arrify(item?.enclosure);
  const enclosureAudio = enclosures.find((entry) => {
    const type = String(entry?.type || '').toLowerCase();
    return type.startsWith('audio/');
  });

  if (enclosureAudio?.url) return enclosureAudio.url;

  const mediaContent = arrify(item?.['media:group']?.['media:content']).find((entry) => {
    const type = String(entry?.type || '').toLowerCase();
    return type.startsWith('audio/');
  });

  return mediaContent?.url;
}

export function parseFeed(xml: string, feedUrl: string): ParsedFeed {
  const raw = parser.parse(xml);
  const rssChannel = raw?.rss?.channel;
  const atomFeed = raw?.feed;

  if (rssChannel) {
    const channelImage =
      rssChannel?.image?.url ||
      rssChannel?.['itunes:image']?.href ||
      rssChannel?.['media:thumbnail']?.url;

    const episodes = arrify(rssChannel.item).map((item: any, index: number) => ({
      id: item.guid?.['#text'] || item.guid || item.link || `ep-${index}`,
      title: item.title || `Episode ${index + 1}`,
      description: stripHtml(item.description || item['content:encoded'] || ''),
      pubDate: item.pubDate || '',
      pageUrl: item.link || '',
      audioUrl: pickAudioUrl(item),
      image: pickImage(item, channelImage)
    }));

    return {
      title: rssChannel.title || '未命名播客',
      description: stripHtml(rssChannel.description || ''),
      image: channelImage,
      feedUrl,
      episodes
    };
  }

  if (atomFeed) {
    const channelImage =
      atomFeed?.logo ||
      atomFeed?.icon ||
      atomFeed?.['media:thumbnail']?.url;

    const entries = arrify(atomFeed.entry).map((entry: any, index: number) => {
      const links = arrify(entry.link);
      const htmlLink = links.find((link) => link.rel === 'alternate')?.href || links[0]?.href || '';
      const audioLink = links.find((link) => String(link.type || '').startsWith('audio/'))?.href;

      return {
        id: entry.id || htmlLink || `entry-${index}`,
        title: entry.title || `Episode ${index + 1}`,
        description: stripHtml(entry.summary || entry.content || ''),
        pubDate: entry.published || entry.updated || '',
        pageUrl: htmlLink,
        audioUrl: audioLink,
        image: pickImage(entry, channelImage)
      };
    });

    return {
      title: atomFeed.title || '未命名频道',
      description: stripHtml(atomFeed.subtitle || ''),
      image: channelImage,
      feedUrl,
      episodes: entries
    };
  }

  throw new Error('无法识别该 RSS/Atom 结构');
}
