import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
renderProjects(projects, projectsContainer, 'h2');

// Step 1.6: project count in the page title, updated from the data
const projectsTitle = document.querySelector('.projects-title');
if (projectsTitle && projects) {
  projectsTitle.textContent = `${projects.length} Projects`;
}
