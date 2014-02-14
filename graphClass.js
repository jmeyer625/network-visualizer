

var checkArraysEqual = function(arr1,arr2) {
	if(arr1.length === arr2.length) {
		for (var i=0; i<arr1.length; i++) {
			if(arr2.indexOf(arr1[i]) === -1) {
				return false;
			}
		}
		return true;
	} else {
		return false;
	}
	
}

var toPolar = function(x,y,z){
    var sqrd = (x*x)+(y*y)+(z*z)
    var radius = Math.pow(sqrd,.5)
    var theta = Math.acos(z/radius)
    var phi = Math.atan2(y,x)
    var toReturn={
        radius:radius,
        theta:theta,
        phi:phi
    }
    return toReturn
}

var toCartesian = function(object) {
	var x = object.radius * Math.sin(object.theta) * Math.cos(object.phi);
	var y = object.radius * Math.sin(object.theta) * Math.sin(object.phi);
	var z = object.radius * Math.cos(object.theta);
	return {x:x,y:y,z:z}
}

var Graph = function(data) {
	this.data = data;
	this.bVector = this.initBVector();
	this.communities = [];
	this.edges = [];
}

Graph.prototype.initBVector = function(){
	var arr = [];
	for (var i=0; i<this.data.length; i++) {
		arr.push(0.5);
	}
	return arr
}

Graph.prototype.calcCentrality = function(iterations) {
	var iterations = iterations || 5;
	for (var x=0; x<iterations; x++) {
		bVector = this.centralityIteration();
	}
	_.map(this.data,function(node,ind){
		node.centrality = bVector[ind];
	})
	this.bVector = bVector;
}

Graph.prototype.centralityIteration = function() {
	var temp = [];
	for(var i=0; i<this.data.length; i++) {
		temp[i] = 0;
		for(var j=0; j<this.data.length; j++) {
			temp[i] += (this.bVector[j] * this.data[i].connectionArray[j]);
		}
	}
	var normSq = 0;
	for (var k=0; k<this.data.length; k++) {
		normSq += temp[k]*temp[k];
	}
	norm = Math.sqrt(normSq);
	temp = _.map(temp,function(item){
		return item/norm;
	})
	return temp;
}

Graph.prototype.makeSpheres = function() {
	_.map(this.data,function(node,ind){
		node.newSphere(ind);
	});
}

Graph.prototype.updateNodeIndices = function(){
	_.map(this.data,function(node,ind){
		node.id = ind;
	})
}
Graph.prototype.makeEdges = function(){
	var edges = [];
	_.map(this.data,function(node){
		for (var i=0; i<node.connectionArray.length; i++) {
			if (node.connectionArray[i]) {
				var edge = this.mapLine(node.sphere,this.data[i].sphere);
				edge.node1 = node;
				edge.node2 = this.data[i];
				edges.push(edge);
			}
		}
	}, this);
	return edges;
}
Graph.prototype.mapLine = function(node1,node2) {
	var startVector = node1.position;
	var endVector = node2.position;
	var middlePosition = this.calcMiddle(startVector,endVector);
	var middleVector = new THREE.Vector3(middlePosition.x,middlePosition.y,middlePosition.z);
	var line = this.constructLine(startVector,middleVector,endVector);
	scene.add(line);
	return line;
}

Graph.prototype.constructLine = function(startVector,middleVector,endVector) {
	var spline = new THREE.SplineCurve3([
	   startVector,
	   middleVector,
	   endVector
	]);
	var lineGeometry = new THREE.Geometry;
	var lineMaterial = new THREE.LineBasicMaterial({color:0x999999});
	var splinePoints = spline.getPoints(100);
	for(var i = 0; i < splinePoints.length; i++){
	    lineGeometry.vertices.push(splinePoints[i]);  
	}
	var line = new THREE.Line(lineGeometry,lineMaterial);
	return line;
}

Graph.prototype.calcMiddle = function(startVector,endVector) {
	var middlePosition = toPolar(startVector.x+(endVector.x-startVector.x)/2,startVector.y+(endVector.y-startVector.y)/2, startVector.z + (endVector.z-startVector.z)/2);
	middlePosition.radius += 10;
	middlePosition = toCartesian(middlePosition);	
	return middlePosition
}


