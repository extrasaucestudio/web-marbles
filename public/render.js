var map;

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 5000 );

var renderer = new THREE.WebGLRenderer();
renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

var stats = new Stats();
stats.showPanel( 0 ); // 0: fps, 1: ms, 2: mb, 3+: custom
document.body.appendChild( stats.dom );

var controls = new THREE.OrbitControls( camera, renderer.domElement );
controls.enableDamping = true;
controls.dampingFactor = 0.25;
controls.enableZoom = true;

var ambientLight = new THREE.AmbientLight( 0xb49090 );
scene.add( ambientLight );

var axesHelper = new THREE.AxesHelper( 3 );
scene.add( axesHelper );

//

light = new THREE.DirectionalLight( 0xffffff, 0.8 );
scene.add( light );
				
// Water
var waterGeometry = new THREE.PlaneBufferGeometry( 10000, 10000 );

water = new THREE.Water(
	waterGeometry,
	{
		textureWidth: 512,
		textureHeight: 512,
		waterNormals: new THREE.TextureLoader().load( "threejs/textures/waternormals.jpg", function ( texture ) {
			texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
		}),
		alpha: 1.0,
		sunDirection: light.position.clone().normalize(),
		sunColor: 0xffffff,
		waterColor: 0x001e0f,
		distortionScale:  3.7,
		fog: scene.fog !== undefined
	}
);

water.rotation.x = - Math.PI / 2;
water.position.y = -9
water.material.uniforms.size.value = 8;

scene.add( water );

// Skybox

var sky = new THREE.Sky();
sky.scale.setScalar( 10000 );
scene.add( sky );

var uniforms = sky.material.uniforms;

uniforms.turbidity.value = 10;
uniforms.rayleigh.value = 2;
uniforms.luminance.value = 1;
uniforms.mieCoefficient.value = 0.005;
uniforms.mieDirectionalG.value = 0.8;

var parameters = {
	distance: 4000,
	inclination: 0.25,
	azimuth: 0.205
};

var cubeCamera = new THREE.CubeCamera( 1, 20000, 256 );
cubeCamera.renderTarget.texture.minFilter = THREE.LinearMipMapLinearFilter;

function updateSun() {

	var theta = Math.PI * ( parameters.inclination - 0.5 );
	var phi = 2 * Math.PI * ( parameters.azimuth - 0.5 );

	light.position.x = parameters.distance * Math.cos( phi );
	light.position.y = parameters.distance * Math.sin( phi ) * Math.sin( theta );
	light.position.z = parameters.distance * Math.sin( phi ) * Math.cos( theta );

	sky.material.uniforms.sunPosition.value = light.position.copy( light.position );
	water.material.uniforms.sunDirection.value.copy( light.position ).normalize();

	cubeCamera.update( renderer, scene );

}

updateSun();

//

/* var blueLight = new THREE.PointLight(0x0099ff);
scene.add( blueLight );
blueLight.position.x = 5;
blueLight.position.y = 70;
blueLight.position.z = 500;

var orangeLight = new THREE.PointLight(0xff9900);
scene.add( orangeLight );
orangeLight.position.x = 5;
orangeLight.position.y = 70;
orangeLight.position.z = -500; */

camera.position.x = 40;
camera.position.y = 80;
camera.position.z = 40;

camera.rotation.x = -.6;
camera.rotation.y = .3;
camera.rotation.z = 0;
controls.update();

var marbleMeshes = [];

function animate() {
	requestAnimationFrame( animate );
	
	// Update marble positions
	for (i = 0; i < marbleMeshes.length; i++){
		marbleMeshes[i].position.x = THREE.Math.lerp(marbleMeshes[i].position.x || 0, net.marblePositions[i*3+0], net.lastUpdate);
		marbleMeshes[i].position.y = THREE.Math.lerp(marbleMeshes[i].position.y || 0, net.marblePositions[i*3+2], net.lastUpdate);
		marbleMeshes[i].position.z = THREE.Math.lerp(marbleMeshes[i].position.z || 0, net.marblePositions[i*3+1], net.lastUpdate);
		
		
		marbleMeshes[i].quaternion.set(
			net.marbleRotations[i*3+0],
			net.marbleRotations[i*3+1],
			net.marbleRotations[i*3+2],
			net.marbleRotations[i*3+3]
		);
		marbleMeshes[i].quaternion.normalize();
	}
	
	if (net.lastUpdate < 1.5){
		net.lastUpdate += net.tickrate/60/net.ticksToLerp; //FPS assumed to be 60, replace with fps when possible, or better base it on real time.
	}
	
	/* // If there's marbleMeshes missing, add new ones.
	if (marbleMeshes.length*3 < net.marblePositions.length){
		for (i = 0; i < (net.marblePositions.length/3 - marbleMeshes.length); i++){
			
		}
	} */

	// Update water material
	water.material.uniforms.time.value += 1.0 / 60.0;
	
	stats.update();
	
	renderer.render( scene, camera );
}

