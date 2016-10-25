autowatch = 1;
outlets = 2;

var ghostanim = new JitterObject("jit.anim.node");
var is_attached = false;
var gname = ghostanim.name+"_ghost";

// for the picking constraint
var colbodyname;
var p2p = new JitterObject("jit.phys.point2point");
var p2pnode = new JitterObject("jit.anim.node");
p2pnode.anim = ghostanim.name;

// for converting body contact position world to local
var anode = new JitterObject("jit.anim.node");
var bodyposition;
var contactposition;

// for getting positions from phys.multiple 
var jmat;
var cell_indices;
var pmultname;

var State = {
    NONE : 0,
    PMULT : 1,
    PBODY : 2,
    ACTIVE : 3
}
var col_state = State.NONE;

function postln(s) {
	post(s+"\n");
}

function dpost(s) {
	postln(s);
}

function bang() {
	if(!is_attached)
		ghostanim.update_node();

	outlet(0, "position", ghostanim.worldpos);
	outlet(0, "scale", ghostanim.worldscale);

	if(col_state === State.ACTIVE) {
		p2p.position2 = p2pnode.worldpos;
	}
}

function init() {
	ghostanim.update_node();
	p2pnode.update_node();
	outlet(0, "name", gname);
	outlet(0, "getworldname", gname);
}

function worldname(wname) {
	dpost("world name: "+wname);
	p2p.worldname = wname;
}

function anim(aname) {
	dpost("anim: " + aname);
	ghostanim.anim = aname;
	is_attached = true;
	init();
}

function position() {
	var a = arrayfromargs(arguments);
	ghostanim.position = a;
}

function release() {
	col_state = State.NONE;
	p2p.body1 = "";
}

function collisions() {
	if(col_state === State.NONE) {
		// output of phys.ghost collisions outlet is "dictionary dict_name"
		var d = new Dict(arguments[1]);	// create dict from dict_name
		var jsd = JSON.parse(d.stringify());
		
		for(var i in jsd) {		// iterate the collisions, we usually only care about the first one
			d = new Dict(i);	// the actual collision info dict
			var coldict = JSON.parse(d.stringify());
			var b1 = coldict["body1"];
			var b2 = coldict["body2"];
			colbodyname = ((b1 === gname) ? b2 : b1);
			contactposition = coldict["position"];

			var re = /([^_]+)_(\d)_?(\d?)_?(\d?)/;
			var splits = colbodyname.split(re);
			
			if(splits.length > 1) {
				pmultname = splits[1];
				cell_indices = splits.slice(2, splits.length-1);
				col_state = State.PMULT;
				dpost("name: "+pmultname+", indices: "+cell_indices);
				outlet(1, "name", pmultname);
				outlet(1, "getposoutname");
			}
			else {
				col_state = State.PBODY;
				dpost("name: "+colbodyname);
				outlet(1, "name", colbodyname);
				outlet(1, "getposition");					
			}
			break;
		}
	}
}

function proxy() {
	var a = arrayfromargs(arguments);
	dpost(a);

	if(a[0] === "posoutname") {
		jmat = new JitterMatrix(a[1]);
		bodyposition = jmat.getcell(cell_indices);
	}
	else {
		bodyposition = a.slice(1, a.length);
	}
	dpost("bodyposition vals: "+bodyposition);

	create_picker();
}

function create_picker() {
	
	// position 1
	anode.position = bodyposition;
	anode.update_node();
	p2p.position1 = anode.worldtolocal(contactposition);
	
	// position 2
	ghostanim.update_node();
	p2pnode.position = ghostanim.worldtolocal(contactposition);
	p2pnode.update_node();
	p2p.position2 = p2pnode.worldpos;

	p2p.body1 = colbodyname;
	col_state = State.ACTIVE;
	dpost(p2p.body1+" "+p2p.position1+" "+p2p.position2);
}