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
  var self = this;

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
  
  // Make two cameras.
  this.perspective_camera = new THREE.PerspectiveCamera(  45, // field of view in degrees.
                                              this.width/this.height,
                                              1, 10000); // near, far

  this.perspective_camera.position.set( -1000, 300, 50 );
  this.scene.add(this.perspective_camera);

  this.orthographic_camera = new THREE.OrthographicCamera( -1000, 1000, -1000,1000, -10000, 10000 );
  this.orthographic_camera.position.set( -1000, 300, 50 );
  this.scene.add(this.orthographic_camera);
   

  this.camera = this.perspective_camera;


  // Use my TRID math to update the camera position:
  // this.viewspec = $.extend({},default_viewspec);
  // UpdateCamera();
  this.scene.add(this.camera);
  // this.camera.position.set( 0, 0, 1300 );
	this.camera.position.set( -1000, 300, 50 );
  this.Resize();  // creates or recreates the camera depending on dom size.
 


  this.orbit_controls = new ThreePadOrbitControls(this.camera,this.viewport);

  // function changeCamera(isPerspective) {
  //   var oldCamera = self.camera;
  //   if(isPerspective===false) self.camera = self.orthographic_camera;
  //   else                      self.camera = self.perspective_camera; // default
  //   if(oldCamera != self.camera) {
  //     // Camera changed.
  //     self.orbit_controls.object = self.camera;
  //     if(isPerspective===false) {
  //       // Change the ortho camera to match current view of othro. good notes at https://stackoverflow.com/questions/48758959/what-is-required-to-convert-threejs-perspective-camera-to-orthographic
  //       // depth:
  //       var sightline_vec = new THREE.Vector3();
  //       oldCamera.getWorldDirection(sightline_vec);
  //       var camera_to_target = self.orbit_controls.target.clone();
  //       camera_to_target.sub(oldCamera.position);
  //       var depth = camera_to_target.dot(sightline_vec);

  //       var height_ortho = depth*2*Math.atan( oldCamera.fov*(Math.PI/180) /2 );
  //       var width_ortho = height_ortho / oldCamera.aspect;
  //       self.orthographic_camera.left  = width_ortho/-2;
  //       self.orthographic_camera.right = width_ortho/2;
  //       self.orthographic_camera.top   = height_ortho/2;
  //       self.orthographic_camera.bottom= height_ortho/-2;
  //       // debugger;
  //     }
  //     self.camera.position.copy(oldCamera);
  //     self.camera.quaternion.copy( oldCamera.quaternion ); 
  //     // self.camera.position.set(-1e9,-1e9,-1e9); // Goose position to make sure the orbitcontrols reset.
  //     self.orbit_controls.object = self.camera;
  //     self.orbit_controls.enableRotate = true;
  //     self.orbit_controls.target0 = self.orbit_controls.target.clone();
  //     self.orbit_controls.position = self.orbit_controls.object.position.clone();
  //     self.orbit_controls.zoom0 = self.orbit_controls.object.zoom;

  //     self.orbit_controls.update(true);

  //   }
  //   // self.camera.position.copy(oldCamera.position);
  //   // self.camera.matrix.copy(oldCamera.matrix.clone());
  // }
  function resetCamera(isPerspective) {
    self.camera = self.perspective_camera;
    self.orbit_controls.target.set(0,0,0);
    self.camera.position.set( -1000, 300, 50 );
    self.orbit_controls.setScale(1.0);
    // Center on the middle-numbered TPC, rounded down. that's 0 for microboone, 6 for protodune.
    var tpc = gGeo3.getTpc((Math.floor(gGeo3.numTpcs()/2)));
    self.orbit_controls.target.set(...tpc.center);
    resetOrbitControls(true);
    self.orbit_controls.update();
    self.Render();
  }

  function resetOrbitControls(enableRotate) 
  {
      self.orbit_controls.object = self.camera;
      self.orbit_controls.enableRotate = enableRotate;
      self.orbit_controls.target0 = self.orbit_controls.target.clone();
      self.orbit_controls.position = self.orbit_controls.object.position.clone();
      self.orbit_controls.zoom0 = self.orbit_controls.object.zoom;
  }

  function setView(mode)
  {
    if(mode=="3D") { 
      self.camera = self.perspective_camera;
      resetOrbitControls(true);
      self.orbit_controls.update(); 
      return; 
    }

    if(mode=="XY") {
      self.camera = self.orthographic_camera;
      self.camera.position.set(0,0,-1000);
      self.camera.rotation.set(0,0,0);
      self.camera.quaternion.set(0,0,0,1);
      self.camera.updateMatrixWorld(true);
      self.orbit_controls.target.set(0,0,500);
      resetOrbitControls(false);
      self.orbit_controls.update();
      return;
    }
    if(mode=="YZ") {
      self.camera = self.orthographic_camera;
      self.camera.position.set(-500,0,500);
      self.camera.rotation.set(0,0,1.57);
      self.camera.quaternion.set(0,0,0,1);
      self.camera.updateMatrixWorld(true);
      self.orbit_controls.target.set(0,0,500);
      resetOrbitControls(false);
      self.orbit_controls.update();
      return;
    }
    if(mode=="XZ") {
      self.camera = self.orthographic_camera;
      self.camera.position.set(0,500,500);
      self.camera.rotation.set(0,1.57,0);
      self.camera.quaternion.set(0,0,0,1);
      self.camera.updateMatrixWorld(true);
      self.orbit_controls.target.set(0,0,500);
      resetOrbitControls(false);
      self.orbit_controls.update();
      return;
    }

  }


	this.orbit_controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
  this.orbit_controls.dampingFactor = 0.25;
	this.orbit_controls.screenSpacePanning = false;
	this.orbit_controls.minDistance = 100;
	this.orbit_controls.maxDistance = 3000;
	this.orbit_controls.maxPolarAngle = Math.PI ;
  resetCamera(true);


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
  }
  this.orbit_controls.addEventListener( 'change', this.Render.bind(this)  );
  
  // Resizing.
  $(this.element).resize(function(ev){
                         self.Resize(); 
                         self.Render();
                         });         
  $(this.element).on('mousemove.' +this.NameSpace, this.MouseCallBack.bind(this));
  $(this.element).on('click.' +this.NameSpace, this.MouseCallBack.bind(this));
  
  //
  gStateMachine.Bind('hoverChange', this.HoverAndSelectionChange.bind(this));
  gStateMachine.Bind('selectChange', this.HoverAndSelectionChange.bind(this));
  
  // Wireimg!
  gStateMachine.Bind('change-wireimg',  this.CreateWireimg.bind(this,false) );
  gStateMachine.Bind('toggle-wireimg',  this.UpdateWireimg.bind(this,false) );
  gStateMachine.Bind('zoomChange',      this.UpdateWireimg.bind(this,false) );
  gStateMachine.Bind('zoomChangeFast',  this.UpdateWireimg.bind(this,false) );
  gStateMachine.Bind('changeViewMode',       this.CreateWireimg.bind(this,false) );
  $('#ctl-coherent-noise-filter')     .on("change", this.UpdateWireimg.bind(this) );
  $('input:radio.ctl-bad-wire-filter').on("change", this.UpdateWireimg.bind(this) );
  $('#ctl-gl-edge-finder')            .on("change", this.UpdateWireimg.bind(this) );
  $('input.zoommode:checked')         .on("change", this.UpdateWireimg.bind(this) );
  gStateMachine.Bind('ChangePsuedoColor',    this.Render.bind(this,true) );  // Re-render, but this doesn't require anything more.

  
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
  

    // mc
  gStateMachine.Bind('change-mcparticles', this.CreateMC.bind(this) );  
  gStateMachine.Bind('driftChange',        this.UpdateMC.bind(this) );  
  this.GetBestControl(".show-mc-neutrals") .change(this.UpdateMC.bind(this) );
  this.GetBestControl(".ctl-mc-move-tzero").change(this.UpdateMC.bind(this) );
  gStateMachine.Bind('toggle-mcparticles',this.UpdateVisibilities.bind(this) ); 


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
  

  // controls.
  var self = this;
  var parent = $(this.element).parent()[0];
  $(".trid-zoom-slider"  ,parent)
  .slider({
    animate: "fast",
    min:0.01,
    max:10.0,
    value: 1,
    slide: function(ev,ui){
      console.log("slide",ui.value);
      self.orbit_controls.setScale(ui.value);
      self.orbit_controls.update();
    }
  });
  var unitX = new THREE.Vector3(1,0,0);
  var unitY = new THREE.Vector3(0,1,0);
  var unitZ = new THREE.Vector3(0,0,1);
  var pan_increment = 10; // 10 cm;

  // Zoom in/out buttons for the scrollwheel impaired
  $(".trid-zoom-in"   ,parent)
    .button({icons: {primary: 'ui-icon-zoomin'},text: false})            
    .mousehold(function(ev){self.orbit_controls.dollyOut(self.orbit_controls.getZoomScale()); self.orbit_controls.update();});

  $(".trid-zoom-out"  ,parent)
    .button({icons: {primary: 'ui-icon-zoomout'},text: false})
    .mousehold(function(ev){self.orbit_controls.dollyIn(self.orbit_controls.getZoomScale()); self.orbit_controls.update();});


  // Pad controls: move in XYZ space.
  $(".trid-pan-left"  ,parent)
    .button({icons: {primary: 'ui-icon-arrowthick-1-w'},text: false})
    .mousehold(function(ev){
      self.orbit_controls.target.addScaledVector(unitX,pan_increment);
      self.orbit_controls.update();
      });
  
  $(".trid-pan-right" ,parent)
    .button({icons: {primary: 'ui-icon-arrowthick-1-e'},text: false})
    .mousehold(function(ev){
      self.orbit_controls.target.addScaledVector(unitX,-pan_increment);
      self.orbit_controls.update();
      });

  $(".trid-pan-up"    ,parent)
    .button({icons: {primary: 'ui-icon-arrowthick-1-n'},text: false})           
    .mousehold(function(ev){
      self.orbit_controls.target.addScaledVector(unitY,-pan_increment);
      self.orbit_controls.update();
      });

  $(".trid-pan-down"  ,parent)
    .button({icons: {primary: 'ui-icon-arrowthick-1-s'},text: false})           
    .mousehold(function(ev){      
      self.orbit_controls.target.addScaledVector(unitY, pan_increment);
      self.orbit_controls.update();
      });

  $(".trid-pan-upstream"  ,parent)
      .button({icons: {primary: 'ui-icon-arrowthick-1-ne'},text: false})           
      .mousehold(function(ev){
      self.orbit_controls.target.addScaledVector(unitZ,-pan_increment);
      self.orbit_controls.update();
      });


  $(".trid-pan-downstream"  ,parent)
      .button({icons: {primary: 'ui-icon-arrowthick-1-sw'},text: false})           
      .mousehold(function(ev){      
        self.orbit_controls.target.addScaledVector(unitZ,pan_increment);
      self.orbit_controls.update();
      });


  $(".trid-autorotate" ,parent)
    .button({icons: {primary: 'ui-icon-arrowrefresh-1-s'},text: false})
    .change(function(ev){self.autoRotate($(this).is(':checked'));});

  $(".trid-reset"     ,parent)
    .button({icons: {primary: 'ui-icon-seek-first'},text: false})          
    .click(function(ev){resetCamera(true);});

  $(".trid-ctl-mouse-set"     ,parent)
      .buttonset({icons: {primary: 'ui-icon-seek-first'},text: false});
      
  $(".trid-ctl-mouse-pan"     ,parent)
      .button({icons: {primary: 'ui-icon-transferthick-e-w'},text: false})
      .change(function(ev){
          self.mouse_mode= $(":checked",$(this).parent()).val();
          console.log("mouse mode",self.mouse_mode);
          });

  $(".trid-ctl-mouse-rotate"     ,parent)
      .button({icons: {primary: 'ui-icon-arrow-4'},text: false})
      .change(function(ev){
        self.mouse_mode= $(":checked",$(this).parent()).val();
        console.log("mouse mode",self.mouse_mode);
        });
  
  $(".trid-ctl-view-set"     ,parent)
      .buttonset({icons: {primary: 'ui-icon-seek-first'},text: false});

  $(".trid-ctl-view-set input[type='radio']"     ,parent)
      .button()
      .change(function(ev){
          var mode = $(":checked",$(this).parent()).val();
          setView(mode);
        });


  $(".trid-create-animation"     ,parent)
    .button({icons: {primary: 'ui-icon-note'},text: false})          
    .click(function(ev){self.CreateAnimation();});



  $(window).on('DOMContentLoaded load resize scroll', this.Start3dModelRollbackAnimation.bind(this));

  this.clip_plane_outer = new THREE.Plane(new THREE.Vector3(1,-1,1).normalize(),-500.); this.clip_plane_outer.name = "outer";
  this.clip_plane_pmts  = new THREE.Plane(new THREE.Vector3(1,-1,1).normalize(),-200.); this.clip_plane_pmts.name = "pmts";
  this.clip_plane_inner = new THREE.Plane(new THREE.Vector3(1,-1,1).normalize(),-100.); this.clip_plane_inner.name = "inner";


  $(".trid-model-wipe"  ,parent).slider({
    animate: "fast",
    min:-1000,
    max:200,
    value: 200,
    slide: function(ev,ui){
      self.UpdateFullModel();
    }
  });
  
  
  this.line_materials = [
    this.frameline_material     = new THREE.PerspectiveLineMaterial( { color: 0x000000, worldlinewidth: 5, maxlinewidth:5, minlinewidth:0.1, dashed: false} ),
    this.track_material         = new THREE.PerspectiveLineMaterial( { color: 0x00aa00, worldlinewidth: 0.3, minlinewidth: 0.8, maxlinewidth: 3, dashed: false} ),
    this.track_material_hover   = new THREE.PerspectiveLineMaterial( { color: 0x008800, worldlinewidth: 0.3, minlinewidth: 2,   maxlinewidth: 3, dashed: false} ),
    this.track_material_selected= new THREE.PerspectiveLineMaterial( { color: 0x000000, worldlinewidth: 0.3, minlinewidth: 2,   maxlinewidth: 3, dashed: false} ),
    this.highlight_line_material =  new THREE.LineMaterial( { color: 0xFF0000, linewidth: 2, dashed: false} ),

     this.track_material_selected = new THREE.LineMaterial( { color: 0x500000, linewidth: 4, dashed: false} ),
     this.mc_select_material      = new THREE.LineMaterial( { color: 0x500000, linewidth: 4, dashed: false} ),

    this.mc_material          = new THREE.LineMaterial( { color: 0x0000, linewidth: 1, dashed: false} ),
    this.mc_neutral_material  = new THREE.LineMaterial( { color: 0x0000ff, linewidth: 1, dashed: true} ),
    this.mc_hover_material    = new THREE.LineMaterial( { color: 0xffff00, linewidth: 3, dashed: false}  ),
    this.user_track_rim_material    = new THREE.LineMaterial( { color: new THREE.Color("rgb(40, 92, 0)").getHex(), linewidth: 2, dashed: false}  ),
  ]; 
  // Line materials all need to know the window size.
  for(var mat of this.line_materials) mat.resolution = this.resolution;
  
  this.CreateFrame();
  this.CreateFullModel();
  this.Render();  
}



