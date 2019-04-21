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

var gWireViewGL = [];

$(function(){
  $('div.A-WireViewGL').each(function(){
    gWireViewGL.push(new WireViewGL(this));
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
    
    draw_box : false,
    draw_grid_x:false,  // These don't work with magnifier!!!11!!
    draw_grid_y:false,  // 

    xlabel : "Transverse position (cm)",
    ylabel : "Drift Time (cm)",    
  }  
  $.extend(true,defaults,options);
  ThreePad.call(this, element, defaults); // Give settings to ABoundObject contructor.

  // Layers definitions:
  this.kz_image = 1.2;
  this.kz_tracks = 3.0;
  
  this.renderer.setClearColor( 0xffffff,1);
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
  gStateMachine.Bind('driftChange', this.UpdateHits.bind(this) );  // REbuild since geometry is shot.

  
  // Changes to data products  
  gStateMachine.Bind('change-wireimg', this.CreateWireimg.bind(this,false) );  
  gStateMachine.Bind('change-tracks',  this.CreateTracks.bind(this,false) );
  gStateMachine.Bind('change-hits',    this.CreateTracks.bind(this,false) );
  
  
  gStateMachine.Bind('zoomChange', this.ZoomChange.bind(this,false) );
  gStateMachine.Bind('zoomChangeFast', this.ZoomChange.bind(this,true) );
  
  gStateMachine.Bind('hoverChange', this.HoverAndSelectionChange.bind(this));
  gStateMachine.Bind('selectChange', this.HoverAndSelectionChange.bind(this));
  
  // hits
  gStateMachine.Bind('change-hits', this.CreateHits.bind(this) );  
  gStateMachine.Bind('hitChange',    this.CreateHits.bind(this) ); // Could be improved: change vertex colors instead of recreation
  $('#ctl-shift-hits')      .change(this.UpdateHits.bind(this));
  $('#ctl-shift-hits-value').change(this.UpdateHits.bind(this));
  gStateMachine.Bind('toggle-hits',          this.UpdateVisibilities.bind(this) ); 
  
  // clusters
  gStateMachine.Bind('change-clusters', this.CreateClusters.bind(this) );  
  gStateMachine.Bind('newPiece'       , this.CreateClusters.bind(this,true) );  // Need this because associations might come late...
  $('#ctl-shift-hits')      .change(this.UpdateClusters.bind(this));
  $('#ctl-shift-hits-value').change(this.UpdateClusters.bind(this));
  gStateMachine.Bind('toggle-clusters',this.UpdateVisibilities.bind(this) ); 
  
  // spacepoints
  gStateMachine.Bind('change-spacepoints', this.CreateSpacepoints.bind(this) );  
  gStateMachine.Bind('toggle-spacepoints', this.UpdateVisibilities.bind(this) );  
  $(this.ctl_track_shift)       .change( this.UpdateSpacepoints.bind(this) );
  
  // showers
  gStateMachine.Bind('change-showers', this.CreateShowers.bind(this,false) );
  gStateMachine.Bind('toggle-showers', this.UpdateVisibilities.bind(this,false) );
  $(this.ctl_track_shift)       .change( this.UpdateShowers.bind(this) );
 
  // mc
  gStateMachine.Bind('change-mcparticles', this.CreateMC.bind(this) );  
  gStateMachine.Bind('driftChange',        this.UpdateMC.bind(this) );  
  this.GetBestControl(".show-mc-neutrals") .change(this.UpdateMC.bind(this) );
  this.GetBestControl(".ctl-mc-move-tzero").change(this.UpdateMC.bind(this) );
  gStateMachine.Bind('toggle-mcparticles',this.UpdateVisibilities.bind(this) ); 
  
  this.line_materials = [
    this.track_material = new THREE.LineMaterial( { color: 0x00ff00, linewidth: 3, dashed: false} ),
    this.track_material_hover = new THREE.LineMaterial( { color: 0xffff00, linewidth: 4, dashed: false} ),
    this.track_material_selected = new THREE.LineMaterial( { color: 0xffffff, linewidth: 4, dashed: false} ),
    this.highlight_line_material =  new THREE.LineMaterial( { color: 0xFF0000, linewidth: 2, dashed: false} ),

    this.mc_material          = new THREE.LineMaterial( { color: 0x0000ff, linewidth: 1, dashed: false} ),
    this.mc_neutral_material  = new THREE.LineMaterial( { color: 0x0000ff, linewidth: 1, dashed: true} ),
    this.mc_hover_material    = new THREE.LineMaterial( { color: 0xffff00, linewidth: 3, dashed: false}  ),
    this.mc_select_material   = new THREE.LineMaterial( { color: 0xffffff, linewidth: 3, dashed: false}  ),      
  ]; 
  // Line materials all need to know the window size.
  for(var mat of this.line_materials) mat.resolution = this.resolution;


  this.point_materials = [
    this.spacepoint_material = new THREE.PointsMaterial( { size:2, color: 0x009696 } ),
    this.spacepoint_hover_material = new THREE.PointsMaterial( { size:3, color: 0xff0000 } ),
    this.spacepoint_select_material = new THREE.PointsMaterial( { size:3, color: 0xffff00 } ),    
  ];

}


// Two sets of coordinates used: XYZ world coordinates (or UVZ), and wire/tdc.
WireViewGL.prototype.UtoWire = function(u) { return (u+gGeo.transversePlaneOffset(this.plane))/gGeo.wire_pitch; } 
WireViewGL.prototype.WireToU = function(w) { return w*gGeo.wire_pitch - gGeo.transversePlaneOffset(this.plane); } 
WireViewGL.prototype.VtoTdc  = function(v) { return v/gGeo.drift_cm_per_tick; } 
WireViewGL.prototype.TdcToV  = function(t) { return t*gGeo.drift_cm_per_tick; } 



WireViewGL.prototype.ZoomChange = function(fast) 
{
  var newlimits = {
    minu: this.WireToU(gZoomRegion.plane[this.plane][0] ),
    maxu: this.WireToU(gZoomRegion.plane[this.plane][1] ),
    minv: this.TdcToV(gZoomRegion.tdc[0]),
    maxv: this.TdcToV(gZoomRegion.tdc[1]),
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
  if('minu' in new_limits || 'maxu' in new_limits) {
    gZoomRegion.setLimits(this.plane
                        , this.UtoWire(limits.minu)
                        , this.UtoWire(limits.maxu)
    );
  }
  if('minv' in new_limits || 'maxv' in new_limits){
    gZoomRegion.changeTimeRange(this.VtoTdc(limits.minv)
                               ,this.VtoTdc(limits.maxv)
    );
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
  for(var mat of this.line_materials||[]) {mat.resolution = this.resolution; mat.needsUpdate = true;}; 
}

WireViewGL.prototype.HoverAndSelectionChange = function() 
{
  // Hits are not independent objects. 
  if(gLastHoverState.type=='hit'||gHoverState.type=='hit'||gLastSelectState.type=="hit"||gSelectState.type=="hit")
    this.HoverAndSelectionChange_Hits();

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
      obj.position.x = 0.5*(t_x1+t_x2) - gGeo.transversePlaneOffset(this.plane);
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
  this.dirty=true;
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
    threeobj.userData = {
      default_material: this.track_material,
      hover_material:   this.track_material_hover,
      select_material:   this.track_material_selected,
    }
		threeobj.scale.set( 1, 1, 1 );
    // threeobj.raycast = THREE.Line.raycast;
    threeobj.computeLineDistances(); //???
    threeobj.raycast_fast = true;
    
    // Make it findable again.
    threeobj.name = trk._pointer;    
    threeobj.position.z = 10; // level of tracks.
    // threeobj.matrixAutoUpdate=false; // Don't auto-compute each time. I'll tell you when your coords change
    threeobj.updateMatrix();     // Oh, they changed.
    this.track_group.add(threeobj);
  }

  this.scene.add(this.track_group);
  this.UpdateTracks();
}

WireViewGL.prototype.UpdateTracks = function(fast)
{
  // Changes properties of all displayed tracks.
  
  this.offset_track = 0;
  if(this.ctl_track_shift.is(":checked")) 
    this.offset_track = parseInt(this.ctl_track_shift_value.val())*gGeo.drift_cm_per_tick; // convert to position.

  if(this.track_group)
    this.track_group.position.y = this.offset_track;
  this.UpdateVisibilities();
  this.dirty=true;
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
  setVis(this.hit_group  ,   ".show-hits");
  setVis(this.cluster_group  ,   ".show-clusters");
  setVis(this.endpoint2d_group  ,   ".show-endpoint2d");
  setVis(this.mc_group  ,   ".show-mcparticles");
  setVis(this.spacepoints_group  ,   ".show-spacepoints");
  setVis(this.showers_group  ,   ".show-showers");
  this.dirty=true;
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
    
  	this.raycaster.linePrecision=4;
    this.fMousePos.norm  = new THREE.Vector3(this.fMousePos.x/this.width*2-1, 1-2*this.fMousePos.y/this.height, 1);
  	this.raycaster.setFromCamera( this.fMousePos.norm, this.camera );
    // this.raycast_layers = new THREE.Layers; // set to valid layers. Not required, but leaving
    var intersects = this.raycaster.intersectObjects(this.scene.children,true);
    console.log("intersects:",intersects.length,intersects);
    for(var i=0;i<intersects.length;i++) {
      var intersect = intersects[i];
      var obj = intersect.object;
      // if(!obj.layers.test(this.raycast_layers)) continue; // ignore the magnifier. Obsolete; magnifier removed already
      var ptr = obj.name;
      console.log("pick candidate:",obj,ptr);
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
  
    var wire = this.UtoWire(this.fMousePos.world.x);
    if(wire>=0 && wire< gGeo.numWires(this.plane)) (match.channel = gGeo.channelOfWire(this.plane,wire));
    match.sample  = this.VtoTdc(this.fMousePos.world.y);
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


////////////////////////////////////////
// Hits
////////////////////////////////////////

WireViewGL.prototype.CreateHits = function()
{
  if(this.hit_meshes){
    // dispose old hits object:
    this.hit_group.remove(this.hit_meshes);
    this.hit_meshes.geometry.dispose();
    this.hit_meshes.material.dispose();
  }

  if(!this.hit_group) {
    this.hit_group = new THREE.Group();
    this.hit_group.name = "hit_group";    
  }
  
  var hits = GetSelected("hits");
  if(!hits.length) return;

  this.hit_material = new THREE.MeshBasicMaterial( {
      color: 0xFFFFFF,
        side: THREE.DoubleSide, vertexColors: THREE.VertexColors
  } );

  var field = $(this.GetBestControl(".hit-hist-field")).val();

  var vertices = [];
  var normals  = [];
  var indices  = [];
  var colors   = [];
  var product_indices = []; // One per face, to hold a the hit index
  var nvertices = 0;
  function addhit(ihit,u1,u2,v1,v2,colorvals) {
    // if(plane==2) console.log("addhit",...arguments);
    vertices.push( u1, v2, 0 ); normals.push(0,0,1); colors.push(...colorvals);
    vertices.push( u2, v2, 0 ); normals.push(0,0,1); colors.push(...colorvals);
    vertices.push( u1, v1, 0 ); normals.push(0,0,1); colors.push(...colorvals);
    vertices.push( u2, v1, 0 ); normals.push(0,0,1); colors.push(...colorvals);
    indices.push( nvertices+0, nvertices+2, nvertices+1, nvertices+2, nvertices+3, nvertices+1 );  
    product_indices.push(ihit,ihit);
    nvertices += 4;
  }
  
  for(var i=0;i<hits.length;i++){
    var hit = hits[i];
    if(hit.plane != this.plane) continue;
    // hit object is in U,tdc space, needs scaling
    var u = this.WireToU(hit.wire);
    var halfwidth = gGeo.wire_pitch/2;
    var q = hit[field]; // The value being plotted for charge. 
    // if(q<gHitCut.min) { continue;}
    // if(q>gHitCut.max) { continue;}
    var c = gHitColorScaler.GetColorValues(q);
    var cc = [c[0]/255,c[1]/255,c[2]/255];
    // cc = [1,1,1];
    
    addhit( i, u-halfwidth, u+halfwidth, hit.t1, hit.t2, cc);
  }
  
  var geo = new THREE.BufferGeometry();
  // console.log("hit buffer geom with",indices,vertices,normals,colors);
  geo.setIndex(indices);
  geo.addAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
  geo.addAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
  geo.addAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
  this.hit_meshes = new THREE.Mesh(geo,this.hit_material);
  // this.hit_group.position.x = - gGeo.transversePlaneOffset(this.plane);
  this.hit_meshes.position.z = 10;
  this.hit_meshes.name = hits._pointer;
  this.hit_meshes.userData = {
    product_indices:  product_indices,
    default_material: this.hit_material,
    hover_material:   new THREE.MeshBasicMaterial( {color: 0xff0000} ),
    select_material:  new THREE.MeshBasicMaterial( {color: 0xff0000} )
  }
  this.hit_group.add(this.hit_meshes);
  this.hit_group.scale.y =  gGeo.drift_cm_per_tick;
  
  this.scene.add(this.hit_group);
  this.UpdateHits();
}

WireViewGL.prototype.HoverAndSelectionChange_Hits = function()
{
  // Draw a highlight box around the hit.
  if(!this.hit_hover_box) {
    var geometry = new THREE.LineGeometry();
    geometry.setPositions([-1,-1,0, -1,1,0, 1,1,0, 1,-1,0, -1,-1,0]);
    this.hit_hover_box = new THREE.Mesh(geometry,this.highlight_line_material);
    this.hit_group.add(this.hit_hover_box);

    this.hit_select_box = new THREE.Mesh(geometry,this.highlight_line_material);
    this.hit_group.add(this.hit_select_box);
  }

  var hit = gHoverState.obj;
  if(gHoverState.type=='hit' && hit.plane == this.plane) {
    this.hit_hover_box.visible = true;
    this.hit_hover_box.position.x = this.WireToU(hit.wire);    
    this.hit_hover_box.position.y = (hit.t1+hit.t2)*0.5;    
    this.hit_hover_box.position.z = 20;
    this.hit_hover_box.scale.x = gGeo.wire_pitch;
    this.hit_hover_box.scale.y = (hit.t2-hit.t1)*0.5;
  } else {
    this.hit_hover_box.visible = false;
  }
  
  var hit = gSelectState.obj;
  if(gSelectState.type=='hit' && hit.plane == this.plane) {
    this.hit_select_box.visible = true;
    this.hit_select_box.position.x = this.WireToU(hit.wire);    
    this.hit_select_box.position.y = (hit.t1+hit.t2)*0.5;    
    this.hit_select_box.position.z = 20;
    this.hit_select_box.scale.x = gGeo.wire_pitch;
    this.hit_select_box.scale.y = (hit.t2-hit.t1)*0.5;    
  } else {
    this.hit_select_box.visible = false;
  }
}


WireViewGL.prototype.UpdateHits = function()
{
  if(!this.hit_group) return;
  this.hit_group.scale.y =  gGeo.drift_cm_per_tick;  
  var offset_hit_time = 0;
  if($('#ctl-shift-hits').is(":checked")) offset_hit_time = parseFloat( $('#ctl-shift-hits-value').val() );  
  this.hit_group.position.y =  offset_hit_time*gGeo.drift_cm_per_tick;  
}
  



////////////////////////////////////////
// Clusters
////////////////////////////////////////

WireViewGL.prototype.CreateClusters = function(lazy)
{
  if(this.cluster_group) {
    this.scene.remove(this.cluster_group);
    // FIXME: dispose
  }

  // Ensure we have data.
  var clusters = GetSelected("clusters");
  var clustername = GetSelectedName("clusters");
  if(!clusters.length) return;

  // Find the hits that are associated with this cluster.
  // gRecord.associations.<clustername>.<hitname>[clusid] = [array of hit indices]
  if(!gRecord.associations) {console.error("Can't find associations"); return; }
  var assns = gRecord.associations[clustername];
  var hitname = null;
  for(var name in assns) {
    if( (/^recob::Hits/).test(name) ) { 
      // its a hit list! This is what we want.
      hitname = name; break;
    }
  }
  if(!hitname) return;
  var hitassn = assns[hitname];
  var hits = gRecord.hits[hitname];
  if(!hits) return;

  if(lazy && this.cluster_group && this.cluster_group.name == clusters._pointer) {
    console.warn("not bothering to recreate.")
  }

  this.cluster_group = new THREE.Group();
  this.cluster_group.name = clusters._pointer;    
  
  this.cluster_hover_material  =  new THREE.MeshBasicMaterial({color:0xFFFF00});
  this.cluster_select_material =  new THREE.MeshBasicMaterial({color:0xFFFF00});
  
  
  this.clusterHulls = [];
  clusterLoop:
  for(var i = 0; i<clusters.length;i++) {
    var clus = clusters[i];
    clus._index = i;

    var chits = hitassn[i]; // Look up in the association table
    var points = [];
    for(var ihit=0;ihit<chits.length;ihit++) {
      var hid = chits[ihit];
      var h = hits[hid];
      if(h.plane == this.plane) {
        points.push( [ this.WireToU(h.wire), h.t ] );        
      } else {
        continue clusterLoop;  // Give up on this cluster; go to the next one.
      }
    }
    var hull = GeoUtils.convexHull(points);
    var poly = [];
    var vertices = [];
    var shape = new THREE.Shape();
    shape.moveTo( hull[hull.length-1][0][0], hull[hull.length-1][0][1]);
    for(var ihull=0;ihull<hull.length;ihull++) {
      var u = hull[ihull][0][0];
      var v = hull[ihull][0][1];
      shape.lineTo(u,v);
    }
    var rgb = (new ColorScaleIndexed(i+1)).GetColorValues();
    var hex = rgb[0]<<16 + rgb[1]<<8 + rgb[2];
    
    var geo = new THREE.ShapeBufferGeometry(shape);
    var mat = new THREE.MeshBasicMaterial({color:hex});
    var mesh = new THREE.Mesh(geo,mat);
    mesh.name = clus._pointer;
    mesh.userData = {
      hover_material  : this.cluster_hover_material,
      select_material : this.cluster_select_material,
    }
    this.cluster_group.add(mesh);    
  }


  this.scene.add(this.cluster_group);
  this.UpdateClusters();
  this.UpdateVisibilities();
}

WireViewGL.prototype.UpdateClusters = function()
{
  if(!this.cluster_group) return this.CreateClusters();
  this.cluster_group.scale.y =  gGeo.drift_cm_per_tick;  
  var offset_hit_time = 0;
  if($('#ctl-shift-hits').is(":checked")) offset_hit_time = parseFloat( $('#ctl-shift-hits-value').val() );  
  this.cluster_group.position.y =  offset_hit_time*gGeo.drift_cm_per_tick;  
}
  
  
  
///////////////////////////
// Endpoint 2d  FIXME UNTESTED
//////////////////////////


WireViewGL.prototype.CreateEndpoint2d = function()
{
  this.endpoint2d_material =  this.endpoint2d_material || new THREE.MeshBasicMaterial({color: 0xff8c00});
  this.endpoint2d_hover_material =  this.endpoint2d_hover_material || new THREE.MeshBasicMaterial({color: 0xff0000});
  this.endpoint2d_select_material = this.endpoint2d_select_material || new THREE.MeshBasicMaterial({color: 0xff0000});

  var endpoints = GetSelected("endpoint2d");
  if(!endpoints.length) return;

  if(this.endpoint2d_group) {
    this.scene.remove(this.endpoint2d_group);
    // FIXME dispose geometry
  }
  this.endpoint2d_group = new THREE.Group();

  for(var i=0;i<endpoints.length;i++) {
      var pt = endpoints[i];
      pt._index = i;
      if(pt.plane != this.plane) continue;
      
      var u = this.WireToU(pt.wire);
      var v = pt.t;
      var r = 5; // cm
      
      var geo = new THREE.CircleBufferGeometry(r);
      var mesh = new THREE.Mesh(geo,this.endpoint2d_material);
      mesh.position.x = u;
      mesh.position.y = v;
      mesh.position.z = 12;
      
      mesh.name = pt._pointer;
      mesh.userData = {
        hover_material  : this.endpoint2d_hover_material,
        select_material : this.endpoint2d_select_material,
      }
      this.endpoint2d_group.add(mesh);          
  }

  this.scene.add(this.endpoint2d_group);
  this.UpdateEndpoint2d();
  this.UpdateVisibilities();
};

WireViewGL.prototype.UpdateEndpoint2d = function()
{
  if(!this.endpoint2d_group) return;
  this.endpoint2d_group.scale.y =  gGeo.drift_cm_per_tick;  
  var offset_hit_time = 0;
  if($('#ctl-shift-hits').is(":checked")) offset_hit_time = parseFloat( $('#ctl-shift-hits-value').val() );  
  this.endpoint2d_group.position.y =  offset_hit_time*gGeo.drift_cm_per_tick;  
}


///////////////////////////
// Spacepoints
///////////////////////////
WireViewGL.prototype.CreateSpacepoints = function()
{
  var sps = GetSelected("spacepoints");
  if(!sps.length) return;
  if(this.spacepoints_group) {
    this.scene.remove(this.spacepoints_group);
    for(thing of this.spacepoints_group.children) thing.geometry.dispose(); // delete old ones.
  }
  
  this.spacepoints_group = new THREE.Group();


  var positions=[];
  var product_indices = []; // One per face, to hold a the hit index
  for(var i = 0; i<sps.length;i++) {
    var sp = sps[i];
    var u = gGeo.yzToTransverse(this.plane,sp.xyz[1],sp.xyz[2]);
    var v = sp.xyz[0];
    positions.push(u,v,0);
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
  
  this.spacepoints_group.position.z = 40; 
  
  this.scene.add( this.spacepoints_group );   
  this.UpdateSpacepoints();
};
WireViewGL.prototype.UpdateSpacepoints = function()
{
  this.offset_track = 0;
  if(this.ctl_track_shift.is(":checked")) 
    this.offset_track = parseInt(this.ctl_track_shift_value.val())*gGeo.drift_cm_per_tick; // convert to position.

  if(this.spacepoints_group)
    this.spacepoints_group.position.y = this.offset_track;
  this.UpdateVisibilities();
  this.dirty=true;
  this.Render();
}
WireViewGL.prototype.HoverAndSelectionChange_Spacepoints = function()
{
  // Draw or remove  highlight points.
  
  var sp = gHoverState.obj;
  if(gHoverState.type=='spacepoints' ) {
    this.spacepoint_hover_threeobj.visible=true;
    this.spacepoint_hover_threeobj.position.x = gGeo.yzToTransverse(this.plane,sp.xyz[1],sp.xyz[2]);
    this.spacepoint_hover_threeobj.position.y = sp.xyz[0];    
  } else {
    this.spacepoint_hover_threeobj.visible = false;
  }
  
  sp = gSelectState.obj;
  if(gSelectState.type=='spacepoints' ) {
    this.spacepoint_select_threeobj.visible=true;
    this.spacepoint_select_threeobj.position.x = gGeo.yzToTransverse(this.plane,sp.xyz[1],sp.xyz[2]);
    this.spacepoint_select_threeobj.position.y = sp.xyz[0];    
  } else {
    this.spacepoint_select_threeobj.visible = false;
  }
}



///////////////////////////
// Showers
///////////////////////////
WireViewGL.prototype.CreateShowers = function()
{  
  if(this.showers_group) {
    scene.remove(this.showers_group);
    for(thing of this.showers_group.children) thing.geometry.dispose(); // delete old ones.
  }
  this.shower_material = new THREE.MeshBasicMaterial( { color: 0xff00ff, transparent: true, opacity: 0.5});
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
    var dir = new THREE.Vector2(gGeo.yzToTransverse(this.plane,shw.dir.y,shw.dir.z),shw.dir.x);
    var d1 = dir.clone().rotateAround({x:0,y:0},angle);
    var d2 = dir.clone().rotateAround({x:0,y:0},-angle);
    dir.setLength(Length);
    d1.setLength(Length*0.8);
    d2.setLength(Length*0.8);
    console.log('shower', dir, d1, d2);
    var shape = new THREE.Shape();
    shape.moveTo(u,v);
    shape.lineTo(u+d1.x,  v+d1.y);
    shape.lineTo(u+dir.x, v+dir.y);
    shape.lineTo(u+d2.x,  v+d2.y);
    shape.lineTo(u,v);
    var geo = new THREE.ShapeBufferGeometry(shape);
    var obj = new THREE.Mesh(geo,this.shower_material);
    obj.name = shw._pointer;
    obj.userData = {
      default_material:this.shower_material, 
      hover_material:  this.shower_hover_material,
      select_material: this.shower_select_material,      
    }
    this.showers_group.add(obj);
  }
  this.showers_group.name = "showers";
  this.showers_group.position.z = 51;
  this.scene.add(this.showers_group);
  this.UpdateShowers();
}
WireViewGL.prototype.UpdateShowers = function()
{
  this.offset_track = 0;
  if(this.ctl_track_shift.is(":checked")) 
    this.offset_track = parseInt(this.ctl_track_shift_value.val())*gGeo.drift_cm_per_tick; // convert to position.

  if(this.showers_group)
    this.showers_group.position.y = this.offset_track;
  this.UpdateVisibilities();
  this.dirty=true;
  this.Render();
}

///////////////////////////
// MC
///////////////////////////
WireViewGL.prototype.CreateMC = function()
{  
  if(this.mc_group) {
    this.scene.remove(this.mc_group);
    for(thing of this.mc_group.children) thing.geometry.dispose(); // delete old ones.
  }
  this.mc_group = new THREE.Group();
  this.mc_group.name = "mc";
  // 
  var particles = GetSelected("mcparticles");
  if(!particles.length) return;
  
  // this.mc_material
  // this.mc_neutral_material
  // this.mc_hover_material
  // this.mc_select_material

  // Deal with these in Update. 
  var show_neutrals = $(this.ctl_show_mc_neutrals).is(":checked");
  var move_t0 =  $(this.ctl_mc_move_tzero).is(":checked");
  if(move_t0) console.warn('moving mc t0');
  
  // console.warn("Drawing MC",particles.length);
  var nparticles = particles.length;
  // if(nparticles>10) nparticles=10;
  for(var i=0;i<nparticles;i++)
  {
    var p= particles[i];
    if(!p.trajectory || p.trajectory.length<2) continue;
    
    // compile points
    var pts = [];
    // var t0 = 3200;
    // if(move_t0 && p.trajectory.length>0) t0 = 3200+ p.trajectory[0].t/500.0; // 500 ns per tick.
    var lastu = 1e99; var lastv = 1e99
    for(var j=0;j<p.trajectory.length-1;j++) {
      var point = p.trajectory[j];
      var u = gGeo.yzToTransverse(this.plane,point.y,point.z);
      var v = point.x;
      var d = (u-lastu)*(u-lastu) + (v-lastv)*(v-lastv);
      if(d>gGeo.wire_pitch*gGeo.wire_pitch)
        pts.push(u,point.x,0); 
    }
    var point = p.trajectory[p.trajectory.length-1];
    pts.push(gGeo.yzToTransverse(this.plane,point.y,point.z),point.x,0); // Push the last point
    
    var pdg = Math.abs(p.fpdgCode);
    var neutral = (pdg == 22 || pdg == 2112 || pdg == 12 || pdg == 14 || pdg == 16);
    if(neutral) continue;
    var mat = (neutral) ? this.mc_material : this.mc_neutral_material; 
    
    var geometry = new THREE.LineGeometry();
    geometry.setPositions(pts);
    geometry.raycast_fast = true; // Just take the first segment hit when raycasting.
    var threeobj = new THREE.Line2(geometry, mat);
    threeobj.userData = {
      default_material: mat,
      hover_material:   this.mc_hover_material,
      select_material: this.mc_select_material,
      neutral: neutral,
      t: p.trajectory[0].t
    }    
    // Make it findable again.
    threeobj.name = p._pointer;    
    threeobj.raycast_fast = true;
    // Set timing property correctly
    threeobj.position.y = this.offset_track; // shift by the offset. 
    threeobj.position.z = 20; // level of mc.
    // threeobj.matrixAutoUpdate=false; // Don't auto-compute each time. I'll tell you when your coords change
    threeobj.updateMatrix();     // Oh, they changed.
    this.mc_group.add(threeobj);
  }
  var yshift = 3200*gGeo.drift_cm_per_tick;
  this.mc_group.position.y = yshift
  
  this.scene.add(this.mc_group);
  this.UpdateMC();
  this.UpdateVisibilities();
  this.dirty=true;
  this.Render();
    
};

WireViewGL.prototype.UpdateMC = function()
{
  if(!this.mc_group) return;
  var show_neutrals = this.GetBestControl(".show-mc-neutrals").checked;
  var move_t0 =       this.GetBestControl(".ctl-mc-move-tzero").checked;

  if(show_neutrals) this.mc_neutral_material.opacity = 0;
  else              this.mc_neutral_material.opacity = 1;
  this.mc_neutral_material.needsUpdate = true;
  
  var yshift = 3200*gGeo.drift_cm_per_tick;
  for(var obj of this.mc_group.children) {
    // Shift by this particles's t0. Note that it's 500 ns per tick, and t is in ns
    obj.position.y = (move_t0) ? (gGeo.drift_cm_per_tick*obj.userData.t/500) : 0
    if(obj.userData.neutral) 
      obj.visible = show_neutrals;
  }
}



///////////////////////////
// UserTrack (DrawdEdXPath)
///////////////////////////


