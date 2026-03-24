'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Moon, Radio, SunMedium, Volume2 } from 'lucide-react';
import { FEEDS } from '@/lib/feeds';
import type { ParsedFeed, Episode } from '@/lib/rss';

type FeedState = {
  loading: boolean;
  error: string;
  data?: ParsedFeed;
};

type FeedStateMap = Record<string, FeedState>;
type ProgressMap = Record<string, number>;

type RecentEpisode = Episode & {
  feedId: string;
  feedTitle: string;
  feedImage?: string;
};

const THEME_KEY = 'podcast-theme';
const ACTIVE_FEED_KEY = 'podcast-active-feed';
const ACTIVE_EPISODE_KEY = 'podcast-active-episode';
const PROGRESS_KEY = 'podcast-progress';

function formatDate(input: string) {
  if (!input) return '未知日期';
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function parseDateValue(input: string) {
  const value = new Date(input).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function readProgressMap() {
  if (typeof window === 'undefined') return {} as ProgressMap;
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function PodcastClient() {
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [activeFeedId, setActiveFeedId] = useState(FEEDS[0].id);
  const [activeEpisodeId, setActiveEpisodeId] = useState('');
  const [feedsMap, setFeedsMap] = useState<FeedStateMap>(() =>
    Object.fromEntries(FEEDS.map((feed) => [feed.id, { loading: true, error: '' }]))
  );
  const [progressMap, setProgressMap] = useState<ProgressMap>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const restoreRef = useRef<string>('');

  useEffect(() => {
    setMounted(true);

    const savedTheme = window.localStorage.getItem(THEME_KEY);
    const initialTheme = savedTheme === 'dark' ? 'dark' : 'light';
    setTheme(initialTheme);
    document.documentElement.setAttribute('data-theme', initialTheme);

    const savedFeedId = window.localStorage.getItem(ACTIVE_FEED_KEY);
    const savedEpisodeId = window.localStorage.getItem(ACTIVE_EPISODE_KEY);
    const savedProgress = readProgressMap();

    if (savedFeedId && FEEDS.some((feed) => feed.id === savedFeedId)) {
      setActiveFeedId(savedFeedId);
    }
    if (savedEpisodeId) {
      setActiveEpisodeId(savedEpisodeId);
    }
    setProgressMap(savedProgress);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAllFeeds() {
      const results = await Promise.all(
        FEEDS.map(async (feed) => {
          try {
            const res = await fetch(`/api/feed?id=${feed.id}`, { signal: controller.signal });
            if (!res.ok) {
              const payload = await res.json().catch(() => null);
              throw new Error(payload?.error || '加载失败');
            }
            const payload = await res.json();
            return [feed.id, { loading: false, error: '', data: payload }] as const;
          } catch (error) {
            if (controller.signal.aborted) {
              return [feed.id, { loading: true, error: '' }] as const;
            }
            return [
              feed.id,
              {
                loading: false,
                error: error instanceof Error ? error.message : '加载失败'
              }
            ] as const;
          }
        })
      );

      if (controller.signal.aborted) return;
      setFeedsMap(Object.fromEntries(results));
    }

    loadAllFeeds();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    window.localStorage.setItem(ACTIVE_FEED_KEY, activeFeedId);
  }, [activeFeedId, mounted]);

  useEffect(() => {
    if (!mounted || !activeEpisodeId) return;
    window.localStorage.setItem(ACTIVE_EPISODE_KEY, activeEpisodeId);
  }, [activeEpisodeId, mounted]);

  useEffect(() => {
    if (!mounted) return;
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme, mounted]);

  const activeFeedState = feedsMap[activeFeedId] || { loading: true, error: '' };
  const activeFeed = activeFeedState.data;

  const allLoadedFeeds = useMemo(
    () => FEEDS.map((feed) => ({ feed, state: feedsMap[feed.id] })).filter((entry) => entry.state?.data),
    [feedsMap]
  );

  const recentEpisodes = useMemo(() => {
    const items: RecentEpisode[] = [];

    for (const { feed, state } of allLoadedFeeds) {
      if (!state?.data) continue;
      for (const episode of state.data.episodes) {
        items.push({
          ...episode,
          feedId: feed.id,
          feedTitle: state.data.title || feed.title,
          feedImage: state.data.image
        });
      }
    }

    return items.sort((a, b) => parseDateValue(b.pubDate) - parseDateValue(a.pubDate)).slice(0, 12);
  }, [allLoadedFeeds]);

  useEffect(() => {
    if (!activeFeed?.episodes?.length) return;

    const matchedEpisode = activeEpisodeId
      ? activeFeed.episodes.find((episode) => episode.id === activeEpisodeId)
      : null;

    if (matchedEpisode) return;

    const fallback = activeFeed.episodes.find((episode) => episode.audioUrl) || activeFeed.episodes[0];
    if (fallback) {
      setActiveEpisodeId(fallback.id);
    }
  }, [activeFeed, activeEpisodeId]);

  const currentEpisode = useMemo(() => {
    if (!activeFeed) return null;
    return activeFeed.episodes.find((episode) => episode.id === activeEpisodeId) || null;
  }, [activeFeed, activeEpisodeId]);

  const playableCount = useMemo(
    () => activeFeed?.episodes.filter((ep) => ep.audioUrl).length || 0,
    [activeFeed]
  );

  const continueCount = useMemo(
    () => Object.values(progressMap).filter((value) => Number.isFinite(value) && value > 5).length,
    [progressMap]
  );

  function persistProgress(next: ProgressMap) {
    setProgressMap(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
    }
  }

  function saveEpisodeProgress(episodeId: string, seconds: number) {
    const safeSeconds = Math.max(0, Math.floor(seconds || 0));
    const next = { ...readProgressMap() };

    if (safeSeconds <= 0) {
      delete next[episodeId];
    } else {
      next[episodeId] = safeSeconds;
    }

    persistProgress(next);
  }

  function handleSelectEpisode(feedId: string, episodeId: string) {
    setActiveFeedId(feedId);
    setActiveEpisodeId(episodeId);
  }

  function handleLoadedMetadata() {
    if (!audioRef.current || !currentEpisode?.audioUrl) return;
    if (restoreRef.current === currentEpisode.id) return;

    const saved = readProgressMap()[currentEpisode.id] || 0;
    const duration = Number.isFinite(audioRef.current.duration) ? audioRef.current.duration : 0;
    const target = duration > 0 ? Math.min(saved, Math.max(duration - 3, 0)) : saved;

    if (target > 0) {
      audioRef.current.currentTime = target;
    }

    restoreRef.current = currentEpisode.id;
  }

  function toggleTheme() {
    setTheme((value) => (value === 'light' ? 'dark' : 'light'));
  }

  return (
    <div className="page">
      <div className="container">
        <div className="hero">
          <div>
            <h1>Listen Now</h1>
            <p>把更新留给 RSS，把注意力留给声音</p>
          </div>

          <div className="hero-actions">
            <button className="theme-toggle" onClick={toggleTheme} aria-label="切换主题">
              {theme === 'light' ? <Moon size={16} /> : <SunMedium size={16} />}
              {theme === 'light' ? '深色' : '浅色'}
            </button>
            <div className="badge">
              <Radio size={16} /> GitHub + Vercel
            </div>
          </div>
        </div>

        


        <div className="layout">
          <aside className="card sidebar">
            <div className="section-title">订阅源</div>
            <div className="feed-list">
              {FEEDS.map((feed) => {
                const state = feedsMap[feed.id];
                const resolvedTitle = state?.data?.title || feed.title;
                const resolvedSubtitle = state?.data?.description || feed.subtitle;

                return (
                  <button
                    key={feed.id}
                    className={`feed-button ${feed.id === activeFeedId ? 'active' : ''}`}
                    onClick={() => setActiveFeedId(feed.id)}
                  >
                    {resolvedTitle}
                    <small>{resolvedSubtitle || feed.subtitle}</small>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="content">
            {activeFeedState.loading && <div className="card loading">正在读取 RSS…</div>}

            {!activeFeedState.loading && activeFeedState.error && (
              <div className="card error">
                加载失败：{activeFeedState.error}
                <div className="tip">常见原因：源站临时不可访问、RSS 需要特殊 header、或者该源并不提供音频 enclosure。</div>
              </div>
            )}

            {!activeFeedState.loading && activeFeed && currentEpisode && (
              <>
                <section className="card player">
                  <div className="player-grid">
                    <img
                      className="player-cover"
                      src={currentEpisode.image || activeFeed.image || 'https://placehold.co/200x200?text=Podcast'}
                      alt={currentEpisode.title}
                    />
                    <div>
                      <div className="section-title">正在播放</div>
                      <h2>{currentEpisode.title}</h2>
                      <div className="player-meta">
                        {activeFeed.title} · {formatDate(currentEpisode.pubDate)} · 可直接播放 {playableCount} 集
                        {(progressMap[currentEpisode.id] || 0) > 5
                          ? ` · 已记忆进度 ${Math.floor((progressMap[currentEpisode.id] || 0) / 60)} 分钟`
                          : ''}
                      </div>

                      {currentEpisode.audioUrl ? (
                        <audio
                          key={currentEpisode.id}
                          ref={audioRef}
                          className="audio"
                          controls
                          preload="metadata"
                          src={currentEpisode.audioUrl}
                          onLoadedMetadata={handleLoadedMetadata}
                          onTimeUpdate={(event) => saveEpisodeProgress(currentEpisode.id, event.currentTarget.currentTime)}
                          onPause={(event) => saveEpisodeProgress(currentEpisode.id, event.currentTarget.currentTime)}
                          onEnded={() => saveEpisodeProgress(currentEpisode.id, 0)}
                        />
                      ) : (
                        <div className="tip">这个条目没有解析到可直接播放的音频地址，通常是 YouTube / 视频型 RSS，可点击右侧按钮跳转原页面。</div>
                      )}
                    </div>
                  </div>
                </section>

                <section className="feed-headline">
                  <div>
                    <div className="section-title">当前频道</div>
                    <h2 className="feed-title">{activeFeed.title}</h2>
                  </div>
                </section>

                <section className="episode-list compact-list">
                  {activeFeed.episodes.map((episode) => {
                    const remembered = progressMap[episode.id] || 0;
                    return (
                      <article className={`card episode compact ${episode.id === currentEpisode.id ? 'selected' : ''}`} key={episode.id}>
                        <button className="episode-row" onClick={() => setActiveEpisodeId(episode.id)}>
                          <div className="episode-main">
                            <div className="episode-title-row">
                              <h3 className="episode-title">{episode.title}</h3>
                              <span className="episode-date">{formatDate(episode.pubDate)}</span>
                            </div>
                            <div className="episode-subline">
                              <span>{episode.audioUrl ? '站内可播放' : '需跳转原页'}</span>
                              {remembered > 5 ? <span>已记忆 {Math.floor(remembered / 60)} 分</span> : null}
                            </div>
                          </div>
                          <div className="episode-side">
                            <span className="play-pill">
                              <Volume2 size={14} />
                              {episode.audioUrl ? '播放' : '查看'}
                            </span>
                          </div>
                        </button>

                        {episode.pageUrl ? (
                          <div className="row-actions">
                            <a className="text-link" href={episode.pageUrl} target="_blank" rel="noreferrer">
                              打开原始页面
                            </a>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </section>
              </>
            )}

            {!activeFeedState.loading && activeFeed && !currentEpisode && (
              <div className="card empty">这个订阅源里暂时没有可展示的节目。</div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
