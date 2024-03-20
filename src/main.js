import TWEEN from '@tweenjs/tween.js';

import './style.sass';

const LINE_WIDTH = 38;
const GRID_SPACING = 40;
const C_1 = '#f060d0';
const C_2 = '#f080f0';
const C_DOT = '#333';

const DEBOUNCE_MS = 300;
const QUALITY = 1; // Range: (0, 1]

const PI_2 = Math.PI * 2;
const maxHypot = Math.hypot(0.5, 0.5);

const pad3 = n => String(n).padStart(3, '0');

const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d');

// Global state: canvas size.
let w, h, maxX, maxY, offsetX, offsetY, scale;

// Global state: grid.
let closestPoint = null;
const pointOffsets = {};

ctx.save();
function setSize() {
	ctx.restore();
	ctx.save();
	scale = QUALITY;
	w = window.innerWidth;
	canvas.width = w * scale;
	maxX = Math.floor((w - LINE_WIDTH) / GRID_SPACING);
	maxX = maxX - (maxX % 2); // Ensure it’s an even # for better centering.
	offsetX = (w - maxX * GRID_SPACING) / 2;
	h = window.innerHeight;
	maxY = Math.floor((h - LINE_WIDTH) / GRID_SPACING);
	maxY = maxY - (maxY % 2); // Ensure it’s an even # for better centering.
	offsetY = (h - maxY * GRID_SPACING) / 2;
	canvas.height = h * scale;
	ctx.scale(scale, scale);
	ctx.translate(offsetX, offsetY);
}
window.addEventListener(
	'resize',
	(() => {
		let debounce;
		let lastTrigger = -DEBOUNCE_MS;
		return () => {
			clearTimeout(debounce);
			const now = Date.now();
			if (now > lastTrigger + DEBOUNCE_MS) {
				setSize();
				lastTrigger = now;
			} else setTimeout(setSize, DEBOUNCE_MS);
		};
	})()
);
setSize();

canvas.addEventListener('mousemove', e => {
	const x = (e.clientX - offsetX) / GRID_SPACING;
	const y = (e.clientY - offsetY) / GRID_SPACING;
	const xRounded = Math.round(x);
	const yRounded = Math.round(y);

	if (points.length === 1) {
		initialDirection = Math.abs(x - points[0][0]) < Math.abs(y - points[0][1]) ? 1 : 0;
	}

	const xDiff = x - xRounded;
	const yDiff = y - yRounded;
	const pos = `${pad3(xRounded)}-${pad3(yRounded)}`;
	const isNewClosestPoint = pos !== closestPoint;
	if (isNewClosestPoint) {
		if (pointOffsets[closestPoint]) {
			pointOffsets[closestPoint].tween?.stop();
			pointOffsets[closestPoint].tween = new TWEEN.Tween(pointOffsets[closestPoint].animated)
				.to(
					{
						magnitude: 0,
						magnitudeInv: 0,
					},
					333
				)
				.start();
		}
		closestPoint = pos;
	}

	// Update tween.
	let pointOffset = pointOffsets[pos];
	if (pointOffset) {
		pointOffset.tween?.stop();
	} else {
		pointOffset = pointOffsets[pos] = {
			tween: null,
			angle: null,
			animated: {
				magnitude: 0,
				magnitudeInv: 0,
			},
		};
	}
	pointOffset.angle = Math.atan2(yDiff, xDiff);
	// TODO: How can I tween this so it doesn’t snap into place?
	pointOffset.animated = {
		magnitude: Math.hypot(xDiff, yDiff) / maxHypot,
		magnitudeInv: 1 - Math.hypot(xDiff, yDiff) / maxHypot,
	};
});

const points = [];
const visited = {};
let initialDirection = null; // 0 = x, 1 = y.
canvas.addEventListener('click', e => {
	const position = points[points.length - 1];
	const x = (e.clientX - offsetX) / GRID_SPACING;
	const y = (e.clientY - offsetY) / GRID_SPACING;
	let xRounded = Math.round(x);
	let yRounded = Math.round(y);
	if (position) {
		if ((points.length + initialDirection) % 2) {
			yRounded = position[1];
		} else {
			xRounded = position[0];
		}
	}
	const nextPosition = [xRounded, yRounded];
	const pos = nextPosition.map(pad3).join('-');
	if (!position) {
		points.push(nextPosition);
		visited[pos] = true;
	} else if (!visited[pos]) {
		const len = Math.abs(nextPosition[0] - position[0] + nextPosition[1] - position[1]);
		const dirX = Math.sign(nextPosition[0] - position[0]);
		const dirY = Math.sign(nextPosition[1] - position[1]);
		for (let i = 1; i <= len; ++i) {
			const p = [position[0] + i * dirX, position[1] + i * dirY];
			visited[p.map(pad3).join('-')] = true;
		}
		points.push(nextPosition);
	}
});

