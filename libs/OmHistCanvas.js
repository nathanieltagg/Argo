


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
    margin_left:50
    
  };
  var element_settings = ($(element).data('options'));
  HistCanvas.call(this, this.main_element, settings); // Give settings to Pad contructor.

  var self = this;  
  this.mynamespace= "mns" + this.gUniqueIdCounter;
  $(document).on("OmDataRecieved."+this.mynamespace, function(){return self.UpdateData()});  
  $(this.top_element).on("remove."+this.mynamespace, function(){return self.Remove()});  

  console.log($(element).data("options"));
  console.log("OmHistCanvas with path",this.path);
  gOmData.add(this.path);
} 

OmHistCanvas.prototype.Remove = function()
{
  console.log("Removing ",this.path);
  gOmData.remove(this.path);
  $(document).off("OmDataRecieved."+this.mynamespace);
}

OmHistCanvas.prototype.UpdateData = function()
{
  console.timeStamp("Drawing "+this.path);
  
  console.log("looking for ",this.path,' in ', gOmData.data.record,gOmData.data.record[this.path]);
  console.log(gOmData.data.record[this.path]);
  this.hist = $.extend(true,new Histogram(1,0,1), 
                gOmData.data.record[this.path].data);
  $("div.title",this.top_element).html(this.hist.title);
  this.xlabel = this.hist.xlabel;
  this.ylabel = this.hist.ylabel;
  this.bound_u_min = this.hist.min;
  this.bound_u_max = this.hist.max;
  this.time_on_x   = this.hist.time_on_x;
   this.SetHist(this.hist,new ColorScaleIndexed(0));
  this.ResetToHist(this.hist);
  this.Draw();
  console.timeStamp("Done drawing "+this.path);
}

