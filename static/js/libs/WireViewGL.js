"use strict";
//
// Code for the Argo Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

//
// 'Main' scripts for argo.html
// Used to be in 'head', but it was too unwieldly.
//
/*jshint laxcomma:true */


// To do: Shift-select

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
  this.view = this.view || this.plane;
  if(this.view === undefined || this.view === null) throw "No view assigned to WireView";


  // Layers definitions:
  this.kz_image = 1.2;
  this.kz_tracks = 3.0;
  
  this.CreateFrame();
  this.renderer.setClearColor( 0xffffff,1);
  this.renderer.render( this.scene, this.camera );
  
  // Events and triggers:
  
  // Wireimg
  gStateMachine.Bind('change-wireimg',       this.CreateWireimg.bind(this,false) ); 
  gStateMachine.Bind('colorWireMapsChanged', this.UpdateWireimg.bind(this,false) ); 
  gStateMachine.Bind('driftChange',          this.UpdateWireimg.bind(this) );  // REbuild since geometry is shot.  
  gStateMachine.Bind('toggle-wireimg',       this.UpdateVisibilities.bind(this) ); 
  gStateMachine.Bind('changeViewMode',       this.CreateWireimg.bind(this,false) );
  $('#ctl-coherent-noise-filter')     .on("change", this.UpdateWireimg.bind(this) );
  $('input:radio.ctl-bad-wire-filter').on("change", this.UpdateWireimg.bind(this) );
  $('#ctl-gl-edge-finder')            .on("change", this.UpdateWireimg.bind(this) );
  $('input.zoommode:checked')         .on("change", this.UpdateWireimg.bind(this) );

  gStateMachine.Bind('ChangePsuedoColor',    this.Render.bind(this,true) );  // Re-render, but this doesn't require anything more.
  

  // updates to things:
  // Tracks
  this.ctl_track_shift        =  this.GetBestControl(".track-shift-window");
  this.ctl_track_shift_value  =  this.GetBestControl("#ctl-track-shift-value");
  gStateMachine.Bind('change-tracks',  this.CreateTracks.bind(this,false) );
  $(this.ctl_track_shift)       .change( this.UpdateTracks.bind(this) );
  $(this.ctl_track_shift_value) .change( this.UpdateTracks.bind(this) );
  gStateMachine.Bind('driftChange', this.UpdateTracks.bind(this) );  // REbuild since geometry is shot.
  gStateMachine.Bind('toggle-tracks', this.UpdateVisibilities.bind(this) );  
  
  // Zoom change
  gStateMachine.Bind('zoomChange', this.ZoomChange.bind(this,false) );
  gStateMachine.Bind('zoomChangeFast', this.ZoomChange.bind(this,true) );
  
  // Hover and selection
  gStateMachine.Bind('hoverChange', this.HoverAndSelectionChange.bind(this));
  gStateMachine.Bind('selectChange', this.HoverAndSelectionChange.bind(this));
  
  // hits
  gStateMachine.Bind('change-hits', this.CreateHits.bind(this) );  
  gStateMachine.Bind('toggle-hits',          this.UpdateVisibilities.bind(this) ); 
  gStateMachine.Bind('hitChange',    this.CreateHits.bind(this) ); // Could be improved: change vertex colors instead of recreation
  gStateMachine.Bind('driftChange', this.UpdateHits.bind(this) );  // REbuild since geometry is shot.
  $('#ctl-shift-hits')      .change(this.UpdateHits.bind(this));
  $('#ctl-shift-hits-value').change(this.UpdateHits.bind(this));
  
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
  
  // usertrack
  this.ctl_dedx_path          =  this.GetBestControl(".dEdX-Path");  
  $(this.ctl_dedx_path).change( this.UpdateUserTrack.bind(this) );
  gStateMachine.Bind('userTrackChange',  this.UpdateUserTrack.bind(this) );
  
  
  // ----------
  // Materials.
  this.line_materials = [
    this.track_material = new THREE.LineMaterial( { color: 0x00ff00, linewidth: 3, dashed: false} ),
    this.track_material_hover = new THREE.LineMaterial( { color: 0xffff00, linewidth: 4, dashed: false} ),

    this.selected_material_1 = new THREE.LineMaterial( { color: 0x500000, linewidth: 4, dashed: false} ),
    this.selected_material_2 = new THREE.LineMaterial( { color: 0xffff00, linewidth: 4, dashed: false} ),

    this.highlight_line_material =  new THREE.LineMaterial( { color: 0xFF0000, linewidth: 2, dashed: false} ),

    this.mc_material          = new THREE.LineMaterial( { color: 0x0000ff, linewidth: 1, dashed: false} ),
    this.mc_neutral_material  = new THREE.LineMaterial( { color: 0x0000ff, linewidth: 1, dashed: true} ),
    this.mc_hover_material    = new THREE.LineMaterial( { color: 0xffff00, linewidth: 3, dashed: false}  ),
    this.mc_select_material   = new THREE.LineMaterial( { color: 0xfffff0, linewidth: 3, dashed: false}  ),  
    this.user_track_rim_material    = new THREE.LineMaterial( { color: new THREE.Color("rgb(40, 92, 0)").getHex(), linewidth: 2, dashed: false}  ),
        
  ]; 
  this.track_material_selected = this.selected_material_1;//[this.selected_material_1, this.selected_material_2]; // Multiple materials don't work. would need duplicate object
  this.mc_select_material      = this.selected_material_1;//[this.selected_material_1, this.selected_material_2];
  
  // Line materials all need to know the window size.
  for(var mat of this.line_materials) mat.resolution = this.resolution;


  this.point_materials = [
    this.spacepoint_material = new THREE.PointsMaterial( { size:2, color: 0x009696 } ),
    this.spacepoint_hover_material = new THREE.PointsMaterial( { size:3, color: 0xff0000 } ),
    this.spacepoint_select_material = new THREE.PointsMaterial( { size:3, color: 0xffff00 } ), 
       
  ];

}


