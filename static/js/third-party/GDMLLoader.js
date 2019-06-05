/**
 * nathanieltagg http://www.otterbein.edu/Faculty/NTagg
 *
 * Original author tpmccauley / http://cern.ch/mccauley
 * https://github.com/tpmccauley/gdml-loader
 *
 * This ALMOST works.  The problem is that volumes are not embedded. MicroBooNE geometry clips inner volumes with outer ones,
 * but that doesn't work here because THREE.js isn't really CSG.
*/

 THREE.GDMLLoader = function() {

  var GDML = null;

 };

 THREE.GDMLLoader.prototype = {

  constructor: THREE.GDMLLoader,


  group: new THREE.Group(),
  defines: {},
  geometries: {},
  volume_nodes: {}, // references to xml nodes
  volumes: {},      // the actual mesh objects
  materials: {}, // to be provided by caller. keyname is materialref, value is a valid MeshPhongMaterial
                       // If key value is null, that object is not added. If value not present, it gets the default material
  top_volume_name: null,
  default_material: new THREE.MeshPhongMaterial({
        color:0x110011,
        transparent:true,
        opacity:0.5,
        wireframe:false,
        side: THREE.DoubleSide,

      }),


  load: function ( url, onLoad, onProgress, onError ) {

    var scope = this;

    var loader = new THREE.XHRLoader();
    loader.setPath( this.path );
    loader.load( url, function ( text ) {

      onLoad( scope.parse( text ) );

    }, onProgress, onError );

  },

  parse: function ( text  ) {

    GDML = new DOMParser().parseFromString( text, 'text/xml' );
    // make it visible for debugging
    this.GDML = GDML;

    // bookmarks.  Lookup table to find volume nodes.
    this.structure = GDML.querySelector('structure');
    for(var node of this.structure.childNodes) {
      if(node.nodeName == 'volume'){
        var name = node.getAttribute('name');
        if(name) this.volume_nodes[name] = node;
      }
    }
    this.parseDefines();
    this.parseSolids();
    // this.parseVolumes();
    // this.parsePhysVols();
    this.parseSetup();
    this.group.name="GDML"
    return this.group;

  },

  parseSetup: function() {

    // If the top volume name is given, let's just start with that. Otherwise, look for the world volume.

    // top displacement.
    var startPosition = new THREE.Vector3(0,0,0);
    var startRotation = new THREE.Vector3(0,0,0);

    if(!this.top_volume_name) {
      var setup = GDML.querySelectorAll('setup');
      var worlds = setup[0].childNodes;

      // add all worlds to the group.
      for ( var i = 0; i < worlds.length; i++ ) {

        var nodeName = worlds[i].nodeName;
        var node = worlds[i];

        if ( nodeName === 'world' ) {

          var volumeref = node.getAttribute('ref');
          var volumenode = this.volume_nodes[volumeref];
          if(!volumenode) throw "Can't find volume node " + volumeref;
          // Do the work!
          this.group.add(
            this.parse_volume(volumenode,this.group,startPosition,startRotation)
          );
        }
      }

    } else {
      // Build from the specified volume.

      var volumenode = this.volume_nodes[this.top_volume_name];
      this.group.add( this.parse_volume(volumenode,this.group,startPosition,startRotation) )
    }

  },

  lunits: function(node) {
    // take default unit as cm and radians
    var u = node.getAttribute('lunit');
    if(u===null) u = node.getAttribute("units");
    if(u===null) return 1;
    switch(u) {
      case "m":  return 100.0;
      case "cm": return 1.0;
      case "mm": return 0.1;
      default: console.warn("unrecognized units in GDML");
    }
    return 1;
  },

  aunits: function(node) {
    // take default unit as cm and radians
    var u = node.getAttribute('aunit');
    if(u===null) u = node.getAttribute("units");
    if(u===null) return 1;
    switch(u) {
      case "deg": return Math.PI/180.;
      default: console.warn("unrecognized units in GDML");
    }
    return 1;
  },

  parseDefines: function() {

    var elements = GDML.querySelectorAll('define');
    var defs = elements[0].childNodes;
    var name = '';
    var value;

    for ( var i = 0; i < defs.length; i++ ) {

      var nodeName = defs[i].nodeName;
      var def = defs[i];

      if ( nodeName === 'constant' ) {

        name = def.getAttribute('name');
        value = def.getAttribute('value');

      }

      if ( nodeName === 'position' ) {

        name = def.getAttribute('name');

        var units = this.lunits(def);

        var x = def.getAttribute('x')*units || 0.0;
        var y = def.getAttribute('y')*units || 0.0;
        var z = def.getAttribute('z')*units || 0.0;

        var position = new THREE.Vector3(x, y, z);
        this.defines[name] = position;
      }


      if ( nodeName === 'rotation' ) {

        // Note: need to handle constants
        // before this can be implemented
        var aunits = this.aunits(def);

        name = def.getAttribute('name');

        var x = def.getAttribute('x')*aunits;
        var y = def.getAttribute('y')*aunits;
        var z = def.getAttribute('z')*aunits;
        this.defines[name] = new THREE.Vector3(x, y, z);
      }

      if ( nodeName === 'quantity' ) {

        // Note: need to handle units

        name = def.getAttribute('name');
        var type = def.getAttribute('type');

      }

      if ( nodeName === 'expression' ) {

        name = def.getAttribute('name');

      }

    }

  },


  
  parseSolids: function() {

    var elements = GDML.querySelectorAll('solids');
    var solids = elements[0].childNodes;

    for ( var i = 0; i < solids.length; i++ ) {

      var type = solids[i].nodeName;
      if(type=='#text') continue;
      var solid = solids[i];
      var aunits = this.aunits(solid);
      var lunits = this.lunits(solid);
      var name = solid.getAttribute('name');

      if ( type === 'box' ) {

        name = solid.getAttribute('name');
        console.log(type, name);

        var x = solid.getAttribute('x');
        var y = solid.getAttribute('y');
        var z = solid.getAttribute('z');

        if ( this.defines[x] ) {
          x = this.defines[x];
        }

        if ( this.defines[y] ) {
          y = this.defines[y];
        }

        if ( this.defines[z] ) {
          z = this.defines[z];
        }

        // x,y,z in GDML are half-widths
        var geometry = new THREE.BoxGeometry(2*x*lunits, 2*y*lunits, 2*z*lunits);
        geometry.name=name;
        this.geometries[name] = geometry;

      }

      if ( type === 'tube' ) {

        name = solid.getAttribute('name');
        //console.log(type, name);

        var rmin = solid.getAttribute('rmin') * lunits;
        var rmax = solid.getAttribute('rmax') * lunits;
        var z = solid.getAttribute('z') * lunits;

        var startphi = solid.getAttribute('startphi')*aunits;
        var deltaphi = solid.getAttribute('deltaphi')*aunits;

        var shape = new THREE.Shape();
        // x,y, radius, startAngle, endAngle, clockwise, rotation
        shape.absarc(0, 0, rmax, startphi, deltaphi, false);

        if ( rmin > 0.0 ) {

          var hole = new THREE.Path();
          hole.absarc(0, 0, rmin, startphi, deltaphi, true);
          shape.holes.push(hole);

        }

        var extrudeSettings = {
          amount : z,
          steps : 1,
          bevelEnabled: false,
          curveSegments: 24
        };

        var geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.center();
        geometry.name = name;
        this.geometries[name] = geometry;

      }

      if ( type === 'sphere' ) {

        name = solid.getAttribute('name');
        //console.log(type, name);

        var rmin = (solid.getAttribute('rmin')||0.0)*lunits;
        var rmax = (solid.getAttribute('rmax')||0.0)*lunits;

        var startphi = (solid.getAttribute('startphi')||0.0)*aunits;
        var deltaphi = solid.getAttribute('deltaphi')*aunits;

        var starttheta = (solid.getAttribute('starttheta')||0.0)*aunits;
        var deltatheta = solid.getAttribute('deltatheta')*aunits;

        // radius, widthSegments, heightSegments, phiStart, phiLength, thetaStart, thetaLength
        var sphere = new THREE.SphereGeometry(rmax, 32, 32, startphi, deltaphi, starttheta, deltatheta);
        sphere.name = name;
        this.geometries[name] = sphere;

      }

      if ( type === 'orb' ) {

        name = solid.getAttribute('name');
        //console.log(type, name);

        var r = solid.getAttribute('r')*lunits;

        var sphere = new THREE.SphereGeometry(r, 32, 32, 0.0, 2*Math.PI, 0.0, Math.PI);
        sphere.name = name;
        this.geometries[name] = sphere;

      }

      if ( type === 'cone' ) {

        name = solid.getAttribute('name');
        //console.log(type, name);

        var rmin1 = solid.getAttribute('rmin1') * lunits;
        var rmax1 = solid.getAttribute('rmax1') * lunits;

        var rmin2 = solid.getAttribute('rmin2')* lunits;
        var rmax2 = solid.getAttribute('rmax2')* lunits;

        var z = solid.getAttribute('z') * lunits;

        var startphi = solid.getAttribute('startphi')*aunits;
        var deltaphi = solid.getAttribute('deltaphi')*aunits;

        // Note: ConeGeometry in THREE assumes inner radii of 0 and rmax1 = 0
        // radius, height, radialSegments, heightSegments, openEnded, thetaStart, thetaLength
        var cone = new THREE.ConeGeometry(rmax2, z, 32, 1, false, startphi, deltaphi);
        cone.name = name;
        this.geometries[name] = cone;

      }

      if ( type === 'torus' ) {

        name = solid.getAttribute('name');
        //console.log(type, name);

        var rmin = solid.getAttribute('rmin')*lunits;
        var rmax = solid.getAttribute('rmax')*lunits;
        var rtor = solid.getAttribute('rtor')*lunits;
        var startphi = solid.getAttribute('startphi')*aunits;
        var deltaphi = solid.getAttribute('deltaphi')*aunits;

        // Note: There is no inner radius for a THREE.TorusGeometry
        // and start phi is always 0.0
        // radius, tube, radialSegments, tubularSegments, arc
        var torus = new THREE.TorusGeometry(1.0*rtor, rmax, 16, 100, deltaphi);
        cone.name = name;
        this.geometries[name] = torus;

      }

      if ( type === 'tet' ) {

        name = solid.getAttribute('name');
        //console.log(type, name);

        var v1 = solid.getAttribute('vertex1');
        var v2 = solid.getAttribute('vertex2');
        var v3 = solid.getAttribute('vertex3');
        var v4 = solid.getAttribute('vertex4');

        if ( this.defines[v1] && this.defines[v2] && this.defines[v3] && this.defines[v4] ) {

          v1 = this.defines[v1];
          v2 = this.defines[v2];
          v3 = this.defines[v3];
          v4 = this.defines[v4];

          var tet = new THREE.Geometry();
          tet.vertices = [v1*lunits,v2*lunits,v3*lunits,v4*lunits];

          tet.faces.push(new THREE.Face3(0,3,1));
          tet.faces.push(new THREE.Face3(2,3,0));
          tet.faces.push(new THREE.Face3(1,2,0));
          tet.faces.push(new THREE.Face3(3,2,1));
          tet.name = name;
          this.geometries[name] = tet;


        }

      }

      if ( type === 'trd' ) {

        name = solid.getAttribute('name');
        //console.log(type, name);

        var x1 = solid.getAttribute('x1')*lunits;
        var x2 = solid.getAttribute('x2')*lunits;
        var y1 = solid.getAttribute('y1')*lunits;
        var y2 = solid.getAttribute('y2')*lunits;
        var z = solid.getAttribute('z')*lunits;

        var trd = new THREE.Geometry();

        trd.vertices.push(new THREE.Vector3( x2, y2, z));
        trd.vertices.push(new THREE.Vector3(-x2, y2, z));
        trd.vertices.push(new THREE.Vector3(-x2,-y2, z));
        trd.vertices.push(new THREE.Vector3( x2,-y2, z));

        trd.vertices.push(new THREE.Vector3( x1, y1,-z));
        trd.vertices.push(new THREE.Vector3(-x1, y1,-z));
        trd.vertices.push(new THREE.Vector3(-x1,-y1,-z));
        trd.vertices.push(new THREE.Vector3( x1,-y1,-z));

        trd.faces.push(new THREE.Face3(2,1,0));
        trd.faces.push(new THREE.Face3(0,3,2));

        trd.faces.push(new THREE.Face3(4,5,6));
        trd.faces.push(new THREE.Face3(6,7,4));

        trd.faces.push(new THREE.Face3(0,4,7));
        trd.faces.push(new THREE.Face3(7,3,0));

        trd.faces.push(new THREE.Face3(1,2,6));
        trd.faces.push(new THREE.Face3(6,5,1));

        trd.faces.push(new THREE.Face3(1,5,4));
        trd.faces.push(new THREE.Face3(4,0,1));

        trd.faces.push(new THREE.Face3(2,3,7));
        trd.faces.push(new THREE.Face3(7,6,2));

        trd.name = name;
        this.geometries[name] = trd;

      }

      if ( type === 'eltube' ) {

        name = solid.getAttribute('name');
        //console.log(type, name);

        var dx = solid.getAttribute('dx')*lunits;
        var dy = solid.getAttribute('dy')*lunits;
        var dz = solid.getAttribute('dz')*lunits;

        var shape = new THREE.Shape();
        // x, y, xRadius, yRadius, startAngle, endAngle, clockwise, rotation
        shape.absellipse(0, 0, dx, dy, 0.0, 2*Math.PI, false, 0);

        var extrudeSettings = {
          amount : 2*dz,
          steps : 1,
          bevelEnabled: false,
          curveSegments: 24
        };

        var geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.center();
        geometry.name = name;
        this.geometries[name] = geometry;

      }

      if ( type === 'arb8' ) {

        name = solid.getAttribute('name');
        //console.log(type, name);

        var dz = solid.getAttribute('dz')*lunits;

        var v1x = solid.getAttribute('v1x')*lunits;
        var v1y = solid.getAttribute('v1y')*lunits;

        var v2x = solid.getAttribute('v2x')*lunits;
        var v2y = solid.getAttribute('v2y')*lunits;

        var v3x = solid.getAttribute('v3x')*lunits;
        var v3y = solid.getAttribute('v3y')*lunits;

        var v4x = solid.getAttribute('v4x')*lunits;
        var v4y = solid.getAttribute('v4y')*lunits;

        var v5x = solid.getAttribute('v5x')*lunits;
        var v5y = solid.getAttribute('v5y')*lunits;

        var v6x = solid.getAttribute('v6x')*lunits;
        var v6y = solid.getAttribute('v6y')*lunits;

        var v7x = solid.getAttribute('v7x')*lunits;
        var v7y = solid.getAttribute('v7y')*lunits;

        var v8x = solid.getAttribute('v8x')*lunits;
        var v8y = solid.getAttribute('v8y')*lunits;

        var trd = new THREE.Geometry();

        trd.vertices.push(new THREE.Vector3(v5x,v5y,z));
        trd.vertices.push(new THREE.Vector3(v6x,v6y,z));
        trd.vertices.push(new THREE.Vector3(v7x,v7y,z));
        trd.vertices.push(new THREE.Vector3(v8x,v8y,z));

        trd.vertices.push(new THREE.Vector3(v1x,v1y,-z));
        trd.vertices.push(new THREE.Vector3(v2x,v2y,-z));
        trd.vertices.push(new THREE.Vector3(v3x,v3y,-z));
        trd.vertices.push(new THREE.Vector3(v4x,v4y,-z));

        trd.faces.push(new THREE.Face3(2,1,0));
        trd.faces.push(new THREE.Face3(0,3,2));

        trd.faces.push(new THREE.Face3(4,5,6));
        trd.faces.push(new THREE.Face3(6,7,4));

        trd.faces.push(new THREE.Face3(0,4,7));
        trd.faces.push(new THREE.Face3(7,3,0));

        trd.faces.push(new THREE.Face3(1,2,6));
        trd.faces.push(new THREE.Face3(6,5,1));

        trd.faces.push(new THREE.Face3(1,5,4));
        trd.faces.push(new THREE.Face3(4,0,1));

        trd.faces.push(new THREE.Face3(2,3,7));
        trd.faces.push(new THREE.Face3(7,6,2));

        trd.name = name;
        this.geometries[name] = trd;

      }

    }

    // Now run through it again, dealing with unions.
    // IMPORTANT: this DOES NOT work if the objects are BufferGeometries.
    for ( var i = 0; i < solids.length; i++ ) {
      var solid = solids[i];
      var type = solid.nodeName;
      if(type=='#text') continue;
      if(type=='union' || type == 'subtraction') {
        var name = solid.getAttribute('name');
        var first = solid.querySelector('first');
        var geom1 = this.geometries[first.getAttribute('ref')];

        var second = solid.querySelector('second');
        var geom2 = this.geometries[second.getAttribute('ref')];

        var mesh1 = new THREE.Mesh(geom1);
        var mesh2 = new THREE.Mesh(geom2);
        console.log("merging ",first.getAttribute('ref'),second.getAttribute('ref'),'-->',name,mesh1.geometry,mesh2.geometry);

        var position = solid.querySelector('position');
        if(position) {
          var lunits = this.lunits(position);
          mesh2.position.x = (position.getAttribute('x')||0.0)*lunits;
          mesh2.position.y = (position.getAttribute('y')||0.0)*lunits;
          mesh2.position.z = (position.getAttribute('z')||0.0)*lunits;
        }
        var rotation = solid.querySelector('position');
        if(rotation) {
          var aunits = this.aunits(rotation);
          mesh2.rotation.x = (rotation.getAttribute('x')||0.0)*aunits;
          mesh2.rotation.y = (rotation.getAttribute('y')||0.0)*aunits;
          mesh2.rotation.z = (rotation.getAttribute('z')||0.0)*aunits;
        }
        // merge. https://stackoverflow.com/questions/30245990/how-to-merge-two-geometries-or-meshes-using-three-js-r71
        mesh1.updateMatrix();
        mesh2.updateMatrix();
        var singleGeometry = new THREE.Geometry();
        singleGeometry.merge(mesh1.geometry,mesh1.matrix); 
        singleGeometry.merge(mesh2.geometry,mesh2.matrix); 

        singleGeometry.name = name;
        this.geometries[name] = singleGeometry;
      }
    }

  }, /// solids


  parse_volume:  function(volume,threegroup,position,rotation) {
    
    // find our name.
    var name = volume.getAttribute('name');
    if(this.volumes[name]) return this.volumes[name];
    console.log("parsing",name);

    // Logical volumes contain materialref, solidref, physvol
    
    // What is this volume made of?
    var meshMat = this.default_material;
    var materialrefnode= volume.querySelector('materialref');
    if(materialrefnode){
      var ref = materialrefnode.getAttribute('ref');
      if(ref) {
        if(ref in this.materials) { meshMat = this.materials[ref] };
      }
    }

    // What is the geometry?
    var solidrefnode= volume.querySelector('solidref');
    var geo = null;
    if(solidrefnode){
      var ref = solidrefnode.getAttribute('ref');
      geo = this.geometries[ref];
    }

    // Create a mesh for this if we have both a geometry, and the material hasn't been voided by the user.
    var obj;
    if(geo && meshMat) obj = new THREE.Mesh(geo,meshMat);
    else               obj = new THREE.Group();
    obj.position.copy(position);
    obj.rotation.copy(rotation);
    obj.name = name;
    // Now look for all the physvols.
    var physvols = volume.querySelectorAll('physvol');
    for(physvol of physvols) {
      this.parse_physvol(physvol, obj);
    }

    if(name) this.volumes[name] = obj; // store in case it's reused
    threegroup.add(obj);

    return obj;
  },


  parse_physvol: function(physvol,threegroup)
  {
      var name = physvol.getAttribute('name');
      if ( ! name ) {
        name = 'JDoe';
      }
      var children = physvol.childNodes;
      var volumeref = null;

      var position = new THREE.Vector3(0,0,0);
      var rotation = new THREE.Vector3(0,0,0);


      for ( var j = 0; j < children.length; j++ ) {

        var type = children[j].nodeName;

        if ( type === 'volumeref' ) {
          volumeref = children[j].getAttribute('ref');
        }

        if ( type === 'positionref' ) {
          var positionref = children[j].getAttribute('ref');
          position = this.defines[positionref];

        }

        if ( type === 'rotationref' ) {
          var rotationref = children[j].getAttribute('ref');
          rotaion = this.defines[rotationref];

        }

        if ( type === 'position' ) {
          var lunits = this.lunits(children[j]);
          var x = children[j].getAttribute('x')*lunits;
          var y = children[j].getAttribute('y')*lunits;
          var z = children[j].getAttribute('z')*lunits;
          position.set(x ,y, z);
        }

        if ( type === 'rotation' ) {
          var aunits = this.aunits(children[j]);
          var x = children[j].getAttribute('x') * aunits;
          var y = children[j].getAttribute('y') * aunits;
          var z = children[j].getAttribute('z') * aunits;
          rotation.set(x,y,z);
        }

      }

      if(volumeref) {
        // find the named volume
        var volume = this.volume_nodes[volumeref];
        if(!volume) throw "Can't find volumeref " + volumeref;

        this.parse_volume(volume,threegroup,position,rotation);
      }
  },


};
