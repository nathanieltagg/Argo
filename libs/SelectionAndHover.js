// Hoverstate should also hold "channel" and "sample" if it relates to a specific wire.

var gHoverState = {
  obj:  null,
  type: "none",
  collection: null,
  last: { obj:  null,type: "none", collection: null}
};


var gSelectState = {
  obj:  null,
  type: "none",
  collection: null
};


function ChangeHover( arg )
{
  if(!arg) {ClearHover(); return;}
  
  if(arg.obj!=gHoverState.obj) {
    var last = $.extend({},gHoverState);
    gHoverState = $.extend({},arg);
    gHoverState.last = last;
    console.log("HoverChange:",arg);
    gStateMachine.Trigger("hoverChange");
  }
}

function ClearHover()
{
  if(gHoverState.obj != null) {
    var last = $.extend({},gHoverState);
    var type = gHoverState.type;
    gHoverState.obj = null;
    gHoverState.type = "none";
    gHoverState.collection = null;
    gHoverState.last = last;
    gStateMachine.Trigger("hoverChange");
    
  }
}

function ClearSelection( )
{
  if(gSelectState.obj) {
    gSelectState = {obj:  null, type: "none", collection: null};
    gStateMachine.Trigger("selectChange");
  }
}

function ChangeSelection( arg )
{
  if(!arg.obj) { ClearSelection(); return; }
  if(arg.obj && arg.obj==gSelectState.obj) {
    // Untoggle.
    gSelectState = {obj:  null, type: "none", collection: null};
  } else {
    gSelectState = $.extend({},arg);
    console.warn("Selecting new object",gSelectState.obj,gSelectState.type," gHover is ",gHoverState.type);
  }
  
  gStateMachine.Trigger("selectChange");
  
}



// Hover info box which appears as overlay.
function SetOverlayPosition(x,y)
{
  $('#selected-object-info.floating').css({
    position: 'absolute',
    zIndex : 2000,
    left: x, top: y-60
  });
}


////////// Initialization
$(function(){
  gStateMachine.Bind("selectChange",DrawObjectInfo);
  $('#selected-object-info.floating').hide();
  // $('#selected-object-info .unit-ctl').buttonset();
  // $('#selected-object-info .unit-ctl input').click(DrawObjectInfo);

  // $('#selected-object-info.dialog').dialog({
  //     autoOpen: false,
  //     position: 'right',
  //     width: 200,
  //     // dragStop: function(event,ui) {
  //     //   if(clip_muon)   clip_muon.reposition();  // Fix floating copy boxes
  //     //   if(clip_proton) clip_proton.reposition();
  //     // },
  //     // resizeStop: function(event,ui) {
  //     //   if(clip_muon)   clip_muon.reposition();  // Fix floating copy boxes
  //     //   if(clip_proton) clip_proton.reposition();
  //     // }
  // });
});

function DrawObjectInfo() 
{
  var e = $('#selected-object-info');
  if(!gSelectState.obj) {
    // don't draw anything
    txt = "<span class='track_id'>No Object Selected</span><br/>";
    $(".selected-object-info",e).html(txt);
    $('#selected-object-info').stop(true,true).fadeOut();
    return;
  }

  var h = "";
  var state = gSelectState;

  switch(state.type) {
    case "mcparticle": h=ComposeMCParticleInfo(state); break;
    case "track": h=ComposeTrackInfo(state); break;
    case "UserTrack": h="User Track"; break;
    
    default:
      h = "<h3>Selected:" + state.type + "</h3>";
      h += "<table class='.hoverinfo'>";
      var a = "<tr><td class='hoverinfo-key'>";
      var b = "</td><td class='hoverinfo-val'>";
      var c = "</td></tr>";  
      for(var k in state.obj) {
        if( Object.prototype.toString.call( state.obj[k] ) === '[object Array]' ) {
          h+= a + k + b + state.obj[k].length + " items" + c;
        } else {
          h+= a + k + b + state.obj[k] + c;          
        }
      }
      h+= "</table>";
  }

  $(".selected-object-info",e).html(h);      
  $('#selected-object-info').stop(true,true).fadeIn();
}

