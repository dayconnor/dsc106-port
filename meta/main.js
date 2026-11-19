import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

// Lab 6 Step 5.4: shared with isCommitSelected(), so set once the chart exists
let xScale;
let yScale;
// Lab 8: set once over every commit, so a dot keeps its size while
// scrolling adds and removes the others
let rScale;

// Shared by renderScatterPlot() and updateScatterPlot()
const width = 1000;
const height = 600;
const margin = { top: 10, right: 10, bottom: 30, left: 20 };
const usableArea = {
  top: margin.top,
  right: width - margin.right,
  bottom: height - margin.bottom,
  left: margin.left,
  width: width - margin.left - margin.right,
  height: height - margin.top - margin.bottom,
};

// Step 1.1: CSV values arrive as strings, so convert numbers and dates
async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

// Step 1.2: one object per commit, built from that commit's lines
function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      // Every line in a commit shares its author and timestamps
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;
      let ret = {
        id: commit,
        url: 'https://github.com/dayconnor/dsc106-port/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        // e.g. 2:30 PM = 14.5
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      // Kept for the language breakdown, but hidden from console.log and
      // loops, and fixed so it can't be overwritten or deleted
      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false,
        writable: false,
        configurable: false,
      });

      return ret;
    })
    // Lab 8 Step 3.3: loc.csv is ordered by file, not time, so sort here
    // to keep the story steps in commit order
    .sort((a, b) => a.datetime - b.datetime);
}

// Step 1.3: summary stats over the codebase.
// Lab 8 Step 1.2: rerun with the filtered lines, so it clears first
function renderCommitInfo(data, commits) {
  d3.select('#stats').html('');
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);

  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);

  // Distinct values: one group per file
  dl.append('dt').text('Files');
  dl.append('dd').text(d3.group(data, (d) => d.file).size);

  // Min/max: the file whose last line number is highest
  const fileLengths = d3.rollups(
    data,
    (v) => d3.max(v, (v) => v.line),
    (d) => d.file,
  );
  const [longestFile, longestFileLines] = d3.greatest(fileLengths, (d) => d[1]);
  dl.append('dt').text('Longest file');
  dl.append('dd').html(`${longestFile} <small>(${longestFileLines} lines)</small>`);

  // Whole-dataset aggregates
  dl.append('dt').text('Average line length');
  dl.append('dd').html(
    `${d3.format('.1f')(d3.mean(data, (d) => d.length))} <small>characters</small>`,
  );

  dl.append('dt').text('Max depth');
  dl.append('dd').text(d3.max(data, (d) => d.depth));

  // Grouped aggregate: lines per period of the day, then the busiest one
  const workByPeriod = d3.rollups(
    data,
    (v) => v.length,
    (d) => d.datetime.toLocaleString('en', { dayPeriod: 'short' }),
  );
  const maxPeriod = d3.greatest(workByPeriod, (d) => d[1])?.[0];
  // "in the afternoon" → "afternoon", so it fits one column
  dl.append('dt').text('Most work done');
  dl.append('dd').text(maxPeriod?.replace('in the ', ''));
}

// Step 2: commits by date (X) and time of day (Y)
function renderScatterPlot(data, commits) {
  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  // Step 4.2: sqrt so dot area, not radius, tracks lines edited
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  // Step 2.3: gridlines first, so the axes and dots draw over them
  const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`);
  gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

  // Step 2.2: axes, with hours shown as 00:00 to 24:00 → 00:00
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  // Lab 8 Step 1.2: classed so updateScatterPlot() can find and redraw it
  svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .attr('class', 'x-axis')
    .call(xAxis);

  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .attr('class', 'y-axis')
    .call(yAxis);

  svg.append('g').attr('class', 'dots');
  drawDots(commits);

  createBrushSelector(svg);
}

// Lab 8 Step 1.2: redraw the existing SVG instead of appending a new one
function updateScatterPlot(data, commits) {
  const svg = d3.select('#chart').select('svg');

  // With a single commit the extent has zero width and the axis breaks,
  // so pad it to a day on each side
  let [start, end] = d3.extent(commits, (d) => d.datetime);
  if (+start === +end) {
    start = d3.timeDay.offset(start, -1);
    end = d3.timeDay.offset(end, 1);
  }
  xScale = xScale.domain([start, end]).nice();

  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(d3.axisBottom(xScale));

  drawDots(commits);
}

// Both scatter plot functions join the dots the same way
function drawDots(commits) {
  // Step 4.3: largest first, so small dots sit on top and stay hoverable
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);

  d3.select('#chart g.dots')
    .selectAll('circle')
    // Lab 8 Step 1.3: keyed by commit id, so each commit keeps its own
    // circle and only new commits get new (animated-in) ones
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    // Step 1.4: CSS scales the grow-in time by radius
    .style('--r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
}

// Step 3.1: fill the tooltip with the hovered commit
function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time = document.getElementById('commit-clock');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  if (Object.keys(commit).length === 0) return;

  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });
  time.textContent = commit.datetime?.toLocaleString('en', {
    timeStyle: 'short',
  });
  author.textContent = commit.author;
  lines.textContent = commit.totalLines;
}

// Step 3.3: CSS fades it in and out via the hidden attribute
function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

// Step 3.4: just below and right of the cursor, so it doesn't cover the dot
function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX + 10}px`;
  tooltip.style.top = `${event.clientY + 10}px`;
}

