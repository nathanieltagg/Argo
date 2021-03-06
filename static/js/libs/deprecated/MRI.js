
///
/// This stuff is deprecated!
/// Need to rebuild it all using world-coordinate geometry and THREE.js
/// The existing code is just too slow to update, and no one really uses it.
/// Consider incorporating into the TriD view with special projection or something!
///


var gMRI = null;

$(function(){
  $('div.A-MRI').each(function(){
    gMRI = new MRI(this);
  });  
});


// Subclass of Pad.
MRI.prototype = new ButtressedPad(); 

function MRI( element, options )
{
  if(element === undefined) return; // null function call.
  gMRI = this;
  
  var settings = {
    margin_bottom : 20,
    margin_top    : 20,
    margin_right  : 20,
    margin_left   : 30,
    buttress_min_u :     -10,    // cm
    buttress_max_u :  1050,
    buttress_min_v :  -125,
    buttress_max_v :   125,
    min_u :     -50,    // cm
    max_u :  1090,
    min_v :  -150,
    max_v :   150,
    draw_grid_x: 0,
    draw_grid_y: 0,
    draw_box: false,
    draw_frame: false
  };
  $.extend(true,settings,options);  // Change default settings by provided qualities.
  ButtressedPad.call(this, element, settings); // Give settings to Pad contructor.
  
  
  var self = this;
  this.SetMagnify(true);
  this.fMousing = false; // Mouse is in our region.
  this.fDragging = false; // Mouse is moving zoom region
  this.fPulling  = false; // Mouse is changing size of zoome region
  this.fMouseStart  = {}; this.fMouseLast = {};
  this.fMousedWires = [];
  this.mouseable =[];
  this.has_been_adjusted = false;
  // $(this.element).bind('mousemove',function(ev) { return self.DoMouse(ev); });
  // $(this.element).bind('mousedown',function(ev) { return self.DoMouse(ev); });
  // $(window      ).bind('mouseup',function(ev) { return self.DoMouse(ev); });
  // $(this.element).bind('mouseout' ,function(ev) { return self.DoMouse(ev); });
  // 
  // $(this.element).bind('touchstart' ,function(ev) { return self.DoMouse(ev); });
  // $(this.element).bind('touchmove' ,function(ev) {  return self.DoMouse(ev); });
  // $(this.element).bind('touchend' ,function(ev) { return self.DoMouse(ev); });
 
  gStateMachine.Bind('change-tracks', this.Draw.bind(this) );
  gStateMachine.Bind('change-spacepoints', this.Draw.bind(this) );

  this.ctl_show_hits    =  this.GetBestControl(".show-hits");
  this.ctl_hit_field    =  this.GetBestControl(".hit-hist-field");
  this.ctl_show_spoints =  this.GetBestControl(".show-spacepoints");
  this.ctl_show_tracks  =  this.GetBestControl(".show-tracks");
  this.ctl_show_mc      =  this.GetBestControl(".show-mc");
  this.ctl_show_mc_neutrals =  this.GetBestControl(".show-mc-neutrals");
  this.slider_ends  =  $(this.GetBestControl(".mri-slider-ends"));
  this.slider_grip  =  $(this.GetBestControl(".mri-slider-grip"));
  this.slider_window_size  =  $(this.GetBestControl(".mri-slider-window-size"));
 
  this.nudge_left  = $(this.GetBestControl(".mri-slider-grip-size-nudge-left"));
  this.nudge_right = $(this.GetBestControl(".mri-slider-grip-size-nudge-right"));
 
  this.last_nudge = 0;
  function move_grip(delta) {
    var v = self.slider_grip.slider( "option", "value" ); self.slider_grip.slider("option","value",v+delta);    
    self.last_nudge = delta;
  }
  function continueNudge() {
    move_grip(self.last_nudge);
    // self.nudge_timeout=setTimeout(continueNudge,100);  // temporarily taken out - this seems to be causing all sorts of issues in Chrome
  }
  var nudge_timeout = 0;
  this.nudge_right = $(this.GetBestControl(".mri-slider-grip-size-nudge-right"));
  this.nudge_left.button ({icons:{primary:"ui-icon-circle-triangle-w"},text: false})
    .mousedown(function(){
      move_grip(-1);
      self.nudge_timeout=setTimeout(continueNudge,500);    
    })
    .bind('mouseup mouseleave',function() {
      clearTimeout(self.nudge_timeout);
    });
  this.nudge_right.button({icons:{primary:"ui-icon-circle-triangle-e"},text: false})
    .mousedown(function(){
      move_grip(1);
      self.nudge_timeout=setTimeout(continueNudge,500);    
    })
    .bind('mouseup mouseleave',function() {
      clearTimeout(self.nudge_timeout);
    });
  
 
 
  gStateMachine.Bind('change-hits',   this.NewHits.bind(this));
  gStateMachine.Bind('zoomChange',    this.ZoomChange.bind(this));
  gStateMachine.Bind('zoomChangeFast',this.ZoomChange.bind(this));
  gStateMachine.Bind('hoverChange',   this.Draw.bind(this));  
  gStateMachine.Bind('selectChange',  this.Draw.bind(this));
  gStateMachine.Bind('hitChange',     this.Draw.bind(this));
  
  this.t = [0,50];
  this.min_t = 0;
  this.max_t = 9600;
  this.hits = [];
  
  // this slider has two adjustable endpoints matching the selection range for planes.
  this.slider_ends.slider({
    orientation: "horizontal",
    range: true,
    min: self.min_t,
    max: self.max_t,
    values: self.z,
    step: 1,
    slide: function(event, ui) {
      $(ui.handle).text(ui.value);
      self.ChangeTends(ui.values);
    }
  });
  
  // this slider has one adjuster, matching the first plane but sliding the window.
  
  this.slider_grip.slider({
    orientation: "horizontal",
    min: self.min_t,
    max: self.max_t,
    value: this.t[0],
    step: 1,
    slide: function(event, ui) {  self.ChangeTgrip(ui.value);  },
    change: function(event, ui) {  self.ChangeTgrip(ui.value);  }
  });
  
  this.slider_window_size.slider({
    orientation: "horizontal",
    min: 1,
    max: 200,
    value: this.t[1]-this.t[0],
    step: 1,
    slide: function(event, ui) {
      self.ChangeTwindow(ui.value);
    }
  });
  
  $(".ui-slider-handle",this.slider_grip).css("width","5em");
  
  this.ChangeT();
  this.has_been_adjusted = false;
}

