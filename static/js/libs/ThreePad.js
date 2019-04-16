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
    
    mouse_pan_u: true,
    mouse_pan_v: true,
    
    // pad-like things:
    margin_bottom : 5,
    margin_top : 5,
    margin_right : 5,
    margin_left : 5,
    bg_color : bgcolor_str,
    draw_box : true,
    draw_axes : true,
    draw_ticks_x:true,
    draw_grid_x:true,
    draw_tick_labels_x:true,
    draw_ticks_y:true,
    draw_grid_y:true,
    draw_tick_labels_y:true,
    tick_label_font: "12px sans-serif",
    time_on_x: false,
    tick_pixels_x : 40,
    tick_pixels_y : 40,
    log_y:false,  
    xlabel : null,
    ylabel : null,
    // control the DoMousePanAndScale() function;
    mouse_scale_max_u  : true,
    mouse_scale_min_u  : true,
    mouse_scale_max_v  : true,
    mouse_scale_min_v  : true,
    mouse_pan_u        : true,
    mouse_pan_v        : true,
    
    overlay_background_color: 'rgba(255,255,255,0.75)'
    
  }
  $.extend(true,defaults,options);
  ABoundObject.call(this, element, defaults); // Give settings to ABoundObject contructor.
    
  $(element).addClass("threepad");
  $(this.element).css("position","relative");
  
  // Initial sizing.
  this.width  = $(this.element).width();
  this.height = $(this.element).height();
  
  // Create the Three.js renderer, add it to our div
  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setSize(this.width,this.height);
  this.resolution = new THREE.Vector2(this.width,this.height);
  
  this.renderer.setPixelRatio( window.devicePixelRatio );
  this.element.appendChild( this.renderer.domElement );
  this.viewport=this.renderer.domElement;
  $(this.viewport).attr("style","position: absolute; left: 0; top: 0; z-index: 0;");

  this.overlay = document.createElement("canvas");      
  $(this.overlay).attr("style","position: absolute; left: 0; top: 0; z-index: 1");
  this.element.appendChild(this.overlay);
  this.ctx = this.overlay.getContext('2d');
  

  // Create a new Three.js scene
  this.scene = new THREE.Scene();
  this.camera = new THREE.OrthographicCamera(
                                              this.min_u,this.max_u, // frustrum box, left, right
                                              this.max_v,this.min_v, // top. bottom. Yes, backwards
                                              0.1,2000); // min, max distance from camera objects will
  this.camera.position.z=1000;
  this.camera.name="MainCamera";
  this.camera.layers.enable(0); // default layer
  this.camera.layers.enable(30); // layer 30 contains the magnifying glass.
  this.scene.add(this.camera);



  this.Resize();  // creates or recreates the camera depending on dom size.
  this.resolution.set(this.width,this.height);

  this.CreateMagnifyingGlass();

  this.CreateFrame();


  this.DrawOverlay();
  this.overlay_dirty = true;
  // Object picking via raycaster.
  this.raycaster = new THREE.Raycaster();
  
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
    $(this.element).on('wheel.'+this.NameSpace, fn);//function(ev,d){if (ev.ctrlKey){return fn(ev,d);} else return true;});
  }

  $(this.element).on('touchstart.'+this.NameSpace, fn);
  $(this.element).on('touchend.'  +this.NameSpace, fn);
  $(this.element).on('touchmove.' +this.NameSpace, fn);
  $(this.element).on('touchenter.'+this.NameSpace, fn);
  $(this.element).on('touchout.'  +this.NameSpace, fn);
}

ThreePad.prototype.CreateMagnifyingGlass = function()
{
  // Create a magnifying glass object.
  // var pix_radius = parseFloat($('#ctl-magnifier-size').val());  // FIXME adjustable size.
  // var geo_radius = (this.max_u-this.min_u)/this.width*pix_radius;

  this.magnifying_glass = new THREE.Group();  
  this.magnifying_glass.layers.set(30);
  this.magnifying_glass.name = "MagnifyingGlass";

  // Set radius as 1. Scale up when drawing in Render().
  var geometry = new THREE.CircleGeometry( 1, 32 /*segments*/ ); // Note that this is in world coordinates!
  var lens_material  = new THREE.MeshBasicMaterial( {map: gMagnifierTexture.texture });
  var lens = new THREE.Mesh( geometry, lens_material );
  lens.layers.set(30);
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
  var rim = new THREE.LineLoop( rim_geo, rimmat );
  rim.layers.set(30);
  rim.name="rim";
  this.magnifying_glass.add( rim );
  

  // this.magnifying_glass = new THREE.Mesh( geometry, material );
  this.magnifying_glass.position.z=999; // mus  t be on TOP
  // this.magnifying_glass.visible=false;
  this.scene.add( this.magnifying_glass );
  
  // Create the magnifier camera.
  this.magnifier_camera = new THREE.OrthographicCamera(-1,1,1,-1,0,2000);
  this.magnifier_camera.name="MagnifierCamera";
  this.scene.add(this.magnifier_camera);
}