ThreeTriD.prototype.CreateFrame = function()
{
  this.frame_group = new THREE.Group();
  
  for(var gtpc of gGeo3.data.tpcs) {

  
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
    
    var geo = makeBoxOutlineGeo(gtpc.center[0]-gtpc.halfwidths[0], gtpc.center[0]+gtpc.halfwidths[0],
                                gtpc.center[1]-gtpc.halfwidths[1], gtpc.center[1]+gtpc.halfwidths[1],
                                gtpc.center[2]-gtpc.halfwidths[2], gtpc.center[2]+gtpc.halfwidths[2]);
    var box = new THREE.Line2(geo, this.frameline_material);
    this.frame_group.add(box);
    
    
  } // end tpc loop
 

  var pmtgeo = new THREE.CircleBufferGeometry(15.2, 32);
  var pmtmat = new THREE.MeshBasicMaterial( { color: 0x0000ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide  });
  var dets = gGeo3.opticalDetectors;
  var q = new THREE.Quaternion();
  q.setFromAxisAngle( new THREE.Vector3( 0, 1, 0  ), Math.PI / 2 );
  
  for(var i=0;i<dets.length;i++){
    var det = dets[i];
    var pmt = new THREE.Mesh(pmtgeo,pmtmat);
    pmt.quaternion.copy(q);
    pmt.position.set(det.x,det.y,det.z);
    pmt.name = "opdet " + i;
    this.frame_group.add(pmt);     // FIXME need hover selection.

    // var hov = {obj: det, type: "opdet", collection: gGeo3.opticalDetectors};
  }
  

  
  // // a light
  // var light = new THREE.HemisphereLight(0xfffff0, 0x101020, 1.25);
  // light.position.set(157, 400, 125);
  // this.scene.add(light);

  // //cool but not working right yet  
  // this.gdmlloader = new THREE.GDMLLoader();
  // this.gdmlloader.top_volume_name = "volCryostat";
  // this.gdmlloader.materials = 
  // {
  //   Vacuum: null,
  //   LAr:null,
  //   Air:null,
  //   Ar:null
  // }
  // var scope = this;
  // this.gdmlloader.load( "microboonev12.gdml" ,
  //   function( grp ) {
  //     scope.gdml = grp;
  //     scope.gdml.scale.set(1,1,1);
  //     scope.frame_group.add(scope.gdml);
  //     scope.Render();
  //   }
  // );

  this.scene.add(this.frame_group);

}

