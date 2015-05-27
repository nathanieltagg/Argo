


// Subclass of Pad.
OmHistCanvas.prototype = new HistCanvas(null);           

function OmHistCanvas( element, path )
{
  if(element===null) return;
  this.top_element = element;
  $(this.top_element).append("<div class='title' />");
  $(this.top_element).append("<div class='about' />");

  $(this.top_element).append("<div class='pad main' />");
  this.main_element = $('div.main',this.top_element).get(0);
  $(this.main_element).css("height","200px");
  $(this.main_element).css("width","100%");
  $(this.top_element).append('<span class="stats"></span><span class="mouseover-info"></span><br/>');
  
  $(this.top_element).append('<span><input type="checkbox" name="ctl-histo-logscale" checked="yes" class="ctl-histo-logscale"/><label for="ctl-histo-logscale"><b>(l)</b>og-scale </label></span>');
  $(this.top_element).append('<span><input type="checkbox" name="ctl-histo-fill" checked="yes"     class="ctl-histo-fill"/><label for="ctl-histo-fill"><b>(f)</b>ill</label></span>');
  $(this.top_element).append('<span><input type="checkbox" name="ctl-histo-flip"                   class="ctl-histo-flip"/><label for="ctl-histo-flip"><b>(b)</b>reference on top</label></span>');
  $(this.top_element).append('<span><button type="button" name="ctl-histo-reset" checked="yes" class="ctl-histo-reset"><b>(r)</b>eset</button></span>');
  this.path = path;
  var settings = {
    log_y:true,
    margin_left:70,   
    first_draw:true
  };
  var element_settings = ($(element).data('options'));
  HistCanvas.call(this, this.main_element, settings); // Give settings to Pad contructor.

  this.controls_init = false;

  var self = this;  
  this.mynamespace= "ns" + this.UniqueId;
  $(document).on("OmDataRecieved."+this.mynamespace, function(){return self.UpdateData();});  
  $(document).on("OmRefDataRecieved."+this.mynamespace, function(){return self.UpdateRefData();});  
  $(this.top_element).on("remove."+this.mynamespace, function(){return self.Remove();});  

  this.ctl_histo_logscale= GetBestControl(this.element,".ctl-histo-logscale");
  $(this.ctl_histo_logscale).on("change."+this.mynamespace, function(){return self.Draw();});

  this.ctl_histo_fill = GetBestControl(this.element,".ctl-histo-fill");
  $(this.ctl_histo_fill).on("change."+this.mynamespace, function(){return self.Draw();});

  this.ctl_histo_flip = GetBestControl(this.element,".ctl-histo-flip");
  $(this.ctl_histo_flip).on("change."+this.mynamespace, function(){return self.Draw();});

  this.ctl_histo_reset = GetBestControl(this.element,".ctl-histo-reset");
  $(this.ctl_histo_reset).on("click."+this.mynamespace, function(){self.ResetScales(); self.Draw();});
  
  console.log($(element).data("options"));
  console.log("OmHistCanvas with path",this.path,"element",this.top_element);
  gOmData.add(this.path);
  gRefData.add(this.path);
} 

OmHistCanvas.prototype.Remove = function()
{
  console.log("Removing ",this.path);
  gOmData.remove(this.path);
  gRefData.remove(this.path);
  $(document).off("OmDataRecieved."+this.mynamespace);
  $(document).off("OmRefDataRecieved."+this.mynamespace);
  $(this.ctl_histo_logscale).off("change."+this.mynamespace);
  $(this.ctl_histo_fill).off("change."+this.mynamespace);
  $(this.ctl_histo_flip).off("change."+this.mynamespace);
  $(this.ctl_histo_reset).off("click."+this.mynamespace);
};

OmHistCanvas.prototype.UpdateData = function()
{
  this.hist = $.extend(true,new Histogram(1,0,1), 
                        gOmData.getObj(this.path));
  // $("div.title",this.top_element).html(this.hist.title);
  console.log("got primary data for "+this.path);
  this.Update();
};

OmHistCanvas.prototype.UpdateRefData = function()
{
  console.timeStamp("Drawing "+this.path);
  
  // Make sure reference data exists.
  if(gRefData.getObj(this.path)) {
    console.log("got ref data for "+this.path);
    
    this.refhist = $.extend(true,new Histogram(1,0,1), 
                    gRefData.getObj(this.path));
  } else {
    console.warn("no ref data for "+this.path);
  }
  // $("div.title",this.top_element).html(this.hist.title);

  // this.Update();
};


