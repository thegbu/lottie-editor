let animData, anim;
let originalAnimData;
let allExtractedColors = [];
let groupedColors = {};

let historyStack = [];
let redoStack = [];
const MAX_HISTORY = 20;

const slider = document.getElementById("frameSlider");
const frameLabel = document.getElementById("frameLabel");
const groupCheckbox = document.getElementById("groupDuplicates");
const exportBtn = document.getElementById("exportBtn");
const playPauseBtn = document.getElementById("playPauseBtn");
const colorList = document.getElementById("colors");

let currentFilter = "All";

let playerState = {
  isPaused: true,
  currentFrame: 0.0,
};

const fileInput = document.getElementById("fileInput");
const customFileInputLabel = document.getElementById("customFileInputLabel");

fileInput.addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) {
    customFileInputLabel.textContent = "Choose File... (No file selected)";
    return;
  }

  try {
    customFileInputLabel.textContent = file.name;
    let text;

    if (file.name.toLowerCase().endsWith(".tgs")) {
      const buffer = await file.arrayBuffer();
      const decompressed = pako.ungzip(new Uint8Array(buffer), {
        to: "string",
      });
      text = decompressed;
    } else {
      text = await file.text();
    }

    originalAnimData = JSON.parse(text);
    animData = JSON.parse(text);

    historyStack = [];
    redoStack = [];
    saveState();

    exportBtn.disabled = false;

    playPauseBtn.textContent = "Play";
    playerState.isPaused = true;

    initializeColorEditor(animData);
    reloadAnim();
  } catch (error) {
    console.error("Error loading or parsing animation file:", error);
    customFileInputLabel.textContent = `Error: Invalid Lottie/TGS file. (${error.message})`;
    alert(
      `An error occurred while loading the file. Error detail: ${error.message}`
    );
  }
});

function saveState() {
  if (!animData) return;

  const newState = JSON.parse(JSON.stringify(animData));

  if (historyStack.length > 0) {
    const lastState = historyStack[historyStack.length - 1];
    if (JSON.stringify(newState) === JSON.stringify(lastState)) {
      return;
    }
  }

  historyStack.push(newState);

  if (historyStack.length > MAX_HISTORY) {
    historyStack.shift();
  }

  redoStack = [];
}

function applyCurrentFilter() {
  const activeButton = document.querySelector(
    `[data-filter="${currentFilter}"]`
  );
  filterAndRender(currentFilter, activeButton);
}

function undoChange() {
  if (historyStack.length <= 1) return;

  redoStack.push(historyStack.pop());

  animData = JSON.parse(JSON.stringify(historyStack[historyStack.length - 1]));

  allExtractedColors = extractColors(animData);
  reloadAnim();
  applyCurrentFilter();
}

function redoChange() {
  if (redoStack.length === 0) return;

  const redoState = redoStack.pop();

  historyStack.push(JSON.parse(JSON.stringify(animData)));

  animData = redoState;

  allExtractedColors = extractColors(animData);
  reloadAnim();
  applyCurrentFilter();
}

document.addEventListener("keydown", (e) => {
  const isCtrlCmd = e.ctrlKey || e.metaKey;

  if (isCtrlCmd && e.code === "KeyZ") {
    e.preventDefault();

    if (e.shiftKey) {
      redoChange();
    } else {
      undoChange();
    }
  }
});

exportBtn.onclick = exportFile;

playPauseBtn.onclick = () => {
  if (!anim) return;

  if (anim.isPaused) {
    anim.play();
    playPauseBtn.textContent = "Pause";
    playerState.isPaused = false;
  } else {
    anim.pause();
    playPauseBtn.textContent = "Play";
    playerState.isPaused = true;
  }
};

function exportFile() {
  if (!originalAnimData) {
    alert("Please load a Lottie or TGS file first.");
    return;
  }

  const modal = document.getElementById("export-modal");
  const closeModalBtn = document.querySelector(".modal-close");
  const exportJsonBtn = document.getElementById("export-as-json");
  const exportTgsBtn = document.getElementById("export-as-tgs");

  modal.style.display = "flex";
  setTimeout(() => modal.classList.add("show"), 10);

  const closeModal = () => {
    modal.classList.remove("show");
    setTimeout(() => (modal.style.display = "none"), 300);
  };

  const handleExport = (format) => {
    closeModal();
    createAndDownloadFile(format);
  };

  exportJsonBtn.onclick = () => handleExport("json");
  exportTgsBtn.onclick = () => handleExport("tgs");
  closeModalBtn.onclick = closeModal;
  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };
}

