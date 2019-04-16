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
    fMagnifierOn: true,
    
   
    
    
  }
  $.extend(true,defaults,options);
  ThreePad.call(this, element, defaults); // Give settings to ABoundObject contructor.

  // Layers definitions:
  this.kz_image = 1.2;
  this.kz_tracks = 3.0;
  

  this.renderer.render( this.scene, this.camera );
  
  // simple visibility toggling.
  gStateMachine.Bind('toggle-wireimg',       this.UpdateVisibilities.bind(this) ); 
  gStateMachine.Bind('toggle-tracks',        this.UpdateVisibilities.bind(this) ); 
  

  // updates to things:
  gStateMachine.Bind('change-wireimg',       this.UpdateWireimg.bind(this,false) ); 
  gStateMachine.Bind('colorWireMapsChanged', this.UpdateWireimg.bind(this,false) ); 
  this.ctl_track_shift        =  this.GetBestControl(".track-shift-window");
  this.ctl_track_shift_value  =  this.GetBestControl("#ctl-track-shift-value");
  $(this.ctl_track_shift)       .change( this.UpdateTracks.bind(this) );
  $(this.ctl_track_shift_value) .change( this.UpdateTracks.bind(this) );
  gStateMachine.Bind('driftChange', this.UpdateWireimg.bind(this) );  // REbuild since geometry is shot.
  gStateMachine.Bind('driftChange', this.UpdateTracks.bind(this) );  // REbuild since geometry is shot.

  
  // Changes to data products  
  gStateMachine.Bind('change-wireimg', this.CreateWireimg.bind(this,false) );  
  gStateMachine.Bind('change-tracks', this.CreateTracks.bind(this,false) );
  
  
  gStateMachine.Bind('zoomChange', this.ZoomChange.bind(this,false) );
  gStateMachine.Bind('zoomChangeFast', this.ZoomChange.bind(this,true) );
  
  gStateMachine.Bind('hoverChange', this.HoverAndSelectionChange.bind(this));
  gStateMachine.Bind('selectChange', this.HoverAndSelectionChange.bind(this));
  
  this.track_material = new THREE.LineMaterial( { color: 0x00ff00, linewidth: 3, dashed: false} );
  this.track_material.resolution= this.resolution; // resolution of the viewport


  this.track_material_hover = new THREE.LineMaterial( { color: 0xffff00, linewidth: 4, dashed: false} );
  this.track_material_hover.resolution= this.resolution; // resolution of the viewport

  this.track_material_selected = new THREE.LineMaterial( { color: 0xffffff, linewidth: 4, dashed: false} );
  this.track_material_selected.resolution= this.resolution; // resolution of the viewport
  
}

WireViewGL.prototype.ZoomChange = function(fast) 
{
  var newlimits = {
    minv: gZoomRegion.tdc[0] * gGeo.drift_cm_per_tick, // FIXME stupid geometry
    maxv: gZoomRegion.tdc[1] * gGeo.drift_cm_per_tick,
    minu: gZoomRegion.plane[this.plane][0] * gGeo.wire_pitch,// FIXME stupid geometry
    maxu: gZoomRegion.plane[this.plane][1] * gGeo.wire_pitch,
  };
  // Call the default:
  ThreePad.prototype.SetWorldCoordsForFrame.call(this,newlimits);
  this.dirty = true;
  this.overlay_dirty = true;
  this.Render();
}

WireViewGL.prototype.SetWorldCoordsForFrame = function(new_limits,finished)
{
  var limits = $.extend({},this.GetWorldCoordsForFrame(),new_limits);
  // Don't change view, instead emit a zoom change event, which echos back to the above.
  if('minv' in new_limits || 'maxv' in new_limits){
    gZoomRegion.changeTimeRange(limits.minv / gGeo.drift_cm_per_tick// FIXME stupid geometry
                               ,limits.maxv / gGeo.drift_cm_per_tick);
  }
  if('minu' in new_limits || 'maxu' in new_limits) {
    gZoomRegion.setLimits(this.plane
                        , limits.minu / gGeo.wire_pitch// FIXME stupid geometry
                        , limits.maxu / gGeo.wire_pitch);
  }
  if(finished) {
    gStateMachine.Trigger("zoomChange");
  } else {
    gStateMachine.Trigger("zoomChangeFast");
    // this.Draw();
  }

}

