//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Global used by this.

// Automatic runtime configuration.
// I should probably abstract this another level for a desktop-like build...
$(function(){
  $('div.A-WireInfo').each(function(){
    var o = new WireInfo(this);
  });  
});

function WireInfo( element  )
{
  gWireInfo = this;
  this.element = element;
  var settings = {
    show_nwires_below: 0,
    show_nwires_above: 0
    // show_nwires_below: 2,
    // show_nwires_above: 2
  };
  $.extend(true,this,settings);
  
  // Merge in options from element
  var element_settings = $(element).attr('settings');
  var element_settings_obj={};
  if(element_settings) {
    eval( "var element_settings_obj = { " + element_settings + '};');; // override from 'settings' attribute of html object.
    // console.log(element_settings, element_settings_obj);
    $.extend(true,this,element_settings_obj); // Change default settings by provided overrides.
  }
  this.txt_element   = $(".WireInfo-text",this.element)[0];
  this.graph_element = $(".WireInfo-graph",this.element)[0];

  this.graph = new GraphCanvas( this.graph_element, {xlabel:"TDC", ylabel:"ADC", margin_left: 40} );
  this.graphdata = new Histogram(50,0,50);
  this.graph_data = [];
  for(var i = -(this.show_nwires_below); i<= this.show_nwires_above; i++) {
    this.graph_data[i] = new Histogram(50,0,50); 
  };

  this.graph.SetHist(this.graphdata,new ColorScaleIndexed(0));
  this.graph.ResetDefaultRange();
  this.graph.Draw();

  var self=this;
  
  this.ctl_wireimg_type =  GetBestControl(this.element,"[name=show-wireimg-type]");
  $(this.ctl_wireimg_type).click(function(ev) { return self.Draw(); });
  this.cal_offscreenCanvas = document.createElement("canvas");
  this.raw_offscreenCanvas = document.createElement("canvas");

  gStateMachine.Bind('recordChange',this.NewRecord.bind(this));
  gStateMachine.Bind("hoverChange", this.Draw.bind(this));
}

WireInfo.prototype.NewRecord = function()
{
  $(this.txt_element).html("");
  this.cal_loaded = false;
  this.raw_loaded = false;
  // offscreen image.
  this.cal_wire_img = new Image();
  this.raw_wire_img = new Image();
  
  var self = this;

  if(gCurName.cal) this.cal_wire_img.src = gRecord.cal[gCurName.cal].wireimg_encoded_url;
  if(gCurName.raw) this.raw_wire_img.src = gRecord.raw[gCurName.raw].wireimg_encoded_url;
  this.cal_wire_img.onload = function() {   // Callback when the png is actually there...
    self.MapCalData();
  }
  this.raw_wire_img.onload = function() {   // Callback when the png is actually there...
    self.MapRawData();
  }


  // // Experimental: used packed image, not the full one.
  // this.ctl_wireimg_type =  GetBestControl(this.element,"[name=show-wireimg-type]");
  // this.show_image = $(this.ctl_wireimg_type).filter(":checked").val();  
  // this.packed_img = new Image();
  // if(gCurName.cal) this.packed_img.src = gRecord[this.show_image][gCurName[this.show_image]].wireimg_encoded_url;
  // this.packed_img.onload = function() {   // Callback when the png is actually there...
  //   self.MapPackedData();
  // }  
}

WireInfo.prototype.MapCalData = function()
{
  this.cal_loaded = true;
  // Load up the bitmap.

  this.cal_offscreenCanvas.width  = this.cal_wire_img.width;
  this.cal_offscreenCanvas.height = this.cal_wire_img.height;
  this.cal_offscreenCtx = this.cal_offscreenCanvas.getContext("2d");
  this.cal_offscreenCtx.drawImage(this.cal_wire_img,0,0);

  this.Draw();  
}

WireInfo.prototype.MapRawData = function()
{
  this.raw_loaded = true;
  // Load up the bitmap.

  this.raw_offscreenCanvas.width  = this.raw_wire_img.width;
  this.raw_offscreenCanvas.height = this.raw_wire_img.height;
  this.raw_offscreenCtx = this.raw_offscreenCanvas.getContext("2d");
  this.raw_offscreenCtx.drawImage(this.raw_wire_img,0,0);

  this.Draw();  
}


function getEncodedPngVal(imgdata, x)
{
  var i = Math.floor(x);
  var r = imgdata.data[i*4];
  var g = imgdata.data[i*4+1];
  var b = imgdata.data[i*4+2];
  return (r*256. + g ) - 0x8000;
}