Graph.prototype.highlightSelection = function(node) {
	node.on = true;
	node.sphere.material.color.setHex(0xEA76F7);
	var connectedNodes = getConnectedNodes(node);
	_.map(connectedNodes,function(node){
		node.sphere.material.color.setHex(0xF4A1AC);
	});
	var connectedEdges = _.filter(this.edges,function(edge){
		return(edge.node1 === node || edge.node2 === node)
	});
	_.map(connectedEdges,function(edge){
		edge.material.color.setHex(0xEA76F7);
	});
}
Graph.prototype.calcM = function() {
	var m = 0
	for (var i=0; i<this.data.length; i++) {
		for (var j=0; j<this.data[i].connectionArray.length; j++) {
			m += this.data[i].connectionArray[j]
		}
	}
	return m;
}
Graph.prototype.getCommunity = function(node){
	communityData = _.filter(this.data,function(item){
		return node.community === item.community;
	});
	var community = new Graph(communityData);
	return community;
}
Graph.prototype.createCommunities = function(){
	var communities = [];
	for (var i=0; i<this.data.length; i++) {
		var thisCommunity = this.getCommunity(this.data[i]);
		if (communities.length) {
			var arrayExists = null
			for (var j=0; j<communities.length; j++) {
				if(checkArraysEqual(thisCommunity,communities[j])) {
					arrayExists = true;
					break;
				}
			}
			if(!arrayExists) {
				communities.push(thisCommunity);
			}
		} else {
			communities.push(thisCommunity)
		}
	}
	return communities;
}

Graph.prototype.louvainLoop = function() {
	
	var maxModularity = [this.data,this.calcModularity()];
	for (var i=0; i < this.data.length; i++) {
		var testModularity = this.testNodeCommunities(i);
		if(testModularity[1]>maxModularity[1]) {
			maxModularity = testModularity;
		}

	}

	return maxModularity[0];	
}

Graph.prototype.testNodeCommunities = function(ind){
	var node = this.data[ind];
	var nodesToCheck = node.getConnectedNodes();
	var maxModularity = null;
	for (var i=0; i<nodesToCheck.length; i++) {
		node.community = nodesToCheck[i].community;
		this.createCommunities();
		var modularity = this.calcModularity();
		if (maxModularity) {
			if (modularity > maxModularity[1]) {
				maxModularity = [];
				maxModularity.push(this.data);
				maxModularity.push(modularity);
			}
		} else {
			maxModularity = [];
			maxModularity.push(this.data);
			maxModularity.push(modularity);
		}
	}
	// console.log(maxModularity);
	return maxModularity;
}

Graph.prototype.calcModularity = function() {
	var m = this.calcM();
	var constant = 1/m;
	var sum = 0;
	for (var i=0; i<this.data.length; i++) {
		for (var j=0; j<this.data[i].connectionArray.length; j++) {
			var sameCommunity = this.data[i].community === this.data[j].community ? 1 : 0;
			sum += ((this.data[i].connectionArray[j] - (this.data[i].k * this.data[j].k)/m)*(sameCommunity));
		}
	}
	var q = constant * sum;
	return q;

}
Graph.prototype.createScene = function(scene){
	_.map(this.data,function(node){
		scene.add(node.sphere);
	})
	_.map(this.edges,function(edge){
		scene.add(edge);
	})
}

