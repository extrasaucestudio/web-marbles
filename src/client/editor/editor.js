import * as THREE from "three";
import { inspector } from "./inspector";
import { modelsTab } from "./models";
import { prefabsTab } from "./prefabs";
import { worldTab } from "./world";
import { projectTab } from "./project";
import { setEditorLogElement } from "./log";
import { initializeRenderer } from "./render";


// Object template used by prefabObject, prefabCollider, and worldObject
function EditorObject(type, uuid, project) {
	this.type = type;
	this.uuid = uuid;
	this.name = null;
	this.sceneObject = null;
	this.element = null;
	this.project = project; // Refers to the project-side object
}

// Updates the sceneObject's transform based on the loaded project, if it exists
// This should be called after a sceneObject has been created
EditorObject.prototype.updateTransformFromProject = function() {
	if(this.project.position) {
		this.setPosition( new THREE.Vector3(
			typeof this.project.position.x === "number" ? this.project.position.x : 0,
			typeof this.project.position.y === "number" ? this.project.position.y : 0,
			typeof this.project.position.z === "number" ? this.project.position.z : 0) );
	} else {
		this.project.position = {x: 0, y: 0, z: 0};
	}
	if(this.project.rotation
		&& typeof this.project.rotation.x === "number"
		&& typeof this.project.rotation.y === "number"
		&& typeof this.project.rotation.z === "number"
		&& typeof this.project.rotation.w === "number") {
		this.sceneObject.quaternion.copy(new THREE.Quaternion(this.project.rotation.x, this.project.rotation.y, this.project.rotation.z, this.project.rotation.w));
	} else {
		this.project.rotation = {x: 0, y: 0, z: 0, w: 1};
	}
	if(this.project.scale) {
		this.setScale( new THREE.Vector3(
			typeof this.project.scale.x === "number" ? this.project.scale.x : 1,
			typeof this.project.scale.y === "number" ? this.project.scale.y : 1,
			typeof this.project.scale.z === "number" ? this.project.scale.z : 1) );
	} else {
		this.project.scale = {x: 1, y: 1, z: 1};
	}
};

EditorObject.prototype.getPosition = function() {
	return this.sceneObject.position.clone();
};

EditorObject.prototype.setPosition = function(position) {
	this.sceneObject.position.copy(position);
	this.project.position = {
		x: position.x,
		y: position.y,
		z: position.z
	};
};

// Returns rotation in euler angles (rad)
EditorObject.prototype.getRotation = function() {
	return this.sceneObject.rotation.clone();
};

// Sets rotation in euler angles (rad)
EditorObject.prototype.setRotation = function(rotation) {
	this.sceneObject.rotation.copy(rotation);
	this.project.rotation = {
		x: this.sceneObject.quaternion.x,
		y: this.sceneObject.quaternion.y,
		z: this.sceneObject.quaternion.z,
		w: this.sceneObject.quaternion.w
	};
};

EditorObject.prototype.getScale = function() {
	return this.sceneObject.scale.clone();
};

EditorObject.prototype.setScale = function(scale) {
	this.sceneObject.scale.copy(scale);
	this.project.scale = {
		x: scale.x,
		y: scale.y,
		z: scale.z
	};
};

EditorObject.prototype.setName = function(name) {
	this.name = name;
	this.project.name = name;
	this.element.getElementsByClassName("name")[0].innerText = name;
};


let editor = function() {
	let _activeTab = 0;

	return {
		elements: {
			inspector: null
		},
		menu: {
			overflowTimeout: null
		},

		initialize: function() {
			this.elements.inspector = document.getElementById("inspector");

			setEditorLogElement( document.getElementById("log") );

			projectTab.initialize();
			inspector.initialize();
			initializeRenderer();
			modelsTab.initialize();
			prefabsTab.initialize();
			worldTab.initialize();

			// Models tab is the active tab on load
			modelsTab.onTabActive();


			// Menu
			let childValue = 0;
			for (let child of document.getElementById("editorMode").children) {
				child.dataset.nthChild = childValue++;

				// Add click event for every tab
				child.addEventListener("click", function() {
					// Nothing changes if the active tab is clicked
					if(this.dataset.nthChild === _activeTab) {
						return;
					}

					// Update element class
					this.parentNode.children[_activeTab].className = "";
					this.className = "selected";


					// Transition effect
					let firstElement = document.getElementById("properties").firstElementChild;
					firstElement.style.marginLeft = `-${parseInt(this.dataset.nthChild) * 100 }%`;

					if (parseInt(this.dataset.nthChild) >= 2) {
						editor.elements.inspector.style.transform = "translateX(100%)";
						if (editor.menu.overflowTimeout) clearTimeout(editor.menu.overflowTimeout);
						document.getElementById("prefabs").style.overflow = "visible";
					} else {
						editor.elements.inspector.style.transform = "translateX(0%)";
						editor.menu.overflowTimeout = setTimeout(function() {
							document.getElementById("prefabs").style.overflow = "auto";
						}, 400);
					}

					inspector.deselect();

					switch(_activeTab) {
					case 0:
						modelsTab.onTabInactive();
						break;
					case 1:
						prefabsTab.onTabInactive();
						break;
					case 2:
						worldTab.onTabInactive();
						break;
					case 3:
						projectTab.onTabInactive();
						break;
					case 4:
						// Editor settings tab
						break;
					default:
						console.error(`Attempted to deactive unknown tab with id ${_activeTab}`);
					}

					switch(parseInt(this.dataset.nthChild)) {
					case 0:
						modelsTab.onTabActive();
						break;
					case 1:
						prefabsTab.onTabActive();
						break;
					case 2:
						worldTab.onTabActive();
						break;
					case 3:
						projectTab.onTabActive();
						break;
					case 4:
						// Editor settings tab
						break;
					default:
						console.error(`Attempted to switch to unknown tab ${parseInt(this.dataset.nthChild)}`);
					}

					_activeTab = parseInt(this.dataset.nthChild);
				}, false);
			}
		}
	};
}();

window.addEventListener("DOMContentLoaded", function() {
	editor.initialize();
}, false);

window.onbeforeunload = function(e) {
	let dialogText = "Leave? You might lose unsaved changes!";
	e.returnValue = dialogText;
	return dialogText;
};

export { editor, EditorObject };