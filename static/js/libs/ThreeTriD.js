"use strict";
//
// Code for the ARgo Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

/*jshint laxcomma:true */


///
/// This class is used for 2-D views using Three.js OpenGL renderer.
/// View is orthographic only.
/// 



var gThreeTriD = null;

$(function(){
  $('div.A-ThreeTriD').each(function(){
    gThreeTriD = new ThreeTriD(this);
  });  
});

// Subclass of ABoundObject.
ThreeTriD.prototype = Object.create(ABoundObject.prototype);
ThreeTriD.prototype.constructor = ThreeTriD;


function ThreeTriD(element, options )
{
  if(!element) return;
  var defaults = {    
    // Look at region in 2d space.*
    fMousePos : {x:-1e99,y:-1e99,u:-1e99,v:-1e99},
    fMouseStart: {},
    fMouseLast: {},
    fMousePosNorm: new THREE.Vector2,
    fMouseInContentArea : false,
    // default_viewspec: {
    //   look_at: new TVector3(128.175,0  ,518.4),
    //   theta: -0.224,
    //   phi: 5.72,
    //   distance:1300
    // },
    animate: false,
    line_materials: []
  }
  $.extend(true,defaults,options);
  ABoundObject.call(this, element, defaults); // Give settings to ABoundObject contructor.
    
  $(element).addClass("ThreeTriD");
  $(this.element).css("position","relative");
  
  // Initial sizing.
  this.width  = $(this.element).width();
  this.height = $(this.element).height();
  
  // Create the Three.js renderer, add it to our div
  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setSize(this.width,this.height);
  // this.renderer.setClearColor(0xffffff);
  this.resolution = new THREE.Vector2(this.width,this.height);
  
  this.renderer.setPixelRatio( window.devicePixelRatio );
  this.element.appendChild( this.renderer.domElement );
  this.viewport=this.renderer.domElement;


  // Create a new Three.js scene
  this.scene = new THREE.Scene();
	this.scene.background = new THREE.Color( 0xffffff );
  // this.scene.fog = new THREE.FogExp2( 0xcccccc, 0.002 );
  
  this.camera = new THREE.PerspectiveCamera(  45, // field of view in degrees.
                                              this.width/this.height,
                                              1, 10000); // near, far
  // Use my TRID math to update the camera position:
  // this.viewspec = $.extend({},default_viewspec);
  // UpdateCamera();
  this.camera.name="PerspectiveCamera";
  this.scene.add(this.camera);
  // this.camera.position.set( 0, 0, 1300 );
	this.camera.position.set( -1000, 300, 50 );
  this.Resize();  // creates or recreates the camera depending on dom size.
 
  this.orbit_controls = new THREE.OrbitControls(this.camera,this.viewport);
	this.orbit_controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
  this.orbit_controls.dampingFactor = 0.25;
	this.orbit_controls.screenSpacePanning = false;
	this.orbit_controls.minDistance = 100;
	this.orbit_controls.maxDistance = 3000;
	this.orbit_controls.maxPolarAngle = Math.PI ;
  


  this

  // this.DrawOverlay();
  // this.overlay_dirty = true;
  // Object picking via raycaster.
  this.raycaster = new THREE.Raycaster();
  
  if(this.animate) {
    // Render is a no-op. Instead, we animate!
    this.AnimationRender();
  }
  else {
    this.Render = this.DoRender;  
    this.orbit_controls.addEventListener( 'change', this.Render.bind(this)  );
  }
  // Resizing.
  var self = this;
  $(this.element).resize(function(ev){
                         self.Resize(); 
                         self.Render();
                         });         
  $(this.element).on('mousemove.' +this.NameSpace, this.MouseCallBack.bind(this));
  $(this.element).on('click.' +this.NameSpace, this.MouseCallBack.bind(this));
  
  //
  gStateMachine.Bind('hoverChange', this.HoverAndSelectionChange.bind(this));
  gStateMachine.Bind('selectChange', this.HoverAndSelectionChange.bind(this));
  
  
  // Tracks
  this.ctl_track_shift        =  this.GetBestControl(".track-shift-window");
  this.ctl_track_shift_value  =  this.GetBestControl("#ctl-track-shift-value");
  gStateMachine.Bind('change-tracks',  this.CreateTracks.bind(this,false) );
  gStateMachine.Bind('toggle-tracks', this.UpdateVisibilities.bind(this,false) );
  $(this.ctl_track_shift)       .change( this.UpdateTracks.bind(this) );
  $(this.ctl_track_shift_value) .change( this.UpdateTracks.bind(this) );
  gStateMachine.Bind('driftChange', this.UpdateTracks.bind(this) );  // REbuild since geometry is shot.
  
  // showers
  gStateMachine.Bind('change-showers', this.CreateShowers.bind(this,false) );
  gStateMachine.Bind('toggle-showers', this.UpdateVisibilities.bind(this,false) );
  $(this.ctl_track_shift)       .change( this.UpdateShowers.bind(this) );
  
  // spacepoints
  gStateMachine.Bind('change-spacepoints', this.CreateSpacepoints.bind(this) );  
  gStateMachine.Bind('toggle-spacepoints', this.UpdateVisibilities.bind(this) );  
  $(this.ctl_track_shift)       .change( this.UpdateSpacepoints.bind(this) );
  
  // mouse callbacks.
  // var fn = this.MouseCallBack.bind(this);
  // if(!isIOS()){
  //   $(this.element).on('click.'     +this.NameSpace, fn);
  //   $(this.element).on('mousedown.' +this.NameSpace, fn);
  //   $(this.element).on('mouseenter.'+this.NameSpace, fn);
  //   $(this.element).on('mouseout.'  +this.NameSpace, fn);
  //   $(window)      .on('mousemove.' +this.NameSpace, fn);
  //   $(window)      .on('mouseup.'   +this.NameSpace, fn);
  //   $(this.element).on('wheel.'+this.NameSpace, fn);//function(ev,d){if (ev.ctrlKey){return fn(ev,d);} else return true;});
  // }
  //
  // $(this.element).on('touchstart.'+this.NameSpace, fn);
  // $(this.element).on('touchend.'  +this.NameSpace, fn);
  // $(this.element).on('touchmove.' +this.NameSpace, fn);
  // $(this.element).on('touchenter.'+this.NameSpace, fn);
  // $(this.element).on('touchout.'  +this.NameSpace, fn);
  
  
  this.line_materials = [
    this.frameline_material     = new THREE.SmarterLineMaterial( { color: 0x000000, worldlinewidth: 5, maxlinewidth:30, minlinewidth:0.1, dashed: false} ),
    this.track_material         = new THREE.SmarterLineMaterial( { color: 0x00aa00, worldlinewidth: 0.3, minlinewidth: 0.8, maxlinewidth: 3, dashed: false} ),
    this.track_material_hover   = new THREE.SmarterLineMaterial( { color: 0x008800, worldlinewidth: 0.3, minlinewidth: 2,   maxlinewidth: 3, dashed: false} ),
    this.track_material_selected= new THREE.SmarterLineMaterial( { color: 0x000000, worldlinewidth: 0.3, minlinewidth: 2,   maxlinewidth: 3, dashed: false} ),
    this.highlight_line_material =  new THREE.LineMaterial( { color: 0xFF0000, linewidth: 2, dashed: false} ),

    this.mc_material          = new THREE.LineMaterial( { color: 0x0000, linewidth: 1, dashed: false} ),
    this.mc_neutral_material  = new THREE.LineMaterial( { color: 0x0000ff, linewidth: 1, dashed: true} ),
    this.mc_hover_material    = new THREE.LineMaterial( { color: 0xffff00, linewidth: 3, dashed: false}  ),
    this.mc_select_material   = new THREE.LineMaterial( { color: 0xffffff, linewidth: 3, dashed: false}  ),  
    this.user_track_rim_material    = new THREE.LineMaterial( { color: new THREE.Color("rgb(40, 92, 0)").getHex(), linewidth: 2, dashed: false}  ),
  ]; 
  // Line materials all need to know the window size.
  for(var mat of this.line_materials) mat.resolution = this.resolution;
  
  this.CreateFrame();


  
}