WireViewGL.prototype.UpdateResolution = function() 
{
  // Materials with a resolution uniform need updating:
  if(this.track_material) {
    // console.log("Update resolution: is it the same?", (this.track_material.resolution.x == this.resolution.x)&&(this.track_material.resolution.y == this.resolution.y) );
    // line is wider if this is in.
    this.track_material.resolution = this.resolution;
    this.track_material.needsUpdate = true;
  }
  if(this.track_material_hover) {
    this.track_material_hover.resolution = this.resolution;
    this.track_material_hover.needsUpdate = true;
  }
  if(this.track_material_selected) {
    this.track_material_selected.resolution = this.resolution;
    this.track_material_selected.needsUpdate = true;
  }
  
  
  if(this.frame_line_material) {
    this.frame_line_material.setValues({resolution: this.resolution});
    this.frame_line_material.needsUpdate = true;
  }
}

WireViewGL.prototype.HoverAndSelectionChange = function() 
{
  // This ordering ensures we get it right

  // Dehighlight the last hover object.
  var name = ((gLastHoverState.obj)||{})._pointer;
  if(name && name.length>0) {
    var obj = this.scene.getObjectByName(name);
    if(obj && obj.userdata && obj.userdata.default_material)
      obj.material = obj.userdata.default_material;
  }
  // Dehighlight the last selected object.
  name = ((gLastSelectState.obj)||{})._pointer;
  if(name && name.length>0) {
    var obj = this.scene.getObjectByName(name);
    if(obj && obj.userdata && obj.userdata.default_material)
      obj.material = obj.userdata.default_material;
  }

  // Highlight the hovered object.
  name = ((gHoverState.obj)||{})._pointer;
  if(name && name.length>0) {
    var obj = this.scene.getObjectByName(name);
    if(obj && obj.userdata && obj.userdata.hover_material)
      obj.material = obj.userdata.hover_material;
  }
  
  // Highlight the selected object.
  name = ((gSelectState.obj)||{})._pointer;
  if(name && name.length>0) {
    var obj = this.scene.getObjectByName(name);
    if(obj && obj.userdata && obj.userdata.selected_material)
      obj.material = obj.userdata.selected_material;
  }
  
  // this.Render();
}


//
// WireViewGL.prototype.CreateFrame = function()
// {
//   {
//     var lines;
//     // var material = new THREE.LineBasicMaterial({ linewidth:40, color: 0x00ffff });
//     var geometry = new THREE.Geometry();
//     geometry.vertices.push(new THREE.Vector3(this.min_u,0,0));
//     geometry.vertices.push(new THREE.Vector3(this.max_u,0,0));
//     var mlines = new MeshLine();
//     mlines.setGeometry(geometry);
//     lines = new THREE.Mesh(mlines.geometry, this.frame_line_material);
//     lines.name = "FrameLine1";
//     this.scene.add( lines );
//   }
//   {
//     var lines;
//     // var material = new THREE.LineBasicMaterial({ linewidth:40, color: 0x00ffff });
//     var geometry = new THREE.Geometry();
//     geometry.vertices.push(new THREE.Vector3(0,this.min_v,0));
//     geometry.vertices.push(new THREE.Vector3(0,this.max_v,0));
//     var mlines = new MeshLine();
//     mlines.setGeometry(geometry);
//     lines.name = "FrameLine2";
//     lines = new THREE.Mesh(mlines.geometry, this.frame_line_material);
//
//     this.scene.add( lines );
//   }
//
//   var du = (this.max_u-this.min_u);
//   var dv = (this.max_v-this.min_v);
//   var cx = this.min_u + du/2;
//   var cy = this.min_v + dv/2;
//
//   this.geometry = new THREE.PlaneGeometry( 720, 720, 1 );
//   this.material = new THREE.MeshBasicMaterial( {color: 0x000000, side: THREE.DoubleSide} );
//   this.mplane = new THREE.Mesh( this.geometry, this.material );
//   this.mplane.position.x = cx;
//   this.mplane.position.y = cy;
//   this.mplane.position.z = 1.0;
//   // this.scene.add( this.mplane );
//
//
//   // var geometry = new THREE.CircleGeometry( 5, 32 );
//   // var material = new THREE.MeshBasicMaterial( { color: 0xffff00 } );
//   // this.circle = new THREE.Mesh( geometry, material );
//   // this.circle.position.x=0;
//   // this.circle.position.y=0;
//   // this.circle.position.z=10;
//   // this.scene.add( this.circle );
// }
//
//








