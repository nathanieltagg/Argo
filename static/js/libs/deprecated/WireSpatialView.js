"use strict";
/*jshint laxcomma:true */
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


// This variant of WireSpatialView uses spacial coordinates, not wire number and tick number for the UV coordinate system.



// Subclass of Pad.
WireSpatialView.prototype = new Pad();

var gWireSpatialViews = [];
// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-WireSpatialView').each(function(){
    var o = new WireSpatialView(this);
    gWireSpatialViews.push(o);
    // console.log("Creating WireSpatialView ",o);
  });  
  $('.bigwireview-select').buttonset();
});




function WireSpatialView( element, options )
{
  if(!element) {
    return;
  }
  if($(element).length<1) { 
    return;
  }
  
  // console.warn("WireSpatialView created with element:",$(element).css("height"),$(element).height());
  
  
  // For uboone, this is simply in wirenum/tdc space, one pixel width for wire, one pixel height for tdc tick.
  var settings = {
    nlayers: 1,
    plane: 0, // default, override this
    margin_bottom : 40,
    margin_top    : 5,
    margin_right  : 5,
    margin_left   : 34,
    xlabel : "Wires (cm)",
    ylabel : "Drift (cm)",
    zooming: true, // set false to lock view on starting coordinates
    tick_pixels_x: 50,
    tick_pixels_y: 30,
    tick_label_font: "10px serif",
    show_image:   false, // can be false, 'raw', or 'cal'
    show_hits:    false,
    show_mc:      true,
    track_color: "rgba(89, 169, 28, 1)",
    wire_shift: [0,0,0], // for RGB mode
  };
  $.extend(true,settings,options);  // Change default settings by provided qualities.
  Pad.call(this, element, settings); // Give settings to Pad contructor.
  // console.warn("WireSpatialView created with element:",$(element).css("height"),$(element).height());

  if(this.zooming) {
    this.mouse_scale_max_u = true;
    this.mouse_scale_min_u = true;
    this.mouse_scale_max_v = true;
    this.mouse_scale_min_v = true;
    this.mouse_pan_u       = true;
    this.mouse_pan_v       = true;
  }
  
  var self = this;
  this.SetMagnify(true);
  this.fShiftSelecting = false;
  this.fShiftRect = {};
  this.hasContent = false;
  this.myHits = [];
  this.visHits = [];
  
  this.mouseable = [];
  
  this.loaded_wireimg = false;
  this.loaded_thumbnail = false;
  $(this.canvas).css('image-rendering','pixelated');
  
  // $(this.element).bind('mousemove',function(ev) { return self.DoMouse(ev); });
  // $(this.element).bind('mousedown',function(ev) { return self.DoMouse(ev); });
  // $(this.element).bind('mouseout' ,function(ev) { return self.DoMouse(ev); });
  // $(document    ).bind('mouseup' ,function(ev) { return self.DoMouse(ev); });
  // 
  // $(this.element).bind('touchstart' ,function(ev) { return self.DoMouse(ev); });
  // $(this.element).bind('touchmove' ,function(ev) {  return self.DoMouse(ev); });
  // $(this.element).bind('touchend' ,function(ev) { return self.DoMouse(ev); });

  // $(this.element).bind('resize' ,function(ev) { if(self.hasContent == false) self.Draw(); });
  
    
  gStateMachine.Bind('newRecord', this.NewRecord.bind(this) );
  gStateMachine.Bind('newPiece', this.NewPiece.bind(this) );
  gStateMachine.Bind('TimeCutChange',this.Draw.bind(this) );
  gStateMachine.Bind('hoverChange',  this.HoverChange.bind(this) );
  gStateMachine.Bind('selectChange', this.Draw.bind(this) );
  gStateMachine.Bind('hitChange',    this.TrimHits.bind(this) );
  gStateMachine.Bind('timeCutChange',this.TrimHits.bind(this) );
  
  gStateMachine.BindObj("colorWireMapsChanged",this,"Draw"); // Callback when wire image loads
  if(this.zooming) gStateMachine.BindObj('zoomChange',this,"Draw");
  if(this.zooming) gStateMachine.BindObj('zoomChangeFast',this,"DrawFast");
 
  this.ctl_hit_field          =  this.GetBestControl(".hit-hist-field");
  this.ctl_show_wireimg       =  this.GetBestControl(".show-wireimg");
  this.ctl_show_clus          =  this.GetBestControl(".show-clusters");
  this.ctl_show_endpoint      =  this.GetBestControl(".show-endpoint2d");
  this.ctl_show_spoints       =  this.GetBestControl(".show-spacepoints");
  this.ctl_show_tracks        =  this.GetBestControl(".show-tracks");
  this.ctl_track_shift        =  this.GetBestControl(".track-shift-window");
  this.ctl_track_shift_value  =  this.GetBestControl("#ctl-track-shift-value");
  this.ctl_show_showers       =  this.GetBestControl(".show-showers");
  this.ctl_show_mc            =  this.GetBestControl(".show-mc");
  this.ctl_show_mc_neutrals   =  this.GetBestControl(".show-mc-neutrals");
  this.ctl_mc_move_tzero      =  this.GetBestControl(".ctl-mc-move-tzero");
  this.ctl_show_reco          =  this.GetBestControl(".show-reco");
  this.ctl_wireimg_type       =  this.GetBestControl("[name=show-wireimg-type]");
  this.ctl_dedx_path          =  this.GetBestControl(".dEdX-Path");
  this.ctl_lock_aspect_ratio  =  GetLocalControl(".ctl-lock-aspect-ratio");
  

  gStateMachine.Bind('toggle-wireimg', this.Draw.bind(this,false) ); 
  gStateMachine.Bind('toggle-hits', this.Draw.bind(this,false) ); 
  gStateMachine.Bind('toggle-clusters', this.Draw.bind(this,false) ); 
  gStateMachine.Bind('toggle-endpoint2d', this.Draw.bind(this,false) );
  gStateMachine.Bind('toggle-spacepoints', this.Draw.bind(this,false) ); 
  gStateMachine.Bind('toggle-tracks', this.Draw.bind(this,false) ); 
  gStateMachine.Bind('toggle-showers', this.Draw.bind(this,false) ); 
  gStateMachine.Bind('toggle-mcparticles', this.Draw.bind(this,false) ); 

  $(this.ctl_show_wireimg).change(function(ev) { return self.Draw(false); });
  $(this.ctl_show_clus)   .change(function(ev) { return self.Draw(false); });
  $(this.ctl_show_endpoint).change(function(ev) { return self.Draw(false); });
  $(this.ctl_track_shift) .change(function(ev) { return self.Draw(false); });
  $(this.ctl_track_shift_value) .change(function(ev) { return self.Draw(false); });
  $(this.ctl_show_mc     ).change(function(ev) { return self.Draw(false); });
  $(this.ctl_show_mc_neutrals ).change(function(ev) { return self.Draw(false); });
  $(this.ctl_mc_move_tzero ).change(function(ev) { return self.Draw(false); });
  $(this.ctl_show_reco ).change(function(ev) { return self.Draw(false); });
  $(this.ctl_wireimg_type).click(function(ev)  { return self.Draw(false); });
  
  
  gStateMachine.Bind('change-tracks', this.Draw.bind(this,false) );
  gStateMachine.Bind('change-showers', this.Draw.bind(this,false) );
  gStateMachine.Bind('change-spacepoints', this.Draw.bind(this,false) );
  gStateMachine.Bind('change-hits', this.RebuildHits.bind(this) );
  gStateMachine.Bind('change-clusters', this.Draw.bind(this,false) );
  $(this.ctl_dedx_path)     .change(function(ev) { return self.Draw(false); });
  $(this.GetBestControl(),".show-reco")     .change(function(ev) { return self.Draw(false); });
  $('#ctl-show-watermark'). change(function(ev) { return self.Draw(false); });
  $(this.ctl_lock_aspect_ratio). change(function(ev) { 
      // Force the zoom system to acknowledge the change, by making a null zoom.
      // MOre trickery
      if($(this).is(":checked")) {
        gZoomRegion.wireview_aspect_ratio = (self.span_y)/(self.span_x);
        console.log("Setting new aspect ratio",gZoomRegion.wireview_aspect_ratio,"pixels");
        gZoomRegion.setLimits(2,gZoomRegion.plane[2][0],gZoomRegion.plane[2][1]);
        gStateMachine.Trigger("zoomChange");
      }
      $('.ctl-lock-aspect-ratio').not(this).attr("checked",false);
  });

  $('#ctl-shift-hits')      .change(this.TrimHits.bind(this));
  $('#ctl-shift-hits-value').change(this.TrimHits.bind(this));
  
  // Flip planes control (for big wireview
  this.ctl_plane = GetLocalControl(this.element,"[name=wireview-select]");
  this.ctl_plane.click(function(ev) { 
    self.plane = parseInt( $(self.ctl_plane).filter(":checked").val() );
    // console.warn("changing plane",self,$(this.ctl_plane).filter(":checked").val(),self.plane);
    self.RebuildHits()
  });
}

