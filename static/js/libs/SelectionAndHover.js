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
var gLastSelectState = new Datum();


function ChangeHover( datum )
{  
  if(!datum) {ClearHover(); return;}
  
  if(gHoverState.obj!=datum.obj) {
    
    gLastHoverState = $.extend({},gHoverState);  // make copy
    
    gHoverState = datum;     // make copy
    
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
  gLastSelectState = $.extend({},gSelectState);
  gSelectState = new Datum();
  gStateMachine.Trigger("selectChange");
  
}

function ChangeSelection( datum )
{
  if(!datum.obj) { ClearSelection(); return; }
  if(datum.obj && datum.obj==gSelectState.obj) {
    // Untoggle.
    gLastSelectState = $.extend({},gSelectState);
    gSelectState = new Datum();
  } else {
    gLastSelectState = gSelectState;
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
    case "mcparticles": h=ComposeMCParticleInfo(state); break;
    case "tracks": h=ComposeTrackInfo(state); break;
    case "UserTrack": h="User Track"; break;
    case "hits":
    case "clusters":
    case "showers":
    case "endpoints2d":
    case "opflashes":
    case "pfparticles":
    case "spacepoints":
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




// Track info parameters.
// Muon energy loss in Argon.
// http://pdg.lbl.gov/2019/AtomicNuclearProperties/MUE/muE_liquid_argon.txt
    //   p     CSDA Range  
    // [MeV/c]   [g/cm^2]  

var muon_range_table = [
  [6.802E+01, 3.321E+00],
  [7.686E+01, 4.859E+00],
  [8.509E+01, 6.598E+00],
  [9.285E+01, 8.512E+00],
  [1.003E+02, 1.058E+01],
  [1.074E+02, 1.278E+01],
  [1.143E+02, 1.510E+01],
  [1.210E+02, 1.752E+01],
  [1.276E+02, 2.004E+01],
  [1.403E+02, 2.531E+01],
  [1.527E+02, 3.084E+01],
  [1.647E+02, 3.659E+01],
  [1.764E+02, 4.250E+01],
  [1.994E+02, 5.473E+01],
  [2.218E+02, 6.732E+01],
  [2.546E+02, 8.666E+01],
  [2.868E+02, 1.063E+02],
  [3.396E+02, 1.394E+02],
  [3.917E+02, 1.725E+02],
  [4.432E+02, 2.056E+02],
  [4.945E+02, 2.385E+02],
  [5.455E+02, 2.711E+02],
  [5.964E+02, 3.035E+02],
  [6.471E+02, 3.357E+02],
  [6.977E+02, 3.677E+02],
  [7.987E+02, 4.310E+02],
  [8.995E+02, 4.934E+02],
  [1.000E+03, 5.552E+02],
  [1.101E+03, 6.163E+02],
  [1.301E+03, 7.368E+02],
  [1.502E+03, 8.552E+02],
  [1.803E+03, 1.030E+03] ];

var proton_range_table = [
// PSTAR: Stopping Powers and Range Tables for Protons

// ARGON                                                                   

// Kinetic   CSDA      
// Energy    Range     
// MeV       g/cm2     
  [2.750E+01, 1.111E+00],
  [3.000E+01, 1.296E+00],
  [3.500E+01, 1.704E+00],
  [4.000E+01, 2.159E+00],
  [4.500E+01, 2.661E+00],
  [5.000E+01, 3.208E+00],
  [5.500E+01, 3.799E+00],
  [6.000E+01, 4.433E+00],
  [6.500E+01, 5.108E+00],
  [7.000E+01, 5.824E+00],
  [7.500E+01, 6.580E+00],
  [8.000E+01, 7.375E+00],
  [8.500E+01, 8.207E+00],
  [9.000E+01, 9.077E+00],
  [9.500E+01, 9.983E+00],
  [1.000E+02, 1.092E+01],
  [1.250E+02, 1.614E+01],
  [1.500E+02, 2.215E+01],
  [1.750E+02, 2.888E+01],
  [2.000E+02, 3.627E+01],
  [2.250E+02, 4.426E+01],
  [2.500E+02, 5.282E+01],
  [2.750E+02, 6.189E+01],
  [3.000E+02, 7.144E+01],
  [3.500E+02, 9.184E+01],
  [4.000E+02, 1.138E+02],
  [4.500E+02, 1.370E+02],
  [5.000E+02, 1.614E+02],
  [5.500E+02, 1.869E+02],
  [6.000E+02, 2.132E+02],
  [6.500E+02, 2.403E+02],
  [7.000E+02, 2.681E+02],
  [7.500E+02, 2.965E+02],
  [8.000E+02, 3.254E+02],
  [8.500E+02, 3.548E+02],
  [9.000E+02, 3.846E+02],
  [9.500E+02, 4.148E+02],
  [1.000E+03, 4.454E+02]
];

function interp_range(table,tracklength)
{
  // Convert tracklength to densitylength
  var range = tracklength*1.396; // g/cm3
  for(var i=0;i<table.length-1;i++) {
    if(range >= table[i][1]) {
      // linear interp y1 + (x-x1)/(x2-x1)*(y2-y1)
      return table[i][0] + (range-table[i][1])/(table[i+1][1]-table[i][1])*(table[i+1][0]-table[i][0]);
    }
  }
  return "???";
}




function ComposeTrackInfo(s)
{
  var trk = s.obj;
  var id = trk._idx;
  var start =  trk.points[0];
  var end   =  trk.points[trk.points.length-1];

  var P = start.P;
  var x = start.x;
  var y = start.y;
  var z = start.z;
  var vx, vy,vz;
  if(start.vx) {
    vx = start.vx;
    vy = start.vy;
    vz = start.vz;
  } else {
    p2 = trk.points[1];
    vx = p2.x-start.x;
    vy = p2.y-start.y;
    vz = p2.z-start.z;
    v = Math.sqrt(vx*vx+vy*vy+vz*vz);
    vx = vx/v;
    vy = vy/v;
    vz = vz/v;
  }

  var endvx,endvy, endvz;
  if(end.vx) {
    endvx = end.vx;
    endvy = end.vy;
    endvz = end.vz;
  } else {
    p2 = trk.points[trk.points.length-2];
    endvx = p2.x-end.x;
    endvy = p2.y-end.y;
    endvz = p2.z-end.z;
    v = Math.sqrt(vx*vx+vy*vy+vz*vz);
    endvx = endvx/v;
    endvy = endvy/v;
    endvz = endvz/v;
  }
  var trklen = 0;
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
    trklen += Math.sqrt(dl2);
    dQ1 += trk.points[i].dQdx;
    dQ2 += trk.points[i].dQdy;
    dQ3 += trk.points[i].dQdz;
    lastx = x; 
    lasty = y;
    lastz = z;
  }
  

  var h = "<h3>Track " + id+ "</h3>";
  h += simpleName(trk._owner) + "</br>";
  h += "<table class='hoverinfo'>";
  var a = "<tr><td class='hoverinfo-key'>";
  var b = "</td><td class='hoverinfo-val'>";
  var c = "</td></tr>";  
  h+= a + "Vertex" + b + "<table>" 
                      + "<tr><td>x:</td><td>" +  Math.round(start.x) + "</td><td>cm</td></tr>" 
                      + "<tr><td>y:</td><td>" +  Math.round(start.y) + "</td><td>cm</td></tr>" 
                      + "<tr><td>z:</td><td>" +  Math.round(start.z) + "</td><td>cm</td></tr>" 
                      + "</table>" + c;

  h+= a + "Dir" + b    + "<table>" 
                      + "<tr><td>vx:</td><td>" +  (vx).toFixed(3) + "</td></tr>" 
                      + "<tr><td>vy:</td><td>" +  (vy).toFixed(3) + "</td></tr>" 
                      + "<tr><td>vz:</td><td>" +  (vz).toFixed(3) + "</td></tr>" 
                      + "</table>" + c;

  h+= a + "Endpoint" + b + "<table>" 
                      + "<tr><td>x:</td><td>" +  Math.round(end.x) + "</td><td>cm</td></tr>" 
                      + "<tr><td>y:</td><td>" +  Math.round(end.y) + "</td><td>cm</td></tr>" 
                      + "<tr><td>z:</td><td>" +  Math.round(end.z) + "</td><td>cm</td></tr>" 
                      + "</table>" + c;

  h+= a + "End direction" + b   + "<table>" 
                      + "<tr><td>vx:</td><td>" +  (vx).toFixed(3) + "</td><td>cm</td></tr>" 
                      + "<tr><td>vy:</td><td>" +  (vy).toFixed(3) + "</td><td>cm</td></tr>" 
                      + "<tr><td>vz:</td><td>" +  (vz).toFixed(3) + "</td><td>cm</td></tr>" 
                      + "</table>" + c;

  h+= a + "&theta;beam" + b    + (Math.acos(vz)*180/Math.PI).toFixed(2) + "<sup>o</sup>" + c;

  h+= a + "Length" + b    + trklen.toFixed(1) + " cm" + c;

  var p_muon = interp_range(muon_range_table,trklen);
  h+= a + "If stop-muon <span style='float:right;'>p=</span>" + b + p_muon.toFixed(1) + " MeV/c" + c;
  var K_proton = interp_range(proton_range_table,trklen);
  var p_proton = Math.sqrt(K_proton*K_proton - 938.28*938.28);
  h+= a + "If stop-proton&nbsp; <span style='float:right;'>p=</span>" + b + p_proton.toFixed(1) + " MeV/c" + c;

  
  // horrible point info
  // Get associated hit info.
  
  
  if(gRecord.associations && gRecord.associations[trk._owner]) {
    // find an associated hit collection
    var types = Object.keys(gRecord.associations[trk._owner]);
    var hitname = types.find(function(name){return name.match(/^recob::Hits_/);});
    if(hitname) {
      var hitids  = gRecord.associations[trk._owner][hitname][trk._idx];
      var hitlist = gRecord.hits[hitname];
      if(hitlist && hitids) {
        h+= a + "All Track Info" + b + "<div class='supertiny'><table>";
        h += "<tr><th>TDC</th><th>ADC</th></tr>";
        for(var i=0;i<hitids.length;i++) { 
          var hit = hitlist[hitids[i]];
          if(hit.plane==2) {
            h+= "<tr><td>" + hit.t + "</td><td>" + hit.q + "</td></tr>";
          }
        }
        h+="</table></div>"
        h+= c;  
      }
    }
  

    // for ( n in gRecord.associations[trk._owner]) {
    //   h+= a + n + b + gRecord.associations[trk._owner][n][trk._idx].length + c;
    // }
  }

  // h+= a + "Total &Delta;Q"  + b +
  //     Math.round(dQ1) + "</br>" +
  //     Math.round(dQ2) + "</br>" +
  //     Math.round(dQ3) + "</br>" + c;
  //
  // h+= a + "&lt;dQ&gt;"  + b +
  //     Math.round(dQ1/trk.points.length) + "</br>" +
  //     Math.round(dQ2/trk.points.length) + "</br>" +
  //     Math.round(dQ3/trk.points.length) + "</br>" + c;
  
  h += "</table>";
  return h;
}

function ComposeWireInfo(s)
{
  var h = "<h3>Wire</h3>";
  h += "<table class='.hoverinfo'>";
  var a = "<tr><td class='hoverinfo-key'>";
  var b = "</td><td class='hoverinfo-val'>";
  var c = "</td></tr>";  
  h+= a + "Channel" + b + Math.floor(s.channel) + c;
  h+= a + "TDC" + b + Math.floor(s.sample) + c;
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
    case "mcparticles": h+=ComposeMCParticleInfo(state); break;
    case "tracks": h+=ComposeTrackInfo(state); break;
    case "wire": h+=ComposeWireInfo(state); break;
    
    default:
      h += "<table class='.hoverinfo'>";
      var a = "<tr><td class='hoverinfo-key'>";
      var b = "</td><td class='hoverinfo-val'>";
      var c = "</td></tr>";  
      for(var k in state.obj) {
        if(k.startsWith['_']) continue;
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
      if(other.startsWith('_')) continue;
      var assn = gRecord.associations[list_name][other][idx];
      if(!assn) continue;
      if(!assn.length) continue;
      h+= other + " [";
      var ln = assn.length;
      if(ln>5) {
        h += ln + " objects;"
      } else {
        for(var k=0;k<ln;k++) {
          var txt = assn[k];
          var link = "selectByDescription('"+other+"',"+txt+");";
          h+= "<span class='onclickfn' onclick=\"" + link +"\">" + txt + "</span> ";
          // h+= txt + " ";
        }
        if(ln<assn.length) h+= " ..."+ (assn.length-ln) + " more..." ;          
      }
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
        var type = i; 
        type = type.replace(/s$/, "");
        ChangeSelection(new Datum(type,gRecord[i][j][idx]));
        return;
      } 
      for(var k in gRecord[i][j]) {
        if(k == list) { 
          var type = j; 
          type = type.replace(/s$/, "");
          console.log("Changing to",i,j,k,idx,gRecord[i][j][k][idx]);
          ChangeSelection(new Datum(type,gRecord[i][j][k][idx]));
          return;
        } 
        
      }
    }
  }
}