ThreeTriD.prototype.UpdateFrame = function()
{
}

ThreeTriD.prototype.CreateFullModel = function()
{
  this.scene_light1 = new THREE.AmbientLight(0x050511);
  this.scene.add(this.scene_light1);
  var light = new THREE.PointLight(0xffffff,1);
  light.position.set(400,300,500) 
  this.scene.add(light);
  // this.scene.add(new THREE.PointLightHelper(light,10,0xff00ff));

  light = new THREE.PointLight(0xffffff,1);
  light.position.set(-50,300,100) 
  this.scene.add(light);
  // this.scene.add(new THREE.PointLightHelper(light,10,0xff00ff));

  light = new THREE.PointLight(0xffffff,1);
  light.position.set(-500,300,900) 
  this.scene.add(light);
  // this.scene.add(new THREE.PointLightHelper(light,10,0xff00ff));




  this.full_model = new THREE.Group();
  this.full_model.name = "model";

  function gltfLoad( gltf ) {
      self.renderer.gammaOutput = true;
      self.renderer.gammaFactor = 2.2;
      self.renderer.localClippingEnabled = true;
      self.full_model_loaded = true;
      self.gltf = gltf;

      var outer    = new THREE.Group();    outer.name = "outer";    self.full_model.add(outer);
      var pmtgroup = new THREE.Group(); pmtgroup.name = "pmtgroup"; self.full_model.add(pmtgroup);
      var inner    = new THREE.Group();    inner.name = "inner";    self.full_model.add(inner);
      for(var j=0;j<gltf.scene.children.length;j++) {
        console.log(j);
        var o = gltf.scene.children[j];
        console.error(o.name,o);
        if(o.type=="Mesh") {
          // True is for recursive cloning, so materials get separated.
          if(o.name.startsWith("o_"))      {  outer.   add(o.clone(true)); } 
          else if(o.name.startsWith("p_")) {  pmtgroup.add(o.clone(true)); }
          else                             {  inner.   add(o.clone(true));  }
        }
      } 

      for(var o of outer.children) {
         console.error("outer",o.name);
         o.material = o.material.clone();
         o.material.clippingPlanes=[self.clip_plane_outer];
      }
      for(var o of pmtgroup.children) {
         o.material = o.material.clone();
         o.material.clippingPlanes=[self.clip_plane_pmts];
      }
      for(var o of inner.children) {
         o.material = o.material.clone();
        o.material.clippingPlanes =[self.clip_plane_inner];
      }
      // var defmat = new THREE.MeshLambertMaterial({color:0x6e93a5, shininess:57, specular:0x111111,side:THREE.DoubleSide});
      // modify
      // for(var o of self.full_model.children) { o.visible = false; }
      // self.full_model.getChildByName("frame").visible=true;
      // self.full_model.getChildByName("largePMTs").visible=true;

      // for(var o of self.full_model.children) {
      //   if(o.type =="Mesh") {
      //     o.material = defmat;
      //   }
      // }


      // var g = new THREE.BoxGeometry(30,30,30);
      // var cube = new THREE.Mesh(g,defmat);
      // self.full_model.add(cube);
    
      self.full_model.scale.set(10,10,10); // scale up from decimeters
      self.full_model.rotation.y = -Math.PI/2;
      self.full_model.position.x = 123.796;
      self.full_model.position.z = 51.849998*10;



      self.scene.add( self.full_model );
      self.UpdateFullModel();
      self.Start3dModelRollbackAnimation();

    }
  var t0 = new Date().getTime(); 
  var self = this;
  var loader = new THREE.GLTFLoader();

  loader.load( '/Models/TPC10.glb', gltfLoad, 
    function ( prog ) {
      var t = new Date().getTime();
      console.log( "progress",t-t0,prog );
    },
    function ( error ) {
            console.error( error );
            loader.load('/Models/TPC10.glb', gltfLoad) ; // try again?

    } );
}