WireSpatialView.prototype.HoverChange = function()
{
  // Only need a redraw if the over change affected something we care about.
  // console.warn("WireSpatialView checking hoverchange",gHoverState.type,gLastHoverState.type);
  switch(gHoverState.type) {
    case "hit": 
    case "endpoint2d": 
    case "cluster":
    case "spacepoint":
    case "track":
    case "mcparticle":
      this.Draw(); return;
    default: break;
  }
  switch(gLastHoverState.type) {
    case "hit": 
    case "endpoint2d": 
    case "cluster":
    case "spacepoint":
    case "track":
    case "mcparticle":
      this.Draw(); return;
    default: break;  
  }
};

WireSpatialView.prototype.Resize = function()
{
  Pad.prototype.Resize.call(this);
  gZoomRegion.wireview_aspect_ratio = this.span_y/this.span_x;
};


WireSpatialView.prototype.NewRecord = function()
{
  //
  // called on new record available.
  //
  this.myHits = [];
  this.visHits = [];
}


WireSpatialView.prototype.NewPiece = function()
{
   // FIXME not sure how to handle. Still. 
   this.ntdc = 9600;
 };

WireSpatialView.prototype.RebuildHits = function()
{
  this.myHits = [];
  this.visHits = [];
  this.hasContent = false;

  var hits = GetSelected("hits");
  // Go through gHits, and find hits that match our view.
  for(var i=0;i<hits.length;i++) {
    if(hits[i].plane == this.plane) this.myHits.push(hits[i]);
  }
  this.TrimHits();
};


WireSpatialView.prototype.TrimHits = function()
{
  // Called when a cut is changed; go through data and trim visible hit list.

  var   offset_hit_time = 0;
  if($('#ctl-shift-hits').is(":checked")) offset_hit_time = parseFloat( $('#ctl-shift-hits-value').val() );

   
  // For now, no cuts, but I am going to add wrapper objects to hold extracted data.
  this.visHits = [];
  var field = $(this.ctl_hit_field).val();
  for(var i = 0;i<this.myHits.length;i++) {
    var h= this.myHits[i];
    var c = h[field];
    if(c<gHitCut.min) { continue;}
    if(c>gHitCut.max) { continue;}
    
    var vishit = {hit:h,
      u:this.WireToU(h.wire),  // horizontal coord
      v:this.TdcToV(h.t + offset_hit_time),     // vertical coord
      v1:this.TdcToV(h.t1 + offset_hit_time),
      v2:this.TdcToV(h.t2 + offset_hit_time),
      c: c    // Color coord
    };
    this.visHits.push(vishit);
  }

  this.Draw();
};

WireSpatialView.prototype.WireToU = function(wire)
{
  // Take the logical wire-in-plane, translate to U coordinate
  // For microboone:
  return wire*(gGeo.wire_pitch);
  // For other, need offset by tdc/plane
}

WireSpatialView.prototype.TdcToV = function(tdc)
{
  // Take the logical wire-in-plane, translate to U coordinate
  // For microboone:
  return tdc*gGeo.drift_cm_per_tick;
  // For other, need offset by tdc/plane
}

WireSpatialView.prototype.UtoWire = function(u)
{
  // Take the logical wire-in-plane, translate to U coordinate
  // For microboone:
  return u/gGeo.wire_pitch;
  // For other, need offset by tdc/plane
}

WireSpatialView.prototype.VtoTdc = function(v)
{
  // Take the logical wire-in-plane, translate to U coordinate
  // For microboone:
  return v/gGeo.drift_cm_per_tick;
  // For other, need offset by tdc/plane
}



WireSpatialView.prototype.DrawFast = function()
{
  this.Draw(true);
};


WireSpatialView.prototype.MagnifierDraw = function(fast)
{
  // Reset bounds if appropriate
  if(this.zooming) {
    this.min_v = this.TdcToV(gZoomRegion.tdc[0]);
    this.max_v = this.TdcToV(gZoomRegion.tdc[1]);
    this.min_u = this.WireToU(gZoomRegion.plane[this.plane][0]);
    this.max_u = this.WireToU(gZoomRegion.plane[this.plane][1]);
  } else {
    this.min_v = 0;
    this.max_v = this.TdcToV(3200);
    this.min_u = 0;
    this.max_u = this.WireToU(gGeo.numWires(this.plane));
  }
  
  this.Clear();
  Pad.prototype.MagnifierDraw.call(this,fast);
}

WireSpatialView.prototype.DrawOne = function(min_u,max_u,min_v,max_v,fast)
{
  this.Clear();
  
  this.DrawFrame();
  // Set clipping region for all further calls, just to make things simpler.
  this.ctx.save();
  this.ctx.beginPath();
  this.ctx.moveTo(this.GetX(this.min_u), this.GetY(this.min_v));
  this.ctx.lineTo(this.GetX(this.max_u), this.GetY(this.min_v));
  this.ctx.lineTo(this.GetX(this.max_u), this.GetY(this.max_v));
  this.ctx.lineTo(this.GetX(this.min_u), this.GetY(this.max_v));
  this.ctx.lineTo(this.GetX(this.min_u), this.GetY(this.min_v));
  this.ctx.clip();
  
  this.mouseable = [];
  if(gRecord) {
    if  ($(this.GetBestControl(".show-wireimg")).is(":checked")) {
      this.DrawImage(min_u, max_u, min_v, max_v, fast);
    }

    if  ($(this.GetBestControl(".show-clusters")).is(":checked")) {
      this.DrawClusters(min_u,max_u, min_v, max_v, fast);
    }

    if ($(this.GetBestControl(".show-hits")).is(":checked")) {
      this.DrawHits(min_u,max_u, min_v, max_v, fast);
    }

    if  ($(this.GetBestControl(".show-endpoint2d")).is(":checked")) {
      this.DrawEndpoint2d();
    }

    if  ($(this.GetBestControl(".show-spacepoints")).is(":checked")) {
      this.DrawSpacepoints(min_u,max_u, min_v, max_v, fast);
    }

    if  ($(this.GetBestControl(".show-tracks")).is(":checked")) {
      this.DrawTracks(min_u,max_u, min_v, max_v, fast);
    }

    if  ($(this.GetBestControl(".show-showers")).is(":checked")) {
      this.DrawShowers(min_u,max_u, min_v, max_v, fast);
    }

    if ($(this.ctl_show_mc).is(":checked")) {
      this.DrawMC(min_u,max_u, min_v, max_v, fast);
    }  


    if ($(this.ctl_dedx_path).is(":checked")) {
      this.DrawdEdXPath(min_u,max_u, min_v, max_v, fast);
    }

    if(this.fShiftSelecting) {
      this.DrawShiftRect();
    }
    
  }

  if(this.zooming) {
    // Make black boxes around the data.
    this.ctx.fillStyle = "rgb(0,0,0)";
    var nwires = gGeo.numWires(this.plane);
    if(min_u < 0) 
      this.ctx.fillRect( this.origin_x , this.origin_y-this.span_y, 
                          this.GetX(0) - this.origin_x, this.span_y);

    if(max_u > this.WireToU(nwires)) {
      var xmax = this.GetX(this.WireToU(nwires));
      this.ctx.fillRect( xmax , this.origin_y-this.span_y, 
                        this.span_x /*too much*/, this.span_y);
    }

    if(min_v < 0) {
      this.ctx.fillRect( this.origin_x  , this.GetY(0), 
                        this.span_x, this.span_y /*too much*/);
    }

    if(max_v > this.TdcToV(this.ntdc)) { 
      this.ctx.fillRect( this.origin_x , this.origin_y-this.span_y, 
                        this.span_x, this.GetY(this.TdcToV(this.ntdc))-(this.origin_y-this.span_y));
    }
    
    
  }  
  
  this.DrawScale();
  
  
  if($('#ctl-show-watermark').is(":checked"))
     this.DrawWatermark();

  this.ctx.restore();
  
  // Remove clipping region, then:
  this.DrawPmts();

  // this.ClearOverlays();
  // this.ctxs[1].fillStyle="green";
  // this.ctxs[1].fillRect(0,0,100,100);
};


