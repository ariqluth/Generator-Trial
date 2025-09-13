// Handle Bearer Token
function updateBearerToken(token) {
    localStorage.setItem("bearerToken", token);
}

function clearBearerToken() {
    localStorage.removeItem("bearerToken");
    document.getElementById("bearerToken").value = "";
    updateLockIcon(false);
}

// Auto-refresh token function
async function refreshToken() {
    window.manualRefresh = true;
    const success = await autoAuthenticate();
    if (!success) {
        createToast("Failed to refresh token. Check if server is running.", "error");
    }
}

// Resource Search
function filterResources(searchTerm) {
    const resources = document.querySelectorAll(".resource-item");
    const emptyState = document.getElementById("emptyState");
    const lowerSearchTerm = searchTerm.toLowerCase();
    let visibleCount = 0;

    resources.forEach(item => {
        const modelName = item.querySelector("h3").textContent.toLowerCase();
        const isVisible = modelName.includes(lowerSearchTerm);

        if (isVisible) {
            item.classList.remove("hidden");
            visibleCount++;
        } else {
            item.classList.add("hidden");
        }
    });

    // Show/hide empty state
    if (visibleCount === 0 && searchTerm.trim() !== '') {
        emptyState.style.display = 'block';
    } else {
        emptyState.style.display = 'none';
    }
}

// Bearer Token UI
function toggleBearerToken() {
    const tokenInput = document.getElementById("bearerToken");
    const lockIcon = document.getElementById("lockIcon");

    if (tokenInput.classList.contains("hidden")) {
        // Show the token input with animation
        tokenInput.classList.remove("hidden");
        setTimeout(() => tokenInput.classList.add("opacity-100"), 50);
        tokenInput.focus();

        lockIcon.innerHTML = unlockedSVG;
        lockIcon.classList.replace("bg-green-100", "bg-gray-100");
    } else {
        // Hide the token input with animation
        tokenInput.classList.remove("opacity-100");
        setTimeout(() => tokenInput.classList.add("hidden"), 200);
        updateLockIcon(tokenInput.value !== "");
    }
}

function updateLockIcon(hasToken) {
    const lockIcon = document.getElementById("lockIcon");

    if (hasToken) {
        // Locked/secured state (token exists)
        lockIcon.innerHTML = lockedSVG;
        lockIcon.classList.replace("bg-gray-100", "bg-green-100");
    } else {
        // Unlocked state (no token)
        lockIcon.innerHTML = unlockedSVG;
        lockIcon.classList.replace("bg-green-100", "bg-gray-100");
    }
}

// SVG Icons
const lockedSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" 
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
`;

const unlockedSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" 
        stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 9.9 0.1"></path>
        <path d="M18 8a6 6 0 0 0-9-5"></path>
    </svg>
`;

// Handle API Documentation Display 
function showDocs(model, method, e) {
    document.querySelectorAll("button").forEach((btn) => {
        btn.classList.remove(
            "bg-blue-50",
            "bg-green-50",
            "bg-yellow-50",
            "bg-red-50",
            "bg-gray-50"
        );
    });

    const methodColors = {
        GET: "bg-blue-50",
        GET_ID: "bg-gray-50",
        POST: "bg-green-50",
        PUT: "bg-yellow-50",
        DELETE: "bg-red-50",
        BULK: "bg-purple-50",
    };

    if (e && e.target) {
        e.target.classList.add(methodColors[method]);
    }

    document
        .querySelectorAll(
            '[id$="-GET"], [id$="-GET_ID"], [id$="-POST"], [id$="-PUT"], [id$="-DELETE"], [id$="-BULK"]'
        )
        .forEach((panel) => {
            panel.classList.add("hidden");
        });

    const panel = document.getElementById(`${model}-${method}`);
    if (panel) {
        panel.classList.remove("hidden");
    }
}

// Auto-authenticate with demo credentials
async function autoAuthenticate() {
    try {
        const baseUrl = window.location.origin;
        const response = await fetch(baseUrl + '/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username: 'trial',
                password: 'trial'
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.token) {
                document.getElementById("bearerToken").value = data.token;
                updateBearerToken(data.token);
                updateLockIcon(true);
                console.log("Auto-authentication successful!");

                // Show success notification only on manual refresh, not on page load
                if (window.manualRefresh) {
                    createToast("Token auto-generated successfully!", "success");
                    window.manualRefresh = false;
                }
                return true;
            }
        }
    } catch (error) {
        console.log("Auto-authentication failed, using saved token if available");
    }
    return false;
}