WireViewGL.prototype.create_image_meshgroup = function(mapper,chan_start,chan_end,tdc_start,tdc_end,x1,x2,y1,y2)
{
  // returns a THREE.Group with all of the wire textures mapped in xy plane.
  // mapper must contain a tile_urls[row][col] and tile_3textures[row][col]
  // chan_start, chan_end are logical channel numbers from start to end for this region
  // tdc_start, tdc_end are the range of TDC values we want to show
  // x1,x2 are x positions of first and last channel respecitvely
  // y1,y2 are y positions of the first and last tdc respectively
  var wireimg_group = new THREE.Group();
  wireimg_group.name=GetSelectedName("wireimg");
  
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
    var t_span_x = chan_scale * (t_chan_end-t_chan_start);
    var t_span_y =  tdc_scale * (t_tdc_end-t_tdc_start);
    var geometry = new THREE.PlaneGeometry( t_span_x, t_span_y );
    var t_x1 =  x1 + chan_scale * (t_chan_start-chan_start);
    var t_x2 =  x1 + chan_scale * (t_chan_end  -chan_start);
    var t_y1 =  y1 +  tdc_scale * (t_tdc_start-tdc_start);
    var t_y2 =  y1 +  tdc_scale * (t_tdc_end  -tdc_start);
    // var geometry = BoundedPlaneBufferGeometry(t_x1,t_x2,t_y1,t_y2);
      
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
      // console.log("create segment elem:     ",elem);
      // console.log("create segment 3d coords:",t_x1,t_x2,t_y1,t_y2);
      // console.log("create segment wires    :",t_chan_start, t_chan_end);
      // console.log("create segment tdcs     :",t_tdc_start,t_tdc_end);
      // console.log(material);

      var obj = new THREE.Mesh( geometry, material );
      // Don't name it: we never want to hoverchange on it.
      // obj.name=  wireimg_group.name+"("+irow+","+icol+")";
      obj.position.x = 0.5*(t_x1+t_x2);
      obj.position.y = 0.5*(t_y2+t_y1);
    
    
      // FIXME: when clearing event, dispose of all geometries, materials, and textures.
      wireimg_group.add( obj );
    }
  }
  return wireimg_group; //this.scene.add(this.wireimg_group);    
}

WireViewGL.prototype.UpdateWireimg = function(fast)
{
  // Create it if data doesn't exist.
  if(!this.wireimg_group) this.CreateWireimg(); 
  if(!this.wireimg_group) return;
  this.wireimg_group.scale.y =  gGeo.drift_cm_per_tick;

  this.UpdateVisibilities();
  this.Render();
}

WireViewGL.prototype.UpdateTracks = function(fast)
{
  // Changes properties of all displayed tracks.
  
  this.offset_track = 0;
  if(this.ctl_track_shift.is(":checked")) 
    this.offset_track = parseInt(this.ctl_track_shift_value.val())*gGeo.drift_cm_per_tick; // convert to position.

  if(this.track_group)
    for(var obj of this.track_group.children) {
      var pointer = obj.name;
      var trk = jsonpointer.get(gRecord,pointer);
      obj.position.y = this.offset_track; // shift by the offset.     

      obj.updateMatrix();
    }
  this.UpdateVisibilities();
  this.Render();
  
}