WireSpatialView.prototype.DrawWatermark = function()
{
  var img = $('img#watermark_logo').get(0);
  if(img.complete) {
    this.ctx.save();
    var aspect_ratio = img.height/img.width;
    this.ctx.shadowColor = "white"; 
    this.ctx.shadowBlur = 10; 
    this.ctx.drawImage(img,50,10,150,100*aspect_ratio);
    this.ctx.restore();
  }
  
}

WireSpatialView.prototype.DrawScale = function()
{
  // Horizontal:
  
  var pix_span = 50;
  var uspan = (this.max_u-this.min_u);
  var u2 = this.max_u - uspan*0.05; // Right hand side.
  var x2 = this.GetX(u2);
  var x1 = x2-pix_span;
  var u1 = this.GetU(x1);
  
  var metric_w = (u2-u1) ; // 20% of pad wide, find in cm
  var lasttick = this.GetGoodTicks(0,metric_w,2,false).slice(-1).pop();  // trick to find a nice round number of cm. Retrives last entry in a list of good tick marks
  var w = lasttick; // Length of marker line in cm
  
  u1 = u2-w;
  var x1 = this.GetX(u1);
  var v  = (this.max_v-this.min_v)*0.95 + this.min_v;
  var y  = this.GetY(v);
  
  // console.warn("horizontal scale:",x2-x1);
    
  this.ctx.save();
  this.ctx.beginPath();  
  this.ctx.strokeStyle = "white";
  this.ctx.fillStyle = "white";
  this.ctx.lineWidth = 3;
  this.ctx.moveTo(x1,y);
  this.ctx.lineTo(x2,y);
  this.ctx.stroke();
  this.ctx.beginPath();  
  this.ctx.strokeStyle = "black";
  this.ctx.fillStyle = "black";
  this.ctx.lineWidth = 1;
  this.ctx.moveTo(x1,y-3);
  this.ctx.lineTo(x2,y-3);
  this.ctx.stroke();
  
  // this.ctx.moveTo(x1,y-2); // little cross beam at end
 //  this.ctx.lineTo(x1,y+2);
 //  this.ctx.moveTo(x2,y-2); // little cross beam at end
 //  this.ctx.lineTo(x2,y+2);
  this.ctx.font="15px sans-serif";
  this.ctx.shadowColor = "black";
  this.ctx.shadowBlur = 20; 
  var txt = lasttick + " cm";
  if(lasttick<=0.9) { txt = lasttick*10 + " mm";}
  if(lasttick>=100) { txt = lasttick/100 + " m";}
  this.ctx.textAlign= "center";
  this.ctx.textBaseline = "top";
  this.ctx.lineWidth = 1;
  this.ctx.fillStyle = "white";
  this.ctx.fillText(txt,(x2+x1)*0.5 , y);
  // this.ctx.strokeStyle = "black";
  // this.ctx.strokeText(txt,x2-3, y);


  // Vertical:
  var d_vert = w;
  var x = x2;
  var y1 = y;
  var y2 = this.GetY(v-d_vert);
  // console.warn("vertical scale:",y2-y1);

  // this.ctx.beginPath();
  //
  // this.ctx.strokeStyle = "white";
  // this.ctx.fillStyle = "white";
  // this.ctx.lineWidth = 3;
  // this.ctx.moveTo(x,y1);
  // this.ctx.lineTo(x,y2);
  // this.ctx.stroke();
  // this.ctx.beginPath();
  // this.ctx.strokeStyle = "black";
  // this.ctx.fillStyle = "black";
  // this.ctx.lineWidth = 1;
  // this.ctx.moveTo(x+3,y1-3);
  // this.ctx.lineTo(x+3,y2-3);
  // this.ctx.stroke();
  
  this.ctx.restore();  
  
};


WireSpatialView.prototype.DrawImage = function(min_u,max_u,min_v,max_v,fast)
{
  var do_thumbnail = (fast);
  console.time("DrawImage");

  // console.warn("DrawImage",min_u,max_u,min_v,max_v,fast);
  // console.warn("DrawImage",this.min_u,this.max_u,this.min_v,this.max_v,fast);
  // look for offscreen canvas.
  this.show_image = $(this.ctl_wireimg_type).filter(":checked").val();  // 'cal' or 'raw'

  var mapper = null;
  
  var wname = GetSelectedName("wireimg");
  var wireimg = (((gRecord || {})["wireimg"]        || {})[wname] || {});
  var wlowres = (((gRecord || {})["wireimg-lowres"] || {})[wname] || {});
  if      (wireimg._glmapper && wireimg._glmapper.loaded) mapper = wireimg._glmapper;
  else if (wlowres._glmapper && wlowres._glmapper.loaded) mapper = wlowres._glmapper;
  
  //  // Figure out which GLMapper to query.
  // var mapper = gGLMappers[this.show_image];
  // if(!mapper || !mapper.loaded) {
  //   mapper = gGLMappers[this.show_image+'_lowres'];
  //   console.log("Getting lowres mapper");
  // }
  // if(!mapper || !mapper.loaded) return;

  if(!mapper) return;
  var scale_x = mapper.scale_x || 1;
  var scale_y = mapper.scale_y || 1;
  
  
  if(max_u<min_u) max_u = min_u; // Trap weird error
  var min_tdc     = Math.max(0,this.VtoTdc(min_v));
  var max_tdc     = Math.min(mapper.total_width*scale_x, this.VtoTdc(max_v));  
  var min_wire    = Math.max(this.UtoWire(min_u),0);
  var max_wire    = Math.min(this.UtoWire(max_u),gGeo.numWires(this.plane));
  var min_channel = gGeo.channelOfWire(this.plane, min_wire); // DUNEFIXME: need tdc or something
  var max_channel = gGeo.channelOfWire(this.plane, max_wire); // ditto
  
  // These are pixel coordinates in the 'giant map' of all wires, all tdcs.
  // Source w and h are true number of tdc spanned and true number of wires spanned respectively
  // Scaling is if the mapper is lowres.
  var source_x = (min_tdc/scale_x);
  var source_y = (min_channel/scale_y);
  var source_w = ((max_tdc-min_tdc)/scale_x);
  var source_h = ((max_channel-min_channel)/scale_y);
  
  
  // console.warn("Copy source coords:",source_x,source_y,source_w,source_h);
  // Find position and height of destination in screen coordinates. Note we'll 
  // have to rotate these for final picture insertion.
  var dest_x = (this.GetX(this.WireToU(min_wire)));
  var dest_w = (this.GetX(this.WireToU(max_wire)) - dest_x);
  var dest_y = (this.GetY(this.TdcToV(min_tdc)));
  var dest_h = (dest_y - this.GetY(this.TdcToV(max_tdc)));
  
  // The number of pixels we want is likely smaller than the true span in the giant map space.
  // When using magnifying glass, we want moar pixels
  var pixels_tdc = this.mag_scale*dest_h; // out of order!  h for source is different than h for dest.
  var pixels_wir = this.mag_scale*dest_w;

  // Ok, this is the other case, where the number of pixels we want is bigger than then giant map space.
  // If we're zoomed in so that one wire/tdc, do this:
  // We dont' need more than 1 pixel per wire, 1 pixel per tdc.
  // if(pixels_tdc>source_w) pixels_tdc = source_w;
  // if(pixels_wir>source_h) pixels_wir = source_h;

  // WebGL engine, would you kindly give us a canvas with this snapshot?
  // console.log("RequestRender", source_x,
  //    source_y,
  //    source_w,
  //    source_h,
  //    pixels_wir,
  // pixels_tdc);
  
  var result = mapper.RequestRendering(
     source_x,
     source_y,
     source_w,
     source_h,
     pixels_tdc, 
     pixels_wir
  );
  
  // Now, the above values are good, but we need to 
  // rotate our image.
  // No blur on copy!
  this.ctx.webkitImageSmoothingEnabled = false;
  this.ctx.mozImageSmoothingEnabled = false;
  this.ctx.imageSmoothingEnabled = false; /// future
  this.ctx.save();
  
  this.ctx.translate(dest_x,dest_y);
  this.ctx.rotate(-Math.PI/2);

  var rot_dest_x = 0;
  var rot_dest_y = 0;
  var rot_dest_w = dest_h;
  var rot_dest_h = dest_w;
  

  this.ctx.globalAlpha = 1.0;
   
  this.ctx.fillStyle = "rgba(100,100,100,0.5)";
  this.ctx.fillRect(rot_dest_x,rot_dest_y,rot_dest_w,rot_dest_h)

  // Copy everything we asked for, rotated, into our destination box. This is where the up-scaling happens.
  this.ctx.drawImage(
     result      // Source image.
    ,0
    ,0
    ,pixels_tdc
    ,pixels_wir
    ,rot_dest_x
    ,rot_dest_y
    ,rot_dest_w
    ,rot_dest_h
  );
   
   
  this.ctx.restore();   
  console.timeEnd('DrawImage');
};


