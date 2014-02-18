
var gOmData  = null;
var gRefData = null;

var gCurFile = "current.root";
var gRefFile = "reference.root";

// Open data files according the provided arguments on the URL.
$(function(){
  // Decode parameters from URL.
  var urlparams = $.deparam.querystring();
  if(urlparams.filename) gCurFile = urlparams.filename;
  if(urlparams.ref     ) gRefFile = urlparams.ref;
  
 console.log(urlparams,"Attempting new OmDataObj gets with gCurFile=",gCurFile," and gRefFile ",gRefFile);
  gOmData  = new OmDataObj(gCurFile,true);
  gRefData = new OmDataObj(gRefFile,false);
  
});

function OmDataObj(file, primary)
{
  this.paths = [];
  this.cur_cycle = "";
  this.file = file;
  this.status = "uninitialized";  
  $.event.trigger({ type: "OmDataChangeState", state: this.status}) ;
  this.primary = primary;
  this.event_to_emit = "OmDataRecieved";
  if(!this.primary) this.event_to_emit = "OmRefDataRecieved";
}


OmDataObj.prototype.add = function(path)
{
  // Ensure not a duplicate entry.
  if( $.inArray(path,this.paths)==-1)
    this.paths.push(path);

  console.log("OmDataObj::add",this.paths);
}

OmDataObj.prototype.remove = function(path)
{
  this.paths = $.grep(this.paths,function(elem,index){
    return elem !==path;
  });
  console.log("OmDataObj::remove",this.paths);
  
}


OmDataObj.prototype.get = function()
{
  console.log("OmDataObj::get",this.paths);
  
  this.myurl = "server/serve_hists.cgi"; // Note relative url.
  this.param = $.param({
    filename: this.file,
    hists: this.paths.join(':'),
    options: "-",
    });

  var self = this;
  $.ajax({
          type: "GET",
          url: this.myurl,
          data: this.param,
          contentType: "application/json; charset=utf-8",
          dataType: "json",
          async: true,
          error:    function(){self.QueryError()},
          success:  function(data,textStatus,jqxhr){self.QuerySuccess(data,textStatus,jqxhr)},
        }); 
  this.status = "getting";
  $.event.trigger({ type: "OmDataChangeState", state: this.status}) ;
}

OmDataObj.prototype.QueryError = function()
{
  this.status = "error";
  $.event.trigger({ type: "OmDataChangeState", state: this.status}) ;
}

OmDataObj.prototype.QuerySuccess = function(data,textStatus,jqxhr)
{
  this.status = "success";
  $.event.trigger({ type: "OmDataChangeState", state: this.status}) ;
  this.data = data;
  var bad=false;
  if(data.error) { bad = true; this.status = data.error; }
  if(data.record.error) { bad = true; this.status = data.record.error; }
  if(bad) {
    console.warn("Got error when retrieving data"+data.error);
    $.event.trigger({
      type: "OmDataError",
      msg: "Backend error: "+data.error
    }) ;
    return;
  }

  console.log("Got data on ",this.file,". Triggering.");
  $.event.trigger({type: this.event_to_emit}) ;

}