ThreePad.prototype.CreateFrame = function()
{
  // this.frame_backing_material = new THREE.MeshBasicMaterial({color:0xffffff});
 //
 //  this.frame_group = new THREE.Group();
 //  this.frame_group.name = "frame";
 //  // bottom bar
 //  var wwidth  = this.camera.right - this.camera.left; // world span coordinates (assume no zoom)
 //  var wheight = this.camera.top   - this.camera.bottom; // world span coordinates (assume no zoom)
 //  var center = (new THREE.Vector3(0,0,1)).unproject(this.camera); // center of the world
 //
 //
 //  var bottom_margin = 20; // pixels
 //  var geometry = new THREE.PlaneBufferGeometry(wwidth,bottom_margin*wheight/this.height);
 //  var bottom_bar = new THREE.Mesh(geometry,this.frame_backing_material);
 //  bottom_bar.position.x = center.x;
 //  bottom_bar.position.y = -wheight/2 ;//+ bottom_margin*wheight/this.height/2
 //  bottom_bar.position.z = 100;
 //  bottom_bar.name = "bottom bar";
 //  this.frame_group.add(bottom_bar);
 //
 //  this.scene.add(this.frame_group);
}

ThreePad.prototype.UpdateFrame = function()
{
  
}

ThreePad.prototype.UpdateResolution = function(){} // used by class - change all the materials.

ThreePad.prototype.Resize = function()
{
  // Set this object and canvas properties.
  // console.warn("ThreePad Resize");
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
  this.overlay.width = width;
  this.overlay.height = height;
  this.overlay.setAttribute('width', width *  this.padPixelScaling);
  this.overlay.setAttribute('height', height *  this.padPixelScaling);
  $(this.overlay).css('width', width );
  $(this.overlay).css('height', height );
  this.ctx.setTransform(1, 0, 0, 1, 0, 0);  // Reset all transforms
  this.ctx.scale(this.padPixelScaling,this.padPixelScaling);
  

  // if(this.viewport && (this.viewport.width !== width || this.viewport.height !== height)) {
  this.viewport.width = width;
  this.viewport.height = height;
  this.renderer.setSize(width,height);

  this.resolution.set(this.width,this.height);
  this.UpdateResolution();
  
  // We want consistent u and v scaling: center view on current v center coordinate, scale 
  // the v direction to match.  
  var span_u = this.max_u - this.min_u;
  var center_v = 0.5*(this.min_v + this.max_v);
  // Ensure aspect ratio. Use horizontal coordinate as scale; map vertical to match.
  var span_v = span_u / width * height;
  this.min_v = center_v - span_v/2;
  this.max_v = center_v + span_v/2;

  this.camera.left   = this.min_u;
  this.camera.right  = this.max_u;
  this.camera.bottom = this.min_v;
  this.camera.top    = this.max_v;
  this.camera.updateProjectionMatrix();


  this.origin_y = this.height - this.margin_bottom;
  this.origin_x = this.margin_left;
  this.span_x = width-this.margin_right -this.origin_x;
  this.span_y = this.origin_y-this.margin_top;
  if(this.span_x < 10) this.span_x = 10;
  if(this.span_y < 10) this.span_y = 10;
  
     
  // }
  // console.warn("ThreePad",this.width,this.height);
}




