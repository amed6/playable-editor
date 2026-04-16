const state = {
  originalHtml: "",
  filename: "",
  model: null,
  originalModel: null,
  packageConfigOrder: [],
  previewUrl: null,
  previewTimer: null,
  lastPreviewAt: "",
  previewViewport: "auto",
  previewPointerId: null,
  search: "",
  jsonEditor: null,
  lastPatchedHtml: "",
  status: {
    kind: "idle",
    message: "Upload a Luna-downloaded HTML export to begin.",
  },
};

const elements = {
  fileInput: document.getElementById("fileInput"),
  dropZone: document.getElementById("dropZone"),
  fileMeta: document.getElementById("fileMeta"),
  downloadBtn: document.getElementById("downloadBtn"),
  resetBtn: document.getElementById("resetBtn"),
  searchInput: document.getElementById("searchInput"),
  editorSections: document.getElementById("editorSections"),
  statusBanner: document.getElementById("statusBanner"),
  metricGroups: document.getElementById("metricGroups"),
  metricFields: document.getElementById("metricFields"),
  metricAssets: document.getElementById("metricAssets"),
  metricChanges: document.getElementById("metricChanges"),
  previewFrame: document.getElementById("previewFrame"),
  previewInputOverlay: document.getElementById("previewInputOverlay"),
  previewStage: document.getElementById("previewStage"),
  previewPlaceholder: document.getElementById("previewPlaceholder"),
  previewTitle: document.getElementById("previewTitle"),
  previewStatus: document.getElementById("previewStatus"),
  previewViewportAuto: document.getElementById("previewViewportAuto"),
  previewViewportPortrait: document.getElementById("previewViewportPortrait"),
  previewViewportLandscape: document.getElementById("previewViewportLandscape"),
  jsonModal: document.getElementById("jsonModal"),
  jsonModalEyebrow: document.getElementById("jsonModalEyebrow"),
  jsonModalTitle: document.getElementById("jsonModalTitle"),
  jsonModalHint: document.getElementById("jsonModalHint"),
  jsonModalTextarea: document.getElementById("jsonModalTextarea"),
  jsonModalStatus: document.getElementById("jsonModalStatus"),
  jsonModalClose: document.getElementById("jsonModalClose"),
  jsonFormatBtn: document.getElementById("jsonFormatBtn"),
  jsonApplyBtn: document.getElementById("jsonApplyBtn"),
};

const overrideBlockPattern =
  /window\.playgroundOverrides\s*=\s*(\{.*?\})\s*;\s*window\.playgroundAssetOverrides\s*=\s*(\{.*?\})\s*;\s*window\.playgroundFiltersOverrides\s*=\s*(\{.*?\})\s*;\s*window\.postProcessesOverrides\s*=\s*(\{.*?\})/s;
const packageConfigPattern =
  /packageConfig:Object\.assign\((\{.*?\}),window\.LUNA_PLAYGROUND_PACKAGE_CONFIG\|\|\{\}\)/s;
const preloaderNamePattern =
  /(<span[^>]+id="parameter\/preloader\/name"[^>]*>)(.*?)(<\/span>)/s;
const preloaderColorPattern =
  /(id="parameter\/preloader\/color" style="background:)([^"]*)(")/;
const preloaderIconPattern =
  /(id="asset\/preloader\/icon" src=")([^"]*)(")/;
const previewHelperScript = `<script>
!function(){
  if(window.__LUNA_EDITOR_PREVIEW_HELPER__)return;
  window.__LUNA_EDITOR_PREVIEW_HELPER__=!0;
  const editableTags=["INPUT","TEXTAREA","SELECT"];
  let activeForwardedTarget=null;
  function shouldIgnoreTarget(target){
    return !target||editableTags.includes(target.tagName);
  }
  function createTouch(target,event){
    return {
      identifier:1,
      target,
      clientX:event.clientX,
      clientY:event.clientY,
      screenX:event.screenX,
      screenY:event.screenY,
      pageX:event.pageX,
      pageY:event.pageY
    };
  }
  function touchList(target,event,empty){
    const list=empty?[]:[createTouch(target,event)];
    list.item=function(index){return this[index]||null};
    return list;
  }
  function dispatchTouch(target,type,event){
    if(!target)return;
    const syntheticEvent=new Event(type,{bubbles:!0,cancelable:!0});
    syntheticEvent.touches=touchList(target,event,"touchend"===type||"touchcancel"===type);
    syntheticEvent.targetTouches=touchList(target,event,"touchend"===type||"touchcancel"===type);
    syntheticEvent.changedTouches=touchList(target,event,!1);
    target.dispatchEvent(syntheticEvent);
  }
  function handleForwardedTouch(payload){
    let target=activeForwardedTarget;
    if("touchstart"===payload.type||!target){
      target=document.getElementById("application-canvas")||document.elementFromPoint(payload.clientX,payload.clientY)||document.body;
      activeForwardedTarget=target;
    }
    if(!target)return;
    const eventLike={
      clientX:payload.clientX,
      clientY:payload.clientY,
      screenX:payload.screenX||0,
      screenY:payload.screenY||0,
      pageX:payload.clientX,
      pageY:payload.clientY
    };
    if("touchstart"===payload.type){
      window.dispatchEvent(new Event("luna:unsafe:unmute"));
      if(target.focus)target.focus();
    }
    dispatchTouch(target,payload.type,eventLike);
    if("touchend"===payload.type||"touchcancel"===payload.type)activeForwardedTarget=null;
  }
  function installPointerBridge(){
    if(navigator.maxTouchPoints&&navigator.maxTouchPoints>0)return;
    let activeTarget=null;
    let activePointerId=null;
    const down=function(event){
      if("touch"===event.pointerType||0!==event.button)return;
      if(shouldIgnoreTarget(event.target))return;
      activeTarget=event.target;
      activePointerId=event.pointerId;
      event.preventDefault();
      event.stopPropagation();
      dispatchTouch(activeTarget,"touchstart",event);
      window.dispatchEvent(new Event("luna:unsafe:unmute"));
    };
    const move=function(event){
      if("touch"===event.pointerType||null===activeTarget||event.pointerId!==activePointerId)return;
      event.preventDefault();
      event.stopPropagation();
      dispatchTouch(activeTarget,"touchmove",event);
    };
    const end=function(type){
      return function(event){
        if("touch"===event.pointerType||null===activeTarget||event.pointerId!==activePointerId)return;
        event.preventDefault();
        event.stopPropagation();
        dispatchTouch(activeTarget,type,event);
        activeTarget=null;
        activePointerId=null;
      }
    };
    window.addEventListener("pointerdown",down,!0);
    window.addEventListener("pointermove",move,!0);
    window.addEventListener("pointerup",end("touchend"),!0);
    window.addEventListener("pointercancel",end("touchcancel"),!0);
  }
  function installCanvasFocus(){
    window.addEventListener("pointerdown",function(){
      const canvas=document.getElementById("application-canvas");
      if(canvas&&canvas.focus)canvas.focus();
    },!0);
  }
  window.addEventListener("message",function(event){
    const payload=event.data;
    if(!payload||!0!==payload.__lunaEditorTouch)return;
    handleForwardedTouch(payload);
  });
  installPointerBridge();
  installCanvasFocus();
}();
</script>`;

bindEvents();
setupPreviewStageObserver();
renderApp();

function bindEvents() {
  elements.fileInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (file) {
      await loadFile(file);
    }
    event.target.value = "";
  });

  ["dragenter", "dragover"].forEach((name) => {
    elements.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add("is-dragover");
    });
  });

  ["dragleave", "drop"].forEach((name) => {
    elements.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      elements.dropZone.classList.remove("is-dragover");
    });
  });

  elements.dropZone.addEventListener("drop", async (event) => {
    const [file] = event.dataTransfer?.files || [];
    if (file) {
      await loadFile(file);
    }
  });

  elements.downloadBtn.addEventListener("click", () => {
    if (!state.model) {
      return;
    }

    const html = buildPatchedHtml();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = getDownloadName(state.filename);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  elements.resetBtn.addEventListener("click", () => {
    if (!state.originalModel) {
      return;
    }

    state.model = deepClone(state.originalModel);
    state.status = {
      kind: "ready",
      message: "Changes reset to the original Luna export values.",
    };
    renderApp();
    schedulePreviewRefresh();
  });

  elements.searchInput.addEventListener("input", (event) => {
    state.search = event.target.value.trim().toLowerCase();
    renderEditor();
  });

  elements.editorSections.addEventListener("input", handleEditorInput);
  elements.editorSections.addEventListener("change", handleEditorChange);
  elements.editorSections.addEventListener("click", handleEditorClick);
  document.addEventListener("click", handleViewportClick);
  elements.previewInputOverlay.addEventListener(
    "pointerdown",
    handlePreviewPointerDown
  );
  elements.previewInputOverlay.addEventListener(
    "pointermove",
    handlePreviewPointerMove
  );
  elements.previewInputOverlay.addEventListener(
    "pointerup",
    handlePreviewPointerUp
  );
  elements.previewInputOverlay.addEventListener(
    "pointercancel",
    handlePreviewPointerCancel
  );
  elements.previewInputOverlay.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });

  elements.jsonModalClose.addEventListener("click", closeJsonModal);
  elements.jsonFormatBtn.addEventListener("click", formatJsonModal);
  elements.jsonApplyBtn.addEventListener("click", applyJsonModal);
  elements.jsonModal.addEventListener("close", () => {
    state.jsonEditor = null;
    elements.jsonModalTextarea.classList.remove("is-invalid");
  });
}

