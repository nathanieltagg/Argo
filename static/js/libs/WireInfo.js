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

WireInfo.prototype = new ABoundObject(); 

function WireInfo( element  )
{
  gWireInfo = this;
  this.element = element;
  var settings = {
    show_nwires_below: 2,
    show_nwires_above: 2
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

  this.graph = new HistCanvas( this.graph_element, {xlabel:"TDC", ylabel:"ADC", margin_left: 40} );
  this.graph.Draw();

  var self=this;
  
  this.ctl_wireimg_type =  this.GetBestControl("[name=show-wireimg-type]");
  $(this.ctl_wireimg_type).click(function(ev) { return self.Draw(); });
  
  
  gStateMachine.Bind('newRecord',this.NewRecord.bind(this));
  gStateMachine.Bind("hoverChange", this.Draw.bind(this));
  gStateMachine.Bind("ChangePsuedoColor", this.Draw.bind(this));
}

WireInfo.prototype.NewRecord = function()
{
  $(this.txt_element).html("");
};


function getEncodedPngVal(data, x)
{
  var i = Math.floor(x);
  var r = data[i*4];
  var g = data[i*4+1];
  // var b = imgdata.data[i*4+2];
  return (r*256 + g) - 0x8080;
}


function getEncodedPngValNoise(data, x)
{
  var i = Math.floor(x);
  var b = data[i*4+2];
  if(b>=0xff) return 0; // This indicates dead zone, usually around a recob::Wire ROI deadzone or a SN deadzone
  
  return b - 0x80;
}

function getEncodedExtraData(imgdata)
{
  // var b = imgdata.data[1*4+2]; // First pixel blue channel
  // return {
  //   rms: (b & 15)/2.0,
  //   servicecard: b >> 4 // Actually just the lower 4 bits
  // }
  return {};
}




// this version uses the giant offscreen ctx provided by the TiledImageCanvas
WireInfo.prototype.GetWireDataHistograms = function( offScreenCtx, channel, tdc, n)
{
  // console.log("GetWireDataHistogram",channel,tdc,n);
  if(isNaN(channel)) return;
  if(isNaN(tdc)) return;
  var y = channel;
  var x = tdc;
  var width = offScreenCtx.canvas.width;
  var x1 = Math.round(tdc - n/2);
  if(x1<0) x1 = 0;
  if(x2>width) {x1 = width - n;}
  var x2 = x1 + n;

  // var retval = getEncodedExtraData(imgdata.data);
  retval = {};
  retval.raw=          new Histogram(n,x1,x2);
  retval.noise=        new Histogram(n,x1,x2); 
  retval.noiseremoved= new Histogram(n,x1,x2);

  // Pull a single horizontal line from the png.
  var imgdata = offScreenCtx.getImageData(x1,y,x2-x1,1);
  // console.log("imgData ",imgdata.data);
  for(var i=0;i<x2-x1;i++) {
    var d = getEncodedPngVal(imgdata.data,i);
    var s = getEncodedPngValNoise(imgdata.data,i);
    retval.raw.SetBinContent(i,d);
    retval.noise.SetBinContent(i,s);
    retval.noiseremoved.SetBinContent(i,d-s);
  }
  return retval;
  
};


// This version uses giant imgdata prestored in the mapper. Fast, but has a big memory hit I think.
WireInfo.prototype.GetWireDataHistograms2 = function( mapper, channel, tdc, n)
{
  // console.log("GetWireDataHistogram",channel,tdc,n);
  if(isNaN(channel)) return;
  if(isNaN(tdc)) return;
  var y = channel;
  var x1 = Math.round(tdc - n/2);
  var x2 = x1+n;
  
  var imgdata1 = [];
  var imgdata2 = [];
  for(var irow=0;irow<mapper.tile_urls.length;irow++) {
    for(var icol=0;icol<mapper.tile_urls[irow].length;icol++) {
      var elem = mapper.tile_urls[irow][icol];
      var data = mapper.tile_rawdata[irow][icol];
      if( !(data) ) continue;
      console.log(x1,y,elem);
      if(y>=elem.y && y<elem.y+elem.height) {
        if(x1 >= elem.x && x1 < elem.x + elem.width) {
          // Start in this image.
          var n1 = Math.min(n, elem.width+elem.x-x1);
          var istart = 4*(y-elem.y)*data.width + 4*(x1-elem.x);
          var istop = istart + n1*4;
          console.log("found start",x1,x2,y,elem,istart,istop)
          imgdata1 = data.data.slice(istart,istop);
        }
        if(x2 >= elem.x && x2 < elem.x + elem.width && x1 < elem.x) {
          // second half in this image. start on left side, fill remaining
          var istart = 4*(y-elem.y); 
          var istop = istart + (x2-elem.x)*4;
          imgdata2 = data.data.slice(istart,istop);
        }
      }
      
    }
  }
  var data = new Uint8ClampedArray(imgdata1.length + imgdata2.length);
  data.set(imgdata1);
  data.set(imgdata2, imgdata1.length);
  // var data = imgdata1.concat(imgdata2);
  // console.log("rawdata ",data);
  
  // var retval = getEncodedExtraData(imgdata);
  var retval = {};
  retval.raw=          new Histogram(n,x1,x2);
  retval.noise=        new Histogram(n,x1,x2); 
  retval.noiseremoved= new Histogram(n,x1,x2);

  // Pull a single horizontal line from the png.
  for(var i=0;i<data.length;i++) {
    var d = getEncodedPngVal(data,i);
    var s = getEncodedPngValNoise(data,i);
    retval.raw.SetBinContent(i,d);
    retval.noise.SetBinContent(i,s);
    retval.noiseremoved.SetBinContent(i,d-s);
  }
  return retval;
  
};

// This version uses giant imgdata prestored in the mapper. Fast, but has a big memory hit I think.
WireInfo.prototype.GetWireDataHistograms3 = function( mapper, channel, tdc, n)
{
  // console.log("GetWireDataHistogram",channel,tdc,n);
  if(isNaN(channel)) return;
  if(isNaN(tdc)) return;
  var y = channel;
  if(x1<0) x1=0;
  var x1 = Math.round(tdc - n/2);
  var x2 = x1+n;
  
  var imgdata1 = [];
  var imgdata2 = [];
  for(var irow=0;irow<mapper.tile_urls.length;irow++) {
    for(var icol=0;icol<mapper.tile_urls[irow].length;icol++) {
      var elem = mapper.tile_urls[irow][icol];
      var canvas = mapper.tile_canvases[irow][icol];
      if( !(canvas) ) continue;
      if(y>=elem.y && y<elem.y+elem.height) {
        if(x1 >= elem.x && x1 < elem.x + elem.width) {
          // Start in this image.
          var n1 = Math.min(n, elem.width+elem.x-x1);
          var id = canvas.getContext('2d',{willReadFrequently:true})
                          .getImageData(x1-elem.x,y-elem.y,n1,1);
          if(id) imgdata1=id.data;
        }
        if(x2 >= elem.x && x2 < elem.x + elem.width && x1 < elem.x) {
          // second half in this image. start on left side, fill remaining
          var id = canvas.getContext('2d',{willReadFrequently:true})
                          .getImageData(0,y-elem.y,x2-elem.x,1);
          if(id) imgdata2=id.data;
        }
      }
      
    }
  }
  // console.log("rawdata ",imgdata1,imgdata2);
  var data = new Uint8ClampedArray(imgdata1.length + imgdata2.length);
  data.set(imgdata1);
  data.set(imgdata2, imgdata1.length);
  // var data = imgdata1.concat(imgdata2);
  
  // var retval = getEncodedExtraData(imgdata);
  var n = data.length/4;
  var retval = {};
  retval.raw=          new Histogram(n,x1,x2);
  retval.noise=        new Histogram(n,x1,x2); 
  retval.noiseremoved= new Histogram(n,x1,x2);

  // Pull a single horizontal line from the png.
  for(var i=0;i<n;i++) {
    var d = getEncodedPngVal(data,i);
    var s = getEncodedPngValNoise(data,i);
    retval.raw.SetBinContent(i,d);
    retval.noise.SetBinContent(i,s);
    retval.noiseremoved.SetBinContent(i,d-s);
  }
  return retval;
  
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
  if(GetSelected("wireimg").pedestals)
    h+="Pedestal:" + GetSelected("wireimg").pedestals[chan] + '<br/>';


  if(gHoverState.type == "hit") {
    // console.warn("hit hover: ",gHoverState.obj);
    tdc = Math.max(Math.floor(gHoverState.obj.t),0);
    wire = gHoverState.obj.wire;
    plane = gHoverState.obj.plane;
    chan = gGeo.channelOfWire(plane,wire);
    h += "Hit: q:" + gHoverState.obj.q + " t:" + gHoverState.obj.t;
    h += "  Channel: " +  chan;
    h += "  Plane: " + plane + "  Wire: " +  wire;
    h += "  TDC: " +tdc;
    if(gHoverState.obj.t1) h += "  StartTDC: " + gHoverState.obj.t1 + "   StopTDC:" + gHoverState.obj.t2;
    showgraph = true;
  }
  $(this.txt_element).html(h);
  
  
  
  if(!showgraph) return;
  
  
  // Pull a single horizontal line from the png into the histogram
  var show_image = $(this.ctl_wireimg_type).filter(":checked").val();
  var image_name = GetSelectedName("wireimg");

  // var offscreenCtx;
  // var tiled_canvas = (((gRecord || {}).wireimg || {})[image_name] || {})._tiled_canvas || {};
  // if( tiled_canvas.loaded ) {
  //   offscreenCtx = tiled_canvas.ctx;
  //   if(image_name.includes("recob::Wire")) this.graph.ylabel="Deconvoluted ADC";
  //   if(image_name.includes("raw::RawDigit")) this.graph.ylabel="Raw ADC";
  // } else return;
  //
  // this.graph.hists = [];
  // this.graph.colorscales = [];
  // var maxwire = gGeo.numWires(plane);
  // this.graph.max_v = -1e9;
  // this.graph.min_v =  1e9;
  //
  // this.graph_data = this.GetWireDataHistograms(offscreenCtx,chan,tdc,100);
  

  var mapper = null;

  var wname = GetSelectedName("wireimg");
  var wireimg = (((gRecord || {})["wireimg"]        || {})[wname] || {});
  var wlowres = (((gRecord || {})["wireimg-lowres"] || {})[wname] || {});
  if      (wireimg._glmapper) {mapper = wireimg._glmapper; }
  else if (wlowres._glmapper) {mapper = wlowres._glmapper; }

  if(!mapper) return;
  this.graph_data = this.GetWireDataHistograms3(mapper,chan,tdc,100);

  if($('#ctl-gl-edge-finder').is(":checked")) {
    for(var i=0;i<this.graph_data.noiseremoved.n;i++) {
      this.graph_data.noiseremoved.data[i] = this.graph_data.noiseremoved.data[i]-this.graph_data.noiseremoved.data[i+1];
    }
  }
  
  var dotcolor = {
    GetColor: function(t,f) { var c=gWirePseudoColor.ColorDialToColor(gWirePseudoColor.AdcToColorDial(f)); 
      return parseInt(c.r)+','+parseInt(c.g)+','+parseInt(c.b); }
  };
  
  // this.graph.SetHist(this.graph_data.noiseremoved,dotcolor,{doDots: true, doGraph:true, doFill:false, lineWidth: 2});
  // this.graph.AddHist(this.graph_data.noise,new new ColorScaleIndexed(2),{doDots: false, doGraph:true, doFill:true, lineWidth: 4});
  // this.graph.AddHist(this.graph_data.raw,new ColorScaleRGB(1),{doDots: false, doGraph:true, doFill:false, lineWidth: 4});

  if($('#ctl-coherent-noise-filter').is(":checked") && show_image != 'cal') {
    this.graph.ylabel="Noise-filtered ADC";    
    this.graph.SetHist(this.graph_data.noiseremoved,  dotcolor,          {doDots: true, doGraph:true, doFill:false, lineWidth: 2, strokeStyle:"black"});    
  } else {
    this.graph.SetHist(this.graph_data.raw         ,  dotcolor,          {doDots: true, doGraph:true, doFill:false, lineWidth: 2, strokeStyle:"black"});
  }
  this.graph.AddHist(this.graph_data.noise,   new ColorScaleIndexed(2),{doDots: false, doGraph:true, doFill:false, lineWidth: 1, strokeStyle:"blue"});

  
  // for(var i = -(this.show_nwires_below); i<= this.show_nwires_above; i++) {
  //   if(i==0) continue;
  //   this.graph.AddHist(this.graph_data[i],new ColorScaleIndexed(1),
  //     {doDots: false, doGraph:true, doFill:false, lineWidth:0.5, xoffset:-10*i, yoffset:i*30});
  // }

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

  /// ------ Manual Draw
  this.graph.Draw();
  
    
  // this.graph.Clear();
  // this.graph.DrawFrame();
  //
  // this.graph.DrawHists();

  /*
  if (!this.graph.ctx) return;
  this.graph.ctx.save();
   for(var iHist = 0; iHist< this.graph.hists.length; iHist++){
     //log("  drawing hist "+iHist);
     var hist = this.graph.hists[iHist];
     var colorscale = this.graph.colorscales[iHist];
     var i, t, f, x, y;
     
     if(this.graph.show_lines) {
       this.graph.ctx.lineCap = "round";
       this.graph.ctx.lineJoin="round";
       this.graph.ctx.lineWidth=1;
       this.graph.ctx.strokeStyle =  "rgba(" + colorscale.GetColor() + ",1.0)";
       this.graph.ctx.beginPath();
       for (i = 0; i < hist.n; i++) {
         t = hist.GetX(i);
         f = hist.data[i];
         x = Math.floor(this.graph.GetX(t)) + this.graph.waterfall_offset[0]*iHist;
         y = Math.floor(this.graph.GetY(f)) - this.graph.waterfall_offset[1]*iHist;
         if(i===0) this.graph.ctx.moveTo(x,y);
         else     this.graph.ctx.lineTo(x,y);
       }
       this.graph.ctx.stroke();
     }

     var r = Math.min(6,this.graph.span_x/hist.n/2);
     r = Math.max(r,2);
     
     if(this.graph.show_points) {
       
       for (i = 0; i < hist.n; i++) {
         this.graph.ctx.beginPath();
         t = hist.GetX(i);
         f = hist.data[i];
         x = Math.floor(this.graph.GetX(t)) + this.graph.waterfall_offset[0]*iHist;
         y = Math.floor(this.graph.GetY(f)) - this.graph.waterfall_offset[1]*iHist;
         this.graph.ctx.fillStyle =  gWirePseudoColor.ColorDialToCtxColor(gWirePseudoColor.AdcToColorDial(f));
         this.graph.ctx.arc(x,y,r,0,1.999*Math.PI);
         this.graph.ctx.fill();
       }
     }
     
   }
   this.graph.ctx.restore();
   */
  
};

