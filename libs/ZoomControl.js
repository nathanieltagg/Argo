
// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...

$(function(){
  $('div.A-ZoomControl').each(function(){
    var o = new ZoomControl(this);
  });  
});


// Subclass of Pad.
ZoomControl.prototype = new ButtressedPad();


function ZoomRegion() {
  this.plane= [  [ gGeo.numWires(0)/2-250, gGeo.numWires(0)/2+250 ],
                 [ gGeo.numWires(1)/2-250, gGeo.numWires(1)/2+250 ],
                 [ gGeo.numWires(2)/2-250, gGeo.numWires(2)/2+250 ] ];
                 console.log('created zoomRegion',this.plane[0][0],this.plane[0][1]);

  this.tdc = [0,3200];

  this.wireview_aspect_ratio = 2;
                 
  this.copy = function() {
    return $.extend(true,{},this);
  };
  
  this.getCenter = function(){
    return [ (this.plane[0][0]+this.plane[0][1])/2 ,
             (this.plane[1][0]+this.plane[1][1])/2 ,
             (this.plane[2][0]+this.plane[2][1])/2 ];
  };

   
  this.getDWire = function(plane,deltaWire){
    var dwire = [0,0,0];
    switch(plane) {
      case 0: dwire = [ deltaWire        ,-deltaWire*kcos60, deltaWire*kcos60 ]; break;
      case 1: dwire = [-deltaWire*kcos60 , deltaWire       , deltaWire*kcos60 ]; break;
      case 2: dwire = [ deltaWire*kcos60 , deltaWire*kcos60, deltaWire        ]; break;
    }
    return dwire;
  };

  this.changeTimeRange = function(low,high)
  {
    if(low === undefined) low = 0;
    if(high === undefined) high = 9600;
    this.tdc=[low,high];
    if($('.ctl-lock-aspect-ratio:checked').length>0) {
      
      var newWireWidth = (high-low) / (gGeo.fTdcWirePitch * this.wireview_aspect_ratio);    
      console.log("adjusting for aspect ratio ",newWireWidth);
      for(var ip=0;ip<3;ip++) {
        console.log("changeTimeRange",ip);
        
        var center = (this.plane[ip][0]+this.plane[ip][1])/2;
        this.plane[ip][0] = center - newWireWidth/2;
        this.plane[ip][1] = center + newWireWidth/2;
        if(isNaN(this.plane[ip][0])) debugger;
        if(isNaN(this.plane[ip][1])) debugger;
      }

    }    
  };

  this.moveZoomCenter = function(plane,deltaWire)
  {
    console.log("moveZoomCenter",plane,deltaWire);
    
    var dwire = this.getDWire(plane,deltaWire);
    for(var ip=0;ip<3;ip++) {
      for(var il=0;il<2;il++) this.plane[ip][il]+=dwire[ip];
    }
  };
  
  this.setLimits = function(plane,wireLow,wireHigh)
  {
    console.log("setLimits",plane,wireLow,wireHigh);
    console.log(this.plane[0][0],this.plane[0][1]);
    // Jump to a new set of coordinates.
    var oldCenter = this.getCenter();
    if(isNaN(oldCenter[0]) || isNaN(oldCenter[1]) ) {debugger;}
    
    var halfWidth = (wireHigh - wireLow)/2;
    var newWire = (wireHigh+wireLow)/2;  
    var dcenter = this.getDWire(plane,newWire-oldCenter[plane]);
    
    for(var ip=0;ip<3;ip++) {
      this.plane[ip][0] = oldCenter[ip]+dcenter[ip] - halfWidth;
      this.plane[ip][1] = oldCenter[ip]+dcenter[ip] + halfWidth;
      if(isNaN(this.plane[ip][0]) || isNaN(this.plane[ip][1]) ) {debugger;}
    }
    
    if($('.ctl-lock-aspect-ratio:checked').length>0) {
      var newTDCHalfWidth = halfWidth * gGeo.fTdcWirePitch * this.wireview_aspect_ratio;    
      var centerTdc = (this.tdc[0] + this.tdc[1])/2;
      this.tdc[0] = centerTdc - newTDCHalfWidth;
      this.tdc[1] = centerTdc + newTDCHalfWidth;    
    }
  };
  
  
}

// Global
gZoomControl = null;
gZoomRegion = new ZoomRegion();

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
 
  this.ctl_zoom_auto    =  GetBestControl(this.element,".zoom-auto");
  this.ctl_zoom_full    =  GetBestControl(this.element,".zoom-full");
  this.ctl_dedx_path    =  GetBestControl(this.element,".dEdX-Path");

  $(this.ctl_zoom_auto  ).click(function(ev) { return self.AutoZoom(); });
  $(this.ctl_zoom_full  ).click(function(ev) { return self.FullZoom(); }); 
  $('#ctl-TrackLists')      .change(function(ev) { return self.Draw(); });
  $('#ctl-SpacepointLists') .change(function(ev) { return self.Draw(); });
 
 
 
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  gStateMachine.BindObj('zoomChange',this,"Draw");
  gStateMachine.BindObj('zoomChangeFast',this,"Draw");
  gStateMachine.BindObj('hoverChange',this,"Draw");  
  gStateMachine.BindObj('selectChange',this,"Draw");
  
}