var mapMesh;

// Stuff that can only be rendered after network data has been received
function renderInit(){ 
	for (i = 0; i < net.marblePositions.length/3; i++){
		spawnMarble(marbleData[i].tags);
	}
	
	/* var cubeGeometry = new THREE.BoxGeometry(.3, .3, .3);
	var red = new THREE.MeshStandardMaterial({ color: 0xff0000 });
	cube = new THREE.Mesh(cubeGeometry, red);	
	scene.add( cube ); */
	
	// var controls = new THREE.OrbitControls(camera, renderer.domElement);
	
	getXMLDoc("/client?dlmap=map2",(response)=>{
	
		var manager = new THREE.LoadingManager();
		manager.onProgress = function ( item, loaded, total ) {
			console.log( item, loaded, total );
		};
		
		var loader = new THREE.OBJLoader( manager );
		loader.load( '/resources/map4v2_optimized.obj', function ( object ) {
			object.traverse( function ( child ) {
				if ( child.name.indexOf("Terrain") !== -1) {
					mapMesh = child;
					
					scene.add( child );
					
					child.setRotationFromEuler( new THREE.Euler( -Math.PI*.5, 0, Math.PI*.5, 'XYZ' ) );
					
					child.geometry.computeBoundingBox();
					child.geometry.center();
					child.material = createMapMaterial();
				}
			} );
		}, ()=>{}, ()=>{} );
		
		console.log(response);
		getXMLDoc("/resources/map4v2_optimized.obj",(response)=>{
			map = new OBJHeightfield(response);
			map.centerOrigin("xyz");
			spawnMap(map);
		});
	});
	
	animate();
}

function spawnMarble(tags){
	let size = tags.size;
	let color = tags.color;
	let name = tags.name;
	
	let sphereGeometry = new THREE.SphereBufferGeometry(size,9,9);
	/* let sphereGeometry = new THREE.BoxGeometry(.2,.2,.2); */
	let materialColor = new THREE.Color(color);
	/* console.log(materialColor); */
	let sphereMaterial = new THREE.MeshStandardMaterial({ color: materialColor });
	let sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
	let nameSprite = makeTextSprite(name);
	marbleMeshes.push(sphereMesh);
	scene.add(marbleMeshes[marbleMeshes.length-1]);
	scene.add(nameSprite);
	nameSprite.parent = marbleMeshes[marbleMeshes.length-1];
}

function spawnMap(map){
	let model = map.parsed.models[1];
	let geometry = new THREE.BufferGeometry();
	let vertices = vertexObjectArrayToFloat32Array(model.vertices);
	let normals = vertexObjectArrayToFloat32Array(model.vertexNormals);
	let uvs = textureCoordsArrayToFloat32Array(model.textureCoords);
	let indices = [];
	for (let index of model.faces){
		indices.push(
			index.vertices[0].vertexIndex,
			index.vertices[1].vertexIndex,
			index.vertices[2].vertexIndex
		);
	}
	
	console.log(indices.length,vertices.length,normals.length,uvs.length);
	
	geometry.setIndex(indices);
	geometry.addAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
	geometry.addAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
	geometry.addAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
	geometry.scale(1,1,-1); // Faces are flipped so flip them back by negative scaling
	geometry.computeVertexNormals(true); // Recompute vertex normals

	//
	
	var mapMaterial = createMapMaterial();
	console.log(mapMaterial);
	
	//
	
    var solidMaterial = new THREE.MeshStandardMaterial( { color: 0x33c49a, roughness: .9 } );
    var wireframeMaterial = new THREE.MeshLambertMaterial( { color: 0xff00ff, wireframe:true } );
	
	var texture = new THREE.TextureLoader().load( "threejs/textures/brick_diffuse.jpg" );
		texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
		
	var textureMaterial = new THREE.MeshPhongMaterial( { 
		color: 0xffffff,
		map: texture
	} );
	
	mesh = new THREE.Mesh( geometry, textureMaterial);
	/* scene.add( mesh ); */
	/* mesh.material = mapMaterial; */
	mesh.setRotationFromEuler( new THREE.Euler( 0, Math.PI*.5, 0, 'XYZ' ) );
	
	/* undermesh = new THREE.Mesh( geometry, wireframeMaterial );
	scene.add( undermesh );
	undermesh.position.y = .05;
	undermesh.setRotationFromEuler( new THREE.Euler( 0, Math.PI*.5, 0, 'XYZ' ) ); */
}