function BoundedPlaneBufferGeometry(x1,x2,y1,y2)
{
  // Makes a plane in z  x1 to x2  and y1 to y2. 
  // Deconstructed and hardcoded all the stuff in PlaneGeometryBuffer.
  // But doesn't impliment RayCast so it's not really useful; PlaneGeometry does it as well
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



ThreePad.prototype.MouseCallBack = function(ev)
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

  this.fMousePos.world = this.ScreenToWorld(this.fMousePos); //this.fMousePos.norm.clone().unproject( this.camera );  
  // this.fMousePos.u = this.fMousePos.world.x;
  // this.fMousePos.v = this.fMousePos.world.y;

  // console.profile(profname);

  var bubble = true;
  if(ev.type === 'wheel') bubble = this.DoMouseWheel(ev);
  else                    bubble = this.DoMouse(ev); // User callback.  User must set dirty=true to do a draw.
  // console.warn("Pad::MouseCallBack",ev,this.fMouseInContentArea,this.dirty);


  if(this.dirty) this.Render();
  return bubble;
};



ThreePad.prototype.DoMouseWheel = function(ev) {
  // Zoom in/out around the mouse.
  if(!ev.ctrlKey) {return true;}
  if(this.fMouseInContentArea) {
    var delta = ev.originalEvent.deltaY; // jquery event wrapper
    if(ev.originalEvent.deltaMode==0x01) delta*=10; // DOM_DELTA_LINE
    if(ev.originalEvent.deltaMode==0x02) delta*=20; // DOM_DELTA_PAGE
    
    var scale = 1;
    if(delta<-250) delta = -250; // clamp it so I don't get crazy values.
    if(delta>250)  delta = 250;  // ditto
    if(delta<0) scale = 1+delta/500.;
    if(delta>0) scale = 1/(1-delta/500.); // make it symmetrical
    
    var frame = this.GetWorldCoordsForFrame();
    var newframe = {};
    newframe.minu = this.fMousePos.world.x*(1.0-scale) + frame.minu*scale;
    newframe.maxu = (frame.maxu-frame.minu)*scale + newframe.minu;

    newframe.minv = this.fMousePos.world.y*(1.0-scale) + frame.minv*scale;
    newframe.maxv = (frame.maxv-frame.minv)*scale + newframe.minv;
    
    this.SetWorldCoordsForFrame(newframe);
    // gStateMachine.Trigger("zoomChange");
    this.dirty = true;
    return false;    
  }
  return true;
};

