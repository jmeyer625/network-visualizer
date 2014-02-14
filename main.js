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
	var xCoord = node.centrality ? xOffset * 2 / node.centrality : 0;
	var yCoord = node.centrality ? yOffset * 2 / node.centrality : 0;
	var zCoord = node.centrality ? zOffset * 2/ node.centrality : 0;
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

var constructLine = function(startVector,middleVector,endVector) {
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

var mapLine = function(node1,node2) {
	var startVector = node1.position;
	var endVector = node2.position;
	var middlePosition = calcMiddle(startVector,endVector);
	var middleVector = new THREE.Vector3(middlePosition.x,middlePosition.y,middlePosition.z);
	var line = constructLine(startVector,middleVector,endVector);
	scene.add(line);
	return line;
}

var addFriend = function(node, dataMatrix) {
	var newFriend = Math.floor(Math.random()*dataMatrix.length)
	if (newFriend !== node.id && node.connectionArray[newFriend] === 0) {
		node.friends.push(dataMatrix[newFriend].name);
		node.connectionArray[newFriend] = 1;
		dataMatrix[newFriend].connectionArray[node.id] = 1;
		dataMatrix[newFriend].friends.push(node.name);
	}
}

var addProperties = function(node, dataMatrix) {
	node.connectionArray = [];
	for(var i=0; i<dataMatrix.length; i++) {
		node.connectionArray.push(0);
	}
	node.friends = [];
	node.on = false;
	node.edges=[];	
}

var makeNodeData = function(dataSize) {
	var dataMatrix = [];
	for (var i=0; i<dataSize; i++) {
		dataMatrix.push(Faker.Helpers.createCard());
	}
	_.map(dataMatrix,function(node, ind){
		addProperties(node, dataMatrix);
		node.id = ind;
	})
	_.map(dataMatrix,function(node,ind){
		var numFriends = Math.floor(Math.random()*dataMatrix.length/7+1);
		for (var i=0; i<numFriends; i++) {
			addFriend(node, dataMatrix);	
		}
	});
	for (var i=0; i < dataMatrix.length; i++) {
		dataMatrix[i].community = i;
	}
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

var makeFontTexture = function(text) {
	var canvas = document.createElement('canvas');
	canvas.width = 150;
	canvas.height = 50;
	var context = canvas.getContext('2d');
	context.font = "Bold 10px Arial";
	context.fillStyle = "rgba(255,0,0,0.95)";
	context.fillText(text, 0, 20);
	return canvas
}

var makeNodeLabel = function(node){
	var fontTexture = makeFontTexture(node.name);
	var texture = new THREE.Texture(fontTexture); 
	texture.needsUpdate = true;  
	var material = new THREE.MeshBasicMaterial( {map: texture, side:THREE.DoubleSide } );
	material.transparent = true;
	var position = node.sphere.position;
	var mesh = new THREE.Mesh(
	    new THREE.PlaneGeometry(20, 10),
	    material
	  );
	mesh.position.set(position.x,position.y,position.z);
	node.label = mesh;
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
			var sameCommunity = dataMatrix[i].community === dataMatrix[j].community ? 1 : 0;
			sum += ((dataMatrix[i].connectionArray[j] - (dataMatrix[i].k * dataMatrix[j].k)/m)*(sameCommunity));
		}
	}
	var q = constant * sum;
	return q;

}

var louvainLoop = function() {
	
	var maxModularity = [dataMatrix,calcModularity(dataMatrix)];
	for (var i=0; i < dataMatrix.length; i++) {
		var testModularity = testNodeCommunities(maxModularity[0],i);
		if(testModularity[1]>maxModularity[1]) {
			maxModularity = testModularity;
		}

	}

	return maxModularity[0];	
}

var testNodeCommunities = function(dataMatrix,ind){
	var node = dataMatrix[ind];
	var nodesToCheck = getConnectedNodes(node, dataMatrix);
	var maxModularity = null;
	for (var i=0; i<nodesToCheck.length; i++) {
		node.community = nodesToCheck[i].community;
		var communityArray = getCommunity(nodesToCheck[i], dataMatrix);
		var modularity = calcModularity(dataMatrix);
		if (maxModularity) {
			if (modularity > maxModularity[1]) {
				maxModularity = [];
				maxModularity.push(dataMatrix);
				maxModularity.push(modularity);
			}
		} else {
			maxModularity = [];
			maxModularity.push(dataMatrix);
			maxModularity.push(modularity);
		}
	}
	// console.log(maxModularity);
	return maxModularity;
}

var getCommunity = function(node,dataMatrix){
	var community = [];
	community = _.filter(dataMatrix,function(item){
		return node.community === item.community;
	})
	return community
}

var getCommunities = function(dataMatrix) {
	var communities = [];
	for (var i=0; i<dataMatrix.length; i++) {
		var thisCommunity = getCommunity(dataMatrix[i], dataMatrix);
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



$(function(){
	var scene, camera, renderer, controls, pointLight;
	var threeObj = init('#view');
	var initData = makeNodeData(20);
	initData = makeGraph(initData, threeObj.scene);
	render();

	var tableTemplate = Handlebars.compile($('#tableTemplate').text());
	$('#tableBody').append($(tableTemplate(initData)));

	$(document).on('click','#newData',function(e){
		e.preventDefault();
		clearScene(threeObj.scene);
		initData = makeNodeData(20);
		initData = makeGraph(initData, threeObj.scene);
		render();
		$('#tableBody').html('');
		$('#tableBody').append($(tableTemplate(initData)));
	})

	$(document).on('click','.icon-button',function(){
		clearScene(threeObj.scene);
		initData = makeNodeData(20);
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
		if($('#tableRow').css('display')==='none') {
			$('.table-container').addClass('scrollbar');
			$('#tableRow').fadeIn(function(){
				$('#showTable').text(($('#tableRow').css('display') === 'none') ? "Show table" : "Hide table");
			})
		} else {
			$('#tableRow').fadeOut(function(){
				$('#showTable').text(($('#tableRow').css('display') === 'none') ? "Show table" : "Hide table");
				$('.table-container').removeClass('scrollbar');
			})
			
		}
		
	});

	$(document).on('click','#groupCommunities',function(){
		initData = checkOtherCommunities(initData);
		var communityMaster = drawCommunities(getCommunities(initData), initData);
		$('#tableBody').html('');
		$('#tableBody').append($(tableTemplate(initData)))
	})

})