// Step 5.1–5.2: the brush overlay catches all mouse events, so raise the
// dots (and the brush's own handles) back above it to keep tooltips working
function createBrushSelector(svg) {
  svg.call(d3.brush().on('start brush end', brushed));
  svg.selectAll('.dots, .overlay ~ *').raise();
}

// Step 5.4: selection is [[x0, y0], [x1, y1]] in SVG pixels, or null
function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }
  const [x0, x1] = selection.map((d) => d[0]);
  const [y0, y1] = selection.map((d) => d[1]);
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function brushed(event) {
  const selection = event.selection;
  d3.selectAll('circle').classed('selected', (d) =>
    isCommitSelected(selection, d),
  );
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

// Step 5.5. Lab 8: only commits currently on the plot can be selected
function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');
  countElement.textContent = `${
    selectedCommits.length || 'No'
  } commits selected`;

  return selectedCommits;
}

// Step 5.6: lines per language across the selected commits
function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById('language-breakdown');

  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }
  const lines = selectedCommits.flatMap((d) => d.lines);

  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  container.innerHTML = '';

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);

    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  }
}

// Lab 8 Step 2.4: one color per technology (css, html, js)
const colors = d3.scaleOrdinal(d3.schemeTableau10);

// Lab 8 Step 2: unit visualization, one dot per line, grouped by file
function updateFileDisplay(filteredCommits) {
  const lines = filteredCommits.flatMap((d) => d.lines);
  const files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      // Every line of a file shares its type
      return { name, lines, type: lines[0].type };
    })
    // Step 2.3: biggest files first
    .sort((a, b) => b.lines.length - a.lines.length);

  const filesContainer = d3
    .select('#files')
    .selectAll('div')
    .data(files, (d) => d.name)
    .join(
      // Only runs when a file first appears
      (enter) =>
        enter.append('div').call((div) => {
          const dt = div.append('dt');
          dt.append('code');
          dt.append('small');
          div.append('dd');
        }),
    )
    .attr('style', (d) => `--color: ${colors(d.type)}`);

  // Runs on every update
  filesContainer.select('dt > code').text((d) => d.name);
  filesContainer.select('dt > small').text((d) => `${d.lines.length} lines`);

  // Step 2.2: one dot per line
  filesContainer
    .select('dd')
    .selectAll('div')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc');
}

// Lab 8 Step 3.2 / Step 4: one paragraph of story per commit; each
// scrolly section passes its own wording
function renderStory(selector, commits, describe) {
  d3.select(selector)
    .selectAll('.step')
    .data(commits)
    .join('div')
    .attr('class', 'step')
    .html(describe);
}

function formatWhen(commit) {
  return commit.datetime.toLocaleString('en', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

// Scatter plot story: when, and how big
function describeCommit(d, i) {
  const fileCount = d3.group(d.lines, (line) => line.file).size;
  return `
    On ${formatWhen(d)}, I made
    <a href="${d.url}" target="_blank">${i > 0 ? 'another commit' : 'my first commit'}</a>.
    ${d.totalLines} of its lines are still in the site today,
    across ${fileCount} ${fileCount === 1 ? 'file' : 'files'}.
  `;
}

// File story: which files the commit's lines landed in
function describeFiles(d) {
  const perFile = d3
    .rollups(d.lines, (v) => v.length, (line) => line.file)
    .sort((a, b) => b[1] - a[1])
    .map(([file, count]) => `<code>${file}</code> (${count})`);
  return `
    <a href="${d.url}" target="_blank">${formatWhen(d)}</a>:
    lines still in the site from this commit went to ${perFile.join(', ')}.
  `;
}

let data = await loadData();
let commits = processCommits(data);

// Step 1.1: the latest moment shown. Lab 8 Step 4: set by scrolling now
// that the slider is gone
let commitMaxTime = d3.max(commits, (d) => d.datetime);

// Step 1.2: updated as the story scrolls
let filteredCommits = commits;

// Lab 8: both scroll stories end up here, so the plot, stats, and file
// list always show the same moment
function setMaxTime(time) {
  commitMaxTime = time;
  const label = commitMaxTime.toLocaleString('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  document.getElementById('commit-time').textContent = label;
  document.getElementById('files-time').textContent = label;

  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
  updateScatterPlot(data, filteredCommits);
  renderCommitInfo(
    filteredCommits.flatMap((d) => d.lines),
    filteredCommits,
  );
  updateFileDisplay(filteredCommits);
}

// Lab 8 Step 3.3: when a commit's text crosses the middle of the screen,
// show the codebase as of that commit
function onStepEnter(response) {
  setMaxTime(response.element.__data__.datetime);
}

renderScatterPlot(data, commits);
renderStory('#scatter-story', commits, describeCommit);
renderStory('#files-story', commits, describeFiles);

// Start with everything shown, until a story step takes over
setMaxTime(commitMaxTime);

// Step 3.3 / Step 4: one scroller per scrolly section
for (const id of ['#scrolly-1', '#scrolly-2']) {
  scrollama()
    .setup({ container: id, step: `${id} .step` })
    .onStepEnter(onStepEnter);
}