ZoomControl.prototype.AutoZoom = function()
{
  if(!gRecord) return;
  if(!gRecord.hits) return this.FullZoom();
  var hitsListName = $("#ctl-HitLists").val();
  var hits = gRecord.hits[hitsListName];
  if(!hits) return this.FullZoom();
  
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
          var iy = Math.floor(hit.t/width_tdc - offset_y);
          if(ix>=nbox_x) console.warn("autozoom wtf?");
          gridboxes[ix+iy*nbox_x] += 1;
        }
      }
      // console.log(gridboxes);
      for(var iy=0;iy<nbox_y; iy++) {
        for(var ix=0;ix<nbox_x;ix++) {
          var n = gridboxes[ix+nbox_x*iy];
          console.log(ix,iy,ix+nbox_x*iy,n);
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
  console.log("Most hits in box:",most_xbox,most_ybox,most_xoff,most_yoff,"n:",most);
  var tdc_lo = (most_ybox+most_yoff)*width_tdc;
  var tdc_hi = (most_ybox+most_yoff+1)*width_tdc;

  var wire_lo = (most_xbox+most_xoff)*width_wire;
  var wire_hi = (most_xbox+most_xoff+1)*width_wire;
  console.log("Zoom to box:",wire_lo,wire_hi,tdc_lo,tdc_hi);
  // gZoomRegion.tdc[0] = tdc_lo;
  // gZoomRegion.tdc[1] = tdc_hi;

  // This is totally confusing: this code fails totally, even though doing each operation independently is fine,
  // or doing it with manual controls.
  // :-(
      
  console.log("Zoom to wire",wire_lo,wire_hi," tdc ",tdc_lo,tdc_hi);
  gZoomRegion.setLimits(2,wire_lo,wire_hi);
  gZoomRegion.changeTimeRange(tdc_lo,tdc_hi);
  // console.warn("AutoZoom wire",wire_lo,wire_hi," tdc ",tdc_lo,tdc_hi);
  gStateMachine.Trigger("zoomChange");
  
  
  
  // This algorithm worked OK for single-event files.
  // var source = null;
  //
  // var sacrifice = 0.1;
  // var wire_pad = 20;
  //
  // var hitsListName = $("#ctl-HitLists").val();
  // if(hitsListName && gRecord.hit_hists && gRecord.hit_hists[hitsListName]) source = gRecord.hit_hists[hitsListName];
  // else if(gCurName.cal) source = gRecord.cal[gCurName.cal];
  // else if(gCurName.raw) source = gRecord.raw[gCurName.raw];
  // // else return;
  //
  // console.warn("Zoom Control Source:",source);
  //
  // if(source){
  //   if(source.timeHist){
  //     var timeHist = HistogramFrom(source.timeHist);
  //     var time_bounds = timeHist.GetROI(0.03);
  //     gZoomRegion.tdc[0] = time_bounds[0]-20;
  //     gZoomRegion.tdc[1] = time_bounds[1]+20;
  //     console.log("AutoZoom: Time: ",gZoomRegion.tdc[0], gZoomRegion.tdc[1]);
  //   } else {
  //     gZoomRegion.tdc[0] = 0;
  //     gZoomRegion.tdc[1] = 3200;
  //   }
  //
  //
  //   if(source.planeHists) {
  //     var plane0Hist = HistogramFrom(source.planeHists[0]);
  //     var plane0_bounds = plane0Hist.GetROI(sacrifice);
  //     console.log("AutoZoom: Plane 0: ",plane0_bounds[0],plane0_bounds[1],plane0Hist.GetMean());
  //
  //     delete source.planeHists[1]._owner;
  //     var plane1Hist = $.extend(true,new Histogram(1,0,1), source.planeHists[1]);
  //     var plane1_bounds = plane1Hist.GetROI(sacrifice);
  //     console.log("AutoZoom: Plane 1: ",plane1_bounds[0],plane1_bounds[1],plane1Hist.GetMean());
  //
  //     delete source.planeHists[2]._owner;
  //     var plane2Hist = $.extend(true,new Histogram(1,0,1), source.planeHists[2]);
  //     var plane2_bounds = plane2Hist.GetROI(sacrifice);
  //     console.log("AutoZoom: Plane 2: ",plane2_bounds[0],plane2_bounds[1],plane2Hist.GetMean());
  //
  //
  //     gZoomRegion.setLimits(0,plane0_bounds[0]   ,plane0_bounds[1]);
  //     gZoomRegion.setLimits(0,plane1_bounds[0]   ,plane1_bounds[1]);
  //     gZoomRegion.setLimits(2,plane2_bounds[0]-10,plane2_bounds[1]+10);
  //     if(!isNaN(plane2Hist.GetMean()))
  //       gZoomRegion.setLimits(2,plane2Hist.GetMean()-1 ,plane2Hist.GetMean()+1);
  //     if(!isNaN(plane0Hist.GetMean()))
  //       gZoomRegion.setLimits(0,plane0Hist.GetMean()-1 ,plane0Hist.GetMean()+1);
  //     if(!isNaN(plane1Hist.GetMean()))
  //       gZoomRegion.setLimits(1,plane1Hist.GetMean()-1 ,plane1Hist.GetMean()+1);
  //
  //     gZoomRegion.setLimits(2,plane2_bounds[0]-wire_pad,plane2_bounds[1]+wire_pad);
  //   }
  // } else { // No source available. Maybe try hits?
  //   this.FullZoom();
  //   return;
  //  }
  //
  // console.log("zoomChange?");
  // gStateMachine.Trigger("zoomChange");
};

ZoomControl.prototype.FullZoom = function()
{
  
  var h = gGeo.numWires(2)/2;
  gZoomRegion.changeTimeRange(0,9600);
  gZoomRegion.plane[0]=[gGeo.numWires(0)/2-h,gGeo.numWires(0)/2+h];
  gZoomRegion.plane[1]=[gGeo.numWires(1)/2-h,gGeo.numWires(1)/2+h];
  gZoomRegion.plane[2]=[0,gGeo.numWires(2)];
  // This line looks useless, but it's not: it forces a recomputation of if aspect ratio is checked.
  gZoomRegion.setLimits(2,gZoomRegion.plane[2][0],gZoomRegion.plane[2][1]);
  console.warn("FullZoom");
  
  gStateMachine.Trigger("zoomChange");
};

ZoomControl.prototype.NewRecord = function()
{
  // First, see if something has been specified on in the URL hash
  var par = $.deparam.fragment();
  if(par.t1) {
    var t1 = parseFloat(par.t1) || 0;
    var t2 = parseFloat(par.t2) || 9600;    
    gZoomRegion.changeTimeRange(t1,t2)

    var wires= parseFloat(par.wires) || 150;
    var h = par.wires/2;
    
    var plane0 = parseFloat(par.plane0) || gGeo.numWires(0)/2;
    var plane1 = parseFloat(par.plane1) || gGeo.numWires(1)/2;
    var plane2 = parseFloat(par.plane2) || gGeo.numWires(2)/2;
    gZoomRegion.plane[0]=[plane0-h,plane0+h];
    gZoomRegion.plane[1]=[plane1-h,plane1+h];
    gZoomRegion.plane[2]=[plane2-h,plane2+h];
      
    gStateMachine.Trigger("zoomChange");
    return;
  }

  this.AutoZoom();
};


ZoomControl.prototype.DrawTracks = function()
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
      var x = this.GetX(points[j].z);
      var y = this.GetY(points[j].y);
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
    var minwire = gGeo.getWire(plane,gZoomRegion.plane[plane][0]);
    var maxwire = gGeo.getWire(plane,gZoomRegion.plane[plane][1]);
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
  txt += "<span style='color: red'  >Plane 0: Wire " + Math.round(gZoomRegion.plane[0][0]) + " to " + Math.round(gZoomRegion.plane[0][1]) + "</span>&nbsp;&nbsp;";
  txt += "<span style='color: green'>Plane 1: Wire " + Math.round(gZoomRegion.plane[1][0]) + " to " + Math.round(gZoomRegion.plane[1][1]) + "</span>&nbsp;&nbsp;";
  txt += "<span style='color: blue' >Plane 2: Wire " + Math.round(gZoomRegion.plane[2][0]) + " to " + Math.round(gZoomRegion.plane[2][1]) + "</span>&nbsp;&nbsp;";
  txt += "<br/>";
  if(this.fMousing) {
    txt += "<span style='color:black'>Mouse:</span> " +
           "<span style='color: red'  >"+Math.round(this.fMousedWires[0])+'</span> ' +
           "<span style='color: green'>"+Math.round(this.fMousedWires[1])+'</span> ' +
           "<span style='color: blue' >"+Math.round(this.fMousedWires[2])+'</span> ';
  }
  txt += "<br/>";

  var split1 = window.location.href.split('#');
  var hash = split1[1] || "";
  var split2 = split1[0].split('?');
  var par = split2[1] || "";
  var path = window.location.pathname;  

  // Sanitize the hash to prevent someone from putting a script in there.
  // hash = hash.replace(/(<([^>]+)>)/ig,"");
  // hash = hash.replace(/\"\'/ig,"");
  

  var phash = $.deparam.fragment();
  phash.t1 = gZoomRegion.tdc[0].toFixed(0);
  phash.t2 = gZoomRegion.tdc[1].toFixed(0);
  phash.wires = (gZoomRegion.plane[2][1]-gZoomRegion.plane[2][0]).toFixed(0);
  phash.plane0 = (0.5*(gZoomRegion.plane[0][0]+gZoomRegion.plane[0][1])).toFixed(0);
  phash.plane1 = (0.5*(gZoomRegion.plane[1][0]+gZoomRegion.plane[1][1])).toFixed(0);
  phash.plane2 = (0.5*(gZoomRegion.plane[2][0]+gZoomRegion.plane[2][1])).toFixed(0);
  
  var lnk = window.location.protocol + "//" + window.location.hostname + path + par + "#" + $.param(phash);
  $('a.linkzoom').attr('href',lnk);
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
        var gwires = [];
        for(var iminmax=0;iminmax<2;iminmax++) {
          var gwire = gGeo.getWire(plane,gZoomRegion.plane[plane][iminmax]);
          gwires[iminmax] = Math.round(gwire);
          
          // Is the mouse near one of these wires?
          var dist_to_line = GeoUtils.line_to_point(this.fMousePos.x,this.fMousePos.y,
              this.GetX(gwire.z1),this.GetY(gwire.y1),
              this.GetX(gwire.z2),this.GetY(gwire.y2));
          if (dist_to_line < 4) { lineHover = {plane: plane, wire: gZoomRegion.plane[plane][iminmax], minmax: iminmax};}
          // is point inside polygon?
        }
        
        // var inside = GeoUtils.is_point_in_polygon([this.fMouseU,this.fMouseV]
        //           ,[ [gwires[0].z1,gwires[0].y1]
        //            , [gwires[0].z2,gwires[0].y2]
        //            , [gwires[1].z2,gwires[1].y2]
        //            , [gwires[1].z1,gwires[1].y1]
        //            ]);
        // if(!inside) inside_hex = false;
        
        inside_hex = false;
        if( (gZoomRegion.plane[0][0] < this.fMousedWires[0]) && (this.fMousedWires[0] < gZoomRegion.plane[0][1]) &&
            (gZoomRegion.plane[1][0] < this.fMousedWires[1]) && (this.fMousedWires[1] < gZoomRegion.plane[1][1]) &&
            (gZoomRegion.plane[2][0] < this.fMousedWires[2]) && (this.fMousedWires[2] < gZoomRegion.plane[2][1]) )
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
        this.fPullStartZoom = $.extend(true,{},gZoomRegion);
      } else if(inside_hex) {
        // start move zoom center
        this.fDragging = true;
        this.fDragStartMouse = [this.fMousePos.u, this.fMousePos.v];
        this.fDragStartWires = $.extend(true,{},this.fMousedWires);
        this.fDragStartZoom = $.extend(true,{},gZoomRegion);
      }
    }
    if(ev.type === 'mousemove'){
      if(this.fPulling) {
        // Pull the edges of the zoom region
        var pullplane = this.fPullWire.plane;
        var delta_wire = this.fMousedWires[pullplane] - this.fPullStartWires[pullplane];
        if(this.fPullWire.minmax>0) delta_wire = -delta_wire;
        var old_width = this.fPullStartZoom.plane[pullplane][1] - this.fPullStartZoom.plane[pullplane][0];
        var new_width = old_width - 2*delta_wire;
        var min_width = 20;
        if(new_width < min_width) delta_wire = (old_width-min_width)/2; // Set limit: no narrower than 20 wires.
        for(plane=0;plane<3;plane++) {
          gZoomRegion.plane[plane][0] = this.fPullStartZoom.plane[plane][0] + delta_wire;          
          gZoomRegion.plane[plane][1] = this.fPullStartZoom.plane[plane][1] - delta_wire;          
        }
        this.dirty=true;
        gStateMachine.Trigger("zoomChangeFast"); // Live zooming doesn't work well.
        
              
      } else if(this.fDragging) {
        // Drag the zoom region
        for(plane=0;plane<3;plane++) {
          var delta_wire_ = this.fMousedWires[plane] - this.fDragStartWires[plane];
          gZoomRegion.plane[plane][0] = this.fDragStartZoom.plane[plane][0] + delta_wire_;
          gZoomRegion.plane[plane][1] = this.fDragStartZoom.plane[plane][1] + delta_wire_;
        }
        this.dirty=true;        
        gStateMachine.Trigger("zoomChangeFast");
      }
    }
  }
  
  
  
};