var Node = function(card) {
	this.connectionArray = [];
	this.id = 0;
	this.community = null;
	this.card = card;
	this.sphere = this.newSphere();
	this.label = this.makeNodeLabel();
	this.k = this.calcK();
	this.friends = [];
}
Node.prototype.newSphere = function() {
	var geometry = new THREE.SphereGeometry(1,25,25);
	var material = new THREE.MeshPhongMaterial( { color: 0x758EF4} );
	var sphere = new THREE.Mesh(geometry,material);
	var sphereCoords = this.calcSphereCoords(this.id);
	sphere.position.set(sphereCoords.xCoord,sphereCoords.yCoord,sphereCoords.zCoord);
	return sphere;
}
Node.prototype.calcSphereCoords = function(id){
	var quadrants = [{x:1,y:1,z:1},{x:1,y:-1,z:1},{x:1,y:1,z:-1},{x:1,y:-1,z:-1},{x:-1,y:1,z:1},{x:-1,y:-1,z:-1},{x:-1,y:1,z:-1},{x:-1,y:-1,z:1}]
	var xOffset = quadrants[id%8].x;
	var yOffset = quadrants[id%8].y;
	var zOffset = quadrants[id%8].z;
	var xCoord = this.centrality ? xOffset * 2 / this.centrality : 0;
	var yCoord = this.centrality ? yOffset * 2 / this.centrality : 0;
	var zCoord = this.centrality ? zOffset * 2/ this.centrality : 0;
	return { xCoord:xCoord, yCoord:yCoord, zCoord:zCoord }
}
Node.prototype.getConnectedNodes = function(){
	var connectedArray = [];
	connectedArray = _.filter(this.connectionArray,function(value){
		return value
	});
	return connectedArray;
}
Node.prototype.makeFontTexture = function() {
	var canvas = document.createElement('canvas');
	canvas.width = 150;
	canvas.height = 50;
	var context = canvas.getContext('2d');
	context.font = "Bold 10px Arial";
	context.fillStyle = "rgba(255,0,0,0.95)";
	context.fillText(this.name, 0, 20);
	return canvas
}

Node.prototype.makeNodeLabel = function(){
	var fontTexture = this.makeFontTexture();
	var texture = new THREE.Texture(fontTexture); 
	texture.needsUpdate = true;  
	var material = new THREE.MeshBasicMaterial( {map: texture, side:THREE.DoubleSide } );
	material.transparent = true;
	var position = this.sphere.position;
	var mesh = new THREE.Mesh(
	    new THREE.PlaneGeometry(20, 10),
	    material
	  );
	mesh.position.set(position.x,position.y,position.z);
	return mesh;
}
Node.prototype.calcK = function() {
	var k = 0;
	for(var j=0; j<this.connectionArray.length; j++) {
		k += this.connectionArray[j];
	}
	return k;
}

var addFriend = function(node, graph) {
	var newFriend = Math.floor(Math.random()*graph.data.length)
	if (newFriend !== node.id && node.connectionArray[newFriend] === 0) {
		node.friends.push(graph.data[newFriend].card.name);
		node.connectionArray[newFriend] = 1;
		graph.data[newFriend].connectionArray[node.id] = 1;
		graph.data[newFriend].friends.push(node.card.name);
	}
}

var makeGraph = function(dataSize) {
	var data = [];
	for (var i=0; i<dataSize; i++) {
		var node = new Node(Faker.Helpers.createCard());
		node.id = i;
		node.community = i;
		for (var j=0; j<dataSize; j++){
			node.connectionArray.push(0);
		}
		data.push(node);
	}
	var graph = new Graph(data);
	_.map(graph.data,function(node,ind){
		var numFriends = Math.floor(Math.random()*graph.data.length/7+1);
		for (var i=0; i<numFriends; i++) {
			addFriend(node, graph);	
		}
	});
	return graph
}

var init = function(elem){
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera( 75, 970 / 400, 0.1, 1000 );
	camera.position.z = 50;
	renderer = new THREE.WebGLRenderer();
	renderer.setSize( 970, 400 );
	renderer.setClearColor(0xFFFFFF);
	controls = new THREE.OrbitControls(camera, renderer.domElement);
	pointLight = new THREE.PointLight(0xFFFFFF); // Set the color of the light source (white).
    pointLight.position.set(50, 50, 250); // Position the light source at (x, y, z).
    scene.add(pointLight);
	$(elem).append( renderer.domElement );
	return {scene:scene,camera:camera,renderer:renderer,pointLight:pointLight}	
}

var render = function() {
	requestAnimationFrame(render);
	renderer.render(scene, camera);
	controls.update();
}

var scene, camera, renderer, controls, pointLight;
var threeObj = init('#view');
var graph = makeGraph(20);
graph.calcCentrality(20);
_.map(graph.data,function(node){
	node.sphere = node.newSphere();
})
_.map(graph.data,function(node){
	node.k = node.calcK();
})
graph.edges = graph.makeEdges();
graph.createScene(threeObj.scene);
render();









