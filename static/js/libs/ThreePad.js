"use strict";
//
// Code for the ARgo Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

///
/// Boilerplate:  Javascript utilities for MINERvA event display, codenamed "Argo"
/// Nathaniel Tagg  - NTagg@otterbein.edu - June 2009
///
//
/*jshint laxcomma:true */


///
/// This class is used for 2-D views using Three.js OpenGL renderer.
/// View is orthographic only.
/// 


// Global variable to hold magnifying glass render target.

// Notes: This is actually pretty sensitive. High resolution is not better, because some types of lines (the THREE.js default GL.LINES) will render razor-thin and now show up.
// This definately screws things up (not sure what the worst offenders are:) { wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.NearestFilter}

var gMagnifierTexture = new THREE.WebGLRenderTarget( 128, 128 );


// Subclass of ABoundObject.
ThreePad.prototype = Object.create(ABoundObject.prototype);
ThreePad.prototype.constructor = ThreePad;


function ThreePad(element, options )
{
  if(!element) return;
  var defaults = {
    create_2dcontext : false,
    
    // Look at region in 2d space.*
    min_u: -50,
    max_u: 1100,
    min_v: -10,
    max_v: 300,
    margin_bottom : 40,
    margin_top    : 5,
    margin_right  : 5,
    margin_left   : 30,
    fMagnifierOn: false,
    fMousePos : {x:-1e99,y:-1e99,u:-1e99,v:-1e99},
    fMouseStart: {},
    fMouseLast: {},
    fMousePosNorm: new THREE.Vector2,
    fMouseInContentArea : false,
    mag_scale: 1,
    
  }
  $.extend(true,defaults,options);
  ABoundObject.call(this, element, defaults); // Give settings to ABoundObject contructor.
    
  $(element).addClass("threepad");
  // Initial sizing.
  this.width  = $(this.element).width();
  this.height = $(this.element).height();
  this.resolution = new THREE.Vector2( this.width, this.height ); // Use this resolution in creating materials!  It will be updated!
  
  // Create the Three.js renderer, add it to our div
  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setSize(this.width,this.height);
  this.renderer.setPixelRatio( window.devicePixelRatio );
  this.element.appendChild( this.renderer.domElement );
  this.canvas=this.renderer.domElement;

  // Create a new Three.js scene
  this.scene = new THREE.Scene();
    
  this.Resize();  // creates or recreates the camera depending on dom size.


  // Create a magnifying glass object.
  // var pix_radius = parseFloat($('#ctl-magnifier-size').val());  // FIXME adjustable size.
  // var geo_radius = (this.max_u-this.min_u)/this.width*pix_radius;

  this.magnifying_glass = new THREE.Group();  
  this.magnifying_glass.name = "MagnifyingGlass";

  // Set radius as 1. Scale up when drawing in Render().
  var geometry = new THREE.CircleGeometry( 1, 32 /*segments*/ ); // Note that this is in world coordinates!
  var lens_material  = new THREE.MeshBasicMaterial( {map: gMagnifierTexture.texture });
  var lens = new THREE.Mesh( geometry, lens_material );
  lens.name="lens";
  this.magnifying_glass.add(lens);


  // var rim_geo = new THREE.Geometry();
  // for (var i = 0; i <= segmentCount; i++) {
  //     var theta = (i / segmentCount) * Math.PI * 2;
  //     rim_geo.vertices.push(new THREE.Vector3(Math.cos(theta),Math.sin(theta),0));
  // }

  var rim_geo = new THREE.CircleGeometry(1,32);
  rim_geo.vertices.shift();
  var rimmat = new THREE.LineBasicMaterial( { linewidth:3,color: 0x0000FF, opacity: 1.0} );
  var rim = new THREE.LineLoop( rim_geo, rimmat )
  rim.name="rim";
  this.magnifying_glass.add( rim );
  

  // this.magnifying_glass = new THREE.Mesh( geometry, material );
  this.magnifying_glass.position.z=999; // mus  t be on TOP
  this.magnifying_glass.visible=false;
  this.scene.add( this.magnifying_glass );
  
  // Create the magnifier camera.
  this.magnifier_camera = new THREE.OrthographicCamera(-1,1,1,-1,0,2000);
  this.magnifier_camera.name="MagnifierCamera";
  this.scene.add(this.magnifier_camera);


  // Resizing.
  var self = this;
  $(this.element).resize(function(ev){
                         self.Resize(); 
                         self.Render();
                         });         
  $('#ctl-magnifying-glass').on('change',this.Render.bind(this));
  
  // mouse callbacks.
  var fn = this.MouseCallBack.bind(this);
  if(!isIOS()){
    $(this.element).on('click.'     +this.NameSpace, fn);
    $(this.element).on('mousedown.' +this.NameSpace, fn);
    $(this.element).on('mouseenter.'+this.NameSpace, fn);
    $(this.element).on('mouseout.'  +this.NameSpace, fn);
    $(window)      .on('mousemove.' +this.NameSpace, fn);
    $(window)      .on('mouseup.'   +this.NameSpace, fn);
    $(this.element).on('mousewheel.'+this.NameSpace, function(ev,d){if (ev.ctrlKey){return fn(ev,d);} else return true;});
  }

  $(this.element).on('touchstart.'+this.NameSpace, fn);
  $(this.element).on('touchend.'  +this.NameSpace, fn);
  $(this.element).on('touchmove.' +this.NameSpace, fn);
  $(this.element).on('touchenter.'+this.NameSpace, fn);
  $(this.element).on('touchout.'  +this.NameSpace, fn);
}



