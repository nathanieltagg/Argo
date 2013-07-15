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
  
  console.warn("WireView created with element:",$(element).css("height"),$(element).height());
  
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
    tick_label_font: "10px serif",
    show_image:   false, // can be false, 'raw', or 'cal'
    show_hits:    false,
    show_mc:      true
  };
  $.extend(true,settings,options);  // Change default settings by provided qualities.
  Pad.call(this, element, settings); // Give settings to Pad contructor.
  console.warn("WireView created with element:",$(element).css("height"),$(element).height());
  
  var self = this;
  this.SetMagnify(true);
  this.fMouseStart  = {}; this.fMouseLast = {};
  this.fDragging = false;
  this.hasContent = false;
  this.myHits = [];
  this.visHits = [];
  
  this.mouseable = [];
  
  this.loaded_wireimg = false;
  this.loaded_thumbnail = false;
  
  // $(this.element).bind('mousemove',function(ev) { return self.DoMouse(ev); });
  // $(this.element).bind('mousedown',function(ev) { return self.DoMouse(ev); });
  // $(this.element).bind('mouseout' ,function(ev) { return self.DoMouse(ev); });
  // $(document    ).bind('mouseup' ,function(ev) { return self.DoMouse(ev); });
  // 
  // $(this.element).bind('touchstart' ,function(ev) { return self.DoMouse(ev); });
  // $(this.element).bind('touchmove' ,function(ev) {  return self.DoMouse(ev); });
  // $(this.element).bind('touchend' ,function(ev) { return self.DoMouse(ev); });

  // $(this.element).bind('resize' ,function(ev) { if(self.hasContent == false) self.Draw(); });
  
  gStateMachine.Bind('recordChange', this.NewRecord.bind(this) );
  gStateMachine.Bind('TimeCutChange',this.Draw.bind(this) );
  gStateMachine.Bind('hoverChange',  this.HoverChange.bind(this) );
  gStateMachine.Bind('selectChange', this.Draw.bind(this) );
  gStateMachine.Bind('hitChange',    this.TrimHits.bind(this) );
  gStateMachine.Bind('timeCutChange',this.TrimHits.bind(this) );
  
  if(this.zooming) gStateMachine.BindObj('zoomChange',this,"Draw");
  if(this.zooming) gStateMachine.BindObj('zoomChangeFast',this,"DrawFast");
 
  this.ctl_show_hits    =  GetBestControl(this.element,".show-hits");
  this.ctl_hit_field    =  GetBestControl(this.element,".hit-hist-field");
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
  $('#ctl-TrackLists')      .change(function(ev) { return self.Draw(false); });
  $('#ctl-SpacepointLists') .change(function(ev) { return self.Draw(false); });

  // Flip planes control (for big wireview
  this.ctl_plane = GetLocalControl(this.element,"[name=wireview-select]");
  this.ctl_plane.click(function(ev) { 
    self.plane = parseInt( $(self.ctl_plane).filter(":checked").val() );
    // console.warn("changing plane",self,$(this.ctl_plane).filter(":checked").val(),self.plane);
    
    return self.NewRecord(); 
  });
}

