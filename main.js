

var init = function(){
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera( 75, 400 / 400, 0.1, 1000 );
	camera.position.z = 50;
	renderer = new THREE.WebGLRenderer();
	renderer.setSize( 400, 400 );
	renderer.setClearColor(0xFFFFFF);
	controls = new THREE.OrbitControls(camera, renderer.domElement);
	pointLight = new THREE.PointLight(0xFFFFFF); // Set the color of the light source (white).
    pointLight.position.set(50, 50, 250); // Position the light source at (x, y, z).
    scene.add(pointLight);
	$('#view').append( renderer.domElement );
	return {scene:scene,camera:camera,renderer:renderer,pointLight:pointLight}	
}

var render = function() {
	requestAnimationFrame(render);
	renderer.render(scene, camera);
	controls.update();
}

var clearScene = function(scene) {
    var objsToRemove = _.rest(scene.children, 1);
    _.each(objsToRemove, function( object ) {
          scene.remove(object);
    });
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

var initBVector = function(dataMatrix){
	var arr = [];
	for (var i=0; i<dataMatrix.length; i++) {
		arr.push(0.5);
	}
	return arr
}

var centralityIteration = function(dataMatrix,bVector) {
	var temp = [];
	for(var i=0; i<dataMatrix.length; i++) {
		temp[i] = 0;
		for(var j=0; j<dataMatrix.length; j++) {
			temp[i] += (bVector[j] * dataMatrix[i].connectionArray[j]);
		}
	}
	var normSq = 0;
	for (var k=0; k<dataMatrix.length; k++) {
			normSq += temp[k]*temp[k];
	}
	norm = Math.sqrt(normSq);
	temp = _.map(temp,function(item){
			return item/norm;
	})
	return temp;
}

var calcCentrality = function(dataMatrix,iterations) {
	var bVector = initBVector(dataMatrix);
	for (var x=0; x<iterations; x++) {
		bVector = centralityIteration(dataMatrix,bVector);
	}
	return bVector;
}

var calcMiddle = function(startVector,endVector) {
	var middlePosition = toPolar(startVector.x+(endVector.x-startVector.x)/2,startVector.y+(endVector.y-startVector.y)/2, startVector.z + (endVector.z-startVector.z)/2);
	middlePosition.radius += 10;
	middlePosition = toCartesian(middlePosition);	
	return middlePosition
}

var makeSpheres = function(dataMatrix) {
	_.map(dataMatrix,function(node,ind){
		newSphere(node,ind);
	});
}

var newSphere = function(node,ind) {
	var geometry = new THREE.SphereGeometry(1,25,25);
	var material = new THREE.MeshPhongMaterial( { color: 0x758EF4} );
	var sphere = new THREE.Mesh(geometry,material);
	var sphereCoords = calcSphereCoords(node,ind);
	sphere.position.set(sphereCoords.xCoord,sphereCoords.yCoord,sphereCoords.zCoord);
	scene.add(sphere);
	node.sphere = sphere;
}

var calcSphereCoords = function(node,ind) {
	var quadrants = [{x:1,y:1,z:1},{x:1,y:-1,z:1},{x:1,y:1,z:-1},{x:1,y:-1,z:-1},{x:-1,y:1,z:1},{x:-1,y:-1,z:-1},{x:-1,y:1,z:-1},{x:-1,y:-1,z:1}]
	var xOffset = quadrants[ind%8].x
	var yOffset = quadrants[ind%8].y;
	var zOffset = quadrants[ind%8].z;
	var xCoord = node.centrality ? xOffset / node.centrality : 0;
	var yCoord = node.centrality ? yOffset / node.centrality : 0;
	var zCoord = node.centrality ? zOffset / node.centrality : 0;
	return { xCoord:xCoord, yCoord:yCoord, zCoord:zCoord }
}

var makeEdges = function(dataMatrix) {
	_.map(dataMatrix,function(node){
		for (var i=0; i<node.connectionArray.length; i++) {
			if (node.connectionArray[i]) {
				var edge = mapLine(node.sphere,dataMatrix[i].sphere);
				node.edges.push(edge);
				dataMatrix[i].edges.push(edge);
			}
		}
	})
	return dataMatrix;
}

var mapLine = function(node1,node2) {
	var startVector = node1.position;
	var endVector = node2.position;
	var middlePosition = calcMiddle(startVector,endVector);
	var middleVector = new THREE.Vector3(middlePosition.x,middlePosition.y,middlePosition.z);
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
	scene.add(line);
	return line;
}

var makeFriendData = function(dataSize) {
	var dataMatrix = [];
	for (var i=0; i<dataSize; i++) {
		dataMatrix.push(Faker.Helpers.createCard());
	}
	_.map(dataMatrix,function(node,ind){
		node.id = ind;
		node.on = false;
		node.friends = [];
		var numFriends = Math.floor(Math.random()*dataMatrix.length/4+1);
		for (var i=0; i<numFriends; i++) {
			var newFriend = Math.floor(Math.random()*dataMatrix.length)
			if (newFriend !== ind) {
				node.friends.push(dataMatrix[newFriend].name);
			}
		}
	});

	_.map(dataMatrix,function(node,ind) {
		node.connectionArray = [];
		for(var i=0; i<dataMatrix.length; i++) {
			node.connectionArray.push(0);
		}
		for(var j=0; j<node.friends.length; j++) {
			var friendInd = _.find(dataMatrix,function(otherNode){
				return otherNode.name === node.friends[j];
			})
			node.connectionArray[friendInd.id] = 1;
		}
		node.edges=[];
		
	})
	return dataMatrix
}

var getConnectedNodes = function(node, dataMatrix) {
	var connectedNodes = [];
	_.map(node.friends,function(friend){
		var friendObj = _.find(dataMatrix,function(otherNode){
			return friend === otherNode.name;
		})
		connectedNodes.push(friendObj);
	})
	return connectedNodes;
}

var makeGraph = function(dataMatrix, scene) {
	
	// var sphere = new THREE.Mesh(geometry,new THREE.MeshPhongMaterial({color:0xFF0000}));
	// scene.add(sphere);

	var centralities = calcCentrality(dataMatrix,20);
	_.map(centralities,function(num,ind){
		dataMatrix[ind].centrality = num.toFixed(4);
	})
	makeSpheres(dataMatrix, scene);
	makeEdges(dataMatrix, scene);
	makeNodeLabels(dataMatrix, scene);
	initData = _.sortBy(dataMatrix,function(node){
		return 1/Number(node.centrality);
	})
	return initData
}

var makeNodeLabel = function(node){
	var canvas1 = document.createElement('canvas');
	canvas1.width = 100;
	canvas1.height = 50;
	var context1 = canvas1.getContext('2d');
	context1.font = "Bold 10px Arial";
	context1.fillStyle = "rgba(255,0,0,0.95)";
	context1.fillText(node.name, 0, 20);

	// canvas contents will be used for a texture
	var texture1 = new THREE.Texture(canvas1) 
	texture1.needsUpdate = true;
	  
	var material1 = new THREE.MeshBasicMaterial( {map: texture1, side:THREE.DoubleSide } );
	material1.transparent = true;
	var position = node.sphere.position;
	var mesh1 = new THREE.Mesh(
	    new THREE.PlaneGeometry(20, 10),
	    material1
	  );
	mesh1.position.set(position.x,position.y,position.z);
	node.label = mesh1;
}

var makeNodeLabels = function(dataMatrix) {
	_.map(dataMatrix,function(node){
		makeNodeLabel(node)
	})
}

var calcM = function(dataMatrix) {
	var m = 0
	for (var i=0; i<dataMatrix.length; i++) {
		for (var j=0; j<dataMatrix[i].connectionArray.length; j++) {
			m += dataMatrix[i].connectionArray[j]
		}
	}
	return m;
}

var calcK = function(node) {
	var k = 0;
	for(var j=0; j<node.connectionArray.length; j++) {
		k += node.connectionArray[j];
	}
	return k;
}

var calcModularity = function(dataMatrix) {
	var m = calcM(dataMatrix)
	var constant = 1/m;
	var sum = 0;
	for (var i=0; i<dataMatrix.length; i++) {
		var k = calcK(dataMatrix[i]);
		dataMatrix[i].k = k;
	}
	for (var i=0; i<dataMatrix.length; i++) {
		for (var j=0; j<dataMatrix[i].connectionArray.length; j++) {
			sum += (dataMatrix[i].connectionArray[j] - (dataMatrix[i].k + dataMatrix[j].k)/m);
		}
	}
	var q = constant * sum;
	return q;

}

var checkOtherCommunities = function(dataMatrix) {
	for node in nodes {
		getConnectedNodes(node);
		for connectedNode {
			
		}
	}
}



$(function(){
	var scene, camera, renderer, controls, pointLight;
	var threeObj = init(scene, camera, renderer, controls, pointLight);
	var initData = makeFriendData(20);
	initData = makeGraph(initData, threeObj.scene);
	render();

	var tableTemplate = Handlebars.compile($('#tableTemplate').text());
	$('#tableBody').append($(tableTemplate(initData)));

	$(document).on('click','#newData',function(e){
		e.preventDefault();
		clearScene(threeObj.scene);
		initData = makeFriendData(20);
		initData = makeGraph(initData, threeObj.scene);
		render();
		$('#tableBody').html('');
		$('#tableBody').append($(tableTemplate(initData)));
	})

	$(document).on('click','.icon-button',function(){
		clearScene(threeObj.scene);
		initData = makeFriendData(20);
		initData = makeGraph(initData, threeObj.scene);
		render();
		$('#tableBody').html('');
		$('#tableBody').append($(tableTemplate(initData)));
	})

	$(document).on('click','.table-node-row',function(){
		
		var id = parseInt($(this).attr('data-id'));
		var node = _.find(initData,function(node){
			return node.id === id;
		})
		var edges = node.edges;
		if (!node.on) {
			node.sphere.material.color.setHex(0xEA76F7);
			_.map(edges,function(edge){
				edge.material.color.setHex(0xEA76F7);
			});
			var connectedNodes = getConnectedNodes(node,initData);
			_.map(connectedNodes,function(node){
				node.sphere.material.color.setHex(0xF4A1AC);
				threeObj.scene.add(node.label);
			})
			threeObj.scene.add(node.label);
			node.on = true;
			$(this).css('background-color','#EA76F7');
		} else {
			node.sphere.material.color.setHex(0x758EF4);
			_.map(node.edges,function(edge){
				edge.material.color.setHex(0x999999);
			});
			var connectedNodes = getConnectedNodes(node,initData);
			_.map(connectedNodes,function(node){
				node.sphere.material.color.setHex(0x758EF4);
				threeObj.scene.remove(node.label);
			})
			threeObj.scene.remove(node.label);
			node.on = false;
			$(this).css('background-color','');
		}
	})

	$('.scrollable').on('DOMMouseScroll mousewheel', function(ev) {
        ev.stopPropagation();
        ev.preventDefault();
        ev.returnValue = false;
        return false;
	});

	$(document).on('click', '#showTable',function(){
		if($('table').css('display')==='none') {
			$('.table-container').addClass('scrollbar');
			$('table').fadeIn(function(){
				$('#showTable').text(($('table').css('display') === 'none') ? "Show table" : "Hide table");
			})
		} else {
			$('table').fadeOut(function(){
				$('#showTable').text(($('table').css('display') === 'none') ? "Show table" : "Hide table");
				$('.table-container').removeClass('scrollbar');
			})
			
		}
		
	})

})