WireInfo.prototype.LoadHistogramWithWireData = function( histogram, offScreenCtx, channel, tdc)
{
  
  var y = channel;
  var x = tdc;
  var width = offScreenCtx.canvas.width;
  var x1 = Math.round(tdc - histogram.n/2);
  if(x1<0) x1 = 0;
  var x2 = x1 + histogram.n;
  if(x2>width) {x2 = width; x1 = width - histogram.n;}

  // Pull a single horizontal line from the png.
  var imgdata = offScreenCtx.getImageData(x1,y,x2-x1,1);
  histogram.Clear();
  histogram.min = x1;
  histogram.max = x2;
  histogram.min_content=1e9;
  histogram.max_content=-1e9;
  for(var i=0;i<x2-x1;i++) {
    histogram.SetBinContent(i,getEncodedPngVal(imgdata,i));
  }
  
}

WireInfo.prototype.Draw = function()
{
  $(this.txt_element).html('');
  var h = "";
  var showgraph = false;
  var tdc =0;
  var chan=0;
  var wire = 0;;
  var plane = 0;
  if(("channel" in gHoverState) && ("sample" in gHoverState)) {
    tdc = Math.max(Math.floor(gHoverState.sample),0);
    chan = Math.floor(gHoverState.channel);
    var planewire = gGeo.wireOfChannel(chan);
    wire = planewire.wire;
    plane = planewire.plane;
    showgraph = true;
  }

  h += "Channel: " +  chan + '<br/>';
  h += "Plane: " + plane + "  Wire: " +  wire + '<br/>';
  h += "TDC: " +tdc + '<br/>';
  if(gRecord && gRecord.raw && gCurName.raw && gRecord.raw[gCurName.raw] && gRecord.raw[gCurName.raw].pedestals)
    h+="Pedestal:" + gRecord.raw[gCurName.raw].pedestals[chan] + '<br/>';


  if(gHoverState.type == "wire") {    
  } else if(gHoverState.type == "hit") {
    // console.warn("hit hover: ",gHoverState.obj);
    tdc = Math.max(Math.floor(gHoverState.obj.t),0);
    wire = gHoverState.obj.wire;
    plane = gHoverState.obj.plane;
    chan = gGeo.channelOfWire(plane,wire);
    h += "Hit: q:" + gHoverState.obj.q + " t:" + gHoverState.obj.t + "<br/>";
    h += "Channel: " +  chan + '<br/>';
    h += "Channel: " +  chan + '<br/>';
    h += "Plane: " + plane + "  Wire: " +  wire + '<br/>';
    h += "TDC: " +tdc + '<br/>';
    showgraph = true;
 
  } else if(gHoverState.type == "cluster") {
      // console.warn("hit hover: ",gHoverState.obj);
      h += "Cluster: " + gHoverState.obj.ID;
  } else {
    h += gHoverState.type;
  }
    
  $(this.txt_element).html(h);
  
  
  
  if(!showgraph) return;
  // Pull a single horizontal line from the png into the histogram
  var offscreenCtx;
  var show_image = $(this.ctl_wireimg_type).filter(":checked").val();
  
  if(show_image == 'cal' && this.cal_loaded) {
    offscreenCtx = this.cal_offscreenCtx;
    this.graph.ylabel="Cal ADC";
  } else if(this.raw_loaded) {
    offscreenCtx = this.raw_offscreenCtx;
    this.graph.ylabel="Raw ADC";    
  } else return;

  this.graph.hists = [];
  this.graph.colorscales = [];
  var maxwire = gGeo.numWires(plane);
  this.graph.max_v = -1e9;
  this.graph.min_v =  1e9;
  
  for(var i = -(this.show_nwires_below); i<= this.show_nwires_above; i++) {
    var c = i+chan;
    var wire = plane+i;    
    if(c<0) continue;
    if(wire>maxwire) continue;
    this.LoadHistogramWithWireData(this.graph_data[i],offscreenCtx,c,tdc);
    var color =i;
    if(i<0) color = 10-color;
    this.graph.AddHist(this.graph_data[i],new ColorScaleIndexed(color)); 
  }

  //insist that the graph be at least 20 ADC counts tall
  var dv = this.graph.max_v - this.graph.min_v;
  if( dv < 20) {
     this.graph.max_v += (20-dv)/2; 
     this.graph.min_v -= (20-dv)/2;   
   }
  // if(this.graph.min_v > -100) this.graph.min_v = -100;
  // if(this.graph.max_v <  100) this.graph.max_v =  100;
  // this.LoadHistogramWithWireData(this.graphdata,offscreenCtx,chan,tdc);
  // this.graph.ResetToHist(this.graphdata);
  this.graph.Draw();
  
}

