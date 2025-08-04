//#region Imports
import * as Defaults from './Defaults/index.js';
import materialsJSON from './materials.json' with { type: 'json' };
import settings from './calculatorSettings.json' with { type: 'json' };
import fileManager from './fileManager.js';
//#endregion
//#region Setup Graphs
const mainCalculatorContainer = document.getElementById('mainCalculator');
const mainCalculator = Desmos.GraphingCalculator(mainCalculatorContainer, settings);
const distancesCalculatorContainer = document.getElementById('distancesCalculator');
const distancesCalculator = Desmos.GraphingCalculator(distancesCalculatorContainer, settings);
let mainLoaded = false;
let distancesLoaded = false;
let ready = false;
//#endregion
//#region Channel Type
mainCalculator.setState(Defaults.Main.Roadway);
distancesCalculator.setState(Defaults.Distances.Roadway);

const channelTypeDropdown = document.getElementById('channelType');
channelTypeDropdown.addEventListener('change', function() {
	if (modified && !confirm('You have unsaved changes. Do you want to continue?')) return;
	setModified(false);
	const selectedType = channelTypeDropdown.value;
	mainCalculator.setState(Defaults.Main[selectedType]);
	distancesCalculator.setState(Defaults.Distances[selectedType]);
	ready = false;
	mainLoaded = false;
	distancesLoaded = false;
});
//#endregion
//#region Bounds
let upperX = 12.5;
let lowerX = -0.5;
let upperY = 5;
let lowerY = -5;

function updateBounds() {
	mainCalculator.setMathBounds({
		xmin: lowerX,
		xmax: upperX,
		ymin: lowerY,
		ymax: upperY
	});
	distancesCalculator.setMathBounds({
		xmin: lowerX,
		xmax: upperX,
		ymin: -1,
		ymax: 1
	});
}
//#endregion
//#region Graph Changes
mainCalculator.observe('expressionAnalysis', function () {
	console.log('updated mainCalculator. Distances Loaded:', distancesLoaded, 'Main Loaded:', mainLoaded, 'Ready:', ready);
	const currentValues = Object.entries(mainCalculator.expressionAnalysis)
		.reduce((acc, [id, analysis]) => { if (analysis.evaluation) acc[id] = analysis.evaluation.value; return acc; }, {});
	if (currentValues.MinY == undefined) return;

	if(ready) setModified(true);
	if (mainLoaded && distancesLoaded) ready = true;
	if (distancesLoaded)mainLoaded = true;

	const topBottomPadding = (currentValues.MaxY - currentValues.MinY) * 0.1;
	upperY = currentValues.MaxY + topBottomPadding;
	lowerY = currentValues.MinY - topBottomPadding;
	updateBounds();

	mainCalculator.setExpression({ id: `p${heightEditing}Label`, showLabel: true });
	heightEditing = currentValues.editing;
	if (currentValues.editing != 0) {
		let x = 0;
		for (let i=0; i<heightEditing-1; i++) {
			x += currentValues.d[i];
		}
		const y = currentValues[`h${heightEditing}`] || 0;

		const pos = mainCalculator.mathToPixels({ x, y });

		heightEditor.setAttribute('type', 'number');
		heightEditor.style.top = `${pos.y + mainCalculatorContainer.getBoundingClientRect().y}px`;
		heightEditor.style.left = `${pos.x + mainCalculatorContainer.getBoundingClientRect().x + 20}px`;
		heightEditor.value = y;
		heightEditor.focus();
		heightEditor.select();

		mainCalculator.setExpression({ id: `p${heightEditing}Label`, showLabel: false });
	}

	mainCalculator.setExpression({ id: 'WaterLevelLabel', showLabel: true });
	waterEditing = currentValues.waterEditing;
	if (waterEditing != 0) {
		const pos = mainCalculator.mathToPixels({ x: 0, y: currentValues.WaterLevel });

		waterEditor.setAttribute('type', 'number');
		waterEditor.style.top = `${pos.y + mainCalculatorContainer.getBoundingClientRect().y - 10}px`;
		waterEditor.style.left = `${pos.x + mainCalculatorContainer.getBoundingClientRect().x + 20}px`;
		waterEditor.value = currentValues.WaterLevel;
		waterEditor.focus();
		waterEditor.select();

		mainCalculator.setExpression({ id: 'WaterLevelLabel', showLabel: false });
	}

	updateCalculations(currentValues);
});

