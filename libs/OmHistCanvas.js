


// Subclass of Pad.
OmHistCanvas.prototype = new HistCanvas(null);           

function OmHistCanvas( element, path )
{
  if(element==null) return;
  this.top_element = element;
  $(this.top_element).append("<div class='title' />");
  $(this.top_element).append("<div class='pad main' />");
  this.main_element = $('div.main',this.top_element).get(0);
  $(this.main_element).css("height","200px");
  $(this.main_element).css("width","100%");

  this.path = path;
  var settings = {
    log_y:true,
    margin_left:70,   
    first_draw:true
  };
  var element_settings = ($(element).data('options'));
  HistCanvas.call(this, this.main_element, settings); // Give settings to Pad contructor.



  var self = this;  
  this.mynamespace= "ns" + this.UniqueId;
  $(document).on("OmDataRecieved."+this.mynamespace, function(){return self.UpdateData()});  
  $(document).on("OmRefDataRecieved."+this.mynamespace, function(){return self.UpdateRefData()});  
  $(this.top_element).on("remove."+this.mynamespace, function(){return self.Remove()});  

  console.log($(element).data("options"));
  console.log("OmHistCanvas with path",this.path,"element",this.top_element);
  gOmData.add(this.path);
  gRefData.add(this.path);
} 

OmHistCanvas.prototype.Remove = function()
{
  console.log("Removing ",this.path);
  gOmData.remove(this.path);
  $(document).off("OmDataRecieved."+this.mynamespace);
  $(document).off("OmRefDataRecieved."+this.mynamespace);
  
}

OmHistCanvas.prototype.UpdateData = function()
{
  console.timeStamp("Drawing "+this.path);
  
  console.log("looking for ",this.path,' in ', gOmData.data.record,gOmData.data.record[this.path]);
  console.log(gOmData.data.record[this.path]);
  this.hist = $.extend(true,new Histogram(1,0,1), 
                gOmData.data.record[this.path].data);
  // $("div.title",this.top_element).html(this.hist.title);

  this.Update();
}

OmHistCanvas.prototype.UpdateRefData = function()
{
  console.timeStamp("Drawing "+this.path);
  
  console.log("looking for ",this.path,' in ', gRefData.data.record,gRefData.data.record[this.path]);
  console.log(gRefData.data.record[this.path]);
  this.refhist = $.extend(true,new Histogram(1,0,1), 
                  gRefData.data.record[this.path].data);
  // $("div.title",this.top_element).html(this.hist.title);

  this.Update();
}


OmHistCanvas.prototype.Update = function()
{
  if(!this.hist) return;
  $(".portlet-title",$(this.top_element).parent()).html(this.hist.title);
  if(this.hist.max_content > 20) this.log_y = true;
  else                           this.log_y = false;
  this.xlabel = this.hist.xlabel;
  this.ylabel = this.hist.ylabel;
  this.bound_u_min = this.hist.min;
  this.bound_u_max = this.hist.max;
  this.time_on_x   = this.hist.time_on_x;
  this.SetHist(this.hist,new ColorScaleIndexed(0));
  if(this.refhist) this.AddHist(this.refhist,new ColorScaleIndexed(1),{doLine:true,doFill:true,strokeStyle:"red",alpha:0.5});
  if(this.first_draw){
    this.first_draw = false;
    this.ResetToHist(this.hist);
  }
  this.Draw();
  console.timeStamp("Done drawing "+this.path);
  
}
