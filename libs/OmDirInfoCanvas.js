


// Subclass of Pad.
OmDirInfoCanvas.prototype = new ABoundObject(null);           

function OmDirInfoCanvas( element, path )
{
  if(element==null) return;
  this.element = element;
  var element_settings = ($(element).data('options'));
  ABoundObject.call(this, this.main_element, element_settings); // Give settings to Pad contructor.
  this.path = path;

  var self = this;  
  this.mynamespace= "ns" + this.UniqueId;
  $(document).on("OmDataRecieved."+this.mynamespace, function(){return self.UpdateData()});  
  $(document).on("OmRefDataRecieved."+this.mynamespace, function(){return self.UpdateRefData()});  
  $(this.top_element).on("remove."+this.mynamespace, function(){return self.Remove()});  
  
  console.log($(element).data("options"));
  console.log("OmDirInfoCanvas with path",this.path);
  gOmData.add(this.path);
  gRefData.add(this.path);
} 

OmDirInfoCanvas.prototype.Remove = function()
{
  console.log("Removing ",this.path);
  gOmData.remove(this.path);
  gRefData.remove(this.path);
  $(document).off("OmDataRecieved."+this.mynamespace);
  $(document).off("OmRefDataRecieved."+this.mynamespace);
  $(this.ctl_histo_logscale).off("change."+this.mynamespace);
  $(this.ctl_histo_fill).off("change."+this.mynamespace);
  $(this.ctl_histo_reset).off("click."+this.mynamespace);
}

OmDirInfoCanvas.prototype.UpdateData = function()
{
  this.info = gOmData.getObj(this.path);
  // $("div.title",this.top_element).html(this.hist.title);

  this.Update();
}

OmDirInfoCanvas.prototype.UpdateRefData = function()
{
  console.timeStamp("Drawing "+this.path);
  
  this.refinfo = gRefData.getObj(this.path);

  this.Update();
}


OmDirInfoCanvas.prototype.Update = function()
{
  if(!this.info) return;
  $(".portlet-title",$(this.top_element).parent()).html("Directory Info");

  var h = "<table class='dirinfo'>";
  for(var i in this.info) {
    var thing = this.info[i];
    h+= "<tr><td>" + thing.title + "</td><td>" + thing.value
    if(thing.hasOwnProperty("error")) h+= " &plusmn; " + thing.error;
    h+="</td><td class='dirinfo-ref'>";
    
    if(this.refinfo && this.refinfo[i]) {
      h+= this.refinfo[i].value;
      if(this.refinfo[i].hasOwnProperty("error")) h+= " &plusmn; " + this.refinfo[i].error;
    }
    h+="</td><td class='dirinfo-desc'>";
    if(thing.desc) h+= thing.desc
    h+="</td></tr>";
  }
  h+="</table>";
  $(this.element).html(h);
}

