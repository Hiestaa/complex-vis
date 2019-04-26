const TEXT_HEIGHT_PX = 15;

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

class EventsLoop {
    constructor(canvas) {
        this.canvas = canvas;
        this.components = [];
        this._mouseEventHandlers = {};
        this.canvas.addEventListener('mousemove', this._onMouseEvent('move'));
        this.canvas.addEventListener('mousedown', this._onMouseEvent('down'));
        this.canvas.addEventListener('mouseup', this._onMouseEvent('up'));

        this._mousePos = { x: 0, y: 0 };
        this._realMousePos = { x: 0, y: 0 };
        this._coordinateTransforms = []

        document.getElementById('iterations').addEventListener('input', this._onControlEvent.bind(this));
        document.getElementById('iterations-radius').addEventListener('input', this._onControlEvent.bind(this));
        document.getElementById('iterations-line-width').addEventListener('input', this._onControlEvent.bind(this));
        document.getElementById('painter-marker-variable').addEventListener('change', this._onControlEvent.bind(this));

        setInterval(this.redraw.bind(this), 100)
    }

    /**
     * Register a component to be redrawn after each event loop
     * The order in which the components are registered matters, as first registered will be the first drawn.
     * All components should implement the `render` method.
     */
    registerComponent(component) {
        this.components.push(component);
        this.redraw();
    }

    redraw() {
        const start = Date.now();
        const context = this.canvas.getContext('2d');
        context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (const component of this.components) {
            component.render();
        }
        const duration = Date.now() - start;
        context.fillText(duration.toString() + 'ms', 10, canvas.height - 10);
    }

    /**
     * Register a handler function for a mouse events.
     * All mouse move events handler will be triggered before a redraw happens.
     * @param {Function} handler - should take (x, y) mouse position and the event itself as parameters,
     *  in canvas coordinate
     */
    registerMouseEvent(handler, event) {
        this._mouseEventHandlers[event] = this._mouseEventHandlers[event] || [];
        this._mouseEventHandlers[event].push(handler);
    }

    registerMouseMoveEvent(handler) { this.registerMouseEvent(handler, 'move'); }
    registerMouseUpEvent(handler) { this.registerMouseEvent(handler, 'up'); }
    registerMouseDownEvent(handler) { this.registerMouseEvent(handler, 'down'); }

    _onMouseEvent(event) {
        return (e) => {
            [this._mousePos, this._realMousePos] = this._getMousePos(e);
            for (const handler of (this._mouseEventHandlers[event] || [])) {
                handler(this._mousePos.x, this._mousePos.y, e, this._realMousePos.x, this._realMousePos.y);
            }
            this.redraw();
        }
    }

    _onControlEvent() {
        this.redraw();
    }

    // Get the position of the mouse relative to the canvas
    // Returns the position and the initial position without any transformation applied.
    _getMousePos(mouseEvent) {
        const rect = this.canvas.getBoundingClientRect();
        const initialPos = {
            x: mouseEvent.clientX - rect.left,
            y: mouseEvent.clientY - rect.top
        };
        let pos = initialPos
        for (const transform of this._coordinateTransforms) {
            pos = transform(pos);
        }
        return [pos, initialPos];
    }

    registerCoordinateTransform(fn) {
        this._coordinateTransforms.push(fn);
    }
}

const evLoop = new EventsLoop(canvas);

class TranslatingContext {
    constructor(canvas, width, height, unit) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');;
        this.width = width || 10;
        this.height = height || 10;
        this.unit = unit || 1;
        this.canvasWidth = canvas.width;
        this.canvasHeight = canvas.height;
        this.curMousePos = {x: 0, y: 0};

