//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Globals:

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-TpcMap').each(function(){
    new TpcMap(this);
  });  
});




// Subclass of HistCanvas.
TpcMap.prototype = new Pad(null);

function TpcMap( element, path, override_settings )
{
  if(element==null) return;
  var settings = {
    log_y:false
    ,min_u: 0
    ,max_u: 200
    ,min_v:0
    ,max_v:47
    ,margin_left : 30
    ,margin_bottom : 40
    // ,draw_box :true 
    // ,draw_axes : true
    // ,draw_ticks_x:true
    // ,draw_grid_x:true
    // ,draw_tick_labels_x:true
    // ,draw_ticks_y:true
    // ,draw_grid_y:true
    // ,draw_tick_labels_y:true
    ,margin_right : 10
    ,margin_top : 10
    ,main_height: "400px"
    ,main_width: "100%"    
  };
  $.extend(settings,override_settings);

  this.top_element = element;
  this.path = path;  
  $(this.top_element).append("<div class='title' />");
  $(this.top_element).append("<div class='pad main' />");
  this.main_element = $('div.main',this.top_element).get(0);
  $(this.main_element).css("height",settings.main_height);
  $(this.main_element).css("width",settings.main_width);
  this.element = this.main_element;
  Pad.call(this, this.main_element, settings); // Give settings to Pad contructor.

  // sub-pad.
  $(this.top_element).append("<div class='pad adjunct' />");
  this.adjunctpad = $('div.adjunct',this.top_element).get(0);
  $(this.adjunctpad).css("float","left");
  $(this.adjunctpad).css("height","150");
  $(this.adjunctpad).css("width","50%");
  
  // Buttons and things.
  var ctl = '\
  <div class="TpcMap-diffradio">\
    <label><input type="radio" value="value" name="pmt-map-radio1-'+this.UniqueId+'" checked="checked"/>Value</label>\
    <label><input type="radio" value="diff"  name="pmt-map-radio1-'+this.UniqueId+'"                  />Diff</label>\
  </div>\
  ';
  $(this.top_element).append(ctl);
  this.diff_radios = $('div.TpcMap-diffradio', this.top_element);
  // console.warn($("input[value='value']",this.diff_radios));
  $(":radio",this.top_element).click(function(e){
    self.ChangeView();
  });
  // info.
  $(this.top_element).append("<div class='infopane' />");
  $(this.top_element).append("<div style='clear:both;' />");
  
  
  this.associate_hist = new HistCanvas(this.adjunctpad,{margin_left:50});
  
  
  this.hist = new Histogram;
  var self=this;
  // gStateMachine.BindObj('recordChange',this,"NewRecord");

  this.map = null;
  this.plexus = null;
  var self = this;  
  
  $(this.element).mousemove(this.DoMouse.bind(this));
  $(this.element).click(this.DoMouse.bind(this));
  this.SetMagnify();
  
  this.mynamespace= "mns" + this.gUniqueIdCounter;
  $(document).on("OmDataRecieved."+this.mynamespace, function(){return self.NewRecord()});  
  $(document).on("OmRefDataRecieved."+this.mynamespace, function(){return self.NewRecord()});  
  
  $(this.top_element).on("remove."+this.mynamespace, function(){return self.Remove()}); 
  
  gOmData.add(this.path); 
  this.plexpath = "tpc/mapwire/DirectoryInfo";
  gOmData.add(this.plexpath);
  gRefData.add(this.path); 
}

TpcMap.prototype.Remove = function()
{
  console.log("Removing ",this.path);
  gOmData.remove(this.path);
  gOmData.remove(this.plexpath);  
  $(document).off("OmDataRecieved."+this.mynamespace);
  $(document).off("OmRefDataRecieved."+this.mynamespace);
}


TpcMap.prototype.GetPmtIndex = function(pmt,gain)
{
  if(gain>1) return pmt+50;
  return pmt;
}


