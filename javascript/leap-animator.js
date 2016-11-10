autowatch = 1;

var mymodel = new JitterObject("jit.gl.model");
mymodel.normalize = 0;
mymodel.smooth_shading = 1;
mymodel.lighting_enable = 1;
mymodel.poly_mode = [0,0];
mymodel.drawskeleton = 0;

var mname = mymodel.name;
var myanodes = new Object();
var myquat = new JitterObject("jit.quat");
var mya2q = new JitterObject("jit.axis2quat");
var mylistener1 = null;

var init = 0;
var dosim = 0;

function ModelBone (name) {
	this.name = name;
	this.root = 0;				// is root
	this.jnode = 0;				// anim.node from model	
	this.pnode = 0;				// parent anim.node
	this.initquat = [0,0,0,1];	// initial quaternion value from model file
	this.bquat = [0,0,0,1];		// update quaternion
	this.update = false;
}
var modelbones = new Object();

function LeapBone(name, next) {
	this.name = name;
	this.next = next;
	this.dir = [0,0,1];
	this.prevdir = [0,0,1];
	this.update = false;
}

var leapbones = new Object();
var mapping = new Object();

var fingers = [ "thumb", "index", "middle", "ring", "pinky" ];
var bones = [ "metacarpal", "proximal", "intermediate", "distal" ];
var nextbone = {
	"metacarpal" : "proximal",
	"proximal" : "intermediate",
	"intermediate" : "distal"
}

for (i in fingers) {
	for (j in bones) {
		var n = fingers[i]+"_"+bones[j];
		var nn = null;
		if (nextbone.hasOwnProperty(bones[j])) {
			nn = fingers[i]+"_"+nextbone[bones[j]];
		}
		
		leapbones[n] = new LeapBone(n, nn);
	}
}

function dpost(s) {
	//post(s+"\n");
}

function drawto(n) {
	mymodel.drawto = n;
}

// callback function
function thecallback(event) {
	//post(event.eventname);
	if (event.eventname=="read") { 
		init_model();
		init = 1;
	}	
}

function bang() {
	drawit();
}

function drawit() {
	// wait two frames before iterating model skeleton	
	if(init) {
		if(init>2) {
			create_rbodies();
			init = 0;
			dosim=1;
		}
		else {
			init++;
		}
	}
	
	if(dosim)
		do_leapanimation();
}

// update animation function
function do_leapanimation() {

	// interate leapbone map 
	for(n in leapbones) {
		var key = leapbones[n].name;
		if (leapbones[n].update && mapping.hasOwnProperty(key)) {
			var vals = mapping[key];
			for(i in vals) {
				var bname = mname+"_"+vals[i]+"_rb";
				if (modelbones.hasOwnProperty(bname)) {
					//dpost(key+" dir: "+leapbones[n].dir + ". prevdir: "+leapbones[n].prevdir);

					// get axis - angle rotation from previous bone direction rotation to current bone direction
					var dir = leapbones[n].dir;
					var prevdir = leapbones[n].prevdir;
                    var cross = vec3_cross(dir, prevdir);
                    var angle = radtodeg(Math.acos(vec3_dot(dir, prevdir)));

                    // convert to quaternion
                    mya2q.angleaxis = [angle, cross[0], -cross[1], cross[2]];
					
					// multiple with offset quaternion
					myquat.quat1 = mya2q.quat;
					modelbones[bname].bquat = myquat.quatout;
					modelbones[bname].update = true;
				}
			}

		}
		leapbones[n].update = false;
	}
	
	// iterate modelbone map, updating where appropriate	
	for (n in modelbones) {
		var rdb = modelbones[n];	

		if(rdb.root) {
		}
		else {			
			rdb.pnode.update_node();
			// this is needed for bug in versions prior to Max 7.3.2 
			// where gl.model nodes don't properly update their parent attributes
			rdb.jnode.parentquat = rdb.pnode.worldquat;
			
			if(rdb.update)
				rdb.jnode.quat = rdb.bquat;
			rdb.update = false;
		}
	}
}

// determines how leapmotion bones map to model file nodes
// must add these after model file is read in
function add_mapping() {
	var a = arrayfromargs(arguments);
	var key = a[0];
	var vals = a.slice(1,a.length);
	dpost("adding mapping "+key+" "+vals);
	mapping[key] = vals;
}

