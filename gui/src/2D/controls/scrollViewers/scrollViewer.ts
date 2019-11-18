import { Nullable } from "babylonjs/types";
import { Observer } from "babylonjs/Misc/observable";
import { PointerInfo, PointerEventTypes } from "babylonjs/Events/pointerEvents";

import { Rectangle } from "../rectangle";
import { Grid } from "../grid";
import { Image } from "../image";
import { Control } from "../control";
import { Container } from "../container";
import { Measure } from "../../measure";
import { AdvancedDynamicTexture } from "../../advancedDynamicTexture";
import { _ScrollViewerWindow } from "./scrollViewerWindow";
import { ScrollBar } from "../sliders/scrollBar";
import { ImageScrollBar } from "../sliders/imageScrollBar";
import { _TypeStore } from 'babylonjs/Misc/typeStore';

/**
 * Class used to hold a viewer window and sliders in a grid
*/
export class ScrollViewer extends Rectangle {
    private _grid: Grid;
    private _horizontalBarSpace: Rectangle;
    private _verticalBarSpace: Rectangle;
    private _dragSpace: Rectangle;
    private _horizontalBar: ScrollBar | ImageScrollBar;
    private _verticalBar: ScrollBar | ImageScrollBar;
    private _barColor: string;
    private _barBackground: string;
    private _barImage: Image;
    private _barBackgroundImage: Image;
    private _barSize: number = 20;
    private _endLeft: number;
    private _endTop: number;
    private _window: _ScrollViewerWindow;
    private _pointerIsOver: Boolean = false;
    private _wheelPrecision: number = 0.05;
    private _onPointerObserver: Nullable<Observer<PointerInfo>>;
    private _clientWidth: number;
    private _clientHeight: number;
    private _useImageBar: Boolean;
    private _thumbSize: number = 1;

    /**
     * Gets the horizontal scrollbar
     */
    public get horizontalBar(): ScrollBar | ImageScrollBar {
        return this._horizontalBar;
    }

    /**
     * Gets the vertical scrollbar
     */
    public get verticalBar(): ScrollBar | ImageScrollBar {
        return this._verticalBar;
    }

    /**
     * Adds a new control to the current container
     * @param control defines the control to add
     * @returns the current container
     */
    public addControl(control: Nullable<Control>): Container {
        if (!control) {
            return this;
        }

        this._window.addControl(control);

        return this;
    }

    /**
     * Removes a control from the current container
     * @param control defines the control to remove
     * @returns the current container
     */
    public removeControl(control: Control): Container {
        this._window.removeControl(control);
        return this;
    }

    /** Gets the list of children */
    public get children(): Control[] {
        return this._window.children;
    }

    public _flagDescendantsAsMatrixDirty(): void {
        for (var child of this._children) {
            child._markMatrixAsDirty();
        }
    }

    /**
    * Creates a new ScrollViewer
    * @param name of ScrollViewer
    */
    constructor(name?: string, isImageBased?: boolean) {
        super(name);

        this._useImageBar = isImageBased ? isImageBased : false;

        this.onDirtyObservable.add(() => {
            this._horizontalBarSpace.color = this.color;
            this._verticalBarSpace.color = this.color;
            this._dragSpace.color = this.color;
        });

        this.onPointerEnterObservable.add(() => {
            this._pointerIsOver = true;
        });

        this.onPointerOutObservable.add(() => {
            this._pointerIsOver = false;
        });

        this._grid = new Grid();
        if (this._useImageBar) {
            this._horizontalBar = new ImageScrollBar();
            this._verticalBar = new ImageScrollBar();
        }
        else {
            this._horizontalBar = new ScrollBar();
            this._verticalBar = new ScrollBar();
        }

        this._window = new _ScrollViewerWindow();
        this._window.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this._window.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;

        this._grid.addColumnDefinition(1);
        this._grid.addColumnDefinition(0, true);
        this._grid.addRowDefinition(1);
        this._grid.addRowDefinition(0, true);

        super.addControl(this._grid);
        this._grid.addControl(this._window, 0, 0);

        this._verticalBarSpace = new Rectangle();
        this._verticalBarSpace.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this._verticalBarSpace.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this._verticalBarSpace.thickness = 1;
        this._grid.addControl(this._verticalBarSpace, 0, 1);
        this._addBar(this._verticalBar, this._verticalBarSpace, true, Math.PI);

        this._horizontalBarSpace = new Rectangle();
        this._horizontalBarSpace.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_LEFT;
        this._horizontalBarSpace.verticalAlignment = Control.VERTICAL_ALIGNMENT_TOP;
        this._horizontalBarSpace.thickness = 1;
        this._grid.addControl(this._horizontalBarSpace, 1, 0);
        this._addBar(this._horizontalBar, this._horizontalBarSpace, false, 0);

        this._dragSpace = new Rectangle();
        this._dragSpace.thickness = 1;
        this._grid.addControl(this._dragSpace, 1, 1);

        // Colors
        if (!this._useImageBar) {
            this.barColor = "grey";
            this.barBackground = "transparent";
        }
    }