window.onload = async function () {
    const savedToken = localStorage.getItem("bearerToken");

    // Try auto-authentication first
    const autoAuthSuccess = await autoAuthenticate();

    // If auto-auth failed, use saved token
    if (!autoAuthSuccess && savedToken) {
        document.getElementById("bearerToken").value = savedToken;
        updateLockIcon(true);
    } else if (!autoAuthSuccess) {
        updateLockIcon(false);
    }

    // Show Authentication panel by default
    showDocs('Authentication', 'POST', null);
    const authButton = document.querySelector('[onclick="showDocs(\'Authentication\', \'POST\', event)"]');
    if (authButton) {
        authButton.classList.add("bg-green-50");
    }
};

// Ensure the DOM is fully loaded before running the initialization
document.addEventListener('DOMContentLoaded', window.onload);

function addQueryParam(model) {
    const container = document.getElementById(`${model}-query-params`);
    const row = document.createElement("div");
    row.className = "grid grid-cols-12 gap-2";
    row.innerHTML = `
    <div class="col-span-4">
      <input type="text" placeholder="Parameter" 
        class="w-full bg-[#1e1e1e] text-gray-300 px-2 py-1.5 text-sm rounded border border-gray-700/50" />
    </div>
    <div class="col-span-6">
      <input type="text" placeholder="Value"
        class="w-full bg-[#1e1e1e] text-gray-300 px-2 py-1.5 text-sm rounded border border-gray-700/50" />
    </div>
    <div class="col-span-2">
      <button onclick="this.closest('.grid').remove()"
        class="text-red-400 hover:text-red-300 text-sm">Remove</button>
    </div>
  `;
    container.appendChild(row);
}

function toggleBodyType(model, method) {
    const select = document.getElementById(`${model}-${method}-body-type`);
    const formBody = document.getElementById(`${model}-${method}-form-body`);
    const jsonBody = document.getElementById(`${model}-${method}-json-body-container`);

    if (select && select.value === "json") {
        if (formBody) formBody.classList.add("hidden");
        if (jsonBody) jsonBody.classList.remove("hidden");
    } else {
        if (formBody) formBody.classList.remove("hidden");
        if (jsonBody) jsonBody.classList.add("hidden");
    }
}

function formatJson(model, method) {
    const editor = document.getElementById(`${model}-${method}-json-body`);
    if (!editor) return;

    try {
        const parsed = JSON.parse(editor.value);
        const formatted = JSON.stringify(parsed, null, 2);
        editor.value = formatted;

        if (typeof Prism !== 'undefined') {
            editor.innerHTML = Prism.highlight(formatted, Prism.languages.json, "json");
            editor.classList.add("line-numbers");
        }
    } catch (e) {
        showError("Invalid JSON format");
    }
}

