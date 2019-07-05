
// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...

$(function(){
  $('div.A-ZoomControl').each(function(){
    var o = new ZoomControl(this);
  });  
});


// Subclass of Pad.
ZoomControl.prototype = new ButtressedPad();

// Global
gZoomControl = null;

function ZoomControl( element, options )
{
  if(element === undefined) return; // null function call.
  gZoomControl = this;
  
  var settings = {
    margin_bottom : 2,
    margin_top    : 2,
    margin_right  : 2,
    margin_left   : 2,
    // buttress_min_u :     0,    // cm
    // buttress_max_u :  1040,
    // buttress_min_v :  -120,
    // buttress_max_v :   120,
    buttress_min_u :     -10,    // cm
    buttress_max_u :  1050,
    buttress_min_v :  -125,
    buttress_max_v :   125,
    min_u :     -50,    // cm
    max_u :  1090,
    min_v :  -150,
    max_v :   150,
    draw_frame:false
  };
  $.extend(true,settings,options);  // Change default settings by provided qualities.
  ButtressedPad.call(this, element, settings); // Give settings to Pad contructor.
  
  var self = this;
  this.fMousing = false; // Mouse is in our region.
  this.fDragging = false; // Mouse is moving zoom region
  this.fPulling  = false; // Mouse is changing size of zoome region
  this.fMousedWires = [];
  this.mouseable =[];
  
  // $(this.element).bind('mousemove',function(ev) { return self.DoMouse(ev); });
  // $(this.element).bind('mousedown',function(ev) { return self.DoMouse(ev); });
  // $(window      ).bind('mouseup',function(ev) { return self.DoMouse(ev); });
  // $(this.element).bind('mouseout' ,function(ev) { return self.DoMouse(ev); });
  // 
  // $(this.element).bind('touchstart' ,function(ev) { return self.DoMouse(ev); });
  // $(this.element).bind('touchmove' ,function(ev) {  return self.DoMouse(ev); });
  // $(this.element).bind('touchend' ,function(ev) { return self.DoMouse(ev); });
 
  this.ctl_zoom_auto    =  this.GetBestControl(".zoom-auto");
  this.ctl_zoom_full    =  this.GetBestControl(".zoom-full");
  this.ctl_dedx_path    =  this.GetBestControl(".dEdX-Path");

  this.ctl_time_offset_slider = $('div#time-offset-slider');
  this.ctl_time_offset_text   = $('input#time-offset-text');

  $(this.ctl_time_offset_slider).slider({
    min:0, max:9600, step: 1, value:gZoomRegion.getTimeOffset(),
    slide: function(e,ui){ $("input#time-offset-text").val(ui.value).change(); }
  });
  $(this.ctl_time_offset_text).change(function(){
    gZoomRegion.setTimeOffset(parseFloat($(this).val()));
    gStateMachine.Trigger("zoomChange");    
  });

  // set select options for number of TPCs.
  $('input.zoomtpc').empty();
  for(var i=0;i<gGeo3.numTpcs();i++) {
    $("<option value='"+i+"'>TPC "+i+"</option>").appendTo('select.zoomtpc');
  }
  var select_tpc = Math.floor(gGeo3.numTpcs()/2);
  $('select.zoomtpc').val(select_tpc);
  gZoomRegion.setSelectedTpc( select_tpc );
  // if(gGeo3.numTpcs()==0) $('select.zoomtpc').hide();

  $('input.zoommode').change( this.ChangeMode.bind(this) );
  $('select.zoomtpc').change( this.ChangeMode.bind(this) );
  this.ChangeMode();
  
  $(this.ctl_zoom_auto  ).click(function(ev) { return self.AutoZoom(); });
  $(this.ctl_zoom_full  ).click(function(ev) { return self.FullZoom(); }); 
  gStateMachine.Bind('change-tracks', this.Draw.bind(this,false) );
  gStateMachine.Bind('change-spacepoints', this.Draw.bind(this,false) );
 
 
  gStateMachine.Bind('newRecord',this.NewRecord.bind(this));
  gStateMachine.Bind('newPiece',this.NewPiece.bind(this));
  gStateMachine.Bind('zoomChange',this.Draw.bind(this));
  gStateMachine.Bind('zoomChangeFast',this.Draw.bind(this));
  gStateMachine.Bind('hoverChange',this.HoverChange.bind(this));  
  gStateMachine.Bind('selectChange',this.Draw.bind(this));
  gStateMachine.Bind('zoomChange',this.ChangeHash.bind(this));
  gStateMachine.Bind('zoomChangeFast',this.ChangeHash.bind(this));
  
}