MRI.prototype.ZoomChange = function()
{
  // Work out the zoom region in yz space.
  // use plane 2 (Y-view) wires to constrain Z limits.
  this.buttress_min_u = gGeo.getWire(2,gZoomRegion.plane[2][0]).z1;
  this.buttress_max_u = gGeo.getWire(2,gZoomRegion.plane[2][1]).z1;

  // if(this.buttress_min_u < 0 )    this.buttress_min_u = 0;
  // if(this.buttress_max_u > 1040 ) this.buttress_max_u = 1040;

  // Now it's harder: use the crossing of the u and v zoom to get Y limits.
  var crossing1 = gGeo.wireCrossing( gGeo.getWire(0,gZoomRegion.plane[0][1]),
                                     gGeo.getWire(1,gZoomRegion.plane[1][0]) ); 
  var crossing2 = gGeo.wireCrossing( gGeo.getWire(0,gZoomRegion.plane[0][0]),
                                     gGeo.getWire(1,gZoomRegion.plane[1][1]) ); 
                                     
  this.buttress_min_v = crossing1.y;
  this.buttress_max_v = crossing2.y;
  
  this.buttress_max_u = Math.min(this.buttress_max_u, 1100);
  this.buttress_min_u = Math.max(this.buttress_min_u,-10);
  this.buttress_max_v = Math.min(this.buttress_max_v, 150);
  this.buttress_min_v = Math.max(this.buttress_min_v, -150);

  // if(this.buttress_min_v < -120 ) this.buttress_min_v = -120;
  // if(this.buttress_max_v >  120 ) this.buttress_max_v =  120;

  console.log("MRI ZOOM",
  this.buttress_min_u,
  this.buttress_max_u,
  this.buttress_min_v,
  this.buttress_max_v
  );
  this.Resize();
  this.Draw();
};