        evLoop.registerMouseMoveEvent(this._onMouseMove.bind(this));
    }

    render() {
        // this.ctx.lineWidth = 1;
        // this.ctx.font = TEXT_HEIGHT_PX + 'px serif';
        const drawXAxis = () => {
            this.moveTo(-this.width / 2, 0);
            this.lineTo(this.width / 2, 0);
            this.stroke();
        }
        const drawYAxis = () => {
            this.moveTo(0, -this.height / 2);
            this.lineTo(0, this.height / 2);
            this.stroke();
        }
        const drawXPeg = (peg) => {
            this.moveTo(peg, 0, 0, -5);
            this.lineTo(peg, 0, 0, 5);
            this.stroke();
            const pegStr = peg.toString().slice(0, 5);
            const pegText = this.ctx.measureText(pegStr);
            if (peg === 0) {
                this.fillText(pegStr, peg, 0, -pegText.width * 2, - TEXT_HEIGHT_PX - 10);
            } else {
                this.fillText(pegStr, peg, 0, -pegText.width / 2, - TEXT_HEIGHT_PX - 10);
            }
            this.stroke();
        }
        const drawYPeg = (peg) => {
            this.moveTo(0, peg, -5, 0);
            this.lineTo(0, peg, 5, 0);
            this.stroke();
            const pegStr = peg.toString().slice(0, 5);
            const pegText = this.ctx.measureText(pegStr);
            if (peg !== 0) {
                this.fillText(pegStr, 0, peg, - pegText.width - 10, - TEXT_HEIGHT_PX / 4);
            }
            this.stroke();
        }
        const drawPegs = (dim, drawFn) => {
            for (let peg = 0; peg * this.unit <= dim / 2; peg += 1) {
                drawFn(peg * this.unit);
            }
            for (let peg = 0; peg * this.unit >= -dim / 2; peg -= 1) {
                drawFn(peg * this.unit);
            }
        }

        drawXAxis();
        drawYAxis();
        drawPegs(this.width, drawXPeg);
        drawPegs(this.height, drawYPeg);

        // mouse position
        this.ctx.fillText('(' + this.curMousePos.x.toString().slice(0, 5) + ', ' +
            this.curMousePos.y.toString().slice(0, 5) + ')',
            10, 10);
    }

    moveTo(x, y, offsetX=0, offsetY=0) {
        return this.ctx.moveTo(this._toCanvasX(x) + offsetX, this._toCanvasY(y) - offsetY);
    }

    lineTo(x, y, offsetX=0, offsetY=0) {
        return this.ctx.lineTo(this._toCanvasX(x) + offsetX, this._toCanvasY(y) - offsetY);
    }

    fillText(text, x, y, offsetX=0, offsetY=0) {
        return this.ctx.fillText(
            text, this._toCanvasX(x) + offsetX, this._toCanvasY(y) - offsetY)
    }

    set(props) {
        for (const prop in props) {
            if (props.hasOwnProperty(prop)) {
                this.ctx[prop] = props[prop];
            }
        }
    }

    ellipse(x, y, radiusX, radiusY, startAngle, endAngle, anticlockwise) {
        if (!(this._toCanvasX(x) > 0 && this._toCanvasX(x) < this.canvasWidth &&
              this._toCanvasY(y) > 9 && this._toCanvasY(y) < this.canvasHeight)) {
            return;
        }
        return this.ctx.ellipse(
            this._toCanvasX(x),
            this._toCanvasY(y),
            this._normX(radiusX),
            this._normY(radiusY),
            startAngle,
            endAngle,
            anticlockwise
        );
    }

    arc(x, y, radius, startAngle, endAngle, anticlockwise) {
        if (!(this._toCanvasX(x) > 0 && this._toCanvasX(x) < this.canvasWidth &&
            this._toCanvasY(y) > 9 && this._toCanvasY(y) < this.canvasHeight)) {
            return;
        }
        return this.ctx.arc(
            this._toCanvasX(x),
            this._toCanvasY(y),
            radius,
            startAngle,
            endAngle,
            anticlockwise
        );
    }

    circle(x, y, radius, fillColor) {
        this.beginPath();
        this.arc(x, y, radius, 0, 2 * Math.PI, false);
        this.set({
            fillStyle: fillColor
        });
        this.fill();
        this.set({
            fillStyle: 'black'
        });
    }

    beginPath() { return this.ctx.beginPath(); }
    stroke() { return this.ctx.stroke(); }
    fill() { return this.ctx.fill(); }

    _normX(x) {
        return x / this.width * this.canvasWidth;
    }
    _transX(x) {
        return x + this.canvasWidth / 2;
    }
    _toCanvasX(x) {
        return this._transX(this._normX(x));
    }
    _normY(y) {
        return (y / this.height * this.canvasHeight)
    }
    _transY(y) {
        return - y + this.canvasHeight / 2;
    }
    _toCanvasY(y) {
        return this._transY(this._normY(y));
    }
    _fromCanvasX(x) {
        return (x - this.canvasWidth / 2) * this.width / this.canvasWidth;
    }

    _fromCanvasY(y) {
        return (y - this.canvasHeight / 2) * -this.height / this.canvasHeight;
    }

    _onMouseMove(x, y) {
        this.curMousePos = {x, y};
    }

    transform({x, y}) {
        return {
            x: this._toCanvasX(x),
            y: this._toCanvasY(y)
        }
    }

    inverseTransform({x, y}) {
        return {
            x: this._fromCanvasX(x),
            y: this._fromCanvasY(y)
        }
    }
}

