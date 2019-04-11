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
// 'Main' scripts for argo.html
// Used to be in 'head', but it was too unwieldly.
//
/*jshint laxcomma:true */

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
    
  }
  $.extend(true,defaults,options);
  ABoundObject.call(this, element, defaults); // Give settings to ABoundObject contructor.
    
  // Initial sizing.
  this.width  = $(this.element).width();
  this.height = $(this.element).height();
  
  // Create the Three.js renderer, add it to our div
  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setSize(this.width,this.height);
  this.renderer.setPixelRatio( window.devicePixelRatio );
  this.element.appendChild( this.renderer.domElement );
  this.canvas=this.renderer.domElement;

  // Create a new Three.js scene
  this.scene = new THREE.Scene();
    
  this.Resize();  // creates or recreates the camera depending on dom size.

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
    this.renderer.setSize(this.width,this.height,false);
    
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
  
  // this.fMousePos.u = this.GetU(this.fMousePos.x);
 //  this.fMousePos.v = this.GetV(this.fMousePos.y);

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
  console.time("render");
  this.renderer.render( this.scene, this.camera );   
  console.timeEnd("render");  
}


ThreePad.prototype.DoMouseWheel = function(ev,scrollDist) {};
ThreePad.prototype.DoMouse = function(ev) {};
  
  // mag glass:
  // I think the best way is to:
  // -have a camera that looks through the mag glass
  // -render the mag glass camera to an offscreen canvas
  // - offscreen canvas then used as texture
  // -Draw the circle as an object in view







  