// Pattern: create global if not exists. If global exists, turn global into an array and append.
var gTrackInfo_dEdX = null;
$(function(){
  $('div.A-TrackInfo-dEdX').each(function(){
    if(gTrackInfo_dEdX) {
      if(!Array.isArray(gTrackInfo_dEdX)) {
        gTrackInfo_dEdX = [gTrackInfo_dEdX];
      }
      gTrackInfo_dEdX.push(new TrackInfo_dEdX(this));
    } else {
      gTrackInfo_dEdX = new TrackInfo_dEdX(this);
    }
  });  
});

TrackInfo_dEdX.prototype = new Pad(null);

function TrackInfo_dEdX( element, options  )
{
   this.element = element;
  var settings = {
    label_font: "10pt",
    xlabel: "Charge",
    ylabel: "Hits",
    ticlog_y : false,
    suppress_zero: false,
    draw_grid_y : false,
    draw_grid_x : false,
    margin_left : 50,
    margin_bottom : 40,
    draw_box : false,
    margin_right : 10,
    margin_top : 10,
    xlabel : "TDC",
    ylabel : "ADC",
    marker: null,
        adjuct_display: false,
        adjunct_height: 0,
                adunct_label: null,
    pan_x_allow: true,
    pan_y_allow: true,
    scale_x_allow: true,
    scale_y_allow: true,
  };
  this.data = [];
  Pad.call(this, element, settings); // Give settings to Pad contructor.

  gStateMachine.Bind('hoverChange',this.HoverChange.bind(this));
  gStateMachine.Bind('selectChange',this.SelectChange.bind(this));

}
TrackInfo_dEdX.prototype.ClearHover = function()
{
}

