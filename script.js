let animData, anim;
let originalAnimData;
let allExtractedColors = []; 
let groupedColors = {}; 

const slider = document.getElementById('frameSlider');
const frameLabel = document.getElementById('frameLabel');
const groupCheckbox = document.getElementById('groupDuplicates');
const exportBtn = document.getElementById('exportBtn');
const playPauseBtn = document.getElementById('playPauseBtn'); 
const colorList = document.getElementById('colors'); 

let currentFilter = 'All';

let playerState = {
    isPaused: true,
    currentFrame: 0.0
};

const fileInput = document.getElementById('fileInput');
const customFileInputLabel = document.getElementById('customFileInputLabel');

fileInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) {
    customFileInputLabel.textContent = 'Choose File... (No file selected)';
    return;
  }
  
  try {
      customFileInputLabel.textContent = file.name;
      const text = await file.text();
      
      originalAnimData = JSON.parse(text); 
      animData = JSON.parse(text);       
      
      exportBtn.disabled = false;
      
      playPauseBtn.textContent = 'Play';
      playerState = { isPaused: true, currentFrame: 0.0 };

      initializeColorEditor(animData); 
      reloadAnim();
  } catch (error) {
      alert("Error processing file: Please ensure you uploaded a valid Lottie JSON file.");
      customFileInputLabel.textContent = 'Choose File... (Error processing file)';
      console.error("File processing error:", error);
  }
});

exportBtn.onclick = exportLottieJson;

playPauseBtn.onclick = () => {
    if (!anim) return;

    if (anim.isPaused) {
        anim.play();
        playPauseBtn.textContent = 'Pause';
        playerState.isPaused = false;
    } else {
        anim.pause();
        playPauseBtn.textContent = 'Play';
        playerState.isPaused = true;
    }
};

function exportLottieJson() {
    if (!originalAnimData) {
        alert("Please load a Lottie JSON file first.");
        return;
    }
    
    const finalExportData = JSON.parse(JSON.stringify(originalAnimData));

    function deepTraverseAndCopyColors(sourceObj, targetObj) {
        if (!sourceObj || typeof sourceObj !== 'object' || !targetObj || typeof targetObj !== 'object') {
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

                if (key === 'c' || key === 'sc') {
                    if (sourceObj[key] && sourceObj[key].k) {
                        if (targetObj[key] && targetObj[key].k) {
                            if (Array.isArray(sourceObj[key].k)) {
                                targetObj[key].k = sourceObj[key].k;
                            }
                        }
                    }
                } 
                else if (key === 'g') {
                    if (sourceObj[key] && Array.isArray(sourceObj[key].k)) { 
                        if (targetObj[key] && Array.isArray(targetObj[key].k)) {
                            targetObj[key].k = sourceObj[key].k;
                        }
                    }
                    else if (sourceObj[key] && sourceObj[key].k && Array.isArray(sourceObj[key].k.k)) { 
                        if (targetObj[key] && targetObj[key].k && Array.isArray(targetObj[key].k.k)) {
                            targetObj[key].k.k = sourceObj[key].k.k;
                        }
                    }
                } 
                else if (typeof sourceObj[key] === 'object' && sourceObj[key] !== null) {
                    deepTraverseAndCopyColors(sourceObj[key], targetObj[key]);
                }
            }
        }
    }
    
    deepTraverseAndCopyColors(animData, finalExportData);

    const jsonString = JSON.stringify(finalExportData, null, 2); 
    
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'lottie-edited.json'; 
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}


function initializeColorEditor(data) {
    allExtractedColors = extractColors(data);
    
    document.querySelectorAll('.filter-btn').forEach(button => {
        button.onclick = (e) => {
            currentFilter = e.target.dataset.filter;
            filterAndRender(currentFilter, e.target);
        };
    });

    groupCheckbox.onchange = () => {
        filterAndRender(currentFilter, document.querySelector(`[data-filter="${currentFilter}"]`));
    };
    
    filterAndRender('All', document.querySelector('[data-filter="All"]')); 
}

