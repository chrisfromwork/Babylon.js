import { TransformNode } from "../../Meshes/transformNode";
import { Observable } from '../../Misc';
import { WebXRFeatureName, WebXRFeaturesManager } from '../webXRFeaturesManager';
import { WebXRSessionManager } from '../webXRSessionManager';
import { WebXRAbstractFeature } from './WebXRAbstractFeature';

export interface IWebXRMeshDetectorOptions {
    worldParentNode?: TransformNode;
    doNotRemoveMeshesOnSessionEnded?: boolean;
}

export interface IWebXRMeshData {
    positions: Float32Array;
    indices: Uint32Array;
    normals: Float32Array;
}

export interface IWebXRMesh {
    id: number;
    data: IWebXRMeshData;
    lastChangedTime: number;
}

export interface ICustomWebXRMeshProvider {
    onMeshAddedObservable: Observable<IWebXRMeshData>;
    onMeshRemovedObservable: Observable<IWebXRMeshData>;
    onMeshUpdatedObservable: Observable<IWebXRMeshData>;
    onXRFrame(frame: XRFrame): void;
}

let meshIdProvider = 0;

export class WebXRMeshDetector extends WebXRAbstractFeature {
    private _detectedMeshes: Array<IWebXRMesh> = [];
    private _enabled: boolean = false;
    private _meshProviders: Set<ICustomWebXRMeshProvider> = new Set<ICustomWebXRMeshProvider>();
    private _meshProviderMeshIdMap: Map<IWebXRMeshData, number> = new Map<IWebXRMeshData, number>();
    private _meshMap: Map<number, IWebXRMesh> = new Map<number, IWebXRMesh>();

    public static readonly Name = WebXRFeatureName.MESH_DETECTION;
    public static readonly Version = 1;

    public onMeshAddedObservable: Observable<IWebXRMesh> = new Observable();
    public onMeshRemovedObservable: Observable<IWebXRMesh> = new Observable();
    public onMeshUpdatedObservable: Observable<IWebXRMesh> = new Observable();

    constructor(_xrSessionManager: WebXRSessionManager, private _options: IWebXRMeshDetectorOptions = {}) {
        super(_xrSessionManager);
        if (this._xrSessionManager.session) {
            this._init();
        } else {
            this._xrSessionManager.onXRSessionInit.addOnce(() => {
                this._init();
            });
        }
    }

    public detach(): boolean {
        if (!super.detach()) {
            return false;
        }

        if (!this._options.doNotRemoveMeshesOnSessionEnded) {
            while (this._detectedMeshes.length) {
                const toRemove = this._detectedMeshes.pop();
                if (toRemove) {
                    this.onMeshRemovedObservable.notifyObservers(toRemove);
                }
            }
        }

        this._meshProviders.forEach((meshProvider) => {
            meshProvider.onMeshAddedObservable.removeCallback(this._onMeshAdded);
            meshProvider.onMeshUpdatedObservable.removeCallback(this._onMeshUpdated);
            meshProvider.onMeshRemovedObservable.removeCallback(this._onMeshRemoved);
        });
        this._meshProviders.clear();

        return true;
    }

    public dispose(): void {
        super.dispose();
        this.onMeshAddedObservable.clear();
        this.onMeshRemovedObservable.clear();
        this.onMeshUpdatedObservable.clear();
    }

    protected _onXRFrame(frame: XRFrame) {
        if (!this.attached || !this._enabled || !frame) {
            return;
        }

        // TODO: WebXR real-world-geometry mesh detection
        
        this._meshProviders.forEach((meshProvider) => {
            meshProvider.onXRFrame(frame);
        })
    }

    private _init() {
        this._enabled = true;
        if (this._detectedMeshes.length) {
            this._detectedMeshes = [];
        }
    }

    public registerCustomMeshProvider(meshProvider: ICustomWebXRMeshProvider): void {
        if (!this._meshProviders.has(meshProvider))
        {
            this._meshProviders.add(meshProvider);
            meshProvider.onMeshAddedObservable.add(this._onMeshAdded)
            meshProvider.onMeshUpdatedObservable.add(this._onMeshUpdated);
            meshProvider.onMeshRemovedObservable.add(this._onMeshRemoved);
        }
    }

    public unregisterCustomMeshProvider(meshProvider: ICustomWebXRMeshProvider): void {
        if (this._meshProviders.has(meshProvider)) {
            meshProvider.onMeshAddedObservable.removeCallback(this._onMeshAdded);
            meshProvider.onMeshUpdatedObservable.removeCallback(this._onMeshUpdated);
            meshProvider.onMeshRemovedObservable.removeCallback(this._onMeshRemoved);
            this._meshProviders.delete(meshProvider);
        }
    }

    protected _onMeshAdded(meshData: IWebXRMeshData) {
        var meshId = meshIdProvider;
        meshIdProvider++;

        this._meshProviderMeshIdMap.set(meshData, meshId);

        const mesh: IWebXRMesh = {
            id: meshId,
            data:meshData,
            lastChangedTime:this._xrSessionManager.currentTimestamp
        };

        this._meshMap.set(meshId, mesh);
        this.onMeshAddedObservable.notifyObservers(mesh);
    }

    protected _onMeshUpdated(meshData: IWebXRMeshData) {
        var meshId = this._meshProviderMeshIdMap.get(meshData);
        if (meshId === undefined) {
            this._onMeshAdded(meshData);
            return;
        }

        var mesh = this._meshMap.get(meshId);
        if (mesh === undefined) {
            return;
        }

        mesh.lastChangedTime = this._xrSessionManager.currentTimestamp;
        mesh.data = meshData;
        this.onMeshUpdatedObservable.notifyObservers(mesh);
    }

    protected _onMeshRemoved(meshData: IWebXRMeshData) {
        var meshId = this._meshProviderMeshIdMap.get(meshData);
        if (meshId === undefined) {
            return;
        }

        var mesh = this._meshMap.get(meshId);
        if (mesh === undefined) {
            return;
        }

        this._meshMap.delete(meshId);
        this.onMeshRemovedObservable.notifyObservers(mesh);
    }
}

//register the plugin
WebXRFeaturesManager.AddWebXRFeature(
    WebXRMeshDetector.Name,
    (xrSessionManager, options) => {
        return () => new WebXRMeshDetector(xrSessionManager, options);
    },
    WebXRMeshDetector.Version
);