TrackInfo_dEdX.prototype.HoverChange = function()
{}


TrackInfo_dEdX.prototype.SelectChange = function()
{
  console.error("trackinfo_dedx SelectChange");
  if(gSelectState.type!="tracks") return this.Clear();

  var trk = gSelectState.obj;
  console.error(trk._owner);
  console.log(gRecord.associations[trk._owner]);
  // find an association.
  var hitname = null;
  var trk_assns = (gRecord.associations||{})[trk._owner] || [];
  for(var product in trk_assns) {
    hitname = product;
    if(product == GetSelectedName("hits")) break; // best one!
  }
  if(!hitname) return this.Clear();
  var hits = gRecord.hits[hitname] || [];
  if(hits.length == 0) return this.Clear();

  var tmin = 1e99;
  var tmax = -1e99;
  var qmin = 1e99;
  var qmax = -1e99;
  this.data = [];

  var sumx =0 ;
  var sumx2=0;
  var sumxy=0
  var sumy =0;
  var sumy2=0;

  for(var ihit of (trk_assns[hitname][trk._idx] || [])) {
    var hit = hits[ihit];
    if(hit.plane!=2) continue; // collection hits only
    if(hit.t<tmin) tmin = hit.t;
    if(hit.t>tmax) tmax = hit.t;    
    if(hit.q<qmin) qmin = hit.q;
    if(hit.q>qmax) qmax = hit.q;
    this.data.push([hit.t,hit.q]);
    sumx +=hit.t;
    sumx2+=hit.t*hit.t;
    sumxy+=hit.t*hit.q;
    sumy +=hit.q;
    sumy2+=hit.q*hit.q;
  }
  this.min_u = tmin;
  this.max_u = tmax;
  this.min_v = qmin;
  this.max_v = qmax;

  var n = this.data.length;
  var d = (n*sumx2 - sumx*sumx);
  this.fit_slope = (n*sumxy - sumx*sumy)/d;
  this.fit_intercept = (sumy*sumx2 - sumx*sumxy)/d;

  var d =((this.data.length)*sumxy - sumx*sumy)
  this.Draw();
}

