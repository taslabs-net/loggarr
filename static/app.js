// Loggarr - Client-side functionality

let paused = false;
let logCount = 0;
let pausedBuffer = [];
let skippedCount = 0;
let eventSource = null;
let searchRegex = null;

// Config from server
const BUFFER_MAX = parseInt(document.body.dataset.bufferMax) || 1000;

// Filter state
const filters = {
  containers: new Set(),
  levels: new Set(["alert", "error", "warning", "info", "debug"]),
};

document.addEventListener("DOMContentLoaded", function () {
  const logContainer = document.getElementById("log-container");
  const autoScrollCheckbox = document.getElementById("auto-scroll");
  const logCountEl = document.getElementById("log-count");
  const pauseBtn = document.getElementById("pause-btn");
  const searchInput = document.getElementById("search-input");
  const connectionStatus = document.getElementById("connection-status");
  const searchClear = document.getElementById("search-clear");

  // Theme Logic
  const themeController = document.querySelector(".theme-controller");
  const html = document.documentElement;
  
  // Init from local storage
  const savedTheme = localStorage.getItem("theme") || "dark";
  html.dataset.theme = savedTheme;
  if (themeController) {
      themeController.checked = savedTheme === "light";
      
      themeController.addEventListener("change", function() {
          const theme = this.checked ? "light" : "dark";
          html.dataset.theme = theme;
          localStorage.setItem("theme", theme);
      });
  }

  // Toast Notification System
  window.showToast = function(message, type = "info") {
      const container = document.getElementById("toast-container");
      if (!container) return;
      
      const alertClass = {
          "info": "alert-info",
          "success": "alert-success",
          "warning": "alert-warning",
          "error": "alert-error"
      }[type] || "alert-info";
      
      const el = document.createElement("div");
      el.className = `alert ${alertClass} text-sm py-2 px-4 shadow-lg min-w-[200px] transition-all duration-300 opacity-0 translate-y-2`;
      el.innerHTML = `<span>${escapeHtml(message)}</span>`;
      
      container.appendChild(el);
      
      // Animate in
      requestAnimationFrame(() => {
         el.classList.remove("opacity-0", "translate-y-2");
      });
      
      // Remove after 3s
      setTimeout(() => {
          el.classList.add("opacity-0", "translate-y-[-10px]");
          setTimeout(() => el.remove(), 300);
      }, 3000);
  };

  // Initialize container filters (all checked by default)
  document.querySelectorAll(".container-filter").forEach((checkbox) => {
    filters.containers.add(checkbox.value);
    checkbox.addEventListener("change", function () {
      if (this.checked) {
        filters.containers.add(this.value);
      } else {
        filters.containers.delete(this.value);
      }
      reconnectSSE();
    });
  });

  // Initialize level filters
  document.querySelectorAll(".level-filter").forEach((btn) => {
    const level = btn.dataset.level;
    const levelClass = "btn-level-" + level;
    btn.addEventListener("click", function () {
      if (filters.levels.has(level)) {
        filters.levels.delete(level);
        this.classList.remove(levelClass);
        this.classList.add("btn-ghost");
      } else {
        filters.levels.add(level);
        this.classList.add(levelClass);
        this.classList.remove("btn-ghost");
      }
      reconnectSSE(true);
    });
  });

  // Search functionality with regex toggle
  let searchTimeout;
  const regexToggle = document.getElementById("regex-toggle");
  
  function updateSearchPlaceholder() {
    const isRegex = regexToggle && regexToggle.checked;
    searchInput.placeholder = isRegex ? "Search (regex)..." : "Search text...";
    searchInput.classList.toggle("input-primary", isRegex);
  }
  
  if (regexToggle) {
    regexToggle.addEventListener("change", updateSearchPlaceholder);
    updateSearchPlaceholder();
  }
  
  searchInput.addEventListener("input", function () {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      const pattern = this.value.trim();
      const isRegex = regexToggle && regexToggle.checked;
      
      if (pattern) {
        if (isRegex) {
          try {
            // Use 'gi' flags: global (match all) + case-insensitive
            searchRegex = new RegExp(pattern, "gi");
            this.classList.remove("input-error");
            this.classList.add("input-success");
          } catch (e) {
            searchRegex = null;
            this.classList.remove("input-success");
            this.classList.add("input-error");
          }
        } else {
          // Simple text search - escape regex special chars, use global flag
          const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          searchRegex = new RegExp(escaped, "gi");
          this.classList.remove("input-error", "input-success");
        }
        if (searchClear) searchClear.classList.remove("hidden");
      } else {
        searchRegex = null;
        this.classList.remove("input-error", "input-success");
        if (searchClear) searchClear.classList.add("hidden");
      }
      applySearchFilter();
    }, 300);
  });

  if (searchClear) {
      searchClear.addEventListener("click", function() {
          searchInput.value = "";
          searchInput.dispatchEvent(new Event("input"));
          searchInput.focus();
      });
  }

  // Toggle pause
  const saveBtn = document.getElementById("save-btn");
  window.togglePause = function () {
    paused = !paused;
    updatePauseButton();
    pauseBtn.classList.toggle("btn-primary", paused);

    // Show/hide save button
    if (paused) {
      saveBtn.classList.remove("hidden");
      skippedCount = 0;
    } else {
      saveBtn.classList.add("hidden");
      if (pausedBuffer.length > 0) {
        pausedBuffer.forEach((html) => addLogEntry(html));
        pausedBuffer = [];
      }
      skippedCount = 0;
    }
    updateLogCount();
  };

  // Update pause button text with skipped count
  function updatePauseButton() {
    if (paused && skippedCount > 0) {
      pauseBtn.textContent = `Resume (${skippedCount} skipped)`;
    } else {
      pauseBtn.textContent = paused ? "Resume" : "Pause";
    }
  }

  // Add a log entry to the container
  function addLogEntry(html) {
    logContainer.insertAdjacentHTML("beforeend", html);
    const entry = logContainer.lastElementChild;

    // Apply search filter and highlighting if active
    if (searchRegex && entry) {
      const message = entry.querySelector(".text-base-content.break-words");
      if (message) {
        if (searchRegex.test(message.textContent)) {
          entry.style.display = "";
          // Store original and apply highlighting
          message.dataset.originalText = message.textContent;
          message.innerHTML = highlightMatches(message.textContent, searchRegex);
        } else {
          entry.style.display = "none";
        }
      }
    }

    // Trim old entries if over buffer limit
    while (logContainer.children.length > BUFFER_MAX) {
      logContainer.removeChild(logContainer.firstChild);
    }

    logCount = logContainer.children.length;
    if (autoScrollCheckbox.checked && !paused) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }

  // Helper function to highlight search matches
  function highlightMatches(text, regex) {
    if (!regex || !text) return escapeHtml(text);
    try {
      // First escape HTML to prevent XSS
      const escapedText = escapeHtml(text);
      // Clone the regex to avoid state issues, ensure global flag is set
      const flags = regex.flags || 'gi';
      const globalFlags = flags.includes('g') ? flags : flags + 'g';
      const globalRegex = new RegExp(regex.source, globalFlags);
      // Use the regex to find matches and wrap them in mark tags
      // Match is already escaped since it comes from escapedText
      return escapedText.replace(globalRegex, (match) => `<mark class="bg-warning text-warning-content px-0.5 rounded">${match}</mark>`);
    } catch (e) {
      return escapeHtml(text);
    }
  }

  // Helper function to remove highlighting
  function removeHighlighting(element) {
    if (!element) return;
    // Replace all mark tags with their text content
    element.innerHTML = element.innerHTML.replace(/<mark[^>]*>([^<]*)<\/mark>/g, '$1');
  }

  // Apply search filter to existing entries with highlighting
  function applySearchFilter() {
    const entries = logContainer.querySelectorAll(".log-entry");
    entries.forEach((entry) => {
      const message = entry.querySelector(".text-base-content.break-words");
      
      if (!searchRegex) {
        entry.style.display = "";
        if (message) removeHighlighting(message);
        return;
      }
      
      if (message && searchRegex.test(message.textContent)) {
        entry.style.display = "";
        // Store original text if not already stored
        if (!message.dataset.originalText) {
          message.dataset.originalText = message.textContent;
        }
        // Apply highlighting
        const originalText = message.dataset.originalText;
        message.innerHTML = highlightMatches(originalText, searchRegex);
      } else {
        entry.style.display = "none";
        if (message) removeHighlighting(message);
      }
    });
  }

  // Update log count display
  function updateLogCount() {
    const visible = logContainer.querySelectorAll(
      '.log-entry:not([style*="display: none"])',
    ).length;
    
    // Empty state logic
    const emptyState = document.getElementById("empty-state");
    if (emptyState) {
        if (visible === 0) {
            emptyState.classList.remove("hidden");
        } else {
            emptyState.classList.add("hidden");
        }
    }

    let text = visible + " logs";
    if (paused && pausedBuffer.length > 0) {
      text += " (+" + pausedBuffer.length + " paused)";
    }
    logCountEl.textContent = text;
  }

  // Build SSE URL with current filters
  function buildSSEUrl() {
    const params = new URLSearchParams();
    if (filters.containers.size > 0) {
      params.set("containers", Array.from(filters.containers).join(","));
    }
    if (filters.levels.size > 0 && filters.levels.size < 5) {
      params.set("levels", Array.from(filters.levels).join(","));
    }
    const query = params.toString();
    return "/api/v1/logs" + (query ? "?" + query : "");
  }

  // Connect to SSE endpoint
  function connectSSE() {
    if (eventSource) {
      eventSource.close();
    }

    const url = buildSSEUrl();
    eventSource = new EventSource(url);

    eventSource.onopen = function () {
      connectionStatus.className = "badge badge-success gap-1";
      connectionStatus.innerHTML =
        '<span class="w-2 h-2 rounded-full bg-success"></span> Connected';
    };

    eventSource.onmessage = function (e) {
      if (paused) {
        pausedBuffer.push(e.data);
        // Prevent memory issues if paused for too long
        if (pausedBuffer.length > BUFFER_MAX) {
            pausedBuffer.shift();
        }
        skippedCount++;
        updatePauseButton();
        updateLogCount();
      } else {
        addLogEntry(e.data);
        updateLogCount();
      }
    };

    eventSource.onerror = function () {
      connectionStatus.className = "badge badge-error gap-1";
      connectionStatus.innerHTML =
        '<span class="w-2 h-2 rounded-full bg-error"></span> Disconnected';
      // Reconnect after 3 seconds
      setTimeout(connectSSE, 3000);
    };
  }

  // Reconnect with new filters - preserves existing logs for container changes
  function reconnectSSE(clearLogs = false) {
    if (clearLogs) {
      logContainer.innerHTML = "";
      logCount = 0;
      pausedBuffer = [];
      skippedCount = 0;
      updatePauseButton();
    } else {
      // Just update visibility of existing logs based on container filter
      const entries = logContainer.querySelectorAll(".log-entry");
      entries.forEach((entry) => {
        const containerId = entry.dataset.container;
        if (filters.containers.has(containerId)) {
          entry.style.display = "";
        } else {
          entry.style.display = "none";
        }
      });
    }
    updateLogCount();
    connectSSE();
  }

  // Initial connection
  connectSSE();

  // Keyboard shortcuts
  document.addEventListener("keydown", function (e) {
    // Cmd+K / Ctrl+K opens container search from anywhere
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      openContainerSearch();
      return;
    }

    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    switch (e.key) {
      case " ":
        e.preventDefault();
        togglePause();
        break;
      case "/":
        e.preventDefault();
        searchInput.focus();
        break;
      case "Escape":
        searchInput.blur();
        searchInput.value = "";
        searchRegex = null;
        applySearchFilter();
        break;
      case "j":
        logContainer.scrollBy({ top: 100, behavior: "smooth" });
        break;
      case "k":
        logContainer.scrollBy({ top: -100, behavior: "smooth" });
        break;
      case "G":
        logContainer.scrollTo({
          top: logContainer.scrollHeight,
          behavior: "smooth",
        });
        break;
      case "g":
        if (this.lastKey === "g" && Date.now() - this.lastKeyTime < 500) {
          logContainer.scrollTo({ top: 0, behavior: "smooth" });
        }
        this.lastKey = "g";
        this.lastKeyTime = Date.now();
        break;
      case "c":
        // Clear logs
        logContainer.innerHTML = "";
        logCount = 0;
        updateLogCount();
        break;
      case "s":
        // Save snapshot
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          saveSnapshot();
        }
        break;
      case "?":
        // Show help modal
        document.getElementById("help-modal").showModal();
        break;
    }
  });

  // Snapshot functions
  const saveModal = document.getElementById("save-modal");
  const saveBtnEl = document.getElementById("save-btn");

  function openSaveModal() {
    if (!saveModal) return;
    document.getElementById("snapshot-name").value =
      "Snapshot " + new Date().toLocaleString();
    document.getElementById("snapshot-desc").value = "";
    saveModal.showModal();
  }

  // Bind both ways for safety
  if (saveBtnEl) {
    saveBtnEl.addEventListener("click", openSaveModal);
  }
  window.saveSnapshot = openSaveModal;

  window.confirmSaveSnapshot = async function () {
    const name = document.getElementById("snapshot-name").value.trim();
    const description = document.getElementById("snapshot-desc").value.trim();

    if (!name) {
      showToast("Please enter a name", "warning");
      return;
    }

    // Collect current logs from DOM
    const logs = [];
    logContainer.querySelectorAll(".log-entry").forEach((entry) => {
      logs.push({
        id: entry.dataset.id || "",
        timestamp: new Date().toISOString(),
        container: entry.querySelector(".text-primary")?.textContent || "",
        container_id: entry.dataset.container || "",
        stream: "stdout",
        message:
          entry.querySelector(".text-base-content.break-words")?.textContent ||
          "",
        level: entry.dataset.level || "info",
      });
    });

    try {
      const response = await fetch("/api/v1/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          containers: Array.from(filters.containers),
          levels: Array.from(filters.levels),
          logs,
        }),
      });

      if (!response.ok) throw new Error("Failed to save");

      document.getElementById("save-modal").close();
      showToast("Snapshot saved successfully", "success");
      loadSnapshots();
    } catch (err) {
      showToast("Failed to save snapshot: " + err.message, "error");
    }
  };

  // Snapshots Modal Logic
  window.openSnapshotsModal = function() {
      const modal = document.getElementById("snapshots-modal");
      if (modal) {
          modal.showModal();
          loadSnapshots();
      }
  };

  window.loadSnapshots = async function () {
    const container = document.getElementById("snapshots-modal-content");
    if (!container) return;
    
    container.innerHTML = '<div class="flex justify-center p-8"><span class="loading loading-spinner loading-lg"></span></div>';

    try {
      const response = await fetch("/api/v1/snapshots");
      const data = await response.json();
      
      // Handle error responses or non-array data
      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch snapshots");
      }
      
      const snapshots = Array.isArray(data) ? data : [];

      if (snapshots.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-base-content/50">
                <svg class="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <p>No snapshots saved yet.</p>
                <p class="text-sm mt-2">Pause the log stream to save a snapshot.</p>
            </div>
        `;
        return;
      }

      // Render Table
      let html = `
        <table class="table table-zebra w-full">
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Created</th>
                    <th>Logs</th>
                    <th class="text-right">Actions</th>
                </tr>
            </thead>
            <tbody>
      `;
      
      html += snapshots.map(s => `
        <tr class="hover">
            <td class="font-medium">
                <div class="font-bold">${escapeHtml(s.name)}</div>
                ${s.description ? `<div class="text-xs opacity-60 truncate max-w-xs">${escapeHtml(s.description)}</div>` : ''}
            </td>
            <td class="text-sm opacity-70 whitespace-nowrap">${new Date(s.created_at).toLocaleString()}</td>
            <td class="font-mono text-sm">${s.log_count}</td>
            <td class="text-right">
                <button class="btn btn-sm btn-ghost text-primary" onclick="viewSnapshot(${s.id})">Load</button>
                <button class="btn btn-sm btn-ghost text-error" onclick="deleteSnapshot(${s.id})">Delete</button>
            </td>
        </tr>
      `).join("");
      
      html += `</tbody></table>`;
      container.innerHTML = html;

    } catch (err) {
      container.innerHTML = `
        <div class="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>Failed to load snapshots: ${escapeHtml(err.message)}</span>
        </div>
      `;
    }
  };

  window.viewSnapshot = async function (id) {
    try {
      const response = await fetch("/api/v1/snapshots/" + id);
      const snapshot = await response.json();

      // Pause streaming and clear current logs
      if (!paused) togglePause();
      logContainer.innerHTML = "";

      // Render snapshot logs
      snapshot.logs.forEach((log) => {
        // Sanitize level to prevent XSS via class injection
        const safeLevel = [
          "alert",
          "error",
          "warning",
          "info",
          "debug",
        ].includes(log.level)
          ? log.level
          : "info";
        const html = `
					<div class="log-entry p-1 pl-2 mb-0.5 bg-base-200 grid grid-cols-[auto_auto_auto_1fr] gap-4 items-start level-${safeLevel}"
						 data-container="${escapeHtml(log.container_id || "")}" data-level="${safeLevel}">
						<span class="text-base-content/50 whitespace-nowrap">${new Date(log.timestamp).toLocaleTimeString()}</span>
						<span class="text-primary whitespace-nowrap truncate max-w-32">${escapeHtml(log.container)}</span>
						<span class="uppercase font-semibold text-xs min-w-16 level-${safeLevel}">${safeLevel}</span>
						<span class="text-base-content break-words">${escapeHtml(log.message)}</span>
					</div>
				`;
        logContainer.insertAdjacentHTML("beforeend", html);
      });

      logCount = snapshot.logs.length;
      updateLogCount();
      connectionStatus.className = "badge badge-warning gap-1";
      connectionStatus.innerHTML =
        '<span class="w-2 h-2 rounded-full bg-warning"></span> Viewing: ' +
        escapeHtml(snapshot.name);
        
      // Close modal
      const modal = document.getElementById("snapshots-modal");
      if (modal) modal.close();
      
    } catch (err) {
      showToast("Failed to load snapshot: " + err.message, "error");
    }
  };

  // Delete Snapshot Logic
  let snapshotIdToDelete = null;
  const deleteModal = document.getElementById("delete-modal");
  const confirmDeleteBtn = document.getElementById("confirm-delete-btn");

  if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener("click", async function() {
          if (!snapshotIdToDelete) return;
          
          const btn = this;
          const originalText = btn.textContent;
          btn.textContent = "Deleting...";
          btn.disabled = true;

          try {
              const response = await fetch("/api/v1/snapshots/" + snapshotIdToDelete, { method: "DELETE" });
              if (!response.ok) {
                  throw new Error(`HTTP error! status: ${response.status}`);
              }
              showToast("Snapshot deleted", "success");
              loadSnapshots();
              if (deleteModal) deleteModal.close();
          } catch (err) {
              showToast("Failed to delete: " + err.message, "error");
          } finally {
              btn.textContent = originalText;
              btn.disabled = false;
              snapshotIdToDelete = null;
          }
      });
  }

  window.deleteSnapshot = function (id) {
      snapshotIdToDelete = id;
      if (deleteModal) deleteModal.showModal();
  };

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  // Export logs as JSON or CSV
  window.exportLogs = function (format) {
    const logs = [];
    logContainer.querySelectorAll(".log-entry").forEach((entry) => {
      logs.push({
        timestamp:
          entry.querySelector(".text-base-content\\/50")?.textContent || "",
        container: entry.querySelector(".text-primary")?.textContent || "",
        level: entry.dataset.level || "info",
        message:
          entry.querySelector(".text-base-content.break-words")?.textContent ||
          "",
      });
    });

    if (logs.length === 0) {
      showToast("No logs to export", "warning");
      return;
    }

    let content, filename, mimeType;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");

    if (format === "json") {
      content = JSON.stringify(logs, null, 2);
      filename = `loggarr-export-${timestamp}.json`;
      mimeType = "application/json";
    } else if (format === "markdown") {
      // Markdown format - good for LLM context
      const lines = [
        `# Loggarr Export`,
        ``,
        `**Exported:** ${new Date().toISOString()}`,
        `**Log count:** ${logs.length}`,
        ``,
        `## Logs`,
        ``,
      ];
      logs.forEach((log) => {
        lines.push(
          `### [${log.level.toUpperCase()}] [${log.timestamp}] ${log.container}`,
        );
        lines.push(``);
        lines.push("```");
        lines.push(log.message);
        lines.push("```");
        lines.push(``);
      });
      content = lines.join("\n");
      filename = `loggarr-export-${timestamp}.md`;
      mimeType = "text/markdown";
    }

    // Trigger download
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Load snapshots list on dropdown open (must be after loadSnapshots is defined)
  // document
  //   .getElementById("snapshots-btn")
  //   .addEventListener("click", loadSnapshots);

  // Log details modal
  const logDetailHighlight = document.getElementById("log-detail-highlight");
  const logDetailMessage = document.getElementById("log-detail-message");
  let originalLogMessage = "";
  
  window.showLogDetails = function (el) {
    const modal = document.getElementById("log-modal");
    if (!modal) return;

    document.getElementById("log-detail-time").textContent =
      el.dataset.time || "";
    document.getElementById("log-detail-container").textContent =
      el.dataset.containerName || "";
    document.getElementById("log-detail-container-id").textContent =
      el.dataset.container || "";
    document.getElementById("log-detail-stream").textContent =
      el.dataset.stream || "";
    document.getElementById("log-detail-level").textContent =
      el.dataset.level || "";
    
    // Store original message and apply highlighting if search is active
    originalLogMessage = el.dataset.message || "";
    updateLogDetailHighlight();
    
    // Show/hide highlight toggle based on whether search is active
    if (logDetailHighlight) {
      const highlightContainer = logDetailHighlight.closest(".label");
      if (highlightContainer) {
        highlightContainer.style.display = searchRegex ? "flex" : "none";
      }
    }

    modal.showModal();
  };
  
  // Update highlighting in log detail modal based on toggle state
  function updateLogDetailHighlight() {
    if (!logDetailMessage) return;
    
    if (searchRegex && logDetailHighlight && logDetailHighlight.checked) {
      // Apply highlighting
      logDetailMessage.innerHTML = highlightMatches(originalLogMessage, searchRegex);
    } else {
      // Show plain text
      logDetailMessage.textContent = originalLogMessage;
    }
  }
  
  // Listen for toggle changes
  if (logDetailHighlight) {
    logDetailHighlight.addEventListener("change", updateLogDetailHighlight);
  }

  window.copyLogDetails = function () {
    const time = document.getElementById("log-detail-time").textContent;
    const container = document.getElementById(
      "log-detail-container",
    ).textContent;
    const level = document.getElementById("log-detail-level").textContent;
    const message = document.getElementById("log-detail-message").textContent;

    const text = `[${time}] [${container}] [${level.toUpperCase()}] ${message}`;
    navigator.clipboard.writeText(text).then(() => {
      // Brief visual feedback
      const btn = event.target;
      const original = btn.textContent;
      btn.textContent = "Copied!";
      showToast("Log details copied to clipboard", "success");
      setTimeout(() => (btn.textContent = original), 1000);
    });
  };

  // Container search modal (Cmd+K)
  const searchModal = document.getElementById("search-modal");
  const containerSearchInput = document.getElementById(
    "container-search-input",
  );
  const searchResults = document.getElementById("container-search-results");
  let searchSelectedIndex = 0;
  let containerList = [];

  function openContainerSearch() {
    if (!searchModal) return;
    // Get current container list from checkboxes
    containerList = [];
    document.querySelectorAll(".container-filter").forEach((cb) => {
      const label = cb.closest("label");
      const name = label ? label.textContent.trim() : cb.value;
      containerList.push({ id: cb.value, name: name, checked: cb.checked });
    });
    containerSearchInput.value = "";
    searchSelectedIndex = 0;
    updateSearchResults("");
    searchModal.showModal();
    setTimeout(() => containerSearchInput.focus(), 50);
  }

  function fuzzyMatch(pattern, str) {
    pattern = pattern.toLowerCase();
    str = str.toLowerCase();
    let patternIdx = 0;
    for (let i = 0; i < str.length && patternIdx < pattern.length; i++) {
      if (str[i] === pattern[patternIdx]) patternIdx++;
    }
    return patternIdx === pattern.length;
  }

  function updateSearchResults(query) {
    const filtered = query
      ? containerList.filter((c) => fuzzyMatch(query, c.name))
      : containerList;
    searchResults.innerHTML = "";
    filtered.forEach((c, i) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.className = i === searchSelectedIndex ? "active" : "";
      a.innerHTML = `
        <input type="checkbox" class="checkbox checkbox-sm" ${c.checked ? "checked" : ""} disabled/>
        <span>${c.name}</span>
      `;
      a.onclick = () => toggleContainer(c.id);
      li.appendChild(a);
      searchResults.appendChild(li);
    });
  }

  function toggleContainer(id) {
    const cb = document.querySelector(`.container-filter[value="${id}"]`);
    if (cb) {
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event("change", { bubbles: true }));
    }
    // Update local state
    const container = containerList.find((c) => c.id === id);
    if (container) container.checked = !container.checked;
    updateSearchResults(containerSearchInput.value);
  }

  if (containerSearchInput) {
    containerSearchInput.addEventListener("input", (e) => {
      searchSelectedIndex = 0;
      updateSearchResults(e.target.value);
    });

    containerSearchInput.addEventListener("keydown", (e) => {
      const items = searchResults.querySelectorAll("li");
      if (e.key === "ArrowDown") {
        e.preventDefault();
        searchSelectedIndex = Math.min(
          searchSelectedIndex + 1,
          items.length - 1,
        );
        updateSearchResults(containerSearchInput.value);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        searchSelectedIndex = Math.max(searchSelectedIndex - 1, 0);
        updateSearchResults(containerSearchInput.value);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = items[searchSelectedIndex];
        if (item) item.querySelector("a").click();
      } else if (e.key === "Escape") {
        searchModal.close();
      }
    });
  }
});
