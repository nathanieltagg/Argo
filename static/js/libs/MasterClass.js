"use strict";

// Hoverstate should also hold "channel" and "sample" if it relates to a specific wire.

// Hover Info box, which appears as a regular Portlet.
var gMasterClass = null;


$(function(){
  gMasterClass = new MasterClass();  // Object always exists, but may not have element.
})
function MasterClass(  )
{
  this.element = $('div.A-MasterClass-data').get(0);

  this.circle_tracking = false;
  this.circle_locked   = false;
  this.selecthit_tracking = false;
  this.selecthit_which = 0;
  var self = this;

  this.circle_size = 5.0; // cm

  $(".mc_button.do_hitsum").on("click", function(){ 
    
    self.circle_tracking = true; 
    self.circle_locked = false; 
    gStateMachine.Trigger("hitSumChange"); // update view
    $(this).addClass("mc_strobing");
  });
  $(".mc_button.do_hitsum_clear").on("click", function(){ 

    self.circle_tracking = false; 
    self.circle_locked = false; 
    self.selecthit_tracking = false; 
    $(self.element).html("&nbsp;");
    gStateMachine.Trigger("hitSumClear"); // update view
    $(".mc_button.do_hitsum").removeClass("mc_strobing");
    $(".mc_button.do_mc_selecthit").removeClass("mc_strobing");

  });

   $(".mc_button.do_mc_selecthit").on("click", function() {
    self.circle_tracking = false; 
    self.circle_locked = false; 
    gStateMachine.Trigger("hitSumClear"); // update view
    self.selecthit_tracking = true;
    self.selecthit_which = 0;
    var h = "<table><tr><td class='t1'></td><td class='t2'></td><td class='trkid'></td><td class='masterclasseventid'></td></tr><tr><th>t1</th><th>t2</th><th>Track ID</th><th>Event ID</th></tr></table>";
    $(self.element).html(h);
    $(this).addClass("mc_strobing");
  });


  $(".mc_button.do_mc_zenith_angles").on("click", function() {
    self.circle_tracking = false; 
    self.circle_locked = false; 
    self.selecthit_tracking = false; 
    $(self.element).html("&nbsp;");
    gStateMachine.Trigger("hitSumClear"); // update view
    $(".mc_button.do_hitsum").removeClass("mc_strobing");
    $(".mc_button.do_mc_selecthit").removeClass("mc_strobing");
    
    var tracks = GetSelected("tracks");
    
    var h = "<table><tr><td>Track ID</td><td>Zenith Angle</td></tr>";
    for(var trk of tracks) {
       h += "<tr><td>" + trk.id + "</td><td>" +(Math.acos(trk.points[0].vy)*180/Math.PI).toFixed(2) + "</td></tr>";
    }
    h+= "</table>";
   
    $(self.element).html(h);
    self.SelectAndCopy();
 });



  gStateMachine.Bind("hoverChange" ,this.HoverChange.bind(this));
  gStateMachine.Bind("selectChange",this.SelectChange.bind(this));
}

MasterClass.prototype.HoverChange = function()
{
  if(gHoverState.type=="hits" && this.selecthit_tracking) {
    if(this.selecthit_which == 0){
      $("td.t1",this.element).html(gHoverState.obj.t);
    } else {
      $("td.t2",this.element).html(gHoverState.obj.t);
    }
  }
}

MasterClass.prototype.SelectChange = function()
{
  if(gSelectState.type=="hits" && this.selecthit_tracking) {
    if(this.selecthit_which == 0){
      $("td.t1",this.element).html(gSelectState.obj.t);
      this.selecthit_which++;
      var trkid = HitToTrackIndex(gSelectState.obj);
      if(trkid) $("td.trkid",this.element).text(trkid);
      $("td.masterclasseventid",this.element).text(gRecord.header.run + ' | ' + gRecord.header.subrun + ' | ' + gRecord.header.event )
    } else {
      $("td.t2",this.element).html(gSelectState.obj.t);
      var trkid = HitToTrackIndex(gSelectState.obj);
      if(trkid) $("td.trkid",this.element).text(trkid)
      this.selecthit_which++;
      this.selecthit_tracking = false;
      $(".mc_button.do_mc_selecthit").removeClass("mc_strobing");

      this.SelectAndCopy();
    }
  }
}



MasterClass.prototype.SetTableData = function(headers,data,lock)
{

  var h = "<table>";
  h += "<tr><td>" + data.join('</td><td>') + "</td></tr>";
  h += "<tr><th>" + headers.join('</th><th>') + "</th></tr>";
  h+= "</table>";
  $(this.element).html(h);
}

MasterClass.prototype.Lock = function()
{
  this.circle_tracking = false; 
  this.circle_locked = true; 
  this.SelectAndCopy();
  gStateMachine.Trigger("hitChange"); // update view
  $(".mc_button.do_hitsum").removeClass("mc_strobing");


}


MasterClass.prototype.SelectAndCopy = function()
{
  $(this.element).mySelectContents();
  document.execCommand("copy");
}


MasterClass.prototype.DoubleClick = function (s)
{ 

  if(s.type == 'tracks') {
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
  h += noColons(trk._owner) + "</br>";
  h += "<table class='hoverinfo'>";
  var a = "<tr><td class='hoverinfo-key'>";
  var b = "</td><td class='hoverinfo-val'>";
  var c = "</td></tr>";  
  h+= a + "Start Position" + b + "<table>" 
                      + "<tr><td>x:</td><td>" +  Math.round(start.x) + "</td><td>cm</td></tr>" 
                      + "<tr><td>y:</td><td>" +  Math.round(start.y) + "</td><td>cm</td></tr>" 
                      + "<tr><td>z:</td><td>" +  Math.round(start.z) + "</td><td>cm</td></tr>" 
                      + "</table>" + c;

  h+= a + "Start Direction" + b    + "<table>" 
                      + "<tr><td>vx:</td><td>" +  (vx).toFixed(3) + "</td></tr>" 
                      + "<tr><td>vy:</td><td>" +  (vy).toFixed(3) + "</td></tr>" 
                      + "<tr><td>vz:</td><td>" +  (vz).toFixed(3) + "</td></tr>" 
                      + "</table>" + c;

  h+= a + "End Position" + b + "<table>" 
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
  

    for ( n in gRecord.associations[trk._owner]) {
      h+= a + n + b + gRecord.associations[trk._owner][n][trk._idx].length + c;
    }
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

    $(this.element).html(h).mySelectContents();
      document.execCommand("copy");

  }
};



function HitToTrackIndex(hit)
{
  // Function to get the track number associated with a hit. Useful in a couple of places.
  var hitname   =hit._owner;
  var assns =  (((gRecord||{}).associations||{})[hitname]||{});
  var trackname = GetSelectedName("tracks");  //look for the currently-selected tracks.
  var track_assn = assns[trackname];
  if(!trackname || !track_assn) {  // Maybe the current hits aren't associated with current tracks? If so, look for a track that IS associated.
    // that association not loaded, or tracks selected name not valid.
    for(var nm in assns) {
      if (nm.match(/^recob::Tracks_/)  ) { track_assn = assns[nm]; break; }
    }
  }
  if(!track_assn) return undefined;
  var trks = track_assn[hit._idx] || [];
  if(trks.length > 0) return trks[0];
}