function showError(message) {
    const toast = document.createElement("div");
    toast.className =
        "fixed top-4 right-4 bg-red-500 text-white px-4 py-2 rounded shadow-lg";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function updateRequestBody(model, method) {
    const formBody = document.getElementById(`${model}-${method}-form-body`);
    const jsonBody = document.getElementById(`${model}-${method}-json-body`);
    const inputs = formBody.querySelectorAll("input");
    const body = {};

    inputs.forEach((input, i) => {
        if (i % 2 === 0) {
            const key = input.value;
            const value = inputs[i + 1]?.value;
            if (value) body[key] = value;
        }
    });

    jsonBody.value = JSON.stringify(body, null, 2);
}

function updatePathParam(model, method, value) {
    const urlInput = document.getElementById(`${model}-${method}-url`);
    // Only replace the :id part if it exists, otherwise just update the last segment
    let currentUrl = urlInput.value;
    // Replace :id or last segment with the new value
    if (currentUrl.includes(':id')) {
        urlInput.value = currentUrl.replace(/:id(?![\w-])/g, value);
    } else {
        // Replace last segment after last slash
        urlInput.value = currentUrl.replace(/\/[^/]*$/, '/' + value);
    }
}

function formatResponse(el, json) {
    const formatted = JSON.stringify(json, null, 2);
    el.innerHTML = Prism.highlight(formatted, Prism.languages.json, "json");
    el.classList.add("line-numbers");
}

function createToast(message, type = "error") {
    const toast = document.createElement("div");
    toast.className = `fixed top-4 right-4 px-4 py-2 rounded-lg shadow-lg transform transition-all duration-300 ${type === "error" ? "bg-red-500" : "bg-green-500"} text-white`;
    toast.style.opacity = "0";
    toast.style.zIndex = "9999";
    toast.textContent = message;

    document.body.appendChild(toast);
    requestAnimationFrame(() => {
        toast.style.opacity = "1";
    });

    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

async function sendRequest(model, method) {
    try {
        const baseUrl = window.location.origin;
        const urlInput = document.getElementById(`${model}-${method}-url`);
        let url = baseUrl + urlInput.value;
        const bearerToken = document.getElementById("bearerToken").value;

        // Special handling for Authentication
        if (model === 'Authentication') {
            url = baseUrl + '/api/auth/login';
        } else if (method === "GET") {
            const queryParams = [];
            const paramRows = document.getElementById(`${model}-query-params`).children;

            for (const row of paramRows) {
                const inputs = row.querySelectorAll("input");
                const key = inputs[0].value;
                const value = inputs[1].value;
                if (key && value)
                    queryParams.push(`${key}=${encodeURIComponent(value)}`);
            }

            if (queryParams.length > 0) {
                url += `?${queryParams.join("&")}`;
            }
        }

        // If method is BULK and it's a POST, use POST as HTTP method
        let httpMethod = method === "GET_ID" ? "GET" : method;
        if (method === "BULK") {
            httpMethod = "POST";
        }

        let options = {
            method: httpMethod,
            headers: {
                "Content-Type": "application/json",
            },
        };

        if (bearerToken && model !== 'Authentication') {
            options.headers["Authorization"] = `Bearer ${bearerToken}`;
        }

        if (method === "POST" || method === "PUT" || method === "BULK") {
            const bodyType = document.getElementById(`${model}-${method}-body-type`)
                ?.value;
            let bodyContent = '';

            if (model === 'Authentication') {
                // For authentication, always use the JSON body
                bodyContent = document.getElementById(`${model}-${method}-json-body`).value;
            } else {
                bodyContent =
                    bodyType === "json"
                        ? document.getElementById(`${model}-${method}-json-body`).value
                        : JSON.stringify(
                            Object.fromEntries(
                                Array.from(
                                    document
                                        .getElementById(`${model}-${method}-form-body`)
                                        .querySelectorAll("input")
                                ).reduce((acc, input, i) => {
                                    if (i % 2 === 0) {
                                        acc.push([
                                            input.value,
                                            document
                                                .getElementById(`${model}-${method}-form-body`)
                                                .querySelectorAll("input")[i + 1]?.value,
                                        ]);
                                    }
                                    return acc;
                                }, [])
                            )
                        );
            }

            try {
                options.body = bodyContent;
            } catch (e) {
                alert("Invalid request body");
                return;
            }
        }

        const response = await fetch(url, options);
        const data = await response.json();

        const responseSection = document.getElementById(
            `${model}-${method}-response`
        );
        const statusEl = document.getElementById(`${model}-${method}-status`);
        const bodyEl = document.getElementById(`${model}-${method}-response-body`);

        responseSection.classList.remove("hidden");
        responseSection.classList.add("response");

        statusEl.textContent = `${response.status} ${response.statusText}`;
        statusEl.className = `status-badge ${response.ok ? "status-success" : "status-error"
            }`;

        formatResponse(bodyEl, data);

        // If authentication successful, save the token
        if (model === 'Authentication' && response.ok && data.token) {
            document.getElementById("bearerToken").value = data.token;
            updateBearerToken(data.token);
            updateLockIcon(true);
            createToast("Authentication successful! Token saved.", "success");
        }
    } catch (error) {
        createToast(error.message);
    }
}

async function resetData() {
    if (!confirm('Are you sure you want to reset (truncate) all data? This action cannot be undone!')) return;
    const btn = document.getElementById('resetDataBtn');
    const oldHTML = btn.innerHTML;
    btn.innerHTML = `<svg class='animate-spin w-3.5 h-3.5 text-yellow-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'><circle cx='12' cy='12' r='10' stroke-width='4' class='opacity-25'/><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 12a8 8 0 0 1 8-8' /></svg>`;
    btn.disabled = true;
    try {
        const res = await fetch('/api/docs/reset', { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            createToast(data.message, 'success');
        } else {
            createToast(data.message || 'Failed to reset data');
        }
    } catch (e) {
        createToast('Failed to reset data: ' + e.message);
    }
    btn.innerHTML = oldHTML;
    btn.disabled = false;
}

async function resetDataPerModel(model) {
    if (!confirm(`Reset (truncate) all data for ${model}? Semua data terkait juga akan dihapus!`)) return;
    const btn = document.getElementById(`resetDataBtn-${model}`);
    const oldHTML = btn.innerHTML;
    btn.innerHTML = `<svg class='animate-spin w-3.5 h-3.5 text-yellow-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'><circle cx='12' cy='12' r='10' stroke-width='4' class='opacity-25'/><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M4 12a8 8 0 0 1 8-8' /></svg>`;
    btn.disabled = true;
    try {
        const res = await fetch(`/api/docs/reset/${model}`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            createToast(data.message, 'success');
            btn.innerHTML = `<svg class='w-3.5 h-3.5 text-green-600' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M5 13l4 4L19 7' /></svg>`;
            setTimeout(() => { btn.innerHTML = oldHTML; btn.disabled = false; }, 1200);
            return;
        } else {
            createToast(data.message || 'Failed to reset data');
        }
    } catch (e) {
        createToast('Failed to reset data: ' + e.message);
    }
    btn.innerHTML = oldHTML;
    btn.disabled = false;
}