ThreePad.prototype.DoMouse = function(ev) {
  // Should be called by the decendent classes, too
  // First, deal with mouse-ups that are probably outside my region.
  if(ev.type === 'mouseenter') return; // dont need to deal with this.
  if(ev.type === 'mouseout') return;   // dont need to deal with this.
  // This is a mouse-up
  if(ev.type === 'mouseup') this.fDragging = false;
  else   ev.originalEvent.preventDefault();

  // Which area is mouse start in?
  var mouse_area;
  if(this.fMousePos.y > this.origin_y ) {
    if(this.mouse_scale_min_u) mouse_area = "xscale_left";
    if(this.mouse_scale_max_u) mouse_area = "xscale-right";
    if(this.mouse_scale_max_u && this.mouse_scale_min_u && this.fMousePos.x< (this.origin_x + this.span_x/2)) mouse_area = "xscale-left";  
  } else if(this.fMousePos.x < this.origin_x) {
    if(this.mouse_scale_min_v) mouse_area = "yscale_down";
    if(this.mouse_scale_max_v) mouse_area = "yscale-up";
    if(this.mouse_scale_max_v && this.mouse_scale_min_u && this.fMousePos.y > (this.origin_y - this.span_y/2)) mouse_area = "yscale-down";  
  } else {
    if(this.mouse_pan_u || this.mouse_pan_v)
      mouse_area = "body-pan";
  }
  // Change cursor.
  switch(mouse_area) {
    case "body-pan":     this.overlay.style.cursor = "move"; break;
    case "xscale-right": this.overlay.style.cursor = "e-resize";  break;
    case "xscale-left":  this.overlay.style.cursor = "w-resize";  break;
    case "yscale-up":    this.overlay.style.cursor = "n-resize"; break;
    case "yscale-down":  this.overlay.style.cursor = "s-resize"; break;
  }
      
  var relx, rely;  
  var frame = this.GetWorldCoordsForFrame();
  var newframe = {};
  if(this.fDragging) {
      // Update new zoom position or extent...
    if(this.fMouseStart.area == "body-pan"){
      // Use the last frame's camera to see where I am now
      var vec1 = this.ScreenToWorld(this.fMousePos ,this.fCameraLast);
      var vec2 = this.ScreenToWorld(this.fMouseLast,this.fCameraLast); // screen to world
      var du = vec2.x-vec1.x;
      var dv = vec2.y-vec1.y;
      this.fMouseLast = $.extend({},this.fMousePos); // copy.
      this.fCameraLast = this.camera.clone();
      this.MoveCamera(du,dv,(ev.type==='mouseup'));
      this.dirty=true;
      
    } else if(this.fMouseStart.area == "xscale-right") {
      relx = this.fMousePos.x - this.origin_x;
      if(relx <= 5) relx = 5; // Cap at 5 pixels from origin, to keep it sane.
      // Want the T I started at to move to the current posistion by scaling.
      newframe.maxu = this.span_x * (this.fMouseStart.world.x-frame.minu)/relx + frame.minu;
      return this.SetWorldCoordsForFrame(newframe,(ev.type==='mouseup'));
                  
    } else if(this.fMouseStart.area == "xscale-left") {
      relx = this.origin_x + this.span_x - this.fMousePos.x;
      if(relx <= 5) relx = 5; // Cap at 5 pixels from origin, to keep it sane.
      newframe.minu = frame.maxu - this.span_x * (frame.maxu - this.fMouseStart.world.x)/relx;
      return this.SetWorldCoordsForFrame(newframe,(ev.type==='mouseup'));
      
    } else if(this.fMouseStart.area == "yscale-up") {
      rely =  this.origin_y - this.fMousePos.y;
      if(rely <= 5) rely = 5; // Cap at 5 pixels from origin, to keep it sane.
      newframe.maxv = this.span_y * (this.fMouseStart.world.y-frame.minv)/rely + frame.minv;
      return this.SetWorldCoordsForFrame(newframe,(ev.type==='mouseup'));
    
    }else if(this.fMouseStart.area == "yscale-down") {
      rely =  this.fMousePos.y - (this.origin_y - this.span_y);
      if(rely <= 5) rely = 5; // Cap at 5 pixels from origin, to keep it sane.
      newframe.minv = frame.maxv - this.span_y * (frame.maxv-this.fMouseStart.world.y)/rely;
      return this.SetWorldCoordsForFrame(newframe,(ev.type==='mouseup'));
    }
  }
  
  if(ev.type === 'mousedown' && this.fMouseInContentArea) {
    // Check to see if object is draggable, instead of the view.
    this.fMouseStart= $.extend({},this.fMousePos); // copy.
    this.fMouseLast = $.extend({},this.fMousePos); // copy.
    this.fMouseStart.area = mouse_area;
    this.fStartCamera = this.camera.clone();
    this.fCameraLast = this.camera.clone();

    this.fDragging = true;
  }
  
};
  
  
// For the current camera:





// Screen pixel coordinates to world coordinates.
ThreePad.prototype.ScreenToWorld = function(coord, camera){ // coord has x,y members
  var normalized = new THREE.Vector3(coord.x/this.width*2-1, 1-2*coord.y/this.height, 1);
  var retval = normalized.unproject( camera || this.camera );  
  if(isNaN(retval.x)) debugger;
  return retval;
}

ThreePad.prototype.WorldToScreen = function(coord, camera) // coord has x,y. If z is not set, it's assumed at 0
{
  var pos=new THREE.Vector3(coord.x,coord.y,coord.z||0);
  pos.project(camera||this.camera);
  pos.x = ( pos.x * this.width/2 ) + this.width/2;
  pos.y = - ( pos.y * this.height/2 ) + this.height/2;
  return pos;
}

ThreePad.prototype.GetWorldCoordsForFrame = function()
{
  // For the frame box (measured by the coordinate axes) find the world coordintes.
  var botleft = this.ScreenToWorld({x:this.origin_x, y:this.origin_y});
  var topright = this.ScreenToWorld({x: this.origin_x+this.span_x, y: this.origin_y - this.span_y});

  var retval =  {minu: botleft.x, maxu: topright.x, minv: botleft.y, maxv: topright.y};
  return retval;
}

ThreePad.prototype.SetWorldCoordsForFrame = function(newcoord, finished) // newcoord has minu,maxu,minv,maxv
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

ThreePad.prototype.MoveCamera = function(du,dv,finished)
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


