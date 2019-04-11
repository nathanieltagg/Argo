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
     gWireViewGL = new WireViewGL(this);
  });  
});



// Subclass of ThreePad.
WireViewGL.prototype = Object.create(ThreePad.prototype);
WireViewGL.prototype.constructor = ThreePad;


function WireViewGL(element, options )
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
  ThreePad.call(this, element, defaults); // Give settings to ABoundObject contructor.

  this.CreateFrame();  
  this.renderer.render( this.scene, this.camera );
  
  
  gStateMachine.Bind('toggle-wireimg',       this.UpdateWireimg.bind(this,false) ); 
  gStateMachine.Bind('colorWireMapsChanged', this.UpdateWireimg.bind(this,false) ); 
  
}


WireViewGL.prototype.CreateFrame = function()
{
  console.warn("create frame")
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
  // this.scene.remove(lines); // how to remove things
  
  var du = (this.max_u-this.min_u);
  var dv = (this.max_v-this.min_v);
  var cx = this.min_u + du/2;
  var cy = this.min_v + dv/2;
  
  this.geometry = new THREE.PlaneGeometry( 720, 720, 1 ); 
  this.material = new THREE.MeshBasicMaterial( {color: 0x000000, side: THREE.DoubleSide} );
  this.mplane = new THREE.Mesh( this.geometry, this.material );
  this.mplane.position.x = cx;
  this.mplane.position.y = cy;
  this.mplane.position.z = 1.0;
  // this.scene.add( this.mplane );
  
  
  var geometry = new THREE.CircleGeometry( 5, 32 );
  var material = new THREE.MeshBasicMaterial( { color: 0xffff00 } );
  this.circle = new THREE.Mesh( geometry, material );
  this.circle.position.x=0;
  this.circle.position.y=0;
  this.circle.position.z=10;
  this.scene.add( this.circle );
}










WireViewGL.prototype.create_image_meshgroup = function(mapper,chan_start,chan_end,tdc_start,tdc_end,x1,x2,y1,y2)
{
  // returns a THREE.Group with all of the wire textures mapped in xy plane.
  // mapper must contain a tile_urls[row][col] and tile_3textures[row][col]
  // chan_start, chan_end are logical channel numbers from start to end for this region
  // tdc_start, tdc_end are the range of TDC values we want to show
  // x1,x2 are x positions of first and last channel respecitvely
  // y1,y2 are y positions of the first and last tdc respectively
  console.warn("build_image_blocks",...arguments);
  var wireimg_group = new THREE.Group();
  
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
    // input_texture = new THREE.Texture();
    input_texture.needsUpdate = true;
    
    // which are the samples this texture will provide to us?
    var t_chan_start = Math.max(elem.y, chan_start);
    var t_chan_end   = Math.min(elem.y+elem.height, chan_end);
    var t_tdc_start  = Math.max(elem.x, tdc_start);
    var t_tdc_end    = Math.min(elem.x+elem.width, tdc_end);

    // create geometry scaled to these positions.
    // var t_span_x = chan_scale * (t_chan_end-t_chan_start);
    // var t_span_y =  tdc_scale * (t_tdc_end-t_tdc_start);
    // var geometry = new THREE.PlaneGeometry( t_span_x, t_span_y );
    var t_x1 =  x1 + chan_scale * (t_chan_start-chan_start);
    var t_x2 =  x1 + chan_scale * (t_chan_end  -chan_start);
    var t_y1 =  y1 +  tdc_scale * (t_tdc_start-tdc_start);
    var t_y2 =  y1 +  tdc_scale * (t_tdc_end  -tdc_start);
    var geometry = BoundedPlaneBufferGeometry(t_x1,t_x2,t_y1,t_y2);
  
  	geometry.clearGroups();
  	geometry.addGroup( 0, Infinity, 0 );
  	geometry.addGroup( 0, Infinity, 1 );
    
    if(!gFalseColorControl.lut_texture) Error("No LUT texture!");
    
    // var material = new THREE.MeshBasicMaterial( { color: 0xff0000 + 0x10*irow + 0x1000*icol,side: THREE.DoubleSide });
      var wireframe = new THREE.MeshBasicMaterial( {wireframe: true,visible: true} );
      var material = new THREE.ShaderMaterial( {
        vertexShader: document.getElementById('three-vertex-shader').textContent,
        fragmentShader: document.getElementById('three-fragment-shader').textContent,
        // fragmentShader: document.getElementById('stupidfill').textContent,
        uniforms: {
          inputtexture: { type: "t", value: input_texture },
          maptexture:   { type: "t", value: gFalseColorControl.lut_texture },
          do_noise_reject:     { value: 0 },
          do_bad_channel_flag: { value: 0 },
          do_smear:            { value: 0 },
          do_edge_finder:      { value: 0 },

          texture_size:        new THREE.Uniform(new THREE.Vector2(elem.height,elem.width)),
          crop_start:          new THREE.Uniform(new THREE.Vector2(t_chan_start-elem.y, t_tdc_start - elem.x)),
          crop_end:            new THREE.Uniform(new THREE.Vector2(t_chan_end  -elem.y, t_tdc_end   - elem.x))
        },
        visible: true
      });
      console.log("create segment elem:     ",elem);
      console.log("create segment 3d coords:",t_x1,t_x2,t_y1,t_y2);
      console.log("create segment wires    :",t_chan_start, t_chan_end);
      console.log("create segment tdcs     :",t_tdc_start,t_tdc_end);
      console.log(material);

      var obj = new THREE.Mesh( geometry, [material, wireframe] );
      // obj.position.x = 0.5*(t_x1+t_x2);
      // obj.position.y = 0.5*(t_y2+t_y1);
    
    
      // FIXME: when clearing event, dispose of all geometries, materials, and textures.
      wireimg_group.add( obj );
    }
  }
  return wireimg_group; //this.scene.add(this.wireimg_group);    
}