// ThreeTriD.prototype.UpdateCamera() {
//   // My version of OrbitControl.
//   this.camera.position = this.viewspec.look_at;
//   this.camera.position.z += this.viewspec.distance;
//   // Now rotate.
//   var quaternion = new THREE.Quaternion();
//
// }

ThreeTriD.prototype.AnimationRender = function()
{
  requestAnimationFrame(this.AnimationRender.bind(this));
	this.orbit_controls.update();
  // if(this.dirty)
     this.DoRender();
}


ThreeTriD.prototype.CreateFrame = function()
{
  this.frame_group = new THREE.Group();
  var tpc = gGeo.getTpc(0);

  
  function makeBoxOutlineGeo(x1,x2,y1,y2,z1,z2)
  {
    var geo = new THREE.LineSegmentsGeometry;
    var positions = [
      x1,y1,z1, x2,y1,z1,//udownstream end
      x2,y1,z1, x2,y2,z1,
      x2,y2,z1, x1,y2,z1,
      x1,y2,z1, x1,y1,z1,
      
      x1,y1,z2, x2,y1,z2, //upstream end
      x2,y1,z2, x2,y2,z2,
      x2,y2,z2, x1,y2,z2,
      x1,y2,z2, x1,y1,z2,
      
      x1,y1,z1, x1,y1,z2,
      x1,y2,z1, x1,y2,z2,
      x2,y2,z1, x2,y2,z2,
      x2,y1,z1, x2,y1,z2,
    ]
    geo.setPositions(positions);
    return geo;
  }
  
  var geo = makeBoxOutlineGeo(...tpc.xrange,...tpc.yrange,...tpc.zrange);
  var box = new THREE.Line2(geo, this.frameline_material);
  this.orbit_controls.target.set(...tpc.getCenter());
  this.orbit_controls.update();
  this.frame_group.add(box);
  
  var pmtgeo = new THREE.CircleBufferGeometry(15.2, 32);
  var pmtmat = new THREE.MeshBasicMaterial( { color: 0x0000ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide  });
  var dets = gGeo.opDets.opticalDetectors;
  var q = new THREE.Quaternion();
  q.setFromAxisAngle( new THREE.Vector3( 0, 1, 0  ), Math.PI / 2 );
  
  for(var i=0;i<dets.length;i++){
    var det = dets[i];
    var pmt = new THREE.Mesh(pmtgeo,pmtmat);
    pmt.quaternion.copy(q);
    pmt.position.set(det.x,det.y,det.z);
    pmt.name = "opdet " + i;
    this.frame_group.add(pmt);     // FIXME need hover selection.

    // var hov = {obj: det, type: "opdet", collection: gGeo.opDets.opticalDetectors};
  }
  
  var scalecubegeo = new THREE.BoxBufferGeometry(5,5,5);
  var mat = new THREE.MeshBasicMaterial( { color: 0x00ff00 });
  var scalecube    = new THREE.Mesh(scalecubegeo,mat );
  this.frame_group.add(scalecube);
  
  this.scene.add(this.frame_group);
  
  /*
  var loader = new THREE.GLTFLoader();
  var scope = this;
  loader.load(
     "TPC_display.glb",
     function ( gltf ) {
       scope.tpc_group = new THREE.Group();
              for(var obj of gltf.scene.children) scope.tpc_group.add(obj);

       scope.tpc_group.name = "TPC";
       scope.tpc_group.scale.set(25,25,25);
       scope.tpc_group.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2);
       scope.tpc_group.position.z=gGeo.getTpc(0).getCenter()[2];
       // scope.tpc_group.position.x = 700;
       scope.scene.add( scope.tpc_group )
        
     },
   	// called while loading is progressing
   	function ( xhr ) {

   		console.log( ( xhr.loaded / xhr.total * 100 ) + '% loaded' );

   	},
   	// called when loading has errors
   	function ( error ) {

   		console.error( error );

   	}
  );
  */
}

