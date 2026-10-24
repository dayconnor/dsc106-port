import { fetchJSON, renderProjects, fetchGitHubData } from './global.js';

// Step 2.1: the first three projects in the data file are the latest
const projects = await fetchJSON('./lib/projects.json');
const latestProjects = projects?.slice(0, 3);
const projectsContainer = document.querySelector('.projects');
// h3, since these sit under the "Latest Projects" h2
renderProjects(latestProjects, projectsContainer, 'h3');

// Step 3: live GitHub profile stats
const githubData = await fetchGitHubData('dayconnor');
const profileStats = document.querySelector('#profile-stats');

if (profileStats && githubData) {
  profileStats.innerHTML = `
    <dl>
      <dt>Public Repos</dt><dd>${githubData.public_repos}</dd>
      <dt>Public Gists</dt><dd>${githubData.public_gists}</dd>
      <dt>Followers</dt><dd>${githubData.followers}</dd>
      <dt>Following</dt><dd>${githubData.following}</dd>
    </dl>
  `;
}
