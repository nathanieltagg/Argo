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

var gWireViewGL = null;

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
  
  // Remove the canvas and replace with our own.
  // $(this.canvas).remove();
  
  this.Resize();
  // Create the Three.js renderer, add it to our div
  this.renderer = new THREE.WebGLRenderer();
  this.renderer.setPixelRatio( window.devicePixelRatio );

  this.renderer.setSize(this.width,this.height);
  this.element.appendChild( this.renderer.domElement );
  this.canvas=this.renderer.domElement;

  // Create a new Three.js scene
  this.scene = new THREE.Scene();
  // Create a camera and add it to the scene

  // this.camera = new THREE.PerspectiveCamera( 45, this.canvas.offsetWidth / this.canvas.offsetHeight, 1, 4000 );
  // this.camera.position.set( 0, 0, 3.3333 );
  var du = (this.max_u-this.min_u);
  var dv = (this.max_v-this.min_v);
  var cx = this.min_u + du/2;
  var cy = this.min_v + dv/2;
  // this.camera = new THREE.OrthographicCamera( this.min_u-(, this.width, 0, this.height, -10,10);

  this.scene.add( this.camera );

  // // Now, create a rectangle and add it to the scene
  // this.geometry = new THREE.PlaneGeometry(1, 1);
  // this.mesh = new THREE.Mesh( this.geometry, new THREE.MeshBasicMaterial( ) );
  // this.scene.add( this.mesh );
  // // Render it

  // var geometry = new THREE.BoxGeometry( 100, 100, 2. );
  // var material = new THREE.MeshBasicMaterial( { color: 0xffff00 } );
  // var cube = new THREE.Mesh( geometry, material );
  // this.scene.add( cube );

  var lines;
  {
    var material = new THREE.LineBasicMaterial({ linewidth:40, color: 0x00ffff });
    var geometry = new THREE.Geometry();      
    geometry.vertices.push(new THREE.Vector3(this.min_u,0,0));
    geometry.vertices.push(new THREE.Vector3(this.max_u,0,0));
    geometry.vertices.push(new THREE.Vector3(0,this.min_v,0));
    geometry.vertices.push(new THREE.Vector3(0,this.max_v,0));
    lines = new THREE.Line(geometry, material) ;
    this.scene.add( lines );
    
  }
  // this.scene.remove(lines);
  
  this.geometry = new THREE.PlaneGeometry( 720, 720, 1 ); // Someday FIXME: use PlaneBufferGeometry, harder to use but better
  this.material = new THREE.MeshBasicMaterial( {color: 0x000000, side: THREE.DoubleSide} );
  this.mplane = new THREE.Mesh( this.geometry, this.material );
  this.mplane.position.x = cx;
  this.mplane.position.y = cy;
  this.mplane.position.z = 1.0;
  // this.scene.add( this.mplane );
  
  
  this.renderer.render( this.scene, this.camera );
  
  gStateMachine.Bind('toggle-wireimg', this.Draw.bind(this,false) ); 
  
  
  
  
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

  var span_u = this.max_u - this.min_u;
  var center_v = 0.5*(this.min_v + this.max_v);
  // Ensure aspect ratio. Use horizontal coordinate as scale; map vertical to match.
  var span_v = span_u / width * height;
  this.min_v = center_v - span_v/2;
  this.max_v = center_v + span_v/2;

  this.camera = new THREE.OrthographicCamera( this.min_u,this.max_u, // frustrum box, left, right
                                              this.max_v,this.min_v, // top. bottom. Yes, backwards
                                              0.1,2000); // min, max distance from camera objects will be rendered. Min is zero.
  this.camera.position.z=1000;


}



PadThree.prototype.Draw = function(fast)
{
  if ($(this.GetBestControl(".show-wireimg")).is(":checked")) {
    this.DrawImage(this.min_u, this.max_u, this.min_v, this.max_v, fast);
  }
  
}