var library = {};
var textures = {
	brick: { url: 'threejs/textures/brick_diffuse.jpg' },
	dirt: { url: 'threejs/textures/dirt.jpg' },
	grass: { url: 'threejs/textures/grasslight-big.jpg' },
	grassNormal: { url: 'threejs/textures/grasslight-big-nm.jpg' },
	decalDiffuse: { url: 'threejs/textures/decal-diffuse.png' },
	mask: { url: 'threejs/textures/mask_alpha.png' },
	cloud: { url: 'threejs/textures/lava/cloud.png' },
	spherical: { url: 'threejs/textures/envmap.png' }
};
var param = { example: 'standard' };

function getTexture( name ) {
	var texture = textures[ name ].texture;
	if ( ! texture ) {
		texture = textures[ name ].texture = new THREE.TextureLoader().load( textures[ name ].url );
		texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
		library[ texture.uuid ] = texture;
	}
	return texture;
}

var cubemap = function () {
	var path = "threejs/textures/cube/";
	var format = '.jpg';
	var urls = [
		path + 'posx' + format, path + 'negx' + format,
		path + 'posy' + format, path + 'negy' + format,
		path + 'posz' + format, path + 'negz' + format
	];
	var textureCube = new THREE.CubeTextureLoader().load( urls );
	textureCube.format = THREE.RGBFormat;
	library[ textureCube.uuid ] = textureCube;
	return textureCube;
}();

function createMapMaterial(){
	var name = param.example;
	var mtl;
	
	// MATERIAL
	mtl = new THREE.StandardNodeMaterial();
	mtl.roughness = new THREE.FloatNode( .9 );
	mtl.metalness = new THREE.FloatNode( 0 );
	
	var offset = new THREE.FloatNode( 0 );
	var scale = new THREE.FloatNode( 20 );
	var uv = new THREE.UVNode();
	var uvOffset = new THREE.OperatorNode(
		offset,
		uv,
		THREE.OperatorNode.ADD
	);
	var uvScale = new THREE.OperatorNode(
		uvOffset,
		scale,
		THREE.OperatorNode.MUL
	);
	var tex1 = new THREE.TextureNode( getTexture( "grass" ), uvScale );
	var tex2 = new THREE.TextureNode( getTexture( "dirt" ), uvScale );
	
	var maskUvOffset = new THREE.FloatNode( 0 );
	var maskUvScale = new THREE.FloatNode( 1 );
	var maskUv = new THREE.UVNode();
	var maskUvOffsetNode = new THREE.OperatorNode(
		maskUvOffset,
		maskUv,
		THREE.OperatorNode.ADD
	);
	var maskUvScale = new THREE.OperatorNode(
		maskUvOffsetNode,
		maskUvScale,
		THREE.OperatorNode.MUL
	);
	console.log(maskUvScale);
	var mask = new THREE.TextureNode( getTexture( "mask" ), maskUvScale );
	var maskAlphaChannel = new THREE.SwitchNode( mask, 'w' );
	var blend = new THREE.Math3Node(
		tex1,
		tex2,
		maskAlphaChannel,
		THREE.Math3Node.MIX
	);
	mtl.color = blend;
	
	// build shader
	mtl.build();
	// set material
	return mtl;
}