MRI.prototype.NewHits = function()
{
  // Sort by hit start time.
  var inhits = GetSelected("hits");
  if(inhits.length===0) return;
  
  // Get calibration
  this.t0 = [gGeo.getTDCofX(0,0),gGeo.getTDCofX(1,0),gGeo.getTDCofX(2,0)];
  
  // copy hits list, including deltas.
  this.hits = [];
  for(var i=0;i<inhits.length;i++) {
    var hit = inhits[i];
    var t_corr = hit.t - this.t0[hit.plane];
    this.hits.push({tc: t_corr, h:hit});
  }
  // this.hits = hits.slice(0); // copy.
  this.hits.sort(function(a,b) { return a.tc - b.tc; }); 
  var imid = Math.floor(this.hits.length/2);
  var d = this.t[1]-this.t[0];
  this.t[0] = this.hits[imid].tc;
  this.t[1] = this.t[0]+d;
  this.ChangeT();  
  this.has_been_adjusted = false;
  
};

MRI.prototype.ChangeTends = function(values)
{
  this.t = values;
  var d = this.t[1] -this.t[0];
  this.slider_grip.slider('value',this.t[0]);
  this.slider_window_size.slider('value',d) ;
  // adjust the width of the gripslider
  // var ends = $("a.ui-slider-handle",this.slider_ends)
  // var left = ends.first().position().left;
  // var right = ends.last().position().left;// + ends.last().width();
  // console.log("left,right:",left,right);
  //$(".ui-slider-handle",this.slider_grip).css("width",right-left);
  this.ChangeT();
};

MRI.prototype.ChangeTwindow = function( value )
{
  this.t[1] = this.t[0] + value;
  // Change the endpoint slider.
  this.slider_ends.slider('values',0,this.t[0]);
  this.slider_ends.slider('values',1,this.t[1]);
  this.ChangeT();
};

MRI.prototype.ChangeTgrip = function( value )
{
  // The grip bar has been moved.
  var d = this.t[1] -this.t[0];
  this.t = [value, value+d];
  // Change the endpoint slider.
  this.slider_ends.slider('values',0,this.t[0]);
  this.slider_ends.slider('values',1,this.t[1]);
  this.slider_window_size.slider('value',d);
  
  this.ChangeT();
};


MRI.prototype.ChangeT = function( )
{
  // The Z range has changed.
  var self = this;
  // Write the legend into the slider bars.
  $("a.ui-slider-handle",this.slider_ends).each(function(i){
    $(this).text(  Math.floor(self.t[i],1) );
  });
  $("a.ui-slider-handle",this.slider_grip).text(this.t[0]+":"+this.t[1]);
  $("a.ui-slider-handle",this.slider_window_size).text(this.t[1]-this.t[0]);
  if(this.t[0] != this.slider_grip.slider('value')) { this.slider_grip.slider('value',this.t[0]); }
  
  this.Draw();
  gStateMachine.Trigger("changeMRIslice");
  this.has_been_adjusted = true;
};

MRI.prototype.DrawTracks = function()
{
  var tracks = GetSelected("tracks");
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
      var x = this.GetX(points[j].z);
      var y = this.GetY(points[j].y);
      var t = gGeo.getTDCofX(2,points[j].x - gGeo.wirePlaneX[2]);
      if(t>=this.t[0] && t <= this.t[1])
        pts.push([x,y]);
    }
    if(pts.length<2) continue;
    
    this.ctx.strokeStyle = "rgba(89, 169, 28, 1)";
    this.ctx.lineWidth = 2;
    
    // Draw underlay
    // Draw underlay for a selected track.
    if(gSelectState.obj && (gSelectState.obj == trk)){      
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


    // for mouseovering
    for(j=1;j<pts.length;j++) 
      this.mouseable.push({type:"track", x1:pts[j-1][0], x2:pts[j][0], y1:pts[j-1][1], y2:pts[j][1], r:this.ctx.lineWidth, obj: trk});

    this.ctx.stroke();
  }
  this.ctx.restore();
};