// takes finger bone transform values from leapmotion external
function do_mapping() {
	var a = arrayfromargs(arguments);
	var key = a[0];
	var dir = a.slice(10, 13);
	
	if (leapbones.hasOwnProperty(key)) {
		leapbones[key].update = true;
		leapbones[key].dir = dir;

		// we need to store the previous bone direction in order to calculate bone rotation
		if(leapbones[key].next && leapbones.hasOwnProperty(leapbones[key].next)) {
			leapbones[leapbones[key].next].prevdir = dir;
		}
	}
}

// set quaternion to multiply with leap bone rotations for an offset rotation
function quat_offset() {
	myquat.quat2 = arrayfromargs(arguments);
}

///---- Model functions ----///
function read (filename){
	dpost("read "+filename);
	mylistener1 = new JitterListener(mymodel.name, thecallback);
	for (var a in myanodes) {
		myanodes[a].freepeer();
		delete myanodes[a];
	}

	reset();

	mymodel.anim_reset();
	mymodel.read(filename);
}

function init_model(){	
	var mynodenames = mymodel.getbonenames();
	
	for (var n in mynodenames) {
		var node = new JitterObject("jit.anim.node");		
		node.name = mynodenames[n];
		myanodes[node.name] = node;
		dpost("node "+node.name);
	}
}

function create_rbodies() {
	dpost("create_rbodies");
	// create RagdollBone Object for each joint in model
	for (n in myanodes) {
		var node = myanodes[n];
		var bname = node.name+"_rb";
		var rdb = new ModelBone(bname);
		if(node.anim) {
			rdb.pnode = myanodes[node.anim];
			var pname = rdb.pnode.name+"_rb";
			rdb.root = 0;
		}
		else {
			rdb.root = 1;
		}
		rdb.jnode = node;
		rdb.initquat = rdb.jnode.quat;
		dpost(rdb.name+" rotxyz: "+ rdb.jnode.rotatexyz);
		modelbones[bname] = rdb;			
	}
}

function reset() {
	mymodel.anim_reset();

	for(var a in modelbones) {
		modelbones[a].jnode.quat = modelbones[a].initquat;
	}
	
	for (var k in mapping) {
		delete mapping[k];
	}

	for (var a in modelbones){
		delete modelbones[a];
	}

	dosim = 0;
	init = 1;
}

function set_model_attr(arg) {
	if(arguments.length>1) {
		var attrname = arguments[0];
		var val = new Array();
		for(var i=1; i<arguments.length; i++)
			val.push(arguments[i]);
		mymodel[attrname] = val;
	}
}

///---- Some simple vec-math ----///
function vec3_length(vec) {
	var x=vec[0];
	var y=vec[1];
	var z=vec[2];
	var v = x*x + y*y + z*z;

	if(v != 0)
		return Math.sqrt(v);
	else 
		return v;
}

function vec3_add(vec1, vec2) {
	var x1=vec1[0];
	var y1=vec1[1];
	var z1=vec1[2];
	
	var x2=vec2[0];
	var y2=vec2[1];
	var z2=vec2[2];		
	var res = new Array();
	res.push(x1+x2);
	res.push(y1+y2);
	res.push(z1+z2);
	return res;
}

function vec3_sub(vec1, vec2) {
	var x1=vec1[0];
	var y1=vec1[1];
	var z1=vec1[2];
	
	var x2=vec2[0];
	var y2=vec2[1];
	var z2=vec2[2];		
	var res = new Array();
	res.push(x1-x2);
	res.push(y1-y2);
	res.push(z1-z2);
	return res;
}

function vec3_cross (v1, v2)
{
	var temp = new Array();

	temp[0] = (v1[1] * v2[2]) - (v1[2] * v2[1]);
	temp[1] = (v1[2] * v2[0]) - (v1[0] * v2[2]);
	temp[2] = (v1[0] * v2[1]) - (v1[1] * v2[0]);
	return temp;
}

function vec3_dot (v1,v2)
{
	return v1[0]*v2[0] + v1[1]*v2[1] + v1[2]*v2[2];
}

function radtodeg (angle) {
  return angle * (180 / Math.PI);
}
