const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { stringify } = require('querystring');

const app = express();
app.use(cors());

function removeHtmlTags(text) {
  return text.replace(/<.*?>/g, '');
}

function similarity(a, b) {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  const longerLength = longer.length;
  if (longerLength === 0) {
    return 1.0;
  }
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(s1, s2) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) {
      costs[s2.length] = lastValue;
    }
  }
  return costs[s2.length];
}

function isIrrelevantCategory(category) {
  const irrelevantPatterns = [
    "All articles with unsourced statements",
    "Short description is different from Wikidata",
    "CS1 maint",
    "Use dmy dates",
    "Use mdy dates",
    "Articles with hCards",
    "Articles with hAudio microformats",
    "Articles containing .*-language text",
    "Articles needing additional references",
    "Pages using .* with unknown parameters",
    "Wikipedia articles .*",
    "Webarchive template .*",
    "Articles with .*",
    "Pages .*",
    "Harv and Sfn .*",
    "CS1 .*",
    "Vague or ambiguous .*",
    "Commons category link .*",
    "Official website .*",
    "Good articles",
    "All articles with dead external links",
    "All pages needing cleanup",
    "Wikipedia introduction cleanup",
    "All articles needing expert attention",
    "All articles covered by WikiProject Wikify",
    "All articles with incomplete citations",
    "All articles needing rewrite",
    "All articles that may contain original research",
    "All stub articles",
    "Articles prone to spam",
    "Articles to be merged",
    "Articles to be split",
    "Cleanup tagged articles",
    "Pages with citations having bare URLs",
    "Articles with multiple maintenance issues",
    "Articles needing additional categories",
  ];
  return irrelevantPatterns.some((pattern) => new RegExp(pattern).test(category));
}

function filterCategoriesBySimilarity(categories, keyword, topN = 5) {
  const categorySimilarities = categories.map((category) => [
    category,
    similarity(category, keyword),
  ]);
  const sortedCategories = categorySimilarities.sort((a, b) => b[1] - a[1]);
  const mostSimilarCategories = sortedCategories.slice(0, topN).map((category) => category[0]);
  return mostSimilarCategories;
}

async function getWikipediaLinks(keyword, n = 20, srwhat = null, srsort = 'relevance') {
  const encodedKeyword = encodeURIComponent(keyword);
  let searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srsearch=${encodedKeyword}&srlimit=${n}&srsort=${srsort}`;
  if (srwhat) {
    searchUrl += `&srwhat=${srwhat}`;
  }
  const response = await axios.get(searchUrl);
  const data = response.data;
  const searchResults = data.query.search;
  return searchResults.map((result) => result.title);
}

async function getWikipediaCategories(title, keyword, topNCategories = 5) {
    const categoriesUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=categories&format=json&cllimit=10&titles=${title}`;
    const response = await axios.get(categoriesUrl);
    const data = response.data;
    const page = Object.values(data.query.pages)[0];
    const categories = page.categories || [];
    const filteredCategories = categories
        .map((category) => category.title)
        .filter((category) => !isIrrelevantCategory(category));
    const mostSimilarCategories = filterCategoriesBySimilarity(
        filteredCategories,
        keyword,
        topNCategories
    );
    return mostSimilarCategories;
}

async function getWikipediaSummary(title, exsentences = 3) {
  const summaryUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&format=json&exintro=&titles=${title}&exsentences=${exsentences}`;
  const response = await axios.get(summaryUrl);
  const data = response.data;
  const page = Object.values(data.query.pages)[0];
  return page.extract || '';
}

app.get('/wikipedia_summaries', async (req, res) => {
  const keyword = req.query.keyword;
  const topNLinks = parseInt(req.query.top_n_links) || 2;
  const srwhat = req.query.srwhat || null;
  const srsort = req.query.srsort || 'relevance';
  const exsentences = parseInt(req.query.exsentences) || 3;
  const topExsentences = parseInt(req.query.top_exsentences) || 6;
  const topNCategories = parseInt(req.query.top_n_categories) || 5;

  const topLinks = await getWikipediaLinks(keyword, topNLinks, srwhat, srsort);
  const selectedLinks = topLinks.slice(0, topNLinks);

  const summaries = await Promise.all(
    selectedLinks.map(async (link, i) => {
      const summaryExsentences = i === 0 ? topExsentences : exsentences;
      const summary = await getWikipediaSummary(link, summaryExsentences);
      const cleanSummary = removeHtmlTags(summary);
      const categories = await getWikipediaCategories(link, keyword, topNCategories);
      return { title: link, summary: cleanSummary, categories };
    })
  );

  res.json(summaries);
});

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});