distancesCalculator.observe('expressionAnalysis', function () {
	console.log('updated distancesCalculator. Distances Loaded:', distancesLoaded, 'Main Loaded:', mainLoaded, 'Ready:', ready);
	const currentValues = Object.entries(distancesCalculator.expressionAnalysis)
		.reduce((acc, [id, analysis]) => { if (analysis.evaluation) acc[id] = analysis.evaluation.value; return acc; }, {});
	if (currentValues.total == undefined) return;

	if(ready) setModified(true);
	if (mainLoaded && distancesLoaded) ready = true;
	distancesLoaded = true;

	upperX = currentValues.total + 0.5;
	updateBounds();

	mainCalculator.setExpression({
		id: 'd',
		latex: 'd=\\left['+currentValues.d.join(',')+'\\right]'
	});

	distancesCalculator.setExpression({ id: `d${distanceEditing}Label`, showLabel: true });
	distanceEditing = currentValues.editing;
	if (distanceEditing != 0) {
		let x = 0;
		for (let i=0; i<distanceEditing-1; i++) {
			x += currentValues.d[i];
		}
		x += currentValues.d[distanceEditing-1] / 2;
		const y = currentValues.HeightOfLabels || 0;

		const pos = distancesCalculator.mathToPixels({ x, y });

		distanceEditor.setAttribute('type', 'number');
		distanceEditor.style.top = `${pos.y + distancesCalculatorContainer.getBoundingClientRect().y - 5}px`;
		distanceEditor.style.left = `${pos.x + distancesCalculatorContainer.getBoundingClientRect().x - 25}px`;
		distanceEditor.value = currentValues.d[distanceEditing-1];
		distanceEditor.focus();
		distanceEditor.select();

		distancesCalculator.setExpression({ id: `d${distanceEditing}Label`, showLabel: false });
	}
});
//#endregion
//#region Calculations
var heightEditing = 0;
var distanceEditing = 0;
var waterEditing = 0;

const heightEditor = document.getElementById('heightEditor');
const distanceEditor = document.getElementById('distanceEditor');
const waterEditor = document.getElementById('waterEditor');

const spans = {
	wettedPerimeter: document.getElementById('wettedPerimeter'),
	wettedArea: document.getElementById('wettedArea'),
	velocity: document.getElementById('velocity'),
	flowrate: document.getElementById('flowrate'),
	flowrateL: document.getElementById('flowrateL'),
	depth: document.getElementById('depth'),
	depthVelocity: document.getElementById('depthVelocity'),
	hydraulicRadius: document.getElementById('hydraulicRadius'),
}
function updateCalculations(currentValues) {
	spans.wettedPerimeter.textContent = (currentValues.WettedPerimeter ?? 0).toFixed(3) + 'm';
	spans.wettedArea.textContent = (currentValues.WettedArea ?? 0).toFixed(3) + 'm²';
	spans.velocity.textContent = (currentValues.Velocity ?? 0).toFixed(3) + 'm/s';
	spans.flowrate.textContent = (currentValues.Flowrate ?? 0).toFixed(3) + 'm³/s';
	spans.flowrateL.textContent = (currentValues.Flowrate ? (currentValues.Flowrate * 1000).toFixed(0) : 0) + 'L/s';
	spans.depth.textContent = (currentValues.Depth ?? 0).toFixed(3) + 'm';
	spans.depthVelocity.textContent = ((currentValues.Depth * currentValues.Velocity) ?? 0).toFixed(3) + 'm²/s';
	spans.hydraulicRadius.textContent = (currentValues.HydraulicRadius ?? 0).toFixed(3) + 'm';
}
//#endregion
//#region Editors
function setDistance() {
	const value = parseFloat(distanceEditor.value);
	if (isNaN(value)) return;
	distancesCalculator.setExpression({
		id: `d${distanceEditing}`,
		latex: `d_{${distanceEditing}}=${value}`
	});
}
function setHeight() {
	const value = parseFloat(heightEditor.value);
	if (isNaN(value)) return;
	mainCalculator.setExpression({
		id: `h${heightEditing}`,
		latex: `h_{${heightEditing}}=${value}`
	});
}
function setWaterLevel() {
	const value = parseFloat(waterEditor.value);
	if (isNaN(value)) return;
	mainCalculator.setExpression({
		id: 'WaterLevel',
		latex: `w_{aterLevel}=${value}`
	});
}
function exitHeightEditing() {
	setHeight();
	heightEditor.setAttribute('type', 'hidden');
	mainCalculator.setExpression({ id: 'editing', latex: 'e_{diting}=0' });
}
function exitDistanceEditing() {
	setDistance();
	distanceEditor.setAttribute('type', 'hidden');
	distancesCalculator.setExpression({ id: 'editing', latex: 'e_{diting}=0' });
}
function exitWaterEditing() {
	setWaterLevel();
	waterEditor.setAttribute('type', 'hidden');
	mainCalculator.setExpression({ id: 'waterEditing', latex: 'w_{aterEditing}=0' });
}
heightEditor.addEventListener('keypress', function(event) {
	if (event.key === 'Enter')
		exitHeightEditing();
});
distanceEditor.addEventListener('keypress', function(event) {
	if (event.key === 'Enter')
		exitDistanceEditing();
});
waterEditor.addEventListener('keypress', function(event) {
	if (event.key === 'Enter')
		exitWaterEditing();
});
heightEditor.addEventListener('blur', function() {
	exitHeightEditing();
});
distanceEditor.addEventListener('blur', function() {
	exitDistanceEditing();
});
waterEditor.addEventListener('blur', function() {
	exitWaterEditing();
});
//#endregion
//#region Materials
const materialsDropdown = document.getElementById('material');
materialsDropdown.innerHTML = Object.entries(materialsJSON).map(([name, value]) => {
	if (typeof value === 'object') {
		return /*html*/`<optgroup label="${name}">${Object.entries(value).map(([subName, subValue]) => `<option value='{"value":"${subValue}","name":"${subName}"}'>${subName}: ${subValue}</option>`).join('')}</optgroup>`;
	} else {
		return /*html*/`<option value='{"value":"${value}","name":"${name}"}'>${name}: ${value}</option>`;
	}
}).join('');

