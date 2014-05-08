


// Subclass of Pad.
OmHist2Canvas.prototype = new Hist2Canvas(null);           

function OmHist2Canvas( element, path )
{
  if(element==null) return;
  this.top_element = element;
  $(this.top_element).append("<div class='title' />");
  $(this.top_element).append("<div class='pad main' />");
  $(this.top_element).append("<div class='pad scale' />");
  this.main_element = $('div.main',this.top_element).get(0);
  $(this.main_element).css("height","300px");
  $(this.main_element).css("width","300px");
  $(this.main_element).css("display","inline-block");
  this.scale_element = $('div.scale',this.top_element).get(0);
  // $(this.scale_element).css("float","right");
  $(this.scale_element).css("height","150px");
  $(this.scale_element).css("width","200px");
  $(this.scale_element).css("margin-left","20px");
  $(this.scale_element).css("display","inline-block");
  
  this.associate_hist = new HistCanvas(this.scale_element,{margin_left:50});

  this.path = path;
  var settings = {
    log_y:false,
    margin_left:40,   
    first_draw:true
  };
  var element_settings = ($(element).data('options'));
  Hist2Canvas.call(this, this.main_element, settings); // Give settings to Pad contructor.


  var self = this;  
  this.mynamespace= "mns" + this.gUniqueIdCounter;
  $(document).on("OmDataRecieved."+this.mynamespace, function(){return self.UpdateData()});  
  $(this.top_element).on("remove."+this.mynamespace, function(){return self.Remove()});  

  console.log($(element).data("options"));
  console.log("OmHist2Canvas with path",this.path,"element",this.top_element);
  gOmData.add(this.path);
} 

OmHist2Canvas.prototype.Remove = function()
{
  console.log("Removing ",this.path);
  gOmData.remove(this.path);
  $(document).off("OmDataRecieved."+this.mynamespace);
  delete this.associate_hist;
}


OmHist2Canvas.prototype.UpdateData = function()
{
  console.timeStamp("Drawing "+this.path);
  
  this.hist = gOmData.getObj(this.path);
  // $("div.title",this.top_element).html(this.hist.title);

  $(".portlet-title",$(this.top_element).parent()).html(this.hist.title);
  this.xlabel = this.hist.xlabel;
  this.ylabel = this.hist.ylabel;
  this.bound_u_min = this.hist.min;
  this.bound_u_max = this.hist.max;
  this.time_on_x   = this.hist.time_on_x;
  this.cs = new ColorScaler();
  this.cs.min = this.hist.min_content;
  this.cs.max = this.hist.max_content;
  this.SetHist(this.hist,this.cs);
  if(this.first_draw){
    this.first_draw = false;
    this.ResetToHist(this.hist);
  }
  this.Draw();
  console.timeStamp("Done drawing "+this.path);
  
  this.hist1d = CreateGoodHistogram(50, this.hist.min_content, this.hist.max_content);
  
  for (var i = 0; i < this.hist.n_x; i++) {
    for (var j =0; j< this.hist.n_y; j++) {
      var z = this.hist.data[i][j];
      this.hist1d.Fill(z);
    }
  }
  this.associate_hist.xlabel = this.hist.zlabel || "Bin Content";
  this.associate_hist.ylabel = "# of Bins";
  this.associate_hist.SetHist(this.hist1d,this.cs);
  this.associate_hist.ResetToHist(this.hist1d);     
  
  var self = this;
  this.associate_hist.FinishRangeChange = function(){self.Draw();}
  this.associate_hist.ChangeRange = function(minu,maxu){
      self.cs.min = minu; 
      self.cs.max = maxu; 
      HistCanvas.prototype.ChangeRange.call(this,minu,maxu);}
  this.associate_hist.Draw();
}