async function loadFile(file) {
  try {
    const html = await file.text();
    const parsed = parseLunaExport(html);
    state.originalHtml = html;
    state.filename = file.name;
    state.model = parsed.model;
    state.originalModel = deepClone(parsed.model);
    state.packageConfigOrder = parsed.packageConfigOrder;
    state.status = {
      kind: "ready",
      message:
        "Luna export loaded. Edit fields on the left and the preview will auto reload.",
    };
    renderApp();
    schedulePreviewRefresh(true);
  } catch (error) {
    clearPreview();
    state.model = null;
    state.originalModel = null;
    state.status = {
      kind: "error",
      message: error instanceof Error ? error.message : String(error),
    };
    renderApp();
  }
}

function parseLunaExport(html) {
  const overrideMatch = html.match(overrideBlockPattern);
  if (!overrideMatch) {
    throw new Error(
      "This file does not look like a supported Luna-downloaded export. I could not find the Luna playground override blocks."
    );
  }

  const packageMatch = html.match(packageConfigPattern);
  if (!packageMatch) {
    throw new Error(
      "The Luna package config block is missing, so this export could not be parsed safely."
    );
  }

  let playgroundOverrides;
  let playgroundAssetOverrides;
  let playgroundFiltersOverrides;
  let postProcessesOverrides;

  try {
    playgroundOverrides = JSON.parse(overrideMatch[1]);
    playgroundAssetOverrides = JSON.parse(overrideMatch[2]);
    playgroundFiltersOverrides = JSON.parse(overrideMatch[3]);
    postProcessesOverrides = JSON.parse(overrideMatch[4]);
  } catch (error) {
    throw new Error(
      "The Luna override data was found, but part of it could not be parsed as JSON."
    );
  }

  const packageConfig = parsePackageConfig(packageMatch[1]);
  const preloaderName = html.match(preloaderNamePattern)?.[2] ?? "";
  const preloaderColor = html.match(preloaderColorPattern)?.[2] ?? "";
  const preloaderIcon = html.match(preloaderIconPattern)?.[2] ?? "";

  return {
    packageConfigOrder: Object.keys(packageConfig),
    model: {
      packageConfig,
      playgroundOverrides,
      playgroundAssetOverrides,
      playgroundFiltersOverrides,
      postProcessesOverrides,
      preloader: {
        name: decodeHtml(preloaderName),
        color: preloaderColor,
        icon: preloaderIcon,
      },
    },
  };
}

