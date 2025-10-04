const state = {
  projects: [],
  view: localStorage.getItem("project_view") || "grid",
  filter: "",
  isModalOpen: false
};

const container = document.getElementById("projectsContainer");
const searchInput = document.getElementById("searchInput");
const gridBtn = document.getElementById("gridViewBtn");
const listBtn = document.getElementById("listViewBtn");
const newProjectBtn = document.getElementById("newProjectBtn");

const modal = document.getElementById("projectModal");
const modalBackdrop = document.getElementById("modalBackdrop");
const closeModalBtn = document.getElementById("closeModalBtn");
const clearFormBtn = document.getElementById("clearFormBtn");
const projectForm = document.getElementById("projectForm");

const projectNameInput = document.getElementById("projectName");
const projectBaseUrlInput = document.getElementById("projectBaseUrl");
const projectTokenInput = document.getElementById("projectToken");

function formatDate(value) {
  if (!value) return "";
  try {
    const date = new Date(value);
    return date.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric"
    });
  } catch (error) {
    return value;
  }
}

function setView(view) {
  state.view = view;
  localStorage.setItem("project_view", view);
  if (view === "grid") {
    gridBtn.classList.add("bg-indigo-50", "border-indigo-200", "text-indigo-600");
    listBtn.classList.remove("bg-indigo-50", "border-indigo-200", "text-indigo-600");
    container.className = "grid gap-5 sm:grid-cols-2";
  } else {
    listBtn.classList.add("bg-indigo-50", "border-indigo-200", "text-indigo-600");
    gridBtn.classList.remove("bg-indigo-50", "border-indigo-200", "text-indigo-600");
    container.className = "flex flex-col gap-4";
  }
  renderProjects();
}

function toggleModal(open = true) {
  state.isModalOpen = open;
  if (open) {
    modal.classList.remove("hidden");
    projectNameInput.focus();
  } else {
    modal.classList.add("hidden");
    projectForm.reset();
  }
}

function getFilteredProjects() {
  if (!state.filter) return [...state.projects];
  const keyword = state.filter.toLowerCase();
  return state.projects.filter(project => {
    return (
      project.name.toLowerCase().includes(keyword) ||
      (project.baseUrl || "").toLowerCase().includes(keyword)
    );
  });
}

function emptyStateMarkup() {
  const message = container.dataset.empty || "No projects available.";
  return `
    <div class="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
        <span class="material-icons-outlined text-3xl">folder_open</span>
      </div>
      <h3 class="mt-4 text-lg font-semibold text-slate-700">Belum ada project</h3>
      <p class="mt-2 text-sm text-slate-500">${message}</p>
      <button class="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500" id="emptyAddBtn">
        <span class="material-icons-outlined text-base">add</span>
        Tambah Project
      </button>
    </div>
  `;
}

function projectCardMarkup(project) {
  const createdLabel = project.createdAt ? `Created ${formatDate(project.createdAt)}` : "";
  const favoriteClass = project.isFavorite ? "text-rose-500" : "text-slate-400 hover:text-rose-500";
  return `
    <article class="group relative rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-indigo-200 hover:shadow-md" data-id="${project.id}">
      <div class="flex items-start gap-4">
        <div class="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
          <span class="material-icons-outlined">storage</span>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-start gap-3">
            <div class="min-w-0">
              <h3 class="truncate text-lg font-semibold text-slate-800" title="${project.name}">${project.name}</h3>
              <a class="mt-1 block truncate text-sm text-indigo-500 hover:underline" href="${project.baseUrl}" target="_blank" rel="noopener noreferrer">${project.baseUrl}</a>
              <p class="mt-2 text-xs text-slate-400">${createdLabel}</p>
            </div>
            <div class="ml-auto flex items-center gap-1">
              <button class="favorite-btn inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm transition hover:bg-rose-50 ${favoriteClass}" data-action="favorite" title="Toggle favorite">
                <span class="material-icons-outlined">favorite</span>
              </button>
              <button class="delete-btn inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-rose-100 hover:text-rose-500" data-action="delete" title="Delete project">
                <span class="material-icons-outlined">close</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-5 flex items-center justify-between">
        <div class="flex items-center gap-2 text-xs text-slate-400">
          <span class="material-icons-outlined text-base">dns</span>
          <span>PostgreSQL backend</span>
        </div>
        <button class="open-btn inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50" data-action="open">
          <span class="material-icons-outlined text-base">open_in_new</span>
          Open
        </button>
      </div>
    </article>
  `;
}

