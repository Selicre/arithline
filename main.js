"use strict";
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const keymap = {
	"Digit1": 1,
	"Digit2": 2,
	"Digit3": 3,
	"Digit4": 4,
	"Digit5": 5,
	"Digit6": 6,
	"Digit7": 7,
	"Digit8": 8,
	"Digit9": 9,
	"KeyQ": 1,
	"KeyW": 2,
	"KeyE": 3,
	"KeyA": 4,
	"KeyS": 5,
	"KeyD": 6,
	"KeyZ": 7,
	"KeyX": 8,
	"KeyC": 9,
};
class Board {
	constructor(width, height) {
		this.width = width;
		this.height = height;
		this.board = [];
		this.state = [];
		this.rowClues = [];
		this.colClues = [];
		this.hoveredX = -1;
		this.hoveredY = -1;
		this.cellSize = 50;
		this.colors = {
			bg: "#fff",
			fg: "#000",
		};
	}
	static fromText(s) {
		let rows = s.trim().split('\n');
		let h = rows.length;
		let w = rows[0].length;
		let board = rows.flatMap(c => c.split("")).map(c => {
			if (c == '.') {
				return {
					type: "number",
				};
			} else if (c == '+') {
				return {
					type: "separator",
					oper: "add",
				};
			} else if (c == '*') {
				return {
					type: "separator",
					oper: "mul",
					label: '×',
				};
			}
		});
		let b = new Board(w,h);
		b.board = board;
		b.loadState();
		return b;
	}
	saveState() {
		localStorage.setItem("arithline_1", JSON.stringify(this.state));
	}
	loadState() {
		try {
			let item = localStorage.getItem("arithline_1");
			item = JSON.parse(item);
			if (!item) throw 0;
			this.state = item;
		} catch (e) {
			this.resetState();
		}
	}
	resetState() {
		this.state = this.board.map(c => {
			if (c.type == "number") {
				return { "value": null, "pencil": [] };
			} else {
				return null;
			}
		});
	}
	hoveredCellId() {
		if (this.hoveredX < 0 || this.hoveredX > this.width
			|| this.hoveredY < 0 || this.hoveredY > this.height) { return null; }
		return this.hoveredX + this.hoveredY * this.width;
	}
	updateInput(ev) {
		let cell = this.hoveredCellId();
		if (cell == null) return;
		let data = this.board[cell];
		let state = this.state[cell];
		if (ev.code == "ArrowUp") {
			if (this.hoveredY > 0) {
				this.hoveredY -= 1;
			}
			return true;
		} else if (ev.code == "ArrowDown") {
			if (this.hoveredY < this.height-1) {
				this.hoveredY += 1;
			}
			return true;
		} else if (ev.code == "ArrowLeft") {
			if (this.hoveredX > 0) {
				this.hoveredX -= 1;
			}
			return true;
		} else if (ev.code == "ArrowRight") {
			if (this.hoveredX < this.width-1) {
				this.hoveredX += 1;
			}
			return true;
		}
		if (this.setterMode) {
			console.log(ev.code);
			if (ev.code == "NumpadDecimal") {
				this.board[cell] = { type: "number" };
				return true;
			} else if (ev.code == "NumpadAdd") {
				this.board[cell] = { type: "separator" };
				return true;
			} else if (ev.code == "NumpadMultiply") {
				this.board[cell] = { type: "separator", label: '×' };
				return true;
			}
		}
		if (data.type != "number") { return; }
		if (ev.shiftKey) {
			let key = keymap[ev.code];
			if (key) {
				state.pencil[key] = !state.pencil[key];
				return true;
			}
		} else {
			if (ev.code == "Backspace") {
				state.value = null;
				return true;
			}
			let key = keymap[ev.code];
			if (key) {
				state.value = key;
				return true;
			}
		}
	}
	updateHovered(ev) {
		this.hoveredX = Math.floor((ev.offsetX - game.offsetX()) / this.cellSize);
		this.hoveredY = Math.floor((ev.offsetY - game.offsetY()) / this.cellSize);
	}
	offsetX() {
		let c = this.cellSize;
		return Math.floor((canvas.width - this.width * c) / 2);
	}
	offsetY() {
		let c = this.cellSize;
		return Math.floor((canvas.height - this.height * c) / 2);
	}
	markDuplicate() {
		// cols
		for (let i = 0; i < this.width; i++) {
			let dupes = [,0,0,0,0,0,0,0,0,0];
			for (let j = 0; j < this.height; j++) {
				let state = this.state[i+j*this.width];
				if (state) { dupes[state.value] += 1; }
			}
			for (let j = 0; j < this.height; j++) {
				let state = this.state[i+j*this.width];
				if (state) {
					state.duplicate = dupes[state.value] > 1;
				}
			}
		}
		// cols
		for (let j = 0; j < this.height; j++) {
			let dupes = [,0,0,0,0,0,0,0,0,0];
			for (let i = 0; i < this.width; i++) {
				let state = this.state[i+j*this.width];
				if (state) { dupes[state.value] += 1; }
			}
			for (let i = 0; i < this.width; i++) {
				let state = this.state[i+j*this.width];
				if (state) {
					state.duplicate |= dupes[state.value] > 1;
				}
			}
		}
	}
	checkClue(clue, start, is_vertical) {
		// this is probably a bit overcomplicated, but at least it should be
		// fairly easy to extend
		if(clue == "") return true;
		let len = is_vertical ? this.height : this.width;
		let tokens = [];
		let this_token = "";
		let this_token_type = null;
		for(let i = 0; i < len; i++) {
			let cellx = is_vertical ? start : i;
			let celly = is_vertical ? i : start;
			let cell = cellx + this.width*celly;
			if(this.board[cell].type == "number") {
				if(!this.state[cell] || !this.state[cell].value) {
					// at least one number cell is empty - don't check the line sum yet
					return true;
				}
				let val = this.state[cell].value;
				if(this_token_type == "number") this_token += val;
				else {
					if(this_token_type) {
						tokens.push({type: this_token_type, val: this_token});
					}
					this_token = ""+val;
					this_token_type = "number";
				}
			} else if(this.board[cell].type == "separator") {
				let oper = this.board[cell].oper;
				// ignore multiple of the same operator
				if(this_token_type == "oper" && this_token == oper) continue;
				else {
					if(this_token_type) {
						tokens.push({type: this_token_type, val: this_token});
					}
					this_token = oper;
					this_token_type = "oper";
				}
			}
		}
		if(this_token_type) tokens.push({type: this_token_type, val: this_token});

		// remove leading/trailing operators
		while(tokens[0].type == "oper") tokens.shift();
		while(tokens[tokens.length-1].type == "oper") tokens.pop();

		let parse_muldiv = function(tokens) {
			// this assumes the expression is well-formed
			let prod = +tokens.shift().val;
			while(tokens[0] && tokens[0].val == "mul") {
				tokens.shift();
				prod = prod * (+tokens.shift().val);
			}
			return prod;
		}
		let parse_addsub = function(tokens) {
			let sum = parse_muldiv(tokens);
			while(tokens[0] && tokens[0].val == "add") {
				tokens.shift();
				sum += parse_muldiv(tokens);
			}
			return sum;
		}
		let sum = parse_addsub(tokens);

		// XXX: this is special cased as the only non-exact clue
		if(clue === "<10k") return sum < 10000;
		return +clue === sum;
	}
	drawGrid() {
		ctx.clearRect(0,0,canvas.width,canvas.height);
		ctx.strokeStyle = this.colors.fg;
		ctx.lineWidth = 1.0;
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		let c = this.cellSize;

		let ox = this.offsetX() + 0.5;
		let oy = this.offsetY() + 0.5;

		for (let i = 0; i < this.width; i++) {
			for (let j = 0; j < this.height; j++) {
				this.drawCell(i,j,ox,oy);
			}
		}
		// Draw the grid on top
		ctx.beginPath();
		for (let i = 0; i <= this.height; i++) {
			ctx.moveTo(ox,                  oy + i * c);
			ctx.lineTo(ox + this.width * c, oy + i * c);
		}
		for (let i = 0; i <= this.width; i++) {
			ctx.moveTo(ox + i * c, oy);
			ctx.lineTo(ox + i * c, oy + this.height * c);
		}
		ctx.stroke();
		ctx.font = "20px sans-serif";
		// Draw clues
		for (let i in this.colClues) {
			if(this.checkClue(this.colClues[i], +i, true)) {
				ctx.fillStyle = this.colors.bg;
			} else {
				ctx.fillStyle = "#f30";
			}
			ctx.fillText(this.colClues[i], ox + i * c + c/2, oy - c/2, c);
		}
		for (let i in this.rowClues) {
			if(this.checkClue(this.rowClues[i], +i, false)) {
				ctx.fillStyle = this.colors.bg;
			} else {
				ctx.fillStyle = "#f30";
			}
			ctx.fillText(this.rowClues[i], ox - c/2, oy + i * c + c/2, c);
		}
	}
	drawCell(i,j,ox,oy) {
		let data = this.board[i+j*this.width];
		let state = this.state[i+j*this.width];
		if (!data) { return; }
		if (data.type == "separator") {
			ctx.fillStyle = this.colors.fg;
		} else {
			ctx.fillStyle = this.colors.bg;
		}
		let c = this.cellSize;
		ctx.fillRect(ox + i*c, oy + j*c, c, c);
		if (this.hoveredX == i && this.hoveredY == j) {
			ctx.save();
			ctx.strokeStyle = "#0033ff88";
			ctx.lineWidth = 3.0;
			ctx.strokeRect(ox + i*c + 2, oy + j*c + 2, c - 4, c - 4);
			ctx.restore();
		}
		if (data.type == "separator" && data.label) {
			ctx.save();
			ctx.fillStyle = this.colors.bg;
			ctx.font = "35px sans-serif";
			ctx.fillText(data.label, ox + i*c + c/2, oy + j*c + c/2 + 3.0, c);
			ctx.restore();
		}
		if (state) {
			if (state.value) {
				ctx.save();
				if (state.duplicate) {
					ctx.fillStyle = "#f30";
				} else {
					ctx.fillStyle = "#03f";
				}
				ctx.font = "35px sans-serif";
				ctx.fillText(state.value, ox + i*c + c/2, oy + j*c + c/2 + 3.0, c);
				ctx.restore();
			} else if (state.pencil) {
				let str = "";
				for (let i = 1; i <= 9; i++) { if (state.pencil[i]) { str += i; } }
				ctx.save();
				ctx.fillStyle = "#888";
				ctx.font = "20px sans-serif";
				ctx.fillText(str, ox + i*c + c/2, oy + j*c + c/2 + 3.0, c);
				ctx.restore();
			}
		}
	}
}