ThreePad.prototype.UpdateResolution = function(){} // used by class - change all the materials.

ThreePad.prototype.Resize = function()
{
  // Set this object and canvas properties.
  console.warn("ThreePad Resize");
  var width = this.width;
  var height = this.height;
  if( !$(this.element).is(":hidden") ) {
    width = $(this.element).width();
    height = $(this.element).height();
    // console.log("Resize",this,width,height);
  }
  this.width = width;
  this.height = height;

  if(this.canvas && (this.canvas.width !== width || this.canvas.height !== height)) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.renderer.setSize(width,height);
 
    this.resolution.set(this.width,this.height);
    this.UpdateResolution();
    
    // this.canvas.setAttribute('width', width *  this.padPixelScaling);
    // this.canvas.setAttribute('height', height *  this.padPixelScaling);
    // $(this.canvas).css('width', width );
    //  $(this.canvas).css('height', height );
  
  
    var span_u = this.max_u - this.min_u;
    var center_v = 0.5*(this.min_v + this.max_v);
    // Ensure aspect ratio. Use horizontal coordinate as scale; map vertical to match.
    var span_v = span_u / width * height;
    this.min_v = center_v - span_v/2;
    this.max_v = center_v + span_v/2;

    if(!this.camera) {
      this.camera = new THREE.OrthographicCamera(
                                                  this.min_u,this.max_u, // frustrum box, left, right
                                                  this.max_v,this.min_v, // top. bottom. Yes, backwards
                                                  0.1,2000); // min, max distance from camera objects will be rendered. Min is zero.        
      this.scene.add(this.camera);
      this.camera.position.z=1000;
      this.camera.name="MainCamera";
    } else {
    
      this.camera.left = this.min_u;
      this.camera.right = this.max_u;
      this.camera.bottom = this.min_v;
      this.camera.top    = this.max_v;
      this.camera.updateProjectionMatrix();
    }
     
  }
  console.warn("ThreePad",this.width,this.height);
}



ThreePad.prototype.CreateFrame = function(){}





ThreePad.prototype.Draw = function(fast){}


function BoundedPlaneBufferGeometry(x1,x2,y1,y2)
{
  // Makes a plane in z  x1 to x2  and y1 to y2. 
  // Deconstructed and hardcoded all the stuff in PlaneGeometryBuffer.
  var b = new THREE.BufferGeometry();
  var indices = [];
  var vertices = [];
  var normals = [];
  var uvs = [];
  
  vertices.push( x1, y2, 0);  normals.push(0,0,1); uvs.push(0,1);
  vertices.push( x2, y2, 0);  normals.push(0,0,1); uvs.push(1,1);
  vertices.push( x1, y1, 0);  normals.push(0,0,1); uvs.push(0,0);
  vertices.push( x2, y1, 0);  normals.push(0,0,1); uvs.push(1,0);
  
  var indices = [0, 2, 1, 2, 3, 1];
	// build geometry
	b.setIndex( indices );
	b.addAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
	//b.addAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
	b.addAttribute( 'uv', new THREE.Float32BufferAttribute( uvs, 2 ) );
  
  return b;
}