WireSpatialView.prototype.DrawHits = function(min_u, max_u, min_v, max_v)
{
  // console.warn("DrawHits",this.plane,min_u,max_u,min_v,max_v, gHoverState.obj);
  this.fShiftRect.u1 = this.GetU(this.fShiftRect.x1);
  this.fShiftRect.u2 = this.GetU(this.fShiftRect.x2);
  this.fShiftRect.v1 = this.GetV(this.fShiftRect.y2);
  this.fShiftRect.v2 = this.GetV(this.fShiftRect.y1);
  var hoverVisHit = null;
  var h,u,v,x,dx,y,dy,c;
  
  
  // Draw the circle where hits can be summed.
  var sumRadius =  parseFloat($('#ctl-hitsum-circle-size').val()); // cm
  var doHitSum = ($('#ctl-hitsum-circle').is(':checked'));
  var track_assn = [];
  var trackname = GetSelectedName("tracks"); 
  var hitname   = GetSelectedName("hits");
  var track_assn = (((gRecord||{}).associations||{})[hitname]||{})[trackname];
  
  if( (this.fMouseInContentArea) && doHitSum ){
    this.ctx.save();
    this.ctx.setLineDash([1, 2]);
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle = "orange";
  
    this.ctx.beginPath();
    
    var wire_width_in_pixels = this.GetX(gGeo.wire_pitch)-this.GetX(0);
    var draw_hit_radius_x = this.GetX(sumRadius) - this.GetX(0);
    var draw_hit_radius_y = this.GetY(0) - this.GetY(sumRadius);
    
    this.ctx.ellipse(this.fMousePos.x,this.fMousePos.y, draw_hit_radius_x+1, draw_hit_radius_y+1,0, 0,1.9999*Math.PI,false);
    this.ctx.stroke();
    this.ctx.restore();
  }
   
  var hitsum_adc = 0;
  var hitsum_tdc = 0;
  var hitsum_n = 0;
  var hitsum_ntrk = 0;
  for(var i=0;i<this.visHits.length;i++) {
    h = this.visHits[i];
    u = h.u;
    if(u<min_u) continue;
    if(u>max_u) continue;
    v = h.v;         
    if(v<min_v) continue;
    if(v>max_v) continue;
    x = this.GetX(u);
    dx = this.GetX(u+1) - x;
    
    y = this.GetY(h.v2 );
    dy = this.GetY(h.v1) - y;    
    if(dx<1.5) dx = 1.5;  //exaggerate
    if(dy<1.5) dy = 1.5; 
    c = gHitColorScaler.GetColor(h.c);


    if(doHitSum){
      var delu = u - this.fMousePos.u;
      var delv = v - this.fMousePos.v;
      if(delu*delu/(sumRadius*sumRadius) + delv*delv/(sumRadius*sumRadius) < 1) {
        c="255,165,0"; // Draw orange.
        
        if(this.magnifying==false) {
          hitsum_adc += h.hit.q;
          hitsum_tdc += h.hit.t;
          hitsum_n += 1;
          // Is it associated with the current tracks?
          if(track_assn[h.hit._idx] && track_assn[h.hit._idx].length>0)
              hitsum_ntrk += 1;
        }
      }
    }
    

    if(h.hit.saveselection)      c="10,10,10";
    if(this.fShiftSelecting && ((h.u >= this.fShiftRect.u1) && (h.u < this.fShiftRect.u2) && (h.v >= this.fShiftRect.v1) && (h.v < this.fShiftRect.v2))) {
        c="10,10,10";
    }
    
    this.ctx.fillStyle = "rgb(" + c + ")";
    this.ctx.fillRect(x,y,dx,dy);      

  
    if(gHoverState.obj == h.hit) hoverVisHit = h;
    this.mouseable.push({type:"hit", coords:[[x,y],[x,y+dy]], r:dx, obj: h.hit});
  }
  
  if(hoverVisHit) {
    // console.warn("hoverhit!",hoverVisHit);
      h = hoverVisHit;
      u = h.u;
      v = h.v;         
      x = this.GetX(u);
      dx = this.GetX(u) - x;
    
      y = this.GetY(h.v2);
      dy = this.GetY(h.v1) - y;    
      if(dx<1.5) dx = 1.5;  //exaggerate
      if(dy<1.5) dy = 1.5; 
      
      c = gHitColorScaler.GetColor(h.c);
      console.log("color",gHitColorScaler,c);
      this.ctx.fillStyle = "black";

      this.ctx.fillStyle = "rgb(" + c + ")";
      this.ctx.fillRect(x,y,dx,dy);      
      
      // // Hovering this hit.
      this.ctx.strokeStyle = "black";
      var w = 1.5;
      this.ctx.lineWidth = w;
      this.ctx.strokeRect(x-w,y-w,dx+2*w,dy+2*w);         
      
    }
    
    if( this.fMouseInContentArea && doHitSum  && !this.magnifying ){
      // put the marker on.
      console.log('hitsum',hitsum);
      var offset = getAbsolutePosition(this.element);
      var x = this.GetX(this.fMousePos.u + sumRadius ) + offset.x;
      var y = this.GetY(this.fMousePos.v - sumRadius ) + offset.y;
      var txt = "";
      if(hitsum_n>0) txt = "<table>"
        + "<tr><td>" + hitsum_n  +"</td><td>hits</td></tr>"
        + "<tr><td>" + hitsum_ntrk +"</td><td>trk hits</td></tr>"
        + "<tr><td>" + (hitsum_adc/hitsum_n).toFixed(1) +"</td><td>avg ADC</td></tr>"
        + "<tr><td>" +(hitsum_tdc/hitsum_n).toFixed(1) +"</td><td>avg TDC</td></tr>"
        + "<tr><td>" + hitsum_adc +"</td><td>tot ADC</td></tr>"
        + "</table>";
      $('#hitsum').css({
        position: 'absolute',
        zIndex : 2000,
        left: x, top: y,
        'background-color': 'white'
      }).show().find('.hitsumtext').html(txt).mySelectContents();
    }
};