ThreeTriD.prototype.UpdateFullModel = function()
{

  this.clip_plane_outer.constant = $( ".trid-model-wipe-outer" ).slider( "option", "value" );
  this.clip_plane_pmts.constant = $( ".trid-model-wipe-pmts" ).slider( "option", "value" );
  this.clip_plane_inner.constant = $( ".trid-model-wipe-inner" ).slider( "option", "value" );
  if(self.full_model){
    for(g of self.full_model.children)
      for(o of g.children)
        if(o.material) o.material.needsUpdate = true;
  }
  this.dirty=true;
  this.Render();
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
  this.perspective_camera.aspect = this.width/this.height;

  var mid = (this.orthographic_camera.top + this.orthographic_camera.bottom)*0.5;
  var span = (this.orthographic_camera.right - this.orthographic_camera.left)*0.5*this.height/this.width;
  this.orthographic_camera.bottom = mid - span;
  this.orthographic_camera.top    = mid + span;
  this.orthographic_camera.updateProjectionMatrix();

  this.perspective_camera.aspect = this.width/this.height;
  this.perspective_camera.updateProjectionMatrix();

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
    var firstname = null;
    // console.log("intersects:",intersects.length,intersects);
    for(var i=0;i<intersects.length;i++) {
      var intersect = intersects[i];
      var obj = intersect.object;
      // if(!obj.layers.test(this.raycast_layers)) continue; // ignore the magnifier. Obsolete; magnifier removed already
      var ptr = obj.name;
      if(obj.name && firstname==null) firstname = obj.name;
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
    $('.mouseover-text',this.element).html(firstname||'');
    // console.log("mouseover:",firstname)

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
  this.Render();
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



/////////////////////////////////////////
// MC
/////////////////////////////////////////
ThreeTriD.prototype.CreateMC = function()
{

   if(this.mc_group) {
    this.scene.remove(this.mc_group);
    for(var thing of this.mc_group.children) thing.geometry.dispose(); // delete old ones.
  }
  this.mc_group = new THREE.Group();
  this.mc_group.name = "mc";

  var particles = GetSelected("mcparticles");
  if(!particles.length) return;
  
 // Deal with these in Update. 
  var show_neutrals = $(this.ctl_show_mc_neutrals).is(":checked");
  var move_t0       = $(this.ctl_mc_move_tzero).is(":checked");
 

  var nparticles = particles.length;
  // if(nparticles>10) nparticles=10;
  for(var i=0;i<nparticles;i++)
  {
    var p= particles[i];
    if(!p.trajectory || p.trajectory.length<2) continue;
    if(p.trajectory[0].E - p.fmass < 0.001) continue; // Less than 1 MeV particles go less than 1 wire width.
    // compile points
    var pts = [];
    var lastu = 1e99; var lastv = 1e99;

    var data = []; // long list of coordinates, no vectoring
    for(var j=0;j<p.trajectory.length-1;j++) {
        var point = p.trajectory[j];
        data.push(point.x,point.y,point.z);
    }

    var geometry = new THREE.LineGeometry();
    geometry.setPositions(data);
    geometry.raycast_fast = true; // Just take the first segment hit when raycasting.
    
    var pdg = Math.abs(p.fpdgCode);
    var neutral = (pdg == 22 || pdg == 2112 || pdg == 12 || pdg == 14 || pdg == 16);
    if(neutral) continue;
    var mat = (neutral) ? this.mc_material : this.mc_neutral_material; 
 
    var threeobj = new THREE.Line2(geometry, mat);
    threeobj.userData = {
      default_material: mat,
      hover_material:   this.mc_hover_material,
      select_material:  this.mc_select_material,
      neutral: neutral,
      t: p.trajectory[0].t
    }
    threeobj.raycast_fast = true;
    
    // Make it findable again.
    threeobj.name = p._pointer;    
    threeobj.matrixAutoUpdate=false; // Don't auto-compute each time. I'll tell you when your coords change
    threeobj.updateMatrix();     // Oh, they changed.
    this.mc_group.add(threeobj);
  }
  this.scene.add(this.mc_group);
  this.UpdateMC();
  this.dirty=true;
  this.Render();
}



ThreeTriD.prototype.UpdateMC = function()
{
  if(!this.mc_group) return;
  var show_neutrals = this.GetBestControl(".show-mc-neutrals").checked;
  // var move_t0 =       this.GetBestControl(".ctl-mc-move-tzero").checked;

  if(show_neutrals) this.mc_neutral_material.opacity = 0;
  else              this.mc_neutral_material.opacity = 1;
  // this.mc_neutral_material.needsUpdate = true;
  
  this.UpdateVisibilities();
}



/////////////////////////////////////////
// Wireimg
/////////////////////////////////////////



ThreeTriD.prototype.CreateWireimg = function()
{
  if(this.wireimg_group) {
    this.scene.remove(this.wireimg_group); 
     for(var grp of this.wireimg_group.children)
      for(var thing of grp.children){
          if(thing.material) thing.material.dispose();
          if(thing.geometry) thing.geometry.dispose();
      }
  }
  var mapper = null;

  var wname = GetSelectedName("wireimg");
  var wireimg = (((gRecord || {})["wireimg"]        || {})[wname] || {});
  var wlowres = (((gRecord || {})["wireimg-lowres"] || {})[wname] || {});
  if      (wireimg._glmapper) {mapper = wireimg._glmapper; }
  else if (wlowres._glmapper) {mapper = wlowres._glmapper; }
  
  if(!mapper) return;
  this.wireimg_group = new THREE.Group();
  this.max_tdc = mapper.total_width*mapper.scale_x;

  for(var view=0;view<3;view++) {

    for(var tpc=0; tpc< gGeo3.ntpc; tpc++){
      var nwires = gGeo3.numWires(tpc,view);
      var pitch  = gGeo3.wire_pitch(tpc,view);
      console.log("wireimg ",tpc,view);

      // Fixme: need to trim the time so I don't overlap times in different projections
      for(var section of gGeo3.data.tpcs[tpc].views[view].sections) {
        var chanstart = section[0].channel;
        var chanend   = section[1].channel;

        // This is where it goes in world space:
        // horizontal (wire number/ transverse) = x on screen
        var u1 = section[0].trans - pitch/2; // Ensure pixes are centered on the wire.
        var u2 = section[1].trans - pitch/2;

        var gtpc = gGeo3.getTpc(tpc);

        // vertical
        var v1, v2;

        if( gZoomRegion.fullMode() && gZoomRegion.getSelectedTpc() == tpc) {
          // whole time view, correct for microboone:
          var tdc_start = 0; 
          var tdc_end   = mapper.total_width*mapper.scale_x; 
          v1 = gGeo3.getXofTDC(tpc,view,tdc_start);
          v2 = gGeo3.getXofTDC(tpc,view,tdc_end);
        } else {
          // Crop mode.
          // Attempt for DUNE:
          // var v1 =  gtpc.center[0] - gtpc.halfwidths[0];
          // var v2 =  gtpc.center[0] + gtpc.halfwidths[0];
          v1 =  gtpc.views[view].x; // position of wires
          v2 =  gtpc.center[0] - gtpc.drift_dir*gtpc.halfwidths[0]; // position of cathode
        }

        var tdc_start = gGeo3.getTDCofX(tpc,view,v1) + gZoomRegion.getTimeOffset();
        var tdc_end   = gGeo3.getTDCofX(tpc,view,v2) + gZoomRegion.getTimeOffset();

        var flip = (gtpc.drift_dir > 0);

        // metadata so we can get this back:
        var userData = { wireimg: true, tpc: tpc, section: section, view: view, v1: v1, v2:v2};

        var tpc_group = create_image_meshgroup(mapper,
                          chanstart, chanend, // source pixel coord (when textures mapped out)
                          tdc_start,tdc_end,  // source pixed coord
                          u1,u2, // x coord (wire number) in viewer space
                          v1,v2,
                          flip,
                          userData); // y coord (time) in viewer space
        tpc_group.userData.tpc = tpc;
        tpc_group.userData.view = view;
        // this.wireimg_group.scale.y =  gGeo3.getDriftCmPerTick(0); // fixme tpc number
        //console.log("wireimg ",tpc,, u1,u2,v1,v2);

        // Rotate into the correct alignment.  The object is in the XY  (channel,drift) plane, but that's no good!  We need it on the XZ (drift,channel) plane.
        // tpc_group.quaterion = new THREE.Quaternion(); 
        var p = new THREE.Quaternion(); 
        
        tpc_group.quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0), -Math.PI/2); // Rotate so Z is right
        p.setFromAxisAngle(new THREE.Vector3(0,0,1), -Math.PI/2);        
        tpc_group.quaternion.premultiply(p);
        // Now rotate to the right view.
        var vfrom = new THREE.Vector3(0,1,0);
        var vto = new THREE.Vector3();   
        vto.set(...gGeo3.data.basis.along_vectors[view]);
        tpc_group.userData.alongVector = vto;
        p.setFromUnitVectors(vfrom,vto);
        tpc_group.quaternion.premultiply(p);

        this.wireimg_group.add(tpc_group);
      }
    }

  } // tpcs 
  this.scene.add(this.wireimg_group);
  this.UpdateWireimg();

}