TpcMap.prototype.NewRecord = function()
{
  console.log("NewRecord");
  this.map   = gOmData.getObj(this.path); 
  if(!this.map)return;
  this.refmap= gRefData.getObj(this.path);

  $(".portlet-title",$(this.top_element).parent()).html(this.map.title);

  // $("div.title",this.top_element).html(this.map.title);

  this.hist = CreateGoodHistogram(50,this.map.min_content,this.map.max_content);
  for(var i=0;i<this.map.data.length;i++) this.hist.Fill(this.map.data[i]);

  this.cs = new ColorScaler("RedBluePalette");
  this.cs.min = this.hist.min;
  this.cs.max = this.hist.max;
  
  if(this.refmap) {
    this.diff_hist = new Histogram(1000,-100,100);
    for(var wire=0;wire<this.map.data.length;wire++) {
        var x = this.map.data[wire];
        var y = this.refmap.data[wire];
        var ex = Math.sqrt(x);
        if(this.map.errs) ex = this.map.errs[wire];
        var ey = Math.sqrt(y);
        if(this.refmap.errs) ey = this.refmap.errs[wire];
        var diff = x-y;
        var denom = Math.sqrt(ex*ex+ey*ey);
        if(denom<=0) denom = 1;
        var ediff = diff/denom;
        this.diff_hist.Fill(ediff);
      }    
  }
  
  this.plexus = null;
  var dirinfo = gOmData.getObj(this.plexpath);
  if(dirinfo && dirinfo.map) this.plexus = dirinfo.map;
  
  var self = this;
  
  this.associate_hist.FinishRangeChange = function(){self.Draw();}
  this.associate_hist.ChangeRange = function(minu,maxu){self.cs.min = minu; self.cs.max = maxu; HistCanvas.prototype.ChangeRange.call(this,minu,maxu);}
  this.ChangeView();
}





TpcMap.prototype.ChangeView = function()
{
  this.view_state = $(":checked",this.diff_radios).val();
  this.gain_state = parseInt($(":checked",this.gain_radios).val());
  // console.warn(this.view_state);
  
  this.associate_hist.SetLogy(false);
  if(this.view_state=='diff' && this.refmap) {
    this.associate_hist.xlabel = "(Current-Ref)/Sigma";
    this.associate_hist.ylabel = "Num Channels";
    this.associate_hist.min = this.diff_hist.min_x;
    this.associate_hist.max = this.diff_hist.max_x;
    this.associate_hist.SetHist(this.diff_hist,this.cs);
    this.associate_hist.ResetToHist(this.diff_hist); 
  } else {
    this.associate_hist.xlabel = this.map.ylabel || this.map.title;
    this.associate_hist.ylabel = "Num Channels";
    this.associate_hist.min = this.hist.min;
    this.associate_hist.max = this.hist.max;
    this.associate_hist.SetHist(this.hist,this.cs);
    this.associate_hist.ResetToHist(this.hist);     
  }
  this.cs.min = this.associate_hist.min;
  this.cs.max = this.associate_hist.max;
  
  this.Draw();
  this.associate_hist.Draw();
  
}


TpcMap.prototype.DrawOne = function(umin,umax,vmin,vmax)
{
  console.timeStamp("TpcMap.DrawOne()");
  // console.log("Drawone");

  this.Clear();
  // this.DrawFrame(umin,umax,vmin,vmax);

  this.plane_start_v = [this.max_v];
  this.plane_start_v.push(this.plane_start_v[0] - Math.ceil(2400/this.max_u) - 2);
  this.plane_start_v.push(this.plane_start_v[1] - Math.ceil(2400/this.max_u) - 2);
  this.plane_start_v.push(this.plane_start_v[2] - Math.ceil(3456/this.max_u) - 2);
  // console.log("this.plane_start_v",this.plane_start_v);
  var plane_box_height = Math.ceil(this.max_v/3);



  // Plane markers.
  this.ctx.font = this.label_font;
  this.ctx.textAlign = 'right';
  for(var p=0;p<3;p++) {
    var vtop = this.plane_start_v[p]
    var vbot = this.plane_start_v[p+1] + 2;
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(this.GetX(-2),this.GetY(vtop),3,this.GetY(vbot)-this.GetY(vtop));
    this.ctx.save();
    this.ctx.translate(this.GetX(-3),this.GetY(vtop));
    this.ctx.rotate(-Math.PI/2);
    this.ctx.fillText("Plane "+p,0,0);
    this.ctx.restore();
  }


  if(!this.map) return;

  
  this.do_diff = (this.view_state=='diff' && this.refmap);
  
  
  w = (this.GetX(1) - this.GetX(0))*0.9;
  h = (this.GetY(0) - this.GetY(1))*0.9;
  this.ctx.strokeStyle = "black";
  

  for(var wire=0;wire<this.map.data.length;wire++) {
    var plane = 0;
    var wireInPlane = wire;
    if(wire<2399)       { plane=0; wireInPlane=wire;      }
    else if(wire <4798) { plane=1; wireInPlane=wire-2399;  }
    else                { plane=2; wireInPlane=wire-4798;  }
    
    var u = wireInPlane%this.max_u;
    var v = (this.plane_start_v[plane] - Math.floor(wireInPlane/this.max_u));
    
    // if(wire%21==0) 
    // console.log(wire,plane,wireInPlane,"->",u,v);
    
    var z = this.map.data[wire]; // FIXME: diff
    var c = this.cs.GetColor(z);
    this.ctx.fillStyle = "rgb(" + c + ")";
    this.ctx.fillRect(this.GetX(u),this.GetY(v),w,h);
    if(this.fMouseInWire == wire) this.ctx.strokeRect(this.GetX(u),this.GetY(v),w,h);
  }
  
  
    
  
  console.timeStamp("TpcMap.DrawOne() Finished");
  
  // this.DrawFrame();


  
}