WireView.prototype.HoverChange = function()
{
  // Only need a redraw if the over change affected something we care about.
  switch(gHoverState.type) {
    case "hit": 
    case "cluster":
    case "spacepoint":
    case "track":
    case "mcparticle":
      this.Draw(); break;
    default: break;
  }
  switch(gHoverState.last.type) {
    case "hit": 
    case "cluster":
    case "spacepoint":
    case "track":
    case "mcparticle":
      this.Draw(); break;
    default: break;  
  }
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

  if(!gHitsListName) return;
  var hits = gRecord.hits[gHitsListName];
  // Go through gHits, and find hits that match our view.
  for(var i=0;i<hits.length;i++) {
    if(hits[i].plane == this.plane) this.myHits.push(hits[i]);
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
  if(!gRecord[this.show_image][gCurName[this.show_image]]) return;
  var wiredesc = gRecord[this.show_image][gCurName[this.show_image]]; // e.g. gRecord.raw."recob::rawwire"
  this.wireimg.src       = wiredesc.wireimg_url;
  this.wireimg_thumb.src = wiredesc.wireimg_url_thumb;
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
  var field = $(this.ctl_hit_field).val();
  for(var i = 0;i<this.myHits.length;i++) {
    var h= this.myHits[i];
    var c = h[field];
    if(c<gHitCut.min) continue;
    if(c>gHitCut.max) continue;
    
    var vishit = {hit:h,
      u:h.wire,  // horizontal coord
      v:h.t,     // vertical coord
      v1:h.t1,
      v2:h.t2,
      c: c    // Color coord
    }
    this.visHits.push(vishit);
  }

  this.Draw();
}




WireView.prototype.DrawFast = function()
{
  this.Draw(true);
}

WireView.prototype.DrawOne = function(min_u,max_u,min_v,max_v,fast)
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






WireView.prototype.DrawImage = function(min_u,max_u,min_v,max_v,fast)
{
  var do_thumbnail = (fast);
  if(!this.loaded_wireimg) do_thumbnail = true;
  if(!this.wireimg) do_thumbnail = true;
  
  if(do_thumbnail) {
    if(!this.loaded_thumbnail) do_thumbnail = false; // fallback to full image
    if(!this.wireimg_thumb) do_thumbnail = false;
  }
  
  if(!do_thumbnail) {
    if(!this.loaded_wireimg) return; // no more fallbacks. 
    if(!this.wireimg) return;
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
  
  if(do_thumbnail) {
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


WireView.prototype.DrawHits = function(min_u, max_u, min_v, max_v)
{
  // Temp:
  this.cellWidth = this.span_x/this.num_u;
  this.cellHeight = this.span_y/this.num_v;
  
  // console.warn("DrawHits",this.plane,min_u,max_u,min_v,max_v, gHoverState.obj);

  var hoverVisHit = null;
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
    var c = gHitColorScaler.GetColor(h.c);

    this.ctx.fillStyle = "rgb(" + c + ")";
    this.ctx.fillRect(x,y,dx,dy);      
  
    if(gHoverState.obj == h.hit) hoverVisHit = h;
    this.mouseable.push({type:"hit", x1:x, x2:x, y1:y, y2:y+dy, r:dx, obj: h.hit});
  }
  
  if(hoverVisHit) {
    console.warn("hoverhit!",hoverVisHit);
      var h = hoverVisHit;
      var u = h.u;
      var v = h.v;         
      var x = this.GetX(u);
      var dx = this.GetX(u) - x;
    
      var y = this.GetY(h.v2);
      var dy = this.GetY(h.v1) - y;    
      var c = gHitColorScaler.GetColor(h.c);
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
  
  if(!gClustersListName) return;
  var clusters = gRecord.clusters[gClustersListName];
  if(!clusters) return;
  for(var i = 0; i<clusters.length;i++) {
    var clus = clusters[i];
    if(gGeo.planeOfView(clus.view) != this.plane) continue;
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
  if(!$("#ctl-SpacepointLists").val()) return;
  var sps = gRecord.spacepoints[$("#ctl-SpacepointLists").val()];
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
    
    
    this.mouseable.push({type:"sp", x1:x, x2:x, y1:y, y2:y, r:ru, obj: sp});
    
    
  }
  this.ctx.restore();
}

WireView.prototype.DrawTracks = function(min_u,max_u,min_v,max_v,fast)
{
  if(!$("#ctl-TrackLists").val()) return;
  var tracks = gRecord.tracks[$("#ctl-TrackLists").val()];
  if(!tracks) return;
  this.ctx.save();
  for(var i=0;i<tracks.length;i++)
  {
    var trk = tracks[i];
    var points = trk.points;
    if(points.length<2) continue;
    // compile points
    var pts = [];
    for(var j=0;j<points.length;j++) {
      // Fixme: bezier
      var u = gGeo.yzToWire(this.plane,points[j].y, points[j].z);
      var v = gGeo.getTDCofX(this.plane,points[j].x);
      pts.push([this.GetX(u),this.GetY(v)]);
    }
    
    this.ctx.strokeStyle = "rgba(89, 169, 28, 1)";
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
      for(var j=1;j<pts.length;j++) this.ctx.lineTo(pts[j][0],pts[j][1]);
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
    for(var j=1;j<pts.length;j++) this.ctx.lineTo(pts[j][0],pts[j][1]);
    this.ctx.stroke();


    // for mouseovering
    for(var j=1;j<pts.length;j++) 
      this.mouseable.push({type:"track", x1:pts[j-1][0], x2:pts[j][0], y1:pts[j-1][1], y2:pts[j][1], r:this.ctx.lineWidth, obj: trk});

    this.ctx.stroke();
  }
  this.ctx.restore();
}


WireView.prototype.DrawMC = function(min_u,max_u,min_v,max_v,fast)
{  
  if(!gRecord) return;
  if(!gRecord.mc) return;
  var particles = gRecord.mc.particles[gMCParticlesListName];
  if(!particles) return;
  for(var i=0;i<particles.length;i++)
  {
    var p= particles[i];
    if(!p.trajectory || p.trajectory.length==0) continue;

    // compile points
    var pts = [];
    for(var j=0;j<p.trajectory.length;j++) {
      var point = p.trajectory[j];
      // Convert particle X coordinate to TDC value.
      var tdc = gGeo.getTDCofX(this.plane,point.x);
      // Convert YZ into wire number.
      var wire = gGeo.yzToWire(this.plane,point.y,point.z);
      var x = this.GetX(wire);
      var y = this.GetY(tdc);
      if(x>=0 && x<this.width && y>=0 && y<=this.height)
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
      for(var j=1;j<pts.length;j++) this.ctx.lineTo(pts[j][0],pts[j][1]);
      this.ctx.stroke();
      this.ctx.lineWidth =2;
      this.ctx.strokeStyle = "rgba(255,20,20,1)";
      
    }
  
    if(p.fpdgCode == 22 || p.fpdgCode == 2112) {
      // Make photons and neutrons colorless.
      this.ctx.strokeStyle = "rgba(0,0,0,0)";      
    }
    // Note direct object compare doesn't work with MCDigraph. Don't know why; spacetree must clone instead of link objects.
    if(gHoverState.obj && (gHoverState.obj.ftrackId == p.ftrackId)){ // hovering
      this.ctx.lineWidth = 2;
      this.ctx.strokeStyle = "rgba(255,20,20,1)";
    }
    

    // Draw main track.
    this.ctx.beginPath();
    this.ctx.moveTo(pts[0][0],pts[0][1]);
    for(var j=1;j<pts.length;j++) this.ctx.lineTo(pts[j][0],pts[j][1]);
    this.ctx.stroke();
    
    
    // for mouseovering
    for(var j=1;j<pts.length;j++) 
      this.mouseable.push({type:"mcparticle", x1:pts[j-1][0], x2:pts[j][0], y1:pts[j-1][1], y2:pts[j][1], r:this.ctx.lineWidth, obj: p});
  
  
  }
}

////////////////////////////////////////////////////////////////////////////////////////
// Mouse
////////////////////////////////////////////////////////////////////////////////////////


WireView.prototype.DoMouse = function(ev)
{
  ///
  /// Called by ::Pad for any mouse event that might be relevant,
  /// including mousemove, mousedown, click in the element
  /// and mousee move, up outside.
  
  // First, deal with mouse-ups that are probably outside my region.
  if(ev.type === 'mouseenter') return; // dont need to deal with this.
  if(ev.type === 'mouseout') return;   // dont need to deal with this.

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
  
  // Which area is mouse start in?
  var mouse_area;
  if(this.fMousePos.y > this.origin_y ) {
    mouse_area = "xscale";
  } else if(this.fMousePos.x < this.origin_x) {
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
    if(this.fMouseStart.area == "body"){
      var dx = this.fMousePos.x - this.fMouseLast.x;
      var du = dx * (this.max_u-this.min_u)/(this.span_x);
      
      gZoomRegion.setLimits(this.plane,this.min_u - du, this.max_u - du);
      
      var dy = this.fMousePos.y - this.fMouseLast.y;
      var dv = dy * (this.max_v-this.min_v)/(this.span_y);
      gZoomRegion.changeTimeRange(gZoomRegion.tdc[0] + dv, gZoomRegion.tdc[1] + dv);
      
      this.fMouseLast = {};
      $.extend(this.fMouseLast,this.fMousePos); // copy.
      
    } else if(this.fMouseStart.area == "xscale") {
      var relx = this.fMousePos.x - this.origin_x;
      if(relx <= 5) relx = 5; // Cap at 5 pixels from origin, to keep it sane.
      // Want the T I started at to move to the current posistion by scaling.
      var new_max_u = this.span_x * (this.fMouseStart.u-this.min_u)/relx + this.min_u;
      gZoomRegion.setLimits(this.plane,this.min_u, new_max_u);
      
    } else if(this.fMouseStart.area == "yscale") {
      var rely =  this.origin_y - this.fMousePos.y;
      if(rely <= 5) rely = 5; // Cap at 5 pixels from origin, to keep it sane.
      var new_max_v = this.span_y * (this.fMouseStart.v-this.min_v)/rely + this.min_v;
      gZoomRegion.changeTimeRange(gZoomRegion.tdc[0] , new_max_v);
    
    }
    
  } else {
    if(this.fMouseInContentArea) {
      // Find the first good match
      var match = {obj: null, type:"none"};
      for(var i =this.mouseable.length-1 ; i>=0; i--) {
        var m = this.mouseable[i];
        if (GeoUtils.line_is_close_to_point(
          this.fMousePos.x,this.fMousePos.y, m.x1,m.y1,m.x2,m.y2,m.r)) 
          {
            match = m;
            break;
          };
      }
      if(ev.type=='click') {
        ChangeSelection(match);
      } else {
        // mousemove.
        if(match.obj) ChangeHover(match); // match might be null.
        else          ChangeHover(  { obj:{channel: gGeo.channelOfWire(this.plane,this.fMousePos.u), 
                                 sample:  this.fMousePos.v
                                 }
                                , type: "wire"});        
      }
    }
                  
  }

    
  if(ev.type === 'mousedown') {
      if(this.zooming) this.fDragging = true;
      $.extend(this.fMouseStart,this.fMousePos); // copy.
      $.extend(this.fMouseLast ,this.fMousePos); // copy.
      // Which area is mouse start in?
      this.fMouseStart.area = mouse_area;
      console.log("dragstart",this.fMouseStart);
  } else if(ev.type === 'mousemove' ) {
    // Update quick.
    if(this.fDragging){
      gStateMachine.Trigger("zoomChangeFast"); 
    }
    this.dirty=true; // Do a slow draw in this view.    
  } 
    
}