function vertexObjectArrayToFloat32Array(array){ // Also converts z up to y up
	
	// indexing expects vertices starting at 1, so we add a 0,0,0 vertex at the start to solve this
	let f32array = new Float32Array(array.length*3 + 15);
	let i = 5;
	
	for (let vertex of array){
		f32array[i*3+0] = vertex.x;
		f32array[i*3+1] = vertex.z;
		f32array[i*3+2] = vertex.y;
		i++;
	}
	return f32array;
}

function textureCoordsArrayToFloat32Array(array){ //
	
	// indexing expects vertices starting at 1, so we add a 0,0,0 vertex at the start to solve this
	let f32array = new Float32Array(array.length*2 + 10);
	let i = 5;
	
	for (let vertex of array){
		f32array[i*2+0] = vertex.u;
		f32array[i*2+1] = vertex.v;
		i++;
	}
	return f32array;
}

function vertexObjectArrayToArray(array){ // Also converts z up to y up
	let newArray = [];
	for (let vertex of array){
		newArray.push(
			vertex.x,
			vertex.z,
			vertex.y
		);
	}
	return newArray;
}

// Duplicate code, find a better way to get this in.

class OBJHeightfield {
	constructor(file) {
		this.obj = new OBJFile( file );
		this.parsed = this.obj.parse();
		
		// Clone & sort vertices
		this.vertices = this.parsed.models[1].vertices.slice(0).sort(
			function(a, b) {
				return b.x - a.x || b.y - a.y 
			}
		);
		
		this.centerOrigin = function(axes){
			if (axes.indexOf("x") !== -1){
				let diff = this.maxX - this.minX;
				let half = diff * .5;
				for ( let verts of this.vertices ){
					verts.x = 0 - (this.maxX - verts.x) + half;
				}
			}
			if (axes.indexOf("y") !== -1){
				let diff = this.maxY - this.minY;
				let half = diff * .5;
				for ( let verts of this.vertices ){
					verts.y = 0 - (this.maxY - verts.y) + half;
				}
			}
			if (axes.indexOf("z") !== -1){
				let diff = this.maxZ - this.minZ;
				let half = diff * .5;
				for ( let verts of this.vertices ){
					verts.z = 0 - (this.maxZ - verts.z) + half;
				}
			}
			
			// Update arrays after modifying origin
			this.updateVertexArrays();
			
			return this.vertices;
		}
		
		this.updateVertexArrays = function(){
			this.xArray = Array.from( this.vertices, a => a.x );
			this.yArray = Array.from( this.vertices, a => a.y );
			this.zArray = Array.from( this.vertices, a => a.z );
		
			this.minX = this.xArray.reduce(function(a, b) {return Math.min(a, b);});
			this.maxX = this.xArray.reduce(function(a, b) {return Math.max(a, b);});
			this.minY = this.yArray.reduce(function(a, b) {return Math.min(a, b);});
			this.maxY = this.yArray.reduce(function(a, b) {return Math.max(a, b);});
			this.minZ = this.zArray.reduce(function(a, b) {return Math.min(a, b);});
			this.maxZ = this.zArray.reduce(function(a, b) {return Math.max(a, b);});
		}
		
		this.updateVertexArrays();
		
		/* this.width = this.depth = Math.sqrt(this.zArray.length);
		
		this.gridDistance = Math.abs( this.vertices[0].y - this.vertices[1].y ); */
	}
}

//

function makeTextSprite( message )
{
	var parameters = {};
	
	var fontface = "Courier New";
	var fontsize = 24;
		
	var canvas = document.createElement('canvas');
	var width = canvas.width = 256;
	var height = canvas.height = 64;
	var context = canvas.getContext('2d');
	context.font = "Bold " + fontsize + "px " + fontface;
	context.textAlign = "center"; 
    
	// get size data (height depends only on font size)
	var metrics = context.measureText( message );
	var textWidth = metrics.width;
	
	// text color
	context.fillStyle = "#ffffff";

	context.fillText(message, 128, fontsize);
	
	// canvas contents will be used for a texture
	var texture = new THREE.Texture(canvas) 
	texture.needsUpdate = true;
	var spriteMaterial = new THREE.SpriteMaterial({map: texture});
	var sprite = new THREE.Sprite( spriteMaterial );
	sprite.scale.set(4,1,1.0);
	return sprite;	
}