function filterAndRender(filterType, activeButton) {
    let colorsToRender = [];
    const isGrouped = groupCheckbox.checked;

    if (isGrouped) {
        colorsToRender = Object.values(groupedColors).filter(g => {
            if (filterType === 'All') return true;
            return g.instances.some(c => {
                if (filterType === 'Fill') return c.shapeType.includes('fill');
                if (filterType === 'Stroke') return c.shapeType.includes('stroke');
                return c.shapeType.toLowerCase().includes(filterType.toLowerCase()); 
            });
        });
    } else {
        colorsToRender = allExtractedColors.filter(c => {
            if (filterType === 'All') return true;
            if (filterType === 'Fill') return c.shapeType.includes('fill');
            if (filterType === 'Stroke') return c.shapeType.includes('stroke');
            return c.shapeType.toLowerCase().includes(filterType.toLowerCase()); 
        });
    }

    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    if (activeButton) {
        activeButton.classList.add('active');
    }

    renderColors(colorsToRender, isGrouped);
}

function renderColors(colors, isGrouped) {
  const container = document.getElementById('colors');
  container.innerHTML = '';

  if (colors.length === 0) {
    container.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #666;">No colors found for this filter type.</p>';
    return;
  }

  colors.forEach((c, i) => {
    const card = document.createElement('div');
    card.className = 'color-card';

    const input = document.createElement('input');
    input.type = 'color';
    input.value = c.hex;
    
    input.oninput = () => {
      if (anim) {
          playerState.isPaused = anim.isPaused;
          playerState.currentFrame = anim.currentFrame;
      }
        
      const newHex = input.value;
      const {r, g, b} = hexToRgb(newHex);

      let colorsToUpdate = [];

      if (isGrouped) {
        colorsToUpdate = c.instances;
      } else {
        colorsToUpdate = [c];
      }

      colorsToUpdate.forEach(instance => {
        const normalizedR = r / 255;
        const normalizedG = g / 255;
        const normalizedB = b / 255;
        
        if (instance.type === 'solid' || instance.type === 'stroke') {
          instance.ref.k = [normalizedR, normalizedG, normalizedB, 1];
        } else if (instance.type === 'gradient') {
            
            // --- FIX FOR ANIMATED GRADIENTS ---
            if (instance.ref.a === 1 && Array.isArray(instance.ref.k)) {
                // Animated Gradient: instance.ref.k is an array of keyframe objects
                instance.ref.k.forEach(keyframe => {
                    if (Array.isArray(keyframe.s)) {
                        // 's' is the raw color array. Update the color values inside the array.
                        keyframe.s[instance.index+1] = normalizedR;
                        keyframe.s[instance.index+2] = normalizedG;
                        keyframe.s[instance.index+3] = normalizedB;
                    }
                });
            } 
            // Static Gradient
            else if (Array.isArray(instance.ref.k)) {
                // Static Gradient: instance.ref.k is the raw color array
                instance.ref.k[instance.index+1] = normalizedR;
                instance.ref.k[instance.index+2] = normalizedG;
                instance.ref.k[instance.index+3] = normalizedB;
            }
        }
      });

      c.hex = newHex; 
      reloadAnim();
    };

    const label = document.createElement('label');
    label.textContent = isGrouped 
        ? `${c.count} instances of ${c.hex}` 
        : `${c.shapeType} ${i+1}`; 

    card.appendChild(input);
    card.appendChild(label);
    container.appendChild(card);
  });
}

function resetGroupedColors() {
    groupedColors = {};
}