MRI.prototype.DrawHits = function()
{
  // Go through gHits, and find hits that match our view.
  var field = $(this.ctl_hit_field).val();
  // console.log("MRI t=",this.t[0],this.t[1]);
  var nwires_x = (this.max_u-this.min_u)/0.3;
  this.ctx.lineWidth = this.span_x / nwires_x;
  var hoverVisHit = null;
  var x1,x2,y1,y2;
  var h, gw;
  for(var i=0;i<this.hits.length;i++) {
    h = this.hits[i];
    if(h.tc<this.t[0]) continue;
    if(h.tc>this.t[1]) break;
    var c = h.h[field];
    if(c<gHitCut.min) continue;
    if(c>gHitCut.max) continue;
    gw = gGeo.getWire(h.h.plane,h.h.wire);
    this.ctx.strokeStyle = "rgba(" + gHitColorScaler.GetColor(c) +  ",0.6)";
    this.ctx.beginPath();
    x1 = this.GetX(gw.z1);
    y1 = this.GetY(gw.y1);
    x2 = this.GetX(gw.z2);
    y2 = this.GetY(gw.y2);
    this.ctx.moveTo(x1,y1);
    this.ctx.lineTo(x2,y2);
    this.ctx.stroke();
    if(gHoverState.obj == h.h) hoverVisHit = h;
    
    this.mouseable.push({type:"hit", x1:x1, x2:x2,y1:y1,y2:y2, r:this.ctx.lineWidth, obj: h.h});
    
  }
  if(hoverVisHit) {
    h = hoverVisHit;
    gw = gGeo.getWire(h.h.plane,h.h.wire);
    this.ctx.strokeStyle = "red";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    x1 = this.GetX(gw.z1);
    y1 = this.GetY(gw.y1);
    x2 = this.GetX(gw.z2);
    y2 = this.GetY(gw.y2);
    this.ctx.moveTo(x1,y1);
    this.ctx.lineTo(x2,y2);
    this.ctx.stroke();
    }
  
};

MRI.prototype.DrawMyReco = function()
{
  // Drawing the dEdX path.
  if (typeof gReco === 'undefined') return;
  if(!gReco) return;
  if(!gReco.matches) return;
  
  if (! ($("#ctl-show-reco").is(":checked")))  return;
  this.ctx.fillStyle = "rgba(0,92,0,0.5)";
  this.ctx.strokeStyle = "rgb(0,92,0)";
  

  this.ctx.save();
  for(var i=0;i<gReco.matches.length;i++)
  {
    var pt =gReco.matches[i];
    if(pt.t < this.t[0]) continue;
    if(pt.t > this.t[1]) continue;
    var x = this.GetX(pt.z);
    var y = this.GetY(pt.y);
    var r = 2;
    this.ctx.beginPath();
    this.ctx.arc(x,y,r,0,Math.PI*1.99,false);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

  }
  this.ctx.restore();
};