class MovableMarker {
    constructor(tctx, x, y, name, color) {
        this.RADIUS = 5;
        this.initialPosX = x;
        this.initialPosY = y;
        this.x = x;
        this.y = y;
        this.tctx = tctx;
        this.color = color;
        this.name = name;

        this.selected = false;

        evLoop.registerMouseDownEvent(this._onMouseDown.bind(this));
        evLoop.registerMouseUpEvent(this._onMouseUp.bind(this));
        evLoop.registerMouseMoveEvent(this._onMouseMove.bind(this));

        this.onChange = [];
    }

    render() {
        this.tctx.circle(this.x, this.y, this.RADIUS, this.color);

        if (this.selected)  {
            this.tctx.moveTo(this.x, this.y, -3, 0);
            this.tctx.lineTo(this.x, this.y, 3, 0);
            this.tctx.stroke();
            this.tctx.moveTo(this.x, this.y, 0, -3);
            this.tctx.lineTo(this.x, this.y, 0, 3);
            this.tctx.stroke();
        }

        const nameText = this.tctx.ctx.measureText(this.name);
        this.tctx.fillText(this.name, this.x, this.y, - nameText.width / 2, - TEXT_HEIGHT_PX * 1.2)
    }

    registerUpdate(fn) {
        this.onChange.push(fn);
    }

    _onMouseDown(x, y, e, realX, realY) {
        const myPos = this.tctx.transform({x: this.x, y: this.y});
        if (Math.pow(myPos.x + this.RADIUS - realX, 2) + Math.pow(myPos.y + this.RADIUS - realY, 2) < Math.pow(this.RADIUS * 4, 2)) {
            this.selected = true;
        }
    }

    _onMouseUp() {
        if (this.selected) {
            for (const handler of this.onChange) {
                handler(this);
            }
        }
        this.selected = false;
    }

    _onMouseMove(x, y, e, realX, realY) {
        if (this.selected) {
            const newPos = this.tctx.inverseTransform({
                x: realX - this.RADIUS * 2,
                y: realY - this.RADIUS * 2
            });
            this.x = newPos.x;
            this.y = newPos.y;
        }
    }
}

class Iterator {
    constructor(tctx, markers) {
        this.MAX_ITER = 1000;  // maximum number of iteration
        this.MAX_ITER_DIST_FROM_0 = 0.01;  // stop iterations if the value is close to the 0 than this amount on any dimension
        this.ITER_RADIUS = 1;

        this.tctx = tctx;
        this.markers = markers;
        if (this.markers.length === 0) {
            throw new Exception('Iterator needs at least 1 marker to iterate');
        }
    }

    iter(complexes) {
        let res = complexes[0].multiply(complexes[0]);
        if (complexes.length > 1) {
            res = res.add(complexes[1]);
        }
        return res;
    }

    registerMarkerUpdate(fn) {
        for (const marker of this.markers) {
            marker.registerUpdate(fn);
        }
    }