ThreeTriD.prototype.UpdateFrame = function()
{
  
}

ThreeTriD.prototype.UpdateResolution = function(){
  for(var mat of this.line_materials) mat.resolution = this.resolution;
}

ThreeTriD.prototype.Resize = function()
{
  // Set this object and canvas properties.
  // console.warn("ThreeTriD Resize");
  var width = this.width;
  var height = this.height;
  if( !$(this.element).is(":hidden") ) {
    width = $(this.element).width();
    height = $(this.element).height();
  }
  this.width = width;
  this.height = height;
  
  this.padPixelScaling = 1;
  if(window.devicePixelRatio > 1) this.padPixelScaling = window.devicePixelRatio;    // Retina display! Cool!
  // this.overlay.width = width;
  // this.overlay.height = height;
  // this.overlay.setAttribute('width', width *  this.padPixelScaling);
  // this.overlay.setAttribute('height', height *  this.padPixelScaling);
  // $(this.overlay).css('width', width );
  // $(this.overlay).css('height', height );
  // this.ctx.setTransform(1, 0, 0, 1, 0, 0);  // Reset all transforms
  // this.ctx.scale(this.padPixelScaling,this.padPixelScaling);
  

  // if(this.viewport && (this.viewport.width !== width || this.viewport.height !== height)) {
  this.viewport.width = width;
  this.viewport.height = height;
  this.renderer.setSize(width,height);

  this.resolution.set(this.width,this.height);
  this.camera.aspect = this.width/this.height;
  this.camera.updateProjectionMatrix();
  this.UpdateResolution();


  // this.origin_y = this.height - this.margin_bottom;
  // this.origin_x = this.margin_left;
  // this.span_x = width-this.margin_right -this.origin_x;
  // this.span_y = this.origin_y-this.margin_top;
  // if(this.span_x < 10) this.span_x = 10;
  // if(this.span_y < 10) this.span_y = 10;
  //
     
  // }
  // console.warn("ThreeTriD",this.width,this.height);
}