function createAndDownloadFile(exportFormat) {
  const finalExportData = JSON.parse(JSON.stringify(originalAnimData));

  let filename = "lottie-edited";
  let mimeType = "application/json";
  let fileExtension = "json";

  if (exportFormat && exportFormat.toLowerCase() === "tgs") {
    fileExtension = "tgs";
    mimeType = "application/x-tgs";
  }

  function deepTraverseAndCopyColors(sourceObj, targetObj) {
    if (
      !sourceObj ||
      typeof sourceObj !== "object" ||
      !targetObj ||
      typeof targetObj !== "object"
    ) {
      return;
    }

    if (Array.isArray(sourceObj)) {
      for (let i = 0; i < sourceObj.length; i++) {
        if (targetObj[i]) {
          deepTraverseAndCopyColors(sourceObj[i], targetObj[i]);
        }
      }
    } else {
      for (const key in sourceObj) {
        if (!sourceObj.hasOwnProperty(key)) continue;

        if (key === "c" || key === "sc") {
          if (sourceObj[key] && sourceObj[key].k) {
            if (targetObj[key] && targetObj[key].k) {
              if (Array.isArray(sourceObj[key].k)) {
                targetObj[key].k = sourceObj[key].k;
              }
            }
          }
        } else if (key === "g") {
          if (sourceObj[key] && Array.isArray(sourceObj[key].k)) {
            if (targetObj[key] && Array.isArray(targetObj[key].k)) {
              targetObj[key].k = sourceObj[key].k;
            }
          } else if (
            sourceObj[key] &&
            sourceObj[key].k &&
            Array.isArray(sourceObj[key].k.k)
          ) {
            if (
              targetObj[key] &&
              targetObj[key].k &&
              Array.isArray(targetObj[key].k.k)
            ) {
              targetObj[key].k.k = sourceObj[key].k.k;
            }
          }
        } else if (
          typeof sourceObj[key] === "object" &&
          sourceObj[key] !== null
        ) {
          deepTraverseAndCopyColors(sourceObj[key], targetObj[key]);
        }
      }
    }
  }

  deepTraverseAndCopyColors(animData, finalExportData);

  let fileContent;
  if (fileExtension === "tgs") {
    const jsonString = JSON.stringify(finalExportData);
    const compressed = pako.gzip(jsonString);
    fileContent = compressed;
    filename += ".tgs";
  } else {
    fileContent = JSON.stringify(finalExportData);
    filename += ".json";
  }

  const blob = new Blob([fileContent], { type: mimeType });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function initializeColorEditor(data) {
  allExtractedColors = extractColors(data);

  document.querySelectorAll(".filter-btn").forEach((button) => {
    button.onclick = (e) => {
      currentFilter = e.target.dataset.filter;
      filterAndRender(currentFilter, e.target);
    };
  });

  groupCheckbox.onchange = () => {
    filterAndRender(
      currentFilter,
      document.querySelector(`[data-filter="${currentFilter}"]`)
    );
  };

  if (currentFilter === "All") {
    filterAndRender("All", document.querySelector('[data-filter="All"]'));
  } else {
    applyCurrentFilter();
  }
}

function filterAndRender(filterType, activeButton) {
  let colorsToRender = [];
  const isGrouped = groupCheckbox.checked;

  const isFill = (shapeType) => shapeType === "fill";
  const isStroke = (shapeType) =>
    shapeType === "stroke" || shapeType === "stroke (unknown)";
  const isGradientFill = (shapeType) => shapeType === "gradient fill";
  const isGradientStroke = (shapeType) => shapeType === "gradient stroke";

  const filterCondition = (c) => {
    if (filterType === "All") return true;

    if (filterType === "Fill") {
      return isFill(c.shapeType);
    }

    if (filterType === "Stroke") {
      return isStroke(c.shapeType);
    }

    if (filterType.toLowerCase() === "gradient") {
      return isGradientFill(c.shapeType) || isGradientStroke(c.shapeType);
    }

    if (filterType === "Gradient Fill") return isGradientFill(c.shapeType);
    if (filterType === "Gradient Stroke") return isGradientStroke(c.shapeType);

    return c.shapeType.toLowerCase().includes(filterType.toLowerCase());
  };

  if (isGrouped) {
    colorsToRender = Object.values(groupedColors).filter((g) => {
      return g.instances.some(filterCondition);
    });
  } else {
    colorsToRender = allExtractedColors.filter(filterCondition);
  }

  document
    .querySelectorAll(".filter-btn")
    .forEach((btn) => btn.classList.remove("active"));
  if (activeButton) {
    activeButton.classList.add("active");
  }

  renderColors(colorsToRender, isGrouped);
}

function renderColors(colors, isGrouped) {
  const container = document.getElementById("colors");
  container.innerHTML = "";

  if (colors.length === 0) {
    container.innerHTML =
      '<p style="grid-column: 1 / -1; text-align: center; color: #666;">No colors found for this filter type.</p>';
    return;
  }

  colors.forEach((c, i) => {
    const card = document.createElement("div");
    card.className = "color-card";

    const input = document.createElement("input");
    input.type = "color";
    input.value = c.hex;

    input.onfocus = () => {
      saveState();
    };

    input.onchange = () => {
      saveState();
    };

    input.oninput = () => {
      if (anim) {
        playerState.isPaused = anim.isPaused;
        playerState.currentFrame = anim.currentFrame;
      }

      const newHex = input.value;
      const { r, g, b } = hexToRgb(newHex);

      let colorsToUpdate = [];

      if (isGrouped) {
        colorsToUpdate = c.instances;
      } else {
        colorsToUpdate = [c];
      }

      colorsToUpdate.forEach((instance) => {
        const normalizedR = r / 255;
        const normalizedG = g / 255;
        const normalizedB = b / 255;

        if (instance.type === "solid" || instance.type === "stroke") {
          if (instance.ref.hasOwnProperty("s")) {
            instance.ref.s = [normalizedR, normalizedG, normalizedB, 1];
          } else if (instance.ref.hasOwnProperty("k")) {
            instance.ref.k = [normalizedR, normalizedG, normalizedB, 1];
          }
        } else if (instance.type === "gradient") {
          if (
            instance.ref.hasOwnProperty("s") &&
            Array.isArray(instance.ref.s)
          ) {
            instance.ref.s[instance.index + 1] = normalizedR;
            instance.ref.s[instance.index + 2] = normalizedG;
            instance.ref.s[instance.index + 3] = normalizedB;
          } else if (
            instance.ref.hasOwnProperty("k") &&
            Array.isArray(instance.ref.k)
          ) {
            instance.ref.k[instance.index + 1] = normalizedR;
            instance.ref.k[instance.index + 2] = normalizedG;
            instance.ref.k[instance.index + 3] = normalizedB;
          }
        }
      });

      c.hex = newHex;
      reloadAnim();
    };

    const label = document.createElement("label");
    label.textContent = isGrouped
      ? `${c.count} instances of ${c.hex}`
      : `${c.shapeType} ${i + 1}`;

    card.appendChild(input);
    card.appendChild(label);
    container.appendChild(card);
  });
}

function resetGroupedColors() {
  groupedColors = {};
}

function extractColors(obj) {
  if (obj && typeof obj === "object") {
    resetGroupedColors();

    const recursiveExtract = (o, c = []) => {
      if (o && typeof o === "object") {
        const shapeType = o.ty;

        const addColor = (
          type,
          shapeType,
          ref,
          hex,
          index = null,
          offset = null
        ) => {
          const instance = { type, shapeType, ref, hex, index, offset };
          c.push(instance);

          if (!groupedColors[hex]) {
            groupedColors[hex] = {
              hex,
              count: 0,
              instances: [],
              shapeType: shapeType,
            };
          }
          groupedColors[hex].count++;
          groupedColors[hex].instances.push(instance);
        };

        if (o.c && o.c.k) {
          if (o.c.a === 1) {
            if (Array.isArray(o.c.k)) {
              o.c.k.forEach((keyframe) => {
                if (keyframe.s && Array.isArray(keyframe.s)) {
                  let instanceShapeType =
                    shapeType === "fl" ? "fill" : "solid color (unknown)";
                  addColor(
                    "solid",
                    instanceShapeType,
                    keyframe,
                    rgbaToHex(keyframe.s)
                  );
                }
              });
            }
          } else if (Array.isArray(o.c.k)) {
            let instanceType = "solid";
            let instanceShapeType = "solid color (unknown)";

            if (shapeType === "fl") {
              instanceShapeType = "fill";
              instanceType = "solid";
            } else if (shapeType === "st") {
              instanceShapeType = "stroke";
              instanceType = "stroke";
            }

            addColor(instanceType, instanceShapeType, o.c, rgbaToHex(o.c.k));
          }
        }

        if (o.sc && o.sc.k) {
          if (o.sc.a === 1 && Array.isArray(o.sc.k)) {
            o.sc.k.forEach((keyframe) => {
              if (keyframe.s && Array.isArray(keyframe.s)) {
                addColor("stroke", "stroke", keyframe, rgbaToHex(keyframe.s));
              }
            });
          } else if (Array.isArray(o.sc.k)) {
            addColor("stroke", "stroke", o.sc, rgbaToHex(o.sc.k));
          }
        }

        if (o.g) {
          let gradientShapeType = "gradient";
          if (shapeType === "gf") gradientShapeType = "gradient fill";
          else if (shapeType === "gs") gradientShapeType = "gradient stroke";

          const processGradient = (gradientData, gradientRef) => {
            const arr = gradientData;
            const numStops = o.g.p || arr.length / 4;
            const loopLimit = numStops * 4;

            for (let i = 0; i < loopLimit; i += 4) {
              const offset = arr[i];
              const r = arr[i + 1],
                g = arr[i + 2],
                b = arr[i + 3];

              addColor(
                "gradient",
                gradientShapeType,
                gradientRef,
                rgbToHex(r * 255, g * 255, b * 255),
                i,
                offset
              );
            }
          };

          if (o.g.k && !o.g.k.a && Array.isArray(o.g.k)) {
            processGradient(o.g.k, o.g);
          } else if (o.g.k && o.g.k.a === 1 && Array.isArray(o.g.k.k)) {
            o.g.k.k.forEach((keyframe) => {
              if (keyframe && Array.isArray(keyframe.s)) {
                processGradient(keyframe.s, keyframe);
              }
            });
          } else if (
            o.g.k &&
            o.g.k.k &&
            Array.isArray(o.g.k.k) &&
            typeof o.g.k.k[0] === "number"
          ) {
            processGradient(o.g.k.k, o.g.k);
          }
        }

        for (const k in o) recursiveExtract(o[k], c);
      }
      return c;
    };

    return recursiveExtract(obj);
  }
  return [];
}

function reloadAnim() {
  if (anim) {
    playerState.currentFrame = anim.currentFrame;
    anim.destroy();
    document.getElementById("anim").innerHTML = "";
  }

  const shouldPlayAfterReload = !playerState.isPaused;

  anim = lottie.loadAnimation({
    container: document.getElementById("anim"),
    renderer: "svg",
    loop: true,
    autoplay: false,
    animationData: animData,
  });

  if (animData) {
    playPauseBtn.textContent = shouldPlayAfterReload ? "Pause" : "Play";
  }

  anim.addEventListener("DOMLoaded", () => {
    slider.max = anim.totalFrames - 1;
    const targetFrame = playerState.currentFrame;

    if (shouldPlayAfterReload) {
      anim.goToAndPlay(targetFrame, true);
    } else {
      anim.goToAndStop(targetFrame, true);
    }
  });

  anim.addEventListener("enterFrame", () => {
    slider.value = anim.currentFrame;
    frameLabel.textContent = `Frame: ${Math.round(anim.currentFrame)}`;
  });
}

slider.oninput = () => {
  playerState.currentFrame = parseFloat(slider.value);

  if (anim && anim.isPaused === false) {
    anim.pause();
    playPauseBtn.textContent = "Play";
    playerState.isPaused = true;
  }

  anim.goToAndStop(playerState.currentFrame, true);
  frameLabel.textContent = `Frame: ${Math.round(playerState.currentFrame)}`;
};

function rgbaToHex(arr) {
  const [r, g, b] = arr;
  return rgbToHex(r * 255, g * 255, b * 255);
}
function rgbToHex(r, g, b) {
  return (
    "#" +
    [r, g, b]
      .map((x) => {
        const h = Math.round(x).toString(16).padStart(2, "0");
        return h;
      })
      .join("")
  );
}
function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}