    render() {
        this.MAX_ITER = parseInt(document.getElementById('iterations').value, 10);
        this.ITER_RADIUS = parseInt(document.getElementById('iterations-radius').value, 10);
        this.ITER_LINE_WIDTH = parseInt(document.getElementById('iterations-line-width').value, 10);
        document.getElementById('iterations-value').textContent = this.MAX_ITER;
        document.getElementById('iterations-radius-value').textContent = this.ITER_RADIUS;
        document.getElementById('iterations-line-width-value').textContent = this.ITER_LINE_WIDTH;

        const complexes = this.markers.map(m => new Complex(m.x, m.y));
        this.tctx.moveTo(complexes[0].r, complexes[0].i);
        for (let index = 0; index < this.MAX_ITER; index++) {
            complexes[0] = this.iter(complexes);
            if (this.ITER_LINE_WIDTH > 0) {
                this.tctx.set({lineWidth: this.ITER_LINE_WIDTH});
                this.tctx.lineTo(complexes[0].r, complexes[0].i);
                this.tctx.stroke();
                this.tctx.set({lineWidth: 1});
            }
            else {
                this.tctx.moveTo(complexes[0].r, complexes[0].i);
            }
            this.tctx.circle(complexes[0].r, complexes[0].i, this.ITER_RADIUS, 'lightgrey');
            this.tctx.stroke();
            if (Math.abs(complexes[0].r) < this.MAX_ITER_DIST_FROM_0 && Math.abs(complexes[0].i) < this.MAX_ITER_DIST_FROM_0) {
                break;
            }
        }
    }
}


class Complex {
    constructor(r, i) {
        this.r = r;
        this.i = i;
    }

    add(complex) {
        return new Complex(this.r + complex.r, this.i + complex.i);
    }

    multiply(complex) {
        return new Complex(
            this.r * complex.r - this.i * complex.i,
            this.r * complex.i + this.i * complex.r
        );
    }
}