ThreeTriD.prototype.MouseCallBack = function(ev)
{
  // console.log('mousecallback');
  var profname = "mousecallback"+this.UniqueId;
  // All mouse-related callbacks are routed through here.
  this.dirty = false;  // flag that tells us if we need a draw or not.


  // Do computations once for the subclass.
  var offset = getAbsolutePosition(this.element);
  this.fMousePos = {
    x: ev.pageX - offset.x,
    y: ev.pageY - offset.y,
  };

  this.fMousePos.world = this.ScreenToWorld(this.fMousePos); //this.fMousePos.norm.clone().unproject( this.camera );  
  // this.fMousePos.u = this.fMousePos.world.x;
  // this.fMousePos.v = this.fMousePos.world.y;

  // console.profile(profname);

  var bubble = true;
  bubble = this.DoMouse(ev); // User callback.  User must set dirty=true to do a draw.
  // console.warn("Pad::MouseCallBack",ev,this.fMouseInContentArea,this.dirty);


  if(this.dirty) this.Render();
  return bubble;
};



ThreeTriD.prototype.DoMouse = function(ev) {
    var match =  {obj: null, type:"wire"};
  
  	this.raycaster.linePrecision=4;
    this.fMousePos.norm  = new THREE.Vector3(this.fMousePos.x/this.width*2-1, 1-2*this.fMousePos.y/this.height, 1);
  	this.raycaster.setFromCamera( this.fMousePos.norm, this.camera );
    // this.raycast_layers = new THREE.Layers; // set to valid layers. Not required, but leaving
    var intersects = this.raycaster.intersectObjects(this.scene.children,true);
    // console.log("intersects:",intersects.length,intersects);
    for(var i=0;i<intersects.length;i++) {
      var intersect = intersects[i];
      var obj = intersect.object;
      // if(!obj.layers.test(this.raycast_layers)) continue; // ignore the magnifier. Obsolete; magnifier removed already
      var ptr = obj.name;
      // console.log("pick candidate:",obj,ptr);
      if(ptr && ptr.startsWith('/')){
        var path = jsonpointer.parse(ptr);
        // If I put a product_indices array in the object, use it to further specify the json path to the product.
        // See hit creator and spacepoint creator
        if(obj.userData && obj.userData.product_indices) {
          var index = null;
          if(intersect.faceIndex) index = obj.userData.product_indices[intersect.faceIndex];
          if(intersect.index )    index = obj.userData.product_indices[intersect.index];
          ptr+="/"+index;
          path.push(index);
        }
        var product = jsonpointer.get(gRecord,path);
        if(product) {
          var type = path[0];
          switch(path[0]) {
            case 'tracks': type="track"; break;
            case 'hits': type="hit"; break;
          }
        
          match =  {obj:product, type:type, pointer:ptr};
          // canvas pixel coordinates:

          var pt = intersect.point.clone();
          pt.project(this.camera);
        
          match.canvas_coords = new THREE.Vector2(pt.x*this.width/2+this.width/2, 
                                                  -pt.y*this.height/2+this.height/2)
          // console.warn("pick:",match);
          break; // We found the best one.
        }
      }
    
    }

    ChangeHover(match); // match might be null.
    if(ev.type=="click") { // Click, but not on just ordinary wire
      var offset = getAbsolutePosition(this.viewport);      
      if(match.canvas_coords) SetOverlayPosition(match.canvas_coords.x + offset.x, match.canvas_coords.y + offset.y);
      ChangeSelection(match);
    }
  
};