PadThree.prototype.build_image_blocks = function(mapper,chan_start,chan_end,tdc_start,tdc_end,x1,x2,y1,y2)
{
  console.warn("build_image_blocks",...arguments);
  this.kz_image = 1.2;
  this.wireimg_group = new THREE.Group();
  
  var tdc_scale = (y2-y1)/(tdc_end-tdc_start);
  var chan_scale = (x2-x1) /(chan_end-chan_start);
  
  for(var irow=0;irow<mapper.tile_3textures.length;irow++) {
    for(var icol=0;icol<mapper.tile_3textures[irow].length;icol++) {
      
    var elem = mapper.tile_urls[irow][icol];
    // elem coordinates are rotated, right? 
    if(elem.x + elem.width < tdc_start) continue;
    if(elem.y + elem.height < chan_start) continue;
    if(elem.x > tdc_end) continue;
    if(elem.y > chan_end) continue;
    
    var input_texture = mapper.tile_3textures[irow][icol];
    input_texture.needsUpdate = true;
    
    // which are the samples this texture will provide to us?
    var t_chan_start = Math.max(elem.y, chan_start);
    var t_chan_end   = Math.min(elem.y+elem.height, chan_end);
    var t_tdc_start  = Math.max(elem.x, tdc_start);
    var t_tdc_end    = Math.min(elem.x+elem.width, tdc_end);

    // create geometry scaled to these positions.
    var t_span_x = chan_scale * (t_chan_end-t_chan_start);
    var t_span_y =  tdc_scale * (t_tdc_end-t_tdc_start);
    var t_x1 =  x1 + chan_scale * (t_chan_start-chan_start);
    var t_x2 =  x1 + chan_scale * (t_chan_end  -chan_start);
    var t_y1 =  y1 +  tdc_scale * (t_tdc_start-tdc_start);
    var t_y2 =  y1 +  tdc_scale * (t_tdc_end  -tdc_start);
    var geometry = new THREE.PlaneGeometry( t_span_x, t_span_y, this.kz_image);
    
     // Someday FIXME: use PlaneBufferGeometry, harder to use but better
  
    
    // var material = new THREE.MeshBasicMaterial( { color: 0xff0000 + 0x10*irow + 0x1000*icol,side: THREE.DoubleSide });
    // if(irow==2&&icol==0){
      var material = new THREE.ShaderMaterial( {
        vertexShader: document.getElementById('three-vertex-shader').textContent,
        fragmentShader: document.getElementById('three-fragment-shader').textContent,
        // fragmentShader: document.getElementById('stupidfill').textContent,
        uniforms: {
          inputtexture: { type: "t", value: input_texture },
          maptexture:   { type: "t", value: this.lut_texture },
          do_noise_reject:     { value: 0 },
          do_bad_channel_flag: { value: 0 },
          do_smear:            { value: 0 },
          do_edge_finder:      { value: 0 },

          texture_size:        new THREE.Uniform(new THREE.Vector2(input_texture.image.height,input_texture.image.width)),
          crop_start:          new THREE.Uniform(new THREE.Vector2(t_chan_start-elem.y, t_tdc_start - elem.x)),
          crop_end:            new THREE.Uniform(new THREE.Vector2(t_chan_end  -elem.y, t_tdc_end   - elem.x))
        }
      });
      console.log("create segment elem:     ",elem);
      console.log("create segment 3d coords:",t_x1,t_x2,t_y1,t_y2);
      console.log("create segment wires    :",t_chan_start, t_chan_end);
      console.log("create segment tdcs     :",t_tdc_start,t_tdc_end);
      console.log(material);
    // }
    var obj = new THREE.Mesh( geometry, material );
    obj.position.x = 0.5*(t_x1+t_x2);
    obj.position.y = 0.5*(t_y2+t_y1);
    obj.position.z = this.kz_image;
    
    
    // FIXME: when clearing event, dispose of all geometries, materials, and textures.
    this.wireimg_group.add( obj );
  }
  this.scene.add(this.wireimg_group);
}
    
}


