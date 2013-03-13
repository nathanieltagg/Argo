//
// Code for the Arachne Event Display
// Author: Nathaniel Tagg ntagg@otterbein.edu
// 
// Licence: this code is free for non-commertial use. Note other licences may apply to 3rd-party code.
// Any use of this code must include attribution to Nathaniel Tagg at Otterbein University, but otherwise 
// you're free to modify and use it as you like.
//

// Global used by this.
gHoverWire = null;
gHoverWireSample = null;

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
  };
  
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
  this.graph.SetHist(this.graphdata,new ColorScaleIndexed(0));
  this.graph.ResetDefaultRange();
  this.graph.Draw();
  
  
  this.cal_offscreenCanvas = document.createElement("canvas");
  this.raw_offscreenCanvas = document.createElement("canvas");

  var self=this;
  gStateMachine.BindObj('recordChange',this,"NewRecord");
  gStateMachine.BindObj("hoverWireChange",this,"Draw");
  
}

WireInfo.prototype.NewRecord = function()
{
  $(this.txt_element).html("");
  this.cal_loaded = false;
  this.raw_loaded = false;
  // ofscreen image.
  this.cal_wire_img = new Image();
  this.raw_wire_img = new Image();
  
  var self = this;

  this.cal_wire_img.src = gRecord.cal.wireimg_encoded_url;
  this.raw_wire_img.src = gRecord.raw.wireimg_encoded_url;
  this.cal_wire_img.onload = function() {   // Callback when the png is actually there...
    self.MapCalData();
  }
  this.raw_wire_img.onload = function() {   // Callback when the png is actually there...
    self.MapRawData();
  }
  
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

WireInfo.prototype.Draw = function()
{
  $(this.txt_element).html('');
  if(!gHoverWire) return;
  

  var h = "";
  var tdc = Math.max(Math.floor(gHoverWireSample),0);
  var chan = Math.floor(gHoverWire.channel);
  h += "Channel: " +  chan + '<br/>';
  var planewire = gGeo.wireOfChannel(chan);
  h += "Plane: " + planewire.plane + "  Wire: " +  planewire.wire + '<br/>';
  h += "TDC: " +tdc + '<br/>';
  
  var nbins = this.graphdata.n;
  this.graphdata.Clear();
  
  // Get imagedata for this wire.
  var imgdata = null;
  var y = chan;
  
  // Pull a single horizontal line from the png.
  if(this.cal_loaded) {
    imgdata = this.cal_offscreenCtx.getImageData(0,y,this.cal_offscreenCanvas.width,1);
    this.graph.ylabel="Cal ADC";
  } else if(this.raw_loaded) {
    imgdata = this.raw_offscreenCtx.getImageData(0,y,this.raw_offscreenCanvas.width,1);
    this.graph.ylabel="Raw ADC";
    
  }
  var start = tdc-nbins/2;
  if(start<0) start = 0;
  var end = start+nbins;
  if(end > imgdata.width) { end = imgdata.width; start = end-nbins;}
    
  this.graphdata.min = start;
  this.graphdata.max = end;
  for(var i=start;i<end;i++) {
    this.graphdata.Fill(i,getEncodedPngVal(imgdata,i));
  }
  
  
  $(this.txt_element).html(h);
  this.graph.ResetToHist(this.graphdata);
  this.graph.Draw();
  
}