WireSpatialView.prototype.DrawClusters = function(min_u,max_u,min_v,max_v,fast)
{
  var clusters = GetSelected("clusters");
  if(clusters.length==0) return;
  var clustername = GetSelectedName("clusters");
  
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

  this.clusterHulls = [];
  var   offset_hit_time = 0;
  if($('#ctl-shift-hits').is(":checked")) offset_hit_time = parseFloat( $('#ctl-shift-hits-value').val() );
  
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
        points.push( [ this.GetX(this.WireToU(h.wire)), this.GetY(this.TdcToV(h.t + offset_hit_time) ) ] );        
      } else {
        continue clusterLoop;  // Give up on this cluster; go to the next one.
      }
    }
    var hull = GeoUtils.convexHull(points);
    var poly = [];
    for(var ihull=0;ihull<hull.length;ihull++) {
      poly.push(hull[ihull][0]);
    }
    
    this.mouseable.push({ obj: clus, type: "cluster", coords: poly });
    
    cs = new ColorScaleIndexed(i+1);    
    this.ctx.fillStyle = "rgba("+cs.GetColor()+", 0.5)";
    this.ctx.beginPath();
    this.ctx.moveTo(poly[poly.length-1][0],poly[poly.length-1][1]);
    for(var ipoly=0;ipoly<poly.length;ipoly++) {
      this.ctx.lineTo(poly[ipoly][0]
                     ,poly[ipoly][1] );
    }
    this.ctx.fill();
    if(gHoverState.obj == clus) {
      this.ctx.fillStyle = "rgba(255, 165, 0, 0.8)";
      this.ctx.strokeStyle = "black";
      this.ctx.stroke();
    }
    
  }
};

WireSpatialView.prototype.DrawEndpoint2d = function(min_u,max_u,min_v,max_v,fast)
{
  if(!gRecord.endpoint2d) return;
  if(!gRecord.endpoint2d.length) return;
  var endpoints = GetSelected("endpoint2d");
  for(var i=0;i<endpoints.length;i++) {
      var pt = endpoints[i];
      pt._index = i;
      if(pt.plane != this.plane) continue;
      
      var u = this.WireToU(pt.wire);
      var v = this.TpcToV(pt.t);
      var x = this.GetX(u);
      var y = this.GetY(v);
      var r = 6;
      this.ctx.fillStyle = "orange";
      this.ctx.beginPath();
      this.ctx.arc(x,y,r,0,1.99*Math.PI);
      this.ctx.closePath();
      this.ctx.fill();
      this.mouseable.push({type:"endpoint2d", coords:[[x,y]], r:r, obj: pt});

      if(gHoverState.obj == pt) {
        console.warn("Endpoint selected",gHoverState.obj);
        this.ctx.fillStyle = "rgba(255, 165, 0, 0.8)";
        this.ctx.strokeStyle = "black";
        this.ctx.linewidth = 3;
        this.ctx.stroke();
      }
  }
};



WireSpatialView.prototype.DrawSpacepoints = function(min_u,max_u,min_v,max_v,fast)
{
  var sps = GetSelected("spacepoints");
  this.ctx.save();
  for(var i = 0; i<sps.length;i++) {
    var sp = sps[i];
    sp._index = i;
    this.ctx.fillStyle = "rgba(0, 150, 150, 1)";
    this.ctx.strokeStyle = "rgba(0, 150, 150, 1)";
    this.ctx.lineWidth = 1;
    var u = gGeo.yzToTransverse(this.plane,sp.xyz[1],sp.xyz[2]);
    var v = sp.xyz[0];// FIXME: Only true for beam MC events!
    var ru = 1; // one wire.
    // if(i<5) console.warn("spacepoint plane",this.plane,u,v,ru);
    var x = this.GetX(u);
    var y = this.GetY(v);
    var r = this.GetX(u+ru) - x;
    this.ctx.beginPath();
    this.ctx.arc(x,y,r,0,2*Math.PI);
    // if(i<5) console.warn("spacepoint plane",this.plane,x,y,r,0,2*Math.Pi);
    
    if(gHoverState.obj == sp) {
      this.ctx.arc(x,y,r*5,0,2*Math.PI);      
    }
    
    this.ctx.fill();
    if(r>4) this.ctx.strokeStyle="black"; // Dots are big enough that showing the outline is worth it.
    // Accidental visual cleverness: if the radius of the circle is too small to see,
    // this will blow it up to ~2 pixels, the line width of the circle!
    this.ctx.stroke();
    
    
    this.mouseable.push({type:"sp", coords:[[x,y]], r:ru, obj: sp});
    
    
  }
  this.ctx.restore();
};

WireSpatialView.prototype.DrawTracks = function(min_u,max_u,min_v,max_v,fast)
{
  var tracklistname = GetSelectedName("tracks");
  if(!tracklistname) return;

  this.offset_track_ticks = 0;
  if(this.ctl_track_shift.prop("checked")) this.offset_track_ticks = parseInt(this.ctl_track_shift_value.val());

  // var bezier = tracklistname.match(/bezier/)!==null;
  // if(bezier) { return this.DrawBezierTracks(min_u,max_u,min_v,max_v,fast); }
  var tracks = gRecord.tracks[tracklistname];
  if(!tracks) return;

  this.ctx.save();
  for(var i=0;i<tracks.length;i++)
  {
    var trk = tracks[i];
    trk._index = i;
    var points = trk.points;
    if(!points || points.length<2) continue;
    // compile points
    var pts = [];
    var lastx = -1e9, lasty=-1e9;
    for(var j=0;j<points.length;j++) {
      var u = gGeo.yzToTransverse(this.plane,points[j].y, points[j].z) - this.wire_shift[this.plane];
      var v = points[j].x + this.TdcToV(this.offset_track_ticks); 
      // if(u<min_u) continue;
      // if(u>max_u) continue;
      // if(v<min_v) continue;
      // if(v>max_v) continue;
      var coords = [this.GetX(u), this.GetY(v)];
      if(Math.abs(coords[0]-lastx) < 2 && Math.abs(coords[1]-lasty) < 2) continue;
      pts.push(coords);      
    }
    if(pts.length<=2) continue;
    this.ctx.strokeStyle = this.track_color;
    this.ctx.lineWidth = 2;
    
    // Draw underlay
    // Draw underlay for a selected track.
    if(gSelectState.obj && (gSelectState.obj == trk)){      
      if(this.fMouseInContentArea) {
        var offset = getAbsolutePosition(this.canvas);
        var lastpt = pts[pts.length-1];
        SetOverlayPosition(offset.x + lastpt[0], offset.y + lastpt[1]);  
      }

      this.ctx.lineWidth = 5;
      this.ctx.strokeStyle = "rgba(0,0,0,0.8)";
      this.ctx.beginPath();
      this.ctx.moveTo(pts[0][0],pts[0][1]);
      for(j=1;j<pts.length;j++) this.ctx.lineTo(pts[j][0],pts[j][1]);
      this.ctx.stroke();
      this.ctx.lineWidth =2;
      this.ctx.strokeStyle = "rgba(255,20,20,1)";
      
    }
  
    if(gHoverState.obj && (gHoverState.obj == trk)){ // hovering
      this.ctx.strokeStyle = "rgba(255,20,20,1)";
    }
        
    // Draw it.
    this.ctx.beginPath();
    this.ctx.moveTo(pts[0][0],pts[0][1]);
    for(j=1;j<pts.length;j++) this.ctx.lineTo(pts[j][0],pts[j][1]);
    this.ctx.stroke();
    this.ctx.fillStyle=this.ctx.strokeStyle;
    //for(j=1;j<pts.length;j++) {
      //this.ctx.beginPath();
      //this.ctx.arc(pts[j][0],pts[j][1],1.5,0,2*Math.PI,false);
      //this.ctx.stroke();
    //}

    // for mouseovering
    for(j=1;j<pts.length;j++) 
      this.mouseable.push({type:"track", 
                          coords: [[pts[j-1][0],pts[j-1][1]],
                                   [pts[j][0]  ,pts[j][1]  ] 
                                  ], 
                          r:this.ctx.lineWidth, obj: trk});

    this.ctx.stroke();
  }
  this.ctx.restore();
};