WireViewGL.prototype.ZoomChange = function(fast) 
{
  
  var urange = gZoomRegion.getTransverseRange(this.plane);
  var vrange = gZoomRegion.getXRange(this.span_y/this.span_x);
  var newlimits = {
    minu: urange[0],
    maxu: urange[1],
    minv: vrange[0],
    maxv: vrange[1],
  };
  if(isNaN(newlimits.minu)) debugger;
  if(isNaN(newlimits.maxu)) debugger;
  if(isNaN(newlimits.minv)) debugger;
  if(isNaN(newlimits.maxv)) debugger;
  
  // Call the default (not the function below!!)
  ThreePad.prototype.SetWorldCoordsForFrame.call(this,newlimits);
  // update for time offsets
  this.UpdateWireimg();
  this.UpdateHits();

  this.dirty = true;
  this.overlay_dirty = true;
  this.Render();
}

WireViewGL.prototype.SetWorldCoordsForFrame = function(new_limits,finished)
{
  var limits = $.extend({},this.GetWorldCoordsForFrame(),new_limits);
  // Don't change view, instead emit a zoom change event, which echos back to the above.
  if('minu' in new_limits || 'maxu' in new_limits) {
    gZoomRegion.setTransverseRange(this.plane, limits.minu, limits.maxu);
  }
  if('minv' in new_limits || 'maxv' in new_limits){
    gZoomRegion.setXRange(limits.minv,limits.maxv,this.span_y/this.span_x);
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
  if(gLastHoverState.type=='hits'||gHoverState.type=='hits'||gLastSelectState.type=="hits"||gSelectState.type=="hits")
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




WireViewGL.prototype.CreateFrame = function()
{
  this.frame_group = new THREE.Group();

 //  // var material = new THREE.MeshBasicMaterial({ color: 0xff00000, side: THREE.DoubleSide });
 for(var tpc=0; tpc< gGeo3.ntpc; tpc++){

    // Fixme: need to trim the time so I don't overlap times in different projections
    var u1 = 1e9;
    var u2 = -1e9;
    for(var section of gGeo3.data.tpcs[tpc].views[this.view].sections) {
        if(section[0].trans<u1) u1 = section[0].trans;
        if(section[1].trans>u2) u2 = section[1].trans;
    }
    var v1 = gGeo3.data.tpcs[tpc].center[0] - gGeo3.data.tpcs[tpc].halfwidths[0];
    var v2 = gGeo3.data.tpcs[tpc].center[0] + gGeo3.data.tpcs[tpc].halfwidths[0];

    var texture = null;
    if(gGeo3.ntpc > 1)
        texture = new THREE.TextTexture({
          fontFamily: '"Times New Roman", Times, serif',
          fontSize: 100,
          text:  'TPC '+tpc,
          fillStyle: "#FFF",
          strokeStyle: "#000"
    });

    let material  = new THREE.MeshBasicMaterial({   color:0xe0e0e0, transparent:true, opacity: 0.2 });
    let material2 = new THREE.MeshBasicMaterial({   color:0xffffff, transparent:true, opacity: 0.2, map: texture });

    var geometry = new THREE.PlaneGeometry( Math.abs(u2-u1), v2-v1 );
    var mesh1 = new THREE.Mesh(geometry,material);
    var mesh2 = new THREE.Mesh(geometry,material2);
    mesh1.position.x = (u1+u2)/2;
    mesh1.position.y = (v1+v2)/2;
    mesh1.position.z = tpc;
    mesh2.position.x = (u1+u2)/2;
    mesh2.position.y = (v1+v2)/2;
    mesh2.position.z = tpc+0.001;

    this.frame_group.add(mesh1);
    this.frame_group.add(mesh2);
  
  }     
  this.scene.add(this.frame_group);
}





WireViewGL.prototype.create_image_meshgroup = function(mapper,chan_start,chan_end,tdc_start,tdc_end,x1,x2,y1,y2,flip,userData)
{
  // returns a THREE.Group with all of the wire textures mapped in xy plane.
  // mapper must contain a tile_urls[row][col] and tile_3textures[row][col]
  // chan_start, chan_end are logical channel numbers from start to end for this region
  // tdc_start, tdc_end are the range of TDC values we want to show
  // x1,x2 are x positions of first and last channel respecitvely
  // y1,y2 are y positions of the first and last tdc respectively
  var wireimg_group = new THREE.Group();
  wireimg_group.name=GetSelectedName("wireimg");
  
  console.log('create_image_meshgroup arguments',...arguments)

  var tdc_scale = (y2-y1)/(tdc_end-tdc_start);     //console.log('tdc_scale',tdc_scale);
  var chan_scale = (x2-x1) /(chan_end-chan_start); //console.log('chan_scale',chan_scale);
  
  for(var irow=0;irow<mapper.tile_3textures.length;irow++) {
    // Do we need this row?
    var elem = mapper.tile_urls[irow][0];
    if(elem.y + elem.height <= chan_start) continue;
    if(elem.y >= chan_end) continue;
    // console.log('mapper row',irow,elem);
    
    // which are the samples this texture will provide to us?
    var t_chan_start = Math.max(elem.y, chan_start);            //console.log('t_chan_start',t_chan_start);
    var t_chan_end   = Math.min(elem.y+elem.height, chan_end);  //console.log('t_chan_end',t_chan_end);
    
    var t_x1 =  x1 + chan_scale * (t_chan_start-chan_start); //console.log('t_x1',t_x1);
    var t_x2 =  x1 + chan_scale * (t_chan_end  -chan_start); //console.log('t_x2',t_x2);
    var t_span_x = chan_scale * (t_chan_end-t_chan_start);

    var geometry = new THREE.PlaneGeometry( t_span_x, y2-y1 );

    if(!gFalseColorControl.lut_texture) Error("No LUT texture!");
    var uniforms = {
            maptexture:   { type: "t", value: gFalseColorControl.lut_texture },
            do_noise_reject:     { value: 0 },
            do_bad_channel_flag: { value: 0 },
            texture_start_chan:  { value: elem.y },
            texture_size_chan:   { value: elem.height },
            
            chan_start: { value: t_chan_start },
            chan_end:   { value: t_chan_end   },
            tdc_start:  { value: tdc_start },
            tdc_end:    { value: tdc_end  },
            flip:       { type: "i", value: flip?1:0 },
            trans_fade_width: {value: 10.}, 
            trans_low_cut:    {value: -1e9},
            trans_high_cut:   {value:  1e9},
            do_trans_view_direction_flag: { value: 0},

         };


    // add all the textures in the time direction.
    for(var icol=0;icol<mapper.tile_3textures[irow].length;icol++) {
      var elem = mapper.tile_urls[irow][icol];
      var key = "texture"  + (icol).toString();
      //console.log("mapper column",icol,"elem",elem,"key",key);

      var input_texture = mapper.tile_3textures[irow][icol];
      input_texture.needsUpdate = true;

      uniforms[key] = { type: "t", value: input_texture }
      uniforms[key+"_start_tdc"] = {value: elem.x };
      uniforms[key+"_size_tdc"] = {value: elem.width};
    }

    // null out the others.
    for(var iccol=mapper.tile_3textures[irow].length;icol<=5;icol++){
      var key = "texture"  + (icol).toString();
      uniforms[key] = { type: "t", value: null }
      uniforms[key+"_start_tdc"] = {value: -1e9 };
      uniforms[key+"_size_tdc"]  = {value: -1e9};
    }

    //console.log('uniform',uniforms);

    var material = new THREE.ShaderMaterial( {
      vertexShader:   document.getElementById('three-vertex-shader').textContent,
      fragmentShader: document.getElementById('three-fragment-shader-time-range').textContent,
      // fragmentShader: document.getElementById('stupidfill').textContent,
      uniforms: uniforms,
      visible: true,
      transparent: true,
      side: THREE.DoubleSide    
    });

    var obj = new THREE.Mesh( geometry, material );
    obj.position.x = (t_x1+t_x2)/2;
    obj.position.y = (y1+y2)/2;
    //console.log("created wireimg with ",t_span_x,y2-y1,t_x1,t_x2,obj.position.x,obj.position.y);
    if(!flip) {
        // Just turn it upside down.
        // obj.rotation.x = Math.PI;
      }
   obj.userData = userData;
      
      
    // FIXME: when clearing event, dispose of all geometries, materials, and textures.
    wireimg_group.add( obj );
  }
  return wireimg_group; //this.scene.add(this.wireimg_group);    
}


WireViewGL.prototype.CreateWireimg = function()
{
  console.log("WireViewGL CreateWireimg");
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

  console.error("CreateWireimg zoommode is full:",gZoomRegion.fullMode(),"tpc:",gZoomRegion.getSelectedTpc());
  for(var tpc=0; tpc< gGeo3.ntpc; tpc++){
    var nwires = gGeo3.numWires(tpc,this.view);
    var pitch  = gGeo3.wire_pitch(tpc,this.view);
    console.log("wireimg ",tpc,this.view);

    // Fixme: need to trim the time so I don't overlap times in different projections
    for(var section of gGeo3.data.tpcs[tpc].views[this.view].sections) {
      var chanstart = section[0].channel;
      var chanend   = section[1].channel;

      // This is where it goes in world space:
      // horizontal (wire number/ transverse) = x on screen
      var u1 = section[0].trans - pitch/2; // Ensure pixes are centered on the wire.
      var u2 = section[1].trans - pitch/2;
      //console.log("Creating wireimg tpc",tpc,"view",this.view,"trans",u1," to ",u2,section);

      var gtpc = gGeo3.getTpc(tpc);

      // vertical
      if( gZoomRegion.fullMode() && gZoomRegion.getSelectedTpc() == tpc) {
        // whole time view, correct for microboone:
        var tdc_start = 0; //gGeo3.getTDCofX(tpc,this.view,v1) + gZoomRegion.getTimeOffset();
        var tdc_end   = mapper.total_width*mapper.scale_x; //gGeo3.getTDCofX(tpc,this.view,v2) + gZoomRegion.getTimeOffset();
        var v1 = gGeo3.getXofTDC(tpc,this.view,tdc_start);
        var v2 = gGeo3.getXofTDC(tpc,this.view,tdc_end);
      } else {
        // Attempt for DUNE:
        // var v1 =  gtpc.center[0] - gtpc.halfwidths[0];
        // var v2 =  gtpc.center[0] + gtpc.halfwidths[0];
        var v1 =  gtpc.views[this.view].x; // position of wires
        var v2 =  gtpc.center[0] - gtpc.drift_dir*gtpc.halfwidths[0]; // position of cathode
      }

      var tdc_start = gGeo3.getTDCofX(tpc,this.view,v1) + gZoomRegion.getTimeOffset();
      var tdc_end   = gGeo3.getTDCofX(tpc,this.view,v2) + gZoomRegion.getTimeOffset();

      var flip = (gtpc.drift_dir > 0);

      // metadata so we can get this back:
      var userData = { wireimg: true, tpc: tpc, section: section};

      var tpc_group = this.create_image_meshgroup(mapper,
                        chanstart, chanend, // source pixel coord (when textures mapped out)
                        tdc_start,tdc_end,  // source pixed coord
                        u1,u2, // x coord (wire number) in viewer space
                        v1,v2,
                        flip,
                        userData); // y coord (time) in viewer space
      tpc_group.userData.tpc_group = tpc;
      // this.wireimg_group.scale.y =  gGeo3.getDriftCmPerTick(0); // fixme tpc number
      //console.log("wireimg ",tpc,this.view, u1,u2,v1,v2);

      this.wireimg_group.add(tpc_group);
    }

  }   


  // // This puts the wire image into the xy plane with units of cm in each direction.  But no reason it couldn't be wire/tdc coordinates, which get transformed later
  // var x1 = 0;
  // var x2 = gGeo3.wire_pitch(0,this.view) * nwires;  // trans coordinate. // fixme TPC number
  // var y1 = 0;
  // var y2 = ntdc; //gGeo3.getDriftCmPerTick(0) * ntdc; // Set it to the wire height, then scale below! 
  

  // // console.time("build_image_blocks");
  // this.wireimg_group = this.create_image_meshgroup(mapper,
  //                         gGeo.channelOfWire(this.plane,0),
  //                         gGeo.channelOfWire(this.plane,nwires),
  //                         0,ntdc,
  //                         x1,x2,y1,y2);
  // this.wireimg_group.scale.y =  gGeo3.getDriftCmPerTick(0); // fixme tpc number
  this.wireimg_group.position.z = this.kz_image;
  this.scene.add(this.wireimg_group);
  this.UpdateWireimg();
  // console.timeEnd("build_image_blocks");
}


WireViewGL.prototype.UpdateWireimg = function(fast)
{
  // Create it if data doesn't exist.
  if(!this.wireimg_group)  this.CreateWireimg(); 
  if(!this.wireimg_group)  return;

  // if(!this.wireimg_group) this.CreateWireimg(); 
  // this.wireimg_group.scale.y =  gGeo3.getDriftCmPerTick(0); // fixme tpc number

  var do_filter        = $('#ctl-coherent-noise-filter').is(":checked") ? 1:0;
  var bad_channel_flag = $('input:radio.ctl-bad-wire-filter:checked').val();
  var edge_finder      = $('#ctl-gl-edge-finder').is(":checked") ? 1:0;
  var do_smear = 0;
  
  var center_y = gZoomRegion.getCenter().y;

  for(var tpcgroup of this.wireimg_group.children) {

    for(var mesh of tpcgroup.children) {
      var mat = mesh.material;

      var tpc = mesh.userData.tpc;
      var gtpc = gGeo3.getTpc(tpc);
      // var v1 =  gtpc.center[0] - gtpc.halfwidths[0];
      // var v2 =  gtpc.center[0] + gtpc.halfwidths[0];
      // var tdc_start = gGeo3.getTDCofX(tpc,this.view,v1) + gZoomRegion.getTimeOffset();
      // var tdc_end   = gGeo3.getTDCofX(tpc,this.view,v2) + gZoomRegion.getTimeOffset();

      // change tdc offset.
      var gtpc = gGeo3.getTpc(tpc);
      var v1 =  gtpc.center[0] - gtpc.halfwidths[0];
      var v2 =  gtpc.center[0] + gtpc.halfwidths[0];
      var driftspeed = gGeo3.getDriftCmPerTick(tpc);

      var tdc_start = gGeo3.getTDCofX(tpc,this.view,v1) + gZoomRegion.getTimeOffset();
      var tdc_end   = gGeo3.getTDCofX(tpc,this.view,v2) + gZoomRegion.getTimeOffset();

      console.log("view",this.view,"tdc_start",tdc_start,"tdc_end",tdc_end);
      mat.uniforms.tdc_start.value = tdc_start;
      mat.uniforms.tdc_end.value   = tdc_end;

      // Change transverse cut
      if(gZoomRegion.cropMode() || gZoomRegion.setSelectedTpc() != mesh.userData.tpc) {
        mesh.position.z=0.0; // Set to low position.

        // Drift crop:
        var tdc_start = gGeo3.getTDCofX(tpc,this.view,v1) + gZoomRegion.getTimeOffset();
        var tdc_end   = gGeo3.getTDCofX(tpc,this.view,v2) + gZoomRegion.getTimeOffset();
        mat.uniforms.tdc_start.value = tdc_start;
        mat.uniforms.tdc_end.value = tdc_end;

        // Transverse crop:
        if(gGeo3.numTpcs()>1) {
          var [u1,u2] = gGeo3.findTransCuts(tpc,this.view, center_y);
          mat.uniforms.trans_fade_width.value = 2;
          mat.uniforms.trans_low_cut.value  = u1;
          mat.uniforms.trans_high_cut.value = u2;
          // console.log("fadecut tpc",tpc,"view",this.view,"trans low",u1,"trans high",u2,"tdc start",tdc_start,"tdc end",tdc_end);
        } else {
          mat.uniforms.trans_low_cut.value = -1e9;
          mat.uniforms.trans_high_cut.value = 1e9;
        }
      } else {
        // make it a bit higher
        mesh.position.z=0.5;
        mat.uniforms.tdc_start.value = gZoomRegion.getTimeOffset();
        mat.uniforms.tdc_end.value   = gZoomRegion.getTimeOffset() + this.max_tdc; // found when looking at wireimg stuff.

        mat.uniforms.trans_low_cut.value = -1e9;
        mat.uniforms.trans_high_cut.value = 1e9;
      }

      // trigger channels
      mat.uniforms.do_noise_reject    .value= do_filter;
      mat.uniforms.do_bad_channel_flag.value= bad_channel_flag;

      mat.needsUpdate = true;
    }
  }


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
      var u = gGeo3.yzToTransverse(this.view,points[j].y, points[j].z);
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
    this.offset_track = parseInt(this.ctl_track_shift_value.val())*gGeo3.getDriftCmPerTick(0); // convert to position. // fixme tpc number

  if(this.track_group)
    this.track_group.position.y = this.offset_track;
  this.UpdateVisibilities();
  this.dirty=true;
  this.Render();  
}


WireViewGL.prototype.UpdateVisibilities = function()
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
  if(ev.type === 'mouseup') {
    if( this.fObjectDragging ) {
      if(this.fObjectDragging == "UserTrack") gStateMachine.Trigger("userTrackChange");
      this.fObjectDragging = false;
      this.UpdateUserTrack();
      this.dirty=true;
      
    }
  }
  var retval = true;
  if(!ev.shiftKey && !this.fObjectDragging ) retval =  ThreePad.prototype.DoMouse.call(this,ev);
  
  // ev.originalEvent.preventDefault();
  
  if(this.fObjectDragging) {
    if(this.fObjectDragging=="UserTrack") {
      var newWire = gGeo3.transverseToWire(0,this.view,this.fMousePos.world.x); // fixme TPC numb
      var newTdc  = gGeo3.getTDCofX(0,this.view,this.fMousePos.world.y); // fixme TPC number
      // console.warn("DRAG TO", newWire,newTdc);
      this.fObjectDragged.set_view(this.plane,newWire,newTdc);
      this.UpdateUserTrack();
      this.dirty=true;
    }
  } else {



    // Object picking for hover or selection
    if(this.fMouseInContentArea) {
    
      var match =  {obj: null, type:"wire"}; 
      var found_match = false;
      var match_tpc = undefined;

      // How close do we want to match?  Let's say 5 pixels.
      var xspan = 5*(this.camera.right-this.camera.left)/this.span_x;
    	this.raycaster.linePrecision=xspan;
      this.fMousePos.norm  = new THREE.Vector3(this.fMousePos.x/this.width*2-1, 1-2*this.fMousePos.y/this.height, 1);
    	this.raycaster.setFromCamera( this.fMousePos.norm, this.camera );
      // this.raycast_layers = new THREE.Layers; // set to valid layers. Not required, but leaving
      var intersects = this.raycaster.intersectObjects(this.scene.children,true);
      // console.log("intersects:",intersects.length,intersects);

      for(var i=0;i<intersects.length;i++) {
        var intersect = intersects[i];
        var obj = intersect.object;
        // if(!obj.layers.test(this.raycast_layers)) continue; // ignore the magnifier. Obsolete; magnifier removed already
        if(obj.userData && obj.userData.wireimage) {
          // We've hit the bare wire level. Record which tpc we seem to be mousing over.
          var match_tpc = (obj.userData||{}).tpc;
          console.log('mouseover tpc',obj.userData);
        }
        var ptr = obj.name;
        // console.log("pick candidate:",obj,ptr);
        if(!found_match && ptr && ptr.startsWith('/')){
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
            found_match = true; // We found the best one.  // No, keep moving down the list until you hit the tpc box.
          }

        }
        if(!found_match && ptr && ptr.startsWith("usertrackhandle")) {
          var j = parseInt(ptr.split(' ')[1]);
          match = { type: "UserTrack", obj: gUserTrack.points[j] };
          this.fObjectDragged = gUserTrack.points[j];
          if(ev.type=="mousedown"){
            this.fObjectDragging = "UserTrack";
            // console.warn("START DRAG");
          } 
          break;
        }
      
      }
  
      // locate which tpc the mouse is likely in.
      var trans = this.fMousePos.world.x;
      var x     = this.fMousePos.world.y;

      // If TPC is ambiguous, use 3d coordinates of the view.
      if (!Number.isInteger(match_tpc)) {
        // Start at the center, move trans distance.
        var trans_vector = gGeo3.data.basis.transverse_vectors[this.view];
        var along_vector = gGeo3.data.basis.along_vectors[this.view];
        var y = gZoomRegion.getCenter().y * along_vector[1]+ trans*trans_vector[1];
        var z = gZoomRegion.getCenter().z * along_vector[2]+ trans*trans_vector[2];
        match_tpc = gGeo3.xyzToTpc(x,y,z);
      }
      var wireref;
      //match_tpc = 0;
      if(match_tpc>=0) {
        wireref = { tpc: match_tpc };
        wireref.wire   = gGeo3.transverseToWire(match_tpc,this.view,trans);
        wireref.channel= gGeo3.wireToChannel(match_tpc,this.view,wireref.wire);
        wireref.plane  = gGeo3.viewToPlane(match_tpc,this.view);
      } else {
        // try dead reckoning.
        wireref = gGeo3.XTransverseToTpcWire(this.view,x,trans); // problematic.
      }

      if(wireref !== undefined) {
        // console.log("DoMouse hit",this.fMousePos.world,wireref);
        match.sample = gGeo3.getTDCofX(wireref.tpc,this.view,x) + gZoomRegion.getTimeOffset();
        if(!match.obj) match.obj = wireref.channel + "|" + match.sample;
        match.wire = wireref.wire;
        match.tpc = wireref.tpc;
        match.plane = wireref.plane;
        match.channel = wireref.channel;
        match.view = this.view;
      } else {
        // console.log("DoMouse no tpc",this.fMousePos.world,wireref);
        
      }
      if(!match.obj) match.obj = "outside"+trans+"|"+x;
      match.trans = trans;
      match.x     = x;
      ChangeHover(match); // match might be null.
      if(ev.type=="click") { // Click, but not on just ordinary wire
        var offset = getAbsolutePosition(this.viewport);      
        if(match.canvas_coords) SetOverlayPosition(match.canvas_coords.x + offset.x, match.canvas_coords.y + offset.y);
        ChangeSelection(match);
      }
    }
  }

  return retval;
}


