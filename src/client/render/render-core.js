import * as THREE from "three";
import "three/examples/js/loaders/LoaderSupport";
import "three/examples/js/loaders/GLTFLoader";
import * as config from "../config";
import * as Stats from "stats-js";
import { FreeCamera, TrackingCamera } from "./cameras";
import domReady from "../dom-ready";

const _GLTFLoader = new THREE.GLTFLoader();

let renderCore = function() {
	let _renderer = null,
		_viewport = null, // DOM viewport element
		_stats = null,
		_defaultModel = null,
		_previousTime = Date.now();

	// Core render loop
	const _animate = function() {
		let now = Date.now();
		let deltaTime = (now - _previousTime) * 0.001; // Time in seconds
		_previousTime = now;

		// Request new frame
		requestAnimationFrame(_animate);

		_stats.begin();

		// Make updates
		renderCore.updateCallback(deltaTime);

		if (renderCore.controls.enabled === true) {
			renderCore.controls.update(deltaTime);
		}

		// Render the darn thing
		_renderer.render(renderCore.mainScene, renderCore.controls.camera);

		_stats.end();
	};

	const _onCanvasResize = function() {
		_renderer.setSize(_viewport.clientWidth, _viewport.clientHeight);

		renderCore.controls.camera.aspect = _viewport.clientWidth / _viewport.clientHeight;
		renderCore.controls.camera.updateProjectionMatrix();
	};

	// From https://github.com/mrdoob/three.js/blob/master/examples/js/WebGL.js
	const _isWebGLAvailable = function() {
		try {
			const canvas = document.createElement("canvas");
			return !!(window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")));
		} catch (error) {
			return false;
		}
	};

	return {
		mainScene: null,
		controls: null,
		freeCamera: null,
		trackingCamera: null,

		initialize: function(defaultCameraType) {
			// Check for WebGL availability and display a warning when it is missing.
			if (!_isWebGLAvailable()) {
				domReady.then(() => {
					_viewport = document.getElementById("viewport");
					let warning = document.createElement("div");
					warning.id = "warning";
					warning.innerHTML = `
					Hmmm... Unfortunately, your ${window.WebGLRenderingContext ? "graphics card" : "browser"} does not seem to support
					<a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" style="color:#000">WebGL</a>. Please come back
					when you found something more compatible!
				`;
					_viewport.className += "warning";
					_viewport.appendChild(warning);
				});
			} else { // Initialize
				this.mainScene = new THREE.Scene();
				_renderer = new THREE.WebGLRenderer();
				_defaultModel = new THREE.Mesh(
					new THREE.BoxBufferGeometry(1, 1, 1, 1),
					new THREE.MeshStandardMaterial({
						color: 0x000000,
						emissive: 0xff00ff,
						wireframe: true
					})); // The fallback for the fallback. Is replaced by the real fallback mesh if loading succeeds.

				// Default model
				try {
					_GLTFLoader.load(
						// resource URL
						"resources/models/default.gltf",

						// called when the resource is loaded
						function(gltf) {
							_defaultModel = gltf.scene;
						},

						null,

						function(error) {
							console.error("An error occurred when loading the fallback model", error);
						}
					);
				}
				catch (error) {
					console.log("Unable to load default model", error);
				}

				// Renderer defaults
				_renderer.shadowMap.enabled = true;
				_renderer.shadowMap.type = THREE.PCFSoftShadowMap; // default THREE.PCFShadowMap

				// Stats
				_stats = new Stats();
				_stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
				_stats.dom.style.position = "absolute";
				_stats.dom.style.left = "unset";
				_stats.dom.style.right = "0px";

				// Controls
				this.trackingCamera = new TrackingCamera(this.mainScene, _renderer, { enabledByDefault: false });
				this.freeCamera = new FreeCamera(this.mainScene, _renderer, { enabledByDefault: false });

				this.setCameraStyle(defaultCameraType);

				// Once the DOM is ready, append the renderer DOM element & stats and start animating.
				return domReady.then(() => {
					_previousTime = Date.now(); // Update loop starts from this point in time, ignore load time
					_viewport = document.getElementById("viewport");

					_onCanvasResize();

					window.addEventListener("resize", _onCanvasResize, false);
					document.getElementById("cameraFree").addEventListener("click", this.setCameraStyle, false);
					document.getElementById("cameraTracking").addEventListener("click", this.setCameraStyle, false);

					_viewport.appendChild(_renderer.domElement);
					_viewport.appendChild(_stats.dom);

					_animate();
				});
			}
		},

		setCameraStyle: function(type) {
			// If this function is called from an event, use the event origin node to determine what type to become
			if (this && typeof type !== "string") type = this.dataset.type;

			// Check if we're not already the camera type we try to become
			if (renderCore.controls && type === renderCore.controls.type) return; // Is already this type.

			// Helper function that copies position and rotation from previously used camera
			function copyPositionAndRotation(target, source) {
				target.camera.position.copy(source.camera.position);
				target.camera.rotation.copy(source.camera.rotation);
			}

			// Copy over transform data, disable previously used camera / controls, enable new camera / controls
			switch (type) {
			case "TrackingCamera":
				if (renderCore.controls) {
					copyPositionAndRotation(renderCore.trackingCamera, renderCore.controls);
					renderCore.controls.disable();
				}
				renderCore.controls = renderCore.trackingCamera;
				break;
			case "FreeCamera":
			default:
				if (renderCore.controls) {
					copyPositionAndRotation(renderCore.freeCamera, renderCore.controls);
					renderCore.freeCamera.camera.rotation.z = 0; // Make sure we're not at an angle
					renderCore.controls.disable();
				}
				renderCore.controls = renderCore.freeCamera;
				break;
			}

			renderCore.controls.enable();

			if (_viewport) _onCanvasResize();

			// Set selected camera style in DOM
			domReady.then(() => {
				let node = document.querySelector(`[data-type=${type}]`);
				let selected = node.parentNode.getElementsByClassName("selected")[0];
				if (selected) selected.classList.remove("selected");
				node.classList.add("selected");
			});
		},

		updateCallback: function() {
			// Overridable function for the client and editor to attach their update functions to.
		},

		waterReflectsLevel: function() {
			return config.graphics.reflection.level;
		},

		waterReflectsMarbles: function() {
			return config.graphics.reflection.marbles;
		},

		getDefaultModel: function() {
			return _defaultModel;
		}
	};
}();

export {
	renderCore
};
