// Hoverstate should also hold "channel" and "sample" if it relates to a specific wire.

// Hover Info box, which appears as a regular Portlet.
var gMasterClass = null;
var gMasterClass_Data = null;

$(function(){
  $('div.A-MasterClass-data').each(function(){
     gMasterClass = new MasterClass(this);
  });  
});

function MasterClass( element )
{
  // console.debug("MCInfo::ctor",element);
  this.element = element;
  $(this.element).html("<table<tr><td>blah</td></tr></table>").mySelectContents();
}

MasterClass.prototype.SetTableData = function(headers,data,lock)
{
  var h = "<table>";
  h += "<tr><th>" + headers.join('</th><th>') + "</th></tr>";
  h += "<tr><td>" + data.join('</td><td>') + "</td></tr>";
  h+= "</table>";
  $(this.element).html(h).mySelectContents();
}


MasterClass.prototype.DoubleClick = function (s)
{ 
  console.error("DoubleClick",s);

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
  }

};

