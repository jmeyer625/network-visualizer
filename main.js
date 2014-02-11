var scene, camera, renderer, controls;

var init = function(){
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );
	camera.position.z = 50;
	renderer = new THREE.WebGLRenderer();
	renderer.setSize( 600, 400 );
	renderer.setClearColor(0xFFFFFF);
	controls = new THREE.OrbitControls(camera, renderer.domElement);
	$('#view').append( renderer.domElement );
}

var render = function() {
	requestAnimationFrame(render);
	renderer.render(scene, camera);
	controls.update();
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
}

var controller = init();

var geometry = new THREE.SphereGeometry(1,25,25);
var material = new THREE.MeshPhongMaterial( { color: 0x2ADDA4 } );
var sphere = new THREE.Mesh(geometry,new THREE.MeshPhongMaterial({color:0xFF0000}));
// scene.add(sphere);


var initData = [];
for (var i=0; i<30; i++) {
	initData.push(Faker.Helpers.createCard());
}

_.map(initData,function(person){
	person.friends = [];
	var numFriends = Math.floor(Math.random()*initData.length/4+1);
	for (var i=0; i<numFriends; i++) {
		person.friends.push(Math.floor(Math.random()*initData.length));
	}
});


var newData = [];
_.map(initData,function(person,ind) {
	var personData = {};
	personData.name = person.name;
	personData.connectionArray = [];
	for(var i=0; i<initData.length; i++) {
		personData.connectionArray.push(0);
	}
	for(var j=0; j<person.friends.length; j++) {
		personData.connectionArray[person.friends[j]] = 1;
	}
	newData.push(personData);
})

var centralities = calcCentrality(newData,10);
_.map(centralities,function(num,ind){
	newData[ind].centrality = num;
})

_.map(newData,function(person,ind){
	var sphere = new THREE.Mesh(geometry,material);
	var xOffset = (Math.random()>.5) ? 1 : -1;
	var yOffset = (Math.random()>.5) ? 1 : -1;
	var zOffset = (Math.random()>.5) ? 1 : -1;
	var xCoord = person.centrality ? xOffset / person.centrality : 0;
	var yCoord = person.centrality ? yOffset / person.centrality : 0;
	var zCoord = person.centrality ? zOffset / person.centrality : 0;
	sphere.position.set(xCoord,yCoord,zCoord);
	scene.add(sphere);
	person.sphere = sphere;
});

_.map(newData,function(node){
	for (var i=0; i<node.connectionArray.length; i++) {
		if (node.connectionArray[i]) {
			mapLine(node.sphere,newData[i].sphere)
		}
	}
})

 var pointLight = new THREE.PointLight(0xFFFFFF); // Set the color of the light source (white).
    pointLight.position.set(50, 50, 250); // Position the light source at (x, y, z).
    scene.add(pointLight);

render();