const customMaterial = document.getElementById('customMaterial');
materialsDropdown.appendChild(new Option('Custom:', 'custom'));

materialsDropdown.value = 'custom';
materialsDropdown.dataset.chosen = 'custom';

materialsDropdown.addEventListener('change', function() {
	const selectedOption = materialsDropdown.options[materialsDropdown.selectedIndex];
	materialsDropdown.dataset.chosen = selectedOption.value;
	updateManningsCoefficient();
});
function updateManningsCoefficient() {
	const selectedOption = materialsDropdown.options[materialsDropdown.selectedIndex];
	mainCalculator.setExpression({
		id: 'ManningsCoefficient',
		latex: `N_{ManningsCoefficient}=${(selectedOption.value == 'custom')
			? customMaterial.value : JSON.parse(selectedOption.value).value}`
	});
}
customMaterial.addEventListener('change', updateManningsCoefficient);
updateManningsCoefficient();
//#endregion
//#region Slope
const longitudinalOption = document.getElementById('longitudinalOption');
const riseRunOption = document.getElementById('riseRunOption');

riseRunOption.addEventListener('click', toggleSlopeOptions);
function toggleSlopeOptions() {
	if (longitudinalOption.getAttribute('selected') == 'true') {
		riseRunOption.removeEventListener('click', toggleSlopeOptions);
		longitudinalOption.addEventListener('click', toggleSlopeOptions);
		longitudinalOption.setAttribute('selected', 'false');
		riseRunOption.setAttribute('selected', 'true');
	}
	else {
		longitudinalOption.removeEventListener('click', toggleSlopeOptions);
		riseRunOption.addEventListener('click', toggleSlopeOptions);
		longitudinalOption.setAttribute('selected', 'true');
		riseRunOption.setAttribute('selected', 'false');
	}
	updateGradient();
}

const longitudinalInput = document.getElementById('longitudinalInput');
const riseInput = document.getElementById('Rise');
const runInput = document.getElementById('Run');

longitudinalInput.addEventListener('change', updateGradient);
riseInput.addEventListener('change', updateGradient);
runInput.addEventListener('change', updateGradient);