function extractColors(obj) {
    if (obj && typeof obj === 'object') {
        
        resetGroupedColors(); 

        const recursiveExtract = (o, c=[]) => {
            if (o && typeof o === 'object') {
                const shapeType = o.ty; 

                const addColor = (type, shapeType, ref, hex, index = null, offset = null) => {
                    const instance = { type, shapeType, ref, hex, index, offset };
                    c.push(instance); 

                    if (!groupedColors[hex]) {
                        groupedColors[hex] = { hex, count: 0, instances: [], shapeType: shapeType }; 
                    }
                    groupedColors[hex].count++;
                    groupedColors[hex].instances.push(instance);
                };

                if (o.c && Array.isArray(o.c.k)) {
                    addColor(
                        'solid', 
                        shapeType === 'fl' ? 'fill' : 'solid fill (unknown)', 
                        o.c, 
                        rgbaToHex(o.c.k)
                    );
                }
                if (o.sc && Array.isArray(o.sc.k)) {
                    addColor(
                        'stroke', 
                        shapeType === 'st' ? 'stroke' : 'stroke (unknown)', 
                        o.sc, 
                        rgbaToHex(o.sc.k)
                    );
                }

                let gradientData = null;
                let gradientRef = null;

                if (o.g) {
                    if (Array.isArray(o.g.k)) {
                        // Static Gradient
                        gradientData = o.g.k;
                        gradientRef = o.g;
                    } else if (o.g.k && Array.isArray(o.g.k.k)) {
                        // Animated Gradient (FIX: Use the 's' value of the first keyframe)
                        if (o.g.k.k.length > 0 && Array.isArray(o.g.k.k[0].s)) {
                            gradientData = o.g.k.k[0].s;
                            gradientRef = o.g.k;
                        }
                    }
                }
                
                if (gradientData) {
                    const arr = gradientData;
                    const numStops = o.g.p || (arr.length / 4);
                    const loopLimit = numStops * 4; 

                    let gradientShapeType = 'gradient';
                    if (shapeType === 'gf') gradientShapeType = 'gradient fill';
                    else if (shapeType === 'gs') gradientShapeType = 'gradient stroke';
                    
                    for (let i=0; i<loopLimit; i+=4) {
                        const offset = arr[i];
                        const r = arr[i+1], g = arr[i+2], b = arr[i+3];
                        
                        addColor(
                            'gradient', 
                            gradientShapeType, 
                            gradientRef, 
                            rgbToHex(r*255,g*255,b*255),
                            i,
                            offset
                        );
                    }
                }

                for (const k in o) recursiveExtract(o[k], c);
            }
            return c;
        }

        return recursiveExtract(obj);
    }
    return [];
}

function reloadAnim() {
  if (anim) {
    playerState.currentFrame = anim.currentFrame;
    anim.destroy();
    document.getElementById('anim').innerHTML = ''; 
  }
  
  const shouldPlayAfterReload = !playerState.isPaused;
  
  anim = lottie.loadAnimation({
    container: document.getElementById('anim'),
    renderer: 'svg',
    loop: true,
    autoplay: false, 
    animationData: animData
  });

  if (animData) {
      playPauseBtn.textContent = shouldPlayAfterReload ? 'Pause' : 'Play';
  }

  anim.addEventListener('DOMLoaded', () => {
    slider.max = anim.totalFrames - 1;
    const targetFrame = playerState.currentFrame;
    
    if (shouldPlayAfterReload) {
        anim.goToAndPlay(targetFrame, true); 
    } else {
        anim.goToAndStop(targetFrame, true); 
    }
    
  });

  anim.addEventListener('enterFrame', () => {
    slider.value = anim.currentFrame;
    frameLabel.textContent = `Frame: ${Math.round(anim.currentFrame)}`;
  });
}

slider.oninput = () => {
  playerState.currentFrame = parseFloat(slider.value);
  
  if (anim && anim.isPaused === false) {
      anim.pause();
      playPauseBtn.textContent = 'Play';
      playerState.isPaused = true;
  }
  
  anim.goToAndStop(playerState.currentFrame, true);
  frameLabel.textContent = `Frame: ${Math.round(playerState.currentFrame)}`;
};

function rgbaToHex(arr) {
  const [r,g,b] = arr;
  return rgbToHex(r*255,g*255,b*255);
}
function rgbToHex(r,g,b) {
  return "#" + [r,g,b].map(x => {
    const h = Math.round(x).toString(16).padStart(2,'0');
    return h;
  }).join('');
}
function hexToRgb(hex) {
  const bigint = parseInt(hex.slice(1), 16);
  return {r:(bigint>>16)&255, g:(bigint>>8)&255, b:bigint&255};
}