WireViewGL.prototype.UpdateWireimg = function(fast)
{
  // Create it if data exists.
  if(!this.wireimg_group) this.CreateWireimg(); 
  if(!this.wireimg_group) return;

  this.wireimg_group.visible = ($(this.GetBestControl(".show-wireimg")).is(":checked"));
  this.Render();
}


WireViewGL.prototype.CreateWireimg = function()
{
  var mapper = null;

  var wname = GetSelectedName("wireimg");
  var wireimg = (((gRecord || {})["wireimg"]        || {})[wname] || {});
  var wlowres = (((gRecord || {})["wireimg-lowres"] || {})[wname] || {});
  if      (wireimg._glmapper) {mapper = wireimg._glmapper; }
  else if (wlowres._glmapper) {mapper = wlowres._glmapper; }
  console.log(mapper,wireimg._glmapper,wlowres._glmapper);
  
  if(!mapper) return;

  var nwires = gGeo.numWires(this.plane);
  var ntdc = mapper.total_width;

  // This puts the wire image into the xy plane with units of cm in each direction.  But no reason it couldn't be wire/tdc coordinates, which get transformed later
  var x1 = 0;
  var x2 = gGeo.wire_pitch * nwires;  // trans coordinate.
  var y1 = 0;
  var y2 = gGeo.drift_cm_per_tick * ntdc;
  

  console.time("build_image_blocks");
  this.wireimg_group = this.create_image_meshgroup(mapper,
                          gGeo.channelOfWire(this.plane,0),
                          gGeo.channelOfWire(this.plane,nwires),
                          0,ntdc,
                          x1,x2,y1,y2);
  this.kz_image = 1.2;
  this.wireimg_group.position.z = this.kz_image;
  this.scene.add(this.wireimg_group);
  console.timeEnd("build_image_blocks");
}

WireViewGL.prototype.DrawImage = function(minu,maxu,minv,maxv)
{
  if(!this.wireimg_group) { this.CreateWireimg(); }

}



//
// WireViewGL.prototype.build_LUT_texture = function( )
// {
//
//   // Creates an OpenGl texture, returns the texture ID.
//   // This version builds a 2d 256x256 texture.
//   // Colors go top-to-bottom (most sigificant changes) and left-to-right (least significant)
//   // This forms a full 256x256 lookup table usable by the shader.
//   // Note that range of values accessible is only -4096 to 4096, (-0x1000 to 0x1000), so only needs 0x2000 values out of 0x10000 pixels
//   // in a 256x256 image. So, only fills 1/8 of image space. Need to push it up
//   // I _think_ that this would work with smaller resolution, but color changes at small ADC value wont' be visable.
//   if(!this.lut_texture_canvas) this.lut_texture_canvas = document.createElement("canvas");
//   var canvas = this.lut_texture_canvas;
//   canvas.width  = 256;
//   canvas.height = 256;
//   var start_x = -0x1000-0x80;
//   var stop_x =   0x1000-0x80;
//   var pixels = 0x2000; // Total pixels possible from -4096 to 4096
//   var ctx = canvas.getContext('2d');
//   ctx.fillStyle = 'orange';
//   ctx.fillRect(0,0,256,256);
//   var imgData=ctx.createImageData(256,32); // 256*16 = 8192 = 0x2000 possible values.
//   var len = imgData.data.length;
//   for (var i=0;i<len;i+=4) {
//     var x = start_x + (i/4.)*(stop_x-start_x)/pixels;
//     var color = gWirePseudoColor.interpolate(x);
//     imgData.data[i+0]= color.r;
//     imgData.data[i+1]= color.g;
//     imgData.data[i+2]= color.b;
//     imgData.data[i+3]= color.a;
//   }
//   // ctx.putImageData(imgData,0,112); // Shift up 7/16ths to center it correctly.
//   ctx.putImageData(imgData,0,111); // Shift up 7/16ths to center it correctly.
//   // For some reason, the LUT area is shifted one pixel relative to the raw opengl implementation.
//
//
//   // Create or update.
//   if(!this.lut_texture){
//       this.lut_texture = new THREE.Texture(this.lut_texture_canvas);
//       this.lut_texture.magFilter = THREE.NearestFilter;
//       this.lut_texture.minFilter = THREE.NearestFilter;
//       this.lut_texture.wrapS     = THREE.ClampToEdgeWrapping;
//       this.lut_texture.wrapT     = THREE.ClampToEdgeWrapping;
//     }
//   this.lut_texture.needsUpdate = true;
// }



WireViewGL.prototype.DoMouseWheel = function(ev,scrollDist) {};
WireViewGL.prototype.DoMouse = function(ev)
{
  if(this.fMouseInContentArea) {
    var v = new THREE.Vector3(this.fMousePos.x/this.width*2-1,1-2*this.fMousePos.y/this.height,1);
    v.unproject( this.camera );
    this.circle.position.x = v.x;
    this.circle.position.y = v.y;
    this.renderer.render(this.scene, this.camera);  console.warn("RENDER");

    
  }
  
  
  // mag glass:
  // I think the best way is to:
  // -have a camera that looks through the mag glass
  // -render the mag glass camera to an offscreen canvas
  // - offscreen canvas then used as texture
  // -Draw the circle as an object in view

}




  