////////////////////////////////////////
// Hits
////////////////////////////////////////



WireViewGL.prototype.CreateHits = function()
{

  if(!this.hit_group) {
    this.hit_group = new THREE.Group();
    this.hit_group.name = "hit_group";    
    this.scene.add(this.hit_group);
  }
  for(var mesh of this.hit_group.children) {
    // dispose old hits object:
    this.hit_group.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();      
  }

  var hits = GetSelected("hits");
  if(!hits.length) return;
  // this.clippingPlanes = [
  //        new THREE.Plane( new THREE.Vector3( -1, 0, 0 ), 100 ),
  //        new THREE.Plane( new THREE.Vector3( 0, 1, 0 ), 100 ),
  // ];

  if(this.hit_materials) {
    for(var m of this.hit_materials) m.dispose();
  }
  this.hit_materials = [];

  for(var tpc = 0;tpc<gGeo3.numTpcs();tpc++) {
    this.hit_materials[tpc] = new THREE.MeshBasicMaterial( {
      color: 0xFFFFFF,
      side: THREE.DoubleSide, 
      vertexColors: THREE.VertexColors
    } );
  }

  var field = $(this.GetBestControl(".hit-hist-field")).val();

  for(var tpc = 0; tpc< gGeo3.numTpcs(); tpc++) {
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

    var halfwidth = gGeo3.wire_pitch(tpc,this.view)/2; // FIXME TPC number
    
    for(var i=0;i<hits.length;i++){
      var hit = hits[i];
      var hittpc = hit.tpc || 0;
      if(hittpc!=tpc) continue;
      if(hit.Ch) {
        // new version.
        if(!hit._wires) hit._wires = gGeo3.channelToWires(hit.Ch,tpc); // need to put this in soon
        for(var w of hit._wires) {
          if(w.view==this.view) {
            var u = gGeo3.wireToTransverse(tpc,this.view,w.wire); // FIXME TPC number
            var q = hit[field]; // The value being plotted for charge. 
            var c = gHitColorScaler.GetColorValues(q);
            var cc = [c[0]/255,c[1]/255,c[2]/255];
            addhit( i, u-halfwidth, u+halfwidth, hit.t1, hit.t2, cc);
          }
        }
      } else {
        // old version.
        if(hit.plane != this.plane) continue;
        // // hit object is in U,tdc space, needs scaling
        var u = gGeo3.wireToTransverse(tpc,this.view,hit.wire); 
        var q = hit[field]; // The value being plotted for charge. 
        var c = gHitColorScaler.GetColorValues(q);
        var cc = [c[0]/255,c[1]/255,c[2]/255];
        addhit( i, u-halfwidth, u+halfwidth, hit.t1, hit.t2, cc);
      }

      
    }
    
    var geo = new THREE.BufferGeometry();
    // console.log("hit buffer geom with",indices,vertices,normals,colors);
    geo.setIndex(indices);
    geo.addAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
    geo.addAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );
    geo.addAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
    var mesh = new THREE.Mesh(geo,this.hit_materials[tpc]);
    mesh.position.z = 10;
    mesh.scale.y =  gGeo3.getDriftCmPerTick(tpc);
    mesh.name = hits._pointer;
    mesh.userData = {
      product_indices:  product_indices,
      default_material: this.hit_materials[tpc],
      tpc: tpc,
    }
    this.hit_group.add(mesh);
  }

  this.UpdateHits();
}