ThreeTriD.prototype.HoverAndSelectionChange = function() 
{
  // // Hits are not independent objects.
  // if(gLastHoverState.type=='hit'||gHoverState.type=='hit'||gLastSelectState.type=="hit"||gSelectState.type=="hit")
  //   this.HoverAndSelectionChange_Hits();
  //
  if(gLastHoverState.type=='spacepoints'||gHoverState.type=='spacepoints'||gLastSelectState.type=="spacepoints"||gSelectState.type=="spacepoints")
    this.HoverAndSelectionChange_Spacepoints();


  // This ordering ensures we get it right

  // Dehighlight the last hover object.
  var name = ((gLastHoverState.obj)||{})._pointer;
  if(name && name.length>0) {
    var obj = this.scene.getObjectByName(name);
    if(obj && obj.userData && obj.userData.default_material)
      obj.material = obj.userData.default_material;
  }
  // Dehighlight the last selected object.
  name = ((gLastSelectState.obj)||{})._pointer;
  if(name && name.length>0) {
    var obj = this.scene.getObjectByName(name);
    if(obj && obj.userData && obj.userData.default_material)
      obj.material = obj.userData.default_material;
  }

  // Highlight the hovered object.
  name = ((gHoverState.obj)||{})._pointer;
  if(name && name.length>0) {
    var obj = this.scene.getObjectByName(name);
    if(obj && obj.userData && obj.userData.hover_material)
      obj.material = obj.userData.hover_material;
  }
  
  // Highlight the selected object.
  name = ((gSelectState.obj)||{})._pointer;
  if(name && name.length>0) {
    var obj = this.scene.getObjectByName(name);
    if(obj && obj.userData && obj.userData.select_material)
      obj.material = obj.userData.select_material;
  }
  
  this.dirty=true;
  
  // this.Render();
}
  





// Screen pixel coordinates to world coordinates.
ThreeTriD.prototype.ScreenToWorld = function(coord, camera){ // coord has x,y members
  var normalized = new THREE.Vector3(coord.x/this.width*2-1, 1-2*coord.y/this.height, 1);
  var retval = normalized.unproject( camera || this.camera );  
  if(isNaN(retval.x)) debugger;
  return retval;
}

