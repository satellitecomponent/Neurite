const input = document.getElementById('wiki-search-input');
const suggestionBox = document.getElementById('wiki-suggestions');

let articles = [];

fetch('/wiki/articles.json')
    .then(res => res.json())
    .then(data => {
        articles = data;
    });

function showSuggestions(query = '') {
  const value = query.toLowerCase();
  const matches = articles.filter(title => title.includes(value));
  suggestionBox.innerHTML = matches
    .map(title => `<li data-title="${title}">${title}</li>`)
    .join('');
  suggestionBox.style.display = matches.length ? 'block' : 'none';
}

input.addEventListener('focus', () => {
  showSuggestions(input.value);
});

let suppressBlur = false;

// When mouse is down on a suggestion, prevent blur from hiding the box
suggestionBox.addEventListener('mousedown', () => {
    suppressBlur = true;
});

input.addEventListener('blur', () => {
    if (suppressBlur) {
        suppressBlur = false;
        return;
    }
    suggestionBox.style.display = 'none';
});


input.addEventListener('input', () => {
  showSuggestions(input.value);
});

suggestionBox.addEventListener('click', (e) => {
  if (e.target.tagName === 'LI') {
    input.value = e.target.dataset.title;
    suggestionBox.style.display = 'none';
    redirectToSearch();
  }
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    suggestionBox.style.display = 'none';
    redirectToSearch();
  }
});

function redirectToSearch() {
    const query = input.value.trim().toLowerCase();
    if (!query) return;

    const match = articles.find(title => title.toLowerCase() === query);
    if (match) {
        window.location.href = `/wiki/${match}/`;
    } else {
        window.location.href = `/wiki/?search=${encodeURIComponent(query)}`;
    }
}