PadThree.prototype.DrawImage = function(minu,maxu,minv,maxv)
{
  console.warn("DRAWIMAGE");
  // this.show_image = $(this.ctl_wireimg_type).filter(":checked").val();  // 'cal' or 'raw'

  var mapper = null;

  var wname = GetSelectedName("wireimg");
  var wireimg = (((gRecord || {})["wireimg"]        || {})[wname] || {});
  var wlowres = (((gRecord || {})["wireimg-lowres"] || {})[wname] || {});
  if      (wireimg._glmapper && wireimg._glmapper.loaded) {mapper = wireimg._glmapper; }
  else if (wlowres._glmapper && wlowres._glmapper.loaded) {mapper = wlowres._glmapper; }
  console.log(mapper,wireimg._glmapper,wlowres._glmapper);

  if(!mapper) return;

  var nwires = gGeo.numWires(this.plane);
  var ntdc = mapper.total_width;
  var x1 = 0;
  var x2 = gGeo.wire_pitch * nwires;  // trans coordinate.
  var y1 = 0;
  var y2 = gGeo.drift_cm_per_tick * ntdc;
  
  this.build_LUT_texture();

  this.build_image_blocks(mapper,
                          gGeo.channelOfWire(this.plane,0),
                          gGeo.channelOfWire(this.plane,nwires),
                          0,ntdc,
                          x1,x2,y1,y2);

  this.renderer.render( this.scene, this.camera );
  // this.build_LUT_texture();
  // this.mapper = mapper;
  // this.input_texture = mapper.tile_3textures[0][0];
  // // this.material = new THREE.MeshBasicMaterial( { map: input_texture });
  // this.input_texture.rotation = Math.PI/4; // no effect!  Must be acted on by the shader, I guess.
  // this.input_texture.updateMatrix ();
  //   this.input_texture.needsUpdate = true;
  //
  // // NOtes - this draws the entire texture to the box, making the bounds meet.
  //
  //
  // this.material = new THREE.ShaderMaterial( {
  //   vertexShader: document.getElementById('three-vertex-shader').textContent,
  //   fragmentShader: document.getElementById('three-fragment-shader').textContent,
  //   // fragmentShader: document.getElementById('stupidfill').textContent,
  //   uniforms: {
  //     u_resolution: { value: new THREE.Vector2(2000,2000) }, // How many wires and tdc ticks in this box??
  //     inputtexture: { type: "t", value: this.input_texture },
  //     maptexture:   { type: "t", value: this.lut_texture },
  //     do_noise_reject:     { value: 0 },
  //     do_bad_channel_flag: { value: 0 },
  //     do_smear:            { value: 0 },
  //     do_edge_finder:      { value: 0 },
  //
  //     texture_size:        new THREE.Uniform(new THREE.Vector2(this.input_texture.image.height,this.input_texture.image.width)),
  //     crop_start:          new THREE.Uniform(new THREE.Vector2(0, 1200)),
  //     crop_end:            new THREE.Uniform(new THREE.Vector2(1200, 2400))
  //   }
  // })
  // this.mplane.material = this.material;
  //
  // var light = new THREE.PointLight( 0xffffff );
  // light.position.set(100, 200, 10000);
  // light.lookAt( new THREE.Vector3( 1000, 100, 0 ) );
  // this.scene.add( light );
  //
  // this.renderer.render( this.scene, this.camera );
  
}




PadThree.prototype.build_LUT_texture = function( ) 
{ 
  
  // Creates an OpenGl texture, returns the texture ID.
  // This version builds a 2d 256x256 texture.
  // Colors go top-to-bottom (most sigificant changes) and left-to-right (least significant)
  // This forms a full 256x256 lookup table usable by the shader.
  // Note that range of values accessible is only -4096 to 4096, (-0x1000 to 0x1000), so only needs 0x2000 values out of 0x10000 pixels
  // in a 256x256 image. So, only fills 1/8 of image space. Need to push it up 
  // I _think_ that this would work with smaller resolution, but color changes at small ADC value wont' be visable.
  if(!this.lut_texture_canvas) this.lut_texture_canvas = document.createElement("canvas");
  var canvas = this.lut_texture_canvas;
  canvas.width  = 256;
  canvas.height = 256;
  var start_x = -0x1000-0x80;
  var stop_x =   0x1000-0x80;
  var pixels = 0x2000; // Total pixels possible from -4096 to 4096
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = 'orange';
  ctx.fillRect(0,0,256,256);
  var imgData=ctx.createImageData(256,32); // 256*16 = 8192 = 0x2000 possible values.
  var len = imgData.data.length;
  for (var i=0;i<len;i+=4) {
    var x = start_x + (i/4.)*(stop_x-start_x)/pixels; 
    var color = gWirePseudoColor.interpolate(x);      
    imgData.data[i+0]= color.r;
    imgData.data[i+1]= color.g;
    imgData.data[i+2]= color.b;
    imgData.data[i+3]= color.a;
  }
  // ctx.putImageData(imgData,0,112); // Shift up 7/16ths to center it correctly.
  ctx.putImageData(imgData,0,111); // Shift up 7/16ths to center it correctly.  
  // For some reason, the LUT area is shifted one pixel relative to the raw opengl implementation.


  // Create or update.
  if(!this.lut_texture){
      this.lut_texture = new THREE.Texture(this.lut_texture_canvas);
      this.lut_texture.magFilter = THREE.NearestFilter;
      this.lut_texture.minFilter = THREE.NearestFilter;
      this.lut_texture.wrapS     = THREE.ClampToEdgeWrapping;
      this.lut_texture.wrapT     = THREE.ClampToEdgeWrapping;
    }
  this.lut_texture.needsUpdate = true;  
}


  