ZoomControl.prototype.ChangeHash = function()
{

  // Sanitize the hash to prevent someone from putting a script in there.
  // hash = hash.replace(/(<([^>]+)>)/ig,"");
  // hash = hash.replace(/\"\'/ig,"");
  var split1 = window.location.href.split('#');
  var hash = split1[1] || "";
  var split2 = split1[0].split('?');
  var par = split2[1] || "";
  var path = window.location.pathname;  

  var center = gZoomRegion.getCenter();
  phash = {x: parseInt(center.x),
           y: parseInt(center.y),
           z: parseInt(center.z),
           width: parseInt(gZoomRegion.getWidth()),
           t: parseInt(gZoomRegion.getTimeOffset()) };
    // phash.aspect = gZoomRegion.getAspect();
  
  var lnk = window.location.protocol + "//" + window.location.hostname + path + par + "#" + $.param(phash);
  $('a.linkzoom').attr('href',lnk);
  $('.linkzoom-txt').text(lnk);
  
  // Change the hash to reflect the new zoom, so that the current link can
  // be copy-pasta'ed
  
  // However, this call pollutes the browser history:
  // $.bbq.pushState({zoom:phash},0);

  // This code is looted from the BBQ stuff, and does the same job, except using the
  // location.replace() call, without polluting browser history.
  var newstate = $.extend( {}, $.deparam.fragment(), {zoom:phash} ); // merge
  var newhash = $.param.sorted(newstate); // stringify
  newhash = newhash.replace($.param.fragment.noEscape,decodeURIComponent); // Escape
  console.log("new zoom hash",newhash,phash);
  location.replace("#"+newhash); // change hash, doesn't trigger hashchange

}

ZoomControl.prototype.HoverChange = function()
{
  if(gHoverState.type=="tracks" || gLastHoverState=="tracks") this.Draw();
}


ZoomControl.prototype.ChangeMode = function()
{
  var mode = $('input.zoommode:checked').val();
  gZoomRegion.setMode(mode);
  var tpc = parseInt ( $('select.zoomtpc').val() );
  gZoomRegion.setSelectedTpc( tpc );
  if(gZoomRegion.cropMode()) $('select.zoomtpc').attr('disabled',true);
  else                       $('select.zoomtpc').removeAttr('disabled');
  gStateMachine.Trigger('changeViewMode');
}

