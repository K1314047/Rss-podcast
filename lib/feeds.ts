export type FeedSource = {
  id: string;
  title: string;
  subtitle: string;
  url: string;
};

export const FEEDS: FeedSource[] = [
  {
    id: 'feed-1',
    title: '小岛大浪吹-非正经政经频道',
    subtitle: '来自 RSSYes 的 YouTube / 播客源',
    url: 'https://rssyes.com/yt-rss/UCYPT3wl0MgbOz63ho166KOw.xml'
  },
  {
    id: 'feed-2',
    title: '游牧夫妻',
    subtitle: '来自 RSSYes 的 YouTube / 播客源',
    url: 'https://rssyes.com/yt-rss/UC-wmAIbxpQu69c3DcjgB4FQ.xml'
  }
];

export function getFeedById(id: string) {
  return FEEDS.find((feed) => feed.id === id) ?? FEEDS[0];
}