ThreePad.prototype.CameraChanged = function(newframe, finished) {
  // called when the camera changes in any way.
  // finished is true if there we want to finalize change (user has lifted finger off button)
}

  


ThreePad.prototype.Render = function()
{
  // console.time("ThreePad.Render()");
  if(this.fMouseInContentArea && this.fMagnifierOn && ($('#ctl-magnifying-glass').is(':checked')))  {
    this.magnifying_glass.visible = true; // Turn it on (affects main camera only, b/c layers)

    //this.magnifying_glass.visible = false; // turn off the magnifying glass. // handled by layers
    // Set the camera.
    
    // This aspect ratio is 1 if world coords are natural: i.e. locked tdc/adc
    var aspect_ratio = this.height/this.width/(this.camera.top-this.camera.bottom)*(this.camera.right-this.camera.left);
    this.magnifier_camera.position.x = this.fMousePos.world.x;
    this.magnifier_camera.position.y = this.fMousePos.world.y;
    var pix_radius = parseFloat($('#ctl-magnifier-size').val());    // Pixels on screen
    var geo_radius = (this.max_u-this.min_u)/this.width*pix_radius; // World coordinates in 3d world of the lens
    
    this.magnifying_glass.scale.set(geo_radius,geo_radius/aspect_ratio,1);
    
    var mag_radius = geo_radius / parseFloat($('#ctl-magnifier-mag').val()); // Scaled up region has smaller radius. This is the radius of the cylinder seen by the lens (which is smaller than the lens, duh)
    this.magnifier_camera.left  = -mag_radius;
    this.magnifier_camera.right = mag_radius;
    this.magnifier_camera.top   =  mag_radius/aspect_ratio;
    this.magnifier_camera.bottom= -mag_radius/aspect_ratio;
    this.magnifier_camera.near  = this.camera.near;
    this.magnifier_camera.far   = this.camera.far;
    this.magnifier_camera.position.z = 1000;
    
    this.magnifier_camera.updateProjectionMatrix();  
    this.magnifying_glass.position.x = this.fMousePos.world.x;
    this.magnifying_glass.position.y = this.fMousePos.world.y;

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
    
    // this.magnifying_glass.visible = true; // turn on the magnifying glass for the final render
  } else {
    this.magnifying_glass.visible = false; // turn off the magnifying glass.
  }
  // The normal render.
  // console.time("mainrender");
  this.renderer.render( this.scene, this.camera );   
  this.dirty = false;
  // console.timeEnd("mainrender");
  // this.magnifying_glass.visible = false; // turn off the magnifying glass following render.

  // console.timeEnd("ThreePad.Render()");
  if(this.overlay_dirty) this.DrawOverlay();
}
  
  


// interface to pad
ThreePad.prototype.GetX = function(u)
{
  return (this.WorldToScreen({x:u,y:0})).x;  
  return (u-this.camera.position.x+this.camera.left)/(this.camera.right-this.camera.left)*this.width;    
}
ThreePad.prototype.GetY = function(v)
{
  return (this.WorldToScreen({x:0,y:v})).y  
  return this.height - (v-this.camera.position.y+this.camera.bottom)/(this.camera.top-this.camera.bottom)*this.height;
}


// overlay
ThreePad.prototype.GetGoodTicks = Pad.prototype.GetGoodTicks;
ThreePad.prototype.GetGoodTicksTime = Pad.prototype.GetGoodTicksTime;

ThreePad.prototype.ClearOverlay = function()
{
  // this.ctx.fillStyle = "rgba(0,0,0,0)"; //
  // this.ctx.fillRect(0,0,this.width,this.height);
  this.ctx.clearRect(0,0,this.width,this.height);
};


ThreePad.prototype.DrawOverlay = function()
{
  this.overlay_dirty = false;
  this.ClearOverlay();
  this.ctx.fillStyle = this.overlay_background_color
  this.ctx.fillRect(this.origin_x,this.origin_y,this.width,this.height);
  this.ctx.fillRect(0,0,this.origin_x,this.height);
  
  // set this.min_u etc
  var frame = this.GetWorldCoordsForFrame();
  this.min_u = frame.minu;
  this.max_u = frame.maxu;
  this.min_v = frame.minv;
  this.max_v = frame.maxv;
  Pad.prototype.DrawFrame.call(this);
};





  