WireViewGL.prototype.CreateTracks = function()
{
  if(this.track_group) { // Delete it.
    this.scene.remove(this.track_group);
    for(var obj of this.track_group.children) {
      if(obj.geometry) obj.geometry.dispose();
    }
  }

  // this.track_material = new THREE.LineMaterial( { color: 0x00ff00, linewidth: 3, dashed: false} );
  // this.track_material.resolution= this.resolution; // resolution of the viewport
  //
  // this.track_material_hover = new THREE.LineMaterial( { color: 0x00ffff, linewidth: 4, dashed: false} );
  // this.track_material_hover.resolution= this.resolution; // resolution of the viewport
  //
  // this.track_material_selected = new THREE.LineMaterial( { color: 0xffffff, linewidth: 4, dashed: false} );
  // this.track_material_selected.resolution= this.resolution; // resolution of the viewport


  var tracks = GetSelected("tracks");
  if(tracks.length==0) return;

  this.track_group = new THREE.Group();
  this.track_group.name = tracks._pointer; // jsonpointer

  this.offset_track = 0;
  if(this.ctl_track_shift.is(":checked")) 
    this.offset_track = parseInt(this.ctl_track_shift_value.val())*gGeo.drift_cm_per_tick; // convert to position.

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
      var u = gGeo.yzToTransverse(this.plane,points[j].y, points[j].z);
      var v = points[j].x; // add offset later.
      data.push(u,v,0);
      // vertices.push(new THREE.Vector3(u,v,0));
      // path.push([u,v])
      // geo.vertices.push(new THREE.Vector3(u,v,0));
    }
  
    // // Bog-standard GLINES builtin Works, but only draws 1-pixel lines.
    // var basiclinemat = new THREE.LineBasicMaterial( { linewidth: 10, color: 0x00ff00 } );
    // var threeobj = new THREE.Line( geo, basiclinemat );

  
    // // threeline2d - Lines are drawn in incorrect positions.
    // var mat_threeline2d =  new THREE.ShaderMaterial(BuildLineShader({
    //   thickness:2,
    //   diffuse: 0x00ff00,
    //   side: THREE.DoubleSide
    // }));
    
    // // MeshLine.. Ugh.
  //   var meshline = new MeshLine();
  //   meshline.setGeometry(geo);
  //   var threeobj = new THREE.Mesh( meshline.geometry, this.track_material );

    // From https://threejs.org/examples/webgl_lines_fat.html example:
    // var matLine = new THREE.LineMaterial( { color: 0x00ff00, linewidth: 3, dashed: false} );
//     matLine.resolution= this.resolution; // resolution of the viewport
    var geometry = new THREE.LineGeometry();
    geometry.setPositions(data);
    geometry.raycast_fast = true; // Just take the first segment hit when raycasting.
    var threeobj = new THREE.Line2(geometry, this.track_material);
    threeobj.userdata = {
      default_material: this.track_material,
      hover_material:   this.track_material_hover,
      selected_material:   this.track_material_selected,
    }
		threeobj.scale.set( 1, 1, 1 );
    // threeobj.raycast = THREE.Line.raycast;
    threeobj.computeLineDistances(); //???
    
    
    // Make it findable again.
    threeobj.name = trk._pointer;    
    // Set timing property correctly
    threeobj.position.y = this.offset_track; // shift by the offset. 
    threeobj.position.z = 10; // level of tracks.
    // threeobj.matrixAutoUpdate=false; // Don't auto-compute each time. I'll tell you when your coords change
    threeobj.updateMatrix();     // Oh, they changed.
    this.track_group.add(threeobj);
  }

  this.scene.add(this.track_group);
  this.UpdateVisibilities();
  this.Render();
}


WireViewGL.prototype.UpdateVisibilities = function()
{
  // console.log("WireViewGL::UpdateVisibilities");
  // Call when a toggle is flipped.
  var self = this;
  function setVis(threeObj,ctlSelector) {    
    if(threeObj) {
      threeObj.visible = $(self.GetBestControl(ctlSelector)).is(":checked");
    }
  }
  setVis(this.wireimg_group, ".show-wireimg");
  setVis(this.track_group,   ".show-tracks");
  
  this.Render();
}