    /** Reset the scroll viewer window to initial size */
    public resetWindow() {
        this._window.width = "100%";
        this._window.height = "100%";
    }

    protected _getTypeName(): string {
        return "ScrollViewer";
    }

    private _buildClientSizes() {
        this._window.parentClientWidth = this._currentMeasure.width - (this._verticalBar.isVisible ? this._barSize : 0) - 2 * this.thickness;
        this._window.parentClientHeight = this._currentMeasure.height - (this._horizontalBar.isVisible ? this._barSize : 0) - 2 * this.thickness;

        this._clientWidth = this._window.parentClientWidth;
        this._clientHeight = this._window.parentClientHeight;
    }

    protected _additionalProcessing(parentMeasure: Measure, context: CanvasRenderingContext2D): void {
        super._additionalProcessing(parentMeasure, context);

        this._buildClientSizes();
    }

    protected _postMeasure(): void {
        super._postMeasure();

        this._updateScroller();
    }

    /**
     * Gets or sets the mouse wheel precision
     * from 0 to 1 with a default value of 0.05
     * */
    public get wheelPrecision(): number {
        return this._wheelPrecision;
    }

    public set wheelPrecision(value: number) {
        if (this._wheelPrecision === value) {
            return;
        }

        if (value < 0) {
            value = 0;
        }

        if (value > 1) {
            value = 1;
        }

        this._wheelPrecision = value;
    }

    /** Gets or sets the scroll bar container background color */
    public get scrollBackground(): string {
        return this._dragSpace.background;
    }

    public set scrollBackground(color: string) {
        if (this._dragSpace.background === color) {
            return;
        }

        this._dragSpace.background = color;
    }

    /** Gets or sets the bar color */
    public get barColor(): string {
        return this._barColor;
    }

    public set barColor(color: string) {
        if (this._barColor === color) {
            return;
        }

        this._barColor = color;
        this._horizontalBar.color = color;
        this._verticalBar.color = color;
    }

    /** Gets or sets the bar image */
    public get barImage(): Image {
        return this._barImage;
    }

    public set barImage(value: Image) {
        if (this._barImage === value) {
            return;
        }

        this._barImage = value;
        let hb = <ImageScrollBar>this.horizontalBar;
        let vb = <ImageScrollBar>this._verticalBar;
        hb.thumbImage = value;
        vb.thumbImage = value;
    }

    /** Gets or sets the size of the bar */
    public get barSize(): number {
        return this._barSize;
    }

    public set barSize(value: number) {
        if (this._barSize === value) {
            return;
        }

        this._barSize = value;
        this._markAsDirty();

        if (this._horizontalBar.isVisible) {
            this._grid.setRowDefinition(1, this._barSize, true);
        }
        if (this._verticalBar.isVisible) {
            this._grid.setColumnDefinition(1, this._barSize, true);
        }
    }

    /** Gets or sets the size of the thumb */
    public get thumbSize(): number {
        return this._thumbSize;
    }

    public set thumbSize(value: number) {
        if (this._thumbSize === value) {
            return;
        }

        this._thumbSize = value;
        this._markAsDirty();
    }

    /** Gets or sets the bar background */
    public get barBackground(): string {
        return this._barBackground;
    }

    public set barBackground(color: string) {
        if (this._barBackground === color) {
            return;
        }

        this._barBackground = color;
        let hb = <ScrollBar>this._horizontalBar;
        let vb = <ScrollBar>this._verticalBar;
        hb.background = color;
        vb.background = color;
        this._dragSpace.background = color;
    }

    /** Gets or sets the bar background image */
    public get barBackgroundImage(): Image {
        return this._barBackgroundImage;
    }

    public set barBackgroundImage(value: Image) {
        if (this._barBackgroundImage === value) {
        }

        this._barBackgroundImage = value;
        let hb = <ImageScrollBar>this._horizontalBar;
        let vb = <ImageScrollBar>this._verticalBar;
        hb.backgroundImage = value;
        vb.backgroundImage = value;
    }

