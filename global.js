console.log("IT'S ALIVE!");

// Step 1: select all matching elements as an array
function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

// Step 3: build the navigation menu from a list of pages
let pages = [
  { url: '', title: 'Home' },
  { url: 'projects/', title: 'Projects' },
  { url: 'resume/', title: 'Resume' },
  { url: 'contact/', title: 'Contact' },
  { url: 'https://github.com/dayconnor', title: 'GitHub' },
];

// Local server serves from "/", GitHub Pages serves from "/dsc106-port/"
const BASE_PATH =
  location.hostname === 'localhost' || location.hostname === '127.0.0.1'
    ? '/'
    : '/dsc106-port/';

let nav = document.createElement('nav');
document.body.prepend(nav);

for (let p of pages) {
  let url = p.url;
  let title = p.title;

  // Prefix relative URLs so links work from any page
  url = !url.startsWith('http') ? BASE_PATH + url : url;

  let a = document.createElement('a');
  a.href = url;
  a.textContent = title;

  // Highlight the link for the page we are on
  a.classList.toggle(
    'current',
    a.host === location.host && a.pathname === location.pathname,
  );

  // Open external links in a new tab
  if (a.host !== location.host) {
    a.target = '_blank';
  }

  nav.append(a);
}

// Step 4: dark mode switcher
document.body.insertAdjacentHTML(
  'afterbegin',
  `
  <label class="color-scheme">
    Theme:
    <select>
      <option value="light dark">Automatic</option>
      <option value="light">Light</option>
      <option value="dark">Dark</option>
    </select>
  </label>`,
);

let select = document.querySelector('.color-scheme select');

function setColorScheme(colorScheme) {
  document.documentElement.style.setProperty('color-scheme', colorScheme);
  select.value = colorScheme;
}

// Step 4.5: restore the saved preference on page load
if ('colorScheme' in localStorage) {
  setColorScheme(localStorage.colorScheme);
}

select.addEventListener('input', function (event) {
  setColorScheme(event.target.value);
  localStorage.colorScheme = event.target.value;
});

// Step 5: build a properly encoded mailto URL from the contact form
let form = document.querySelector('form');

form?.addEventListener('submit', function (event) {
  event.preventDefault();
  let data = new FormData(form);
  let params = [];

  for (let [name, value] of data) {
    params.push(`${name}=${encodeURIComponent(value)}`);
  }

  location.href = `${form.action}?${params.join('&')}`;
});

// Lab 4 Step 1.2: fetch and parse a JSON file, logging any failure
export async function fetchJSON(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch projects: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching or parsing JSON data:', error);
  }
}

// Lab 4 Step 1.4: render one <article> per project into a container
export function renderProjects(projects, containerElement, headingLevel = 'h2') {
  if (!containerElement) {
    console.error('renderProjects: container element not found');
    return;
  }

  // Only accept h1-h6, so a bad argument can't inject another tag
  if (!/^h[1-6]$/.test(headingLevel)) {
    headingLevel = 'h2';
  }

  // Clear first so re-rendering doesn't duplicate articles
  containerElement.innerHTML = '';

  if (!Array.isArray(projects) || projects.length === 0) {
    containerElement.innerHTML = '<p>No projects to show yet.</p>';
    return;
  }

  for (let project of projects) {
    const article = document.createElement('article');
    const image = project.image ?? 'https://dsc106.com/labs/lab02/images/empty.svg';

    article.innerHTML = `
      <${headingLevel}>${project.title ?? 'Untitled project'}</${headingLevel}>
      <img src="${image}" alt="">
      <p>${project.description ?? ''}</p>
    `;

    containerElement.appendChild(article);
  }
}

// Lab 4 Step 3.2: public profile data from the GitHub API
export async function fetchGitHubData(username) {
  return fetchJSON(`https://api.github.com/users/${username}`);
}