TrackInfo_dEdX.prototype.Draw = function()
{
  // console.log("HistCanvas::Draw",this);
  this.Clear();
  this.DrawFrame();
  // Clip region.
  this.ctx.save();
  this.ctx.beginPath();
  this.ctx.moveTo(this.GetX(this.min_u), this.GetY(this.min_v));
  this.ctx.lineTo(this.GetX(this.max_u), this.GetY(this.min_v));
  this.ctx.lineTo(this.GetX(this.max_u), this.GetY(this.max_v));
  this.ctx.lineTo(this.GetX(this.min_u), this.GetY(this.max_v));
  this.ctx.lineTo(this.GetX(this.min_u), this.GetY(this.min_v));
  this.ctx.clip();

  this.ctx.strokeStyle='black';
  this.ctx.lineWidth = 1; 
  this.ctx.beginPath();
  for( var datum of this.data) {
    var x = this.GetX(datum[0]);
    var y = this.GetY(datum[1]);
    this.ctx.moveTo(x-2,y);
    this.ctx.lineTo(x+2,y);
    this.ctx.moveTo(x,y-2);
    this.ctx.lineTo(x,y+2);
  }
  this.ctx.stroke();

  this.ctx.strokeStyle = 'red';
  this.ctx.lineWidth = 2;
  this.ctx.beginPath();
  this.ctx.moveTo(this.GetX(this.min_u), this.GetY(this.fit_intercept+this.fit_slope*this.min_u));
  this.ctx.lineTo(this.GetX(this.max_u), this.GetY(this.fit_intercept+this.fit_slope*this.max_u));
  this.ctx.stroke();

  this.ctx.restore();

  $(".TrackInfo-dEdX-fit").text("Fit slope: "+this.fit_slope.toFixed(4)+" ADC/TDC")
};