    /** @hidden */
    private _updateScroller(): void {
        let windowContentsWidth = this._window._currentMeasure.width;
        let windowContentsHeight = this._window._currentMeasure.height;

        if (this._horizontalBar.isVisible && windowContentsWidth <= this._clientWidth) {
            this._grid.setRowDefinition(1, 0, true);
            this._horizontalBar.isVisible = false;
            this._horizontalBar.value = 0;
            this._rebuildLayout = true;
        }
        else if (!this._horizontalBar.isVisible && windowContentsWidth > this._clientWidth) {
            this._grid.setRowDefinition(1, this._barSize, true);
            this._horizontalBar.isVisible = true;
            this._rebuildLayout = true;
        }

        if (this._verticalBar.isVisible && windowContentsHeight <= this._clientHeight) {
            this._grid.setColumnDefinition(1, 0, true);
            this._verticalBar.isVisible = false;
            this._verticalBar.value = 0;
            this._rebuildLayout = true;
        }
        else if (!this._verticalBar.isVisible && windowContentsHeight > this._clientHeight) {
            this._grid.setColumnDefinition(1, this._barSize, true);
            this._verticalBar.isVisible = true;
            this._rebuildLayout = true;
        }

        this._buildClientSizes();
        this._endLeft = this._clientWidth - windowContentsWidth;
        this._endTop = this._clientHeight - windowContentsHeight;

        const newLeft = this._horizontalBar.value * this._endLeft + "px";
        const newTop = this._verticalBar.value * this._endTop + "px";

        if (newLeft !== this._window.left) {
            this._window.left = newLeft;
            this._rebuildLayout = true;
        }

        if (newTop !== this._window.top) {
            this._window.top = newTop;
            this._rebuildLayout = true;
        }

        if (this._useImageBar && this._barImage) {
            this._horizontalBar.thumbWidth = Math.min(0.9 * this._clientWidth, this._thumbSize * this._barImage.domImage.width * this._horizontalBarSpace.heightInPixels / this._barImage.domImage.height) + "px";
            this._verticalBar.thumbWidth = Math.min(0.9 * this._clientHeight, this._thumbSize * this._barImage.domImage.width * this._verticalBarSpace.widthInPixels / this._barImage.domImage.height) + "px";
        }
        else {
            let horizontalMultiplicator = this._clientWidth / windowContentsWidth;
            let verticalMultiplicator = this._clientHeight / windowContentsHeight;

            this._horizontalBar.thumbWidth = Math.min(0.9 * this._clientWidth, this._thumbSize * (this._clientWidth * horizontalMultiplicator)) + "px";
            this._verticalBar.thumbWidth = Math.min(0.9 * this._clientHeight, this._thumbSize * (this._clientHeight * verticalMultiplicator)) + "px";
        }
    }

    public _link(host: AdvancedDynamicTexture): void {
        super._link(host);

        this._attachWheel();
    }

    /** @hidden */
    private _addBar(barControl: ScrollBar | ImageScrollBar, barContainer: Rectangle, isVertical: boolean, rotation: number) {
        barControl.paddingLeft = 0;
        barControl.width = "100%";
        barControl.height = "100%";
        barControl.barOffset = 0;
        barControl.value = 0;
        barControl.maximum = 1;
        barControl.horizontalAlignment = Control.HORIZONTAL_ALIGNMENT_CENTER;
        barControl.verticalAlignment = Control.VERTICAL_ALIGNMENT_CENTER;
        barControl.isVertical = isVertical;
        barControl.rotation = rotation;
        barControl.isVisible = false;

        barContainer.addControl(barControl);

        barControl.onValueChangedObservable.add((value) => {
            if (rotation > 0) {
                this._window.top = value * this._endTop + "px";
            }
            else {
                this._window.left = value * this._endLeft + "px";
            }
        });
    }

    /** @hidden */
    private _attachWheel() {
        if (!this._host || this._onPointerObserver) {
            return;
        }

        let scene = this._host.getScene();
        this._onPointerObserver = scene!.onPointerObservable.add((pi, state) => {
            if (!this._pointerIsOver || pi.type !== PointerEventTypes.POINTERWHEEL) {
                return;
            }
            if (this._verticalBar.isVisible == true) {
                if ((<MouseWheelEvent>pi.event).deltaY < 0 && this._verticalBar.value > 0) {
                    this._verticalBar.value -= this._wheelPrecision;
                } else if ((<MouseWheelEvent>pi.event).deltaY > 0 && this._verticalBar.value < this._verticalBar.maximum) {
                    this._verticalBar.value += this._wheelPrecision;
                }
            }
            if (this._horizontalBar.isVisible == true) {
                if ((<MouseWheelEvent>pi.event).deltaX < 0 && this._horizontalBar.value < this._horizontalBar.maximum) {
                    this._horizontalBar.value += this._wheelPrecision;
                } else if ((<MouseWheelEvent>pi.event).deltaX > 0 && this._horizontalBar.value > 0) {
                    this._horizontalBar.value -= this._wheelPrecision;
                }
            }
        });
    }

    public _renderHighlightSpecific(context: CanvasRenderingContext2D): void {
        if (!this.isHighlighted) {
            return;
        }

        super._renderHighlightSpecific(context);

        this._grid._renderHighlightSpecific(context);

        context.restore();
    }

    /** Releases associated resources */
    public dispose() {
        let scene = this._host.getScene();
        if (scene && this._onPointerObserver) {
            scene.onPointerObservable.remove(this._onPointerObserver);
            this._onPointerObserver = null;
        }
        super.dispose();
    }
}
_TypeStore.RegisteredTypes["BABYLON.GUI.ScrollViewer"] = ScrollViewer;