ThreeTriD.prototype.UpdateWireimg = function()
{
  if(!this.wireimg_group)  this.CreateWireimg(); 
  if(!this.wireimg_group)  return;

  var do_filter        = $('#ctl-coherent-noise-filter').is(":checked") ? 1:0;
  var bad_channel_flag = $('input:radio.ctl-bad-wire-filter:checked').val();
  var edge_finder      = $('#ctl-gl-edge-finder').is(":checked") ? 1:0;
  var do_smear = 0;
  
  var zoommode = $('input.zoommode:checked').val();
  var center_y = gZoomRegion.getCenter().y;

  for(var tpcgroup of this.wireimg_group.children) {

    var tpc = tpcgroup.userData.tpc;
    var view= tpcgroup.userData.view;

    var gtpc = gGeo3.getTpc(tpc);

    // For each group, set the 3d coordinates.
    // Use the current view center to tell us where to look:
    tpcgroup.position.copy(gZoomRegion.getCenter());
    tpcgroup.position.x = 0;
    tpcgroup.position.projectOnVector(tpcgroup.userData.alongVector);
    if(gZoomRegion.fullMode()) {
      tpcgroup.position.x = 0 - gZoomRegion.getTimeOffset()*-1*gtpc.drift_dir*gGeo3.drift_cm_per_tick 
    }


    for(var mesh of tpcgroup.children) {
      var mat = mesh.material;

      var urange = gZoomRegion.getTransverseRange(view);
      mat.uniforms.trans_cut_fade_width.value = Math.abs(urange[1]-urange[0])*0.02;
      mat.uniforms.trans_cut_low.value  = urange[0] - mat.uniforms.trans_cut_fade_width.value/2;
      mat.uniforms.trans_cut_high.value = urange[1] + mat.uniforms.trans_cut_fade_width.value/2;
      console.error("limiting view",view,urange);

      // Change transverse cut
      if(gZoomRegion.fullMode() && gZoomRegion.getSelectedTpc() == tpc) {
        var t1 = gGeo3.getTDCofX(tpc,view,mesh.userData.v1) + gZoomRegion.getTimeOffset();
        var t2 = gGeo3.getTDCofX(tpc,view,mesh.userData.v2) + gZoomRegion.getTimeOffset();
        mat.uniforms.tdc_start.value = Math.min(t1,t2);
        mat.uniforms.tdc_end.value   = Math.max(t1,t2);

        // This is incorrect: need to add a new tdc CILP value to shader to make it work, OR add clipping geometry (hard)
        var xrange = gZoomRegion.getXRange(gWireViewGL[2].span_y/gWireViewGL[2].span_x); // Get from the main 2d window
        t1 = gGeo3.getTDCofX(tpc,view,xrange[0]) +  gZoomRegion.getTimeOffset();
        t2 = gGeo3.getTDCofX(tpc,view,xrange[1]) +  gZoomRegion.getTimeOffset();
        mat.uniforms.tdc_cut_fade_width.value = Math.abs(t2-t1)*0.02;
        mat.uniforms.tdc_cut_low.value = Math.min(t1,t2) - mat.uniforms.tdc_cut_fade_width.value/2;
        mat.uniforms.tdc_cut_high.value= Math.max(t1,t2) + mat.uniforms.tdc_cut_fade_width.value/2;
        console.error("tdc cut full",t1,t2, mesh.userData.v1,mesh.userData.v2, t1, t2);

      } else {
        // Drift crop:
        var tdc_start = gGeo3.getTDCofX(tpc,view,mesh.userData.v1) + gZoomRegion.getTimeOffset();
        var tdc_end   = gGeo3.getTDCofX(tpc,view,mesh.userData.v2) + gZoomRegion.getTimeOffset();
        mat.uniforms.tdc_start.value = tdc_start;
        mat.uniforms.tdc_end.value = tdc_end;
        console.error("tdc cut crop",tdc_start,tdc_end);

      } 

      // trigger channels
      mat.uniforms.do_noise_reject    .value= do_filter;
      mat.uniforms.do_bad_channel_flag.value= bad_channel_flag;

      mat.needsUpdate = true;
    }

  }
  this.UpdateVisibilities();
  this.Render();
}