ThreePad.prototype.MouseCallBack = function(ev,scrollDist)
{
  var profname = "mousecallback"+this.UniqueId;
  // All mouse-related callbacks are routed through here.
  this.dirty = false;  // flag that tells us if we need a draw or not.


  if( (ev.type === 'mousemove' || ev.type === 'touchenter') &&
      ( ! this.fMouseInContentArea ) &&
      ( ! ev.which ) ) {
    // mouse move without buttons outside the content area. This is not relevant.
    return;  
  } 


  if(ev.type === 'mouseenter' || ev.type === 'touchenter') { 
    this.fMouseInContentArea = true;
    // Don't redraw unless there's a mousemove event. if(this.fMagnifierOn) this.dirty=true; 
  }


  // Set a redraw if we've moved inside the pad.
  if(ev.type === 'mousemove' || ev.type === 'touchenter') { 
    if(this.fMouseInContentArea && this.fMagnifierOn) { this.dirty=true; }
  }
  
  // If the mouse enters or leaves (or element) then flag the correct thing to do.
  if(ev.type === 'mouseout' || ev.type == 'touchend')     { 
    this.fMouseInContentArea = false;
    if(this.fMagnifierOn) this.dirty=true; 
  }


  // Do computations once for the subclass.
  var offset = getAbsolutePosition(this.element);
  this.fMousePos = {
    x: ev.pageX - offset.x,
    y: ev.pageY - offset.y,
  };
  if(this.rotate_90) {
    this.fMousePos.x = (this.span_x)-(ev.pageY-offset.y);
    this.fMousePos.y = ev.pageX-offset.x;
  }    

  this.fMousePosNorm.set(this.fMousePos.x/this.width*2-1, 1-2*this.fMousePos.y/this.height);
  var v = new THREE.Vector3(this.fMousePosNorm.x, this.fMousePosNorm.y, 1);
  v.unproject( this.camera );  
  this.fMousePos.u = v.x;
  this.fMousePos.v = v.y;

  // console.profile(profname);

  var bubble = true;
  if(ev.type === 'mousewheel') bubble=this.DoMouseWheel(ev,scrollDist);
  else                         bubble = this.DoMouse(ev); // User callback.  User must set dirty=true to do a draw.
  // console.warn("Pad::MouseCallBack",ev,this.fMouseInContentArea,this.dirty);


  if(this.dirty) this.Draw();
  // console.profileEnd();
  return bubble;
};

ThreePad.prototype.Render = function(fast)
{
  console.time("ThreePad.Render()");
  if(this.fMouseInContentArea && this.fMagnifierOn && ($('#ctl-magnifying-glass').is(':checked'))) {
    // find

    this.magnifying_glass.visible = false; // turn off the magnifying glass.
    // Set the camera.
    this.magnifier_camera.position.x = this.fMousePos.u;
    this.magnifier_camera.position.y = this.fMousePos.v;
    var pix_radius = parseFloat($('#ctl-magnifier-size').val());    // Pixels on screen
    var geo_radius = (this.max_u-this.min_u)/this.width*pix_radius; // World coordinates in 3d world of the lens
    
    this.magnifying_glass.scale.set(geo_radius,geo_radius,1);
    
    var mag_radius = geo_radius / parseFloat($('#ctl-magnifier-mag').val()); // Scaled up region has smaller radius. This is the radius of the cylinder seen by the lens (which is smaller than the lens, duh)
    this.magnifier_camera.left  = -mag_radius;
    this.magnifier_camera.right = mag_radius;
    this.magnifier_camera.top   =  mag_radius;
    this.magnifier_camera.bottom= -mag_radius;
    this.magnifier_camera.near  = this.camera.near;
    this.magnifier_camera.far   = this.camera.far;
    this.magnifier_camera.position.z = 1000;
    
    this.magnifier_camera.updateProjectionMatrix();  
    this.magnifying_glass.position.x = this.fMousePos.u;
    this.magnifying_glass.position.y = this.fMousePos.v;

    // Ensure textures have got the correct resolution at this scale:
    this.resolution.set(2*pix_radius,2*pix_radius);
    this.UpdateResolution();
    this.renderer.setRenderTarget(gMagnifierTexture);
    // this.renderer.setPixelRatio( 1 );
    
    this.renderer.render(this.scene, this.magnifier_camera); // render
    this.renderer.setRenderTarget(null);
    this.renderer.setPixelRatio( window.devicePixelRatio );
    
    // Reset
    this.resolution.set(this.width,this.height);
    this.UpdateResolution();
    
    this.magnifying_glass.visible = true; // turn on the magnifying glass for the final render
    
  } else {
    this.magnifying_glass.visible = false; // turn off the magnifying glass.      
  }
  // The normal render.
  console.time("mainrender");
  this.renderer.render( this.scene, this.camera );   
  console.timeEnd("mainrender");
  this.magnifying_glass.visible = false; // turn off the magnifying glass following render.

  console.timeEnd("ThreePad.Render()");

}


ThreePad.prototype.DoMouseWheel = function(ev,scrollDist) {};
ThreePad.prototype.DoMouse = function(ev) {};
  
  // mag glass:
  // I think the best way is to:
  // -have a camera that looks through the mag glass
  // -render the mag glass camera to an offscreen canvas
  // - offscreen canvas then used as texture
  // -Draw the circle as an object in view







  