class Painter {
    constructor(canvas, iterator, tctx) {
        this.imageData = new ImageData(canvas.width, canvas.height);
        this.resetImage();
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.iterator = iterator;
        this.iterator.registerMarkerUpdate(this.resetImage.bind(this));
        this.tctx = tctx;
        this.currentPixel = { x: -1, y: 0 };

        this.variableMarker = document.getElementById('painter-marker-variable').value;
        document.getElementById('painter-marker-variable').addEventListener('change', this.resetImage.bind(this));
        this.ITER_COLORS = [
            // [2, 155, 112], [15, 152, 119], [27, 149, 125], [40, 147, 132], [52, 144, 138], [65, 141, 145], [78, 139, 151], [90, 136, 158], [103, 133, 164],
            // [8, 0, 219], [19, 0, 218], [30, 0, 217], [41, 0, 217], [52, 0, 216], [63, 0, 216], [74, 0, 215], [85, 0, 214], [96, 0, 214], [107, 0, 213], [119, 0, 213], [130, 0, 212], [141, 0, 212], [152, 0, 211], [163, 0, 210], [174, 0, 210], [185, 0, 209], [196, 0, 209], [207, 0, 208], [219, 0, 208], [8, 0, 219], [19, 0, 219], [31, 0, 219], [43, 0, 219], [54, 0, 219], [66, 0, 219], [78, 0, 219], [89, 0, 219], [101, 0, 219], [113, 0, 219], [124, 0, 219], [136, 0, 219], [148, 0, 219], [159, 0, 219], [171, 0, 219], [183, 0, 219], [194, 0, 219], [206, 0, 219], [218, 0, 219], [219, 0, 207], [7, 0, 219], [0, 49, 219], [0, 106, 219], [0, 164, 219], [219, 79, 0], [219, 21, 0], [219, 0, 35], [219, 0, 93], [219, 0, 150], [219, 0, 207],
            // [8, 0, 219], [15, 2, 211], [22, 5, 203], [29, 7, 196], [37, 10, 188], [44, 12, 181], [51, 15, 173], [58, 17, 166], [66, 20, 158], [73, 22, 151], [80, 25, 143], [88, 28, 135], [95, 30, 128], [102, 33, 120], [109, 35, 113], [117, 38, 105], [124, 40, 98], [131, 43, 90], [138, 45, 83], [146, 48, 75], [153, 51, 67], [160, 53, 60], [168, 56, 52], [175, 58, 45], [182, 61, 37], [189, 63, 30], [197, 66, 22], [204, 68, 15], [211, 71, 7], [219, 74, 0], [8, 0, 219], [25, 0, 219], [42, 0, 219], [60, 0, 219], [77, 0, 219], [94, 0, 219], [112, 0, 219], [129, 0, 219], [147, 0, 219], [164, 0, 219], [181, 0, 219], [199, 0, 219], [216, 0, 219], [219, 0, 204], [219, 0, 186], [219, 0, 169], [219, 0, 151], [219, 0, 134], [219, 0, 117], [219, 0, 99], [219, 0, 82], [219, 0, 65], [219, 0, 47], [219, 0, 30], [219, 0, 12], [219, 4, 0], [219, 21, 0], [219, 39, 0], [219, 56, 0], [219, 73, 0], [7, 0, 219], [0, 19, 219], [0, 47, 219], [0, 75, 219]
            [0, 73, 229], [3, 71, 228], [6, 70, 227], [10, 69, 227], [13, 68, 226], [17, 67, 225], [20, 66, 225], [24, 64, 224], [27, 63, 223], [31, 62, 223], [34, 61, 222], [38, 60, 222], [41, 59, 221], [45, 57, 220], [48, 56, 220], [52, 55, 219], [55, 54, 218], [59, 53, 218], [62, 52, 217], [66, 50, 216], [69, 49, 216], [73, 48, 215], [76, 47, 215], [79, 46, 214], [83, 45, 213], [86, 44, 213], [90, 42, 212], [93, 41, 211], [97, 40, 211], [100, 39, 210], [104, 38, 209], [107, 37, 209], [111, 35, 208], [114, 34, 208], [118, 33, 207], [121, 32, 206], [125, 31, 206], [128, 30, 205], [132, 28, 204], [135, 27, 204], [139, 26, 203], [142, 25, 202], [146, 24, 202], [149, 23, 201], [152, 22, 201], [156, 20, 200], [159, 19, 199], [163, 18, 199], [166, 17, 198], [170, 16, 197], [173, 15, 197], [177, 13, 196], [180, 12, 195], [184, 11, 195], [187, 10, 194], [191, 9, 194], [194, 8, 193], [198, 6, 192], [201, 5, 192], [205, 4, 191], [208, 3, 190], [212, 2, 190], [215, 1, 189], [219, 0, 189],
            // [219, 0, 189], [219, 3, 186], [219, 6, 183], [219, 9, 180], [219, 13, 177], [219, 16, 174], [219, 19, 171], [219, 22, 168], [219, 26, 165], [219, 29, 162], [219, 32, 159], [219, 35, 156], [219, 39, 153], [219, 42, 150], [219, 45, 147], [219, 48, 144], [219, 52, 141], [219, 55, 138], [219, 58, 135], [219, 61, 132], [219, 65, 129], [219, 68, 126], [219, 71, 123], [219, 74, 120], [219, 78, 117], [219, 81, 114], [219, 84, 111], [219, 0, 188], [219, 0, 182], [219, 0, 176], [219, 0, 170], [219, 0, 163], [219, 0, 157], [219, 0, 151], [219, 0, 145], [219, 0, 138], [219, 0, 132], [219, 0, 126], [219, 0, 120], [219, 0, 113], [219, 0, 107], [219, 0, 101], [219, 0, 95], [219, 0, 88], [219, 0, 82], [219, 0, 76], [219, 0, 70], [219, 0, 63], [219, 0, 57], [219, 0, 51], [219, 0, 45], [219, 0, 38], [219, 0, 32], [219, 0, 26], [219, 0, 20], [219, 0, 13], [219, 0, 7], [219, 0, 1], [219, 4, 0], [219, 11, 0], [219, 17, 0], [219, 23, 0], [219, 29, 0], [219, 36, 0],
            // [219, 92, 0], [219, 76, 0], [219, 60, 0], [219, 44, 0], [219, 28, 0], [219, 12, 0], [219, 0, 3], [219, 0, 19], [219, 0, 35], [219, 0, 51], [219, 0, 67], [219, 0, 83], [219, 0, 99], [219, 0, 115], [219, 0, 131], [219, 0, 147], [219, 0, 163], [219, 0, 179], [219, 0, 195], [219, 0, 211], [210, 0, 219], [194, 0, 219], [178, 0, 219], [162, 0, 219], [146, 0, 219], [129, 0, 219], [113, 0, 219], [97, 0, 219], [81, 0, 219], [65, 0, 219], [49, 0, 219], [33, 0, 219], [17, 0, 219], [1, 0, 219], [0, 14, 219], [0, 30, 219], [0, 46, 219], [0, 62, 219], [0, 78, 219], [0, 94, 219], [0, 110, 219], [0, 126, 219], [0, 142, 219], [0, 158, 219], [0, 174, 219]
        ];
        this.PIXEL_BATCH = 100000;
        this.PIXEL_BATCH_INTERVAL = 10;
        setInterval(this.computeBatchPixels.bind(this), this.PIXEL_BATCH_INTERVAL);
    }