ThreeTriD.prototype.WorldToScreen = function(coord, camera) // coord has x,y. If z is not set, it's assumed at 0
{
  var pos=new THREE.Vector3(coord.x,coord.y,coord.z||0);
  pos.project(camera||this.camera);
  pos.x = ( pos.x * this.width/2 ) + this.width/2;
  pos.y = - ( pos.y * this.height/2 ) + this.height/2;
  return pos;
}

ThreeTriD.prototype.GetWorldCoordsForFrame = function()
{
  // For the frame box (measured by the coordinate axes) find the world coordintes.
  var botleft = this.ScreenToWorld({x:this.origin_x, y:this.origin_y});
  var topright = this.ScreenToWorld({x: this.origin_x+this.span_x, y: this.origin_y - this.span_y});

  var retval =  {minu: botleft.x, maxu: topright.x, minv: botleft.y, maxv: topright.y};
  return retval;
}

ThreeTriD.prototype.SetWorldCoordsForFrame = function(newcoord, finished) // newcoord has minu,maxu,minv,maxv
{
  var c = $.extend(this.GetWorldCoordsForFrame(),newcoord); // set any unset values to current
  this.camera.position.x = 0;
  this.camera.position.y = 0;
  // screen coordinate <=> world coordinate
  // x:  margin_left  <=> minu
  // x:  width-margin_right <=> maxu
  var width_u  = (c.maxu-c.minu)*this.width/this.span_x;  // world-coords width of whole viewport
  var height_v = (c.maxv-c.minv)*this.height/this.span_y; //  world-coords hieght of whole viewport
  

  this.camera.left = c.minu - (this.origin_x/this.width)*width_u;
  this.camera.right = this.camera.left + width_u;
  this.camera.bottom  = c.minv - (this.height-this.origin_y)/this.height*height_v;
  this.camera.top = this.camera.bottom + height_v;
  
  // if(isNaN(this.camera.left) || isNaN(this.camera.right) || isNaN(this.camera.bottom) || isNaN(this.camera.top) ) debugger;
  this.camera.updateProjectionMatrix();
  this.dirty = true;
  this.overlay_dirty = true;
}

ThreeTriD.prototype.MoveCamera = function(du,dv,finished)
{
  // this.camera.position.x+=du;
  // this.camera.position.y+=dv;
  // this.camera.updateProjectionMatrix();
  var frame = this.GetWorldCoordsForFrame();
  frame.minu+=du;
  frame.maxu+=du;
  frame.minv+=dv;
  frame.maxv+=dv;
  this.SetWorldCoordsForFrame(frame);
}


ThreeTriD.prototype.CameraChanged = function(newframe, finished) {
}

  
ThreeTriD.prototype.Render = function()
{}


ThreeTriD.prototype.DoRender = function()
{
  // The normal render.
  this.renderer.render( this.scene, this.camera );   
  this.dirty = false;
}
  
  



// overlay
ThreeTriD.prototype.GetGoodTicks = Pad.prototype.GetGoodTicks;
ThreeTriD.prototype.GetGoodTicksTime = Pad.prototype.GetGoodTicksTime;

ThreeTriD.prototype.ClearOverlay = function(){};


ThreeTriD.prototype.DrawOverlay = function(){};