function listItemMarkup(project) {
  const createdLabel = project.createdAt ? `Created ${formatDate(project.createdAt)}` : "";
  const favoriteClass = project.isFavorite ? "text-rose-500" : "text-slate-400 hover:text-rose-500";
  return `
    <article class="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md" data-id="${project.id}">
      <div class="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
        <span class="material-icons-outlined">storage</span>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="truncate text-base font-semibold text-slate-800" title="${project.name}">${project.name}</h3>
          <span class="hidden text-slate-300 sm:inline">�</span>
          <a class="truncate text-sm text-indigo-500 hover:underline" href="${project.baseUrl}" target="_blank" rel="noopener noreferrer">${project.baseUrl}</a>
          <span class="text-xs text-slate-400">${createdLabel}</span>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button class="open-btn inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50" data-action="open">
          <span class="material-icons-outlined text-base">open_in_new</span>
          Open
        </button>
        <button class="favorite-btn inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm transition hover:bg-rose-50 ${favoriteClass}" data-action="favorite" title="Toggle favorite">
          <span class="material-icons-outlined">favorite</span>
        </button>
        <button class="delete-btn inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-400 transition hover:bg-rose-100 hover:text-rose-500" data-action="delete" title="Delete project">
          <span class="material-icons-outlined">close</span>
        </button>
      </div>
    </article>
  `;
}

function renderProjects() {
  const projects = getFilteredProjects();
  if (!projects.length) {
    container.innerHTML = emptyStateMarkup();
    const addBtn = document.getElementById("emptyAddBtn");
    if (addBtn) addBtn.addEventListener("click", () => toggleModal(true));
    return;
  }

  if (state.view === "grid") {
    container.innerHTML = projects.map(projectCardMarkup).join("");
  } else {
    container.innerHTML = projects.map(listItemMarkup).join("");
  }
}

async function fetchProjects() {
  try {
    const response = await fetch("/api/projects");
    const result = await response.json();
    if (!result.success) throw new Error(result.message || "Failed to load projects");
    state.projects = result.data || [];
    renderProjects();
  } catch (error) {
    console.error(error);
    container.innerHTML = `<div class="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-8 text-center text-rose-600">${error.message || "Failed to load projects"}</div>`;
  }
}

async function createProject(payload) {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || "Failed to create project");
  }
  return result.data;
}

async function toggleFavorite(id) {
  const response = await fetch(`/api/projects/${id}/favorite`, { method: "PATCH" });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || "Failed to update favorite");
  }
  const index = state.projects.findIndex(project => project.id === id);
  if (index >= 0) {
    state.projects[index] = result.data;
    renderProjects();
  }
}

async function deleteProject(id) {
  const confirmed = window.confirm("Are you sure you want to delete this project?");
  if (!confirmed) return;

  const response = await fetch(`/api/projects/${id}`, { method: "DELETE" });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || "Failed to delete project");
  }
  state.projects = state.projects.filter(project => project.id !== id);
  renderProjects();
}

async function openProject(id) {
  try {
    const response = await fetch(`/api/projects/${id}`);
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || "Failed to load project");
    }
    const project = result.data;
    localStorage.setItem("project_id", project.id);
    localStorage.setItem("project_name", project.name || "");
    localStorage.setItem("project_base_url", project.baseUrl || "");
    localStorage.setItem("project_token", project.token || "");
    window.location.href = "/wireframe?project=" + encodeURIComponent(project.id);
  } catch (error) {
    alert(error.message || "Failed to open project");
  }
}

function registerListeners() {
  gridBtn.addEventListener("click", () => setView("grid"));
  listBtn.addEventListener("click", () => setView("list"));
  newProjectBtn.addEventListener("click", () => toggleModal(true));
  closeModalBtn.addEventListener("click", () => toggleModal(false));
  clearFormBtn.addEventListener("click", () => projectForm.reset());

  searchInput.addEventListener("input", (event) => {
    state.filter = event.target.value.trim();
    renderProjects();
  });

  if (modalBackdrop) {
    modalBackdrop.addEventListener("click", () => toggleModal(false));
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.isModalOpen) {
      toggleModal(false);
    }
  });

  projectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = {
      name: projectNameInput.value.trim(),
      baseUrl: projectBaseUrlInput.value.trim(),
      token: projectTokenInput.value.trim() || undefined
    };
    if (!payload.name || !payload.baseUrl) {
      alert("Project name and base URL are required");
      return;
    }
    try {
      const project = await createProject(payload);
      state.projects.unshift(project);
      toggleModal(false);
      renderProjects();
      openProject(project.id);
    } catch (error) {
      alert(error.message || "Failed to create project");
    }
  });

  container.addEventListener("click", async (event) => {
    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;
    const card = event.target.closest("article[data-id]");
    if (!card) return;
    const { action } = actionElement.dataset;
    const id = card.dataset.id;

    try {
      if (action === "open") {
        await openProject(id);
      } else if (action === "favorite") {
        await toggleFavorite(id);
      } else if (action === "delete") {
        await deleteProject(id);
      }
    } catch (error) {
      alert(error.message || "Operation failed");
    }
  });
}

(function init() {
  registerListeners();
  setView(state.view);
  fetchProjects();
})();



