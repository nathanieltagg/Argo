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
    eval( "var element_settings_obj = { " + element_settings + '};'); // override from 'settings' attribute of html object.
    // console.log(element_settings, element_settings_obj);
    $.extend(true,this,element_settings_obj); // Change default settings by provided overrides.
  }
  this.txt_element   = $(".WireInfo-text",this.element)[0];
  this.graph_element = $(".WireInfo-graph",this.element)[0];

  this.graph = new GraphCanvas( this.graph_element, {xlabel:"TDC", ylabel:"ADC", margin_left: 40} );
  this.graphdata = new Histogram(50,0,50);
  this.graph_data = [];
  for(var i = -(this.show_nwires_below); i<= this.show_nwires_above; i++) {
    this.graph_data[i] = new Histogram(100,0,100); 
  }

  this.graph.SetHist(this.graphdata,new ColorScaleIndexed(0));
  this.graph.ResetDefaultRange();
  this.graph.Draw();

  var self=this;
  
  this.ctl_wireimg_type =  GetBestControl(this.element,"[name=show-wireimg-type]");
  $(this.ctl_wireimg_type).click(function(ev) { return self.Draw(); });
  
  
  gStateMachine.Bind('recordChange',this.NewRecord.bind(this));
  gStateMachine.Bind("hoverChange", this.Draw.bind(this));
}

WireInfo.prototype.NewRecord = function()
{
  $(this.txt_element).html("");


};

/*
WireInfo.prototype.MapData = function(typ)
{
  var loaded = true;
  var width = 0;
  var height = 0;
  var images = this[typ].images;
  for(var irow=0;irow<images.length;irow++) {
    var row_height = 0;
    var row_width =0;
    for(var icol=0;icol<images[irow].length;icol++) {
      var img = images[irow][icol];
      if( !(img.complete) ) loaded = false;
      row_width  += img.width;
      row_height = Math.max(row_height,img.height);
    }
    width = Math.max(width,row_width);
    height += row_height;
  }
  this[typ].loaded = loaded;
  if(!loaded) return;

  // Make the offscreen canvas big enough to hold entire picture.
  this[typ].offscreenCanvas.width = width;
  this[typ].offscreenCanvas.height = height;
  this[typ].offscreenCtx = this.cal.offscreenCanvas.getContext("2d");

  // Draw all of the sub-pictures in place.
  var x = 0;
  var h = 0;
  var y = 0;
  for(var irow=0;irow<images.length;irow++) {
    for(var icol=0;icol<images[irow].length;icol++) {
      var img = images[irow][icol];
      this[typ].offscreenCtx.drawImage( img, x, y);
      x += img.width;
      h = img.height;
    }
    y += h;
  }

  console.log("WireInfo " + typ + " loaded");
  this.Draw();  
};

WireInfo.prototype.MapCalData = function()
{
  this.cal.loaded = true;
  // Load up the bitmap.

  this.cal.offscreenCanvas.width  = this.cal_wire_img.width;
  this.cal.offscreenCanvas.height = this.cal_wire_img.height;
  this.cal.offscreenCtx = this.cal_offscreenCanvas.getContext("2d");
  this.cal.offscreenCtx.drawImage(this.cal_wire_img,0,0);

  this.Draw();  
};

WireInfo.prototype.MapRawData = function()
{
  this.raw.loaded = true;
  // Load up the bitmap.

  this.raw.offscreenCanvas.width  = this.raw_wire_img.width;
  this.raw.offscreenCanvas.height = this.raw_wire_img.height;
  this.raw.offscreenCtx = this.raw_offscreenCanvas.getContext("2d");
  this.raw.offscreenCtx.drawImage(this.raw_wire_img,0,0);

  this.Draw();  
};
*/

function getEncodedPngVal(imgdata, x)
{
  var i = Math.floor(x);
  var r = imgdata.data[i*4];
  var g = imgdata.data[i*4+1];
  var b = imgdata.data[i*4+2];
  return (r*256 + g ) - 0x8000;
}


WireInfo.prototype.LoadHistogramWithWireData = function( histogram, offScreenCtx, channel, tdc)
{
  if(isNaN(channel)) return;
  if(isNaN(tdc)) return;
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
  
};

WireInfo.prototype.Draw = function()
{
  $(this.txt_element).html('');
  var h = "";
  var showgraph = false;
  var tdc =0;
  var chan=0;
  var wire = 0;
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


  if(gHoverState.type == "hit") {
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
  }
  $(this.txt_element).html(h);
  
  
  
  if(!showgraph) return;
  // Pull a single horizontal line from the png into the histogram
  var offscreenCtx;
  var show_image = $(this.ctl_wireimg_type).filter(":checked").val();
  
  if(!gRecord) return;
  if(show_image == 'cal'  && gRecord._cal && gRecord._cal._tiled_canvas && gRecord._cal.tiled_canvas.loaded ) {
    offscreenCtx = gRecord._cal.tiled_canvas.ctx;
    this.graph.ylabel="Cal ADC";
  } else if( gRecord._raw && gRecord._raw.tiled_canvas && gRecord._raw.tiled_canvas.loaded ) {
    offscreenCtx = gRecord._raw.tiled_canvas.ctx;
    this.graph.ylabel="Raw ADC";    
  } else return;

  this.graph.hists = [];
  this.graph.colorscales = [];
  var maxwire = gGeo.numWires(plane);
  this.graph.max_v = -1e9;
  this.graph.min_v =  1e9;
  
  for(var i = -(this.show_nwires_below); i<= this.show_nwires_above; i++) {
    var c = i+chan;
    wire = plane+i;    
    if(c<0) continue;
    if(wire>maxwire) continue;
    this.LoadHistogramWithWireData(this.graph_data[i],offscreenCtx,c,tdc);
    var color =i;
    if(i<0) color = 10-color;
    this.graph.AddHist(this.graph_data[i],new ColorScaleIndexed(color)); 
  }

  //insist that the graph be at least 40 ADC counts tall
  var dv = this.graph.max_v - this.graph.min_v;
  if( dv < 40) {
     this.graph.max_v += (40-dv)/2; 
     this.graph.min_v -= (40-dv)/2;   
   }
  // if(this.graph.min_v > -100) this.graph.min_v = -100;
  // if(this.graph.max_v <  100) this.graph.max_v =  100;
  // this.LoadHistogramWithWireData(this.graphdata,offscreenCtx,chan,tdc);
  // this.graph.ResetToHist(this.graphdata);
  this.graph.Draw();
  
};