MRI.prototype.DrawOne = function(min_u,max_u,min_v,max_v)
{  
  this.Clear();
  this.DrawFrame();
  this.mouseable =[];

  // Set clipping region for all further calls, just to make things simpler.
  this.ctx.save();
  this.ctx.beginPath();
  this.ctx.moveTo(this.GetX(this.min_u), this.GetY(this.min_v));
  this.ctx.lineTo(this.GetX(this.max_u), this.GetY(this.min_v));
  this.ctx.lineTo(this.GetX(this.max_u), this.GetY(this.max_v));
  this.ctx.lineTo(this.GetX(this.min_u), this.GetY(this.max_v));
  this.ctx.lineTo(this.GetX(this.min_u), this.GetY(this.min_v));
  this.ctx.clip();

  
  var detBoxYZ = {
    u1: 0,
    u2: 1040,
    v1: -118,
    v2: 119
  };
  
  // this.DrawFrame();
  var x1 = this.GetX(detBoxYZ.u1);
  var x2 = this.GetX(detBoxYZ.u2);
  var y1 = this.GetY(detBoxYZ.v1);
  var y2 = this.GetY(detBoxYZ.v2);
  this.ctx.fillStyle = "rgba(0,0,0,0.2)";
  this.ctx.strokeStyle = "rgba(0,0,0,1)";
  this.ctx.beginPath();
  this.ctx.moveTo(x1,y1);
  this.ctx.lineTo(x1,y2);
  this.ctx.lineTo(x2,y2);
  this.ctx.lineTo(x2,y1);
  this.ctx.lineTo(x1,y1);
  this.ctx.stroke();
  

  
  if ($(this.ctl_show_hits).is(":checked")) {
    this.DrawHits(min_u,max_u, min_v, max_v);
  }

  // if ($(this.ctl_show_spoints).is(":checked")) {
  //   this.DrawSpacepoints(min_u,max_u, min_v, max_v, fast);
  // }

  if ($(this.ctl_show_tracks).is(":checked")) {
    this.DrawTracks(min_u,max_u, min_v, max_v);
  }
    // 
  // if ($(this.ctl_show_mc).is(":checked")) {
  //   this.DrawMC(min_u,max_u, min_v, max_v, fast);
  // }  
  // Draw tracks.
  
  if(this.fMousing)
  for(var plane=0;plane<3;plane++) {
    switch(plane) {
      case 0:     this.ctx.strokeStyle = "rgba(255,0,0,1)"; break;
      case 1:     this.ctx.strokeStyle = "rgba(0,255,0,1)"; break;
      case 2:     this.ctx.strokeStyle = "rgba(0,0,255,1)"; break;
    }
    var geowire = gGeo.getWire(plane,this.fMousedWires[plane]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.GetX(geowire.z1), this.GetY(geowire.y1));
    this.ctx.lineTo(this.GetX(geowire.z2), this.GetY(geowire.y2));
    this.ctx.stroke();
  }
  
  
  // Draw blackout region
  this.ctx.fillStyle = "black";
  
  if(min_u < detBoxYZ.u1) 
    this.ctx.fillRect( this.origin_x , this.origin_y-this.span_y, 
                        this.GetX(detBoxYZ.u1) - this.origin_x, this.span_y);

  if(max_u > detBoxYZ.u2) {
    var xmax = this.GetX(detBoxYZ.u2);
    this.ctx.fillRect( xmax , this.origin_y-this.span_y, 
                      this.span_x // too much
                      , this.span_y);
  }

  if(min_v < detBoxYZ.v1) {
    this.ctx.fillRect( this.origin_x  , this.GetY(detBoxYZ.v1), 
                      this.span_x, 
                      this.span_y // too much 
                      );
  }

  if(max_v > detBoxYZ.v2) { // FIXME: Should be number of samples.!
    this.ctx.fillRect( this.origin_x , this.origin_y-this.span_y, 
                      this.span_x, this.GetY(detBoxYZ.v2)-(this.origin_y-this.span_y));
  }
  

  this.ctx.restore();
  
  var txt = "";
  txt += "<span style='color: red'  >Plane 0: Wire " + Math.round(gZoomRegion.plane[0][0]) + " to " + Math.round(gZoomRegion.plane[0][1]) + "</span>&nbsp;&nbsp;";
  txt += "<span style='color: green'>Plane 1: Wire " + Math.round(gZoomRegion.plane[1][0]) + " to " + Math.round(gZoomRegion.plane[1][1]) + "</span>&nbsp;&nbsp;";
  txt += "<span style='color: blue' >Plane 2: Wire " + Math.round(gZoomRegion.plane[2][0]) + " to " + Math.round(gZoomRegion.plane[2][1]) + "</span>&nbsp;&nbsp;";
  txt += "<br/>";
  if(this.fMousing) {
    txt += "<span style='color:black'>Mouse:</span> " +
        "<span style='color: red'  >"+this.fMousedWires[0]+'</span> ' +
        "<span style='color: green'>"+this.fMousedWires[1]+'</span> ' +
        "<span style='color: blue' >"+this.fMousedWires[2]+'</span> ';
  }
  $('span.MRI-Info').html(txt);
  
};