/*
let game = Board.fromText(`
...++..
+....*.
.+++..+
...+...
....+..
+...++.
...+...`);
*/

//game.rowClues = ["329", "9516", "", "1806", "4820", "178", "581"];
//game.colClues = ["597", "", "5721", "", "982", "1937", "1317"];

let game = Board.fromText(`
.+...+.
..*...+
+..+...
..+.+++
.+..+..
...+...
+.++..+`);
game.rowClues = ["492", "<10k", "368", "85", "67", "431", "45"];
game.colClues = ["843", "569", "53", "174", "537", "476", "55"];
game.drawGrid();
window.game = game;

canvas.addEventListener("mousedown", ev => {
	game.updateHovered(ev);
	game.drawGrid();
});

document.addEventListener("keydown", ev => {
	if(game.updateInput(ev)) {
		game.markDuplicate();
		game.saveState();
		game.drawGrid();
		ev.preventDefault();
	}
});

function exportState() {
	let bits = new BitWriter();
	for (let i of game.state) {
		if (i) {
			bits.push(i.value ? 1 : 0);
			bits.push(i.pencil.find(a => a) ? 1 : 0);
		}
	}
	for (let i of game.state) {
		if (!i) { continue; }
		if (i.value) {
			bits.pushVal(i.value, 4);
		}
		if (i.pencil.find(a => a)) {
			for (let f of i.pencil) {
				bits.push(f);
			}
		}
	}
	console.log(bits.bits.join(''));
}


class BitWriter {
	constructor() {
		this.bits = [];
	}
	push(bit) {
		this.bits.push(bit & 1);
	}
	pushVal(bits, len) {
		for (let i = 0; i < len; i++) {
			this.push(bits);
			bits >>= 1;
		}
	}
}
