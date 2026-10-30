import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
renderProjects(projects, projectsContainer, 'h2');

// Step 1.6: project count in the page title, updated from the data
const projectsTitle = document.querySelector('.projects-title');
if (projectsTitle && projects) {
  projectsTitle.textContent = `${projects.length} Projects`;
}

// Lab 5 Step 1.3: full-circle arcs, radius 50 to fill the -50..50 viewBox
const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
// Keyed by year, so a year keeps its color when the data is filtered
const colors = d3.scaleOrdinal(d3.schemeTableau10);

// Lab 5 Step 5.4: both filters live here, so neither one erases the other.
// The selection is a year, not a wedge index, because a search changes
// which wedge sits at each index.
let query = '';
let selectedYear = null;

function matchesQuery(project) {
  const values = Object.values(project).join('\n').toLowerCase();
  return values.includes(query.toLowerCase());
}

// Search first, then the year: the pie shows every year the search matched,
// and the cards show only the selected one
function applyFilters() {
  const searchedProjects = projects.filter(matchesQuery);

  // Drop a selection whose year the search has filtered out
  if (!searchedProjects.some((project) => project.year === selectedYear)) {
    selectedYear = null;
  }

  const shownProjects =
    selectedYear === null
      ? searchedProjects
      : searchedProjects.filter((project) => project.year === selectedYear);

  renderProjects(shownProjects, projectsContainer, 'h2');
  renderPieChart(searchedProjects);
}

// Lab 5 Step 4.4: draw the pie and legend for whichever projects are given
function renderPieChart(projectsGiven) {
  // Step 3: count projects per year, oldest year first
  const rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );
  const data = rolledData
    .map(([year, count]) => ({ value: count, label: year }))
    .sort((a, b) => a.label - b.label);

  // sort(null) keeps wedges in year order, matching the legend
  const sliceGenerator = d3.pie().value((d) => d.value).sort(null);
  const arcData = sliceGenerator(data);

  // Clear the previous render before drawing again
  const svg = d3.select('#projects-pie-plot');
  svg.selectAll('path').remove();
  const legend = d3.select('.legend');
  legend.selectAll('li').remove();

  arcData.forEach((d) => {
    const year = d.data.label;
    svg
      .append('path')
      .attr('d', arcGenerator(d))
      .attr('fill', colors(year))
      .attr('class', year === selectedYear ? 'selected' : null)
      .on('click', () => {
        // Clicking the selected wedge again clears the selection
        selectedYear = selectedYear === year ? null : year;
        applyFilters();
      });
  });

  // Step 2.2: one legend item per wedge, colored through --color
  data.forEach((d) => {
    legend
      .append('li')
      .attr('style', `--color: ${colors(d.label)}`)
      .attr('class', d.label === selectedYear ? 'selected' : null)
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
  });
}

renderPieChart(projects);

// Lab 5 Step 4: case-insensitive search across every project field
const searchInput = document.querySelector('.searchBar');

searchInput.addEventListener('input', (event) => {
  query = event.target.value;
  applyFilters();
});
