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


$(function(){
  $('div.A-WireViewGL').each(function(){
     gWireViewGL = new PadThree(this);
  });  
});



// Subclass of Pad.
PadThree.prototype = new ABoundObject();

function PadThree(element, options )
{
  if(!element) return;
  var defaults = {
    create_2dcontext : false,
    
    min_u: 0,
    max_u: 100,
    min_v: 0,
    max_v: 1000,
    margin_bottom : 40,
    margin_top    : 5,
    margin_right  : 5,
    margin_left   : 30,
    
  }
  $.extend(true,defaults,options);
  ABoundObject.call(this, element, defaults); // Give settings to ABoundObject contructor.
  
  // Remove the canvas and replace with our own.
  // $(this.canvas).remove();
  
  this.Resize();
  // Create the Three.js renderer, add it to our div
  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setSize(this.width,this.height);
  this.element.appendChild( this.renderer.domElement );
  this.canvas=this.renderer.domElement;

  // Create a new Three.js scene
  this.scene = new THREE.Scene();
	    // Create a camera and add it to the scene

        // this.camera = new THREE.PerspectiveCamera( 45, this.canvas.offsetWidth / this.canvas.offsetHeight, 1, 4000 );
        // this.camera.position.set( 0, 0, 3.3333 );
        var du = (this.min_u-this.max_u);
        var dv = (this.min_v-this.max_v);
        // this.camera = new THREE.OrthographicCamera( this.min_u-(, this.width, 0, this.height, -10,10);
        
        this.scene.add( this.camera );

        // // Now, create a rectangle and add it to the scene
        // this.geometry = new THREE.PlaneGeometry(1, 1);
        // this.mesh = new THREE.Mesh( this.geometry, new THREE.MeshBasicMaterial( ) );
        // this.scene.add( this.mesh );
        // // Render it

        var geometry = new THREE.BoxGeometry( 1, 2, 2 );
        var material = new THREE.MeshBasicMaterial( { color: 0x00ff00 } );
        var cube = new THREE.Mesh( geometry, material );
        // this.scene.add( cube );

      var material = new THREE.LineBasicMaterial({ color: 0xffffff });
      var geometry = new THREE.Geometry();      
      // geometry.vertices.push(new THREE.Vector3(this.GetX(this.min_u),this.GetY(this.min_v),0));
      // geometry.vertices.push(new THREE.Vector3(this.GetX(this.min_u),this.GetY(this.max_v),0));
      // this.scene.add( new THREE.Line(geometry, material) );
      // geometry = new THREE.Geometry();
      // geometry.vertices.push(new THREE.Vector3(this.GetX(this.min_u),this.GetY(this.min_v),0));
      // geometry.vertices.push(new THREE.Vector3(this.GetX(this.max_u),this.GetY(this.min_v),0));
      // this.scene.add( new THREE.Line(geometry, material) );
        
	    this.renderer.render( this.scene, this.camera );
      console.error("RENDER");
}


PadThree.prototype.Resize = function()
{
  // Set this object and canvas properties.

  var width = this.width;
  var height = this.height;
  if( !$(this.element).is(":hidden") ) {
    width = $(this.element).width();
    height = $(this.element).height();
    // console.log("Resize",this,width,height);
  }
  this.width = width;
  this.height = height;

  if(this.canvas) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.setAttribute('width', width *  this.padPixelScaling);
    this.canvas.setAttribute('height', height *  this.padPixelScaling);
    $(this.canvas).css('width', width );
    $(this.canvas).css('height', height );
  }

  this.origin_x = this.margin_left;
  this.origin_y = height - this.margin_bottom;

  this.span_x = width-this.margin_right -this.origin_x;
  this.span_y = this.origin_y-this.margin_top;

  // Protect against the crazy.
  if(this.span_x < 10) this.span_x = 10;
  if(this.span_y < 10) this.span_y = 10;

  if(!this.camera) this.camera = new THREE.OrthographicCamera( -1,1,-1,1,-100,100);


}