function updateGradient() {
	if (riseRunOption.getAttribute('selected') == 'true') {
		const rise = parseFloat(riseInput.value);
		const run = parseFloat(runInput.value);
		if (isNaN(rise) || isNaN(run)) return;
		const slope = rise / run;
		mainCalculator.setExpression({
			id: 'LongitudinalGradient',
			latex: `L_{ongitudinalGradient}=${slope}`
		});
	}
	else {
		const value = parseFloat(longitudinalInput.value);
		if (isNaN(value)) return;
		mainCalculator.setExpression({
			id: 'LongitudinalGradient',
			latex: `L_{ongitudinalGradient}=${value/100}`
		});
	}
}
//#endregion
//#region Project Details
const projectNumberInput = document.getElementById('projectNumber');
const projectNameInput = document.getElementById('projectName');
//#endregion
//#region Save/Load
var modified = false;
setModified(false);
function setModified(to) {
	modified = to;
	document.getElementById('saveButton').disabled = !to;
}
fileManager.content = () => {
	const currentMainValues = Object.entries(mainCalculator.expressionAnalysis)
		.reduce((acc, [id, analysis]) => { if (analysis.evaluation) acc[id] = analysis.evaluation.value; return acc; }, {});
	const currentDistancesValues = Object.entries(distancesCalculator.expressionAnalysis)
		.reduce((acc, [id, analysis]) => { if (analysis.evaluation) acc[id] = analysis.evaluation.value; return acc; }, {});
	return JSON.stringify({
		projectNumber: projectNumberInput.value,
		projectName: projectNameInput.value,
		distances: currentDistancesValues.d,
		heights: currentMainValues.h,
		waterLevel: currentMainValues.WaterLevel,
		material: {
			dropdown: materialsDropdown.value,
			custom: customMaterial.value,
		},
		slope: {
			longitudinal: longitudinalInput.value,
			rise: riseInput.value,
			run: runInput.value,
			type: riseRunOption.getAttribute('selected') === 'true' ? 'riseRun' : 'longitudinal'
		},
		type: channelTypeDropdown.value
	});
}
async function load() {
	if (modified && !confirm('You have unsaved changes. Do you want to continue?')) return;
	const fileContent = await fileManager.openFile();
	if (!fileContent) return;
	const data = JSON.parse(fileContent);
	channelTypeDropdown.value = data.type;
	mainCalculator.setState(Defaults.Main[data.type]);
	distancesCalculator.setState(Defaults.Distances[data.type]);

	projectNumberInput.value = data.projectNumber || '';
	projectNameInput.value = data.projectName || '';
	for (let i = 0; i < data.distances.length; i++) {
		distancesCalculator.setExpression({
			id: `d${i+1}`,
			latex: `d_{${i+1}}=${data.distances[i]}`
		});
	}
	for (let i = 0; i < data.heights.length; i++) {
		mainCalculator.setExpression({
			id: `h${i+1}`,
			latex: `h_{${i+1}}=${data.heights[i]}`
		});
	}
	mainCalculator.setExpression({
		id: 'WaterLevel',
		latex: `w_{aterLevel}=${data.waterLevel || 0}`
	});
	materialsDropdown.dataset.chosen = data.material.dropdown || 'custom';
	materialsDropdown.value = data.material.dropdown || 'custom';
	customMaterial.value = data.material.custom || '0.01';
	updateManningsCoefficient();
	longitudinalInput.value = data.slope.longitudinal || '1';
	riseInput.value = data.slope.rise || '1';
	runInput.value = data.slope.run || '100';
	updateGradient();
	setModified(false);
}
function save() {
	fileManager.saveFile();
	setModified(false);
}
function saveAs() {
	fileManager.saveAs();
	setModified(false);
}
document.getElementById('saveButton').addEventListener('click', save);
document.getElementById('saveAsButton').addEventListener('click', saveAs);
document.getElementById('loadButton').addEventListener('click', load);
//#endregion
//#region Print
const mainCalcImage = document.getElementById('mainCalcImage');
const distancesCalcImage = document.getElementById('distancesCalcImage');
async function print() {
	mainCalculator.asyncScreenshot({
		width: 800,
		height: 600,
		showLabels: true,
		format: 'svg'
	}, function(string) {
		mainCalcImage.innerHTML = string;
		setTimeout(() => {
			window.print();
		}, 100); // Wait for images to load
	});
	distancesCalculator.asyncScreenshot({
		width: 800,
		height: 80,
		showLabels: true,
		format: 'svg'
	}, function(string) {
		distancesCalcImage.innerHTML = string;
	});
}
document.getElementById('printButton').addEventListener('click', print);
//#endregion
//#region Keyboard Shortcuts
window.addEventListener('keydown', function(event) {
	if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyS') {
		event.preventDefault();
		saveAs();
		return;
	}

	const ctrlFunctions = {
		s: save,
		o: load,
		p: print,
		m: () => console.log(mainCalculator.getState()),
		d: () => console.log(distancesCalculator.getState()),
	};
	if ((event.ctrlKey || event.metaKey) && ctrlFunctions[event.key]) {
		event.preventDefault();
		ctrlFunctions[event.key]();
	}
});
//#endregion
//#region Navigation Guards
window.addEventListener('beforeunload', function(event) {
    const msg = `There are unsaved changes. Are you sure you want to leave?`;
    if (modified) {
      event.preventDefault();
      event.returnValue = msg;
    }
});
//#endregion