OmHistCanvas.prototype.Update = function()
{
  if(!this.hist) return;
  $(".portlet-title",$(this.top_element).parent()).html(this.hist.title);
  if(this.hist.info.about) $(".about",this.top_element).html(this.hist.info.about);
  this.xlabel = this.hist.xlabel;
  this.ylabel = this.hist.ylabel;
  this.bound_u_min = this.hist.min;
  this.bound_u_max = this.hist.max;
  if(this.refhist) {
    this.bound_u_min = Math.min(this.hist.min,this.refhist.min);
    this.bound_u_max = Math.max(this.hist.max,this.refhist.max);
  }
  this.time_on_x   = this.hist.time_on_x;
  if(this.time_on_x) this.tick_pixels_x  = 60;
  
  var do_errors = ("errs" in this.hist);
  if((!this.controls_init) && (this.hist.info)) {
    if(this.hist.classname == "TProfile") {
      $(this.ctl_histo_fill).prop('checked',false);
      $(this.ctl_histo_logscale).prop('checked',false);
      this.suppress_zero = true;
    }
    if("draw_fill"          in this.hist.info) $(this.ctl_histo_fill).prop('checked',this.hist.info.draw_fill);
    if("draw_logy"          in this.hist.info) $(this.ctl_histo_logscale).prop('checked',this.hist.info.draw_logy);
    if("draw_zero_suppress" in this.hist.info)  this.suppress_zero = this.hist.info.draw_zero_suppress;
    this.controls_init = true; // don't do on update of histogram.
  }

  this.ClearHists();

  if(this.refhist  ) this.AddHist(this.refhist,new ColorScaleIndexed(1),
                                {doLine:true,doFill:false,strokeStyle:"red",alpha:1,composite:'darken'});
  if(this.hist     ) this.AddHist(this.hist,new ColorScaleIndexed(0),{alpha:1,doErrors:do_errors,composite:'darken'});
  // if(this.suppress_zero) {
  //   this.min_v = this.hist.min_content;
  //   if(this.refhist) this.min_v = Math.min(this.hist.min_content, this.refhist.min_content);
  // }
  if(this.min_v >= this.max_v) this.min_v = this.max_v*0.9;
  if(this.min_v >= this.max_v) this.min_v = this.max_v-1;

  this.Draw();

  var stats = "";
  stats += "<span>Entries: " + this.hist.total + " </span>";
  stats += "<span>Mean: " + this.hist.GetMean().toFixed(1) + " </span>";
  stats += "<span>RMS: " + this.hist.GetRMS().toFixed(1) + " </span>";
  stats += "<span>Underflow: " + this.hist.underflow + " </span>";
  stats += "<span>Overflow: " + this.hist.overflow + " </span>";
  
  $(".stats",this.top_element).html(stats);
  console.timeStamp("Drawing "+this.path);
  console.log("Done drawing "+this.path,this.bound_u_min,this.hist,this.refhist);
};

OmHistCanvas.prototype.Draw = function()
{
  if(!this.hist)  {
    this.ctx.save();
    this.ctx.lineStyle = 'black'; 
    this.ctx.font="20px Georgia";
    this.ctx.strokeText("Waiting for data...",this.origin_x + this.span_x/2, this.origin_y - this.span_y/2);
    this.ctx.restore();
    return;
  }
  
  this.log_y = $(this.ctl_histo_logscale).is(":checked");
 

  for(var i=0;i<this.fHistOptions.length;i++) {
    if( $(this.ctl_histo_fill).is(":checked") ) {
      this.fHistOptions[i].doFill=true;
      this.fHistOptions[i].doLine=false;
    } else {
      this.fHistOptions[i].doFill=false;
      this.fHistOptions[i].doLine=true;
    }
  }
  
   HistCanvas.prototype.Draw.call(this);
};

OmHistCanvas.prototype.DrawHists = function( ) 
{
  var flip = $(this.ctl_histo_flip).is(":checked");
  console.log("flipping:",flip);
  var iHist;
  if(flip) {
    for(iHist = this.fNHist-1; iHist>= 0; iHist--) this.DrawHist(iHist);    
  } else {
    for(iHist = 0; iHist< this.fNHist; iHist++) this.DrawHist(iHist);        
  }
};

OmHistCanvas.prototype.DoMouseOverContent = function( u, v )
{
  // console.log(u,v);
  var txt = "";
  if(u !== null) {
    if(this.hist) {
      var bin = this.hist.GetBin(u);
      var x = this.hist.GetX(bin);
      txt = "<span><b>";
      txt += "Content: " + x + " : " + this.hist.data[bin];
      if(this.hist.errs) txt += " &pm; " + this.hist.errs[bin];
      if(this.refhist) {
        bin = this.refhist.GetBin(u);
        x = this.refhist.GetX(bin);
        txt += " Reference: " + x + " : " + this.refhist.data[bin];
        if(this.refhist.errs) txt += " &pm; " + this.refhist.errs[bin];
      }
      txt += "</b></span>";
    }
  }
  $(".mouseover-info",this.top_element).html(txt);
};