function drawRibbon(t) {
	if (!points.length) return;

	ctx.lineWidth = LINE_WIDTH;
	let prevDir;
	const drawnPoints = [...points];
	const hoverPoint = closestPoint?.split('-').map(n => parseInt(n, 10));
	const adjustedHoverPoint =
		hoverPoint && (points.length + initialDirection) % 2
			? [hoverPoint[0], points[points.length - 1][1]]
			: [points[points.length - 1][0], hoverPoint[1]];
	if (hoverPoint && !visited[adjustedHoverPoint.map(pad3).join('-')]) {
		drawnPoints.push(adjustedHoverPoint);
	}
	for (let i = 1; i < drawnPoints.length; ++i) {
		const position = drawnPoints[i - 1];
		const nextPosition = drawnPoints[i];
		const isOdd = (i + initialDirection) % 2;
		const dirX = Math.sign(nextPosition[0] - position[0]);
		const dirY = Math.sign(nextPosition[1] - position[1]);
		const dir = dirX + dirY;

		if (i > 1) {
			// Draw the shadow.
			const shadowCoords1 = position.map(
				(p, i) => p * GRID_SPACING - (i === isOdd ? (prevDir * LINE_WIDTH) / 2 : 0)
			);
			const shadowCoords2 = position.map(
				(p, i) => p * GRID_SPACING - (i === isOdd ? (prevDir * LINE_WIDTH) / 1.7 : 0)
			);
			const gradient = ctx.createLinearGradient(...shadowCoords1, ...shadowCoords2);
			gradient.addColorStop(0, 'rgba(0, 0, 0, 0.06)');
			gradient.addColorStop(0.1, 'rgba(0, 0, 0, 0.055)');
			gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

			ctx.strokeStyle = gradient;

			ctx.beginPath();
			ctx.moveTo(...shadowCoords1);
			ctx.lineTo(...shadowCoords2);

			ctx.stroke();

			// Draw the triangle.
			ctx.fillStyle = isOdd ? C_1 : C_2;
			ctx.beginPath();
			ctx.moveTo(
				position[0] * GRID_SPACING + (prevDir * LINE_WIDTH) / 2,
				position[1] * GRID_SPACING + (dir * LINE_WIDTH) / 2
			);
			ctx.lineTo(
				position[0] * GRID_SPACING - (prevDir * LINE_WIDTH) / 2,
				position[1] * GRID_SPACING - (dir * LINE_WIDTH) / 2
			);
			if (isOdd && prevDir === dir) {
				ctx.lineTo(
					position[0] * GRID_SPACING + (prevDir * LINE_WIDTH) / 2,
					position[1] * GRID_SPACING - (dir * LINE_WIDTH) / 2
				);
			} else {
				ctx.lineTo(
					position[0] * GRID_SPACING - (prevDir * LINE_WIDTH) / 2,
					position[1] * GRID_SPACING + (dir * LINE_WIDTH) / 2
				);
			}
			ctx.fill();
		} else {
			ctx.fillStyle = initialDirection ? C_2 : C_1;
			ctx.fillRect(
				position[0] * GRID_SPACING - LINE_WIDTH / 2,
				position[1] * GRID_SPACING - LINE_WIDTH / 2,
				LINE_WIDTH,
				LINE_WIDTH
			);
		}

		// Draw the next line.
		ctx.strokeStyle = isOdd ? C_1 : C_2;
		ctx.beginPath();
		ctx.moveTo(...position.map((p, idx) => p * GRID_SPACING + (idx === isOdd ? 0 : (dir * LINE_WIDTH) / 2)));
		ctx.lineTo(
			...nextPosition.map(
				(p, idx) =>
					p * GRID_SPACING - (idx === isOdd || i === drawnPoints.length - 1 ? 0 : (dir * LINE_WIDTH) / 2)
			)
		);
		ctx.stroke();
		prevDir = dir;
	}
}

function drawGrid(t) {
	ctx.lineWidth = 1;
	ctx.strokeStyle = C_DOT;
	ctx.fillStyle = C_DOT;
	for (let x = 0; x <= maxX; ++x) {
		for (let y = 0; y <= maxY; ++y) {
			const pos = `${pad3(x)}-${pad3(y)}`;
			const pointOffset = pointOffsets[pos];
			const offsetAngle = pointOffset?.angle ?? 0;
			const offsetMagnitude = pointOffset?.animated.magnitude ?? 0;
			const offsetMagnitudeInv = pointOffset?.animated.magnitudeInv ?? 0;
			const isClosestPoint = pos === closestPoint;
			const xPx = x * GRID_SPACING;
			const yPx = y * GRID_SPACING;
			ctx.beginPath();
			ctx.arc(xPx, yPx, 1 + offsetMagnitudeInv * 3, 0, PI_2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(
				xPx + Math.cos(offsetAngle) * offsetMagnitude * 3,
				yPx + Math.sin(offsetAngle) * offsetMagnitude * 3,
				4 + offsetMagnitude * 4,
				0,
				PI_2
			);
			ctx.stroke();
		}
	}
}

function drawFrame(t) {
	ctx.clearRect(-offsetX, -offsetY, w, h);
	drawGrid(t);
	drawRibbon(t);
}

window.requestAnimationFrame(function drawLoop(t) {
	window.requestAnimationFrame(drawLoop);
	TWEEN.update(t);
	drawFrame(t);
});