ZoomControl.prototype.AutoZoom = function()
{
  if(!gRecord) return;
  if(!gRecord.hits) return this.FullZoom();
  var hits = GetSelected("hits");
  if(hits.length==0) return this.FullZoom();
  var   offset_hit_time = 0;
  if($('#ctl-shift-hits').is(":checked")) offset_hit_time = parseFloat( $('#ctl-shift-hits-value').val() );
  console.log("Using hits:",GetSelectedName("hits"),hits);
  // Grid it.
  var width_wire = 1000;
  var width_tdc = 1000;
  
  var nbox_x = Math.ceil(3500/width_wire)+2;
  var nbox_y = Math.ceil(9600/width_tdc)+2;
  
  var most = -1e9;
  var most_xbox = -1;
  var most_ybox = -1;
  var most_xoff = -1;
  var most_yoff = -1;
  for(var offset_x = 0;offset_x<1; offset_x +=0.2) {
    for(var offset_y = 0;offset_y<1; offset_y +=0.2) {
      
      var gridboxes = new Array(nbox_x*nbox_y).fill(0);
      for(var ihit=0;ihit<hits.length;ihit++) {
        var hit = hits[ihit];
        if(hit.plane==2) {
          var ix = Math.floor(hit.wire/width_wire - offset_x);
          var iy = Math.floor((hit.t+offset_hit_time)/width_tdc - offset_y);
          if(ix>=nbox_x) console.warn("autozoom wtf?");
          if(iy>=nbox_y) console.warn("autozoom wtf?");
          gridboxes[ix+iy*nbox_x] += hit.q;
        }
      }
      console.log(gridboxes);
      for(var iy=0;iy<nbox_y; iy++) {
        for(var ix=0;ix<nbox_x;ix++) {
          var n = gridboxes[ix+nbox_x*iy];
          if(n>most) {
            most = n;
            most_xbox = ix;
            most_ybox = iy;
            most_xoff = offset_x;
            most_yoff = offset_y;
          }
        }
      }
    }    
  }
  console.log("autozoom Most hits in box:",most_xbox,most_ybox,most_xoff,most_yoff,"n:",most);
  var tdc_lo = (most_ybox+most_yoff)*width_tdc;
  var tdc_hi = (most_ybox+most_yoff+1)*width_tdc;

  var wire_lo = (most_xbox+most_xoff)*width_wire;
  var wire_hi = (most_xbox+most_xoff+1)*width_wire;
  console.log("autozoom Zoom to box:",wire_lo,wire_hi,tdc_lo,tdc_hi);
  // gZoomRegion.tdc[0] = tdc_lo;
  // gZoomRegion.tdc[1] = tdc_hi;

  // This is totally confusing: this code fails totally, even though doing each operation independently is fine,
  // or doing it with manual controls.
  // :-(
      
  console.log("autozoom Zoom to wire",wire_lo,wire_hi," tdc ",tdc_lo,tdc_hi);
  gZoomRegion.setTdcCenter(2,(tdc_lo+tdc_hi)/2);
  gZoomRegion.setWireRange(2,wire_lo,wire_hi);
  gStateMachine.Trigger("zoomChange");
  
  
};

ZoomControl.prototype.FullZoom = function()
{
  
  var h = gGeo.numWires(2)/2;
  var tpc = gGeo.getTpc(0);
  
  gZoomRegion.setCenter(...tpc.getCenter())
  // This line looks useless, but it's not: it forces a recomputation of if aspect ratio is checked.
  gZoomRegion.setSpan(tpc.getWidths()[2]);
  // console.warn("FullZoom");
  
  gStateMachine.Trigger("zoomChange");
};

ZoomControl.prototype.NewRecord = function()
{
  // First, see if something has been specified on in the URL hash
  var par = $.deparam.fragment();
  if(par.zoom) {
    var tpc = gGeo.getTpc(0);
    
    var center = tpc.getCenter().splice(0);
    var t = parseFloat(this.ctl_time_offset_text.val());
    var width = tpc.getWidths()[2];
    if('x' in par.zoom) center[0] = parseFloat(par.zoom.x);
    if('y' in par.zoom) center[1] = parseFloat(par.zoom.y);
    if('z' in par.zoom) center[2] = parseFloat(par.zoom.z);
    if('t' in par.zoom) t = parseFloat(par.zoom.t);
    if(par.zoom.width) width = parseFloat(par.zoom.width);

    gZoomRegion.setCenter(...center);
    gZoomRegion.setTimeOffset(t);
    this.ctl_time_offset_text.val(t);
    this.ctl_time_offset_slider.slider( "option", "value", t );
    gZoomRegion.setWidth(width);
    
    console.warn("setting zoom to hash");
    gStateMachine.Trigger("zoomChange");
  } else {
    this.FullZoom();    
  }
}

ZoomControl.prototype.NewPiece = function()
{
};