MRI.prototype.DoMouse = function(ev)
{
  
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

  // Change cursor.
  switch(mouse_area) {
    case "body":         this.canvas.style.cursor = "move";      break;
    case "xscale":       this.canvas.style.cursor = "e-resize";  break;
    case "yscale":       this.canvas.style.cursor = "n-resize"; break;
  }

  var wirestart;
  
  if(this.fDragging) {
      // Update new zoom position or extent...
    if(this.fMouseStart.area == "body"){
      var dx = this.fMousePos.x - this.fMouseLast.x;
      var du = dx * (this.max_u-this.min_u)/(this.span_x);
      var dy = this.fMousePos.y - this.fMouseLast.y;
      var dv = dy * (this.max_v-this.min_v)/(this.span_y);

      // Find start wire numbers.
      
      // Translate this du/dv to wire number shift so we can rezoom.
      for(var plane = 0; plane<3; plane++) {
        wirestart = gGeo.yzToWire(plane,this.GetV(this.fMouseLast.y),this.GetU(this.fMouseLast.x));
        var wireend   = gGeo.yzToWire(plane,this.GetV(this.fMousePos.y),this.GetU(this.fMousePos.x));
        var dwire = wireend-wirestart;
        gZoomRegion.plane[plane][0]-= dwire; // move low limit
        gZoomRegion.plane[plane][1]-= dwire; // move upper limit
        console.log("Scroll to plane: ",gZoomRegion.plane[plane][0],gZoomRegion.plane[plane][1]);
      }
      
      this.fMouseLast = {};
      $.extend(this.fMouseLast,this.fMousePos); // copy.
      
    } else if(this.fMouseStart.area == "xscale") {
      var relx = this.fMousePos.x - this.origin_x;
      if(relx <= 5) relx = 5; // Cap at 5 pixels from origin, to keep it sane.
      // Want the T I started at to move to the current posistion by scaling.
      var dwires_y = gZoomRegion.plane[2][1]-gZoomRegion.plane[2][0];
      var new_dwires_y = Math.abs(this.span_x * (this.fMouseStart.u-this.min_u)/relx);
      
      gZoomRegion.setLimits(2,gZoomRegion.plane[2][0], gZoomRegion.plane[2][0] + new_dwires_y);      
    } else if(this.fMouseStart.area == "yscale") {
      var rely =  this.origin_y - this.fMousePos.y;
      if(rely <= 5) rely = 5; // Cap at 5 pixels from origin, to keep it sane.
      var new_max_v = this.span_y * (this.fMouseStart.v-this.min_v)/rely + this.min_v;
      var mid_u = (this.max_u + this.min_u)/2;
      wirestart = gGeo.yzToWire(1,new_max_v,mid_u);
      if(wirestart<gZoomRegion.plane[1][0]) wirestart = gZoomRegion.plane[1][0]+5;
      
      gZoomRegion.setLimits(1,gZoomRegion.plane[1][0],wirestart);
    
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
          }
      }
      if(ev.type=='click') {
        ChangeSelection(match);
      } else {
        // mousemove.
        if(match.obj) ChangeHover(match); // match might be null.
        else ClearHover();
        // else          ChangeHover(  { obj:{channel: gGeo.channelOfWire(this.plane,this.fMousePos.u), 
        //                          sample:  this.fMousePos.v
        //                          }
        //                         , type: "wire"});        
      }
    }
                  
  }

  if(ev.type === 'mousedown') {
      this.fDragging = true;
      $.extend(this.fMouseStart,this.fMousePos); // copy.
      $.extend(this.fMouseLast ,this.fMousePos); // copy.
      // Which area is mouse start in?
      this.fMouseStart.area = mouse_area;
      console.log("dragstart",this.fMouseStart);
  } else if(ev.type === 'mousemove' ) {
    // Update quick.
    if(this.fDragging){
      console.log("MRI zoomchangefast");
      gStateMachine.Trigger("zoomChangeFast"); 
    }
    this.dirty=true; // Do a slow draw in this view.    
  } 
  
};