WireViewGL.prototype.UpdateHits = function()
{
  for(var tpc=0; tpc<(this.hit_materials||[]).length; tpc++) {    
    // Update clipping planes.
    if(gZoomRegion.cropMode()) {
      var gtpc = gGeo3.getTpc(tpc);
      this.hit_materials[tpc].clippingPlanes = [
                  new THREE.Plane( new THREE.Vector3( 0, 1, 0), -(gtpc.center[0]-gtpc.halfwidths[0]) ),  // detector x coordiate, view y
                  new THREE.Plane( new THREE.Vector3( 0,-1,0), (gtpc.center[0]+gtpc.halfwidths[0]) ), 
              ];

    } else {
      this.hit_materials.clippingPlanes = null;
    }

  }
  if(!this.hit_group) return;
  var offset_hit_time = -gZoomRegion.getTimeOffset();
  if($('#ctl-shift-hits').is(":checked")) offset_hit_time += parseFloat( $('#ctl-shift-hits-value').val() );  

  for(var mesh of this.hit_group.children) {
    var tpc = mesh.userData.tpc || 0;
    gtpc = gGeo3.getTpc(tpc);
    mesh.scale.y =  gGeo3.getDriftCmPerTick(tpc)*-1*gtpc.drift_dir; // Fixme tpc number  
    mesh.position.y =  offset_hit_time * mesh.scale.y + gtpc.views[this.view].x; 
  }
  this.dirty =true;
  this.Render();
}


