import re
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import random
from difflib import SequenceMatcher
from urllib.parse import quote

app = Flask(__name__)
CORS(app)

def remove_html_tags(text):
    tag_pattern = re.compile('<.*?>')
    clean_text = re.sub(tag_pattern, '', text)
    return clean_text

def similarity(a, b):
    return SequenceMatcher(None, a, b).ratio()

def is_irrelevant_category(category):
    irrelevant_patterns = [
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
    "All articles with dead external links"
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
    "Articles needing additional categories"
    ]
    return any(re.search(pattern, category) for pattern in irrelevant_patterns)

def filter_categories_by_similarity(categories, keyword, top_n=5):
    def similarity(a, b):
        return SequenceMatcher(None, a, b).ratio()

    category_similarities = [(category, similarity(category, keyword)) for category in categories]
    sorted_categories = sorted(category_similarities, key=lambda x: x[1], reverse=True)
    most_similar_categories = [category for category, similarity_score in sorted_categories[:top_n]]

    return most_similar_categories

def get_wikipedia_links(keyword, n=20, srwhat=None, srsort='relevance'):
    encoded_keyword = quote(keyword)
    search_url = f"https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srsearch={encoded_keyword}&srlimit={n}&srsort={srsort}"
    if srwhat:
        search_url += f"&srwhat={srwhat}"
    response = requests.get(search_url)
    data = response.json()

    search_results = data['query']['search']
    return [result['title'] for result in search_results]

def get_wikipedia_categories(title, keyword, top_n_categories=5):
    categories_url = f"https://en.wikipedia.org/w/api.php?action=query&prop=categories&format=json&cllimit=10&titles={title}"
    response = requests.get(categories_url)
    data = response.json()

    page = next(iter(data['query']['pages'].values()))
    categories = page.get('categories', [])

    # Filter out irrelevant categories
    filtered_categories = [category['title'] for category in categories if not is_irrelevant_category(category['title'])]

    # Filter categories based on similarity to the keyword
    most_similar_categories = filter_categories_by_similarity(filtered_categories, keyword, top_n=top_n_categories)

    return most_similar_categories

def get_wikipedia_summary(title, exsentences=3):
    summary_url = f"https://en.wikipedia.org/w/api.php?action=query&prop=extracts&format=json&exintro=&titles={title}&exsentences={exsentences}"
    response = requests.get(summary_url)
    data = response.json()

    page = next(iter(data['query']['pages'].values()))
    return page.get('extract', '')  # Return an empty string if the 'extract' key is not present

@app.route("/wikipedia_summaries", methods=["GET"])
def wikipedia_summaries():
    keyword = request.args.get("keyword")
    top_n_links = int(request.args.get("top_n_links", 2))
    srwhat = request.args.get("srwhat", None)
    srsort = request.args.get("srsort", "relevance")
    exsentences = int(request.args.get("exsentences", 3))
    top_exsentences = int(request.args.get("top_exsentences", 6))
    top_n_categories = int(request.args.get("top_n_categories", 5)) 

    top_links = get_wikipedia_links(keyword, n=top_n_links, srwhat=srwhat, srsort=srsort)
    # random.shuffle(top_links)  # Comment out this line to remove the shuffling
    selected_links = top_links[:top_n_links]  # Select the top N links 

    summaries = []

    for i, link in enumerate(selected_links):
        summary_exsentences = top_exsentences if i == 0 else exsentences
        summary = get_wikipedia_summary(link, exsentences=summary_exsentences)
        clean_summary = remove_html_tags(summary)  # Remove HTML tags from the summary
        categories = get_wikipedia_categories(link, keyword, top_n_categories=top_n_categories)
        summaries.append({"title": link, "summary": clean_summary, "categories": categories})

    return jsonify(summaries)

if __name__ == "__main__":
    app.run(port=5000)