WireSpatialView.prototype.DrawShowers = function(min_u,max_u,min_v,max_v,fast)
{
  var showerlistname = GetSelectedName("showers");
  var showers = GetSelected("showers");
  if(showers.length==0) return;

  // find gRecord.associations.showername.recob::Hitsthingthing
  var showerass = null;
  var showerhitname = null;
  var hitlist = null;
  var hitassn = null;
  if(gRecord.associations) showerass = gRecord.associations[showerlistname];
  if(showerass) {
    for( var n in showerass ) {
        if( n.indexOf( "::Hits" ) > -1 ) { showerhitname = n; }
      }
    if(showerhitname) {
      hitassn = showerass[n]
      hitlist = gRecord.hits[showerhitname];
    }
  }
  if(!showerhitname)  {
    $('#status').attr('class', 'status-warning');
    $("#status").text('Need to load associations to see showers.');    
  }
  if(!hitlist) {
    $('#status').attr('class', 'status-warning');
    $("#status").text('Need to load hit list '+showerhitname+' to see showers.');    
    
  }


  this.ctx.save();
  for(var i=0;i<showers.length;i++)
  {
    var shw = showers[i];
    shw._index = i;


    if(hitlist && hitassn && !shw._hpts ) { shw._hpts = []; }
    if(hitlist && hitassn && !shw._hpts[this.plane] ) {    
      shw._hpts[this.plane] = [];
      for(var ihit=0;ihit<hitassn[shw._index].length;ihit++){
        var hit = hitlist[ hitassn[shw._index][ihit] ];
        if(hit.plane == this.plane) {
          shw._hpts[this.plane].push(hit);
        }
      }
    }

    // // Convex hull
    // if(hitlist && hitassn && !shw._hull ) { shw._hull =[] };
    // if(hitlist && hitassn && !shw._hull[this.plane] ) {
    //   var pts = [];
    //   for(var ihit=0;ihit<hitassn[shw._index].length;ihit++){
    //     var hit = hitlist[ hitassn[shw._index][ihit] ];
    //     if(hit.plane == this.plane) {
    //       pts.push([hit.wire,hit.t]);
    //     }
    //   }
    //   shw._hull[this.plane]  = GeoUtils.convexHull(pts);
    // }
    //
    // // Draw hull:
    // if(shw._hull && shw._hull[this.plane]) {
    //   var hull = shw._hull[this.plane];
    //   this.ctx.beginPath();
    //   this.ctx.moveTo(this.GetX(hull[0][0][0]),this.GetY(hull[0][0][1]));
    //   for(var ipt=1;ipt<hull.length;ipt++) {
    //     this.ctx.lineTo(this.GetX(hull[ipt][1][0]),this.GetY(hull[ipt][1][1]));
    //   }
    //   this.ctx.fillStyle = "rgba(255,92,0,0.5)";
    //   this.ctx.fill();
    // }

    if(shw._hpts && shw._hpts[this.plane]) {
      this.ctx.beginPath();
      var pts = shw._hpts[this.plane];
      for(var ipt=0;ipt<pts.length;ipt++) {
        this.ctx.beginPath();
        //this.ctx.fillStyle = 'orange';
        var c = new ColorScaleIndexed(i+3).GetColor();
        this.ctx.fillStyle = "rgb("+c+")";
        var r = Math.sqrt(pts[ipt].q)/10;
        this.ctx.arc(this.GetX(this.WireToU(pts[ipt].wire)),this.GetY(this.TdcToV(pts[ipt].t)), r, 0,1.99*Math.PI) ;
        this.ctx.fill();
      }
    }



    // Draw the vector
    
    var u1 = gGeo.yzToTransverse(this.plane,  shw.start.y, shw.start.z);
    var v1 = shw.start.x + this.TdcToU(this.offset_track_ticks);
    var u2 = gGeo.yzToTransverse(this.plane, shw.Length * shw.dir.y + shw.start.y, 
                                             shw.Length * shw.dir.z + shw.start.z);
    var v2 = shw.Length * shw.dir.x + shw.start.x + this.TdcToU(this.offset_track_ticks);
    
    var x1 = this.GetX(u1);
    var y1 = this.GetY(v1);
    var x2 = this.GetX(u2);
    var y2 = this.GetY(v2);
    
    this.ctx.strokeStyle = "rgba(255, 28, 28, 1)";
    this.ctx.lineWidth = 2;
    
    // Draw underlay
    // Draw underlay for a selected shower.
    if(gSelectState.obj && (gSelectState.obj == shw)){      
      if(this.fMouseInContentArea) {
        var offset = getAbsolutePosition(this.canvas);
        SetOverlayPosition(offset.x + x2, offset.y + y2);  
      }

      this.ctx.lineWidth = 5;
      this.ctx.strokeStyle = "rgba(0,0,0,0.8)";
      this.ctx.beginPath();
      this.ctx.moveTo(x1,y1);
      this.ctx.lineTo(x2,y2);
      this.ctx.stroke();
      this.ctx.lineWidth =2;
      this.ctx.strokeStyle = "rgba(255,20,20,1)";    
    }
  
    if(gHoverState.obj && (gHoverState.obj == shw)){ // hovering
      this.ctx.strokeStyle = "rgba(255,20,20,1)";
    }
        
    // Draw it.
    this.ctx.beginPath();
    this.ctx.arc(x1,y1,6,0,1.99*Math.PI);
    
    this.ctx.moveTo(x1,y1);
    this.ctx.lineTo(x2,y2);
    this.ctx.stroke();
    

    // for mouseovering
      this.mouseable.push({type:"shower", 
                    coords: [[x1,y1],
                             [x2,y2] 
                            ], 
                    r:this.ctx.lineWidth, obj: shw});


  }
  this.ctx.restore();
};



WireSpatialView.prototype.DetectorXyzToScreenXY = function(x,y,z)
{
    return [
      this.GetX( gGeo.yzToTransverse( this.plane,y,z) ),
      this.GetY( this.plane,x + this.TdcToV(this.offset_track_ticks) )
      ];
}



