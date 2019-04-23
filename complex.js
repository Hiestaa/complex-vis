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
        const context = this.canvas.getContext('2d');
        context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (const component of this.components) {
            component.render();
        }
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
    RADIUS = 5;
    // FIXME: if the radius is in px as it is now, we can't reliably know whether a given click happens
    // inside a marker or not since both the mouse position and the marker position are in the grid coordinates
    // Also keep in mind the X and Y unit don't have the same size in px.

    constructor(tctx, x, y, name, color) {
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

    _onMouseDown(x, y, e, realX, realY) {
        const myPos = this.tctx.transform({x: this.x, y: this.y});
        if (Math.pow(myPos.x + this.RADIUS - realX, 2) + Math.pow(myPos.y + this.RADIUS - realY, 2) < Math.pow(this.RADIUS * 4, 2)) {
            this.selected = true;
        }
    }

    _onMouseUp() {
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
    MAX_ITER = 10;  // maximum number of iteration
    MAX_ITER_DIST_FROM_0 = 0.01;  // stop iterations if the value is close to the 0 than this amount on any dimension
    ITER_RADIUS = 3;

    constructor(tctx, markers) {
        this.tctx = tctx;
        this.markers = markers;
        if (this.markers.length === 0) {
            throw new Exception('Iterator needs at least 1 marker to iterate');
        }
    }

    iter(complexes) {
        return complexes[0].multiply(complexes[0]);
    }

    render() {
        const complexes = this.markers.map(m => new Complex(m.x, m.y));
        this.tctx.moveTo(complexes[0].r, complexes[0].i);
        for (let index = 0; index < this.MAX_ITER; index++) {
            complexes[0] = this.iter(complexes);
            this.tctx.lineTo(complexes[0].r, complexes[0].i);
            this.tctx.stroke();
            this.tctx.circle(complexes[0].r, complexes[0].i, this.ITER_RADIUS, 'lightgrey');
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

const tctx = new TranslatingContext(canvas, 3, 3, 0.1);

evLoop.registerCoordinateTransform(tctx.inverseTransform.bind(tctx));

const marker1 = new MovableMarker(tctx, 0.1, 0.2, 'A', 'red');
const marker2 = new MovableMarker(tctx, 2, 5, 'B', 'green');
const iterator = new Iterator(tctx, [marker1, marker2]);
// const marker3 = new MovableMarker(tctx, -2, 5, 'test 4', 'lightblue');

evLoop.registerComponent(marker1);
// evLoop.registerComponent(marker2);
evLoop.registerComponent(iterator);
evLoop.registerComponent(tctx);