    resetImage(updatedMarker) {
        if (updatedMarker && updatedMarker.name === this.variableMarker) {
            return;
        }
        for (let i = 0; i < this.imageData.data.length; i += 4) {
            // Modify pixel data
            this.imageData.data[i + 0] = 255;  // R value
            this.imageData.data[i + 1] = 255;    // G value
            this.imageData.data[i + 2] = 255;  // B value
            this.imageData.data[i + 3] = 255;  // A value
        }
        this.currentPixel = { x: -1, y: 0 };
    }

    computeBatchPixels() {
        const start = Date.now();
        for (let index = 0; index < this.PIXEL_BATCH; index++) {
            if (Date.now() - start > this.PIXEL_BATCH_INTERVAL) { return; }
            this.computeNextPixel();
        }
    }

    computeNextPixel() {
        this.currentPixel.x += 1;
        if (this.currentPixel.x > this.imageData.width && this.currentPixel.y < this.imageData.height) {
            this.currentPixel.x = 0;
            this.currentPixel.y += 1;
        }
        if (this.currentPixel.y >= this.imageData.height) {
            return;
        }

        const i = this.currentPixel.x + this.currentPixel.y * this.imageData.width;
        const color = this._getPixelColor(this.currentPixel);
        this.imageData.data[i * 4 + 0] = color[0]
        this.imageData.data[i * 4 + 1] = color[1]
        this.imageData.data[i * 4 + 2] = color[2]
        this.imageData.data[i * 4 + 3] = 250;
    }

    render() {
        this.variableMarker = document.getElementById('painter-marker-variable').value;
        this.ctx.putImageData(this.imageData, 0, 0);
    }

    _getPixelColor(pixel) {
        const self = this;
        const complexes = this.iterator.markers.map(function (m) {
            if (m.name == self.variableMarker) {
                const itPixel = self.tctx.inverseTransform(pixel)
                return new Complex(itPixel.x, itPixel.y);
            }
            return new Complex(m.x, m.y);
        })
        for (let color = 0; color < this.ITER_COLORS.length; color++) {
            let prev = complexes[0];
            complexes[0] = this.iterator.iter(complexes);
            if (Math.abs(complexes[0].i) > 1.0 && Math.abs(complexes[0].r) > 1.0 ||
                Math.abs(complexes[0].i - prev.i) < 0.01 && Math.abs(complexes[0].r - prev.r) < 0.01) {
                return this.ITER_COLORS[Math.ceil(color)];
            }
        }
        return this.ITER_COLORS[this.ITER_COLORS.length - 1];
    }
}

const tctx = new TranslatingContext(canvas, 2.0, 2.0, 0.2);

evLoop.registerCoordinateTransform(tctx.inverseTransform.bind(tctx));

const marker1 = new MovableMarker(tctx, 0.1, 0.2, 'A', 'red');
const marker2 = new MovableMarker(tctx, -0.3, -0.5, 'B', 'green');
const iterator = new Iterator(tctx, [marker1, marker2]);
const painter = new Painter(canvas, iterator, tctx);


evLoop.registerComponent(painter);
evLoop.registerComponent(marker1);
evLoop.registerComponent(marker2);
evLoop.registerComponent(iterator);
evLoop.registerComponent(tctx);