TpcMap.prototype.DoMouse = function(ev)
{
  var offset = getAbsolutePosition(this.canvas);
  this.fMouseX = ev.pageX - offset.x;
  this.fMouseY = ev.pageY - offset.y;
  this.fMouseU = this.GetU(this.fMouseX);
  this.fMouseV = this.GetV(this.fMouseY);
  
  this.fMouseInWire = null;
  // Locate plane.
  
  var wire, plane, wireInPlane;
  
  if(this.fMouseV>=0 && this.fMouseV<this.max_v && this.fMouseU>=0 && this.fMouseU < this.max_u) {
    var col = Math.floor(this.fMouseU);
    if(this.fMouseV > this.plane_start_v[1]) plane = 0;
    else if(this.fMouseV > this.plane_start_v[2]) plane = 1;
    else if(this.fMouseV > this.plane_start_v[3]) plane = 2;
    var row = this.plane_start_v[plane] - Math.floor(this.fMouseV+1);
    wireInPlane = row * this.max_u + col;

    wire = wireInPlane;
    if(plane==1) wire = wireInPlane + 2399
    if(plane==2) wire = wireInPlane + 4798;

    this.fMouseInWire = wire;
  }
  // if(ev.type === 'click' && this.fMouseInPmt) {
  //   // FIXME
  //   var dirinfo = gOmData.getObj(this.plexpath); 
  //   console.log("clickmap",dirinfo);
  //   if(dirinfo && dirinfo.map) {
  //     for(var i=0;i<dirinfo.map.length;i++) {
  //       var plexum = dirinfo.map[i];
  //       if(plexum.pmt == this.fMouseInPmt) {
  //         if(plexum.gain == this.fMouseInGain) {
  //           var hash = "#pmt/crate"+plexum.crate
  //           + "/card" + zeropad(plexum.card,2)
  //           + "/chan" + zeropad(plexum.channel,2);
  //           console.log("click newhash = ",hash);
  //           window.location.hash = hash;
  //         }
  //       }
  //     }
  //   }
  //   // need to associate to channel here. Not clear how.
  //   
  //   // var hash = "#tpc/crate"+this.fMouseInCrate;
  //   // if(null!=this.fMouseInCard) hash += "/card" + zeropad(this.fMouseInCard,2);
  //   // if(null!=this.fMouseInChannel) hash += "/chan" + zeropad(this.fMouseInChannel,2);
  //   // console.log("click newhash = ",hash);
  //   // window.location.hash = hash;
  // }
  // 
  // 
  var plexum = null;
  if(this.plexus) plexum = this.plexus[wire];

  if(ev.type === 'click' && this.fMouseInWire!=null && plexum && plexum.crate) {
    var hash = "#tpc/crate"+plexum.crate
                + "/card" + zeropad(plexum.card,2)
                + "/chan" + zeropad(plexum.channel,2);
                console.log("click newhash = ",hash);
                window.location.hash = hash;
  }

  var txt = "";
  if(null!=this.fMouseInWire) {
    txt += "Logical Wire Number: " + wire + "<br/>";
    txt += "Plane: " + plane + "  Wire in plane: " + wireInPlane;    
    txt += "<br/>";
    txt += "Value: " + this.map.data[wire];
    if(this.map.errs)
    txt += "+/- " + this.map.errs[wire];
    txt += "<br/><br/>";
    if(plexum) {
      txt += "Crate: " + plexum.crate + " Card: " + plexum.card + " Channel " + plexum.channel;
    }
  }
  $(".infopane",this.top_element).html(txt);
  
  
 

}