function parsePackageConfig(literal) {
  const normalized = literal
    .replace(/([{,])([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
    .replace(/!0/g, "true")
    .replace(/!1/g, "false");

  try {
    return JSON.parse(normalized);
  } catch (error) {
    throw new Error("The Luna package config block could not be parsed.");
  }
}

function renderApp() {
  const loaded = Boolean(state.model);
  elements.downloadBtn.disabled = !loaded;
  elements.resetBtn.disabled = !loaded;
  elements.searchInput.disabled = !loaded;
  elements.searchInput.value = state.search;
  elements.fileMeta.textContent = loaded
    ? `${state.filename} loaded`
    : "No file loaded yet";
  elements.previewTitle.textContent = loaded ? state.filename : "Awaiting export";
  elements.statusBanner.textContent = state.status.message;
  elements.statusBanner.className = `status-banner status-banner--${state.status.kind}`;
  renderMetrics();
  renderEditor();
  renderPreviewViewportControls();
  updatePreviewState();
  layoutPreviewStage();
}

function renderMetrics() {
  if (!state.model) {
    elements.metricGroups.textContent = "0";
    elements.metricFields.textContent = "0";
    elements.metricAssets.textContent = "0";
    elements.metricChanges.textContent = "0";
    return;
  }

  const groups = Object.keys(state.model.playgroundOverrides).length;
  const fields = getAllFieldEntries(state.model.playgroundOverrides).length;
  const assets = Object.keys(state.model.playgroundAssetOverrides).length;
  const changes = getChangeCount();
  elements.metricGroups.textContent = String(groups);
  elements.metricFields.textContent = String(fields);
  elements.metricAssets.textContent = String(assets);
  elements.metricChanges.textContent = String(changes);
}

function renderEditor() {
  if (!state.model) {
    elements.editorSections.innerHTML = `
      <div class="empty-state">
        <h2>No export loaded</h2>
        <p>
          Once a file is uploaded, the editor will extract Luna override data,
          preloader values, and package config fields here.
        </p>
      </div>
    `;
    return;
  }

  const packageConfigMarkup = renderPackageConfigSection();
  const preloaderMarkup = renderPreloaderSection();
  const assetsMarkup = renderAssetsSection();
  const advancedMarkup = renderAdvancedSection();
  const groupsMarkup = renderPlayableGroups();
  const markup = [
    packageConfigMarkup,
    preloaderMarkup,
    assetsMarkup,
    advancedMarkup,
    groupsMarkup,
  ]
    .filter(Boolean)
    .join("");

  elements.editorSections.innerHTML =
    markup ||
    `
      <div class="empty-state">
        <h2>No fields match</h2>
        <p>Try a broader search or clear the filter to see all extracted editor sections.</p>
      </div>
    `;
}

function renderPackageConfigSection() {
  const config = state.model.packageConfig;
  const search = state.search;
  const searchBlob = ["package config", ...Object.keys(config)].join(" ").toLowerCase();

  if (search && !searchBlob.includes(search)) {
    return "";
  }

  const open = search ? "open" : "";

  return `
    <details class="section-card" ${open}>
      <summary>
        <div class="section-title">
          <div>
            <h3>Package Config</h3>
            <div class="section-meta">Store links and export metadata</div>
          </div>
        </div>
        <span class="field-badge">${Object.keys(config).length} values</span>
      </summary>
      <div class="section-body">
        <div class="field-grid field-grid--two">
          ${renderTextFieldCard({
            title: "Application Name",
            type: "string",
            value: config.applicationName ?? "",
            action: "package-text",
            key: "applicationName",
            help: "Updates the embedded Luna package config value.",
          })}
          ${renderTextFieldCard({
            title: "iOS Link",
            type: "url",
            value: config.iosLink ?? "",
            action: "package-text",
            key: "iosLink",
          })}
          ${renderTextFieldCard({
            title: "Android Link",
            type: "url",
            value: config.androidLink ?? "",
            action: "package-text",
            key: "androidLink",
          })}
          <article class="field-card">
            <div class="field-card__header">
              <h4 class="field-title">Orientation</h4>
              <span class="field-badge">enum</span>
            </div>
            <label class="field-inline">
              <select data-action="package-select" data-key="orientation">
                ${["unspecified", "portrait", "landscape"]
                  .map(
                    (option) => `
                      <option value="${option}" ${option === config.orientation ? "selected" : ""}>
                        ${option}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            </label>
          </article>
          <article class="field-card">
            <div class="field-card__header">
              <h4 class="field-title">Languages</h4>
              <span class="field-badge">string[]</span>
            </div>
            <label class="field-inline">
              <input
                type="text"
                value="${escapeAttribute((config.languages || []).join(", "))}"
                data-action="package-languages"
                placeholder="en, fr, de"
              />
            </label>
            <div class="field-summary">Comma-separated language codes</div>
          </article>
        </div>
      </div>
    </details>
  `;
}

function renderPreloaderSection() {
  const preloader = state.model.preloader;
  const preloaderRgba = parseLooseColor(preloader.color);
  const search = state.search;
  const searchBlob = "preloader name color icon".toLowerCase();
  if (search && !searchBlob.includes(search)) {
    return "";
  }

  const open = search ? "open" : "";

  return `
    <details class="section-card" ${open}>
      <summary>
        <div class="section-title">
          <div>
            <h3>Preloader</h3>
            <div class="section-meta">Startup screen values extracted from the HTML</div>
          </div>
        </div>
        <span class="field-badge">3 values</span>
      </summary>
      <div class="section-body">
        <div class="field-grid field-grid--two">
          ${renderTextFieldCard({
            title: "Preloader Name",
            type: "string",
            value: preloader.name,
            action: "preloader-text",
            key: "name",
          })}
          <article class="field-card">
            <div class="field-card__header">
              <h4 class="field-title">Preloader Color</h4>
              <span class="field-badge">color</span>
            </div>
            <div class="field-inline field-inline--color">
              <label class="mini-label">
                <span>Swatch</span>
                <input
                  type="color"
                  value="${rgbBytesToHex(preloaderRgba)}"
                  data-action="preloader-color-hex"
                />
              </label>
              ${["R", "G", "B", "A"]
                .map((label, index) => {
                  const value = index === 3 ? preloaderRgba[3] : preloaderRgba[index];
                  const step = index === 3 ? "0.01" : "1";
                  const min = index === 3 ? "0" : "0";
                  const max = index === 3 ? "1" : "255";
                  return `
                    <label class="mini-label">
                      <span>${label}</span>
                      <input
                        type="number"
                        min="${min}"
                        max="${max}"
                        step="${step}"
                        value="${value}"
                        data-action="preloader-color-channel"
                        data-channel="${index}"
                      />
                    </label>
                  `;
                })
                .join("")}
            </div>
          </article>
        </div>

        <article class="field-card">
          <div class="field-card__header">
            <h4 class="field-title">Preloader Icon</h4>
            <span class="field-badge">asset</span>
          </div>
          <div class="field-inline field-inline--asset">
            <div class="field-inline field-inline--stack">
              <label class="mini-label">
                <span>Source</span>
                <input
                  type="text"
                  value="${escapeAttribute(preloader.icon)}"
                  data-action="preloader-icon-text"
                />
              </label>
              <label class="button button--ghost file-button">
                <input type="file" accept="image/*" data-action="preloader-icon-upload" />
                <span>Upload Replacement Image</span>
              </label>
            </div>
            <div class="icon-preview">
              ${renderImagePreview(preloader.icon, "Preloader icon")}
            </div>
          </div>
        </article>
      </div>
    </details>
  `;
}

function renderAssetsSection() {
  const assetEntries = Object.entries(state.model.playgroundAssetOverrides);
  const search = state.search;
  const filtered = assetEntries.filter(([assetId, value]) => {
    if (!search) {
      return true;
    }
    return `${assetId} ${value}`.toLowerCase().includes(search);
  });

  if (!filtered.length && search) {
    return "";
  }

  const open = search ? "open" : "";

  return `
    <details class="section-card" ${open}>
      <summary>
        <div class="section-title">
          <div>
            <h3>Asset Overrides</h3>
            <div class="section-meta">Editable URLs or uploaded replacements for Luna assets</div>
          </div>
        </div>
        <span class="field-badge">${assetEntries.length} assets</span>
      </summary>
      <div class="section-body">
        ${
          filtered.length
            ? filtered
                .map(
                  ([assetId, value]) => `
                    <article class="field-card">
                      <div class="field-card__header">
                        <h4 class="field-title">Asset ${escapeHtml(assetId)}</h4>
                        <span class="field-badge">asset</span>
                      </div>
                      <div class="field-inline field-inline--asset">
                        <div class="field-inline field-inline--stack">
                          <label class="mini-label">
                            <span>Source URL or Data URL</span>
                            <input
                              type="text"
                              value="${escapeAttribute(value)}"
                              data-action="asset-text"
                              data-asset-id="${escapeAttribute(assetId)}"
                            />
                          </label>
                          <label class="button button--ghost file-button">
                            <input
                              type="file"
                              accept="image/*,video/*"
                              data-action="asset-upload"
                              data-asset-id="${escapeAttribute(assetId)}"
                            />
                            <span>Upload Replacement Asset</span>
                          </label>
                        </div>
                        <div class="asset-preview">
                          ${renderImagePreview(value, `Asset ${assetId}`)}
                        </div>
                      </div>
                    </article>
                  `
                )
                .join("")
            : `
              <div class="empty-state">
                <h2>No asset overrides</h2>
                <p>This export does not include editable Luna asset overrides.</p>
              </div>
            `
        }
      </div>
    </details>
  `;
}

function renderAdvancedSection() {
  const filters = state.model.playgroundFiltersOverrides;
  const post = state.model.postProcessesOverrides;
  const search = state.search;
  const searchBlob = "advanced filters post processes raw json".toLowerCase();
  if (search && !searchBlob.includes(search)) {
    return "";
  }

  const open = search ? "open" : "";

  return `
    <details class="section-card" ${open}>
      <summary>
        <div class="section-title">
          <div>
            <h3>Advanced Blocks</h3>
            <div class="section-meta">Raw JSON editing for additional Luna override objects</div>
          </div>
        </div>
        <span class="field-badge">JSON</span>
      </summary>
      <div class="section-body">
        <article class="field-card">
          <div class="field-card__header">
            <h4 class="field-title">Filter Overrides</h4>
            <span class="field-badge">object</span>
          </div>
          <div class="field-summary">${describeObject(filters)}</div>
          <div class="field-card__footer">
            <span class="field-help">Use this if a Luna export includes filter override data.</span>
            <button
              class="button button--ghost"
              type="button"
              data-action="open-raw-object"
              data-target="playgroundFiltersOverrides"
            >
              Edit JSON
            </button>
          </div>
        </article>
        <article class="field-card">
          <div class="field-card__header">
            <h4 class="field-title">Post Process Overrides</h4>
            <span class="field-badge">object</span>
          </div>
          <div class="field-summary">${describeObject(post)}</div>
          <div class="field-card__footer">
            <span class="field-help">Raw object editing for post-processing override data.</span>
            <button
              class="button button--ghost"
              type="button"
              data-action="open-raw-object"
              data-target="postProcessesOverrides"
            >
              Edit JSON
            </button>
          </div>
        </article>
      </div>
    </details>
  `;
}

function renderPlayableGroups() {
  const groups = Object.entries(state.model.playgroundOverrides);
  const filteredGroups = groups
    .map(([groupName, fields]) => {
      const filteredFields = Object.entries(fields).filter(([fieldName, value]) => {
        if (!state.search) {
          return true;
        }
        const type = Array.isArray(value) ? value[0] : "";
        const haystack = `${groupName} ${fieldName} ${type}`.toLowerCase();
        return haystack.includes(state.search);
      });

      return {
        groupName,
        fields: filteredFields,
      };
    })
    .filter((entry) => entry.fields.length > 0);

  if (!filteredGroups.length) {
    return "";
  }

  return filteredGroups
    .map(({ groupName, fields }, index) => {
      const open = state.search ? "open" : "";
      return `
        <details class="section-card" ${open}>
          <summary class="group-summary">
            <div class="section-title">
              <div>
                <h3>${escapeHtml(groupName)}</h3>
                <div class="section-meta">Typed Luna playground fields</div>
              </div>
            </div>
            <span class="field-badge">${fields.length} fields</span>
          </summary>
          <div class="section-body">
            <div class="field-grid">
              ${fields
                .map(([fieldName, value]) => renderPlayableFieldCard(groupName, fieldName, value))
                .join("")}
            </div>
          </div>
        </details>
      `;
    })
    .join("");
}

function renderPlayableFieldCard(groupName, fieldName, encodedValue) {
  const type = encodedValue[0];
  const value = encodedValue.slice(1);
  const header = `
    <div class="field-card__header">
      <h4 class="field-title">${escapeHtml(fieldName)}</h4>
      <span class="field-badge">${escapeHtml(type)}</span>
    </div>
  `;

  if (type === "boolean") {
    return `
      <article class="field-card">
        ${header}
        <label class="toggle">
          <span>Enabled</span>
          <input
            type="checkbox"
            ${value[0] ? "checked" : ""}
            data-action="field-boolean"
            data-group="${escapeAttribute(groupName)}"
            data-field="${escapeAttribute(fieldName)}"
          />
        </label>
      </article>
    `;
  }

  if (type === "color") {
    const rgba = value;
    return `
      <article class="field-card">
        ${header}
        <div class="field-inline field-inline--color">
          <label class="mini-label">
            <span>Swatch</span>
            <input
              type="color"
              value="${rgbaArrayToHex(rgba)}"
              data-action="field-color-hex"
              data-group="${escapeAttribute(groupName)}"
              data-field="${escapeAttribute(fieldName)}"
            />
          </label>
          ${["R", "G", "B", "A"]
            .map((label, index) => {
              const current = index === 3 ? rgba[3] : rgba[index];
              const min = index === 3 ? "0" : "0";
              const max = index === 3 ? "1" : "1";
              const step = "0.01";
              return `
                <label class="mini-label">
                  <span>${label}</span>
                  <input
                    type="number"
                    min="${min}"
                    max="${max}"
                    step="${step}"
                    value="${current}"
                    data-action="field-color-channel"
                    data-group="${escapeAttribute(groupName)}"
                    data-field="${escapeAttribute(fieldName)}"
                    data-channel="${index}"
                  />
                </label>
              `;
            })
            .join("")}
        </div>
      </article>
    `;
  }

  if (isVectorType(type)) {
    return `
      <article class="field-card">
        ${header}
        <div class="field-inline field-inline--vector">
          ${value
            .map(
              (component, index) => `
                <label class="mini-label">
                  <span>${getVectorLabel(index)}</span>
                  <input
                    type="number"
                    step="any"
                    value="${component}"
                    data-action="field-vector"
                    data-group="${escapeAttribute(groupName)}"
                    data-field="${escapeAttribute(fieldName)}"
                    data-index="${index}"
                  />
                </label>
              `
            )
            .join("")}
        </div>
      </article>
    `;
  }

  if (isArrayType(type)) {
    return `
      <article class="field-card">
        ${header}
        <div class="field-summary">${describeArrayField(type, value)}</div>
        <div class="field-card__footer">
          <span class="field-help">Open a structured JSON editor for this array.</span>
          <button
            class="button button--ghost"
            type="button"
            data-action="open-array-editor"
            data-group="${escapeAttribute(groupName)}"
            data-field="${escapeAttribute(fieldName)}"
          >
            Edit Array
          </button>
        </div>
      </article>
    `;
  }

  if (type === "string" && looksLikeJsonLikeString(value[0])) {
    return `
      <article class="field-card">
        ${header}
        <div class="field-summary">${describeJsonString(value[0])}</div>
        <div class="field-card__footer">
          <span class="field-help">This string contains JSON and can be edited with validation.</span>
          <button
            class="button button--ghost"
            type="button"
            data-action="open-json-string"
            data-group="${escapeAttribute(groupName)}"
            data-field="${escapeAttribute(fieldName)}"
          >
            Open JSON Editor
          </button>
        </div>
      </article>
    `;
  }

  const inputType = type === "string" ? "text" : "number";
  const step = type === "int" || type === "enum" ? "1" : "any";
  const help =
    type === "enum"
      ? "Luna exports enum values as numeric indexes."
      : type === "string"
        ? ""
        : "Numbers update the preview after a short debounce.";

  return `
    <article class="field-card">
      ${header}
      <label class="field-inline">
        <input
          type="${inputType}"
          ${inputType === "number" ? `step="${step}"` : ""}
          value="${escapeAttribute(String(value[0] ?? ""))}"
          data-action="field-scalar"
          data-group="${escapeAttribute(groupName)}"
          data-field="${escapeAttribute(fieldName)}"
          data-type="${escapeAttribute(type)}"
        />
      </label>
      ${help ? `<div class="field-help">${help}</div>` : ""}
    </article>
  `;
}

function renderTextFieldCard({ title, type, value, action, key, help = "" }) {
  return `
    <article class="field-card">
      <div class="field-card__header">
        <h4 class="field-title">${escapeHtml(title)}</h4>
        <span class="field-badge">${escapeHtml(type)}</span>
      </div>
      <label class="field-inline">
        <input
          type="${type === "url" ? "url" : "text"}"
          value="${escapeAttribute(String(value ?? ""))}"
          data-action="${escapeAttribute(action)}"
          data-key="${escapeAttribute(key)}"
        />
      </label>
      ${help ? `<div class="field-help">${escapeHtml(help)}</div>` : ""}
    </article>
  `;
}

function handleEditorInput(event) {
  if (!state.model) {
    return;
  }

  const target = event.target;
  const action = target.dataset.action;

  if (!action) {
    return;
  }

  switch (action) {
    case "package-text":
      state.model.packageConfig[target.dataset.key] = target.value;
      onModelUpdated();
      return;
    case "package-languages":
      state.model.packageConfig.languages = target.value
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      onModelUpdated();
      return;
    case "preloader-text":
      state.model.preloader[target.dataset.key] = target.value;
      onModelUpdated();
      return;
    case "preloader-icon-text":
      state.model.preloader.icon = target.value;
      onModelUpdated();
      return;
    case "asset-text":
      state.model.playgroundAssetOverrides[target.dataset.assetId] = target.value;
      onModelUpdated();
      return;
    case "field-scalar":
      updateScalarField(target);
      return;
    case "field-vector":
      updateVectorField(target);
      return;
    case "field-color-channel":
      updateColorChannel(target);
      return;
    case "preloader-color-channel":
      updatePreloaderColorChannel(target);
      return;
    default:
      return;
  }
}

function handleEditorChange(event) {
  if (!state.model) {
    return;
  }

  const target = event.target;
  const action = target.dataset.action;
  if (!action) {
    return;
  }

  switch (action) {
    case "package-select":
      state.model.packageConfig[target.dataset.key] = target.value;
      onModelUpdated();
      return;
    case "preloader-color-hex":
      {
        const [r, g, b] = hexToRgbBytes(target.value);
        const rgba = parseLooseColor(state.model.preloader.color);
        state.model.preloader.color = rgbaArrayToCss([r, g, b, rgba[3]]);
        onModelUpdated(true);
      }
      return;
    case "field-color-hex":
      {
        const [r, g, b] = hexToNormalizedRgb(target.value);
        const field = getFieldValue(target.dataset.group, target.dataset.field);
        field[1] = r;
        field[2] = g;
        field[3] = b;
        onModelUpdated(true);
      }
      return;
    case "preloader-icon-upload":
      readFileAsDataUrl(target.files?.[0]).then((result) => {
        if (result) {
          state.model.preloader.icon = result;
          onModelUpdated(true);
        }
      });
      return;
    case "asset-upload":
      readFileAsDataUrl(target.files?.[0]).then((result) => {
        if (result) {
          state.model.playgroundAssetOverrides[target.dataset.assetId] = result;
          onModelUpdated(true);
        }
      });
      return;
    case "field-boolean":
      {
        const field = getFieldValue(target.dataset.group, target.dataset.field);
        field[1] = target.checked ? 1 : 0;
        onModelUpdated();
      }
      return;
    default:
      return;
  }
}

function handleEditorClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button || !state.model) {
    return;
  }

  const action = button.dataset.action;

  if (action === "open-json-string") {
    const field = getFieldValue(button.dataset.group, button.dataset.field);
    const parsed = parseJsonLikeString(field[1]);
    const hint =
      parsed.ok && parsed.mode === "relaxed"
        ? "This Luna string contains trailing commas or similar relaxed JSON syntax. Applying changes will normalize it to strict JSON."
        : "This field is stored as a string but contains JSON.";
    openJsonModal({
      mode: "json-string",
      title: `${button.dataset.group}.${button.dataset.field}`,
      hint,
      value: field[1],
      group: button.dataset.group,
      field: button.dataset.field,
    });
    return;
  }

  if (action === "open-array-editor") {
    const field = getFieldValue(button.dataset.group, button.dataset.field);
    openJsonModal({
      mode: "typed-array",
      title: `${button.dataset.group}.${button.dataset.field}`,
      hint: `Edit this ${field[0]} value as JSON.`,
      value: JSON.stringify(field.slice(1), null, 2),
      group: button.dataset.group,
      field: button.dataset.field,
      fieldType: field[0],
    });
    return;
  }

  if (action === "open-raw-object") {
    const target = button.dataset.target;
    openJsonModal({
      mode: "raw-object",
      title: target,
      hint: "Edit the full object as JSON.",
      value: JSON.stringify(state.model[target], null, 2),
      target,
    });
  }
}

function handleViewportClick(event) {
  const button = event.target.closest('[data-action="preview-viewport"]');
  if (!button) {
    return;
  }

  state.previewViewport = button.dataset.viewport;
  renderPreviewViewportControls();
  layoutPreviewStage();
}

function handlePreviewPointerDown(event) {
  if (!state.previewUrl || event.button !== 0) {
    return;
  }

  state.previewPointerId = event.pointerId;
  elements.previewInputOverlay.classList.add("is-active");
  if (elements.previewInputOverlay.setPointerCapture) {
    elements.previewInputOverlay.setPointerCapture(event.pointerId);
  }
  event.preventDefault();
  dispatchPreviewTouch("touchstart", event);
}

function handlePreviewPointerMove(event) {
  if (state.previewPointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  dispatchPreviewTouch("touchmove", event);
}

function handlePreviewPointerUp(event) {
  if (state.previewPointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  dispatchPreviewTouch("touchend", event);
  releasePreviewPointer(event.pointerId);
}

function handlePreviewPointerCancel(event) {
  if (state.previewPointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  dispatchPreviewTouch("touchcancel", event);
  releasePreviewPointer(event.pointerId);
}

function updateScalarField(input) {
  const field = getFieldValue(input.dataset.group, input.dataset.field);
  const type = input.dataset.type;
  if (type === "string") {
    field[1] = input.value;
    input.classList.remove("is-invalid");
    onModelUpdated();
    return;
  }

  const parsed = type === "int" || type === "enum"
    ? parseInteger(input.value)
    : parseFloatStrict(input.value);

  if (parsed == null) {
    input.classList.add("is-invalid");
    return;
  }

  input.classList.remove("is-invalid");
  field[1] = parsed;
  onModelUpdated();
}

function updateVectorField(input) {
  const parsed = parseFloatStrict(input.value);
  if (parsed == null) {
    input.classList.add("is-invalid");
    return;
  }

  input.classList.remove("is-invalid");
  const field = getFieldValue(input.dataset.group, input.dataset.field);
  const index = Number(input.dataset.index);
  field[index + 1] = parsed;
  onModelUpdated();
}

function updateColorChannel(input) {
  const parsed = clampNumber(parseFloatStrict(input.value), 0, 1);
  if (parsed == null) {
    input.classList.add("is-invalid");
    return;
  }

  input.classList.remove("is-invalid");
  const field = getFieldValue(input.dataset.group, input.dataset.field);
  field[Number(input.dataset.channel) + 1] = parsed;
  syncColorInputWithinCard(input, rgbaArrayToHex(field.slice(1)));
  onModelUpdated();
}

function updatePreloaderColorChannel(input) {
  const channel = Number(input.dataset.channel);
  const isAlpha = channel === 3;
  const parsed = clampNumber(
    parseFloatStrict(input.value),
    isAlpha ? 0 : 0,
    isAlpha ? 1 : 255
  );

  if (parsed == null) {
    input.classList.add("is-invalid");
    return;
  }

  input.classList.remove("is-invalid");
  const rgba = parseLooseColor(state.model.preloader.color);
  rgba[channel] = parsed;
  state.model.preloader.color = rgbaArrayToCss(rgba);
  syncColorInputWithinCard(input, rgbBytesToHex(rgba));
  onModelUpdated();
}

function openJsonModal(config) {
  state.jsonEditor = config;
  elements.jsonModalEyebrow.textContent =
    config.mode === "raw-object" ? "Raw Object" : "Structured Editor";
  elements.jsonModalTitle.textContent = config.title;
  elements.jsonModalHint.textContent = config.hint;
  elements.jsonModalTextarea.value = config.value;
  elements.jsonModalStatus.textContent = "Validation ready.";
  elements.jsonModalTextarea.classList.remove("is-invalid");
  if (!elements.jsonModal.open) {
    elements.jsonModal.showModal();
  }
}

function formatJsonModal() {
  if (!state.jsonEditor) {
    return;
  }

  const result = validateJsonEditor(elements.jsonModalTextarea.value, state.jsonEditor);
  if (!result.ok) {
    setJsonModalError(result.error);
    return;
  }

  const formatted =
    state.jsonEditor.mode === "json-string"
      ? JSON.stringify(result.value, null, 2)
      : JSON.stringify(result.value, null, 2);
  elements.jsonModalTextarea.value = formatted;
  elements.jsonModalStatus.textContent = "Formatted successfully.";
  elements.jsonModalTextarea.classList.remove("is-invalid");
}

function applyJsonModal() {
  if (!state.jsonEditor) {
    return;
  }

  const result = validateJsonEditor(elements.jsonModalTextarea.value, state.jsonEditor);
  if (!result.ok) {
    setJsonModalError(result.error);
    return;
  }

  if (state.jsonEditor.mode === "json-string") {
    const field = getFieldValue(state.jsonEditor.group, state.jsonEditor.field);
    field[1] = JSON.stringify(result.value, null, 2);
  } else if (state.jsonEditor.mode === "typed-array") {
    const field = getFieldValue(state.jsonEditor.group, state.jsonEditor.field);
    field.splice(1, field.length - 1, ...result.value);
  } else if (state.jsonEditor.mode === "raw-object") {
    state.model[state.jsonEditor.target] = result.value;
  }

  elements.jsonModal.close();
  onModelUpdated(true);
}

function validateJsonEditor(text, config) {
  if (config.mode === "json-string") {
    const parsed = parseJsonLikeString(text);
    return parsed.ok
      ? { ok: true, value: parsed.value }
      : { ok: false, error: "This is not valid JSON yet." };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return { ok: false, error: "This is not valid JSON yet." };
  }

  if (config.mode === "raw-object") {
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      return { ok: false, error: "This editor expects a JSON object." };
    }
    return { ok: true, value: parsed };
  }

  if (config.mode === "typed-array") {
    const normalized = normalizeArrayValue(config.fieldType, parsed);
    if (!normalized.ok) {
      return normalized;
    }
    return { ok: true, value: normalized.value };
  }

  return { ok: false, error: "Unsupported editor mode." };
}

function normalizeArrayValue(type, value) {
  if (!Array.isArray(value)) {
    return { ok: false, error: "This field expects a JSON array." };
  }

  if (type === "int[]") {
    const normalized = value.map((entry) => parseInteger(String(entry)));
    return normalized.some((entry) => entry == null)
      ? { ok: false, error: "Every item in this int[] must be a whole number." }
      : { ok: true, value: normalized };
  }

  if (type === "float[]") {
    const normalized = value.map((entry) => parseFloatStrict(String(entry)));
    return normalized.some((entry) => entry == null)
      ? { ok: false, error: "Every item in this float[] must be numeric." }
      : { ok: true, value: normalized };
  }

  if (type === "string[]") {
    return value.every((entry) => typeof entry === "string")
      ? { ok: true, value }
      : { ok: false, error: "Every item in this string[] must be a string." };
  }

  const vectorMatch = type.match(/^vector([234])\[\]$/);
  if (vectorMatch) {
    const size = Number(vectorMatch[1]);
    const normalized = [];
    for (const entry of value) {
      if (!Array.isArray(entry) || entry.length !== size) {
        return {
          ok: false,
          error: `Every item in this ${type} must be an array with ${size} numbers.`,
        };
      }
      const row = entry.map((cell) => parseFloatStrict(String(cell)));
      if (row.some((cell) => cell == null)) {
        return {
          ok: false,
          error: `Every value in this ${type} must be numeric.`,
        };
      }
      normalized.push(row);
    }
    return { ok: true, value: normalized };
  }

  if (type === "color[]") {
    const normalized = [];
    for (const entry of value) {
      if (!Array.isArray(entry) || entry.length !== 4) {
        return {
          ok: false,
          error: "Every color[] item must be an array of four normalized RGBA values.",
        };
      }
      const rgba = entry.map((cell) => clampNumber(parseFloatStrict(String(cell)), 0, 1));
      if (rgba.some((cell) => cell == null)) {
        return {
          ok: false,
          error: "Every color[] component must be numeric and between 0 and 1.",
        };
      }
      normalized.push(rgba);
    }
    return { ok: true, value: normalized };
  }

  return { ok: false, error: `Unsupported array type: ${type}` };
}

function setJsonModalError(message) {
  elements.jsonModalTextarea.classList.add("is-invalid");
  elements.jsonModalStatus.textContent = message;
}

function closeJsonModal() {
  if (elements.jsonModal.open) {
    elements.jsonModal.close();
  }
}

function onModelUpdated(forceRender = false) {
  state.status = {
    kind: "ready",
    message:
      "Edit detected. The preview will refresh automatically and the download will include your patched values.",
  };
  renderMetrics();
  renderPreviewViewportControls();
  if (forceRender) {
    renderEditor();
  }
  updateStatusBanner();
  layoutPreviewStage();
  schedulePreviewRefresh();
}

function updateStatusBanner() {
  elements.statusBanner.textContent = state.status.message;
  elements.statusBanner.className = `status-banner status-banner--${state.status.kind}`;
}

function schedulePreviewRefresh(immediate = false) {
  clearTimeout(state.previewTimer);
  elements.previewStatus.textContent = "Refreshing…";
  state.previewTimer = window.setTimeout(
    () => {
      try {
        const html = buildPatchedHtml();
        const previewHtml = buildPreviewHtml(html);
        state.lastPatchedHtml = html;
        const url = URL.createObjectURL(new Blob([previewHtml], { type: "text/html" }));
        const oldUrl = state.previewUrl;
        state.previewUrl = url;
        elements.previewFrame.src = url;
        state.lastPreviewAt = new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });
        elements.previewStatus.textContent = `Auto reloaded ${state.lastPreviewAt}`;
        updatePreviewState();
        if (oldUrl) {
          setTimeout(() => URL.revokeObjectURL(oldUrl), 2000);
        }
      } catch (error) {
        state.status = {
          kind: "error",
          message:
            error instanceof Error ? error.message : "The export could not be rebuilt.",
        };
        updateStatusBanner();
        elements.previewStatus.textContent = "Preview error";
      }
    },
    immediate ? 20 : 320
  );
}

function updatePreviewState() {
  if (!state.previewUrl) {
    elements.previewPlaceholder.hidden = false;
    elements.previewInputOverlay.hidden = true;
    return;
  }
  elements.previewPlaceholder.hidden = true;
  elements.previewInputOverlay.hidden = false;
}

function renderPreviewViewportControls() {
  const active = state.previewViewport;
  [
    elements.previewViewportAuto,
    elements.previewViewportPortrait,
    elements.previewViewportLandscape,
  ].forEach((button) => {
    if (!button) {
      return;
    }
    button.classList.toggle("is-active", button.dataset.viewport === active);
  });

  const orientation = getEffectivePreviewOrientation();
  elements.previewStage.classList.toggle(
    "preview-stage--portrait",
    orientation === "portrait"
  );
  elements.previewStage.classList.toggle(
    "preview-stage--landscape",
    orientation === "landscape"
  );
}

function clearPreview() {
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
  }
  state.previewUrl = null;
  elements.previewFrame.removeAttribute("src");
  elements.previewInputOverlay.hidden = true;
  updatePreviewState();
  elements.previewStatus.textContent = "Idle";
}

function getEffectivePreviewOrientation() {
  if (state.previewViewport === "portrait" || state.previewViewport === "landscape") {
    return state.previewViewport;
  }

  const configured = state.model?.packageConfig?.orientation;
  return configured === "landscape" ? "landscape" : "portrait";
}

function setupPreviewStageObserver() {
  window.addEventListener("resize", layoutPreviewStage);
  if (typeof ResizeObserver === "undefined") {
    return;
  }

  const observer = new ResizeObserver(() => {
    layoutPreviewStage();
  });
  observer.observe(elements.previewStage.parentElement);
}

function layoutPreviewStage() {
  const wrap = elements.previewStage?.parentElement;
  const stage = elements.previewStage;
  if (!wrap || !stage) {
    return;
  }

  const bounds = wrap.getBoundingClientRect();
  if (!bounds.width || !bounds.height) {
    return;
  }

  const orientation = getEffectivePreviewOrientation();
  const ratio = orientation === "landscape" ? 16 / 9 : 9 / 16;
  const wrapRatio = bounds.width / bounds.height;
  let width;
  let height;

  if (wrapRatio > ratio) {
    height = bounds.height;
    width = height * ratio;
  } else {
    width = bounds.width;
    height = width / ratio;
  }

  stage.style.width = `${Math.floor(width)}px`;
  stage.style.height = `${Math.floor(height)}px`;
}

function releasePreviewPointer(pointerId) {
  if (
    elements.previewInputOverlay.releasePointerCapture &&
    elements.previewInputOverlay.hasPointerCapture &&
    elements.previewInputOverlay.hasPointerCapture(pointerId)
  ) {
    elements.previewInputOverlay.releasePointerCapture(pointerId);
  }
  state.previewPointerId = null;
  elements.previewInputOverlay.classList.remove("is-active");
}

function dispatchPreviewTouch(type, sourceEvent) {
  const frameWindow = elements.previewFrame.contentWindow;
  if (!frameWindow) {
    return;
  }

  const stageBounds = elements.previewStage.getBoundingClientRect();
  if (!stageBounds.width || !stageBounds.height) {
    return;
  }

  const clientX = clampNumber(
    sourceEvent.clientX - stageBounds.left,
    0,
    stageBounds.width
  );
  const clientY = clampNumber(
    sourceEvent.clientY - stageBounds.top,
    0,
    stageBounds.height
  );
  frameWindow.postMessage(
    {
      __lunaEditorTouch: true,
      type,
      clientX,
      clientY,
      screenX: sourceEvent.screenX,
      screenY: sourceEvent.screenY,
    },
    "*"
  );
}

function buildPatchedHtml() {
  if (!state.model || !state.originalHtml) {
    return "";
  }

  let html = state.originalHtml;
  const replacement = [
    `window.playgroundOverrides = ${JSON.stringify(state.model.playgroundOverrides)}`,
    `window.playgroundAssetOverrides = ${JSON.stringify(state.model.playgroundAssetOverrides)}`,
    `window.playgroundFiltersOverrides = ${JSON.stringify(state.model.playgroundFiltersOverrides)}`,
    `window.postProcessesOverrides = ${JSON.stringify(state.model.postProcessesOverrides)}`,
  ].join("; ");

  html = replaceOnce(html, overrideBlockPattern, replacement);
  html = replaceOnce(
    html,
    packageConfigPattern,
    `packageConfig:Object.assign(${serializePackageConfig(
      state.model.packageConfig,
      state.packageConfigOrder
    )},window.LUNA_PLAYGROUND_PACKAGE_CONFIG||{})`
  );
  html = replaceOnce(
    html,
    preloaderNamePattern,
    `$1${escapeHtml(state.model.preloader.name)}$3`
  );
  html = replaceOnce(
    html,
    preloaderColorPattern,
    `$1${escapeAttribute(state.model.preloader.color)}$3`
  );
  html = replaceOnce(
    html,
    preloaderIconPattern,
    `$1${escapeAttribute(state.model.preloader.icon)}$3`
  );
  return html;
}

function buildPreviewHtml(baseHtml) {
  if (baseHtml.includes("__LUNA_EDITOR_PREVIEW_HELPER__")) {
    return baseHtml;
  }

  if (baseHtml.includes("</body>")) {
    return baseHtml.replace("</body>", `${previewHelperScript}</body>`);
  }

  return `${baseHtml}${previewHelperScript}`;
}

function serializePackageConfig(config, order) {
  const seen = new Set(order);
  const keys = [...order, ...Object.keys(config).filter((key) => !seen.has(key))];
  return `{${keys
    .map((key) => `${key}:${serializeJsLiteral(config[key])}`)
    .join(",")}}`;
}

function serializeJsLiteral(value) {
  if (typeof value === "boolean") {
    return value ? "!0" : "!1";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "0";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return '""';
}

function replaceOnce(source, pattern, replacement) {
  if (!pattern.test(source)) {
    throw new Error("A required Luna block could not be found while rebuilding the file.");
  }
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}

function getFieldValue(groupName, fieldName) {
  return state.model.playgroundOverrides[groupName][fieldName];
}

function getAllFieldEntries(playgroundOverrides) {
  return Object.values(playgroundOverrides).flatMap((group) => Object.entries(group));
}

function getChangeCount() {
  if (!state.model || !state.originalModel) {
    return 0;
  }

  let changes = 0;
  if (
    JSON.stringify(state.model.packageConfig) !==
    JSON.stringify(state.originalModel.packageConfig)
  ) {
    changes += 1;
  }
  if (
    JSON.stringify(state.model.preloader) !== JSON.stringify(state.originalModel.preloader)
  ) {
    changes += 1;
  }
  if (
    JSON.stringify(state.model.playgroundAssetOverrides) !==
    JSON.stringify(state.originalModel.playgroundAssetOverrides)
  ) {
    changes += 1;
  }
  if (
    JSON.stringify(state.model.playgroundFiltersOverrides) !==
    JSON.stringify(state.originalModel.playgroundFiltersOverrides)
  ) {
    changes += 1;
  }
  if (
    JSON.stringify(state.model.postProcessesOverrides) !==
    JSON.stringify(state.originalModel.postProcessesOverrides)
  ) {
    changes += 1;
  }

  for (const [groupName, fields] of Object.entries(state.model.playgroundOverrides)) {
    for (const [fieldName, value] of Object.entries(fields)) {
      const original = state.originalModel.playgroundOverrides[groupName]?.[fieldName];
      if (JSON.stringify(value) !== JSON.stringify(original)) {
        changes += 1;
      }
    }
  }

  return changes;
}

function getDownloadName(filename) {
  if (!filename) {
    return "luna-edited.html";
  }

  if (filename.toLowerCase().endsWith(".html")) {
    return filename.replace(/\.html$/i, "-edited.html");
  }

  return `${filename}-edited.html`;
}

function renderImagePreview(src, alt) {
  if (!src) {
    return `<div class="asset-preview__fallback">No preview</div>`;
  }

  const lower = src.toLowerCase();
  const looksLikeImage =
    lower.startsWith("data:image/") ||
    /\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(lower);

  if (!looksLikeImage) {
    return `<div class="asset-preview__fallback">URL</div><div class="field-summary">${escapeHtml(
      shorten(src, 48)
    )}</div>`;
  }

  return `
    <img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" />
    <div class="field-summary">${escapeHtml(shorten(src, 48))}</div>
  `;
}

function describeArrayField(type, value) {
  const items = value.length;
  if (!items) {
    return `${type} • empty`;
  }
  if (type === "string[]") {
    return `${type} • ${items} item${items === 1 ? "" : "s"}`;
  }
  if (type === "int[]" || type === "float[]") {
    return `${type} • ${items} value${items === 1 ? "" : "s"}`;
  }
  return `${type} • ${items} row${items === 1 ? "" : "s"}`;
}

function describeJsonString(value) {
  const parsed = parseJsonLikeString(value);
  if (!parsed.ok) {
    return "JSON-like string";
  }

  const lines = value.trim().split("\n").length;
  const shape = Array.isArray(parsed.value) ? "Array" : "Object";
  const size = Array.isArray(parsed.value)
    ? `${parsed.value.length} item${parsed.value.length === 1 ? "" : "s"}`
    : `${Object.keys(parsed.value).length} key${Object.keys(parsed.value).length === 1 ? "" : "s"}`;
  const suffix = parsed.mode === "relaxed" ? " • normalized on save" : "";
  return `${shape} JSON • ${size} • ${lines} line${lines === 1 ? "" : "s"}${suffix}`;
}

function describeObject(value) {
  const keys = Object.keys(value || {});
  return keys.length
    ? `${keys.length} top-level key${keys.length === 1 ? "" : "s"}`
    : "Currently empty";
}

function looksLikeJsonLikeString(value) {
  if (typeof value !== "string") {
    return false;
  }
  const trimmed = value.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
    return false;
  }

  return parseJsonLikeString(trimmed).ok;
}

function parseJsonLikeString(value) {
  if (typeof value !== "string") {
    return { ok: false };
  }

  const trimmed = value.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
    return { ok: false };
  }

  try {
    return { ok: true, value: JSON.parse(trimmed), mode: "strict" };
  } catch (error) {
    try {
      return {
        ok: true,
        value: JSON.parse(stripTrailingCommas(trimmed)),
        mode: "relaxed",
      };
    } catch (relaxedError) {
      return { ok: false };
    }
  }
}

function stripTrailingCommas(value) {
  let output = "";
  let inString = false;
  let escaping = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      output += char;
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      output += char;
      continue;
    }

    if (char === ",") {
      let lookahead = index + 1;
      while (lookahead < value.length && /\s/.test(value[lookahead])) {
        lookahead += 1;
      }
      if (value[lookahead] === "}" || value[lookahead] === "]") {
        continue;
      }
    }

    output += char;
  }

  return output;
}

function isVectorType(type) {
  return /^vector[234]$/.test(type);
}

function isArrayType(type) {
  return /\[\]$/.test(type);
}

function getVectorLabel(index) {
  return ["X", "Y", "Z", "W"][index] || `#${index + 1}`;
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function parseInteger(value) {
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) ? parsed : null;
}

function parseFloatStrict(value) {
  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampNumber(value, min, max) {
  if (value == null) {
    return null;
  }
  return Math.min(max, Math.max(min, value));
}

function rgbaArrayToHex(rgba) {
  const [r, g, b] = rgba.map((channel, index) =>
    index === 3 ? channel : Math.round(Number(channel) * 255)
  );
  return `#${[r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

function hexToNormalizedRgb(hex) {
  return hexToRgbBytes(hex).map((channel) => channel / 255);
}

function hexToRgbBytes(hex) {
  const clean = hex.replace("#", "");
  return [0, 2, 4].map((offset) =>
    Number.parseInt(clean.slice(offset, offset + 2), 16)
  );
}

function rgbBytesToHex(rgba) {
  const [r, g, b] = rgba;
  return `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function parseLooseColor(value) {
  const fallback = [105, 190, 252, 1];
  const clean = String(value || "").replace("#", "");
  if (clean.length !== 6 && clean.length !== 8) {
    return fallback;
  }
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  const a =
    clean.length === 8
      ? Number.parseInt(clean.slice(6, 8), 16) / 255
      : fallback[3];
  return [r, g, b, Number(a.toFixed(2))];
}

function rgbaArrayToCss(rgba) {
  const toHex = (value) =>
    Math.round(value).toString(16).padStart(2, "0");
  const [r, g, b, a] = rgba;
  return `#${toHex(r)}${toHex(g)}${toHex(b)}${toHex(a * 255)}`;
}

function syncColorInputWithinCard(sourceInput, value) {
  const colorInput = sourceInput
    .closest(".field-card")
    ?.querySelector('input[type="color"]');
  if (colorInput) {
    colorInput.value = value;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function decodeHtml(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function shorten(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength - 1)}…`;
}

async function readFileAsDataUrl(file) {
  if (!file) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