WireViewGL.prototype.HoverAndSelectionChange_Hits = function()
{
  console.log("HoverAndSelectionChange_Hits");
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
  if(gHoverState.type=='hits') {
    var tpc = hit.tpc || 0;
    var vertices = [];
    if(hit.Ch) {
        if(!hit._wires) hit._wires = gGeo3.channelToWires(hit.Ch,tpc); // need to put this in soon
        for(var w of hit._wires) {
          if(w.view==this.view) {
            var u = gGeo3.wireToTransverse(tpc,this.view,w.wire); // FIXME TPC number
            var h = gGeo3.wire_pitch(tpc,this.view)/2;
            vertices.push(u-h,hit.t1,0, u-h,hit.t2,0, u+h,hit.t2,0, u+h,hit.t1,0, u-h,hit.t1,0); 
          }       
        }
    } else {
      var u = gGeo3.wireToTransverse(tpc,this.view,hit.wire); 
      var h = gGeo3.wire_pitch(tpc,this.view)/2; 
      vertices = [u-h,hit.t1,0, u-h,hit.t2,0, u+h,hit.t2,0, u+h,hit.t1,0, u-h,hit.t1,0];
    } 
    console.log("hover hit box ",vertices);
    if(vertices.length>0) {
      var geometry = new THREE.LineGeometry();

      geometry.setPositions(vertices);
      this.hit_hover_box.geometry.dispose();
      this.hit_hover_box.geometry = geometry;

      var offset_hit_time = -gZoomRegion.getTimeOffset();
      if($('#ctl-shift-hits').is(":checked")) offset_hit_time += parseFloat( $('#ctl-shift-hits-value').val() );  
      this.hit_hover_box.scale.y =  gGeo3.getDriftCmPerTick(tpc); // Fixme tpc number  
      this.hit_hover_box.position.y = -gGeo3.getTpc(tpc).drift_dir * offset_hit_time * this.hit_hover_box.scale.y; 
      this.hit_hover_box.position.z = 20;
      this.hit_hover_box.visible = true;
    }

  } else {
    this.hit_hover_box.visible = false;
  }
  
  var hit = gSelectState.obj;
  if(gSelectState.type=='hits' ) { // fixme use channel number.
    var tpc = hit.tpc || 0;
    var vertices = [];
    if(hit.Ch) {
        if(!hit._wires) hit._wires = gGeo3.channelToWires(hit.Ch,tpc); // need to put this in soon
        for(var w of hit._wires) {
          if(w.view==this.view) {
            var u = gGeo3.wireToTransverse(tpc,this.view,w.wire); // FIXME TPC number
            var h = gGeo3.wire_pitch(tpc,this.view)/2;
            vertices.push(u-h,hit.t1,0, u-h,hit.t2,0, u+h,hit.t2,0, u+h,hit.t1,0, u-h,hit.t1,0); 
          }       
        }
    } else {
      var u = gGeo3.wireToTransverse(tpc,this.view,hit.wire); 
      var h = gGeo3.wire_pitch(tpc,this.view)/2; 
      vertices = [u-h,hit.t1,0, u-h,hit.t2,0, u+h,hit.t2,0, u+h,hit.t1,0, u-h,hit.t1,0];
    } 
    console.log("hover hit box ",vertices);
    if(vertices.length>0) {
      var geometry = new THREE.LineGeometry();

      geometry.setPositions(vertices);
      this.hit_select_box.geometry.dispose();
      this.hit_select_box.geometry = geometry;

      var offset_hit_time = -gZoomRegion.getTimeOffset();
      if($('#ctl-shift-hits').is(":checked")) offset_hit_time += parseFloat( $('#ctl-shift-hits-value').val() );  
      this.hit_select_box.scale.y =  gGeo3.getDriftCmPerTick(tpc); // Fixme tpc number  
      this.hit_select_box.position.y = -gGeo3.getTpc(tpc).drift_dir * offset_hit_time * this.hit_hover_box.scale.y; 
      this.hit_select_box.position.z = 20;
      this.hit_select_box.visible = true;
    }

  } else {
    this.hit_select_box.visible = false;
  }
}