ThreeTriD.prototype.CreateTracks = function()
{
  if(this.track_group) { // Delete it.
    this.scene.remove(this.track_group);
    for(var obj of this.track_group.children) {
      if(obj.geometry) obj.geometry.dispose();
    }
  }

  var tracks = GetSelected("tracks");
  if(tracks.length==0) return;

  this.track_group = new THREE.Group();
  this.track_group.name = tracks._pointer; // jsonpointer

  // var bezier = tracklistname.match(/bezier/)!==null;
  // if(bezier) { return this.DrawBezierTracks(min_u,max_u,min_v,max_v,fast); }
  if(!tracks) return;
  for(var i=0;i<tracks.length;i++)
  {
    var trk = tracks[i];
    var ptr = trk._pointer;
    var points = trk.points;
    // var vertices = []; // long list of 3-vectors
    var data = []; // long list of coordinates, no vectoring
    // var path = [];
    // var geo = new THREE.Geometry();
    for(var j=0;j<points.length;j++) {
      data.push(points[j].x,points[j].y,points[j].z);
    }
  
    var geometry = new THREE.LineGeometry();
    geometry.setPositions(data);
    geometry.raycast_fast = true; // Just take the first segment hit when raycasting.
    var threeobj = new THREE.Line2(geometry, this.track_material);
    threeobj.userData = {
      default_material: this.track_material,
      hover_material:   this.track_material_hover,
      select_material:  this.track_material_selected,
    }
    threeobj.raycast_fast = true;
    
    // Make it findable again.
    threeobj.name = trk._pointer;    
    // threeobj.matrixAutoUpdate=false; // Don't auto-compute each time. I'll tell you when your coords change
    threeobj.updateMatrix();     // Oh, they changed.
    this.track_group.add(threeobj);
  }

  this.scene.add(this.track_group);
  this.dirty = true;
  this.UpdateTracks();
}
ThreeTriD.prototype.UpdateTracks = function()
{
  this.UpdateVisibilities();
}


ThreeTriD.prototype.UpdateVisibilities = function()
{
  // Call when a toggle is flipped.
  var self = this;
  function setVis(threeObj,ctlSelector) {    
    if(threeObj) {
      threeObj.visible = $(self.GetBestControl(ctlSelector)).is(":checked");
    }
  }
  setVis(this.wireimg_group, ".show-wireimg");
  setVis(this.track_group,   ".show-tracks");
  setVis(this.hit_group  ,   ".show-hits");
  setVis(this.cluster_group  ,   ".show-clusters");
  setVis(this.endpoint2d_group  ,   ".show-endpoint2d");
  setVis(this.mc_group  ,   ".show-mcparticles");
  setVis(this.spacepoints_group  ,   ".show-spacepoints");
  setVis(this.showers_group  ,   ".show-showers");
  setVis(this.user_track_group  ,   ".dEdX-Path");

  this.dirty=true;
  this.Render();
}
 
 
///////////////////////////
// Showers
///////////////////////////
ThreeTriD.prototype.CreateShowers = function()
{  
  if(this.showers_group) {
    this.scene.remove(this.showers_group);
    for(var thing of this.showers_group.children) thing.geometry.dispose(); // delete old ones.
  }
  this.shower_material = new THREE.MeshBasicMaterial( { color: 0xff00ff, transparent: true, opacity: 0.9});
  this.shower_hover_material =  new THREE.MeshBasicMaterial( { color: 0xffff00, transparent: true,opacity: 0.9});
  this.shower_select_material = new THREE.MeshBasicMaterial( { color: 0xffff00, transparent: true,opacity: 0.9});
  var showers = GetSelected("showers");
  if(!showers.length) return;
  
  this.showers_group = new THREE.Group();
  this.showers_group.name = "showers";
  
  for(var shw of showers) {
    var u = gGeo.yzToTransverse(this.plane,shw.start.y,shw.start.z);
    var v = shw.start.x;
    var angle = shw.openangle || 20./180*Math.PI/2;
    var Length = shw.Length || 100;
    
    var r  = Length*Math.sin(angle/2)*2;
    
    // exaggerate
    // r*=3; Length*=3;
    var geo = new THREE.ConeBufferGeometry(r, Length, 32, 2, true);
    
    var obj = new THREE.Mesh(geo, this.shower_material);
    obj.position.set(shw.start.x,shw.start.y-Length/2,shw.start.z);
    var dir = new THREE.Vector3(shw.dir.x,shw.dir.y,shw.dir.z);
    dir.normalize();
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),dir);
    // console.log('shower', dir, d1, d2);
    obj.name = shw._pointer;
    obj.userData = {
      default_material:this.shower_material, 
      hover_material:  this.shower_hover_material,
      select_material: this.shower_select_material,      
    }
    this.showers_group.add(obj);
  }
  this.showers_group.name = "showers";
  this.scene.add(this.showers_group);
  this.UpdateShowers();
}