ZoomControl.prototype.DrawTracks = function()
{
  
  var tracks = GetSelected("tracks");
  this.ctx.save();
  for(var i=0;i<tracks.length;i++)
  {
    var trk = tracks[i];
    var points = trk.points ||[];
    if(points.length<2) continue;
    // compile points
    var pts = [];
    var lastx = -1e9, lasty=-1e9;
    for(var j=0;j<points.length;j++) {
      // Fixme: bezier
      var x = this.GetX(points[j].z);
      var y = this.GetY(points[j].y);
      if(Math.abs(x-lastx)+ Math.abs(y-lasty)<1) continue;
      lastx = x; lasty=y;
      pts.push([x,y]);
    }
    
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


ZoomControl.prototype.Draw = function()
{  
  this.Clear();
  this.mouseable =[];
  
  // this.DrawFrame();
  var x1 = this.GetX(0);
  var x2 = this.GetX(1040);
  var y1 = this.GetY(-118);
  var y2 = this.GetY(118);
  this.ctx.fillStyle = "rgba(0,0,0,0.2)";
  this.ctx.strokeStyle = "rgba(0,0,0,1)";
  this.ctx.beginPath();
  this.ctx.moveTo(x1,y1);
  this.ctx.lineTo(x1,y2);
  this.ctx.lineTo(x2,y2);
  this.ctx.lineTo(x2,y1);
  this.ctx.lineTo(x1,y1);
  this.ctx.stroke();
  
  var geowire;
  
  // Draw some wires.
  for(var plane=0;plane<3;plane++) {
    switch(plane) {
      case 0:     this.ctx.strokeStyle = "rgb(255,0,0)"; break;
      case 1:     this.ctx.strokeStyle = "rgb(0,255,0)"; break;
      case 2:     this.ctx.strokeStyle = "rgb(0,0,255)"; break;

    }
    this.ctx.save();
    for(var wire=0;wire<gGeo.numWires(plane);wire+=100) {
      geowire = gGeo.getWire(plane,wire);
      this.ctx.lineWidth=0.2;
      this.ctx.beginPath();
      this.ctx.moveTo(this.GetX(geowire.z1), this.GetY(geowire.y1));
      this.ctx.lineTo(this.GetX(geowire.z2), this.GetY(geowire.y2));
      this.ctx.stroke();
    }
    this.ctx.restore();
  }
  
  // Draw the zoom region.
  // First, do some semi-transparent boxes.
  
  // Clip to the actual view area.
  this.ctx.save();
  this.ctx.beginPath();
  this.ctx.moveTo(x1,y1);
  this.ctx.lineTo(x1,y2);
  this.ctx.lineTo(x2,y2);
  this.ctx.lineTo(x2,y1);
  this.ctx.lineTo(x1,y1);
  this.ctx.clip();
  
  for(plane=0;plane<3;plane++) {
    switch(plane) {
      case 0:     this.ctx.fillStyle = "rgba(255,0,0,0.5)"; break;
      case 1:     this.ctx.fillStyle = "rgba(0,255,0,0.5)"; break;
      case 2:     this.ctx.fillStyle = "rgba(0,0,255,0.5)"; break;
    }
    var wires  = gZoomRegion.getWireRange(plane);
    var minwire = gGeo.getWire(plane,wires[0]);
    var maxwire = gGeo.getWire(plane,wires[1]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.GetX(minwire.z1), this.GetY(minwire.y1));
    this.ctx.lineTo(this.GetX(minwire.z2), this.GetY(minwire.y2));

    // Fill in corners.
    if(plane===0)
     this.ctx.lineTo(this.GetX(maxwire.z2), this.GetY(minwire.y2));
    if(plane==1)
     this.ctx.lineTo(this.GetX(minwire.z2), this.GetY(maxwire.y2));

    this.ctx.lineTo(this.GetX(maxwire.z2), this.GetY(maxwire.y2));
    this.ctx.lineTo(this.GetX(maxwire.z1), this.GetY(maxwire.y1));
    
    // Fill in corners.
    if(plane===0)
     this.ctx.lineTo(this.GetX(minwire.z1), this.GetY(maxwire.y1));
    if(plane==1)
     this.ctx.lineTo(this.GetX(maxwire.z1), this.GetY(minwire.y1));
    
    this.ctx.fill();
  }
  this.ctx.restore();
  
  this.DrawTracks();
  // Draw tracks.
  
  if ($(this.ctl_dedx_path).is(":checked")) {
    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = "black";

    for(var i=0;i<gUserTrack.points.length; i++) {
      var pt = gUserTrack.points[i];
      for(var ip=0;ip<3;ip++) {
        geowire = gGeo.getWire(ip,pt[ip]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.GetX(geowire.z1), this.GetY(geowire.y1));
        this.ctx.lineTo(this.GetX(geowire.z2), this.GetY(geowire.y2));
        this.ctx.stroke();        
      }
    }
  }
  
  
  
  if(this.fMousing)
  for(plane=0;plane<3;plane++) {
    switch(plane) {
      case 0:     this.ctx.strokeStyle = "rgba(255,0,0,1)"; break;
      case 1:     this.ctx.strokeStyle = "rgba(0,255,0,1)"; break;
      case 2:     this.ctx.strokeStyle = "rgba(0,0,255,1)"; break;
    }
    geowire = gGeo.getWire(plane,this.fMousedWires[plane]);
    this.ctx.beginPath();
    this.ctx.moveTo(this.GetX(geowire.z1), this.GetY(geowire.y1));
    this.ctx.lineTo(this.GetX(geowire.z2), this.GetY(geowire.y2));
    this.ctx.stroke();
  }
  
  
  // var txt = Math.round(gZoomRegion.plane[0][0]) + "-" + Math.round(gZoomRegion.plane[0][1]) + "  /  "
  //         + Math.round(gZoomRegion.plane[1][0]) + "-" + Math.round(gZoomRegion.plane[1][1]) + "  /  "
  //         + Math.round(gZoomRegion.plane[2][0]) + "-" + Math.round(gZoomRegion.plane[2][1]) ;
  var txt = "";
  var range0 = gZoomRegion.getWireRange(0);
  var range1 = gZoomRegion.getWireRange(1);
  var range2 = gZoomRegion.getWireRange(2);
  
  txt += "<span style='color: red'  >Plane 0: Wire " + Math.round(range0[0]) + " to " + Math.round(range0[1]) + "</span>&nbsp;&nbsp;";
  txt += "<span style='color: green'>Plane 1: Wire " + Math.round(range1[0]) + " to " + Math.round(range1[1]) + "</span>&nbsp;&nbsp;";
  txt += "<span style='color: blue' >Plane 2: Wire " + Math.round(range2[0]) + " to " + Math.round(range2[1]) + "</span>&nbsp;&nbsp;";
  txt += "<br/>";
  if(this.fMousing) {
    txt += "<span style='color:black'>Mouse:</span> " +
           "<span style='color: red'  >"+Math.round(this.fMousedWires[0])+'</span> ' +
           "<span style='color: green'>"+Math.round(this.fMousedWires[1])+'</span> ' +
           "<span style='color: blue' >"+Math.round(this.fMousedWires[2])+'</span> ';
  }
  txt += "<br/>";
  $('span.ZoomControl-Info').html(txt);

};

ZoomControl.prototype.DoMouse = function(ev)
{
  
  ev.originalEvent.preventDefault();
  
  
  if(ev.type === 'mouseout' || ev.type == 'touchend') {
    this.fMousing = false;
    this.fMousedWires = [];

    this.canvas.style.cursor="auto";
    document.onselectstart = null;  // Keep stupid I-bar from appearing on drag.
    this.dirty=true;
    return;
    // TODO: clear hovered objects

  } else  if (ev.type === 'mouseup') {
    if(this.fPulling)        gStateMachine.Trigger("zoomChange");
    if(this.fDragging)       gStateMachine.Trigger("zoomChange");

    this.fPulling = false;
    this.fDragging = false;
    return;
    // Finish the range change.
  } else {
    if(!this.fMouseInContentArea) return;
    this.dirty = true;

    this.fMousing = true; // mouse is inside canvas.
    document.onselectstart = function(){ return false; };// Keep stupid I-bar from appearing on drag.
    
    // Exact mouse location, in wire space
    // Find moused wires.
    
    // convert to old wire units.
    var regionwires = gZoomRegion.getWireRanges();
    
    this.fMousedWires = [];
    for(var plane = 0; plane<3; plane++) {
      this.fMousedWires[plane] = gGeo.yzToWire(plane,this.fMousePos.v,this.fMousePos.u);
      
      if(this.fMousedWires[plane]<0) this.fMousedWires[plane] = 0;
      if(this.fMousedWires[plane] >= gGeo.numWires(plane)-1) this.fMousedWires[plane] = gGeo.numWires(plane)-1;
    }

    var lineHover = null;
    var inside_hex = false;

    if(this.fDragging === false && this.fPulling === false) {
      inside_hex = true;
      for(plane=0;plane<3;plane++) {
        for(var iminmax=0;iminmax<2;iminmax++) {
          var gwire = gGeo.getWire(plane,regionwires[plane][iminmax]);
          
          // Is the mouse near one of these wires?
          var dist_to_line = GeoUtils.line_to_point(this.fMousePos.x,this.fMousePos.y,
              this.GetX(gwire.z1),this.GetY(gwire.y1),
              this.GetX(gwire.z2),this.GetY(gwire.y2));
          if (dist_to_line < 4) { lineHover = {plane: plane, wire: regionwires[plane][iminmax], minmax: iminmax};}
          // is point inside polygon?
        }
              
        inside_hex = false;
        if( (regionwires[0][0] < this.fMousedWires[0]) && (this.fMousedWires[0] < regionwires[0][1]) &&
            (regionwires[1][0] < this.fMousedWires[1]) && (this.fMousedWires[1] < regionwires[1][1]) &&
            (regionwires[2][0] < this.fMousedWires[2]) && (this.fMousedWires[2] < regionwires[2][1]) )
          inside_hex = true;
      }
      // Set cursor as required.
      if(lineHover) {
        switch(lineHover.plane) {
          case 0:       this.canvas.style.cursor = "nwse-resize"; break;
          case 1:       this.canvas.style.cursor = "nesw-resize"; break;
          case 2:       this.canvas.style.cursor = "ew-resize"; break;
        }
      } else if(inside_hex) {
        this.canvas.style.cursor = "move";
      } else {
        this.canvas.style.cursor = "auto";
      }      
    }
    
    
    if(ev.type === 'mousedown') {
      if(lineHover) {
        // start move bound(s)
        this.fPulling = true;
        this.fPullWire = lineHover;
        this.fPullStartWires = $.extend(true,{},this.fMousedWires);
        this.fPullStartZoom = $.extend(true,{},regionwires);
      } else if(inside_hex) {
        // start move zoom center
        this.fDragging = true;
        this.fDragStartMouse = [this.fMousePos.u, this.fMousePos.v];
        this.fDragStartWires = $.extend(true,{},this.fMousedWires);
        this.fDragStartZoom = $.extend(true,{},regionwires);
      }
    }
    if(ev.type === 'mousemove'){
      if(this.fPulling) {
        // Pull the edges of the zoom region
        var pullplane = this.fPullWire.plane;
        var delta_wire = this.fMousedWires[pullplane] - this.fPullStartWires[pullplane];
        if(this.fPullWire.minmax>0) delta_wire = -delta_wire;
        var old_width = this.fPullStartZoom[pullplane][1] - this.fPullStartZoom[pullplane][0];
        var new_width = old_width - 2*delta_wire;
        var min_width = 20;
        if(new_width < min_width) delta_wire = (old_width-min_width)/2; // Set limit: no narrower than 20 wires.
        gZoomRegion.setWireRange(pullplane,this.fPullStartZoom[pullplane][0] + delta_wire, this.fPullStartZoom[pullplane][1] - delta_wire);
        this.dirty=true;
        gStateMachine.Trigger("zoomChangeFast"); // Live zooming doesn't work well.
        
              
      } else if(this.fDragging) {
        // Drag the zoom region
        for(plane=0;plane<3;plane++) {
          var delta_wire_ = this.fMousedWires[plane] - this.fDragStartWires[plane];
          gZoomRegion.setWireRange(plane,this.fDragStartZoom[plane][0] + delta_wire_,this.fDragStartZoom[plane][1] + delta_wire_);
        }
        this.dirty=true;        
        gStateMachine.Trigger("zoomChangeFast");
      }
    }
  }
  
  
  
};
