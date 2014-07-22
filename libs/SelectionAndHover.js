// Hoverstate should also hold "channel" and "sample" if it relates to a specific wire.

function Datum(type,obj)
{
  // example:
  this.type  = type || "none";
  this.obj   = obj  || null;
}

Datum.prototype.type = function ()
{
  return this.type;
  // if(!this.path) return 'none';
  // var type = this.path[0];
  // switch(type) {
  //   case "hits" : return "hit";
  //   case "clusters" : return "cluster";
  //   case "opflashes": return "opflash";
  //   case "ophit" : return "ophit";
  //   case "oppulses" : return "oppulse";
  //   case "spacepoints" : return "spacepoint";
  //   case "tracks" : return "track";
  //   case "mc" : return this.path[1];
  //   default: return type;
  // }
};


var gHoverState = new Datum();
var gLastHoverState = new Datum();

var gSelectState = new Datum();


function ChangeHover( datum )
{
  if(!datum) {ClearHover(); return;}
  
  if(gHoverState.obj!=datum.obj) {
    gLastHoverState = $.extend({},gHoverState);  // make copy
    gHoverState = $.extend({},datum);     // make copy

    console.log("HoverChange:",datum);
    gStateMachine.Trigger("hoverChange");
  }
}

function ClearHover()
{
  if(gHoverState.obj !== null) {
    gLastHoverState = $.extend({},gHoverState);
    gHoverState = new Datum();
    gStateMachine.Trigger("hoverChange");
    
  }
}

function ClearSelection( )
{
  var old = (gSelectState.obj != null); 
  gSelectState = new Datum();
  if(old) gStateMachine.Trigger("selectChange");
  
}

function ChangeSelection( datum )
{
  if(!datum.obj) { ClearSelection(); return; }
  if(datum.obj && datum.obj==gSelectState.obj) {
    // Untoggle.
    gSelectState = new Datum();
  } else {
    gSelectState = $.extend({},datum);
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
  gStateMachine.Bind("newRecord",function(){gLastHoverState = gHoverState = new Datum();gSelectionState = new Datum();});
  gStateMachine.Bind("newRecord",function(){ $('#selected-object-info.floating').hide();});
  gStateMachine.Bind("selectChange",DrawObjectInfo);
  $('#selected-object-info.floating').hide();
  $('#selected-object-info .unit-ctl').buttonset();
  $('#selected-object-info .unit-ctl input').click(DrawObjectInfo);

  $('#selected-object-info.dialog').dialog({
      autoOpen: false,
      position: 'right',
      width: 200
  });
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
      // don't draw anything
      txt = "<span class='track_id'>No Object Selected</span><br/>";
      $(".selected-object-info",e).html(txt);
      $('#selected-object-info').stop(true,true).fadeOut();
      return;

      // h = "<h3>Selected:" + state.type + "</h3>";
      // h += "<table class='.hoverinfo'>";
      // var a = "<tr><td class='hoverinfo-key'>";
      // var b = "</td><td class='hoverinfo-val'>";
      // var c = "</td></tr>";
      // for(var k in state.obj) {
      //   if( Object.prototype.toString.call( state.obj[k] ) === '[object Array]' ) {
      //     h+= a + k + b + state.obj[k].length + " items" + c;
      //   } else {
      //     h+= a + k + b + state.obj[k] + c;
      //   }
      // }
      // h+= "</table>";
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
  h+= a + "Vertex" + b + "x: " +  Math.round(start.x) + " cm<br/>" +
                         "y: " +  Math.round(start.y) + " cm<br/>" +
                         "z: " +  Math.round(start.z) + " cm<br/>" + c;
  h+= a + "Mom'm" + b  + "px: " + Math.round(start.px*1000) + " MeV/c<br/>" +
                         "py: " + Math.round(start.py*1000) + "  MeV/c<br/>" +
                         "pz: " + Math.round(start.pz*1000) + "  MeV/c<br/>" + c;
  h+= a + "&lt;dE/dX&gt;" + b + Math.round(deltaE) + " MeV /<br/>" + Math.round(deltaX) + " mm" + c;
  h += "</table>";
  return h;
}


function ComposeTrackInfo(s)
{
  var trk = s.obj;
  var id = trk._idx;
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
    x = trk.points[i].x;  var dx = x-lastx;
    y = trk.points[i].y;  var dy = y-lasty;
    z = trk.points[i].z;  var dz = z-lastz;
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
  h+= a + "Vertex" + b + "x: " +  Math.round(start.x) + " cm<br/>" +
                         "y: " +  Math.round(start.y) + " cm<br/>" +
                         "z: " +  Math.round(start.z) + " cm<br/>" + c;
  h+= a + "Dir" + b    + "vx: " + (vx).toFixed(3) + "<br/>" +
                         "vy: " + (vy).toFixed(3) + "<br/>" +
                         "vz: " + (vz).toFixed(3) + "<br/>" + c;
  h+= a + "&theta;beam" + b    + (Math.acos(vz)*180/Math.PI).toFixed(2) + "<sup>o</sup>" + c;

  h+= a + "Total &Delta;Q"  + b +
      Math.round(dQ1) + "</br>" +
      Math.round(dQ2) + "</br>" +
      Math.round(dQ3) + "</br>" + c;

  h+= a + "&lt;dQ&gt;"  + b + 
      Math.round(dQ1/trk.points.length) + "</br>" +
      Math.round(dQ2/trk.points.length) + "</br>" +
      Math.round(dQ3/trk.points.length) + "</br>" + c;
  
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
  gStateMachine.BindObj("selectChange",this,"Draw");
}

HoverInfo.prototype.Draw = function ()
{
  var h = "";  
  var state;
  var sel = false;
  if(gSelectState.obj) {
    state = gSelectState;
    sel = true;
  } else if(gHoverState.obj) {
    state = gHoverState;
  } else {
    $(this.element).html("");
    return;
  }
  h="";
  if(sel) 
    h += "<h3>Selected: " + state.type + "</h3>";
  else 
    h += "<h3>Hover: " + state.type + "</h3>";
  
  switch(state.type) {
    case "mcparticle": h+=ComposeMCParticleInfo(state); break;
    case "track": h+=ComposeTrackInfo(state); break;
    
    default:
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

  h+= "Associated with:<br/>"
  var list_name = state.obj._owner;
  var idx = state.obj._idx;
  if(list_name && (idx !== undefined) && gRecord && gRecord.associations&& gRecord.associations[list_name]) {
    for(var other in gRecord.associations[list_name]) {
      var assn = gRecord.associations[list_name][other][idx];
      if(!assn) continue;
      if(!assn.length) continue;
      h+= other + " [";
      var ln = assn.length;
      if(ln>10) ln == 10;
      for(var k=0;k<assn.length;k++) {
        var txt = assn[k];
        var link = "selectByDescription('"+other+"',"+txt+");";
        // h+= "<span onclick=\"" + link +"\">" + txt + "</span> ";
        h+= txt + " ";
      }
      if(ln<assn.length) h+= " ...";
      h+= "]</br>";
    }
  }

  $(this.element).html(h);
  
};


function selectByDescription(list,idx)
{
  for(var i in gRecord) {
    if(i=="associations") continue;
    for(var j in gRecord[i]) {
      if(j == list) { 
        console.log("Changing to",i,j,idx,gRecord[i][j][idx]);
        ChangeSelection(new Datum("unknown",gRecord[i][j][idx]));
        return;
      }
    }
  }
}