////////////////////////////////////////
// Clusters
////////////////////////////////////////

WireViewGL.prototype.CreateClusters = function(lazy)
{
  if(this.cluster_group) {
    this.scene.remove(this.cluster_group);
    for(var thing of this.cluster_group.children) thing.geometry.dispose();
  }

  // Ensure we have data.
  var clusters = GetSelected("clusters");
  var clustername = GetSelectedName("clusters");
  if(!clusters.length) return;

  // Find the hits that are associated with this cluster.
  // gRecord.associations.<clustername>.<hitname>[clusid] = [array of hit indices]
  if(!gRecord.associations) {
    // console.error("Can't find associations lusters",clusters.length);
    // We have to wait for the associations to show up.
    return;
  }
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

  // if(lazy && this.cluster_group && this.cluster_group.name == clusters._pointer) {
  //   console.warn("not bothering to recreate.")
  // }

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
        points.push( [ gGeo3.wireToTransverse(0,this.view,h.wire), h.t ] );   // fixme tpc number      
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
  this.cluster_group.scale.y =  gGeo3.getDriftCmPerTick(0); // Fixme tpc number  
  var offset_hit_time = 0;
  if($('#ctl-shift-hits').is(":checked")) offset_hit_time = parseFloat( $('#ctl-shift-hits-value').val() );  
  this.cluster_group.position.y =  offset_hit_time*gGeo3.getDriftCmPerTick(0); // Fixme tpc number   
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
      
      var u = gGeo3.wireToTransverse(0,this.view,pt.wire); // fixme TPC number
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
  this.endpoint2d_group.scale.y =  gGeo3.getDriftCmPerTick(0); // Fixme tpc number ;  
  var offset_hit_time = 0;
  if($('#ctl-shift-hits').is(":checked")) offset_hit_time = parseFloat( $('#ctl-shift-hits-value').val() );  
  this.endpoint2d_group.position.y =  offset_hit_time*gGeo3.getDriftCmPerTick(0); // Fixme tpc number   
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
    for(var thing of this.spacepoints_group.children) thing.geometry.dispose(); // delete old ones.
  }
  
  this.spacepoints_group = new THREE.Group();


  var positions=[];
  var product_indices = []; // One per face, to hold a the hit index
  for(var i = 0; i<sps.length;i++) {
    var sp = sps[i];
    var u = gGeo3.yzToTransverse(this.view,sp.xyz[1],sp.xyz[2]);
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
    this.offset_track = parseInt(this.ctl_track_shift_value.val())*gGeo3.getDriftCmPerTick(0); // Fixme tpc number ; // convert to position.

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
    this.spacepoint_hover_threeobj.position.x = gGeo3.yzToTransverse(this.view,sp.xyz[1],sp.xyz[2]);
    this.spacepoint_hover_threeobj.position.y = sp.xyz[0];    
  } else {
    this.spacepoint_hover_threeobj.visible = false;
  }
  
  sp = gSelectState.obj;
  if(gSelectState.type=='spacepoints' ) {
    this.spacepoint_select_threeobj.visible=true;
    this.spacepoint_select_threeobj.position.x = gGeo3.yzToTransverse(this.view,sp.xyz[1],sp.xyz[2]);
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
    this.scene.remove(this.showers_group);
    for(var thing of this.showers_group.children) thing.geometry.dispose(); // delete old ones.
  }
  this.shower_material = new THREE.MeshBasicMaterial( { color: 0xff00ff, transparent: true, opacity: 0.5});
  this.shower_hover_material =  new THREE.MeshBasicMaterial( { color: 0xffff00, transparent: true,opacity: 0.9});
  this.shower_select_material = new THREE.MeshBasicMaterial( { color: 0xffff00, transparent: true,opacity: 0.9});
  var showers = GetSelected("showers");
  if(!showers.length) return;
  
  this.showers_group = new THREE.Group();
  this.showers_group.name = "showers";
  
  for(var shw of showers) {
    var u = gGeo3.yzToTransverse(this.view,shw.start.y,shw.start.z);
    var v = shw.start.x;
    var angle = shw.openangle || 20./180*Math.PI/2;
    var Length = shw.Length || 100;
    var dir = new THREE.Vector2(gGeo3.yzToTransverse(this.view,shw.dir.y,shw.dir.z),shw.dir.x);
    var d1 = dir.clone().rotateAround({x:0,y:0},angle);
    var d2 = dir.clone().rotateAround({x:0,y:0},-angle);
    dir.setLength(Length);
    d1.setLength(Length*0.8);
    d2.setLength(Length*0.8);
    // console.log('shower', dir, d1, d2);
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
    this.offset_track = parseInt(this.ctl_track_shift_value.val())*gGeo3.getDriftCmPerTick(0); // Fixme tpc number ; // convert to position.

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
    for(var thing of this.mc_group.children) thing.geometry.dispose(); // delete old ones.
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
  var move_t0       = $(this.ctl_mc_move_tzero).is(":checked");
  // if(move_t0) console.warn('moving mc t0');
  
  // console.warn("Drawing MC",particles.length);
  var nparticles = particles.length;
  // if(nparticles>10) nparticles=10;
  for(var i=0;i<nparticles;i++)
  {
    var p= particles[i];
    if(!p.trajectory || p.trajectory.length<2) continue;
    if(p.trajectory[0].E - p.fmass < 0.001) continue; // Less than 1 MeV particles go less than 1 wire width.
    // compile points
    var pts = [];
    // var t0 = 3200;
    // if(move_t0 && p.trajectory.length>0) t0 = 3200+ p.trajectory[0].t/500.0; // 500 ns per tick.
    var lastu = 1e99; var lastv = 1e99;
    for(var j=0;j<p.trajectory.length-1;j++) {
      var point = p.trajectory[j];
      var u = gGeo3.yzToTransverse(this.view,point.y,point.z);
      var v = point.x;
      // Not that relevant.
      // var d = (u-lastu)*(u-lastu) + (v-lastv)*(v-lastv);
      // if(d>gGeo3.wire_pitch(0,view)*gGeo3.wire_pitch(0,view)); // fixme tpc number
      pts.push(u,point.x,0); 
    }
    var point = p.trajectory[p.trajectory.length-1];
    pts.push(gGeo3.yzToTransverse(this.view,point.y,point.z),point.x,0); // Push the last point
    
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
    threeobj.matrixAutoUpdate=false; // Don't auto-compute each time. I'll tell you when your coords change
    threeobj.updateMatrix();     // Oh, they changed.
    this.mc_group.add(threeobj);
  }
  var yshift = 3200*gGeo3.getDriftCmPerTick(0); // Fixme tpc number ;
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
  
  var yshift = 3200*gGeo3.getDriftCmPerTick(0); // Fixme tpc number ;
  for(var obj of this.mc_group.children) {
    // Shift by this particles's t0. Note that it's 500 ns per tick, and t is in ns
    obj.position.y = yshift + ( (move_t0) ? (gGeo3.getDriftCmPerTick(0)*(obj.userData.t/500)) : 0 ); // Fixme tpc number 
    obj.updateMatrix();     // Oh, they changed.
    if(obj.userData.neutral) 
      obj.visible = show_neutrals;
  }
}