WireSpatialView.prototype.DrawMC = function(min_u,max_u,min_v,max_v,fast)
{  
  var particles = GetSelected("mcparticles");
  if(particles.length==0) return;
  var show_neutrals = $(this.ctl_show_mc_neutrals).is(":checked");
  var move_t0 =  $(this.ctl_mc_move_tzero).is(":checked");
  if(move_t0) console.warn('moving mc t0');
  
  // console.warn("Drawing MC",particles.length);
  for(var i=0;i<particles.length;i++)
  {
    var p= particles[i];
    if(!p.trajectory || p.trajectory.length===0) continue;

    // compile points
    var pts = [];
    var t0 = 3200; // FIXME only good for microboone MC
    if(move_t0 && p.trajectory.length>0) t0 = 3200+ p.trajectory[0].t/500.0; // 500 ns per tick.
    
    for(var j=0;j<p.trajectory.length;j++) {
      var point = p.trajectory[j];
      // Convert particle X coordinate to TDC value.
      var v = point.x + this.TdcToV(t0);
      // Convert YZ into wire number.
      var u = gGeo.yzToTransverse(this.plane,point.y,point.z);
      var x = this.GetX(u);
      var y = this.GetY(v);
      // This clips out track segments.
      // if(x>=0 && x<this.width && y>=0 && y<=this.height)
      pts.push([x,y]);
    }
    if(pts.length<2) continue;
    
    this.ctx.lineWidth =1;
    this.ctx.strokeStyle ="rgba(0,0,255,0.5)";

    // Draw underlay for a selected track.
    if(gSelectState.obj && (gSelectState.obj.ftrackId == p.ftrackId)){      
      if(this.fMouseInContentArea) {
        var offset = getAbsolutePosition(this.canvas);
        var lastpt = pts[pts.length-1];
        SetOverlayPosition(offset.x + lastpt[0], offset.y + lastpt[1]);  
      }
      
      this.ctx.lineWidth = 4;
      this.ctx.strokeStyle = "rgba(0,0,0,0.8)";
      this.ctx.beginPath();
      this.ctx.moveTo(pts[0][0],pts[0][1]);
      for(j=1;j<pts.length;j++) this.ctx.lineTo(pts[j][0],pts[j][1]);
      this.ctx.stroke();
      this.ctx.lineWidth =2;
      this.ctx.strokeStyle = "rgba(255,20,20,1)";
      
    }

    // is it an annoying neutral particle?
    var pdg = Math.abs(p.fpdgCode);
    // Note direct object compare doesn't work with MCDigraph. Don't know why; spacetree must clone instead of link objects.
    if(gHoverState.obj && (gHoverState.obj.ftrackId == p.ftrackId)){ // hovering
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = "rgba(255,20,20,1)";
      if(this.fMouseInContentArea) {
        var offset = getAbsolutePosition(this.canvas);
        var lastpt = pts[pts.length-1];
        SetOverlayPosition(offset.x + lastpt[0], offset.y + lastpt[1]);  
      }      
    } else if(pdg == 22 || pdg == 2112 || pdg == 12 || pdg == 14 || pdg == 16) {
      // Make them grey
      if(show_neutrals) this.ctx.strokeStyle ="rgba(200,200,200,0.5)";    
      else continue;  // Or skip 'em.
    }
  
    // Draw main track.
    this.ctx.beginPath();
    this.ctx.moveTo(pts[0][0],pts[0][1]);
    for(j=1;j<pts.length;j++) { this.ctx.lineTo(pts[j][0],pts[j][1]);  }
    this.ctx.stroke();
    
    
    // for mouseovering
    for(j=1;j<pts.length;j++) 
      this.mouseable.push({type:"mcparticle",
                           coords: [[pts[j-1][0],pts[j-1][1]], [pts[j][0],pts[j][1]] ],
                           r:this.ctx.lineWidth, obj: p});
  
  
  }
};

WireSpatialView.prototype.DrawdEdXPath = function(min_u,max_u,min_v,max_v,fast)
{
  // Drawing the dEdX path.
  if(!gUserTrack) return;
  if(!gUserTrack.points.length) return;
  
  this.ctx.lineWidth = 2;

  var pt, pt2;
  for(var i=0;i<gUserTrack.points.length; i++) {
    pt = gUserTrack.points[i];
    this.ctx.fillStyle = "rgba(40,92,0,0.5)";
    this.ctx.strokeStyle = "rgb(40,92,0)";
    var r = 5; // 5 pixel radius handle

    // draw handles.
    if(gHoverState.obj == pt) this.ctx.strokeStyle = "FF0000";
    var x = this.GetX(this.WireToU(pt[this.plane]));
    var y = this.GetY(this.TdcToV(pt.tdc));
    this.ctx.beginPath();
    this.ctx.arc(x,y,r,0,Math.PI*1.99,false);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();
    this.mouseable.push({type:"UserTrack",
                        coords: [[x,y]],  r:r+this.ctx.lineWidth, obj: pt});
    
  }


  this.ctx.strokeStyle = "rgb(40,92,0)";

  for(i=0;i<gUserTrack.points.length-1; i++) {
    pt = gUserTrack.points[i];
    pt2 = gUserTrack.points[i+1];
    this.ctx.beginPath();    
    this.ctx.moveTo(this.GetX(pt[this.plane]), this.GetY(pt.tdc - pt.r));
    this.ctx.lineTo(this.GetX(pt[this.plane]), this.GetY(pt.tdc + pt.r));
    this.ctx.lineTo(this.GetX(pt2[this.plane]), this.GetY(pt2.tdc + pt2.r));
    this.ctx.lineTo(this.GetX(pt2[this.plane]), this.GetY(pt2.tdc - pt2.r));
    this.ctx.closePath();
    this.ctx.fill();
  }

};


WireSpatialView.prototype.DrawPmts = function()
{
    // var ophits = GetSelected("ophits")
    //
    // this.ctx.save();
    // ophits.sort(function(a,b){return a[gOpMode.hitVariable]>b[gOpMode.hitVariable]; });
    // for(var i=0;i<ophits.length;i++) {
    //   // find projection position of PMT in horizontal position for this view.
    //   var ophit = ophits[i];
    //
    //   var det = gGeo.opDets.OpDetByChannel(ophit.opDetChan);
    //   if(!det) continue;
    //   var u = gGeo.yzToWire(this.plane,det.y, det.z) - this.wire_shift[this.plane];
    //
    //   if(u<this.min_u || u>this.max_u) continue;
    //   // viewport coordinates
    //   var x=this.GetX(u);
    //   var dx=this.GetX(u+15.2) - x;
    //   var y=this.height;
    //   x += det.y/20;
    //
    //   // Timing.
    //   // is this PMT consistent with ANY time in this view, or ALL times in this view?
    //   var t1 = (this.min_v-3200)/2; // 2 MHz ticks - convert to  us
    //   var t2 = (this.max_v-3200)/2;
    //   var td = 128.175*2 / gGeo.drift_cm_per_tick /2; // Drift time
    //   var tpmt = ophit.peakTime*1e-3; // us
    //   var could_any = ((tpmt < t2) && (tpmt>t1-td));
    //   var could_all = ((tpmt < t1) && (tpmt>t2-td));
    //
    //   // color
    //   var w = ophit[gOpMode.hitVariable]*gOpMode.hitVariableScale;
    //   if(w<10) continue;
    //   if(w<gOpMode.cut.min) continue;
    //   if(w>gOpMode.cut.max) continue;
    //   var c = gOpColorScaler.GetColor(w);
    //   // console.log(tpmt,t1,t2,td);
    //
    //
    //   // console.log("wirehit",det.y,det.z,this.wire_shift[this.plane],gGeo.yzToWire(det.y, det.z),u,x,y);
    //   this.ctx.strokeStyle="black";
    //   var alpha = 0.1
    //   if(could_any) alpha = 0.5;
    //   if(could_all) alpha = 0.9;
    //   this.ctx.fillStyle = "rgba(" + c + "," + alpha + ")";
    //   // console.log("dx",dx);
    //   this.ctx.beginPath();
    //   this.ctx.moveTo(x,y);
    //   this.ctx.lineTo(x-dx,y-10);
    //   this.ctx.arcTo(x,y-14, x+dx,y-10, 20);
    //   this.ctx.lineTo(x+dx,y-10);
    //   this.ctx.lineTo(x,y);
    //   this.ctx.closePath();
    //   if(could_all) this.ctx.stroke();
    //   this.ctx.fill();
    //
    //   //this.AddArcYZ(det.x,det.y,det.z,15.2,20,0,Math.PI*2,1,curColor,hov);
    // }
    // this.ctx.restore();
}