ThreeTriD.prototype.Start3dModelRollbackAnimation = function()
{
   if(this.animated_rollback) return;
   if(!isElementInViewport(this.element)) return;
   if(!this.full_model_loaded) return;
   // We have the model and we're in view. Animate that sucker.
   this.animated_rollback = true; // don't fire again.
   console.error("Start 3d rollback!");
   this.StartAnimation("3drollback");
}

ThreeTriD.prototype.StartAnimation = function(ani_name)
{
  this.animate = true;
  this.Render = function(){}; // nullop

  // only one animation so far.
  this.t0 = Date.now();
  this.last_frame_t = this.t0;
  this.AnimationRender();
}

ThreeTriD.prototype.StopAnimation = function()
{
    this.animate = false;
    this.Render = this.DoRender;  
}

ThreeTriD.prototype.AnimationRender = function()
{
  if(!this.animate) return;
  this.orbit_controls.update();
  var t = Date.now() - this.t0;
  var dt = t-this.last_frame_t;
  if(dt > 50) {
   t=this.last_frame_t+50; this.t0=Date.now()-t;
   console.log('reset t0'); 
  } // reset scale.
  dt = t-this.last_frame_t;
  console.log(dt);

  // Update things.
  var reveal1 =     -t/3;
  var reveal2 = 800 -t/3
  var reveal3 = 1600-t/3
  // console.error("animate t=",t,reveal1,reveal2,reveal3);
  $( ".trid-model-wipe-outer" ).slider( { value:reveal1 });
  $( ".trid-model-wipe-pmts"  ).slider( { value:reveal3 });
  $( ".trid-model-wipe-inner" ).slider( { value:reveal2 });
  this.UpdateFullModel();


  this.DoRender();
  this.last_frame_t = Date.now();

  if(reveal3<-1100) this.animate = false;

  if(this.animate) requestAnimationFrame(this.AnimationRender.bind(this));
  else this.StopAnimation();
}

// 
// Code to do cool stuff the first time the 3d comes into view.
//
function isElementInViewport (el) {

    //special bonus for those using jQuery
    if (typeof jQuery === "function" && el instanceof jQuery) {
        el = el[0];
    }

    var rect = el.getBoundingClientRect();

    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && /*or $(window).height() */
        rect.right <= (window.innerWidth || document.documentElement.clientWidth) /*or $(window).width() */
    );
}

function onVisibilityChange(el, callback) {
    var old_visible;
    return function () {
        var visible = isElementInViewport(el);
        if (visible != old_visible) {
            old_visible = visible;
            if (typeof callback == 'function') {
                callback();
            }
        }
    }
}
