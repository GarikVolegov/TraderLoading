// Audit probe: intentionally does not assert that the current directions are correct.
import { classifyNewsArticle } from '../../artifacts/api-server/src/services/newsHub/intelligence.ts';

const titles = ['US Treasury yields rise', 'US Treasury yields fall', 'Fed signals a rate cut', 'Fed signals a rate hike'];
console.table(titles.map(title => {
  const { relevant, article } = classifyNewsArticle({
    title, summary: '', source: 'Synthetic audit fixture',
    publishedAt: '2026-09-23T08:00:00Z', url: `https://example.test/${encodeURIComponent(title)}`,
    sentiment: null, imageUrl: null,
  }, { pairs: 'XAUUSD', lang: 'it' });
  return { title, relevant, direction: article.impactDirection, matchConfidence: article.matchConfidence };
}));