///////////////////////////
// UserTrack (DrawdEdXPath)
///////////////////////////

WireViewGL.prototype.UpdateUserTrack = function()
{
  if(!gUserTrack) return;
  if(!gUserTrack.points.length) return;


  if(!this.user_track_group || gUserTrack.points.length*2-1 != this.user_track_group.children.length) {
    // rebuild.
    if(this.user_track_group){
      this.scene.remove(this.user_track_group);
      for(var thing of this.user_track_group.children) thing.geometry.dispose();
    }
    this.user_track_group = new THREE.Group();
    this.user_track_group.name="usertrack";
    this.user_track_handle_material = this.user_track_handle_material || new THREE.MeshBasicMaterial( { color: 0x00ff00, transparent: true,opacity: 0.7} );
    this.user_track_joiner_material = this.user_track_joiner_material || new THREE.MeshBasicMaterial( { color: 0xff0000, transparent: true,opacity: 0.3} );

    var circle_geometry = new THREE.CircleBufferGeometry( 1, 32 );
    var rim_geometry = new THREE.LineGeometry();
    var rim_coord = [];  
    for(var i=0;i<32;i++) rim_coord.push(Math.cos(Math.PI*2*i/31),Math.sin(Math.PI*2*i/31), 0);
    rim_geometry.setPositions(rim_coord);


    for(var i=0;i<gUserTrack.points.length;i++)
    {
      // create handles
      var handle = new THREE.Mesh( circle_geometry, this.user_track_handle_material );
      handle.name = "usertrackhandle "+i;

      var rim = new THREE.Line2(rim_geometry, this.user_track_rim_material );      
      rim.position.z=0.1;
      handle.add( rim );
      
      this.user_track_group.add( handle );
      
      // Create colored region between handles.
      if(i!=gUserTrack.points.length-1) {
        var geo = new THREE.BufferGeometry( );
        var normals  = [0,0,1,0,0,1,0,0,1,0,0,1];
        var vertices = [0,0,0,0,0,0,0,0,0,0,0,0];
        geo.setIndex( [ 0,2,1,2,3,1 ]);
        geo.addAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
        geo.addAttribute( 'normal', new THREE.Float32BufferAttribute( normals, 3 ) );        
        var joiner = new THREE.Mesh(geo, this.user_track_joiner_material);
        joiner.name = "usertrackjoiner "+i;
        this.user_track_group.add( joiner );
      }      
    }
    this.user_track_group.position.z = 100;
    this.scene.add(this.user_track_group);
  }
  
  // Set handle positions
  for(var i=0;i<gUserTrack.points.length;i++) {
    var pt = gUserTrack.points[i];
    var handle = this.user_track_group.getObjectByName( "usertrackhandle "+i);
    handle.position.x = gGeo3.wireToTransverse(0,this.view,pt[this.plane]); // Fixme TPC number
    handle.position.y = gGeo3.getXofTDC(0,this.view,pt.tdc); // fixme TPC number
    // console.log(handle.position.y,handle, )
    var size = 1.5; // cm gGeo3.getXofTDC(0,this.view,pt.tdc + pt.r)-gGeo3.getXofTDC(0,this.view,pt.tdc); // fixme TPC number
    handle.scale.y = size*this.width/this.height;
    handle.scale.x = size;
    // console.log("handle",i,pt,handle,handle.position.x ,handle.position.y)
  }

  // Set joiner positions
  for(var i=0;i<gUserTrack.points.length-1;i++) {
    var a = gUserTrack.points[i];
    var b = gUserTrack.points[i+1];
    var joiner = this.user_track_group.getObjectByName( "usertrackjoiner "+i);
    // build a parallelogram
    var geo = joiner.geometry
    var pos = geo.getAttribute( 'position' );
    var u1 = gGeo3.wireToTransverse(0,this.view,a[this.plane]); // fixme TPC number
    var u2 = gGeo3.wireToTransverse(0,this.view,b[this.plane]); // fixme TPC number
    pos.setXY(0, u1, gGeo3.getXofTDC(0,this.view,a.tdc+pt.r) ); // fixme TPC number
    pos.setXY(1, u2, gGeo3.getXofTDC(0,this.view,b.tdc+pt.r) ); // fixme TPC number
    pos.setXY(2, u1, gGeo3.getXofTDC(0,this.view,a.tdc-pt.r) ); // fixme TPC number
    pos.setXY(3, u2, gGeo3.getXofTDC(0,this.view,b.tdc-pt.r) ); // fixme TPC number
    geo.setIndex( [ 0,2,1,2,3,1 ]);
    pos.needsUpdate = true;
    geo.needsUpdate = true;
  }
  this.dirty = true;
  this.UpdateVisibilities();
  this.Render();
  
}