function ComposeMCParticleInfo(s)
{
  var p = s.obj;
  var particle_name = GetParticle(p.fpdgCode);
  var start =  p.trajectory[0];
  var E = start.E;
  var px = start.px;
  var py = start.py;
  var pz = start.pz;
  var p2 = px*px + py*py + pz*pz;
  var ke = E - p.fmass;
  var eround = Math.round(ke*1000);
  var etext = eround + " MeV";
  if(eround < 1 ) {
    etext = Math.round(ke*1e6) + " keV";
  } 
  
  var end = p.trajectory[p.trajectory.length-1];
  var deltaE = (start.E - end.E) * 1000;

  var deltaX = 0;
  var lastx=start.x;
  var lasty=start.y;
  var lastz=start.z;
  for(var i=1;i<p.trajectory.length;i++) {
    var x = p.trajectory[i].x;
    var y = p.trajectory[i].y;
    var z = p.trajectory[i].z;
    var dl2 = (x-lastx)*(x-lastx) + (y-lasty)*(y-lasty) + (z-lastz)*(z-lastz);
    deltaX += Math.sqrt(dl2);
    lastx = x;
    lasty = y;
    lastz = z;
  }

  var h = "<h3>" + etext + " " + particle_name + "</h3>";
  h += "<table class='.hoverinfo'>";
  var a = "<tr><td class='hoverinfo-key'>";
  var b = "</td><td class='hoverinfo-val'>";
  var c = "</td></tr>";  
  h+= a + "Vertex" + b + "x: " +  Math.round(start.x) + " mm<br/>" 
                       + "y: " +  Math.round(start.y) + " mm<br/>" 
                       + "z: " +  Math.round(start.z) + " mm<br/>" + c;
  h+= a + "Mom'm" + b  + "px: " + Math.round(start.px*1000) + " MeV/c<br/>" 
                       + "py: " + Math.round(start.py*1000) + "  MeV/c<br/>" 
                       + "pz: " + Math.round(start.pz*1000) + "  MeV/c<br/>" + c;
  h+= a + "&lt;dE/dX&gt;" + b + Math.round(deltaE) + " MeV /<br/>" + Math.round(deltaX) + " mm" + c;
  h += "</table>";
  return h;
}


function ComposeTrackInfo(s)
{
  var trk = s.obj;
  var id = trk.id;
  var start =  trk.points[0];
  var listname = $('#ctl-TrackLists').val();

  var P = start.P;
  var x = start.x;
  var y = start.y;
  var z = start.z;
  var vx = start.vx;
  var vy = start.vy;
  var vz = start.vz;
  var length = 0;
  var dQ1 = 0;
  var dQ2 = 0;
  var dQ3 = 0;

  var deltaX = 0;
  var lastx=start.x;
  var lasty=start.y;
  var lastz=start.z;
  for(var i=1;i<trk.points.length;i++) {
    var x = trk.points[i].x;  var dx = x-lastx;
    var y = trk.points[i].y;  var dy = y-lasty;
    var z = trk.points[i].z;  var dz = z-lastz;
    var dl2 = (dx*dx) + (dy*dy) + (dz*dz);
    length += Math.sqrt(dl2);
    dQ1 += trk.points[i].dQdx;
    dQ2 += trk.points[i].dQdy;
    dQ3 += trk.points[i].dQdz;
    lastx = x;
    lasty = y;
    lastz = z;
  }

  var h = "<h3>Track " + id+ "</h3>";
  h += listname + "</br>";
  h += "<table class='.hoverinfo'>";
  var a = "<tr><td class='hoverinfo-key'>";
  var b = "</td><td class='hoverinfo-val'>";
  var c = "</td></tr>";  
  h+= a + "Vertex" + b + "x: " +  Math.round(start.x) + " mm<br/>" 
                       + "y: " +  Math.round(start.y) + " mm<br/>" 
                       + "z: " +  Math.round(start.z) + " mm<br/>" + c;
  h+= a + "Dir" + b    + "vx: " + (vx).toFixed(3) + "<br/>" 
                       + "vy: " + (vy).toFixed(3) + "<br/>" 
                       + "vz: " + (vz).toFixed(3) + "<br/>" + c;
  h+= a + "&theta;beam" + b    + (Math.acos(vz)*180/Math.PI).toFixed(2) + "<sup>o</sup>" + c;

  h+= a + "Total &Delta;Q"  + b    + Math.round(dQ1) + "</br>"
                               + Math.round(dQ2) + "</br>"
                               + Math.round(dQ3) + "</br>" + c;

  h+= a + "&lt;dQ&gt;"  + b    + Math.round(dQ1/trk.points.length) + "</br>"
                               + Math.round(dQ2/trk.points.length) + "</br>"
                               + Math.round(dQ3/trk.points.length) + "</br>" + c;
  
  h += "</table>";
  return h;
}



// Hover Info box, which appears as a regular Portlet.
var gHoverInfo = null;

$(function(){
  $('div.A-HoverInfo').each(function(){
     gHoverInfo = new HoverInfo(this);
  });  
});

function HoverInfo( element )
{
  // console.debug("MCInfo::ctor",element);
  this.element = element;
  gStateMachine.BindObj("hoverChange",this,"Draw");
}

HoverInfo.prototype.Draw = function ()
{
  var h = "";  
  var state;
  if(gSelectState.obj) {
    state = gSelectState;
  } else if(gHoverState.obj) {
    state = gHoverState;
  } else {
    $(this.element).html("");
    return;
  }
  
  switch(state.type) {
    case "mcparticle": h=ComposeMCParticleInfo(state); break;
    case "track": h=ComposeTrackInfo(state); break;
    
    default:
      h = "<h3>Selected:" + state.type + "</h3>";
      h += "<table class='.hoverinfo'>";
      var a = "<tr><td class='hoverinfo-key'>";
      var b = "</td><td class='hoverinfo-val'>";
      var c = "</td></tr>";  
      for(var k in state.obj) {
        if( Object.prototype.toString.call( state.obj[k] ) === '[object Array]' ) {
          h+= a + k + b + state.obj[k].length + " items" + c;
        } else {
          h+= a + k + b + state.obj[k] + c;          
        }
      }
      h+= "</table>";
  }
  
  h+= "</table>";
  $(this.element).html(h);
  
}