WireSpatialView.prototype.DrawShiftRect = function(min_u,max_u,min_v,max_v,fast)
{
  this.ctx.strokeStyle = "black";
  this.ctx.lineWidth = 1;
  this.ctx.beginPath();
  this.ctx.moveTo(this.fShiftRect.x1,this.fShiftRect.y1);
  this.ctx.lineTo(this.fShiftRect.x1,this.fShiftRect.y2);
  this.ctx.lineTo(this.fShiftRect.x2,this.fShiftRect.y2);
  this.ctx.lineTo(this.fShiftRect.x2,this.fShiftRect.y1);
  this.ctx.lineTo(this.fShiftRect.x1,this.fShiftRect.y1);
  this.ctx.closePath();
  if(this.ctx.setLineDash) this.ctx.setLineDash([2,3]);
  this.ctx.stroke();
  if(this.ctx.setLineDash) this.ctx.setLineDash([]);
  
};

////////////////////////////////////////////////////////////////////////////////////////
// Mouse
////////////////////////////////////////////////////////////////////////////////////////


WireSpatialView.prototype.DoMouse = function(ev)
{
  ///
  /// Called by ::Pad for any mouse event that might be relevant,
  /// including mousemove, mousedown, click in the element
  /// and mousee move, up outside.
  if(this.zooming && !ev.shiftKey && gHoverState.type!=="UserTrack" ) this.DoMousePanAndScale(ev);
  if(ev.type === 'mouseup') {
    if( this.fObjectDragging ) {
      this.fObjectDragging = false;
      gStateMachine.Trigger("userTrackChange");
    }
    if( this.fShiftSelecting ) {
      this.fShiftSelecting = false;
      this.fShiftRect.u1 = this.GetU(this.fShiftRect.x1);
      this.fShiftRect.u2 = this.GetU(this.fShiftRect.x2);
      this.fShiftRect.v1 = this.GetV(this.fShiftRect.y2);
      this.fShiftRect.v2 = this.GetV(this.fShiftRect.y1);
      for(var i=0;i<this.visHits.length;i++) {
        var h = this.visHits[i];
        if((h.u >= this.fShiftRect.u1) && (h.u < this.fShiftRect.u2) && (h.v >= this.fShiftRect.v1) && (h.v < this.fShiftRect.v2)) {
          gSaveSelection.AddHit(h.hit);
        }
      }
    }
    return;
  }

  ev.originalEvent.preventDefault();
  if(this.fObjectDragging) {

    // Only user track is current thing.
    if(gHoverState.type=="UserTrack") {
      var newWire = this.fMousePos.u;
      var newTdc  = this.fMousePos.v;
      gHoverState.obj.set_view(this.plane,newWire,newTdc);

    }

  } else if(this.fShiftSelecting) {
      this.fShiftRect.x1 = Math.min(this.fMouseStart.x, this.fMousePos.x);
      this.fShiftRect.x2 = Math.max(this.fMouseStart.x, this.fMousePos.x);
      this.fShiftRect.y1 = Math.min(this.fMouseStart.y, this.fMousePos.y);
      this.fShiftRect.y2 = Math.max(this.fMouseStart.y, this.fMousePos.y);

  } else {
    // Regular mouse move.
    if(this.fMouseInContentArea) {
      // Find the first good match
      var match = this.FindMouseableMatch();
      if(ev.type=='click'){
        if (ev.shiftKey) {
          if(match.type=="hit") {
            if(match.obj.saveselection) {
              // deselect
              gSaveSelection.RemoveHit(match.obj);
            } else {
              // select
              gSaveSelection.AddHit(match.obj);
            }
          }
        } else {
          ChangeSelection(match);
        }
      } else { // not a click, but a mousemove.
        // mousemove.
        // add hover coordinates.
        match.channel = gGeo.channelOfWire(this.plane,this.fMousePos.u);
        match.sample  = this.fMousePos.v;
        if(!match.obj) match.obj = match.channel + "|" + match.sample;
        ChangeHover(match); // match might be null.
      }
    }
  }

  if(ev.type === 'mousedown' && this.fMouseInContentArea) {
     if (ev.shiftKey) {
      this.fShiftSelecting=true;
    } else if(gHoverState.type=="UserTrack") {
      this.fObjectDragging = true;
    }
  }  
};

WireSpatialView.prototype.MouseChangedUV = function( new_limits, finished ) 
{
  // Override this function to do things when the limits change.
  // example newlimits = { min_v: 90, max_v: 45  } means u coordinates haven't changed, but min and max have
  // 'finished' is true if user has finished dragging the mouse and the mouseup has fired; otherwise she's in the middle of a drag operation.

  if('min_v' in new_limits || 'max_v' in new_limits){
    var minv = this.min_v;
    var maxv = this.max_v;
    if('min_v' in new_limits) minv = new_limits.min_v;
    if('max_v' in new_limits) maxv = new_limits.max_v;
    gZoomRegion.changeTimeRange(this.VtoTdc(minv),this.VtoTdc(maxv));
  }
  if('min_u' in new_limits || 'max_u' in new_limits) {
    var minu = this.min_u;
    var maxu = this.max_u;
    if('min_u' in new_limits) minu = new_limits.min_u;
    if('max_u' in new_limits) maxu = new_limits.max_u;
    gZoomRegion.setLimits(this.plane,this.UtoWire(minu),this.UtoWire(maxu));
  }
  if(finished) {
    gStateMachine.Trigger("zoomChange");
  } else {
    gStateMachine.Trigger("zoomChangeFast");
    // this.Draw();
  }
}


WireSpatialView.prototype.FindMouseableMatch = function() 
{

  for(var i =this.mouseable.length-1 ; i>=0; i--) {
    var m = this.mouseable[i];
    if(m.coords.length==1) {
      // is just a point.
      var dx = m.coords[0][0] - this.fMousePos.x;
      var dy = m.coords[0][1] - this.fMousePos.y;
      if( (dx*dx + dy*dy) < (m.r*m.r) ) { return m; }
    } else if (m.coords.length==2) {
      // it's a line
      if  (GeoUtils.line_is_close_to_point(
                      this.fMousePos.x,this.fMousePos.y, 
                      m.coords[0][0], m.coords[0][1], m.coords[1][0], m.coords[1][1],
                      m.r) ) {
                        return m;                        
                      }
    } else {
      //polygon
      if(GeoUtils.is_point_in_polygon([this.fMousePos.x,this.fMousePos.y],m.coords)) {
        return m;
      }
    }
  }
  return  {obj: null, type:"wire"}; // by default, it's a wire.

};


WireSpatialView.prototype.DoMouseWheel = function(ev,dist)
{
  // Zoom in/out around the mouse.
  if(!ev.ctrlKey) {return true;}
  if(this.fMouseInContentArea) {
    var frac_x = (this.fMousePos.x - this.origin_x) / this.span_x;
    var frac_y = (this.origin_y - this.fMousePos.y ) / this.span_y;

    var scale = 1 ;
    if(dist<0) scale = 1.05;
    if(dist>0) scale = 0.95;
    var new_u_min = this.fMousePos.u*(1.0-scale) + this.min_u*scale;
    var new_u_max = (this.max_u-this.min_u)*scale + new_u_min;

    var new_v_min = this.fMousePos.v*(1.0-scale) + this.min_v*scale;
    var new_v_max = (this.max_v-this.min_v)*scale + new_v_min;
    
    gZoomRegion.setLimits(this.plane,this.UtoWire(new_u_min), this.UtoWire(new_u_max));
    gZoomRegion.changeTimeRange(this.VtoTdc(new_v_min), this.VtoTdc(new_v_max));
    
    // console.warn("DoMouseWheel",this.fMousePos.u,ev,dist,this.min_u,new_u_min,this.max_u,new_u_max);
    gStateMachine.Trigger("zoomChange"); 
   
    return false;
    
  }
  return true;
};


