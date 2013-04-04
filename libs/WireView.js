// Subclass of Pad.
WireView.prototype = new Pad;           

gWireViews = [];
// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-WireView').each(function(){
    var o = new WireView(this);
    gWireViews.push(o);
    // console.log("Creating WireView ",o);
  });  
});


/// Utility function: ClosestMatch
/// Find a DOM element matching the selector that has the closest common ancestor
/// to the given element.

function ClosestMatch( element, selector )
{
  var parents = $(element).parents();
  for(var i = 0; i<parents.length; i++) {
    var got = $(selector,parents[i]);
    if(got.length>0) return got.first();
  }
  // no match.
  return null;
}

function GetLocalControl( element, selector )
{
  // Is there one in our portlet?
  var p = $(element).closest('.portlet')
  if(p.length>0) {
    var c = $(selector,p.first());
    return c;
  }
  return $();
}

function GetBestControl( element, selector )
{
  var c = GetLocalControl(element,selector);
  if(c.length>0) return c;
  c = $(selector,$('#config-port'));
  if(c.length>0) return c;
  return ClosestMatch(element,selector);
}

function WireView( element, options )
{
  if(!element) {
    return;
  }
  if($(element).length<1) { 
    return;
  }
  
  var settings = {
    plane: 0, // default, override this
    margin_bottom : 40,
    margin_top    : 5,
    margin_right  : 5,
    margin_left   : 30,
    xlabel : "Wire",
    ylabel : "TDC",
    zooming: true, // set false to lock view on starting coordinates
    tick_pixels_x: 50,
    tick_pixels_y: 30,
    show_image:   false, // can be false, 'raw', or 'cal'
    show_hits:    false,
    show_mc:      true,
    show_blackout:true, // black in regions which aren't instrumented
  };
  $.extend(true,settings,options);  // Change default settings by provided qualities.
  Pad.call(this, element, settings); // Give settings to Pad contructor.
  
  
  var self = this;
  
  this.fMousing = false;
  this.fDragging = false;
  this.hasContent = false;
  this.myHits = [];
  this.visHits = [];
  
  this.loaded_wireimg = false;
  this.loaded_thumbnail = false;
  
  $(this.element).bind('mousemove',function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('mousedown',function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('mouseout' ,function(ev) { return self.DoMouse(ev); });
  $(document    ).bind('mouseup' ,function(ev) { return self.DoMouse(ev); });

  $(this.element).bind('touchstart' ,function(ev) { return self.DoMouse(ev); });
  $(this.element).bind('touchmove' ,function(ev) {  return self.DoMouse(ev); });
  $(this.element).bind('touchend' ,function(ev) { return self.DoMouse(ev); });

  $(this.element).bind('resize' ,function(ev) { if(self.hasContent == false) self.NewRecord(); });
  
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  gStateMachine.BindObj('TimeCutChange',this,"Draw");
  gStateMachine.BindObj('hoverChange_mcparticle',this,"Draw");
  
  gStateMachine.BindObj('phCutChange',this,"TrimHits");
  gStateMachine.BindObj('timeCutChange',this,"TrimHits");
  
  if(this.zooming) gStateMachine.BindObj('zoomChange',this,"Draw");
  if(this.zooming) gStateMachine.BindObj('zoomChangeFast',this,"DrawFast");
 
  this.ctl_show_hits    =  GetBestControl(this.element,".show-hits");
  this.ctl_show_wireimg =  GetBestControl(this.element,".show-wireimg");
  this.ctl_show_clus    =  GetBestControl(this.element,".show-clus");
  this.ctl_show_spoints =  GetBestControl(this.element,".show-spoints");
  this.ctl_show_tracks  =  GetBestControl(this.element,".show-tracks");
  this.ctl_show_mc      =  GetBestControl(this.element,".show-mc");
  this.ctl_wireimg_type =  GetBestControl(this.element,"[name=show-wireimg-type]");

  $(this.ctl_show_hits   ).change(function(ev) { return self.Draw(false); });
  $(this.ctl_show_wireimg).change(function(ev) { return self.Draw(false); });
  $(this.ctl_show_clus)   .change(function(ev) { return self.Draw(false); });
  $(this.ctl_show_spoints).change(function(ev) { return self.Draw(false); });
  $(this.ctl_show_tracks) .change(function(ev) { return self.Draw(false); });
  $(this.ctl_show_mc     ).change(function(ev) { return self.Draw(false); });
  $(this.ctl_wireimg_type).click(function(ev) { return self.NewRecord(); });

  // Flip planes control (for big wireview
  this.ctl_plane = GetLocalControl(this.element,"[name=wireview-select]");
  this.ctl_plane.click(function(ev) { 
    self.plane = parseInt( $(self.ctl_plane).filter(":checked").val() );
    console.warn("changing plane",self,$(this.ctl_plane).filter(":checked").val(),self.plane);
    
    return self.NewRecord(); 
  });
}

WireView.prototype.Resize = function()
{
  Pad.prototype.Resize.call(this);
  gZoomRegion.wireview_aspect_ratio = this.span_y/this.span_x;
}


WireView.prototype.NewRecord = function()
{
  //
  // called on new record available.
  //
  if(!gRecord) return;
  this.NewRecord_hits();
  this.NewRecord_image();
  this.NewRecord_mc();
}

WireView.prototype.NewRecord_hits = function()
{
  this.myHits = [];
  this.visHits = [];
  this.hasContent = false;
  
  // Go through gHits, and find hits that match our view.
  for(var i=0;i<gHits.length;i++) {
    if(gHits[i].plane == this.plane) this.myHits.push(gHits[i]);
  }
  this.TrimHits();
}

WireView.prototype.NewRecord_image = function()
{
  this.loaded_wireimg = false;
  this.loaded_thumbnail = false;
  
  // Build offscreen image(s)
  this.wireimg = new Image();
  this.wireimg_thumb = new Image();
  
  this.show_image = $(this.ctl_wireimg_type).filter(":checked").val();

  if(!gRecord[this.show_image]) return;
  this.wireimg.src       = gRecord[this.show_image].wireimg_url;
  this.wireimg_thumb.src = gRecord[this.show_image].wireimg_url_thumb;
  // Callback when the png is actually there...
  var self = this;
  this.wireimg.onload = function() {
      self.loaded_wireimg = true;
      self.Draw();
  }  
  this.wireimg_thumb.onload = function() {
      self.loaded_thumbnail = true;
  }  
}

WireView.prototype.NewRecord_mc = function()
{
  
}

WireView.prototype.TrimHits = function()
{
  // Called when a cut is changed; go through data and trim visible hit list.
  
  // For now, no cuts, but I am going to add wrapper objects to hold extracted data.
  this.visHits = [];
  for(var i = 0;i<this.myHits.length;i++) {
    var h= this.myHits[i];
    var vishit = {hit:h,
      u:h.wire,  // horizontal coord
      v:h.t,     // vertical coord
      v1:h.t1,
      v2:h.t2,
      c: h.q     // Color coord
    }
    this.visHits.push(vishit);
  }

  this.Draw();
}




WireView.prototype.DrawFast = function()
{
  this.Draw(true);
}

WireView.prototype.Draw = function(fast)
{
  // Reset bounds if appropriate
  if(this.zooming) {
    this.min_v = gZoomRegion.tdc[0];
    this.max_v = gZoomRegion.tdc[1];
    this.min_u = gZoomRegion.plane[this.plane][0];
    this.max_u = gZoomRegion.plane[this.plane][1];
  } else {
    this.min_v = 0;
    this.max_v = 3200;
    this.min_u = 0;
    this.max_u = gGeo.numWires(this.plane);
  }
  
  

  if($(this.element).is(":hidden")) return;

  if((this.fMousing) && ($('#ctl-magnifying-glass').is(':checked')) )
  {
    this.magnifying = true;
    // Cleverness:
    var mag_radius = parseFloat($('#ctl-magnifier-size').val());
    var mag_scale  = parseFloat($('#ctl-magnifier-mag').val());
    
    this.DrawOne(this.min_u, this.max_u, this.min_v, this.max_v);
    this.ctx.strokeStyle = "rgba(0,0,0,0.75)";
    this.ctx.beginPath();
    this.ctx.arc(this.fMouseX,this.fMouseY, mag_radius+1, 0,Math.PI*2,true);
    this.ctx.stroke();
    
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.arc(this.fMouseX,this.fMouseY, mag_radius, 0,Math.PI*2,true);
    this.ctx.clip();
    
    this.ctx.translate((1-mag_scale)*this.fMouseX,(1-mag_scale)*this.fMouseY);
    this.ctx.scale(mag_scale,mag_scale);
    
    // Find new draw limits in u/v coords:
    var umin = this.GetU(this.fMouseX-mag_radius);
    var umax = this.GetU(this.fMouseX+mag_radius);
    var vmax = this.GetV(this.fMouseY-mag_radius);
    var vmin = this.GetV(this.fMouseY+mag_radius);
    
    this.DrawOne(umin,umax,vmin,vmax,fast);
    this.ctx.restore();
  } else {
    this.magnifying = false;
    this.DrawOne(this.min_u, this.max_u, this.min_v, this.max_v,fast);
  }  
  
}


WireView.prototype.DrawOne = function(min_u,max_u,min_v,max_v,fast)
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
  
  if(gRecord) {
    if ($(this.ctl_show_wireimg).is(":checked")) {
      this.DrawImage(min_u,max_u, min_v, max_v, fast);
    }

    if ($(this.ctl_show_hits).is(":checked")) {
      this.DrawHits(min_u,max_u, min_v, max_v, fast);
    }

    if ($(this.ctl_show_clus).is(":checked")) {
      this.DrawClusters(min_u,max_u, min_v, max_v, fast);
    }

    if ($(this.ctl_show_spoints).is(":checked")) {
      this.DrawSpacepoints(min_u,max_u, min_v, max_v, fast);
    }

    if ($(this.ctl_show_tracks).is(":checked")) {
      this.DrawTracks(min_u,max_u, min_v, max_v, fast);
    }


    if ($(this.ctl_show_mc).is(":checked")) {
      this.DrawMC(min_u,max_u, min_v, max_v, fast);
    }  

  }

  if(this.zooming) {
    // Clip out the region
    this.ctx.fillStyle = "rgb(0,0,0)";
    var nwires = gGeo.numWires(this.plane);
    if(min_u < 0) 
      this.ctx.fillRect( this.origin_x , this.origin_y-this.span_y, 
                          this.GetX(0) - this.origin_x, this.span_y);

    if(max_u > nwires) {
      var xmax = this.GetX(nwires);
      this.ctx.fillRect( xmax , this.origin_y-this.span_y, 
                        this.span_x /*too much*/, this.span_y);
    }

    if(min_v < 0) {
      this.ctx.fillRect( this.origin_x  , this.GetY(0), 
                        this.span_x, this.span_y /*too much*/);
    }

    if(max_v > 3200) { // FIXME: Should be number of samples.!
      this.ctx.fillRect( this.origin_x , this.origin_y-this.span_y, 
                        this.span_x, this.GetY(3200)-(this.origin_y-this.span_y));
    }
    
    
  }  
  this.ctx.restore();
  
}


WireView.prototype.DrawHits = function(min_u, max_u, min_v, max_v)
{
  // Temp:
  var cs = new ColorScaler();
  cs.max = 2000;

  this.cellWidth = this.span_x/this.num_u;
  this.cellHeight = this.span_y/this.num_v;

  for(var i=0;i<this.visHits.length;i++) {
    var h = this.visHits[i];
    var u = h.u;
    if(u<min_u) continue;
    if(u>max_u) continue;
    var v = h.v;         
    if(v<min_v) continue;
    if(v>max_v) continue;
    var x = this.GetX(u);
    var dx = this.GetX(u+1) - x;
    
    var y = this.GetY(h.v1);
    var dy = this.GetY(h.v2) - y;    
    var c = cs.GetColor(h.c);
    this.ctx.fillStyle = "rgb(" + c + ")";;
    this.ctx.fillRect(x,y,dx,dy);      
  }
}



WireView.prototype.DrawImage = function(min_u,max_u,min_v,max_v,fast)
{
  
  if(fast) {
    if(!this.loaded_thumbnail) return;
    if(!this.wireimg) return;
  } else {
    if(!this.loaded_wireimg) return;
    if(!this.wireimg_thumb) return;
  }

   var min_tdc     = Math.max(0,this.min_v);
   var max_tdc     = Math.min(this.wireimg.width,this.max_v); 
   var min_wire    = Math.max(this.min_u,0);
   var max_wire    = Math.min(this.max_u,gGeo.numWires(this.plane));
   var min_channel = gGeo.channelOfWire(this.plane, min_wire);
   var max_channel = gGeo.channelOfWire(this.plane, max_wire);
   
   var source_x = Math.floor(min_tdc);
   var source_y = Math.floor(min_channel);
   var source_w = Math.floor(max_tdc-min_tdc);
   var source_h = Math.floor(max_channel-min_channel);
  
   // Find position and height of destination in screen coordinates. Note we'll 
   // have to rotate these for final picture insertion.
   var dest_x = Math.floor(this.GetX(min_wire));
   var dest_w = Math.floor(this.GetX(max_wire) - dest_x);
   var dest_y = Math.floor(this.GetY(min_tdc));
   var dest_h = Math.floor(dest_y - this.GetY(max_tdc));
  
   // Now, the above values are good, but we need to 
   // rotate our image.
   this.ctx.save();
   this.ctx.translate(dest_x,dest_y);
   this.ctx.rotate(-Math.PI/2);

   var rot_dest_x = 0;
   var rot_dest_y = 0;
   var rot_dest_w = dest_h;
   var rot_dest_h = dest_w;
  
   // console.log("drawImg source",source_x,source_y,source_w,source_h);
   // console.log("drawImg dest", dest_x,   dest_y,  dest_w, dest_h);
   // console.log("drawImg rot ", rot_dest_x,   rot_dest_y,  rot_dest_w, rot_dest_h);
  
  if(fast) {
    // Draw from the thumbnail, which is resolution-reduced by a factor of 5.
    this.ctx.drawImage(
      this.wireimg_thumb      // Source image.
      ,source_x/5
      ,source_y/5
      ,source_w/5
      ,source_h/5
      ,rot_dest_x
      ,rot_dest_y
      ,rot_dest_w
      ,rot_dest_h
       );
    
  } else {
    this.ctx.drawImage(
      this.wireimg      // Source image.
      ,source_x
      ,source_y
      ,source_w
      ,source_h
      ,rot_dest_x
      ,rot_dest_y
      ,rot_dest_w
      ,rot_dest_h
    );
    
  }
  this.ctx.restore();   

}

WireView.prototype.DrawClusters = function(min_u,max_u,min_v,max_v,fast)
{
  // ID: 0
  // dQdW: -999
  // dTdW: -999
  // endPos: Object
  // sigmaEndPos: Object
  // sigmaStartPos: Object
  // sigmadQdW: 0
  // sigmadTdW: 0
  // startPos: Object
  // totalCharge: 279631.85
  // view: 2
  
  var clusters = gRecord.clusters;
  if(!clusters) return;
  for(var i = 0; i<clusters.length;i++) {
    var clus = clusters[i];
    if(clus.view != this.plane) continue;
    // console.log(
    //   "clus on plane ",this.plane 
    // ,clus.startPos.wire
    // ,clus.endPos  .wire
    // ,clus.startPos.tdc 
    // ,clus.endPos  .tdc 
    // )
    var x1 = this.GetX(clus.startPos.wire);
    var x2 = this.GetX(clus.endPos  .wire);
    var y1 = this.GetY(clus.startPos.tdc );
    var y2 = this.GetY(clus.endPos  .tdc );
    this.ctx.fillStyle = "orange";
    this.ctx.beginPath();
    this.ctx.moveTo(x1,y1);
    this.ctx.lineTo(x1,y2);
    this.ctx.lineTo(x2,y2);
    this.ctx.lineTo(x2,y1);
    this.ctx.lineTo(x1,y1);
    this.ctx.fill();
  }
  
}

WireView.prototype.DrawSpacepoints = function(min_u,max_u,min_v,max_v,fast)
{
  var sps = gRecord.spacepoints;
  if(!sps) return;
  this.ctx.save();
  for(var i = 0; i<sps.length;i++) {
    var sp = sps[i];
    this.ctx.fillStyle = "rgba(0, 150, 150, 1)";
    this.ctx.strokeStyle = "rgba(0, 150, 150, 1)";
    this.ctx.lineWidth = 1;
    var u = gGeo.yzToWire(this.plane,sp.xyz[1],sp.xyz[2]);
    var v = gGeo.getTDCofX(this.plane,sp.xyz[0]); // FIXME: Only true for beam MC events!
    var ru = 1; // one wire.
    if(i<5) console.warn("spacepoint plane",this.plane,u,v,ru);
    var x = this.GetX(u);
    var y = this.GetY(v);
    var r = this.GetX(u+ru) - x;
    this.ctx.beginPath();
    this.ctx.arc(x,y,r,0,2*Math.PI);
      if(i<5) console.warn("spacepoint plane",this.plane,x,y,r,0,2*Math.Pi);
    
    this.ctx.fill();
    if(r>4) this.ctx.strokeStyle="black"; // Dots are big enough that showing the outline is worth it.
    // Accidental visual cleverness: if the radius of the circle is too small to see,
    // this will blow it up to ~2 pixels, the line width of the circle!
    this.ctx.stroke();
  }
  this.ctx.restore();
}

WireView.prototype.DrawTracks = function(min_u,max_u,min_v,max_v,fast)
{
  var tracks = gRecord.tracks;
  if(!tracks) return;
  this.ctx.save();
  for(var i=0;i<tracks.length;i++)
  {
    var trk = tracks[i];
    var points = trk.points;
    if(points.length<1) continue;
    this.ctx.strokeStyle = "black";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    for(var j=0;j<points.length;j++) {
      var u = gGeo.yzToWire(this.plane,points[j].y, points[j].z);
      var v = gGeo.getTDCofX(this.plane,points[j].x);
      var x = this.GetX(u);
      var y = this.GetY(v);
      if(j==0) this.ctx.moveTo(x,y);
      else     this.ctx.lineTo(x,y);
    }
    this.ctx.stroke();
  }
  this.ctx.restore();
}


WireView.prototype.DrawMC = function(min_u,max_u,min_v,max_v,fast)
{
  if(!gRecord) return;
  if(!gRecord.mc) return;
  if(!gRecord.mc.particles) return;
  for(var i=0;i<gRecord.mc.particles.length;i++)
  {
    var p= gRecord.mc.particles[i];
    if(!p.trajectory || p.trajectory.length==0) continue;
    
    this.ctx.lineWidth = 1;
    this.ctx.strokeStyle="rgba(0,0,255,0.5)";

    if(p.fpdgCode == 22 || p.fpdgCode == 2112) {
      // Make photons and neutrons colorless.
      this.ctx.strokeStyle="rgba(0,0,0,0)";      
    }
    for(var k=0;k<gSelectedTrajectories.length;k++) {
      if(p.ftrackId == gSelectedTrajectories[k]) {
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle="rgba(255,255,20,1)";        
      }
    }

    if(gHoverState.obj && gHoverState.obj.ftrackId === p.ftrackId){
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle="rgba(255,20,20,1)";
    }
    
    this.ctx.beginPath();
    for(var j=0;j<p.trajectory.length;j++) {
      var point = p.trajectory[j];
      // Convert particle X coordinate to TDC value.
      var tdc = gGeo.getTDCofX(this.plane,point.x);
      // Convert YZ into wire number.
      var wire = gGeo.yzToWire(this.plane,point.y,point.z);
      var x = this.GetX(wire);
      var y = this.GetY(tdc);
      if(j==0)this.ctx.moveTo(x,y);
      else    this.ctx.lineTo(x,y);
    }
    this.ctx.stroke();
  }
}

////////////////////////////////////////////////////////////////////////////////////////
// Mouse
////////////////////////////////////////////////////////////////////////////////////////


WireView.prototype.DoMouse = function(ev)
{
  // First, deal with mouse-ups that are probably outside my region.
  if(ev.type === 'mouseup') {
    if( this.fDragging) {
      this.fDragging = false;
      // Update thorough
      gStateMachine.Trigger("zoomChange"); 
      // Draw gets issued by the trigger.
    }
    return;
  }
  
  ev.originalEvent.preventDefault();
  
  if(ev.type === 'mouseout' || ev.type == 'touchend') {
    this.fMousing = false;
    gHoverWire = null;
    // gStateMachine.Trigger('hoverWireChange');    
    this.Draw();
    return;
  }
  
  /// Mousedown, mouseup OR mousemove
    
  this.fMousing = true;
  var offset = getAbsolutePosition(this.element);
  this.fMouseX = ev.pageX - offset.x;
  this.fMouseY = ev.pageY - offset.y; 
  this.fMouseU = this.GetU(this.fMouseX);
  this.fMouseV = this.GetV(this.fMouseY);

  // Which area is mouse start in?
  var mouse_area;
  if(this.fMouseY > this.origin_y ) {
    mouse_area = "xscale";
  } else if(this.fMouseX < this.origin_x) {
    mouse_area = "yscale";
  } else {
    mouse_area = "body";
  }
  if(this.zooming) {
    // Change cursor.
    switch(mouse_area) {
      case "body":         this.canvas.style.cursor = "move";      break;
      case "xscale":       this.canvas.style.cursor = "e-resize";  break;
      case "yscale":       this.canvas.style.cursor = "n-resize"; break;
    }
  }
  

  if(this.fDragging) {
      // Update new zoom position or extent...
    if(this.fMouseStartArea == "body"){
      var dx = this.fMouseX - this.fMouseLastX;
      var du = dx * (this.max_u-this.min_u)/(this.span_x);
      
      gZoomRegion.setLimits(this.plane,this.min_u - du, this.max_u - du);
      
      var dy = this.fMouseY - this.fMouseLastY;
      var dv = dy * (this.max_v-this.min_v)/(this.span_y);
      gZoomRegion.changeTimeRange(gZoomRegion.tdc[0] + dv, gZoomRegion.tdc[1] + dv);
      
      this.fMouseLastX = this.fMouseX;
      this.fMouseLastY = this.fMouseY;
    } else if(this.fMouseStartArea == "xscale") {
      var relx = this.fMouseX - this.origin_x;
      if(relx <= 5) relx = 5; // Cap at 5 pixels from origin, to keep it sane.
      // Want the T I started at to move to the current posistion by scaling.
      var new_max_u = this.span_x * (this.fMouseStartU-this.min_u)/relx + this.min_u;
      gZoomRegion.setLimits(this.plane,this.min_u, new_max_u);
      
    } else if(this.fMouseStartArea == "yscale") {
      var rely =  this.origin_y - this.fMouseY;
      if(rely <= 5) rely = 5; // Cap at 5 pixels from origin, to keep it sane.
      var new_max_v = this.span_y * (this.fMouseStartV-this.min_v)/rely + this.min_v;
      gZoomRegion.changeTimeRange(gZoomRegion.tdc[0] , new_max_v);
    
    }
    
  } else {
    ChangeHover(  {channel: gGeo.channelOfWire(this.plane,this.fMouseU), 
                   sample:  this.fMouseV
                   }
                , "wire");
  }

    
  if(ev.type === 'mousedown') {
      if(this.zooming) this.fDragging = true;
      this.fMouseStartX = this.fMouseX;
      this.fMouseStartY = this.fMouseY;
      this.fMouseStartU = this.fMouseU;
      this.fMouseStartV = this.fMouseV;
      this.fMouseLastX = this.fMouseX;
      this.fMouseLastY = this.fMouseY;
      // Which area is mouse start in?
      this.fMouseStartArea = mouse_area;
  } else if(ev.type === 'mousemove' ) {
    // Update quick.
    if(this.fDragging){
      gStateMachine.Trigger("zoomChangeFast"); 
    }
    this.Draw(false); // Do a slow draw in this view.    
  } 
  
}