ThreeTriD.prototype.UpdateShowers = function()
{
  // this.offset_track = 0;
  // if(this.ctl_track_shift.is(":checked"))
  //   this.offset_track = parseInt(this.ctl_track_shift_value.val())*gGeo.drift_cm_per_tick; // convert to position.
  //
  // if(this.showers_group)
  //   this.showers_group.position.y = this.offset_track;
  this.UpdateVisibilities();
  this.dirty=true;
  this.Render();
}


///////////////////////////
// Spacepoints
///////////////////////////
ThreeTriD.prototype.CreateSpacepoints = function()
{
  var sps = GetSelected("spacepoints");
  if(!sps.length) return;
  if(this.spacepoints_group) {
    this.scene.remove(this.spacepoints_group);
    for(var thing of this.spacepoints_group.children) thing.geometry.dispose(); // delete old ones.
  }
  
  this.spacepoints_group = new THREE.Group();


  var positions=[];
  var product_indices = []; // One per face, to hold a the hit index
  for(var i = 0; i<sps.length;i++) {
    var sp = sps[i];
    var u = gGeo.yzToTransverse(this.plane,sp.xyz[1],sp.xyz[2]);
    var v = sp.xyz[0];
    positions.push(...sp.xyz);
    product_indices.push(i);
  }
  var geometry = new THREE.BufferGeometry();
  geometry.addAttribute( 'position', new THREE.Float32BufferAttribute( positions, 3 ) );
  geometry.computeBoundingSphere();
  var points = new THREE.Points( geometry, this.spacepoint_material );
  points.name=sps._pointer;
  points.userData = {
    product_indices: product_indices
  };
  this.spacepoints_group.add(points);

  // overlay for selections.
  positions = [0,0,0];
  geometry = new THREE.BufferGeometry();
  geometry.addAttribute('position',  new THREE.Float32BufferAttribute( positions, 3 ));
  this.spacepoint_hover_threeobj  = new THREE.Points(geometry, this.spacepoint_hover_material );
  this.spacepoint_select_threeobj = new THREE.Points(geometry, this.spacepoint_select_material );
  this.spacepoint_hover_threeobj.visible=false;
  this.spacepoint_select_threeobj.visible=false;
  this.spacepoint_hover_threeobj.position.z=1;
  this.spacepoint_select_threeobj.position.z=2;
  
  this.spacepoints_group.add(this.spacepoint_hover_threeobj);
  this.spacepoints_group.add(this.spacepoint_select_threeobj);
  
  
  this.scene.add( this.spacepoints_group );   
  this.UpdateSpacepoints();
};
ThreeTriD.prototype.UpdateSpacepoints = function()
{
  // this.offset_track = 0;
  // if(this.ctl_track_shift.is(":checked"))
  //   this.offset_track = parseInt(this.ctl_track_shift_value.val())*gGeo.drift_cm_per_tick; // convert to position.
  //
  // if(this.spacepoints_group)
  //   this.spacepoints_group.position.y = this.offset_track;
  this.UpdateVisibilities();
  this.dirty=true;
  this.Render();
}
ThreeTriD.prototype.HoverAndSelectionChange_Spacepoints = function()
{
  // Draw or remove  highlight points.
  
  var sp = gHoverState.obj;
  if(gHoverState.type=='spacepoints' ) {
    this.spacepoint_hover_threeobj.visible=true;
    this.spacepoint_hover_threeobj.position.fromArray(sp.xyz,0);
  } else {
    this.spacepoint_hover_threeobj.visible = false;
  }
  
  sp = gSelectState.obj;
  if(gSelectState.type=='spacepoints' ) {
    this.spacepoint_select_threeobj.visible=true;
    this.spacepoint_hover_threeobj.position.fromArray(sp.xyz,0);
  } else {
    this.spacepoint_select_threeobj.visible = false;
  }
}
 