//
//
//
//
//
//
//
//
//
//
//
//
// PadGL.prototype.Resize = function()
// {
//   // Set this object and canvas properties.
//
//   var width = this.width;
//   var height = this.height;
//   if( !$(this.element).is(":hidden") ) {
//     width = $(this.element).width();
//     height = $(this.element).height();
//     // console.log("Resize",this,width,height);
//   }
//   this.width = width;
//   this.height = height;
//
//   this.padPixelScaling = 1;
//   if(window.devicePixelRatio > 1) {
//     // Retina display! Cool!
//     this.padPixelScaling = window.devicePixelRatio;
//   }
//
//   this.canvas.width = width;
//   this.canvas.height = height;
//   this.canvas.setAttribute('width', width *  this.padPixelScaling);
//   this.canvas.setAttribute('height', height *  this.padPixelScaling);
//   $(this.canvas).css('width', width );
//   $(this.canvas).css('height', height );
//
//
//   this.origin_x = this.margin_left;
//   this.origin_y = height - this.margin_bottom;
//
//   this.span_x = width-this.margin_right -this.origin_x;
//   this.span_y = this.origin_y-this.margin_top;
//
//   // Protect against the crazy.
//   if(this.span_x < 10) this.span_x = 10;
//   if(this.span_y < 10) this.span_y = 10;
//
//   if(this.gl) this.gl.viewport(0,0,this.width,this.height);
//
// }
//
//
// // Subclass of Pad.
// PadGL.prototype = new Pad();
//
// function PadGL(element, options )
// {
//   if(!element) return;
//   var defaults = {
//     create_2dcontext : false,
//     program_shaders: {
//       program1: {
//                 //vertex: 'vertex-shader-1',
//                 vertex: '2d-vertex-shader',
//                 fragment:'fragment-shader-1'}
//     }
//   }
//   $.extend(true,defaults,options);
//   Pad.call(this, element, defaults); // Give settings to ABoundObject contructor.
//
//   this.gl = this.canvas.getContext('webgl',{ alpha: false, antialias: false,  depth: false })
//           || this.canvas.getContext('webgl')
//           || this.canvas.getContext('experimental-webgl');
//   if(!this.gl) {
//     console.error("Lost GL context somewhere.");
//     window.alert("WebGL not enabled?  If using Safari, you can turn it on in Preferences / Security");
//     return;
//   }
//
//   this.Resize(); // also initializes viewport.
//
//   // Add debugging.
//   // function logGLCall(functionName, args) {
//   //    console.log("gl." + functionName + "(" +
//   //       WebGLDebugUtils.glFunctionArgsToString(functionName, args) + ")");
//   // }
//   //
//   // Uncomment this line for debugging.
//   //this.gl = WebGLDebugUtils.makeDebugContext(this.gl, undefined, logGLCall);
//
//   // Create shaders.  Go through the program_shaders list and create from the included shaders.inc file
//   this.programs = {};
//   for(progname in this.program_shaders) {
//     var program = this.gl.createProgram();
//     this.gl.attachShader(program, this.create_shader(this.program_shaders[progname].vertex) );
//     this.gl.attachShader(program, this.create_shader(this.program_shaders[progname].fragment) );
//     this.gl.linkProgram(program);
//     // Check the link status
//
//     var linked = this.gl.getProgramParameter(program, this.gl.LINK_STATUS);
//     if (!linked) {
//          // something went wrong with the link
//          lastError = this.gl.getProgramInfoLog(program);
//          console.error("Error in program linking:" + lastError);
//          console.break();
//          this.gl.deleteProgram(program);
//          continue;
//     }
//     this.programs[progname] = program;
//     // In case there's only one, set it.
//     this.program = program;
//     this.gl.useProgram(this.program);
//   }
//
//   // get pointers to the shader params
//   var shaderVertexPositionAttribute = this.gl.getAttribLocation(this.program, "vertexPos");
//   this.gl.enableVertexAttribArray(shaderVertexPositionAttribute);
//
//   var shaderProjectionMatrixUniform = this.gl.getUniformLocation(this.program, "projectionMatrix");
//   var shaderModelViewMatrixUniform =this.gl.getUniformLocation(this.program, "modelViewMatrix");
//
//
//   var modelViewMatrix = new Float32Array(
//            [1, 0, 0, 0,
//             0, 1, 0, 0,
//             0, 0, 1, 0,
//             0, 0, -3.333, 1]);
//
//   // The projection matrix (for a 45 degree field of view)
//   var projectionMatrix = new Float32Array(
//            [2.41421, 0, 0, 0,
//             0, 2.41421, 0, 0,
//             0, 0, -1.002002, -1,
//             0, 0, -0.2002002, 0]);
//
//   function createSquare(gl) {
//            var vertexBuffer;
//             vertexBuffer =gl.createBuffer();
//            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
//            var verts = [
//                 .5,  .5,  0.0,
//                -.5,  .5,  0.0,
//                 .5, -.5,  0.0,
//                -.5, -.5,  0.0
//            ];
//            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts),gl.STATIC_DRAW);
//            var square = {buffer:vertexBuffer, vertSize:3, nVerts:4, primtype:gl.TRIANGLE_STRIP};
//            return square;
//   }
//
//   var obj = createSquare(this.gl);
//
//   // draw:
//   // clear the background (with black)
//   console.error("clearing");
//   this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
//   this.gl.clear(gl.COLOR_BUFFER_BIT);
//   // set the vertex buffer to be drawn
//   this.gl.bindBuffer(gl.ARRAY_BUFFER, obj.buffer);
//   // set the shader to use
//   this.gl.useProgram(this.program);
//   // connect up the shader parameters: vertex position and projection/model matrices
//   this.gl.vertexAttribPointer(shaderVertexPositionAttribute, obj.vertSize,this.gl.FLOAT, false, 0, 0);
//   this.gl.uniformMatrix4fv(shaderProjectionMatrixUniform, false, projectionMatrix);
//   this.gl.uniformMatrix4fv(shaderModelViewMatrixUniform, false, modelViewMatrix);
//   // draw the object
//   this.gl.drawArrays(obj.primtype, 0, obj.nVerts);
// }
//
// PadGL.prototype.create_shader = function( scriptId  )
// {
//   var shaderSource = "";
//   var shaderType;
//   var shaderScript = document.getElementById(scriptId);
//   if (!shaderScript) {
//     throw("*** Error: unknown script element" + scriptId);
//   }
//
//   shaderSource = shaderScript.text;
//   if (shaderScript.type == "x-shader/x-vertex") {
//     shaderType = this.gl.VERTEX_SHADER;
//   } else if (shaderScript.type == "x-shader/x-fragment") {
//     shaderType = this.gl.FRAGMENT_SHADER;
//   } else if (shaderType != this.gl.VERTEX_SHADER && shaderType != this.gl.FRAGMENT_SHADER) {
//     throw("*** Error: unknown shader type");
//     return null;
//   }
//
//    // Create the shader object
//    var shader = this.gl.createShader(shaderType);
//
//    // Load the shader source
//    this.gl.shaderSource(shader, shaderSource);
//
//    // Compile the shader
//    this.gl.compileShader(shader);
//
//    // Check the compile status
//    var compiled = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS);
//
//    if (!compiled) {
//      // Something went wrong during compilation; get the error
//      lastError = this.gl.getShaderInfoLog(shader);
//      console.error("*** Error compiling shader ",shader, ":" ,lastError);
//      this.gl.deleteShader(shader);
//      return null;
//    }
//
//    return shader;
// }
//
// PadGL.prototype.Resize = function()
// {
//   // Set this object and canvas properties.
//
//   var width = this.width;
//   var height = this.height;
//   if( !$(this.element).is(":hidden") ) {
//     width = $(this.element).width();
//     height = $(this.element).height();
//     // console.log("Resize",this,width,height);
//   }
//   this.width = width;
//   this.height = height;
//
//   this.padPixelScaling = 1;
//   if(window.devicePixelRatio > 1) {
//     // Retina display! Cool!
//     this.padPixelScaling = window.devicePixelRatio;
//   }
//
//   this.canvas.width = width;
//   this.canvas.height = height;
//   this.canvas.setAttribute('width', width *  this.padPixelScaling);
//   this.canvas.setAttribute('height', height *  this.padPixelScaling);
//   $(this.canvas).css('width', width );
//   $(this.canvas).css('height', height );
//
//
//   this.origin_x = this.margin_left;
//   this.origin_y = height - this.margin_bottom;
//
//   this.span_x = width-this.margin_right -this.origin_x;
//   this.span_y = this.origin_y-this.margin_top;
//
//   // Protect against the crazy.
//   if(this.span_x < 10) this.span_x = 10;
//   if(this.span_y < 10) this.span_y = 10;
//
//   if(this.gl) this.gl.viewport(0,0,this.width,this.height);
//
// }
//
// PadGL.prototype.Clear = function()
// {
//   //console.log("PadGL.Clear()");
// };
//
// PadGL.prototype.DrawFrame = function()
// {}
//
//
//
// //////////////////////////////////////////////////////////////////////
//
// WireViewGL.prototype = new PadGL();
//
//
// function WireViewGL( element, options )
// {
//   if(!element) {
//     return;
//   }
//
//   var settings = {
//     nlayers: 1,
//     plane: 0, // default, override this
//     margin_bottom : 40,
//     margin_top    : 5,
//     margin_right  : 5,
//     margin_left   : 30,
//     xlabel : "Wire",
//     ylabel : "TDC",
//     zooming: true, // set false to lock view on starting coordinates
//     tick_pixels_x: 50,
//     tick_pixels_y: 30,
//     tick_label_font: "10px serif",
//     show_image:   false, // can be false, 'raw', or 'cal'
//     show_hits:    false,
//     show_mc:      true,
//     track_color: "rgba(89, 169, 28, 1)",
//     wire_shift: [0,0,0], // for RGB mode
//   };
//   $.extend(true,settings,options);  // Change default settings by provided qualities.
//   PadGL.call(this, element, settings); // Give settings to Pad contructor.
//   // console.warn("WireView created with element:",$(element).css("height"),$(element).height());
//
//   if(this.zooming) {
//     this.mouse_scale_max_u = true;
//     this.mouse_scale_min_u = true;
//     this.mouse_scale_max_v = true;
//     this.mouse_scale_min_v = true;
//     this.mouse_pan_u       = true;
//     this.mouse_pan_v       = true;
//   }
//
//   var self = this;
//   this.SetMagnify(true);
//   this.fShiftSelecting = false;
//   this.fShiftRect = {};
//   this.hasContent = false;
//
//   this.loaded_wireimg = false;
//   this.loaded_thumbnail = false;
//   $(this.canvas).css('image-rendering','pixelated');
//
//
//   // gStateMachine.Bind('recordChange', this.NewRecord.bind(this) );
// //   gStateMachine.Bind('TimeCutChange',this.Draw.bind(this) );
// //   gStateMachine.Bind('hoverChange',  this.HoverChange.bind(this) );
// //   gStateMachine.Bind('selectChange', this.Draw.bind(this) );
// //   gStateMachine.Bind('hitChange',    this.TrimHits.bind(this) );
// //   gStateMachine.Bind('timeCutChange',this.TrimHits.bind(this) );
// //
//   // gStateMachine.BindObj("colorWireMapsChanged",this,"Draw"); // Callback when wire image loads
//   // if(this.zooming) gStateMachine.BindObj('zoomChange',this,"Draw");
//   // if(this.zooming) gStateMachine.BindObj('zoomChangeFast',this,"DrawFast");
//
//   this.ctl_show_hits    =  GetBestControl(this.element,".show-hits");
//   this.ctl_hit_field    =  GetBestControl(this.element,".hit-hist-field");
//   this.ctl_show_wireimg =  GetBestControl(this.element,".show-wireimg");
//   this.ctl_show_clus    =  GetBestControl(this.element,".show-clus");
//   this.ctl_show_endpoint=  GetBestControl(this.element,".show-endpoint2d");
//   this.ctl_show_spoints =  GetBestControl(this.element,".show-spoints");
//   this.ctl_show_tracks  =  GetBestControl(this.element,".show-tracks");
//   this.ctl_track_shift  =  GetBestControl(this.element,".track-shift-window");
//   this.ctl_track_shift_value  =  GetBestControl(this.element,"#ctl-track-shift-value");
//   this.ctl_show_showers =  GetBestControl(this.element,".show-showers");
//   this.ctl_show_mc      =  GetBestControl(this.element,".show-mc");
//   this.ctl_show_mc_neutrals =  GetBestControl(this.element,".show-mc-neutrals");
//   this.ctl_mc_move_tzero    =  GetBestControl(this.element,".ctl-mc-move-tzero");
//   this.ctl_show_reco =  GetBestControl(this.element,".show-reco");
//   this.ctl_wireimg_type =  GetBestControl(this.element,"[name=show-wireimg-type]");
//   this.ctl_dedx_path    =  GetBestControl(this.element,".dEdX-Path");
//   this.ctl_lock_aspect_ratio    =  GetLocalControl(this.element,".ctl-lock-aspect-ratio");
//
//
//   $(this.ctl_show_hits   ).change(function(ev) { return self.Draw(false); });
//   $(this.ctl_show_wireimg).change(function(ev) { return self.Draw(false); });
//   $(this.ctl_show_clus)   .change(function(ev) { return self.Draw(false); });
//   $(this.ctl_show_endpoint).change(function(ev) { return self.Draw(false); });
//
//   $(this.ctl_show_spoints).change(function(ev) { return self.Draw(false); });
//   $(this.ctl_show_tracks) .change(function(ev) { return self.Draw(false); });
//   $(this.ctl_show_showers).change(function(ev) { return self.Draw(false); });
//   $(this.ctl_track_shift) .change(function(ev) { return self.Draw(false); });
//   $(this.ctl_track_shift_value) .change(function(ev) { return self.Draw(false); });
//   $(this.ctl_show_mc     ).change(function(ev) { return self.Draw(false); });
//   $(this.ctl_show_mc_neutrals ).change(function(ev) { return self.Draw(false); });
//   $(this.ctl_mc_move_tzero ).change(function(ev) { return self.Draw(false); });
//   $(this.ctl_show_reco ).change(function(ev) { return self.Draw(false); });
//   $(this.ctl_wireimg_type).click(function(ev)  { return self.NewRecord(); });
//   $('#ctl-TrackLists')      .change(function(ev) { return self.Draw(false); });
//   $('#ctl-ShowerLists')      .change(function(ev) { return self.Draw(false); });
//   $('#ctl-SpacepointLists') .change(function(ev) { return self.Draw(false); });
//   $('#ctl-HitLists'    ) .change(function(ev) { return self.NewRecord(); });
//   $('#ctl-ClusterLists') .change(function(ev) { return self.Draw(false); });
//   $(this.ctl_dedx_path)     .change(function(ev) { return self.Draw(false); });
//   $(GetBestControl(this.element),".show-reco")     .change(function(ev) { return self.Draw(false); });
//   $('#ctl-show-watermark'). change(function(ev) { return self.Draw(false); });
//   $(this.ctl_lock_aspect_ratio). change(function(ev) {
//       // Force the zoom system to acknowledge the change, by making a null zoom.
//       // MOre trickery
//       if($(this).is(":checked")) {
//         gZoomRegion.wireview_aspect_ratio = (self.span_y)/(self.span_x);
//         console.log("Setting new aspect ratio",gZoomRegion.wireview_aspect_ratio,"pixels");
//         gZoomRegion.setLimits(2,gZoomRegion.plane[2][0],gZoomRegion.plane[2][1]);
//         gStateMachine.Trigger("zoomChange");
//       }
//       $('.ctl-lock-aspect-ratio').not(this).attr("checked",false);
//   });
//
//   // $('#ctl-shift-hits')      .change(this.TrimHits.bind(this));
//   // $('#ctl-shift-hits-value').change(this.TrimHits.bind(this));
//
//   // Flip planes control (for big wireview
//   this.ctl_plane = GetLocalControl(this.element,"[name=wireview-select]");
//   this.ctl_plane.click(function(ev) {
//     self.plane = parseInt( $(self.ctl_plane).filter(":checked").val() );
//     // console.warn("changing plane",self,$(this.ctl_plane).filter(":checked").val(),self.plane);
//
//     return self.NewRecord();
//   });
//
//
// }
//
// WireViewGL.prototype.MagnifierDraw = function(arg)
// {}
//
// WireViewGL.prototype.NewRecord = function(arg)
// {}
//
//
//
//

  
  
