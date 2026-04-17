const state = {
  originalHtml: "",
  filename: "",
  model: null,
  originalModel: null,
  packageConfigOrder: [],
  embeddedAssetLinks: {},
  bundleInspection: createEmptyBundleInspection(),
  meshOverrides: {},
  meshDonorChoices: {},
  assetPreviewSources: {},
  previewUrl: null,
  previewTimer: null,
  previewAssetPollTimer: null,
  previewGeneration: 0,
  lastPreviewAt: "",
  previewViewport: "auto",
  previewPointerId: null,
  search: "",
  jsonEditor: null,
  lastPatchedHtml: "",
  loadSequence: 0,
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
  networkApplovin: document.getElementById("networkApplovin"),
  networkIronsource: document.getElementById("networkIronsource"),
  networkUnityads: document.getElementById("networkUnityads"),
  resetBtn: document.getElementById("resetBtn"),
  searchInput: document.getElementById("searchInput"),
  editorSections: document.getElementById("editorSections"),
  statusBanner: document.getElementById("statusBanner"),
  metricGroups: document.getElementById("metricGroups"),
  metricFields: document.getElementById("metricFields"),
  metricAssets: document.getElementById("metricAssets"),
  metricMeshes: document.getElementById("metricMeshes"),
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
const meshOverrideScriptPattern =
  /<script data-luna-mesh-overrides>[\s\S]*?<\/script>/g;
const compressedBundleJsonPattern =
  /decompressString\(\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*,\s*(true|false|!0|!1)\s*\)\.then\(\s*function\s*\(\s*[A-Za-z_$][\w$]*\s*\)\s*\{\s*window\.jsons\[\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*\]\s*=\s*JSON\.parse\(\s*[A-Za-z_$][\w$]*\s*\)\s*;?\s*\}\s*\)\s*;?/g;
const compressedBundleBlobPattern =
  /decompressArrayBuffer\(\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*,\s*(true|false|!0|!1)\s*\)\.then\(\s*function\s*\(\s*[A-Za-z_$][\w$]*\s*\)\s*\{\s*window\.blobs\[\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')\s*\]\s*=\s*[A-Za-z_$][\w$]*\s*;?\s*\}\s*\)\s*;?/g;
const brotliDecoderPattern =
  /window\.makeBrotliDecodeStr\s*=\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/;
const downloadTargetDefinitions = [
  {
    key: "applovin",
    label: "AppLovin",
    elementKey: "networkApplovin",
  },
  {
    key: "ironsource",
    label: "IronSource",
    elementKey: "networkIronsource",
  },
  {
    key: "unityads",
    label: "UnityAds",
    elementKey: "networkUnityads",
  },
];
const targetPlatformPattern = /targetPlatform:\s*("[^"]*"|'[^']*')/;
const scriptBlockPattern = /<script\b[^>]*>[\s\S]*?<\/script>/g;
const piApplyScriptBlockMatcher = /window\.pi\.apply\s*\(\s*window\s*,/;
const piApplySettingsPattern =
  /window\.pi\.apply\s*\(\s*window\s*,\s*(\[[\s\S]*?\])(?:\s*\|\|\s*\[\s*\])?\s*\)/;
const piInjectAdDataScriptMatcher = /window\.pi\.injectAdData/;
const piLogEventPatchScriptMatcher =
  /window\.pi\.originalLogEvent\s*=\s*window\.pi\.logEvent/;
const appLovinAnalyticsScriptMatcher = /APPLOVIN_ANALYTICS_EVENTS/;
const installFullGameScriptMatcher = /Luna\.Unity\.Playable\.InstallFullGame/;
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
  for (const input of getDownloadTargetInputs()) {
    input.addEventListener("change", () => {
      renderApp();
    });
  }

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

  elements.downloadBtn.addEventListener("click", async () => {
    if (!state.model) {
      return;
    }

    const selectedTargets = getSelectedDownloadTargets();
    if (!selectedTargets.length) {
      state.status = {
        kind: "error",
        message: "Pick at least one download target before exporting.",
      };
      updateStatusBanner();
      renderApp();
      return;
    }

    elements.downloadBtn.disabled = true;

    try {
      const exportResult = await buildDownloadHtml();
      const downloadItems = buildDownloadExports(exportResult.html, selectedTargets);

      for (let index = 0; index < downloadItems.length; index += 1) {
        const item = downloadItems[index];
        downloadHtmlFile(item.filename, item.html);
        if (index < downloadItems.length - 1) {
          await wait(140);
        }
      }

      state.status = {
        kind: "ready",
        message: buildDownloadStatusMessage(downloadItems, exportResult),
      };
      updateStatusBanner();
    } catch (error) {
      state.status = {
        kind: "error",
        message: `Could not build the edited HTML: ${getErrorMessage(error)}`,
      };
      updateStatusBanner();
    } finally {
      renderApp();
    }
  });

  elements.resetBtn.addEventListener("click", () => {
    if (!state.originalModel) {
      return;
    }

    state.model = deepClone(state.originalModel);
    state.meshOverrides = {};
    state.meshDonorChoices = {};
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
  elements.previewFrame.addEventListener("load", handlePreviewFrameLoad);
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
  const loadSequence = ++state.loadSequence;

  try {
    const html = await file.text();
    const parsed = parseLunaExport(html);
    revokeAssetPreviewSources();
    state.originalHtml = html;
    state.filename = file.name;
    state.model = parsed.model;
    state.originalModel = deepClone(parsed.model);
    state.packageConfigOrder = parsed.packageConfigOrder;
    state.embeddedAssetLinks = parsed.embeddedAssetLinks;
    state.bundleInspection = createLoadingBundleInspection();
    state.meshOverrides = {};
    state.meshDonorChoices = {};
    state.status = {
      kind: "ready",
      message:
        "Luna export loaded. Edit fields on the left and the preview will auto reload.",
    };
    renderApp();
    schedulePreviewRefresh(true);
    inspectEmbeddedBundles(html, loadSequence);
  } catch (error) {
    clearPreview();
    state.model = null;
    state.originalModel = null;
    state.embeddedAssetLinks = {};
    state.bundleInspection = createEmptyBundleInspection();
    state.meshOverrides = {};
    state.meshDonorChoices = {};
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
    embeddedAssetLinks: collectEmbeddedAssetLinks(html),
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

async function inspectEmbeddedBundles(html, loadSequence) {
  try {
    const inspection = await analyzeMeshBundlesFromHtml(html);

    if (loadSequence !== state.loadSequence || html !== state.originalHtml) {
      return;
    }

    state.bundleInspection = inspection;
    renderApp();
  } catch (error) {
    if (loadSequence !== state.loadSequence || html !== state.originalHtml) {
      return;
    }

    state.bundleInspection = {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "The embedded Luna bundle metadata could not be inspected.",
      bundles: [],
      meshesById: {},
      bundleCount: 0,
      meshBundleCount: 0,
      meshCount: 0,
      failedBundles: 0,
    };
    renderApp();
  }
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

function getDownloadTargetInputs() {
  return downloadTargetDefinitions
    .map((definition) => elements[definition.elementKey])
    .filter(Boolean);
}

function getSelectedDownloadTargets() {
  return downloadTargetDefinitions
    .filter((definition) => elements[definition.elementKey]?.checked)
    .map((definition) => definition.key);
}

function getDownloadTargetLabel(network) {
  return (
    downloadTargetDefinitions.find((definition) => definition.key === network)?.label ||
    network
  );
}

function getDownloadButtonLabel(selectedCount) {
  if (selectedCount > 1) {
    return `Download ${selectedCount} HTML Files`;
  }
  if (selectedCount === 1) {
    return "Download Edited HTML";
  }
  return "Select Download Targets";
}

function renderApp() {
  const loaded = Boolean(state.model);
  const selectedTargets = getSelectedDownloadTargets();
  elements.downloadBtn.disabled = !loaded || !selectedTargets.length;
  elements.downloadBtn.textContent = loaded
    ? getDownloadButtonLabel(selectedTargets.length)
    : "Download Edited HTML";
  elements.resetBtn.disabled = !loaded;
  elements.searchInput.disabled = !loaded;
  for (const input of getDownloadTargetInputs()) {
    input.disabled = !loaded;
  }
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
    elements.metricMeshes.textContent = "0";
    elements.metricChanges.textContent = "0";
    return;
  }

  const groups = Object.keys(state.model.playgroundOverrides).length;
  const fields = getAllFieldEntries(state.model.playgroundOverrides).length;
  const assets = getEditableAssetEntries().length;
  const meshes = state.bundleInspection.meshCount || 0;
  const changes = getChangeCount();
  elements.metricGroups.textContent = String(groups);
  elements.metricFields.textContent = String(fields);
  elements.metricAssets.textContent = String(assets);
  elements.metricMeshes.textContent = String(meshes);
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
  const meshMarkup = renderMeshSection();
  const advancedMarkup = renderAdvancedSection();
  const groupsMarkup = renderPlayableGroups();
  const markup = [
    packageConfigMarkup,
    preloaderMarkup,
    assetsMarkup,
    meshMarkup,
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
  const assetEntries = getEditableAssetEntries();
  const search = state.search;
  const filtered = assetEntries.filter((entry) => {
    if (!search) {
      return true;
    }
    return `${entry.assetId} ${entry.value} ${entry.mediaType} ${entry.references
      .map((reference) => reference.id)
      .join(" ")}`.toLowerCase().includes(search);
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
            <div class="section-meta">Editable URLs or uploaded replacements for Luna images, videos, and audio clips</div>
          </div>
        </div>
        <span class="field-badge">${assetEntries.length} assets</span>
      </summary>
      <div class="section-body">
        ${
          filtered.length
            ? filtered
                .map(
                  (entry) => {
                    const linkedSummary = describeAssetLinkSummary(entry.references);
                    const embeddedSource = entry.references[0]?.id;

                    return `
                    <article class="field-card">
                      <div class="field-card__header">
                        <h4 class="field-title">Asset ${escapeHtml(entry.assetId)}</h4>
                        <span class="field-badge">${escapeHtml(entry.mediaType)}</span>
                      </div>
                      <div class="field-inline field-inline--asset">
                        <div class="field-inline field-inline--stack">
                          <label class="mini-label">
                            <span>Replacement URL or Data URL</span>
                            <input
                              type="text"
                              value="${escapeAttribute(entry.value)}"
                              placeholder="${escapeAttribute(embeddedSource || "")}"
                              data-action="asset-text"
                              data-asset-id="${escapeAttribute(entry.assetId)}"
                            />
                          </label>
                          <label class="button button--ghost file-button">
                            <input
                              type="file"
                              accept="image/*,video/*,audio/*"
                              data-action="asset-upload"
                              data-asset-id="${escapeAttribute(entry.assetId)}"
                            />
                            <span>Upload Replacement Asset</span>
                          </label>
                        </div>
                        <div class="asset-preview">
                          ${renderAssetPreview(
                            getAssetPreviewValue(entry),
                            `Asset ${entry.assetId}`,
                            entry.mediaType
                          )}
                        </div>
                      </div>
                      <div class="field-summary">${escapeHtml(linkedSummary)}</div>
                      ${
                        embeddedSource
                          ? `<div class="field-summary">Embedded source: ${escapeHtml(embeddedSource)}</div>`
                          : ""
                      }
                    </article>
                  `;
                  }
                )
                .join("")
            : `
              <div class="empty-state">
                <h2>No asset overrides</h2>
                <p>This export does not include editable Luna image, video, or audio bundle assets.</p>
              </div>
            `
        }
      </div>
    </details>
  `;
}

function renderMeshSection() {
  const inspection = state.bundleInspection;
  if (!inspection || inspection.status === "idle") {
    return "";
  }

  const sectionMatchesSearch =
    !state.search || "mesh bundles luna bundle 3d geometry".includes(state.search);
  const visibleBundles = getVisibleMeshBundles(inspection, state.search);
  if (
    inspection.status === "ready" &&
    !visibleBundles.length &&
    state.search &&
    !sectionMatchesSearch
  ) {
    return "";
  }

  const open = state.search || inspection.status === "loading" ? "open" : "";
  const bundlesWithMeshes = inspection.bundles.filter((bundle) => bundle.meshCount > 0);
  const badge =
    inspection.status === "loading"
      ? "Scanning"
      : `${inspection.meshCount} mesh${inspection.meshCount === 1 ? "" : "es"}`;

  return `
    <details class="section-card" ${open}>
      <summary>
        <div class="section-title">
          <div>
            <h3>Mesh Bundles</h3>
            <div class="section-meta">Inspect Luna mesh bundles and replace a mesh with another Luna export or a custom OBJ upload</div>
          </div>
        </div>
        <span class="field-badge">${escapeHtml(badge)}</span>
      </summary>
      <div class="section-body">
        ${
          inspection.status === "loading"
            ? `
              <div class="empty-state">
                <h2>Inspecting meshes</h2>
                <p>${escapeHtml(inspection.message)}</p>
              </div>
            `
            : inspection.status === "error" || inspection.status === "unsupported"
              ? `
                <div class="empty-state">
                  <h2>Mesh inspection unavailable</h2>
                  <p>${escapeHtml(inspection.message)}</p>
                </div>
              `
              : inspection.status === "empty"
                ? `
                  <div class="empty-state">
                    <h2>No readable bundle metadata</h2>
                    <p>${escapeHtml(inspection.message)}</p>
                  </div>
                `
                : bundlesWithMeshes.length
                  ? `
                    <div class="mesh-overview">
                      ${renderMeshOverviewStat("Bundles", inspection.bundleCount)}
                      ${renderMeshOverviewStat("Mesh Bundles", inspection.meshBundleCount)}
                      ${renderMeshOverviewStat("Meshes", inspection.meshCount)}
                      ${renderMeshOverviewStat(
                        "Blob Data",
                        inspection.bundles.some((bundle) => bundle.dataBlobByteLength != null)
                          ? formatBytes(
                              inspection.bundles.reduce(
                                (total, bundle) => total + (bundle.dataBlobByteLength || 0),
                                0
                              )
                            )
                          : "N/A"
                      )}
                    </div>
                    ${
                      inspection.message
                        ? `<div class="field-summary">${escapeHtml(inspection.message)}</div>`
                        : ""
                    }
                    ${visibleBundles.map((bundle) => renderMeshBundleCard(bundle, state.search)).join("")}
                  `
                  : `
                    <div class="empty-state">
                      <h2>No meshes found</h2>
                      <p>${escapeHtml(inspection.message || "This export includes Luna bundles, but none of the readable bundles contain mesh entries.")}</p>
                    </div>
                  `
        }
      </div>
    </details>
  `;
}

function renderMeshOverviewStat(label, value) {
  return `
    <div class="mesh-overview__stat">
      <span class="mesh-overview__label">${escapeHtml(label)}</span>
      <span class="mesh-overview__value">${escapeHtml(String(value))}</span>
    </div>
  `;
}

function renderMeshBundleCard(bundle, search) {
  return `
    <article class="field-card">
      <div class="field-card__header">
        <div>
          <h4 class="field-title">Bundle ${escapeHtml(bundle.bundleId)}</h4>
          <div class="section-meta">${escapeHtml(bundle.bundlePath)}</div>
        </div>
        <span class="field-badge">${escapeHtml(
          `${bundle.meshCount} mesh${bundle.meshCount === 1 ? "" : "es"}`
        )}</span>
      </div>
      <div class="mesh-overview">
        ${renderMeshOverviewStat("Meshes", bundle.meshCount)}
        ${renderMeshOverviewStat("Handlers", bundle.handlerCount)}
        ${renderMeshOverviewStat("Blob", bundle.dataBlobByteLength != null ? formatBytes(bundle.dataBlobByteLength) : "N/A")}
      </div>
      <div class="field-summary">Assets: ${escapeHtml(describeBundleAssetCounts(bundle.assetCounts))}</div>
      ${
        bundle.dataBlobPath
          ? `<div class="field-summary">Blob path: ${escapeHtml(bundle.dataBlobPath)}</div>`
          : ""
      }
      ${
        bundle.dataBlobError
          ? `<div class="field-summary">${escapeHtml(bundle.dataBlobError)}</div>`
          : ""
      }
      <div class="mesh-list">
        ${bundle.meshes.map((mesh) => renderMeshEntryCard(mesh, search)).join("")}
      </div>
    </article>
  `;
}

function renderMeshEntryCard(mesh, search) {
  const override = state.meshOverrides[mesh.id];
  const donorChoice = state.meshDonorChoices[mesh.id];
  const displayMesh = override?.displayMesh || mesh;
  const open = search && doesMeshMatchSearch(mesh, search) ? "open" : "";
  const fallbackTitle = displayMesh.name || displayMesh.path || `Mesh ${displayMesh.id}`;
  const summary = [
    displayMesh.vertexCount != null
      ? `${formatNumber(displayMesh.vertexCount)} vertices`
      : "",
    `${displayMesh.subMeshCount} submesh${displayMesh.subMeshCount === 1 ? "" : "es"}`,
    displayMesh.totalByteLength != null ? formatBytes(displayMesh.totalByteLength) : "",
  ]
    .filter(Boolean)
    .join(" • ");

  return `
    <details class="mesh-entry-card" ${open}>
      <summary>
        <div>
          <h4 class="field-title">${escapeHtml(fallbackTitle)}</h4>
          <div class="section-meta">${escapeHtml(summary || "Mesh metadata")}</div>
        </div>
        <span class="field-badge">ID ${escapeHtml(String(displayMesh.id))}</span>
      </summary>
      <div class="mesh-entry-card__body">
        ${
          override
            ? `<div class="field-summary">Replacement ready: ${escapeHtml(override.label)}</div>`
            : `<div class="field-summary">Using the original Luna mesh data embedded in this export.</div>`
        }
        <div class="mesh-entry-card__meta">
          ${renderMeshChip(
            "Vertices",
            displayMesh.vertexCount != null ? formatNumber(displayMesh.vertexCount) : "N/A"
          )}
          ${renderMeshChip("Submeshes", formatNumber(displayMesh.subMeshCount))}
          ${renderMeshChip(
            "Vertex Blob",
            displayMesh.vertexBlobByteLength != null
              ? formatBytes(displayMesh.vertexBlobByteLength)
              : "N/A"
          )}
          ${renderMeshChip(
            "Blob Span",
            displayMesh.totalByteLength != null ? formatBytes(displayMesh.totalByteLength) : "N/A"
          )}
          ${renderMeshChip("Channels", formatNumber(displayMesh.channelCount))}
          ${renderMeshChip(
            "Half Precision",
            displayMesh.halfPrecision == null
              ? "Unknown"
              : displayMesh.halfPrecision
                ? "Yes"
                : "No"
          )}
        </div>
        ${
          displayMesh.path
            ? `<div class="field-summary mesh-entry-card__path">Path: ${escapeHtml(displayMesh.path)}</div>`
            : ""
        }
        ${
          displayMesh.boundsSummary
            ? `<div class="field-summary">Bounds: ${escapeHtml(displayMesh.boundsSummary)}</div>`
            : ""
        }
        ${
          displayMesh.indexRangesSummary
            ? `<div class="field-summary">Index ranges: ${escapeHtml(displayMesh.indexRangesSummary)}</div>`
            : ""
        }
        <div class="field-summary">
          Bind poses: ${escapeHtml(String(displayMesh.bindPoseCount))}
          • Blend shapes: ${escapeHtml(String(displayMesh.blendShapeCount))}
          • Raw fields: ${escapeHtml(String(displayMesh.rawDataLength))}
        </div>
        ${renderMeshReplacementControls(mesh, donorChoice, override)}
      </div>
    </details>
  `;
}

function renderMeshChip(label, value) {
  return `
    <div class="mesh-chip">
      <span class="mesh-chip__label">${escapeHtml(label)}</span>
      <span class="mesh-chip__value">${escapeHtml(String(value))}</span>
    </div>
  `;
}

function renderMeshReplacementControls(mesh, donorChoice, override) {
  const targetMesh = state.bundleInspection.meshesById?.[mesh.id];
  const replacementEnabled = Boolean(targetMesh?.bundle?.rawBlobBytes);

  if (!replacementEnabled) {
    return `<div class="field-summary">This mesh cannot be replaced yet because its source bundle blob was not decoded successfully.</div>`;
  }

  const options = donorChoice?.options || [];
  const selectedKey = donorChoice?.selectedKey || "";
  const statusMessage =
    donorChoice?.status === "loading"
      ? "Reading donor Luna HTML and extracting mesh candidates..."
      : donorChoice?.status === "error"
        ? donorChoice.message
        : donorChoice?.fileName
          ? `${donorChoice.fileName} loaded with ${options.length} candidate mesh${
              options.length === 1 ? "" : "es"
            }.`
          : "Upload another Luna HTML export to use one of its meshes as the donor.";

  return `
    <div class="mesh-replacement">
      <div class="field-summary">${escapeHtml(statusMessage)}</div>
      <div class="field-summary">
        Custom uploads currently support static Wavefront OBJ meshes. Skinned meshes and blend shapes are not supported yet.
      </div>
      <div class="field-inline field-inline--stack">
        <label class="button button--ghost file-button">
          <input
            type="file"
            accept=".html,text/html"
            data-action="mesh-donor-upload"
            data-mesh-id="${escapeAttribute(mesh.id)}"
          />
          <span>Upload Donor Luna HTML</span>
        </label>
        <label class="button button--ghost file-button">
          <input
            type="file"
            accept=".obj,text/plain"
            data-action="mesh-custom-upload"
            data-mesh-id="${escapeAttribute(mesh.id)}"
          />
          <span>Upload Custom OBJ</span>
        </label>
        ${
          options.length
            ? `
              <label class="mini-label">
                <span>Donor mesh</span>
                <select data-action="mesh-donor-select" data-mesh-id="${escapeAttribute(
                  mesh.id
                )}">
                  ${options
                    .map(
                      (option) => `
                        <option value="${escapeAttribute(option.key)}" ${
                          option.key === selectedKey ? "selected" : ""
                        }>
                          ${escapeHtml(option.label)}
                        </option>
                      `
                    )
                    .join("")}
                </select>
              </label>
              <div class="mesh-actions">
                <button
                  class="button button--primary"
                  type="button"
                  data-action="mesh-donor-apply"
                  data-mesh-id="${escapeAttribute(mesh.id)}"
                >
                  Apply Mesh Replacement
                </button>
                ${
                  override
                    ? `
                      <button
                        class="button button--ghost"
                        type="button"
                        data-action="mesh-donor-reset"
                        data-mesh-id="${escapeAttribute(mesh.id)}"
                      >
                        Reset Mesh
                      </button>
                    `
                    : ""
                }
              </div>
            `
            : override
              ? `
                <div class="mesh-actions">
                  <button
                    class="button button--ghost"
                    type="button"
                    data-action="mesh-donor-reset"
                    data-mesh-id="${escapeAttribute(mesh.id)}"
                  >
                    Reset Mesh
                  </button>
                </div>
              `
              : ""
        }
      </div>
    </div>
  `;
}

async function processMeshDonorFile(meshId, file) {
  if (!meshId || !file) {
    return;
  }

  const targetMesh = state.bundleInspection.meshesById?.[meshId];
  if (!targetMesh) {
    state.status = {
      kind: "error",
      message: `Target mesh ${meshId} is not available for replacement.`,
    };
    updateStatusBanner();
    return;
  }

  state.meshDonorChoices[meshId] = {
    status: "loading",
    fileName: file.name,
    options: [],
    selectedKey: "",
    message: "Reading donor Luna HTML...",
  };
  renderEditor();

  try {
    const html = await file.text();
    const donorInspection = await analyzeMeshBundlesFromHtml(html);
    const options = buildDonorMeshOptions(donorInspection, targetMesh);
    if (!options.length) {
      throw new Error(
        "No donor meshes with readable blob data were found in that Luna HTML export."
      );
    }

    state.meshDonorChoices[meshId] = {
      status: "ready",
      fileName: file.name,
      options,
      selectedKey: pickDefaultDonorOption(options, targetMesh),
      message: "",
    };
    state.status = {
      kind: "ready",
      message: `${file.name} loaded. Pick a donor mesh and apply the replacement.`,
    };
    renderEditor();
    updateStatusBanner();
  } catch (error) {
    state.meshDonorChoices[meshId] = {
      status: "error",
      fileName: file.name,
      options: [],
      selectedKey: "",
      message: getErrorMessage(error),
    };
    state.status = {
      kind: "error",
      message: `Could not read donor mesh data from ${file.name}: ${getErrorMessage(error)}`,
    };
    renderEditor();
    updateStatusBanner();
  }
}

async function processCustomMeshFile(meshId, file) {
  if (!meshId || !file) {
    return;
  }

  const targetMesh = state.bundleInspection.meshesById?.[meshId];
  if (!targetMesh?.rawEntry) {
    state.status = {
      kind: "error",
      message: `Target mesh ${meshId} is not available for custom replacement.`,
    };
    updateStatusBanner();
    return;
  }

  state.status = {
    kind: "ready",
    message: `Reading ${file.name} and building a custom Luna mesh payload...`,
  };
  updateStatusBanner();

  try {
    const text = await file.text();
    const objModel = parseWavefrontObj(text, file.name);
    const payload = createCustomObjMeshReplacementPayload(targetMesh, objModel);

    state.meshOverrides[meshId] = {
      label: `${file.name} (custom OBJ)`,
      payload,
      displayMesh: createCustomObjPreviewMesh(targetMesh, file.name, payload.summary),
      donorFileName: file.name,
    };
    onMeshOverridesUpdated(
      `Mesh ${targetMesh.name || meshId} will be replaced with custom OBJ geometry from ${file.name}.`
    );
  } catch (error) {
    state.status = {
      kind: "error",
      message: `Could not build a Luna mesh from ${file.name}: ${getErrorMessage(error)}`,
    };
    updateStatusBanner();
  }
}

function parseWavefrontObj(text, fallbackName = "") {
  const positions = [];
  const texcoords = [];
  const normals = [];
  const groups = [];
  let currentGroup = createObjGroup(fallbackName || "OBJ Mesh");

  const ensureCurrentGroup = () => {
    if (!currentGroup) {
      currentGroup = createObjGroup(fallbackName || "OBJ Mesh");
    }
    return currentGroup;
  };

  const startNewGroup = (label) => {
    if (currentGroup && currentGroup.triangles.length) {
      groups.push(currentGroup);
      currentGroup = createObjGroup(label);
      return;
    }

    const nextGroup = ensureCurrentGroup();
    nextGroup.name = label || nextGroup.name;
  };

  for (const rawLine of String(text || "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const parts = line.split(/\s+/);
    const keyword = parts[0];

    if (keyword === "v") {
      if (parts.length < 4) {
        throw new Error("OBJ vertex rows must include X, Y, and Z components.");
      }
      positions.push(parts.slice(1, 4).map(parseObjNumber));
      continue;
    }

    if (keyword === "vt") {
      if (parts.length < 3) {
        throw new Error("OBJ texture coordinate rows must include U and V values.");
      }
      texcoords.push(parts.slice(1, 3).map(parseObjNumber));
      continue;
    }

    if (keyword === "vn") {
      if (parts.length < 4) {
        throw new Error("OBJ normal rows must include X, Y, and Z components.");
      }
      normals.push(parts.slice(1, 4).map(parseObjNumber));
      continue;
    }

    if (keyword === "o" || keyword === "g" || keyword === "usemtl") {
      startNewGroup(parts.slice(1).join(" ") || keyword);
      continue;
    }

    if (keyword === "f") {
      if (parts.length < 4) {
        throw new Error("OBJ face rows must include at least three vertices.");
      }

      const faceVertices = parts.slice(1).map(parseObjFaceToken);
      const group = ensureCurrentGroup();
      for (let index = 1; index < faceVertices.length - 1; index += 1) {
        group.triangles.push([
          faceVertices[0],
          faceVertices[index],
          faceVertices[index + 1],
        ]);
      }
    }
  }

  if (currentGroup && currentGroup.triangles.length) {
    groups.push(currentGroup);
  }

  if (!positions.length) {
    throw new Error("The OBJ file does not include any vertex positions.");
  }

  if (!groups.length) {
    throw new Error("The OBJ file does not include any triangle faces.");
  }

  return {
    name: groups[0]?.name || fallbackName || "OBJ Mesh",
    positions,
    texcoords,
    normals,
    groups,
  };
}

function createObjGroup(name) {
  return {
    name: name || "OBJ Mesh",
    triangles: [],
  };
}

function parseObjFaceToken(token) {
  const [v, vt, vn] = token.split("/");
  return {
    v: parseObjIndexToken(v, "vertex"),
    vt: parseObjIndexToken(vt, "uv", true),
    vn: parseObjIndexToken(vn, "normal", true),
  };
}

function parseObjIndexToken(token, label, optional = false) {
  if (!token) {
    if (optional) {
      return 0;
    }
    throw new Error(`The OBJ file includes a face without a ${label} index.`);
  }

  const value = parseInteger(token);
  if (value == null || value === 0) {
    if (optional) {
      return 0;
    }
    throw new Error(`The OBJ file includes an invalid ${label} index: ${token}`);
  }
  return value;
}

function parseObjNumber(value) {
  const parsed = parseFloatStrict(value);
  if (parsed == null) {
    throw new Error(`The OBJ file contains an invalid number: ${value}`);
  }
  return parsed;
}

function createCustomObjMeshReplacementPayload(targetMesh, objModel) {
  const targetEntry = targetMesh.rawEntry;
  const targetData = Array.isArray(targetEntry?.data) ? targetEntry.data : [];
  const streams = Array.isArray(targetData[5]) ? targetData[5].slice() : [];
  const useHalfPrecision = targetData[1] === true;

  if (!streams.length) {
    throw new Error("The target Luna mesh does not expose a readable stream layout.");
  }
  if (streams[3] || streams[4]) {
    throw new Error("Skinned Luna meshes are not supported for custom OBJ replacement yet.");
  }
  if (Array.isArray(targetData[8]) && targetData[8].length) {
    throw new Error("Meshes with bind poses are not supported for custom OBJ replacement yet.");
  }
  if (Array.isArray(targetData[9]) && targetData[9].length) {
    throw new Error("Meshes with blend shapes are not supported for custom OBJ replacement yet.");
  }

  const geometry = buildCustomObjGeometry(
    objModel,
    streams,
    targetMesh.subMeshCount || 1,
    useHalfPrecision
  );
  const customEntry = deepClone(targetEntry);

  customEntry.data[0] = objModel.name || customEntry.data[0] || "Custom OBJ";
  customEntry.data[1] = geometry.halfPrecision;
  customEntry.data[2] = geometry.useUInt32IndexFormat;
  customEntry.data[3] = geometry.vertexCount;
  customEntry.data[4] = geometry.aabb;
  customEntry.data[5] = streams;
  customEntry.data[6] = [0, geometry.vertexByteLength];
  customEntry.data[7] = geometry.subMeshMarkers.map((marker) => [marker]);
  customEntry.data[8] = [];
  customEntry.data[9] = [];

  return {
    entry: customEntry,
    blobBytes: geometry.blobBytes,
    summary: geometry.summary,
  };
}

function buildCustomObjGeometry(
  objModel,
  streams,
  targetSubMeshCount,
  useHalfPrecision = false
) {
  const groups = objModel.groups;
  const positions = objModel.positions;
  const texcoords = objModel.texcoords;
  const normals = objModel.normals;
  const vertexMap = new Map();
  const vertices = [];
  const groupIndices = groups.map(() => []);

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    const indices = groupIndices[groupIndex];

    for (const triangle of group.triangles) {
      for (const corner of triangle) {
        const positionIndex = resolveObjReference(corner.v, positions.length, "vertex");
        const texcoordIndex = corner.vt
          ? resolveObjReference(corner.vt, texcoords.length, "uv")
          : 0;
        const normalIndex = corner.vn
          ? resolveObjReference(corner.vn, normals.length, "normal")
          : 0;
        const key = `${positionIndex}/${texcoordIndex}/${normalIndex}`;

        let vertexIndex = vertexMap.get(key);
        if (vertexIndex == null) {
          vertexIndex = vertices.length;
          vertexMap.set(key, vertexIndex);
          vertices.push({
            position: positions[positionIndex - 1].slice(0, 3),
            uv0: texcoordIndex ? texcoords[texcoordIndex - 1].slice(0, 2) : null,
            normal: normalIndex ? normals[normalIndex - 1].slice(0, 3) : null,
          });
        }

        indices.push(vertexIndex);
      }
    }
  }

  if (!vertices.length) {
    throw new Error("The OBJ file did not produce any usable triangle vertices.");
  }

  populateMissingNormals(vertices, groupIndices);
  populateTangents(vertices, groupIndices);

  const subMeshIndices = fitObjGroupsToTargetSubMeshes(
    groupIndices,
    Math.max(1, targetSubMeshCount)
  );
  const useUInt32IndexFormat =
    vertices.length > 65535 ||
    subMeshIndices.some((indices) => indices.some((value) => value > 65535));
  const vertexBytes = buildVertexBinaryBuffer(vertices, streams, useHalfPrecision);
  const vertexByteLength = vertexBytes.byteLength;
  const blobParts = [];
  blobParts.push(vertexBytes);

  let nextOffset = vertexByteLength;
  const subMeshMarkers = [];
  const subMeshRangesForSummary = [];

  for (const indices of subMeshIndices) {
    const typedIndices = useUInt32IndexFormat
      ? new Uint32Array(indices)
      : new Uint16Array(indices);
    const byteLength = typedIndices.byteLength;
    subMeshMarkers.push([nextOffset, byteLength]);
    subMeshRangesForSummary.push([[nextOffset, byteLength]]);
    blobParts.push(new Uint8Array(typedIndices.buffer.slice(0)));
    nextOffset += byteLength;
  }

  const blobBytes = concatUint8Arrays(blobParts);
  const aabb = computeObjAabb(vertices);
  const indexRangeStats = summarizeMeshIndexRanges(subMeshRangesForSummary);

  return {
    vertexCount: vertices.length,
    vertexByteLength,
    blobBytes,
    subMeshMarkers,
    useUInt32IndexFormat,
    halfPrecision: useHalfPrecision,
    aabb,
    summary: {
      vertexCount: vertices.length,
      subMeshCount: subMeshIndices.length,
      vertexBlobByteLength: vertexByteLength,
      totalByteLength: blobBytes.byteLength,
      boundsSummary: formatBounds(aabbToSummaryBounds(aabb)),
      indexRangesSummary: indexRangeStats.summary,
      channelCount: streams.length,
      halfPrecision: useHalfPrecision,
      bindPoseCount: 0,
      blendShapeCount: 0,
      rawDataLength: 10,
    },
  };
}

function resolveObjReference(value, length, label) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new Error(`The OBJ file includes an invalid ${label} index: ${value}`);
  }

  const resolved = parsed < 0 ? length + parsed + 1 : parsed;
  if (resolved < 1 || resolved > length) {
    throw new Error(`The OBJ file references ${label} ${value}, but only ${length} are available.`);
  }

  return resolved;
}

function populateMissingNormals(vertices, groupIndices) {
  const missingNormals = vertices.some((vertex) => !Array.isArray(vertex.normal));
  if (!missingNormals) {
    vertices.forEach((vertex) => {
      vertex.normal = normalizeVec3(vertex.normal);
    });
    return;
  }

  const accumulators = vertices.map(() => [0, 0, 0]);
  for (const indices of groupIndices) {
    for (let index = 0; index < indices.length; index += 3) {
      const a = vertices[indices[index]];
      const b = vertices[indices[index + 1]];
      const c = vertices[indices[index + 2]];
      const faceNormal = computeFaceNormal(a.position, b.position, c.position);
      accumulateVec3(accumulators[indices[index]], faceNormal);
      accumulateVec3(accumulators[indices[index + 1]], faceNormal);
      accumulateVec3(accumulators[indices[index + 2]], faceNormal);
    }
  }

  vertices.forEach((vertex, index) => {
    vertex.normal = Array.isArray(vertex.normal)
      ? normalizeVec3(vertex.normal)
      : normalizeVec3(accumulators[index], [0, 1, 0]);
  });
}

function populateTangents(vertices, groupIndices) {
  const tan1 = vertices.map(() => [0, 0, 0]);
  const tan2 = vertices.map(() => [0, 0, 0]);

  for (const indices of groupIndices) {
    for (let index = 0; index < indices.length; index += 3) {
      const i0 = indices[index];
      const i1 = indices[index + 1];
      const i2 = indices[index + 2];
      const v0 = vertices[i0];
      const v1 = vertices[i1];
      const v2 = vertices[i2];

      if (!(v0.uv0 && v1.uv0 && v2.uv0)) {
        continue;
      }

      const tangentFrame = computeTriangleTangents(
        v0.position,
        v1.position,
        v2.position,
        v0.uv0,
        v1.uv0,
        v2.uv0
      );

      if (!tangentFrame) {
        continue;
      }

      accumulateVec3(tan1[i0], tangentFrame.sdir);
      accumulateVec3(tan1[i1], tangentFrame.sdir);
      accumulateVec3(tan1[i2], tangentFrame.sdir);
      accumulateVec3(tan2[i0], tangentFrame.tdir);
      accumulateVec3(tan2[i1], tangentFrame.tdir);
      accumulateVec3(tan2[i2], tangentFrame.tdir);
    }
  }

  vertices.forEach((vertex, index) => {
    vertex.tangent = buildVertexTangent(vertex.normal, tan1[index], tan2[index]);
  });
}

function fitObjGroupsToTargetSubMeshes(groupIndices, targetSubMeshCount) {
  const subMeshes = Array.from({ length: targetSubMeshCount }, () => []);

  if (groupIndices.length === 1) {
    subMeshes[0].push(...groupIndices[0]);
    return subMeshes;
  }

  groupIndices.forEach((indices, index) => {
    const slot = Math.min(index, targetSubMeshCount - 1);
    subMeshes[slot].push(...indices);
  });

  return subMeshes;
}

function buildVertexBinaryBuffer(vertices, streams, useHalfPrecision = false) {
  const stride = getLunaStreamStride(streams);
  const bytesPerComponent = useHalfPrecision ? 2 : 4;
  const buffer = new ArrayBuffer(vertices.length * stride * bytesPerComponent);
  const view = new DataView(buffer);
  let byteOffset = 0;

  const writeComponents = (components) => {
    for (const component of components) {
      writeVertexComponent(view, byteOffset, component, useHalfPrecision);
      byteOffset += bytesPerComponent;
    }
  };

  for (const vertex of vertices) {
    if (streams[0]) {
      writeComponents(vertex.position);
    }
    if (streams[1]) {
      writeComponents(vertex.normal || [0, 1, 0]);
    }
    if (streams[2]) {
      writeComponents(vertex.tangent || [1, 0, 0, 1]);
    }
    if (streams[3]) {
      writeComponents([1, 0, 0, 0]);
    }
    if (streams[4]) {
      writeComponents([0, 0, 0, 0]);
    }
    if (streams[5]) {
      writeComponents([1, 1, 1, 1]);
    }
    if (streams[6]) {
      writeComponents(vertex.uv0 || [0, 0]);
    }
    if (streams[7]) {
      writeComponents([0, 0]);
    }
    if (streams[8]) {
      writeComponents([0, 0]);
    }
    if (streams[9]) {
      writeComponents([0, 0]);
    }
  }

  return new Uint8Array(buffer);
}

function writeVertexComponent(view, byteOffset, value, useHalfPrecision) {
  const number = Number(value);
  if (useHalfPrecision) {
    view.setUint16(byteOffset, float32ToFloat16Bits(number), true);
    return;
  }

  view.setFloat32(byteOffset, number, true);
}

const float32ToFloat16Scratch = new ArrayBuffer(4);
const float32ToFloat16View = new Float32Array(float32ToFloat16Scratch);
const float32ToFloat16BitsView = new Uint32Array(float32ToFloat16Scratch);

function float32ToFloat16Bits(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    if (Number.isNaN(number)) {
      return 0x7e00;
    }
    return number < 0 ? 0xfc00 : 0x7c00;
  }

  if (number === 0) {
    return Object.is(number, -0) ? 0x8000 : 0;
  }

  float32ToFloat16View[0] = number;
  const bits = float32ToFloat16BitsView[0];
  const sign = (bits >>> 16) & 0x8000;
  const exponent = ((bits >>> 23) & 0xff) - 127;
  const mantissa = bits & 0x7fffff;

  if (exponent < -24) {
    return sign;
  }

  if (exponent < -14) {
    const shifted = (mantissa | 0x800000) >> (-exponent - 1);
    return sign | ((shifted + 0x1000) >> 13);
  }

  if (exponent > 15) {
    return sign | 0x7c00;
  }

  let halfExponent = exponent + 15;
  let halfMantissa = (mantissa + 0x1000) >> 13;

  if (halfMantissa === 0x400) {
    halfExponent += 1;
    halfMantissa = 0;
  }

  if (halfExponent >= 0x1f) {
    return sign | 0x7c00;
  }

  return sign | (halfExponent << 10) | halfMantissa;
}

function getLunaStreamStride(streams) {
  const componentCounts = [3, 3, 4, 4, 4, 4, 2, 2, 2, 2];
  return streams.reduce(
    (total, enabled, index) => total + (enabled ? componentCounts[index] : 0),
    0
  );
}

function computeObjAabb(vertices) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const vertex of vertices) {
    const [x, y, z] = vertex.position;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    minZ = Math.min(minZ, z);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
    maxZ = Math.max(maxZ, z);
  }

  return [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
    (maxX - minX) / 2,
    (maxY - minY) / 2,
    (maxZ - minZ) / 2,
  ];
}

function aabbToSummaryBounds(aabb) {
  return [
    aabb[0] - aabb[3],
    aabb[1] - aabb[4],
    aabb[2] - aabb[5],
    aabb[0] + aabb[3],
    aabb[1] + aabb[4],
    aabb[2] + aabb[5],
  ];
}

function computeFaceNormal(a, b, c) {
  const edge1 = subtractVec3(b, a);
  const edge2 = subtractVec3(c, a);
  return normalizeVec3(crossVec3(edge1, edge2), [0, 1, 0]);
}

function computeTriangleTangents(position0, position1, position2, uv0, uv1, uv2) {
  const edge1 = subtractVec3(position1, position0);
  const edge2 = subtractVec3(position2, position0);
  const deltaUv1 = subtractVec2(uv1, uv0);
  const deltaUv2 = subtractVec2(uv2, uv0);
  const determinant = deltaUv1[0] * deltaUv2[1] - deltaUv1[1] * deltaUv2[0];

  if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-8) {
    return null;
  }

  const factor = 1 / determinant;
  return {
    sdir: [
      factor * (deltaUv2[1] * edge1[0] - deltaUv1[1] * edge2[0]),
      factor * (deltaUv2[1] * edge1[1] - deltaUv1[1] * edge2[1]),
      factor * (deltaUv2[1] * edge1[2] - deltaUv1[1] * edge2[2]),
    ],
    tdir: [
      factor * (deltaUv1[0] * edge2[0] - deltaUv2[0] * edge1[0]),
      factor * (deltaUv1[0] * edge2[1] - deltaUv2[0] * edge1[1]),
      factor * (deltaUv1[0] * edge2[2] - deltaUv2[0] * edge1[2]),
    ],
  };
}

function buildVertexTangent(normal, tangentAccum, bitangentAccum) {
  const safeNormal = normalizeVec3(normal, [0, 1, 0]);
  let tangent = subtractVec3(
    tangentAccum,
    scaleVec3(safeNormal, dotVec3(safeNormal, tangentAccum))
  );

  if (lengthVec3(tangent) < 1e-5) {
    tangent = chooseOrthogonalTangent(safeNormal);
  } else {
    tangent = normalizeVec3(tangent);
  }

  const handedness =
    dotVec3(crossVec3(safeNormal, tangent), bitangentAccum) < 0 ? -1 : 1;
  return [tangent[0], tangent[1], tangent[2], handedness];
}

function chooseOrthogonalTangent(normal) {
  const helper = Math.abs(normal[1]) < 0.999 ? [0, 1, 0] : [1, 0, 0];
  return normalizeVec3(crossVec3(helper, normal), [1, 0, 0]);
}

function normalizeVec3(vector, fallback = [0, 0, 1]) {
  const length = lengthVec3(vector);
  if (!Number.isFinite(length) || length < 1e-8) {
    return fallback.slice(0, 3);
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function lengthVec3(vector) {
  return Math.hypot(vector[0] || 0, vector[1] || 0, vector[2] || 0);
}

function subtractVec3(left, right) {
  return [
    (left[0] || 0) - (right[0] || 0),
    (left[1] || 0) - (right[1] || 0),
    (left[2] || 0) - (right[2] || 0),
  ];
}

function subtractVec2(left, right) {
  return [
    (left[0] || 0) - (right[0] || 0),
    (left[1] || 0) - (right[1] || 0),
  ];
}

function scaleVec3(vector, scalar) {
  return [(vector[0] || 0) * scalar, (vector[1] || 0) * scalar, (vector[2] || 0) * scalar];
}

function dotVec3(left, right) {
  return (
    (left[0] || 0) * (right[0] || 0) +
    (left[1] || 0) * (right[1] || 0) +
    (left[2] || 0) * (right[2] || 0)
  );
}

function crossVec3(left, right) {
  return [
    (left[1] || 0) * (right[2] || 0) - (left[2] || 0) * (right[1] || 0),
    (left[2] || 0) * (right[0] || 0) - (left[0] || 0) * (right[2] || 0),
    (left[0] || 0) * (right[1] || 0) - (left[1] || 0) * (right[0] || 0),
  ];
}

function accumulateVec3(target, value) {
  target[0] += value[0] || 0;
  target[1] += value[1] || 0;
  target[2] += value[2] || 0;
}

function createCustomObjPreviewMesh(targetMesh, fileName, summary) {
  return {
    ...targetMesh,
    name: fileName.replace(/\.obj$/i, "") || targetMesh.name,
    path: fileName,
    vertexCount: summary.vertexCount,
    vertexBlobByteLength: summary.vertexBlobByteLength,
    subMeshCount: summary.subMeshCount,
    totalByteLength: summary.totalByteLength,
    indexRangesSummary: summary.indexRangesSummary,
    boundsSummary: summary.boundsSummary,
    channelCount: summary.channelCount,
    halfPrecision: summary.halfPrecision,
    bindPoseCount: summary.bindPoseCount,
    blendShapeCount: summary.blendShapeCount,
    rawDataLength: summary.rawDataLength,
  };
}

function buildDonorMeshOptions(inspection, targetMesh) {
  if (inspection.status !== "ready") {
    throw new Error(inspection.message || "The donor Luna HTML could not be inspected.");
  }

  const options = [];
  for (const bundle of inspection.bundles) {
    if (!(bundle.rawBlobBytes instanceof Uint8Array)) {
      continue;
    }

    for (const mesh of bundle.meshes) {
      if (!mesh.rawEntry) {
        continue;
      }

      const payload = createNormalizedMeshReplacementPayload(mesh.rawEntry, bundle.rawBlobBytes);
      options.push({
        key: `${bundle.bundleId}:${mesh.id}`,
        label: `${mesh.name || `Mesh ${mesh.id}`} • ${formatNumber(
          mesh.vertexCount || 0
        )} vertices • ${bundle.bundleId}`,
        sourceLabel: `${mesh.name || `Mesh ${mesh.id}`} from ${bundle.bundlePath}`,
        previewMesh: createReplacementPreviewMesh(targetMesh, mesh),
        payload,
      });
    }
  }

  return options;
}

function pickDefaultDonorOption(options, targetMesh) {
  const targetName = normalizeMeshSearchText(targetMesh.name || targetMesh.path || "");
  const match = options.find((option) => {
    const previewName = normalizeMeshSearchText(
      option.previewMesh.name || option.previewMesh.path || ""
    );
    return targetName && previewName && previewName.includes(targetName);
  });
  return (match || options[0])?.key || "";
}

function normalizeMeshSearchText(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "");
}

function updateMeshDonorSelection(meshId, selectedKey) {
  const donorChoice = state.meshDonorChoices[meshId];
  if (!donorChoice) {
    return;
  }

  donorChoice.selectedKey = selectedKey;
  renderEditor();
}

function applyMeshReplacement(meshId) {
  const donorChoice = state.meshDonorChoices[meshId];
  const targetMesh = state.bundleInspection.meshesById?.[meshId];

  if (!donorChoice?.options?.length || !targetMesh) {
    state.status = {
      kind: "error",
      message: "Upload a donor Luna HTML and pick a donor mesh before applying.",
    };
    updateStatusBanner();
    return;
  }

  const selected = donorChoice.options.find((option) => option.key === donorChoice.selectedKey);
  if (!selected) {
    state.status = {
      kind: "error",
      message: "Choose a donor mesh before applying the replacement.",
    };
    updateStatusBanner();
    return;
  }

  state.meshOverrides[meshId] = {
    label: selected.sourceLabel,
    payload: selected.payload,
    displayMesh: selected.previewMesh,
    donorFileName: donorChoice.fileName,
  };
  onMeshOverridesUpdated(
    `Mesh ${targetMesh.name || meshId} will be replaced with ${selected.sourceLabel}.`
  );
}

function resetMeshReplacement(meshId) {
  const targetMesh = state.bundleInspection.meshesById?.[meshId];
  delete state.meshOverrides[meshId];
  onMeshOverridesUpdated(`Mesh ${targetMesh?.name || meshId} was reset to the original Luna data.`);
}

function createReplacementPreviewMesh(targetMesh, donorMesh) {
  return {
    ...targetMesh,
    name: targetMesh.name || donorMesh.name,
    path: targetMesh.path || donorMesh.path,
    vertexCount: donorMesh.vertexCount,
    vertexBlobByteLength: donorMesh.vertexBlobByteLength,
    subMeshCount: donorMesh.subMeshCount,
    totalByteLength: donorMesh.totalByteLength,
    indexRangesSummary: donorMesh.indexRangesSummary,
    boundsSummary: donorMesh.boundsSummary,
    channelCount: donorMesh.channelCount,
    halfPrecision: donorMesh.halfPrecision,
    bindPoseCount: donorMesh.bindPoseCount,
    blendShapeCount: donorMesh.blendShapeCount,
    rawDataLength: donorMesh.rawDataLength,
  };
}

function onMeshOverridesUpdated(message) {
  state.status = {
    kind: "ready",
    message,
  };
  renderMetrics();
  renderEditor();
  updateStatusBanner();
  layoutPreviewStage();
  schedulePreviewRefresh();
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
      setAssetOverrideValue(target.dataset.assetId, target.value);
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
          setAssetOverrideValue(target.dataset.assetId, result);
          onModelUpdated(true);
        }
      });
      return;
    case "mesh-donor-upload":
      processMeshDonorFile(target.dataset.meshId, target.files?.[0]);
      return;
    case "mesh-custom-upload":
      processCustomMeshFile(target.dataset.meshId, target.files?.[0]);
      return;
    case "mesh-donor-select":
      updateMeshDonorSelection(target.dataset.meshId, target.value);
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
    return;
  }

  if (action === "mesh-donor-apply") {
    applyMeshReplacement(button.dataset.meshId);
    return;
  }

  if (action === "mesh-donor-reset") {
    resetMeshReplacement(button.dataset.meshId);
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
  clearTimeout(state.previewAssetPollTimer);
  elements.previewStatus.textContent = "Refreshing…";
  state.previewTimer = window.setTimeout(
    () => {
      try {
        const html = buildPatchedHtml();
        const previewHtml = buildPreviewHtml(html);
        state.lastPatchedHtml = html;
        state.previewGeneration += 1;
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
  clearTimeout(state.previewAssetPollTimer);
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
  }
  revokeAssetPreviewSources();
  state.previewUrl = null;
  elements.previewFrame.removeAttribute("src");
  elements.previewInputOverlay.hidden = true;
  updatePreviewState();
  elements.previewStatus.textContent = "Idle";
}

function handlePreviewFrameLoad() {
  if (!state.model || !state.previewUrl) {
    return;
  }

  syncAudioPreviewSources(state.previewGeneration);
}

function syncAudioPreviewSources(generation, attempt = 0) {
  clearTimeout(state.previewAssetPollTimer);

  if (generation !== state.previewGeneration || !state.model) {
    return;
  }

  const audioEntries = getEditableAssetEntries().filter(
    (entry) =>
      !entry.value &&
      entry.mediaType === "audio" &&
      entry.references.some((reference) => reference.kind === "compressed-sound")
  );

  if (!audioEntries.length) {
    return;
  }

  const frameWindow = elements.previewFrame.contentWindow;
  const sounds = frameWindow?.sounds;
  let readyCount = 0;
  let updated = false;

  for (const entry of audioEntries) {
    const soundReference = entry.references.find(
      (reference) => reference.kind === "compressed-sound"
    );
    if (!soundReference) {
      continue;
    }

    const payload = sounds?.[soundReference.id];
    if (!payload) {
      continue;
    }

    readyCount += 1;
    updated =
      storeAssetPreviewSource(entry.assetId, payload, soundReference.id, generation) ||
      updated;
  }

  if (updated) {
    renderEditor();
  }

  if (readyCount < audioEntries.length && attempt < 24) {
    state.previewAssetPollTimer = window.setTimeout(() => {
      syncAudioPreviewSources(generation, attempt + 1);
    }, 250);
  }
}

function storeAssetPreviewSource(assetId, payload, sourceId, generation) {
  const existing = state.assetPreviewSources[assetId];
  if (existing && existing.sourceId === sourceId) {
    return false;
  }

  const objectUrl = createAssetPreviewUrl(payload, sourceId);
  if (!objectUrl) {
    return false;
  }

  if (existing?.url) {
    URL.revokeObjectURL(existing.url);
  }

  state.assetPreviewSources[assetId] = {
    url: objectUrl,
    sourceId,
    generation,
  };
  return true;
}

function createAssetPreviewUrl(payload, sourceId) {
  let blob = null;

  if (isBlobLike(payload)) {
    blob = payload;
  } else if (isArrayBufferLike(payload)) {
    blob = new Blob([payload], { type: inferMimeTypeFromAssetId(sourceId) });
  } else if (ArrayBuffer.isView(payload)) {
    blob = new Blob(
      [payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength)],
      { type: inferMimeTypeFromAssetId(sourceId) }
    );
  }

  return blob ? URL.createObjectURL(blob) : "";
}

function revokeAssetPreviewSources() {
  clearTimeout(state.previewAssetPollTimer);
  Object.values(state.assetPreviewSources).forEach((entry) => {
    if (entry?.url) {
      URL.revokeObjectURL(entry.url);
    }
  });
  state.assetPreviewSources = {};
}

function inferMimeTypeFromAssetId(assetId) {
  const lower = assetId.toLowerCase();
  if (lower.endsWith(".mp3")) {
    return "audio/mpeg";
  }
  if (lower.endsWith(".wav")) {
    return "audio/wav";
  }
  if (lower.endsWith(".ogg")) {
    return "audio/ogg";
  }
  if (lower.endsWith(".m4a")) {
    return "audio/mp4";
  }
  if (lower.endsWith(".aac")) {
    return "audio/aac";
  }
  if (lower.endsWith(".weba") || lower.endsWith(".webm")) {
    return "audio/webm";
  }
  return "application/octet-stream";
}

function isArrayBufferLike(value) {
  return Object.prototype.toString.call(value) === "[object ArrayBuffer]";
}

function isBlobLike(value) {
  return (
    value &&
    typeof value === "object" &&
    typeof value.arrayBuffer === "function" &&
    typeof value.type === "string"
  );
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

function createEmptyBundleInspection() {
  return {
    status: "idle",
    message: "",
    bundles: [],
    meshesById: {},
    bundleCount: 0,
    meshBundleCount: 0,
    meshCount: 0,
    failedBundles: 0,
  };
}

function createLoadingBundleInspection() {
  return {
    status: "loading",
    message: "Inspecting embedded Luna bundles for mesh metadata...",
    bundles: [],
    meshesById: {},
    bundleCount: 0,
    meshBundleCount: 0,
    meshCount: 0,
    failedBundles: 0,
  };
}

async function analyzeMeshBundlesFromHtml(html) {
  const bundleSpecs = collectCompressedBundleJsonSpecs(html);
  if (!bundleSpecs.length) {
    return {
      status: "empty",
      message:
        "No inline compressed Luna bundle.json blocks were detected. Mesh inspection currently reads the standard embedded Luna bundle metadata format.",
      bundles: [],
      meshesById: {},
      bundleCount: 0,
      meshBundleCount: 0,
      meshCount: 0,
      failedBundles: 0,
    };
  }

  const brotliDecoder = extractBrotliDecoder(html);
  const blobSpecsByPath = new Map(
    collectCompressedBundleBlobSpecs(html).map((spec) => [spec.path, spec])
  );

  const results = await Promise.all(
    bundleSpecs.map(async (spec) => {
      try {
        const jsonText = await decodeCompressedTextAsset(
          spec.payloadLiteral,
          spec.isBase122,
          brotliDecoder
        );
        const bundleJson = JSON.parse(jsonText);
        const dataBlobPath = getBundleDataBlobPath(spec.path);
        const blobSpec = blobSpecsByPath.get(dataBlobPath);
        let rawBlobBytes = null;
        let dataBlobByteLength = null;
        let dataBlobError = "";

        if (blobSpec) {
          try {
            rawBlobBytes = await decodeCompressedBinaryAsset(
              blobSpec.payloadLiteral,
              blobSpec.isBase122,
              brotliDecoder
            );
            dataBlobByteLength = rawBlobBytes.byteLength;
          } catch (error) {
            dataBlobError = `Data blob size unavailable: ${getErrorMessage(error)}`;
          }
        }

        return {
          ok: true,
          bundle: summarizeMeshBundle(spec.path, bundleJson, {
            dataBlobPath,
            dataBlobByteLength,
            dataBlobError,
            rawBlobBytes,
            rawJson: bundleJson,
          }),
        };
      } catch (error) {
        return {
          ok: false,
          path: spec.path,
          error: getErrorMessage(error),
        };
      }
    })
  );

  const bundles = results
    .filter((result) => result.ok)
    .map((result) => result.bundle)
    .sort((left, right) => compareAssetIds(left.bundleId, right.bundleId));
  const failedBundles = results.filter((result) => !result.ok);

  if (!bundles.length) {
    return {
      status: "error",
      message:
        failedBundles[0]?.error ||
        "Bundle metadata was found, but none of it could be decoded successfully.",
      bundles: [],
      meshesById: {},
      bundleCount: 0,
      meshBundleCount: 0,
      meshCount: 0,
      failedBundles: failedBundles.length,
    };
  }

  const meshBundleCount = bundles.filter((bundle) => bundle.meshCount > 0).length;
  const meshCount = bundles.reduce((total, bundle) => total + bundle.meshCount, 0);
  const meshesById = {};
  for (const bundle of bundles) {
    for (const mesh of bundle.meshes) {
      meshesById[mesh.id] = mesh;
    }
  }
  let message = `Inspected ${bundles.length} Luna bundle${
    bundles.length === 1 ? "" : "s"
  }.`;

  if (meshCount > 0) {
    message += ` Found ${meshCount} mesh record${
      meshCount === 1 ? "" : "s"
    } across ${meshBundleCount} bundle${meshBundleCount === 1 ? "" : "s"}.`;
  } else {
    message += " No mesh records were found in the readable bundles.";
  }

  if (failedBundles.length) {
    message += ` ${failedBundles.length} bundle${
      failedBundles.length === 1 ? "" : "s"
    } could not be decoded.`;
  }

  return {
    status: "ready",
    message,
    bundles,
    meshesById,
    bundleCount: bundles.length,
    meshBundleCount,
    meshCount,
    failedBundles: failedBundles.length,
  };
}

function collectCompressedBundleJsonSpecs(html) {
  return extractCompressedBundleSpecs(html, compressedBundleJsonPattern, "bundle.json");
}

function collectCompressedBundleBlobSpecs(html) {
  return extractCompressedBundleSpecs(html, compressedBundleBlobPattern, "data.blob");
}

function extractCompressedBundleSpecs(html, pattern, expectedFilename) {
  pattern.lastIndex = 0;
  const seen = new Set();
  const specs = [];
  let match;

  while ((match = pattern.exec(html))) {
    const path = parseJsStringLiteral(match[3]);
    if (
      typeof path !== "string" ||
      !path.includes("/assets/bundles/") && !path.startsWith("assets/bundles/") ||
      !path.endsWith(expectedFilename) ||
      seen.has(path)
    ) {
      continue;
    }

    seen.add(path);
    specs.push({
      matchText: match[0],
      path,
      payloadLiteral: match[1],
      isBase122: parseEmbeddedCompressionFlag(match[2]),
    });
  }

  return specs;
}

function parseEmbeddedCompressionFlag(value) {
  return value === "true" || value === "!0";
}

function extractBrotliDecoder(html) {
  const match = html.match(brotliDecoderPattern);
  if (!match) {
    throw new Error("This export does not expose Luna's embedded Brotli decoder helper.");
  }

  try {
    const source = parseJsStringLiteral(match[1]);
    const createDecoder = Function(`"use strict"; return (${source});`)();
    const decoder = createDecoder();
    if (typeof decoder !== "function") {
      throw new Error("The extracted Brotli decoder did not initialize.");
    }
    return decoder;
  } catch (error) {
    throw new Error(`The Luna Brotli decoder could not be initialized. ${getErrorMessage(error)}`);
  }
}

function parseJsStringLiteral(literal) {
  return Function(`"use strict"; return (${literal});`)();
}

async function decodeCompressedTextAsset(payloadLiteral, isBase122, brotliDecoder) {
  const bytes = await decodeCompressedBinaryAsset(
    payloadLiteral,
    isBase122,
    brotliDecoder
  );
  return new TextDecoder("utf-8").decode(bytes);
}

async function decodeCompressedBinaryAsset(payloadLiteral, isBase122, brotliDecoder) {
  const payload = parseJsStringLiteral(payloadLiteral);
  const encodedBytes = isBase122
    ? base122ToUint8Array(payload)
    : base64ToUint8Array(payload);
  const decodedBytes = await brotliDecoder(encodedBytes);
  return decodedBytes instanceof Uint8Array
    ? decodedBytes
    : new Uint8Array(decodedBytes);
}

const base122IllegalCharacters = [0, 10, 13, 34, 38, 92];
const base122ShortenedMarker = 0b111;

function base122ToUint8Array(strData) {
  let curByte = 0;
  let bitOfByte = 0;
  let decodedIndex = 0;
  const maxOutputLength = (1.75 * strData.length) | 0;
  const decoded = new Uint8Array(maxOutputLength);

  function push7(byte) {
    byte <<= 1;
    curByte |= byte >>> bitOfByte;
    bitOfByte += 7;
    if (bitOfByte >= 8) {
      decoded[decodedIndex++] = curByte;
      bitOfByte -= 8;
      curByte = (byte << (7 - bitOfByte)) & 255;
    }
  }

  for (let index = 0; index < strData.length; index += 1) {
    const code = strData.charCodeAt(index);
    if (code > 127) {
      const illegalIndex = (code >>> 8) & 7;
      if (illegalIndex !== base122ShortenedMarker) {
        push7(base122IllegalCharacters[illegalIndex]);
      }
      push7(code & 127);
    } else {
      push7(code);
    }
  }

  return new Uint8Array(decoded.buffer, 0, decodedIndex);
}

function base64ToUint8Array(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function summarizeMeshBundle(bundlePath, bundleJson, options = {}) {
  const assetCounts = Object.entries(bundleJson || {})
    .map(([name, value]) => ({
      name,
      count: countBundleEntries(value),
    }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  const meshes = Array.isArray(bundleJson?.meshes)
    ? bundleJson.meshes.map(summarizeMeshEntry)
    : [];

  const bundle = {
    bundleId: getBundleIdFromPath(bundlePath),
    bundlePath,
    rawJson: options.rawJson || bundleJson || null,
    rawBlobBytes:
      options.rawBlobBytes instanceof Uint8Array ? options.rawBlobBytes : null,
    dataBlobPath: options.dataBlobPath || getBundleDataBlobPath(bundlePath),
    dataBlobByteLength:
      typeof options.dataBlobByteLength === "number" ? options.dataBlobByteLength : null,
    dataBlobError: options.dataBlobError || "",
    assetCounts,
    handlerCount: assetCounts.length,
    meshes,
    meshCount: meshes.length,
  };

  bundle.meshes.forEach((mesh) => {
    mesh.bundle = bundle;
  });

  return bundle;
}

function countBundleEntries(value) {
  if (Array.isArray(value)) {
    return value.length;
  }
  if (value && typeof value === "object") {
    return Object.keys(value).length;
  }
  return 0;
}

function summarizeMeshEntry(entry) {
  const data = Array.isArray(entry?.data) ? entry.data : [];
  const vertexBlobInfo = Array.isArray(data[6]) ? data[6] : [];
  const subMeshRanges = Array.isArray(data[7]) ? data[7] : [];
  const indexRangeStats = summarizeMeshIndexRanges(subMeshRanges);
  const bounds = Array.isArray(data[4]) ? data[4] : [];
  const channelLayout = Array.isArray(data[5]) ? data[5] : [];
  const bindPoses = Array.isArray(data[8]) ? data[8] : [];
  const blendShapes = Array.isArray(data[9]) ? data[9] : [];
  const fallbackName = inferMeshName(entry?.path, entry?.id);

  return {
    id: String(entry?.id ?? ""),
    rawEntry: entry || null,
    name: typeof data[0] === "string" && data[0] ? data[0] : fallbackName,
    path: entry?.path || "",
    halfPrecision: typeof data[1] === "boolean" ? data[1] : null,
    vertexCount: Number.isFinite(Number(data[3])) ? Number(data[3]) : null,
    vertexBlobByteLength:
      Number.isFinite(Number(vertexBlobInfo[1])) ? Number(vertexBlobInfo[1]) : null,
    subMeshCount: subMeshRanges.length,
    totalByteLength: indexRangeStats.maxEnd,
    indexRangesSummary: indexRangeStats.summary,
    boundsSummary: formatBounds(bounds),
    channelCount: channelLayout.length,
    bindPoseCount: bindPoses.length,
    blendShapeCount: blendShapes.length,
    rawDataLength: data.length,
  };
}

function summarizeMeshIndexRanges(subMeshRanges) {
  const ranges = [];

  for (const group of subMeshRanges) {
    if (!Array.isArray(group)) {
      continue;
    }
    for (const range of group) {
      if (
        Array.isArray(range) &&
        Number.isFinite(Number(range[0])) &&
        Number.isFinite(Number(range[1]))
      ) {
        const offset = Number(range[0]);
        const length = Number(range[1]);
        ranges.push({
          offset,
          length,
          end: offset + length,
        });
      }
    }
  }

  if (!ranges.length) {
    return {
      summary: "",
      maxEnd: null,
    };
  }

  const summary = ranges
    .slice(0, 3)
    .map((range) => `${formatNumber(range.offset)}-${formatNumber(range.end)}`)
    .join(", ");
  const suffix = ranges.length > 3 ? ` +${ranges.length - 3} more` : "";

  return {
    summary: `${summary}${suffix}`,
    maxEnd: Math.max(...ranges.map((range) => range.end)),
  };
}

function inferMeshName(path, id) {
  if (typeof path === "string" && path) {
    const parts = path.split("/").filter(Boolean);
    return parts[parts.length - 1] || `Mesh ${id ?? "?"}`;
  }
  return `Mesh ${id ?? "?"}`;
}

function getBundleIdFromPath(path) {
  const match = String(path).match(/assets\/bundles\/([^/]+)\//);
  return match ? match[1] : "?";
}

function getBundleDataBlobPath(bundlePath) {
  return String(bundlePath).replace(/bundle\.json$/i, "data.blob");
}

function getVisibleMeshBundles(inspection, search) {
  const bundles = inspection.bundles.filter((bundle) => bundle.meshCount > 0);
  if (!search) {
    return bundles;
  }

  return bundles
    .map((bundle) => {
      if (doesBundleMatchSearch(bundle, search)) {
        return bundle;
      }

      const meshes = bundle.meshes.filter((mesh) => doesMeshMatchSearch(mesh, search));
      if (!meshes.length) {
        return null;
      }

      return {
        ...bundle,
        meshes,
        meshCount: meshes.length,
      };
    })
    .filter(Boolean);
}

function doesBundleMatchSearch(bundle, search) {
  const haystack = [
    bundle.bundleId,
    bundle.bundlePath,
    bundle.dataBlobPath,
    ...bundle.assetCounts.map((entry) => `${entry.name} ${entry.count}`),
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
}

function doesMeshMatchSearch(mesh, search) {
  const haystack = [
    mesh.id,
    mesh.name,
    mesh.path,
    mesh.vertexCount,
    mesh.indexRangesSummary,
    mesh.boundsSummary,
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(search);
}

function describeBundleAssetCounts(assetCounts) {
  if (!assetCounts.length) {
    return "No bundle handler counts were available.";
  }

  return assetCounts
    .slice(0, 6)
    .map((entry) => `${entry.name} ${formatNumber(entry.count)}`)
    .join(", ");
}

function formatBounds(bounds) {
  if (!Array.isArray(bounds) || bounds.length < 6) {
    return "";
  }

  const values = bounds.slice(0, 6).map((value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(4).replace(/\.?0+$/, "") : String(value);
  });

  return `${values.slice(0, 3).join(", ")} -> ${values.slice(3, 6).join(", ")}`;
}

function formatNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : String(value);
}

function formatBytes(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    return "N/A";
  }

  if (number < 1024) {
    return `${formatNumber(number)} B`;
  }

  const units = ["KB", "MB", "GB"];
  let current = number / 1024;
  let unitIndex = 0;

  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }

  return `${current.toFixed(current >= 10 ? 1 : 2).replace(/\.?0+$/, "")} ${
    units[unitIndex]
  }`;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function createNormalizedMeshReplacementPayload(rawEntry, rawBlobBytes) {
  if (!rawEntry || !Array.isArray(rawEntry.data)) {
    throw new Error("The donor mesh record is missing Luna mesh data.");
  }

  const sourceBytes = ensureUint8Array(rawBlobBytes);
  if (!sourceBytes.byteLength) {
    throw new Error("The donor Luna bundle did not expose readable mesh blob bytes.");
  }

  const normalizedEntry = deepClone(rawEntry);
  const segments = [];
  const normalizedMarkers = new Map();
  let nextOffset = 0;

  const normalizeMarker = (marker, label) => {
    if (!isByteRangeMarker(marker)) {
      throw new Error(`The donor mesh ${label} marker is not a valid [offset, length] pair.`);
    }

    const offset = Number(marker[0]);
    const length = Number(marker[1]);
    if (offset < 0 || length < 0 || offset + length > sourceBytes.byteLength) {
      throw new Error(`The donor mesh ${label} marker points outside the bundle data blob.`);
    }

    const key = `${offset}:${length}`;
    const existing = normalizedMarkers.get(key);
    if (existing) {
      return existing.slice();
    }

    const rebasedMarker = [nextOffset, length];
    normalizedMarkers.set(key, rebasedMarker);
    segments.push(sourceBytes.slice(offset, offset + length));
    nextOffset += length;
    return rebasedMarker.slice();
  };

  offsetMeshMarkers(normalizedEntry, 0, normalizeMarker);

  return {
    entry: normalizedEntry,
    blobBytes: concatUint8Arrays(segments),
  };
}

function buildModifiedMeshBundles() {
  const overrideEntries = Object.entries(state.meshOverrides || {});
  if (!overrideEntries.length) {
    return [];
  }

  // Group replacement payloads by bundle so export only carries the mesh deltas.
  const overridesByBundlePath = new Map();

  for (const [meshId, override] of overrideEntries) {
    const targetMesh = state.bundleInspection.meshesById?.[meshId];
    const bundle = targetMesh?.bundle;
    if (!targetMesh || !bundle) {
      throw new Error(`Mesh ${meshId} is no longer available for replacement.`);
    }
    if (!override?.payload?.entry || !override?.payload?.blobBytes) {
      throw new Error(`Mesh ${meshId} does not have a usable donor payload yet.`);
    }

    const entry = overridesByBundlePath.get(bundle.bundlePath) || {
      bundleJsonPath: bundle.bundlePath,
      bundleBlobPath: bundle.dataBlobPath,
      replacements: [],
    };
    entry.replacements.push({
      meshId,
      entry: deepClone(override.payload.entry),
      blobBytes: ensureUint8Array(override.payload.blobBytes),
    });
    overridesByBundlePath.set(bundle.bundlePath, entry);
  }

  return Array.from(overridesByBundlePath.values());
}

function offsetMeshMarkers(entry, baseOffset, markerTransform) {
  const data = Array.isArray(entry?.data) ? entry.data : null;
  if (!data) {
    throw new Error("The Luna mesh entry is missing its data payload.");
  }

  const transformMarker =
    typeof markerTransform === "function"
      ? markerTransform
      : (marker) => offsetByteRangeMarker(marker, baseOffset);

  if (isByteRangeMarker(data[6])) {
    data[6] = transformMarker(data[6], "vertices");
  } else {
    throw new Error("The Luna mesh entry is missing its vertex blob marker.");
  }

  const subMeshes = Array.isArray(data[7]) ? data[7] : [];
  for (const subMesh of subMeshes) {
    if (!Array.isArray(subMesh)) {
      continue;
    }
    for (let index = 0; index < subMesh.length; index += 1) {
      if (isByteRangeMarker(subMesh[index])) {
        subMesh[index] = transformMarker(subMesh[index], "sub-mesh");
      }
    }
  }

  const blendShapes = Array.isArray(data[9]) ? data[9] : [];
  for (const blendShape of blendShapes) {
    const frames = Array.isArray(blendShape) ? blendShape[1] : null;
    if (!Array.isArray(frames)) {
      continue;
    }
    for (const frame of frames) {
      if (!Array.isArray(frame)) {
        continue;
      }
      for (let index = 1; index <= 3; index += 1) {
        if (isByteRangeMarker(frame[index])) {
          frame[index] = transformMarker(frame[index], "blend-shape");
        }
      }
    }
  }
}

function offsetByteRangeMarker(marker, baseOffset) {
  if (!isByteRangeMarker(marker)) {
    throw new Error("A mesh blob marker is not a valid [offset, length] pair.");
  }

  return [Number(marker[0]) + baseOffset, Number(marker[1])];
}

function isByteRangeMarker(value) {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]))
  );
}

function ensureUint8Array(value) {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (isArrayBufferLike(value)) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return new Uint8Array(0);
}

function concatUint8Arrays(parts) {
  const normalizedParts = parts
    .map(ensureUint8Array)
    .filter((part) => part.byteLength > 0);
  const totalLength = normalizedParts.reduce((total, part) => total + part.byteLength, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of normalizedParts) {
    merged.set(part, offset);
    offset += part.byteLength;
  }

  return merged;
}

function injectMeshOverrideScript(html) {
  const patches = buildModifiedMeshBundles();
  if (!patches.length) {
    return html;
  }

  const cleanedHtml = html.replace(meshOverrideScriptPattern, "");
  const overrideScript = serializeMeshBundleOverrideScript(patches);

  if (cleanedHtml.includes("</body>")) {
    return cleanedHtml.replace("</body>", `${overrideScript}</body>`);
  }

  return `${cleanedHtml}${overrideScript}`;
}

function serializeMeshBundleOverrideScript(patches) {
  const payload = patches.map((patch) => ({
    bundleJsonPath: patch.bundleJsonPath,
    bundleBlobPath: patch.bundleBlobPath,
    replacements: patch.replacements.map((replacement) => ({
      meshId: replacement.meshId,
      entry: replacement.entry,
      blobBase64: arrayBufferToBase64(replacement.blobBytes),
    })),
  }));

  return `<script data-luna-mesh-overrides>!function(){const patches=${JSON.stringify(
    payload
  )};function base64ToBytes(value){const binary=window.atob(value);const bytes=new Uint8Array(binary.length);for(let index=0;index<binary.length;index+=1){bytes[index]=binary.charCodeAt(index)}return bytes}function ensureBytes(value){if(value instanceof Uint8Array)return value;if(value instanceof ArrayBuffer)return new Uint8Array(value);if(ArrayBuffer.isView(value))return new Uint8Array(value.buffer,value.byteOffset,value.byteLength);return new Uint8Array(0)}function concatBytes(parts){const buffers=parts.map(ensureBytes).filter(function(part){return part.byteLength>0});const total=buffers.reduce(function(size,part){return size+part.byteLength},0);const merged=new Uint8Array(total);let offset=0;for(const part of buffers){merged.set(part,offset);offset+=part.byteLength}return merged}function isMarker(value){return Array.isArray(value)&&2===value.length&&Number.isFinite(Number(value[0]))&&Number.isFinite(Number(value[1]))}function offsetMarker(marker,baseOffset){if(!isMarker(marker))throw new Error("A mesh blob marker is not a valid [offset, length] pair.");return[Number(marker[0])+baseOffset,Number(marker[1])]}function offsetMeshMarkers(entry,baseOffset){const data=Array.isArray(entry&&entry.data)?entry.data:null;if(!data)throw new Error("The Luna mesh entry is missing its data payload.");if(isMarker(data[6])){data[6]=offsetMarker(data[6],baseOffset)}else{throw new Error("The Luna mesh entry is missing its vertex blob marker.")}const subMeshes=Array.isArray(data[7])?data[7]:[];for(const subMesh of subMeshes){if(!Array.isArray(subMesh))continue;for(let index=0;index<subMesh.length;index+=1){if(isMarker(subMesh[index])){subMesh[index]=offsetMarker(subMesh[index],baseOffset)}}}const blendShapes=Array.isArray(data[9])?data[9]:[];for(const blendShape of blendShapes){const frames=Array.isArray(blendShape)?blendShape[1]:null;if(!Array.isArray(frames))continue;for(const frame of frames){if(!Array.isArray(frame))continue;for(let index=1;index<=3;index+=1){if(isMarker(frame[index])){frame[index]=offsetMarker(frame[index],baseOffset)}}}}}window.jsons=window.jsons||{};window.blobs=window.blobs||{};window._compressedAssets=window._compressedAssets||[];const priorAssets=window._compressedAssets.slice();const patchPromise=Promise.all(priorAssets).then(function(){for(const patch of patches){const bundleJson=window.jsons[patch.bundleJsonPath];const originalBlob=ensureBytes(window.blobs[patch.bundleBlobPath]);if(!bundleJson||!Array.isArray(bundleJson.meshes)||!originalBlob.byteLength)continue;const blobParts=[originalBlob];let appendOffset=originalBlob.byteLength;for(const replacement of patch.replacements){const meshIndex=bundleJson.meshes.findIndex(function(entry){return String((entry&&entry.id)||"")===replacement.meshId});if(meshIndex<0)continue;const targetEntry=bundleJson.meshes[meshIndex];const replacementEntry=replacement.entry;const payloadBytes=base64ToBytes(replacement.blobBase64);offsetMeshMarkers(replacementEntry,appendOffset);replacementEntry.id=targetEntry.id;replacementEntry.assetBundleId=targetEntry.assetBundleId;replacementEntry.path=targetEntry.path||replacementEntry.path;if(Array.isArray(targetEntry.data)&&Array.isArray(replacementEntry.data)&&"string"==typeof targetEntry.data[0]&&targetEntry.data[0]){replacementEntry.data[0]=targetEntry.data[0]}bundleJson.meshes[meshIndex]=replacementEntry;if(payloadBytes.byteLength){blobParts.push(payloadBytes);appendOffset+=payloadBytes.byteLength}}window.jsons[patch.bundleJsonPath]=bundleJson;window.blobs[patch.bundleBlobPath]=concatBytes(blobParts).buffer}});window._compressedAssets.push(patchPromise)}();</script>`;
}

function arrayBufferToBase64(value) {
  const bytes = ensureUint8Array(value);
  let binary = "";
  const chunkSize = 32768;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return window.btoa(binary);
}

function buildRebuiltMeshBundles() {
  const overrideEntries = Object.entries(state.meshOverrides || {});
  if (!overrideEntries.length) {
    return [];
  }

  const overridesByBundlePath = new Map();

  for (const [meshId, override] of overrideEntries) {
    const targetMesh = state.bundleInspection.meshesById?.[meshId];
    const bundle = targetMesh?.bundle;
    if (!targetMesh || !bundle) {
      throw new Error(`Mesh ${meshId} is no longer available for replacement.`);
    }
    if (!bundle.rawJson || !bundle.rawBlobBytes) {
      throw new Error(`Mesh ${meshId} belongs to a Luna bundle that was not fully decoded.`);
    }
    if (!override?.payload?.entry || !override?.payload?.blobBytes) {
      throw new Error(`Mesh ${meshId} does not have a usable donor payload yet.`);
    }

    const entry = overridesByBundlePath.get(bundle.bundlePath) || {
      bundle,
      replacementsByMeshId: new Map(),
    };
    entry.replacementsByMeshId.set(meshId, {
      entry: deepClone(override.payload.entry),
      blobBytes: ensureUint8Array(override.payload.blobBytes),
    });
    overridesByBundlePath.set(bundle.bundlePath, entry);
  }

  return Array.from(overridesByBundlePath.values()).map(({ bundle, replacementsByMeshId }) => {
    const originalMeshes = Array.isArray(bundle.rawJson?.meshes) ? bundle.rawJson.meshes : null;
    if (!originalMeshes) {
      throw new Error(`Luna bundle ${bundle.bundlePath} does not expose a readable mesh list.`);
    }

    const rebuiltBundleJson = deepClone(bundle.rawJson);
    const rebuiltMeshes = [];
    const blobParts = [];
    let nextOffset = 0;

    for (const originalMesh of originalMeshes) {
      const meshId = String(originalMesh?.id ?? "");
      const replacementPayload =
        replacementsByMeshId.get(meshId) ||
        createNormalizedMeshReplacementPayload(originalMesh, bundle.rawBlobBytes);
      const rebuiltEntry = deepClone(replacementPayload.entry);
      const rebuiltBytes = ensureUint8Array(replacementPayload.blobBytes);

      rebuiltEntry.id = originalMesh.id;
      rebuiltEntry.assetBundleId = originalMesh.assetBundleId;
      rebuiltEntry.path = originalMesh.path || rebuiltEntry.path;

      if (
        Array.isArray(originalMesh.data) &&
        Array.isArray(rebuiltEntry.data) &&
        typeof originalMesh.data[0] === "string" &&
        originalMesh.data[0]
      ) {
        rebuiltEntry.data[0] = originalMesh.data[0];
      }

      offsetMeshMarkers(rebuiltEntry, nextOffset);
      if (rebuiltBytes.byteLength) {
        blobParts.push(rebuiltBytes);
        nextOffset += rebuiltBytes.byteLength;
      }
      rebuiltMeshes.push(rebuiltEntry);
    }

    rebuiltBundleJson.meshes = rebuiltMeshes;

    return {
      bundleJsonPath: bundle.bundlePath,
      bundleBlobPath: bundle.dataBlobPath,
      bundleJson: rebuiltBundleJson,
      blobBytes: concatUint8Arrays(blobParts),
    };
  });
}

let bundledBrotliEncoderPromise = null;
const safeLunaJsonBrotliOptions = {
  quality: 3,
  lgwin: 19,
};
const safeLunaBlobBrotliOptions = {
  quality: 11,
  lgwin: 19,
};

async function loadBundledBrotliEncoder() {
  if (!bundledBrotliEncoderPromise) {
    bundledBrotliEncoderPromise = import("./vendor/brotli-wasm/index.web.js")
      .then((module) => module.default)
      .then((encoder) => {
        if (!encoder || typeof encoder.compress !== "function") {
          throw new Error("The bundled Brotli encoder did not expose a compress() function.");
        }
        return encoder;
      });
  }

  return bundledBrotliEncoderPromise;
}

async function brotliCompressBytes(value, options = safeLunaJsonBrotliOptions) {
  const encoder = await loadBundledBrotliEncoder();
  const compressedBytes = encoder.compress(
    ensureUint8Array(value),
    options
  );
  return ensureUint8Array(compressedBytes);
}

function uint8ArrayToBase122String(value) {
  const bytes = ensureUint8Array(value);
  let curIndex = 0;
  let curBit = 0;
  const utf8Bytes = [];

  function get7() {
    if (curIndex >= bytes.length) {
      return false;
    }

    const firstByte = bytes[curIndex];
    let firstPart = ((0b11111110 >>> curBit) & firstByte) << curBit;
    firstPart >>= 1;
    curBit += 7;

    if (curBit < 8) {
      return firstPart;
    }

    curBit -= 8;
    curIndex += 1;
    if (curIndex >= bytes.length) {
      return firstPart;
    }

    const secondByte = bytes[curIndex];
    let secondPart = ((0xff00 >>> curBit) & secondByte) & 0xff;
    secondPart >>= 8 - curBit;
    return firstPart | secondPart;
  }

  while (true) {
    const bits = get7();
    if (bits === false) {
      break;
    }

    const illegalIndex = base122IllegalCharacters.indexOf(bits);
    if (illegalIndex === -1) {
      utf8Bytes.push(bits);
      continue;
    }

    let nextBits = get7();
    let firstByte = 0b11000010;
    let secondByte = 0b10000000;

    if (nextBits === false) {
      firstByte |= (base122ShortenedMarker & 0b111) << 2;
      nextBits = bits;
    } else {
      firstByte |= (illegalIndex & 0b111) << 2;
    }

    firstByte |= (nextBits & 0b01000000) ? 1 : 0;
    secondByte |= nextBits & 0b00111111;
    utf8Bytes.push(firstByte, secondByte);
  }

  return new TextDecoder("utf-8").decode(new Uint8Array(utf8Bytes));
}

function serializeCompactJsStringLiteral(value) {
  let literal = '"';

  for (const char of String(value)) {
    const code = char.charCodeAt(0);

    if (char === '"') {
      literal += '\\"';
      continue;
    }
    if (char === "\\") {
      literal += "\\\\";
      continue;
    }
    if (char === "<") {
      literal += "\\x3C";
      continue;
    }
    if (code === 0x2028) {
      literal += "\\u2028";
      continue;
    }
    if (code === 0x2029) {
      literal += "\\u2029";
      continue;
    }
    if (code < 0x20 || code === 0x7f) {
      literal += `\\x${code.toString(16).padStart(2, "0").toUpperCase()}`;
      continue;
    }

    literal += char;
  }

  literal += '"';
  return literal;
}

async function encodeCompressedLunaAsset(value, compressionOptions) {
  const compressedBytes = await brotliCompressBytes(value, compressionOptions);
  const base122 = uint8ArrayToBase122String(compressedBytes);
  const base64 = arrayBufferToBase64(compressedBytes);
  const base122Literal = serializeCompactJsStringLiteral(base122);
  const base64Literal = JSON.stringify(base64);

  if (base122Literal.length <= base64Literal.length) {
    return {
      isBase122: true,
      payloadLiteral: base122Literal,
    };
  }

  return {
    isBase122: false,
    payloadLiteral: base64Literal,
  };
}

function buildCompressedBundleJsonLoader(path, payloadLiteral, isBase122) {
  const pathLiteral = JSON.stringify(path);
  return `decompressString(${payloadLiteral}, ${isBase122 ? "true" : "false"}).then(function(bundleJsonText){ window.jsons[${pathLiteral}] = JSON.parse(bundleJsonText); })`;
}

function buildCompressedBundleBlobLoader(path, payloadLiteral, isBase122) {
  const pathLiteral = JSON.stringify(path);
  return `decompressArrayBuffer(${payloadLiteral}, ${isBase122 ? "true" : "false"}).then(function(bundleBlob){ window.blobs[${pathLiteral}] = bundleBlob; })`;
}

function replaceCompressedAssetSpec(html, spec, replacement) {
  if (!spec?.matchText || !html.includes(spec.matchText)) {
    throw new Error(`Could not locate the embedded Luna asset block for ${spec?.path || "?"}.`);
  }

  return html.replace(spec.matchText, () => replacement);
}

async function rebuildMeshBundlesInHtml(html) {
  const rebuiltBundles = buildRebuiltMeshBundles();
  if (!rebuiltBundles.length) {
    return html.replace(meshOverrideScriptPattern, "");
  }

  const bundleJsonSpecsByPath = new Map(
    collectCompressedBundleJsonSpecs(html).map((spec) => [spec.path, spec])
  );
  const bundleBlobSpecsByPath = new Map(
    collectCompressedBundleBlobSpecs(html).map((spec) => [spec.path, spec])
  );
  const encodedBundles = await Promise.all(
    rebuiltBundles.map(async (bundle) => ({
      bundleJsonPath: bundle.bundleJsonPath,
      bundleBlobPath: bundle.bundleBlobPath,
      encodedJson: await encodeCompressedLunaAsset(
        new TextEncoder().encode(JSON.stringify(bundle.bundleJson)),
        safeLunaJsonBrotliOptions
      ),
      encodedBlob: await encodeCompressedLunaAsset(
        bundle.blobBytes,
        safeLunaBlobBrotliOptions
      ),
    }))
  );

  let rebuiltHtml = html.replace(meshOverrideScriptPattern, "");

  for (const bundle of encodedBundles) {
    const bundleJsonSpec = bundleJsonSpecsByPath.get(bundle.bundleJsonPath);
    const bundleBlobSpec = bundleBlobSpecsByPath.get(bundle.bundleBlobPath);
    if (!bundleJsonSpec) {
      throw new Error(`Could not find ${bundle.bundleJsonPath} in the export HTML.`);
    }
    if (!bundleBlobSpec) {
      throw new Error(`Could not find ${bundle.bundleBlobPath} in the export HTML.`);
    }

    rebuiltHtml = replaceCompressedAssetSpec(
      rebuiltHtml,
      bundleJsonSpec,
      buildCompressedBundleJsonLoader(
        bundle.bundleJsonPath,
        bundle.encodedJson.payloadLiteral,
        bundle.encodedJson.isBase122
      )
    );
    rebuiltHtml = replaceCompressedAssetSpec(
      rebuiltHtml,
      bundleBlobSpec,
      buildCompressedBundleBlobLoader(
        bundle.bundleBlobPath,
        bundle.encodedBlob.payloadLiteral,
        bundle.encodedBlob.isBase122
      )
    );
  }

  return rebuiltHtml;
}

function buildBasePatchedHtml() {
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
  html = patchEmbeddedAssetSources(html);
  return html;
}

function buildPatchedHtml() {
  let html = buildBasePatchedHtml();
  if (!html) {
    return "";
  }

  html = injectMeshOverrideScript(html);
  return html;
}

async function buildDownloadHtml() {
  const html = buildBasePatchedHtml();
  if (!html) {
    return {
      html: "",
      mode: "base",
    };
  }

  if (!Object.keys(state.meshOverrides || {}).length) {
    return {
      html,
      mode: "base",
    };
  }

  try {
    const rebuiltHtml = await rebuildMeshBundlesInHtml(html);
    assertReasonableExportSize(rebuiltHtml, state.originalHtml);
    return {
      html: rebuiltHtml,
      mode: "embedded-rebuild",
    };
  } catch (error) {
    console.warn("Falling back to runtime mesh patch export.", error);
    return {
      html: injectMeshOverrideScript(html),
      mode: "runtime-patch",
      fallbackReason: describeMeshExportFallbackReason(error),
    };
  }
}

function buildDownloadExports(baseHtml, selectedTargets) {
  const targets = selectedTargets?.length ? selectedTargets : getSelectedDownloadTargets();

  if (!targets.length) {
    throw new Error("Pick at least one download target before exporting.");
  }

  return targets.map((network) => ({
    network,
    label: getDownloadTargetLabel(network),
    filename: getDownloadName(state.filename, network),
    html: buildNetworkVariantHtml(baseHtml, network),
  }));
}

function buildNetworkVariantHtml(html, network) {
  let nextHtml = patchTargetPlatform(html, network);
  nextHtml = patchPiApplyScript(nextHtml, network);
  nextHtml = removeOptionalScriptBlock(nextHtml, piInjectAdDataScriptMatcher);
  nextHtml = removeOptionalScriptBlock(nextHtml, piLogEventPatchScriptMatcher);

  if (network === "applovin") {
    nextHtml = removeOptionalScriptBlock(nextHtml, appLovinAnalyticsScriptMatcher);
    nextHtml = upsertScriptBeforeBody(
      nextHtml,
      buildAppLovinAnalyticsScript(),
      appLovinAnalyticsScriptMatcher
    );
    return nextHtml;
  }

  nextHtml = removeOptionalScriptBlock(nextHtml, appLovinAnalyticsScriptMatcher);
  nextHtml = upsertScriptBeforeAnchor(
    nextHtml,
    buildPiInjectAdDataScript(network),
    piInjectAdDataScriptMatcher
  );
  nextHtml = upsertScriptBeforeAnchor(
    nextHtml,
    buildPiLogEventPatchScript(),
    piLogEventPatchScriptMatcher
  );

  return nextHtml;
}

function patchTargetPlatform(html, network) {
  return replaceOnce(html, targetPlatformPattern, `targetPlatform:${JSON.stringify(network)}`);
}

function patchPiApplyScript(html, network) {
  const piApplyScript = findScriptBlock(html, piApplyScriptBlockMatcher);

  if (!piApplyScript) {
    throw new Error(
      "The Playable Insights bootstrap could not be found while building the network variant."
    );
  }

  const settings = buildPiSettings(piApplyScript, network);
  const script = buildInlineScript(
    `window.pi.apply(window,${JSON.stringify(settings)}||[]);`,
    "pi-apply"
  );

  return replaceScriptBlock(
    html,
    piApplyScriptBlockMatcher,
    script,
    "The Playable Insights bootstrap could not be found while building the network variant."
  );
}

function buildPiSettings(piApplyScript, network) {
  const settingsLiteral = piApplyScript.match(piApplySettingsPattern)?.[1];

  if (!settingsLiteral) {
    return [network];
  }

  try {
    const parsed = JSON.parse(settingsLiteral);
    if (!Array.isArray(parsed) || !parsed.length) {
      return [network];
    }

    parsed[0] = network;
    return parsed;
  } catch (error) {
    console.warn("Could not preserve Playable Insights settings, falling back to ad-network only.", error);
    return [network];
  }
}

function buildPiInjectAdDataScript(network) {
  const body =
    network === "ironsource"
      ? `window.pi.injectAdData=function(){if(this.env.impressionId)return;try{const adData=\"undefined\"!=typeof window.mraid&&window.mraid&&window.mraid.getMraidAdData?window.mraid.getMraidAdData():window.dapi&&\"function\"==typeof window.dapi.getAdData?window.dapi.getAdData():null;if(!adData)return;this.env.impressionId=adData.UII;this.env.creativeId=adData.creativeId||\"\";this.env.campaignId=adData.campaignId||\"\";\"RewardedVideo\"===adData.productType?this.env.isRewarded=1:\"Interstitial\"===adData.productType&&(this.env.isRewarded=0)}catch(error){console.warn(\"Playable Insights ad data injection skipped.\",error)}};`
      : `window.pi.injectAdData=function(){if(this.env.impressionId)return;try{const adData=\"undefined\"!=typeof window.mraid&&window.mraid&&window.mraid.getMraidAdData?window.mraid.getMraidAdData():window.dapi&&\"function\"==typeof window.dapi.getAdData?window.dapi.getAdData():null;if(!adData)return;this.env.impressionId=adData.UII;this.env.creativeId=adData.creativeId||\"\";this.env.campaignId=adData.campaignId||\"\"}catch(error){console.warn(\"Playable Insights ad data injection skipped.\",error)}};`;

  return buildInlineScript(body, "pi-inject-ad-data");
}

function buildPiLogEventPatchScript() {
  return buildInlineScript(
    `window.pi.originalLogEvent=window.pi.logEvent,window.pi.logEvent=function(eventName,resetTimestamp,options){return\"function\"==typeof this.injectAdData&&this.injectAdData(),this.originalLogEvent(eventName,resetTimestamp,options)};`,
    "pi-log-event"
  );
}

function buildAppLovinAnalyticsScript() {
  return buildInlineScript(
    `!function(){let width=window.innerWidth,height=window.innerHeight;window.addEventListener("resize",function(){width=window.innerWidth,height=window.innerHeight}),setInterval(function(){(width!==window.innerWidth||height!==window.innerHeight)&&(window.dispatchEvent(new Event("resize")),width=window.innerWidth,height=window.innerHeight)},300),window.APPLOVIN_ANALYTICS_EVENTS={LOADING:"LOADING",LOADED:"LOADED",DISPLAYED:"DISPLAYED",CTA_CLICKED:"CTA_CLICKED",ENDCARD_SHOWN:"ENDCARD_SHOWN",CHALLENGE_STARTED:"CHALLENGE_STARTED",CHALLENGE_FAILED:"CHALLENGE_FAILED",CHALLENGE_RETRY:"CHALLENGE_RETRY",CHALLENGE_PASS_25:"CHALLENGE_PASS_25",CHALLENGE_PASS_50:"CHALLENGE_PASS_50",CHALLENGE_PASS_75:"CHALLENGE_PASS_75",CHALLENGE_SOLVED:"CHALLENGE_SOLVED"},window.callAnalyticsEvent=function(eventName){void 0!==window.ALPlayableAnalytics&&window.ALPlayableAnalytics&&window.ALPlayableAnalytics.trackEvent&&window.ALPlayableAnalytics.trackEvent(eventName)},window.addEventListener("luna:start",function(){window.callAnalyticsEvent(window.APPLOVIN_ANALYTICS_EVENTS.LOADING)}),window.addEventListener("luna:started",function(){window.callAnalyticsEvent(window.APPLOVIN_ANALYTICS_EVENTS.LOADED)}),window.addEventListener("luna:postrender",function(){window.callAnalyticsEvent(window.APPLOVIN_ANALYTICS_EVENTS.DISPLAYED)}),window.addEventListener("luna:starting",function(){"function"==typeof window.audioVolumeToggle&&window.audioVolumeToggle(!0)}),window.addEventListener("luna:started",function(){const handleFirstInteraction=function(){document.body.removeEventListener("mousemove",handleFirstInteraction),document.body.removeEventListener("scroll",handleFirstInteraction),document.body.removeEventListener("keydown",handleFirstInteraction),document.body.removeEventListener("click",handleFirstInteraction),document.body.removeEventListener("touchstart",handleFirstInteraction),document.body.removeEventListener("pointerdown",handleFirstInteraction),window.dispatchEvent(new Event("luna:unsafe:unmute"))};document.body.addEventListener("mousemove",handleFirstInteraction),document.body.addEventListener("scroll",handleFirstInteraction),document.body.addEventListener("keydown",handleFirstInteraction),document.body.addEventListener("click",handleFirstInteraction),document.body.addEventListener("touchstart",handleFirstInteraction),document.body.addEventListener("pointerdown",handleFirstInteraction)}),window.addEventListener("luna:ended",function(){window.callAnalyticsEvent(window.APPLOVIN_ANALYTICS_EVENTS.ENDCARD_SHOWN)}),window.addEventListener("luna:build",function(){Bridge.ready(function(){Luna.Unity.Analytics.Applovin=Luna.Unity.Analytics.Applovin||{},Luna.Unity.Analytics.Applovin.LogChallengeStarted=function(){window.callAnalyticsEvent(window.APPLOVIN_ANALYTICS_EVENTS.CHALLENGE_STARTED)},Luna.Unity.Analytics.Applovin.LogChallengeFailed=function(){window.callAnalyticsEvent(window.APPLOVIN_ANALYTICS_EVENTS.CHALLENGE_FAILED)},Luna.Unity.Analytics.Applovin.LogChallengeRetry=function(){window.callAnalyticsEvent(window.APPLOVIN_ANALYTICS_EVENTS.CHALLENGE_RETRY)},Luna.Unity.Analytics.Applovin.LogChallengePass25=function(){window.callAnalyticsEvent(window.APPLOVIN_ANALYTICS_EVENTS.CHALLENGE_PASS_25)},Luna.Unity.Analytics.Applovin.LogChallengePass50=function(){window.callAnalyticsEvent(window.APPLOVIN_ANALYTICS_EVENTS.CHALLENGE_PASS_50)},Luna.Unity.Analytics.Applovin.LogChallengePass75=function(){window.callAnalyticsEvent(window.APPLOVIN_ANALYTICS_EVENTS.CHALLENGE_PASS_75)},Luna.Unity.Analytics.Applovin.LogChallengeSolved=function(){window.callAnalyticsEvent(window.APPLOVIN_ANALYTICS_EVENTS.CHALLENGE_SOLVED)},Luna.Unity.Playable.InstallFullGame=function(iosLink,androidLink){window.callAnalyticsEvent(window.APPLOVIN_ANALYTICS_EVENTS.CTA_CLICKED),window.pi&&window.pi.logCta&&window.pi.logCta(),iosLink=iosLink||window.$environment.packageConfig.iosLink,androidLink=androidLink||window.$environment.packageConfig.androidLink;const storeLink=/iphone|ipad|ipod|macintosh/i.test(window.navigator.userAgent.toLowerCase())?iosLink:androidLink;"undefined"!=typeof mraid?mraid.open(storeLink):(console.warn("Mraid is not defined"),window.open(storeLink,"_blank"))}})})}();`,
    "applovin-analytics"
  );
}

function buildInlineScript(content, marker) {
  const markerAttribute = marker
    ? ` data-luna-network-patch="${escapeAttribute(marker)}"`
    : "";
  return `<script${markerAttribute}>${content}</script>`;
}

function removeOptionalScriptBlock(source, matcher) {
  return source.replace(scriptBlockPattern, (block) =>
    matchesScriptBlock(block, matcher) ? "" : block
  );
}

function upsertScriptBeforeAnchor(source, scriptMarkup, existingMatcher) {
  const withoutExisting = removeOptionalScriptBlock(source, existingMatcher);
  let inserted = false;
  const nextHtml = withoutExisting.replace(scriptBlockPattern, (block) => {
    if (!inserted && matchesScriptBlock(block, installFullGameScriptMatcher)) {
      inserted = true;
      return `${scriptMarkup}${block}`;
    }
    return block;
  });

  return inserted ? nextHtml : upsertScriptBeforeBody(withoutExisting, scriptMarkup);
}

function upsertScriptBeforeBody(source, scriptMarkup, existingMatcher) {
  const withoutExisting = existingMatcher
    ? removeOptionalScriptBlock(source, existingMatcher)
    : source;

  if (withoutExisting.includes("</body>")) {
    return withoutExisting.replace("</body>", `${scriptMarkup}</body>`);
  }

  return `${withoutExisting}${scriptMarkup}`;
}

function matchesScriptBlock(block, matcher) {
  if (!matcher) {
    return false;
  }

  matcher.lastIndex = 0;
  return matcher.test(block);
}

function findScriptBlock(source, matcher) {
  const blocks = source.match(scriptBlockPattern) || [];
  for (const block of blocks) {
    if (matchesScriptBlock(block, matcher)) {
      return block;
    }
  }
  return "";
}

function replaceScriptBlock(source, matcher, replacement, errorMessage) {
  let replaced = false;
  const nextHtml = source.replace(scriptBlockPattern, (block) => {
    if (!replaced && matchesScriptBlock(block, matcher)) {
      replaced = true;
      return replacement;
    }
    return block;
  });

  if (!replaced) {
    throw new Error(
      errorMessage || "A required Luna script block could not be found while rebuilding the file."
    );
  }

  return nextHtml;
}

function downloadHtmlFile(filename, html) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function buildDownloadStatusMessage(downloadItems, exportResult) {
  const labels = formatNetworkLabelList(downloadItems.map((item) => item.label));
  const downloadMessage =
    downloadItems.length === 1
      ? `Downloaded the edited ${labels} HTML.`
      : `Started downloads for ${labels}. Your browser may ask to allow multiple downloads.`;

  if (exportResult.mode === "embedded-rebuild") {
    return `${downloadMessage} Mesh bundles were rebuilt in-place.`;
  }

  if (exportResult.mode === "runtime-patch") {
    return `${downloadMessage} Runtime mesh patch fallback was used. ${exportResult.fallbackReason}`;
  }

  return downloadMessage;
}

function formatNetworkLabelList(labels) {
  if (!labels.length) {
    return "HTML";
  }
  if (labels.length === 1) {
    return labels[0];
  }
  if (labels.length === 2) {
    return `${labels[0]} and ${labels[1]}`;
  }
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function describeMeshExportFallbackReason(error) {
  const message = getErrorMessage(error);

  if (message.includes('CompressionStream("brotli")')) {
    return 'The browser did not accept `new CompressionStream("brotli")`, even though HTTP Brotli decoding may still work here.';
  }
  if (message.includes("bundled Brotli encoder")) {
    return `The local Brotli WASM fallback failed: ${message}`;
  }
  if (message.includes("brotli_wasm_bg.wasm")) {
    return `The local Brotli WASM asset could not be loaded: ${message}`;
  }

  return `The compact rebuild failed: ${message}`;
}

function assertReasonableExportSize(nextHtml, originalHtml) {
  const nextLength = String(nextHtml || "").length;
  const originalLength = String(originalHtml || "").length;
  const absoluteLimit = 20 * 1024 * 1024;
  const relativeLimit = originalLength > 0 ? originalLength * 4 : 0;

  if (
    nextLength > absoluteLimit &&
    relativeLimit > 0 &&
    nextLength > relativeLimit
  ) {
    throw new Error(
      `Compact rebuild produced an unexpectedly large HTML export (${formatBytes(
        nextLength
      )} vs ${formatBytes(originalLength)} original).`
    );
  }
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

function patchEmbeddedAssetSources(html) {
  if (!state.model || !state.originalModel) {
    return html;
  }

  for (const [assetId, replacement] of Object.entries(
    state.model.playgroundAssetOverrides
  )) {
    const linkedAssets = state.embeddedAssetLinks[assetId];
    const originalValue = state.originalModel.playgroundAssetOverrides?.[assetId];

    if (
      !linkedAssets?.length ||
      JSON.stringify(replacement) === JSON.stringify(originalValue) ||
      typeof replacement !== "string" ||
      !replacement
    ) {
      continue;
    }

    for (const assetReference of linkedAssets) {
      html = replaceEmbeddedAssetSource(html, assetReference, replacement);
    }
  }

  return html;
}

function replaceEmbeddedAssetSource(html, assetReference, replacementUrl) {
  if (assetReference.kind === "compressed-sound") {
    return replaceCompressedSoundSource(html, assetReference.id, replacementUrl);
  }

  const pattern = new RegExp(
    `<(?:img|video|audio|source)\\b[^>]*\\bid="${escapeRegExp(
      assetReference.id
    )}"[^>]*>`,
    "i"
  );

  if (!pattern.test(html)) {
    return html;
  }

  pattern.lastIndex = 0;
  return html.replace(pattern, (tag) =>
    buildReplacementAssetTag(tag, replacementUrl)
  );
}

function replaceCompressedSoundSource(html, embeddedAssetId, replacementUrl) {
  const pattern =
    /window\._compressedAssets\.push\(\s*decompressArrayBuffer\([\s\S]*?\)\.then\(\s*function\s*\(\s*sound\s*\)\s*\{\s*window\.sounds\[\s*"([^"]+)"\s*\]\s*=\s*sound\s*;?\s*\}\s*\)\s*\)\s*;?/g;

  let didReplace = false;
  const patchedHtml = html.replace(pattern, (match, assetId) => {
    if (assetId !== embeddedAssetId) {
      return match;
    }

    didReplace = true;
    return `${buildReplacementSoundLoader(assetId, replacementUrl)};`;
  });

  return didReplace ? patchedHtml : html;
}

function buildReplacementSoundLoader(embeddedAssetId, replacementUrl) {
  const replacementLiteral = JSON.stringify(replacementUrl);
  const assetLiteral = JSON.stringify(embeddedAssetId);
  return `window._compressedAssets.push(fetch(${replacementLiteral}).then(function(response){ if("ok" in response && !response.ok) throw new Error("Failed to load replacement asset: "+response.status); return response.arrayBuffer(); }).then(function(sound){ window.sounds[${assetLiteral}] = sound; }))`;
}

function buildReplacementAssetTag(originalTag, replacementUrl) {
  const template = document.createElement("template");
  template.innerHTML = originalTag.trim();
  const element = template.content.firstElementChild;

  if (!element) {
    return originalTag;
  }

  element.removeAttribute("data-src122");
  element.removeAttribute("data-src");
  element.removeAttribute("data-mime");
  element.setAttribute("src", replacementUrl);
  return element.outerHTML;
}

function replaceOnce(source, pattern, replacement) {
  if (!pattern.test(source)) {
    throw new Error("A required Luna block could not be found while rebuilding the file.");
  }
  pattern.lastIndex = 0;
  return source.replace(pattern, replacement);
}

function collectEmbeddedAssetLinks(html) {
  const links = {};
  collectTaggedEmbeddedAssetLinks(html, links);
  collectCompressedSoundLinks(html, links);

  return links;
}

function collectTaggedEmbeddedAssetLinks(html, links) {
  const pattern =
    /<(img|video|audio|source)\b[^>]*\bid="(assets\/[^"]*\/(\d+)\.[^"]+)"[^>]*>/g;

  let match;
  while ((match = pattern.exec(html))) {
    const tagName = match[1].toLowerCase();
    const fullAssetId = match[2];
    const assetId = match[3];
    addEmbeddedAssetLink(links, assetId, {
      id: fullAssetId,
      kind: "tag",
      mediaType: tagName === "source" ? inferMediaTypeFromValue(fullAssetId) : tagName,
    });
  }
}

function collectCompressedSoundLinks(html, links) {
  const pattern =
    /window\.sounds\[\s*"(assets\/bundles\/[^"]*\/(\d+)\.(?:mp3|wav|ogg|m4a|aac|weba|webm))"\s*\]\s*=\s*sound/g;

  let match;
  while ((match = pattern.exec(html))) {
    addEmbeddedAssetLink(links, match[2], {
      id: match[1],
      kind: "compressed-sound",
      mediaType: "audio",
    });
  }
}

function addEmbeddedAssetLink(links, assetId, reference) {
  links[assetId] ||= [];
  if (
    !links[assetId].some(
      (existing) => existing.id === reference.id && existing.kind === reference.kind
    )
  ) {
    links[assetId].push(reference);
  }
}

function getEditableAssetEntries() {
  if (!state.model) {
    return [];
  }

  const assetIds = new Set(Object.keys(state.model.playgroundAssetOverrides));

  for (const [assetId, references] of Object.entries(state.embeddedAssetLinks)) {
    if (shouldExposeDiscoveredAsset(references)) {
      assetIds.add(assetId);
    }
  }

  return Array.from(assetIds)
    .sort(compareAssetIds)
    .map((assetId) => {
      const references = state.embeddedAssetLinks[assetId] || [];
      const value = state.model.playgroundAssetOverrides[assetId] ?? "";
      return {
        assetId,
        value,
        mediaType: inferAssetMediaType(value, references),
        references,
      };
    });
}

function shouldExposeDiscoveredAsset(references) {
  return references.some(
    (reference) => reference.kind === "compressed-sound" || reference.mediaType !== "img"
  );
}

function getAssetPreviewValue(entry) {
  return entry.value || state.assetPreviewSources[entry.assetId]?.url || "";
}

function compareAssetIds(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) {
    return leftNumber - rightNumber;
  }
  return String(left).localeCompare(String(right), undefined, { numeric: true });
}

function inferAssetMediaType(value, references) {
  if (references.some((reference) => reference.mediaType === "audio")) {
    return "audio";
  }
  if (references.some((reference) => reference.mediaType === "video")) {
    return "video";
  }
  if (references.some((reference) => reference.mediaType === "img")) {
    return "image";
  }

  return inferMediaTypeFromValue(value);
}

function inferMediaTypeFromValue(value) {
  if (looksLikeAudioSource(value)) {
    return "audio";
  }
  if (looksLikeVideoSource(value)) {
    return "video";
  }
  if (looksLikeImageSource(value)) {
    return "image";
  }
  return "asset";
}

function describeAssetLinkSummary(references) {
  if (!references.length) {
    return "No embedded Luna bundle source was found in this export, so only override metadata will change.";
  }

  const kinds = new Set(references.map((reference) => reference.kind));
  const sourceKind = kinds.has("compressed-sound")
    ? "inline compressed audio bundle"
    : "embedded bundle asset";

  return `Patches ${references.length} ${sourceKind}${references.length === 1 ? "" : "s"} in this export.`;
}

function setAssetOverrideValue(assetId, value) {
  const originalOverrides = state.originalModel?.playgroundAssetOverrides || {};
  const hasOriginal = Object.prototype.hasOwnProperty.call(originalOverrides, assetId);

  if (!value) {
    if (hasOriginal) {
      state.model.playgroundAssetOverrides[assetId] = originalOverrides[assetId];
    } else {
      delete state.model.playgroundAssetOverrides[assetId];
    }
    return;
  }

  state.model.playgroundAssetOverrides[assetId] = value;
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
  if (Object.keys(state.meshOverrides || {}).length) {
    changes += Object.keys(state.meshOverrides).length;
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

function getDownloadName(filename, network) {
  if (!filename) {
    return network ? `luna-${network}-edited.html` : "luna-edited.html";
  }

  const withoutExtension = filename.replace(/\.html$/i, "");
  const normalizedBase = withoutExtension
    .replace(/-edited$/i, "")
    .replace(/(?:_|-)(applovin|ironsource|unityads)$/i, "");

  if (network) {
    return `${normalizedBase}_${network}-edited.html`;
  }

  return `${normalizedBase}-edited.html`;
}

function renderAssetPreview(src, alt, mediaType = "asset") {
  if (!src) {
    return `<div class="asset-preview__fallback">${escapeHtml(
      mediaType === "asset" ? "No preview" : mediaType
    )}</div>`;
  }

  const resolvedMediaType =
    mediaType === "image" || mediaType === "video" || mediaType === "audio"
      ? mediaType
      : inferMediaTypeFromValue(src);

  if (resolvedMediaType === "image" || looksLikeImageSource(src)) {
    return `
      <img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" />
      <div class="field-summary">${escapeHtml(shorten(src, 48))}</div>
    `;
  }

  if (resolvedMediaType === "video" || looksLikeVideoSource(src)) {
    return `
      <video src="${escapeAttribute(src)}" controls muted playsinline preload="metadata"></video>
      <div class="field-summary">${escapeHtml(shorten(src, 48))}</div>
    `;
  }

  if (resolvedMediaType === "audio" || looksLikeAudioSource(src)) {
    return `
      <audio src="${escapeAttribute(src)}" controls preload="metadata"></audio>
      <div class="field-summary">${escapeHtml(shorten(src, 48))}</div>
    `;
  }

  return `<div class="asset-preview__fallback">URL</div><div class="field-summary">${escapeHtml(
    shorten(src, 48)
  )}</div>`;
}

function renderImagePreview(src, alt) {
  return renderAssetPreview(src, alt, "image");
}

function looksLikeImageSource(value) {
  if (!value) {
    return false;
  }

  const lower = value.toLowerCase();
  return (
    lower.startsWith("data:image/") ||
    /\.(png|jpe?g|gif|webp|svg)(\?|$)/.test(lower)
  );
}

function looksLikeVideoSource(value) {
  if (!value) {
    return false;
  }

  const lower = value.toLowerCase();
  return (
    lower.startsWith("data:video/") ||
    /\.(mp4|webm|ogv|mov|m4v)(\?|$)/.test(lower)
  );
}

function looksLikeAudioSource(value) {
  if (!value) {
    return false;
  }

  const lower = value.toLowerCase();
  return (
    lower.startsWith("data:audio/") ||
    /\.(mp3|wav|ogg|m4a|aac|weba)(\?|$)/.test(lower)
  );
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

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