WireViewGL.prototype.CreateWireimg = function()
{
  if(this.wireimg_group) this.scene.remove(this.wireimg_group); // FIXME dispose too
  var mapper = null;

  var wname = GetSelectedName("wireimg");
  var wireimg = (((gRecord || {})["wireimg"]        || {})[wname] || {});
  var wlowres = (((gRecord || {})["wireimg-lowres"] || {})[wname] || {});
  if      (wireimg._glmapper) {mapper = wireimg._glmapper; }
  else if (wlowres._glmapper) {mapper = wlowres._glmapper; }
  
  if(!mapper) return;

  var nwires = gGeo.numWires(this.plane);
  var ntdc = mapper.total_width;

  // This puts the wire image into the xy plane with units of cm in each direction.  But no reason it couldn't be wire/tdc coordinates, which get transformed later
  var x1 = 0;
  var x2 = gGeo.wire_pitch * nwires;  // trans coordinate.
  var y1 = 0;
  var y2 = ntdc; //gGeo.drift_cm_per_tick * ntdc; // Set it to the wire height, then scale below!
  

  console.time("build_image_blocks");
  this.wireimg_group = this.create_image_meshgroup(mapper,
                          gGeo.channelOfWire(this.plane,0),
                          gGeo.channelOfWire(this.plane,nwires),
                          0,ntdc,
                          x1,x2,y1,y2);
  this.wireimg_group.scale.y =  gGeo.drift_cm_per_tick;
  this.wireimg_group.position.z = this.kz_image;
  this.scene.add(this.wireimg_group);
  console.timeEnd("build_image_blocks");
}







WireViewGL.prototype.DoMouseWheel = function(ev) {
    return ThreePad.prototype.DoMouseWheel.call(this,ev);
};

WireViewGL.prototype.DoMouse = function(ev)
{
  //  // pseudo-cursor.
  // if(this.fMouseInContentArea) {
  //   this.circle.position.x = this.fMousePos.u;
  //   this.circle.position.y = this.fMousePos.v;
  //   this.renderer.render(this.scene, this.camera);  console.warn("RENDER");
  // }
  // Deal with other controls
  var retval =  ThreePad.prototype.DoMouse.call(this,ev);

  // Object picking for hover or selection
  if(this.fMouseInContentArea) {
    var match =  {obj: null, type:"wire"};
    
  	this.raycaster.linePrecision=3;
    this.fMousePos.norm  = new THREE.Vector3(this.fMousePos.x/this.width*2-1, 1-2*this.fMousePos.y/this.height, 1);
  	this.raycaster.setFromCamera( this.fMousePos.norm, this.camera );
    this.raycast_layers = new THREE.Layers; // set to valid layers.
    var intersects = this.raycaster.intersectObjects(this.scene.children,true);
    for(var i=0;i<intersects.length;i++) {
      var intersect = intersects[i];
      if(!intersect.object.layers.test(this.raycast_layers)) continue; // ignore the magnifier
      var ptr = intersect.object.name;
      if(ptr && ptr.startsWith('/')){
        var path = jsonpointer.parse(ptr);
        var product = jsonpointer.get(gRecord,path);
        if(product) {
          var type = 'blah';
          switch(path[0]) {
            case 'tracks': type="track"; break;
          }
          
          match =  {obj:product, type:type, pointer:ptr};
          // canvas pixel coordinates:

          var pt = intersect.point.clone();
          pt.project(this.camera);
          
          match.canvas_coords = new THREE.Vector2(pt.x*this.width/2+this.width/2, 
                                                  -pt.y*this.height/2+this.height/2)
          // console.warn("pick:",match);
        }
      }
    }
  
    match.channel = gGeo.channelOfWire(this.plane,this.fMousePos.world.x/gGeo.wire_pitch); // FIXME uboone specific dune multitpcs.
    match.sample  = this.fMousePos.world.y/gGeo.drift_cm_per_tick;
    if(!match.obj) match.obj = match.channel + "|" + match.sample;
    ChangeHover(match); // match might be null.
    if(ev.type=="click") { // Click, but not on just ordinary wire
      var offset = getAbsolutePosition(this.viewport);      
      if(match.canvas_coords) SetOverlayPosition(match.canvas_coords.x + offset.x, match.canvas_coords.y + offset.y);
      ChangeSelection(match);
    }
  }

  return retval;
  // if(this.dirty) this.Render(); // done by caller
}



